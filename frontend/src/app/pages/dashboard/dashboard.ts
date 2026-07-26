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
  selector: 'app-dashboard',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonContent],
  templateUrl: './dashboard.html',
  styles: ``,
})
export class Dashboard {}
