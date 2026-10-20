import { Component, DestroyRef, inject, signal } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonRouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  // El SW solo cachea la app, no los datos: sin red la app abre pero la API
  // falla, así que se avisa en vez de mostrar errores sueltos por pantalla.
  readonly online = signal(navigator.onLine);

  constructor() {
    const update = () => this.online.set(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    });
  }
}
