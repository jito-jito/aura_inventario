import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import {
  IonSplitPane,
  IonMenu,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonButton,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  gridOutline,
  cubeOutline,
  swapVerticalOutline,
  linkOutline,
  storefrontOutline,
  alertCircleOutline,
  logOutOutline,
  cloudUploadOutline,
} from 'ionicons/icons';
import { AuthService } from '../core/auth.service';

interface MenuItem {
  label: string;
  path: string;
  icon: string;
}

@Component({
  selector: 'app-shell',
  imports: [
    RouterLink,
    RouterLinkActive,
    IonSplitPane,
    IonMenu,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonIcon,
    IonLabel,
    IonRouterOutlet,
    IonButton,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  readonly menuItems: MenuItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: 'grid-outline' },
    { label: 'Productos', path: '/products', icon: 'cube-outline' },
    { label: 'Inventario', path: '/inventory', icon: 'swap-vertical-outline' },
    { label: 'Conexión Mercado Libre', path: '/ml-connection', icon: 'link-outline' },
    { label: 'Publicaciones vinculadas', path: '/ml-listings', icon: 'storefront-outline' },
    { label: 'Logs / Errores', path: '/logs', icon: 'alert-circle-outline' },
    { label: 'Respaldos', path: '/backups', icon: 'cloud-upload-outline' },
  ];

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {
    addIcons({
      gridOutline,
      cubeOutline,
      swapVerticalOutline,
      linkOutline,
      storefrontOutline,
      alertCircleOutline,
      logOutOutline,
      cloudUploadOutline,
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }
}
