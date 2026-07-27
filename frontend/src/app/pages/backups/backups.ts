import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonMenuButton,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonSpinner,
  IonText,
  IonNote,
} from '@ionic/angular/standalone';
import { BackupsService } from '../../core/backups.service';
import { BackupFileInfo } from '../../core/models/backup-file.model';

@Component({
  selector: 'app-backups',
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonMenuButton,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonButton,
    IonSpinner,
    IonText,
    IonNote,
  ],
  templateUrl: './backups.html',
  styleUrl: './backups.scss',
})
export class Backups implements OnInit {
  backups = signal<BackupFileInfo[]>([]);
  loading = signal(true);
  creating = signal(false);
  errorMessage = signal<string | null>(null);

  constructor(private readonly backupsService: BackupsService) {}

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.backups.set(await this.backupsService.findAll());
    } finally {
      this.loading.set(false);
    }
  }

  async createBackup(): Promise<void> {
    this.creating.set(true);
    this.errorMessage.set(null);
    try {
      await this.backupsService.create();
      await this.load();
    } catch (error) {
      const message =
        (error as { error?: { message?: string } })?.error?.message ?? 'No se pudo generar el respaldo';
      this.errorMessage.set(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      this.creating.set(false);
    }
  }

  download(filename: string): void {
    this.backupsService.download(filename);
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
