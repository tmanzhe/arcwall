export class MicrophoneRecorder {
  constructor({
    onComplete,
    onError,
    onLevel = () => {},
    platform = globalThis,
  }) {
    Object.assign(this, { onComplete, onError, onLevel, platform });
    this.cancelled = false;
    this.chunks = [];
    this.size = 0;
  }
  async start() {
    const p = this.platform;
    if (!p.navigator?.mediaDevices?.getUserMedia || !p.MediaRecorder)
      throw new Error(
        "Microphone recording requires localhost or HTTPS in a modern browser.",
      );
    this.stream = await p.navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    if (this.cancelled) {
      this.release();
      throw new DOMException("Recording cancelled.", "AbortError");
    }
    const mime = [
      "audio/webm;codecs=opus",
      "audio/mp4",
      "audio/webm",
      "audio/ogg;codecs=opus",
    ].find((t) => p.MediaRecorder.isTypeSupported(t));
    try {
      this.recorder = new p.MediaRecorder(
        this.stream,
        mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : undefined,
      );
      this.recorder.ondataavailable = ({ data }) => {
        if (data.size) {
          this.chunks.push(data);
          this.size += data.size;
          if (this.size > 3000000) this.stop();
        }
      };
      this.recorder.onerror = () => {
        this.cancel();
        this.onError(
          new Error("The microphone stopped unexpectedly. Please try again."),
        );
      };
      this.recorder.onstop = () => {
        const blob = new Blob(this.chunks, {
          type: this.recorder.mimeType || mime || "audio/webm",
        });
        this.release();
        if (!this.cancelled) this.onComplete(blob);
      };
      this.recorder.start(250);
      this.timer = setTimeout(() => this.stop(), 30000);
      this.meter();
    } catch (error) {
      this.release();
      throw error;
    }
  }
  meter() {
    const p = this.platform,
      Context = p.AudioContext || p.webkitAudioContext;
    if (!Context) return;
    try {
      this.context = new Context();
      this.source = this.context.createMediaStreamSource(this.stream);
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 256;
      this.source.connect(this.analyser);
      const values = new Uint8Array(256);
      this.levelTimer = setInterval(() => {
        this.analyser.getByteTimeDomainData(values);
        const energy =
          values.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) /
          values.length;
        this.onLevel(Math.min(1, Math.sqrt(energy) * 6));
      }, 70);
    } catch {
      /* Metering is optional; recording can continue without it. */
    }
  }
  stop() {
    clearTimeout(this.timer);
    if (this.recorder?.state === "recording") this.recorder.stop();
  }
  cancel() {
    this.cancelled = true;
    this.stop();
    this.release();
  }
  release() {
    clearTimeout(this.timer);
    clearInterval(this.levelTimer);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.source?.disconnect();
    this.context?.close().catch(() => {});
    this.context = null;
    this.onLevel(0);
  }
}
