import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { BackupFileInfo } from './models/backup-file.model';

@Injectable({ providedIn: 'root' })
export class BackupsService {
  private readonly baseUrl = `${environment.apiUrl}/backups`;

  constructor(private readonly http: HttpClient) {}

  findAll(): Promise<BackupFileInfo[]> {
    return firstValueFrom(this.http.get<BackupFileInfo[]>(this.baseUrl));
  }

  create(): Promise<BackupFileInfo> {
    return firstValueFrom(this.http.post<BackupFileInfo>(this.baseUrl, {}));
  }

  async download(filename: string): Promise<void> {
    const blob = await firstValueFrom(
      this.http.get(`${this.baseUrl}/${filename}/download`, { responseType: 'blob' }),
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}
