import { Component } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonMenuButton,
  IonContent,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-products',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonContent],
  templateUrl: './products.html',
  styles: ``,
})
export class Products {}
