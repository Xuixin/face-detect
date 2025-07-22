import { Injectable } from '@angular/core';

declare var pico: any;

export interface FaceDetection {
  x: number;
  y: number;
  size: number;
  confidence: number;
}

export interface DetectionParams {
  shiftfactor?: number;
  minsize?: number;
  maxsize?: number;
  scalefactor?: number;
}

export interface ProcessedFrame {
  faces: FaceDetection[];
  processTime: number;
  faceImages: ImageData[];
}

@Injectable({
  providedIn: 'root',
})
export class PicoService {
  private facefinder_classify_region: any = () => -1.0;
  private update_memory: any;
  private isInitialized = false;
  private picoLoaded = false;

  constructor() {}

  async init(): Promise<void> {
    await this.loadPicoScript();
    this.initializeMemory();
    this.picoLoaded = true;
  }

  /**
   * Initialize detection memory
   */
  private initializeMemory(): void {
    try {
      this.update_memory = pico.instantiate_detection_memory(5);
      console.log('Pico detection memory initialized');
    } catch (error) {
      console.error('Failed to initialize Pico memory:', error);
    }
  }

  /**
   * Load cascade file and initialize face detection
   */

  async loadPicoScript(): Promise<void> {
    if (this.picoLoaded) return;

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'assets/libs/pico.js'; // หรือพาธที่คุณเก็บ
      script.onload = () => {
        this.picoLoaded = true;
        resolve();
      };
      script.onerror = () => reject('Failed to load Pico.js');
      document.body.appendChild(script);
    });
  }

  /**
   * Check if service is initialized
   */
  isReady(): boolean {
    return this.picoLoaded;
  }

  /**
   * Convert RGBA image data to grayscale
   */
  private rgbaToGrayscale(
    rgba: Uint8ClampedArray,
    width: number,
    height: number
  ): Uint8Array {
    const gray = new Uint8Array(width * height);

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const offset = (r * width + c) * 4;
        // Weighted grayscale conversion
        gray[r * width + c] = Math.round(
          (2 * rgba[offset] + 7 * rgba[offset + 1] + 1 * rgba[offset + 2]) / 10
        );
      }
    }

    return gray;
  }

  /**
   * Extract face image data from canvas
   */
  private extractFaceImage(
    ctx: CanvasRenderingContext2D,
    face: FaceDetection,
    canvasWidth: number,
    canvasHeight: number
  ): ImageData | null {
    try {
      const x = Math.max(0, Math.round(face.x - face.size / 2));
      const y = Math.max(0, Math.round(face.y - face.size / 2));
      const w = Math.min(Math.round(face.size), canvasWidth - x);
      const h = Math.min(Math.round(face.size), canvasHeight - y);

      if (w > 0 && h > 0) {
        return ctx.getImageData(x, y, w, h);
      }
    } catch (error) {
      console.warn('Failed to extract face image:', error);
    }
    return null;
  }

  /**
   * Process frame and detect faces
   */
  processFrame(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    params?: DetectionParams
  ): ProcessedFrame {
    const startTime = performance.now();

    if (!this.isReady()) {
      console.warn('Pico service not ready');
      return {
        faces: [],
        processTime: performance.now() - startTime,
        faceImages: [],
      };
    }

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const rgba = imageData.data;

    // Convert to grayscale
    const gray = this.rgbaToGrayscale(rgba, canvas.width, canvas.height);

    // Prepare image object for Pico
    const image = {
      pixels: gray,
      nrows: canvas.height,
      ncols: canvas.width,
      ldim: canvas.width,
    };

    // Detection parameters
    const detectionParams = {
      shiftfactor: params?.shiftfactor || 0.1,
      minsize: params?.minsize || 100,
      maxsize: params?.maxsize || 1000,
      scalefactor: params?.scalefactor || 1.1,
    };

    // Run face detection
    let detections = pico.run_cascade(
      image,
      this.facefinder_classify_region,
      detectionParams
    );
    detections = this.update_memory(detections);
    detections = pico.cluster_detections(detections, 0.2);

    // Process detected faces
    const faces: FaceDetection[] = [];
    const faceImages: ImageData[] = [];

    for (let i = 0; i < detections.length; i++) {
      const det = detections[i];
      const confidence = det[3];

      if (confidence > 50.0) {
        const face: FaceDetection = {
          y: det[0], // row (y)
          x: det[1], // col (x)
          size: det[2],
          confidence: confidence,
        };

        faces.push(face);

        // Extract face image
        const faceImage = this.extractFaceImage(
          ctx,
          face,
          canvas.width,
          canvas.height
        );
        if (faceImage) {
          faceImages.push(faceImage);
        }

        console.log(
          `Face ${i}: position=(${face.x.toFixed(1)}, ${face.y.toFixed(
            1
          )}), size=${face.size.toFixed(1)}, confidence=${confidence.toFixed(
            1
          )}`
        );
      }
    }

    const processTime = performance.now() - startTime;

    return {
      faces,
      processTime,
      faceImages,
    };
  }

  /**
   * Draw face detection results on canvas
   */
  drawDetections(
    ctx: CanvasRenderingContext2D,
    faces: FaceDetection[],
    processTime: number,
    options?: {
      strokeColor?: string;
      fillColor?: string;
      textColor?: string;
      lineWidth?: number;
      showInfo?: boolean;
    }
  ): void {
    const opts = {
      strokeColor: options?.strokeColor || 'red',
      fillColor: options?.fillColor || 'rgba(255, 0, 0, 0.5)',
      textColor: options?.textColor || 'white',
      lineWidth: options?.lineWidth || 3,
      showInfo: options?.showInfo !== false,
    };

    // Set drawing styles
    ctx.lineWidth = opts.lineWidth;
    ctx.strokeStyle = opts.strokeColor;
    ctx.font = '14px Arial';

    // Draw face circles and info
    faces.forEach((face, index) => {
      // Draw circle around face
      ctx.beginPath();
      ctx.arc(face.x, face.y, face.size / 2, 0, 2 * Math.PI);
      ctx.stroke();

      if (opts.showInfo) {
        // Prepare text
        const sizeText = `Size: ${Math.round(face.size)} px`;
        const posText = `Pos: (${Math.round(face.x)}, ${Math.round(face.y)})`;
        const confText = `Conf: ${face.confidence.toFixed(1)}`;

        const padding = 4;
        const textHeight = 16;
        const metrics1 = ctx.measureText(sizeText);
        const metrics2 = ctx.measureText(posText);
        const metrics3 = ctx.measureText(confText);
        const maxWidth = Math.max(
          metrics1.width,
          metrics2.width,
          metrics3.width
        );

        // Draw background rectangles
        const bgX = face.x - face.size / 2;
        const bgY = face.y - face.size / 2 - textHeight * 3 - padding * 3;

        ctx.fillStyle = opts.fillColor;
        ctx.fillRect(
          bgX,
          bgY,
          maxWidth + padding * 2,
          textHeight * 3 + padding * 3
        );

        // Draw text
        ctx.fillStyle = opts.textColor;
        ctx.fillText(sizeText, bgX + padding, bgY + textHeight);
        ctx.fillText(posText, bgX + padding, bgY + textHeight * 2 + padding);
        ctx.fillText(
          confText,
          bgX + padding,
          bgY + textHeight * 3 + padding * 2
        );
      }
    });

    // Draw process time
    ctx.fillStyle = 'yellow';
    ctx.font = '18px Arial';
    ctx.fillText(`Process time: ${processTime.toFixed(1)} ms`, 10, 20);
    ctx.fillText(`Faces detected: ${faces.length}`, 10, 45);
  }

  /**
   * Reset detection memory
   */
  resetMemory(): void {
    try {
      this.initializeMemory();
      console.log('Detection memory reset');
    } catch (error) {
      console.error('Failed to reset memory:', error);
    }
  }
}
