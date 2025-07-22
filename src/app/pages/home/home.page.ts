// home.page.ts
import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';


import { CamPicoComponent } from 'src/app/components/cam-pico/cam-pico.component';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [ CommonModule, ButtonModule],
  providers: [DialogService],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class HomePage {
  ref: DynamicDialogRef | undefined;

  constructor(
    private dialogService: DialogService
  ) {}

  async startCamera() {
    this.ref = this.dialogService.open(CamPicoComponent, {
      header: 'Real-time Face Detection With Pico.js',
      width: '95vw',
      height: '95vh',
      modal: true,
      dismissableMask: false,
      closable: false,
      maximizable: false,
      resizable: false,
      styleClass: 'custom-face-detection-dialog',
      contentStyle: {
        padding: '0',
        overflow: 'hidden',
        'border-radius': '1.5rem',
        animation: 'up 0.5s ease-in-out'
      },
      baseZIndex: 10000,
    });

    this.ref.onClose.subscribe((result: any) => {
      if (result?.success) {
        console.log('Face detection completed:', result.faces);
        // Handle the detected faces here
      } else {
        console.log('Face detection cancelled');
      }
    });
  }
}
