import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonText,
} from '@ionic/angular/standalone';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [
    FormsModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonText,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  email = '';
  password = '';
  loading = signal(false);
  errorMessage = signal<string | null>(null);

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  async onSubmit(): Promise<void> {
    this.errorMessage.set(null);
    this.loading.set(true);
    try {
      await this.authService.login(this.email, this.password);
      await this.router.navigateByUrl('/dashboard');
    } catch {
      this.errorMessage.set('Email o contraseña incorrectos');
    } finally {
      this.loading.set(false);
    }
  }
}
