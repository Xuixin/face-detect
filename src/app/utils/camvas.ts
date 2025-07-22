export class Camvas {
  ctx: CanvasRenderingContext2D;
  callback: (video: HTMLVideoElement, dt: number) => void;
  video: HTMLVideoElement;
  private stream!: MediaStream;

  constructor(ctx: CanvasRenderingContext2D, callback: (video: HTMLVideoElement, dt: number) => void) {
    this.ctx = ctx;
    this.callback = callback;

    this.video = document.createElement('video');
    this.video.autoplay = true;
    this.video.playsInline = true;
    this.video.width = 1;
    this.video.height = 1;

    document.body.appendChild(this.video);

    navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then(stream => {
      this.stream = stream;
      this.video.srcObject = stream;
      this.update();
    }).catch(err => {
      console.error('Error opening webcam: ', err);
    });
  }

  private update() {
    let last = Date.now();
    const loop = () => {
      const dt = Date.now() - last;
      this.callback(this.video, dt);
      last = Date.now();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() {
    if(this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    if(this.video.parentNode) {
      this.video.parentNode.removeChild(this.video);
    }
  }
}
