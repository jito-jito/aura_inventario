import { ApplicationRef, Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { AlertController } from '@ionic/angular/standalone';
import { filter, first } from 'rxjs';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Avisa cuando el service worker descargó una versión nueva de la app y
 * permite recargar. Sin esto, una PWA instalada sigue mostrando la versión
 * vieja hasta que el usuario cierra todas las pestañas/ventanas.
 */
@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  constructor(
    private readonly swUpdate: SwUpdate,
    private readonly appRef: ApplicationRef,
    private readonly alertController: AlertController,
  ) {}

  init(): void {
    if (!this.swUpdate.isEnabled) {
      return;
    }

    this.swUpdate.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(() => this.promptReload());

    // El estado irrecuperable ocurre si el navegador borró parte de la caché
    // del SW; la única salida es recargar desde la red.
    this.swUpdate.unrecoverable.subscribe(() => this.promptReload(true));

    // Una PWA abierta por horas no navega a index.html, así que el SW no
    // revisa versiones por su cuenta: se revisa periódicamente una vez estable.
    this.appRef.isStable.pipe(first((stable) => stable)).subscribe(() => {
      setInterval(() => {
        this.swUpdate.checkForUpdate().catch(() => undefined);
      }, UPDATE_CHECK_INTERVAL_MS);
    });
  }

  private async promptReload(unrecoverable = false): Promise<void> {
    const alert = await this.alertController.create({
      header: unrecoverable ? 'Error al cargar la aplicación' : 'Nueva versión disponible',
      message: unrecoverable
        ? 'La aplicación necesita recargarse para seguir funcionando.'
        : 'Hay una versión nueva de Aura Inventario. Recarga para usarla.',
      backdropDismiss: !unrecoverable,
      buttons: unrecoverable
        ? [{ text: 'Recargar', handler: () => document.location.reload() }]
        : [
            { text: 'Más tarde', role: 'cancel' },
            { text: 'Recargar', handler: () => document.location.reload() },
          ],
    });
    await alert.present();
  }
}
