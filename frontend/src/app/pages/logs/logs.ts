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
  selector: 'app-logs',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonContent],
  templateUrl: './logs.html',
  styles: ``,
})
export class Logs {}
