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
  imports: [CommonModule, ButtonModule],
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

  // Add these properties for better mobile handling
  private videoWidth = 0;
  private videoHeight = 0;
  canvasWidth = 0; // Made public for template access
  canvasHeight = 0; // Made public for template access
  private scaleX = 1;
  private scaleY = 1;

  constructor(private ref: DynamicDialogRef) {}

  ngOnInit() {
    this.ctx = this.canvasRef.nativeElement.getContext('2d')!;
    this.update_memory = pico.instantiate_detection_memory(5);
    this.setupCanvas();
    this.loadCascadeAndStart();
  }

  // Add camera switching method
  async switchCamera() {
    if (this.camvasInstance && this.camvasInstance.switchCamera) {
      try {
        await this.camvasInstance.switchCamera();
        console.log('Camera switched successfully');
      } catch (error) {
        console.error('Failed to switch camera:', error);
      }
    }
  }

  // Get camera info for debugging
  getCameraInfo() {
    if (this.camvasInstance && this.camvasInstance.getVideoSettings) {
      const settings = this.camvasInstance.getVideoSettings();
      console.log('Current camera settings:', settings);
      return settings;
    }
    return null;
  }

  // Public getters for template access (alternative approach)
  get displayWidth() {
    return this.canvasWidth;
  }

  get displayHeight() {
    return this.canvasHeight;
  }

  private setupCanvas() {
    const canvas = this.canvasRef.nativeElement;
    const container = canvas.parentElement;

    if (container) {
      // Set canvas size to match container
      const containerRect = container.getBoundingClientRect();
      this.canvasWidth = containerRect.width;
      this.canvasHeight = containerRect.height;

      canvas.width = this.canvasWidth;
      canvas.height = this.canvasHeight;

      // Handle window resize
      window.addEventListener('resize', () => this.handleResize());
    }
  }

  private handleResize() {
    const canvas = this.canvasRef.nativeElement;
    const container = canvas.parentElement;

    if (container) {
      const containerRect = container.getBoundingClientRect();
      this.canvasWidth = containerRect.width;
      this.canvasHeight = containerRect.height;

      canvas.width = this.canvasWidth;
      canvas.height = this.canvasHeight;

      this.calculateScaling();
    }
  }

  private calculateScaling() {
    if (this.videoWidth && this.videoHeight) {
      // Calculate scale to fit video in canvas while maintaining aspect ratio
      const videoAspect = this.videoWidth / this.videoHeight;
      const canvasAspect = this.canvasWidth / this.canvasHeight;

      if (videoAspect > canvasAspect) {
        // Video is wider - fit to width
        this.scaleX = this.canvasWidth / this.videoWidth;
        this.scaleY = this.scaleX;
      } else {
        // Video is taller - fit to height
        this.scaleY = this.canvasHeight / this.videoHeight;
        this.scaleX = this.scaleY;
      }
    }
  }

  async loadCascadeAndStart() {
    const cascadeUrl =
      'https://raw.githubusercontent.com/nenadmarkus/pico/c2e81f9d23cc11d1a612fd21e4f9de0921a5d0d9/rnt/cascades/facefinder';

    try {
      const response = await fetch(cascadeUrl);
      const buffer = await response.arrayBuffer();
      const bytes = new Int8Array(buffer);
      console.log('Cascade loaded, bytes length:', bytes.length);
      this.facefinder_classify_region = pico.unpack_cascade(bytes);

      // Mobile-optimized video constraints
      const videoConstraints = {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        facingMode: 'user', // Front camera
        frameRate: { ideal: 30 },
      };

      // Create Camvas with mobile-friendly constraints
      this.camvasInstance = new Camvas(
        this.ctx,
        this.processFrame.bind(this),
        videoConstraints
      );
      this.running = true;
    } catch (error) {
      console.error('Failed to load cascade:', error);
    }
  }

  processFrame(video: HTMLVideoElement, dt: number) {
    if (!this.running) return;

    const canvas = this.canvasRef.nativeElement;
    const ctx = this.ctx;

    // Update video dimensions if they changed
    if (
      this.videoWidth !== video.videoWidth ||
      this.videoHeight !== video.videoHeight
    ) {
      this.videoWidth = video.videoWidth;
      this.videoHeight = video.videoHeight;
      this.calculateScaling();
    }

    const startTime = performance.now();

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate centered position for video
    const scaledWidth = this.videoWidth * this.scaleX;
    const scaledHeight = this.videoHeight * this.scaleY;
    const offsetX = (canvas.width - scaledWidth) / 2;
    const offsetY = (canvas.height - scaledHeight) / 2;

    // Draw video with proper scaling and centering
    ctx.drawImage(video, offsetX, offsetY, scaledWidth, scaledHeight);

    // Get image data for face detection
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const rgba = imageData.data;

    // Convert to grayscale
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

    // Adjust detection parameters for mobile
    const params = {
      shiftfactor: 0.1,
      minsize: Math.max(50, Math.min(canvas.width, canvas.height) * 0.1), // Dynamic min size
      maxsize: Math.min(canvas.width, canvas.height) * 0.8, // Dynamic max size
      scalefactor: 1.1,
    };

    let dets = pico.run_cascade(image, this.facefinder_classify_region, params);
    dets = this.update_memory(dets);
    dets = pico.cluster_detections(dets, 0.2);

    // Draw face detections
    this.drawDetections(
      ctx,
      dets,
      canvas,
      offsetX,
      offsetY,
      scaledWidth,
      scaledHeight
    );

    const endTime = performance.now();
    const processTime = (endTime - startTime).toFixed(1);

    // Draw performance info
    ctx.fillStyle = 'yellow';
    ctx.font = '16px Arial';
    ctx.fillText(`Process time: ${processTime} ms`, 10, 25);
    ctx.fillText(`Resolution: ${canvas.width}×${canvas.height}`, 10, 50);
    ctx.fillText(`Video: ${this.videoWidth}×${this.videoHeight}`, 10, 75);
  }

  private drawDetections(
    ctx: CanvasRenderingContext2D,
    dets: any[],
    canvas: HTMLCanvasElement,
    offsetX: number,
    offsetY: number,
    scaledWidth: number,
    scaledHeight: number
  ) {
    ctx.font = '14px Arial';
    ctx.fillStyle = 'red';
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'red';

    for (let i = 0; i < dets.length; i++) {
      if (dets[i][3] > 50.0) {
        const r = dets[i][0]; // row (y)
        const c = dets[i][1]; // column (x)
        const s = dets[i][2]; // size

        // Only draw detections within the video area
        if (
          c >= offsetX &&
          c <= offsetX + scaledWidth &&
          r >= offsetY &&
          r <= offsetY + scaledHeight
        ) {
          try {
            // Extract face image for storage
            const x = Math.max(0, c - s / 2);
            const y = Math.max(0, r - s / 2);
            const w = Math.min(s, canvas.width - x);
            const h = Math.min(s, canvas.height - y);

            if (w > 0 && h > 0) {
              const faceImage = ctx.getImageData(x, y, w, h);
              this.faces.push(faceImage);
            }
          } catch (e) {
            console.warn('Face capture failed:', e);
          }

          // Draw face circle
          ctx.beginPath();
          ctx.arc(c, r, s / 2, 0, 2 * Math.PI);
          ctx.stroke();

          // Draw labels with background
          const text = `Size: ${Math.round(s)} px`;
          const posText = `Pos: (${Math.round(c)}, ${Math.round(r)})`;

          const padding = 4;
          const textHeight = 16;
          const metrics1 = ctx.measureText(text);
          const metrics2 = ctx.measureText(posText);

          // Background rectangles
          ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
          ctx.fillRect(
            c - s / 2,
            r - s / 2 - textHeight * 2 - padding * 2,
            Math.max(metrics1.width, metrics2.width) + padding * 2,
            textHeight * 2 + padding * 2
          );

          // Text
          ctx.fillStyle = 'white';
          ctx.fillText(
            text,
            c - s / 2 + padding,
            r - s / 2 - textHeight - padding + 12
          );
          ctx.fillText(posText, c - s / 2 + padding, r - s / 2 - padding + 12);
        }
      }
    }
  }

  ngOnDestroy() {
    this.running = false;
    console.log('Detection stopped');

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    if (this.camvasInstance) {
      this.camvasInstance.stop();
      console.log('Camvas stopped');
    }

    // Remove event listeners
    window.removeEventListener('resize', this.handleResize);
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
