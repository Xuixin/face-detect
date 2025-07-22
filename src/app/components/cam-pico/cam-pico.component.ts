import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Camvas } from '../../utils/camvas';
import { ButtonModule } from 'primeng/button';
import { CommonModule } from '@angular/common';
import { DynamicDialogRef } from 'primeng/dynamicdialog';

declare var pico: any;

@Component({
  selector: 'app-open-cam-pico',
  templateUrl: './cam-pico.component.html',
  styleUrls: ['./cam-pico.component.scss'],
  standalone: true,
  imports: [ CommonModule, ButtonModule],
})
export class CamPicoComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  faces: ImageData[] = [];
  private camvasInstance!: Camvas;
  ctx!: CanvasRenderingContext2D;
  running = false;

  facefinder_classify_region: any = () => -1.0;
  update_memory: any;
  animationFrameId: any;

  constructor(private ref: DynamicDialogRef) {}

  ngOnInit() {
    this.ctx = this.canvasRef.nativeElement.getContext('2d')!;
    this.update_memory = pico.instantiate_detection_memory(5);
    this.loadCascadeAndStart();
  }

  async loadCascadeAndStart() {
    const cascadeUrl =
      'https://raw.githubusercontent.com/nenadmarkus/pico/c2e81f9d23cc11d1a612fd21e4f9de0921a5d0d9/rnt/cascades/facefinder';
    const response = await fetch(cascadeUrl);
    const buffer = await response.arrayBuffer();
    const bytes = new Int8Array(buffer);
    console.log('Cascade loaded, bytes length:', bytes.length);
    this.facefinder_classify_region = pico.unpack_cascade(bytes);

    this.camvasInstance = new Camvas(this.ctx, this.processFrame.bind(this));
    this.running = true;
  }

  processFrame(video: HTMLVideoElement, dt: number) {
    if (!this.running) return;

    const canvas = this.canvasRef.nativeElement;
    const ctx = this.ctx;

    const startTime = performance.now();

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const rgba = imageData.data;

    const gray = new Uint8Array(canvas.width * canvas.height);
    for (let r = 0; r < canvas.height; r++) {
      for (let c = 0; c < canvas.width; c++) {
        const offset = (r * canvas.width + c) * 4;
        gray[r * canvas.width + c] =
          (2 * rgba[offset] + 7 * rgba[offset + 1] + 1 * rgba[offset + 2]) / 10;
      }
    }

    const image = {
      pixels: gray,
      nrows: canvas.height,
      ncols: canvas.width,
      ldim: canvas.width,
    };

    const params = {
      shiftfactor: 0.1,
      minsize: 100,
      maxsize: 1000,
      scalefactor: 1.1,
    };

    let dets = pico.run_cascade(image, this.facefinder_classify_region, params);
    dets = this.update_memory(dets);
    dets = pico.cluster_detections(dets, 0.2);

    ctx.font = '14px Arial';
    ctx.fillStyle = 'red';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'red';

    for (let i = 0; i < dets.length; i++) {
      if (dets[i][3] > 50.0) {
        const r = dets[i][0];
        const c = dets[i][1];
        const s = dets[i][2];

        try {
          const x = Math.max(0, c - s / 2);
          const y = Math.max(0, r - s / 2);
          const w = Math.min(s, canvas.width - x);
          const h = Math.min(s, canvas.height - y);

          const faceImage = ctx.getImageData(x, y, w, h);
          this.faces.push(faceImage);
        } catch (e) {
          console.warn('จับใบหน้าไม่ได้:', e);
        }

        ctx.beginPath();
        ctx.arc(c, r, s / 2, 0, 2 * Math.PI);
        ctx.stroke();

        const text = `Size: ${Math.round(s)} px`;
        const posText = `Pos: (${Math.round(c)}, ${Math.round(r)})`;

        const padding = 4;
        const metrics1 = ctx.measureText(text);
        const metrics2 = ctx.measureText(posText);
        const textHeight = 16;

        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.fillRect(
          c - s / 2,
          r - s / 2 - textHeight * 2 - padding * 2,
          metrics1.width + padding * 2,
          textHeight + padding
        );
        ctx.fillRect(
          c - s / 2,
          r - s / 2 - textHeight - padding,
          metrics2.width + padding * 2,
          textHeight + padding
        );

        ctx.fillStyle = 'white';
        ctx.fillText(text, c - s / 2 + padding, r - s / 2 - textHeight * 2 + 12);
        ctx.fillText(posText, c - s / 2 + padding, r - s / 2 - textHeight + 12);
      }
    }

    const endTime = performance.now();
    const processTime = (endTime - startTime).toFixed(1);

    ctx.fillStyle = 'yellow';
    ctx.font = '18px Arial';
    ctx.fillText(`Process time: ${processTime} ms`, 10, 20);
  }

  ngOnDestroy() {
    this.running = false;
    console.log('Detection stopped');
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    if (this.camvasInstance) {
      this.camvasInstance.stop();
      console.log('Camvas stopped');
    }
  }

  cancel() {
    this.ref.close({ success: false });
  }

  finish() {
    this.ref.close({
      success: true,
      faces: this.faces,
    });
  }
}
