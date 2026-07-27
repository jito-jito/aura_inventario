import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { PassThrough } from 'stream';
import { gunzipSync } from 'zlib';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BackupService } from './backup.service';

jest.mock('child_process');
const mockedSpawn = spawn as unknown as jest.Mock;

function fakeChildProcess(options: { output?: string; exitCode?: number; error?: Error }) {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough };
  child.stdout = stdout;
  child.stderr = stderr;

  process.nextTick(() => {
    if (options.error) {
      child.emit('error', options.error);
      return;
    }
    stdout.end(options.output ?? 'SQL DUMP CONTENT');
    stderr.end();
    child.emit('close', options.exitCode ?? 0);
  });

  return child;
}

describe('BackupService', () => {
  let tempDir: string;
  let config: Record<string, string>;

  const configServiceMock = {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key in config) return config[key];
      return fallback;
    }),
  };

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'aura-backups-test-'));
    config = { BACKUP_DIR: tempDir, BACKUP_RETENTION_COUNT: '14' };
    mockedSpawn.mockReset();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function createService(): BackupService {
    return new BackupService(configServiceMock as any);
  }

  it('genera un respaldo comprimido con el contenido del dump', async () => {
    mockedSpawn.mockImplementation(() => fakeChildProcess({ output: 'CREATE TABLE products();' }));

    const service = createService();
    const info = await service.runBackup();

    expect(info.filename).toMatch(/^aura-inventario-\d{8}T\d{6}\.sql\.gz$/);
    const filePath = join(tempDir, info.filename);
    expect(existsSync(filePath)).toBe(true);
    const decompressed = gunzipSync(readFileSync(filePath)).toString('utf8');
    expect(decompressed).toBe('CREATE TABLE products();');
  });

  it('pasa las credenciales de la base de datos a pg_dump', async () => {
    config = {
      ...config,
      DB_HOST: 'db-host',
      DB_PORT: '5555',
      DB_USER: 'aura-user',
      DB_PASSWORD: 'aura-pass',
      DB_NAME: 'aura-db',
    };
    mockedSpawn.mockImplementation(() => fakeChildProcess({}));

    const service = createService();
    await service.runBackup();

    expect(mockedSpawn).toHaveBeenCalledWith(
      'pg_dump',
      expect.arrayContaining(['--host', 'db-host', '--port', '5555', '--username', 'aura-user', 'aura-db']),
      expect.objectContaining({ env: expect.objectContaining({ PGPASSWORD: 'aura-pass' }) }),
    );
  });

  it('rechaza y borra el archivo parcial si pg_dump termina con error', async () => {
    mockedSpawn.mockImplementation(() => fakeChildProcess({ output: '', exitCode: 1 }));

    const service = createService();
    await expect(service.runBackup()).rejects.toThrow(BadRequestException);

    const files = await service.listBackups();
    expect(files).toHaveLength(0);
  });

  it('rechaza si pg_dump no está instalado (ENOENT)', async () => {
    mockedSpawn.mockImplementation(() =>
      fakeChildProcess({ error: Object.assign(new Error('spawn pg_dump ENOENT'), { code: 'ENOENT' }) }),
    );

    const service = createService();
    await expect(service.runBackup()).rejects.toThrow(BadRequestException);
  });

  it('aplica la retención y borra los respaldos más viejos', async () => {
    writeFileSync(join(tempDir, 'aura-inventario-20260101T000000.sql.gz'), 'old-1');
    writeFileSync(join(tempDir, 'aura-inventario-20260101T000001.sql.gz'), 'old-2');
    writeFileSync(join(tempDir, 'aura-inventario-20260101T000002.sql.gz'), 'old-3');
    config = { ...config, BACKUP_RETENTION_COUNT: '2' };
    mockedSpawn.mockImplementation(() => fakeChildProcess({}));

    const service = createService();
    await service.runBackup();

    const remaining = (await service.listBackups()).map((f) => f.filename).sort();
    expect(remaining).toHaveLength(2);
    expect(remaining).toContain('aura-inventario-20260101T000002.sql.gz');
    expect(remaining.some((name) => name.startsWith('aura-inventario-2026') && !name.includes('20260101'))).toBe(
      true,
    );
  });

  it('lista los respaldos ordenados del más nuevo al más viejo', async () => {
    writeFileSync(join(tempDir, 'aura-inventario-20260101T000000.sql.gz'), 'a');
    writeFileSync(join(tempDir, 'aura-inventario-20260201T000000.sql.gz'), 'b');

    const service = createService();
    const files = await service.listBackups();

    expect(files.map((f) => f.filename)).toEqual([
      'aura-inventario-20260201T000000.sql.gz',
      'aura-inventario-20260101T000000.sql.gz',
    ]);
    expect(files[0].createdAt).toBe('2026-02-01T00:00:00.000Z');
  });

  describe('getBackupFilePath', () => {
    it('rechaza nombres que no matchean el patrón esperado (protección contra path traversal)', async () => {
      const service = createService();
      await expect(service.getBackupFilePath('../../etc/passwd')).rejects.toThrow(BadRequestException);
      await expect(service.getBackupFilePath('not-a-backup.txt')).rejects.toThrow(BadRequestException);
    });

    it('lanza NotFoundException si el archivo no existe', async () => {
      const service = createService();
      await expect(
        service.getBackupFilePath('aura-inventario-20260101T000000.sql.gz'),
      ).rejects.toThrow(NotFoundException);
    });

    it('devuelve la ruta si el archivo existe', async () => {
      writeFileSync(join(tempDir, 'aura-inventario-20260101T000000.sql.gz'), 'a');
      const service = createService();
      const path = await service.getBackupFilePath('aura-inventario-20260101T000000.sql.gz');
      expect(path).toBe(join(tempDir, 'aura-inventario-20260101T000000.sql.gz'));
    });
  });
});
