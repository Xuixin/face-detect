export class Camvas {
  ctx: CanvasRenderingContext2D;
  callback: (video: HTMLVideoElement, dt: number) => void;
  video: HTMLVideoElement;
  private stream!: MediaStream;

  constructor(
    ctx: CanvasRenderingContext2D,
    callback: (video: HTMLVideoElement, dt: number) => void,
    videoConstraints?: MediaTrackConstraints
  ) {
    this.ctx = ctx;
    this.callback = callback;

    this.video = document.createElement('video');
    this.video.autoplay = true;
    this.video.playsInline = true;
    this.video.muted = true; // Important for mobile autoplay

    // Add mobile-specific attributes
    this.video.setAttribute('webkit-playsinline', 'true');
    this.video.setAttribute('playsinline', 'true');

    this.video.width = 1;
    this.video.height = 1;

    document.body.appendChild(this.video);

    // Use enhanced video constraints
    this.initializeCamera(videoConstraints);
  }

  private async initializeCamera(customConstraints?: MediaTrackConstraints) {
    // Default mobile-optimized constraints
    const defaultConstraints: MediaTrackConstraints = {
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      facingMode: 'user', // Front camera for selfies
      frameRate: { ideal: 30, max: 60 },
    };

    // Merge custom constraints with defaults
    const videoConstraints = customConstraints
      ? { ...defaultConstraints, ...customConstraints }
      : defaultConstraints;

    const constraints: MediaStreamConstraints = {
      video: videoConstraints,
      audio: false,
    };

    try {
      console.log('Requesting camera with constraints:', constraints);
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;

      // Wait for video metadata to load
      await this.waitForVideoReady();

      console.log(
        `Camera initialized: ${this.video.videoWidth}x${this.video.videoHeight}`
      );
      this.update();
    } catch (err) {
      console.error('Error with optimized constraints:', err);

      // Fallback to basic constraints
      try {
        console.log('Trying fallback constraints...');
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
        this.video.srcObject = this.stream;
        await this.waitForVideoReady();
        this.update();
      } catch (fallbackErr) {
        console.error('Fallback camera access failed:', fallbackErr);

        // Last resort - most basic constraints
        try {
          console.log('Trying most basic constraints...');
          this.stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          this.video.srcObject = this.stream;
          await this.waitForVideoReady();
          this.update();
        } catch (basicErr) {
          console.error('All camera access attempts failed:', basicErr);
        }
      }
    }
  }

  private waitForVideoReady(): Promise<void> {
    return new Promise((resolve) => {
      if (this.video.readyState >= 2) {
        resolve();
      } else {
        this.video.addEventListener('loadedmetadata', () => resolve(), {
          once: true,
        });
      }
    });
  }

  private update() {
    let last = Date.now();
    const loop = () => {
      if (this.video.readyState >= 2) {
        // Only process when video is ready
        const dt = Date.now() - last;
        this.callback(this.video, dt);
        last = Date.now();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // Method to switch camera (front/back)
  async switchCamera() {
    const currentTrack = this.stream.getVideoTracks()[0];
    const currentFacingMode = currentTrack.getSettings().facingMode;

    // Stop current stream
    this.stop();

    // Start new stream with opposite facing mode
    const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    await this.initializeCamera({ facingMode: newFacingMode });
  }

  // Get current video settings
  getVideoSettings() {
    if (this.stream && this.stream.getVideoTracks().length > 0) {
      return this.stream.getVideoTracks()[0].getSettings();
    }
    return null;
  }

  // Get supported constraints
  getSupportedConstraints() {
    return navigator.mediaDevices.getSupportedConstraints();
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }
    if (this.video.parentNode) {
      this.video.parentNode.removeChild(this.video);
    }
  }
}
