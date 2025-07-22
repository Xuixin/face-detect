import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Camvas } from '../../utils/camvas';

declare var pico: any;
declare var lploc: any;

@Component({
  selector: 'app-open-cam-iploc',
  templateUrl: './cam-iploc.component.html',
  styleUrls: ['./cam-iploc.component.scss'],
  standalone: false
})
export class CamIplocComponent implements OnInit, OnDestroy {

  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private camvasInstance!: Camvas;
  private ctx!: CanvasRenderingContext2D;

  private facefinderClassifyRegion: any = (r:number,c:number,s:number,pixels:Uint8Array,ldim:number) => -1.0;
  private doPuploc: any = (r:number,c:number,s:number,nperturbs:number,pixels:any,nrows:number,ncols:number,ldim:number) => [-1,-1];
  private updateMemory: any;

  initialized = false;

  constructor(private modalCtrl: ModalController) {}

  async ngOnInit() {
    this.ctx = this.canvasRef.nativeElement.getContext('2d')!;

    // โหลด cascade face detector
    const cascadeUrl = 'https://raw.githubusercontent.com/nenadmarkus/pico/c2e81f9d23cc11d1a612fd21e4f9de0921a5d0d9/rnt/cascades/facefinder';
    const cascadeResponse = await fetch(cascadeUrl);
    const cascadeBuffer = await cascadeResponse.arrayBuffer();
    this.facefinderClassifyRegion = pico.unpack_cascade(new Int8Array(cascadeBuffer));
    this.updateMemory = pico.instantiate_detection_memory(5);

    // โหลด pupil localizer
    const puplocUrl = 'assets/models/puploc.bin';
    const puplocResponse = await fetch(puplocUrl);
    const puplocBuffer = await puplocResponse.arrayBuffer();
    this.doPuploc = lploc.unpack_localizer(new Int8Array(puplocBuffer));

    this.startDetection();
  }

  startDetection() {
    if (this.initialized) return; // ไม่เริ่มซ้ำ
    this.camvasInstance = new Camvas(this.ctx, this.processFrame.bind(this));
    this.initialized = true;
  }

  private rgbaToGrayscale(rgba: Uint8ClampedArray, nrows: number, ncols: number): Uint8Array {
    const gray = new Uint8Array(nrows * ncols);
    for(let r=0; r<nrows; r++) {
      for(let c=0; c<ncols; c++) {
        const idx = r * 4 * ncols + c * 4;
        gray[r*ncols + c] = (2*rgba[idx] + 7*rgba[idx+1] + 1*rgba[idx+2]) / 10;
      }
    }
    return gray;
  }

  private processFrame(video: HTMLVideoElement, dt: number) {
  const canvas = this.canvasRef.nativeElement;
  const ctx = this.ctx;

  const startTime = performance.now();  // เริ่มจับเวลา

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const grayPixels = this.rgbaToGrayscale(imgData.data, canvas.height, canvas.width);

  const image = {
    pixels: grayPixels,
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

  let dets = pico.run_cascade(image, this.facefinderClassifyRegion, params);
  dets = this.updateMemory(dets);
  dets = pico.cluster_detections(dets, 0.2);

  ctx.lineWidth = 3;
  ctx.strokeStyle = 'red';
  ctx.font = '14px Arial';
  ctx.fillStyle = 'red';

  for(let i=0; i<dets.length; i++) {
    if(dets[i][3] > 50.0) {
      const r = dets[i][0], c = dets[i][1], s = dets[i][2];

      // วาดวงกลมรอบหน้า
      ctx.beginPath();
      ctx.arc(c, r, s/2, 0, 2*Math.PI);
      ctx.stroke();

      // แสดง Size และ Position เหมือน Pico
      const textSize = `Size: ${Math.round(s)} px`;
      const textPos = `Pos: (${Math.round(c)}, ${Math.round(r)})`;

      const padding = 4;
      const metrics1 = ctx.measureText(textSize);
      const metrics2 = ctx.measureText(textPos);
      const textHeight = 16;

      // วาดพื้นหลังโปร่งแสงสำหรับข้อความ
      ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.fillRect(c - s / 2, r - s / 2 - textHeight * 2 - padding * 2, metrics1.width + padding * 2, textHeight + padding);
      ctx.fillRect(c - s / 2, r - s / 2 - textHeight - padding, metrics2.width + padding * 2, textHeight + padding);

      // วาดข้อความสีขาว
      ctx.fillStyle = 'white';
      ctx.fillText(textSize, c - s / 2 + padding, r - s / 2 - textHeight * 2 + 12);
      ctx.fillText(textPos, c - s / 2 + padding, r - s / 2 - textHeight + 12);

      // ตรวจจับดวงตา (เหมือนเดิม)
      // Left eye
      let eyeR = r - 0.075 * s;
      let eyeC = c - 0.175 * s;
      let eyeS = 0.35 * s;
      let [pr, pc] = this.doPuploc(eyeR, eyeC, eyeS, 63, image);
      if(pr >= 0 && pc >= 0) {
        ctx.beginPath();
        ctx.arc(pc, pr, 2, 0, 2*Math.PI);
        ctx.stroke();
      }

      // Right eye
      eyeR = r - 0.075 * s;
      eyeC = c + 0.175 * s;
      [pr, pc] = this.doPuploc(eyeR, eyeC, eyeS, 63, image);
      if(pr >= 0 && pc >= 0) {
        ctx.beginPath();
        ctx.arc(pc, pr, 2, 0, 2*Math.PI);
        ctx.stroke();
      }
    }
  }

  // จบจับเวลา
  const endTime = performance.now();
  const processTime = (endTime - startTime).toFixed(1);

  // แสดง Process time มุมซ้ายบน
  ctx.fillStyle = 'yellow';
  ctx.font = '18px Arial';
  ctx.fillText(`Process time: ${processTime} ms`, 10, 20);
}


  closeModal() {
    if(this.camvasInstance) {
      this.camvasInstance.stop(); // ต้องมี method stop() ใน class Camvas
    }
    this.modalCtrl.dismiss();
  }

  ngOnDestroy() {
    if(this.camvasInstance) {
      this.camvasInstance.stop();
    }
  }
}
