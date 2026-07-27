import { Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BackupService } from './backup.service';

@UseGuards(JwtAuthGuard)
@Controller('backups')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post()
  create() {
    return this.backupService.runBackup();
  }

  @Get()
  findAll() {
    return this.backupService.listBackups();
  }

  @Get(':filename/download')
  async download(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = await this.backupService.getBackupFilePath(filename);
    res.download(filePath, filename);
  }
}
