import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

const TOKEN_KEY = 'aura_access_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly isAuthenticated = signal(!!localStorage.getItem(TOKEN_KEY));

  constructor(private readonly http: HttpClient) {}

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  async login(email: string, password: string): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<{ accessToken: string }>(`${environment.apiUrl}/auth/login`, {
        email,
        password,
      }),
    );
    localStorage.setItem(TOKEN_KEY, response.accessToken);
    this.isAuthenticated.set(true);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.isAuthenticated.set(false);
  }
}
