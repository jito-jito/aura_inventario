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
  selector: 'app-ml-listings',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonContent],
  templateUrl: './ml-listings.html',
  styles: ``,
})
export class MlListings {}
