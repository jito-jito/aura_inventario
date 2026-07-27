import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { spawn } from 'child_process';
import { createWriteStream, promises as fs } from 'fs';
import { join, resolve } from 'path';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';

export interface BackupFileInfo {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

const FILENAME_PATTERN = /^aura-inventario-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.sql\.gz$/;

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(private readonly config: ConfigService) {}

  private get backupDir(): string {
    return resolve(this.config.get<string>('BACKUP_DIR', './backups'));
  }

  private get retentionCount(): number {
    return this.config.get<number>('BACKUP_RETENTION_COUNT', 14);
  }

  /** Respaldo automático diario. Deshabilitable con BACKUP_CRON_ENABLED=false. */
  @Cron('0 3 * * *', { name: 'nightly-database-backup' })
  async runScheduledBackup(): Promise<void> {
    if (this.config.get<string>('BACKUP_CRON_ENABLED', 'true') === 'false') {
      return;
    }
    try {
      await this.runBackup();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      this.logger.error(`Respaldo automático nocturno falló: ${message}`);
    }
  }

  async runBackup(): Promise<BackupFileInfo> {
    await fs.mkdir(this.backupDir, { recursive: true });

    const filename = `aura-inventario-${this.timestampForFilename()}.sql.gz`;
    const filePath = join(this.backupDir, filename);

    const dbHost = this.config.get<string>('DB_HOST', 'localhost');
    const dbPort = this.config.get<string>('DB_PORT', '5432');
    const dbUser = this.config.get<string>('DB_USER', 'aura');
    const dbPassword = this.config.get<string>('DB_PASSWORD', 'aura');
    const dbName = this.config.get<string>('DB_NAME', 'aura_inventario');

    const pgDump = spawn(
      'pg_dump',
      [
        '--host',
        dbHost,
        '--port',
        dbPort,
        '--username',
        dbUser,
        '--no-owner',
        '--no-privileges',
        dbName,
      ],
      { env: { ...process.env, PGPASSWORD: dbPassword } },
    );

    let stderr = '';
    pgDump.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    // Si el proceso ni siquiera pudo arrancar (ej. pg_dump no instalado), 'close'
    // nunca se emite y stdout nunca termina: hay que cortar el pipeline a mano.
    pgDump.on('error', (err) => {
      pgDump.stdout.destroy(err);
    });

    const exitCodePromise = new Promise<number>((resolvePromise, rejectPromise) => {
      pgDump.on('error', rejectPromise);
      pgDump.on('close', (code) => resolvePromise(code ?? 1));
    });

    try {
      await Promise.all([
        pipeline(pgDump.stdout, createGzip(), createWriteStream(filePath)),
        exitCodePromise.then((exitCode) => {
          if (exitCode !== 0) {
            throw new Error(`pg_dump terminó con código ${exitCode}: ${stderr.trim()}`);
          }
        }),
      ]);
    } catch (err) {
      await fs.unlink(filePath).catch(() => undefined);
      const message = err instanceof Error ? err.message : 'Error desconocido';
      this.logger.error(`Falló el respaldo de la base de datos: ${message}`);
      throw new BadRequestException(`No se pudo generar el respaldo: ${message}`);
    }

    this.logger.log(`Respaldo generado: ${filename}`);
    await this.applyRetention();
    return this.statBackupFile(filename);
  }

  async listBackups(): Promise<BackupFileInfo[]> {
    const filenames = await this.listBackupFilenames();
    const infos = await Promise.all(filenames.map((filename) => this.statBackupFile(filename)));
    return infos.sort((a, b) => b.filename.localeCompare(a.filename));
  }

  async getBackupFilePath(filename: string): Promise<string> {
    if (!FILENAME_PATTERN.test(filename)) {
      throw new BadRequestException('Nombre de archivo de respaldo inválido');
    }
    const filePath = join(this.backupDir, filename);
    try {
      await fs.access(filePath);
    } catch {
      throw new NotFoundException('Respaldo no encontrado');
    }
    return filePath;
  }

  private timestampForFilename(): string {
    return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '');
  }

  private parseTimestampFromFilename(filename: string): string {
    const match = FILENAME_PATTERN.exec(filename);
    if (!match) {
      return new Date(0).toISOString();
    }
    const [, y, mo, d, h, mi, s] = match;
    return `${y}-${mo}-${d}T${h}:${mi}:${s}.000Z`;
  }

  private async listBackupFilenames(): Promise<string[]> {
    await fs.mkdir(this.backupDir, { recursive: true });
    const entries = await fs.readdir(this.backupDir);
    return entries.filter((name) => FILENAME_PATTERN.test(name));
  }

  private async statBackupFile(filename: string): Promise<BackupFileInfo> {
    const stats = await fs.stat(join(this.backupDir, filename));
    return {
      filename,
      sizeBytes: stats.size,
      createdAt: this.parseTimestampFromFilename(filename),
    };
  }

  private async applyRetention(): Promise<void> {
    const files = (await this.listBackupFilenames()).sort().reverse();
    const toDelete = files.slice(this.retentionCount);
    await Promise.all(
      toDelete.map((filename) => fs.unlink(join(this.backupDir, filename)).catch(() => undefined)),
    );
    if (toDelete.length > 0) {
      this.logger.log(`Retención de respaldos: se eliminaron ${toDelete.length} respaldo(s) antiguos`);
    }
  }
}
