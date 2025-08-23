export class WaveformRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private audioBuffer: AudioBuffer | null = null;
  private zoomLevel = 1;
  private scrollPosition = 0;
  private pixelsPerSecond = 100;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Unable to get 2D context from canvas');
    }
    this.ctx = context;
    this.setupCanvas();
  }

  private setupCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
  }

  setAudioBuffer(audioBuffer: AudioBuffer): void {
    this.audioBuffer = audioBuffer;
    this.render();
  }

  setZoom(zoomLevel: number): void {
    this.zoomLevel = zoomLevel;
    this.pixelsPerSecond = 100 * zoomLevel;
    this.render();
  }

  setScrollPosition(position: number): void {
    this.scrollPosition = position;
    this.render();
  }

  render(): void {
    if (!this.audioBuffer) return;

    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    
    // Clear canvas
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, 0, width, height);

    this.renderWaveform(width, height);
  }

  private renderWaveform(width: number, height: number): void {
    if (!this.audioBuffer) return;

    const channelData = this.audioBuffer.getChannelData(0);
    const sampleRate = this.audioBuffer.sampleRate;
    const duration = this.audioBuffer.duration;
    
    // Calculate visible time range
    const timePerPixel = 1 / this.pixelsPerSecond;
    const startTime = this.scrollPosition * timePerPixel;
    const endTime = startTime + (width * timePerPixel);
    
    // Calculate sample indices
    const startSample = Math.floor(startTime * sampleRate);
    const endSample = Math.min(Math.floor(endTime * sampleRate), channelData.length);
    
    if (startSample >= endSample) return;

    // Draw waveform
    this.ctx.strokeStyle = '#4fc3f7';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();

    const samplesPerPixel = Math.max(1, (endSample - startSample) / width);
    
    for (let x = 0; x < width; x++) {
      const sampleIndex = Math.floor(startSample + (x * samplesPerPixel));
      
      if (sampleIndex >= channelData.length) break;
      
      // Calculate RMS for this pixel to get average amplitude
      let sum = 0;
      const samplesToAverage = Math.floor(samplesPerPixel);
      
      for (let i = 0; i < samplesToAverage && sampleIndex + i < channelData.length; i++) {
        const sample = channelData[sampleIndex + i];
        sum += sample * sample;
      }
      
      const rms = Math.sqrt(sum / samplesToAverage);
      const amplitude = rms * height * 0.8; // 80% of height
      
      const y1 = (height / 2) - amplitude;
      const y2 = (height / 2) + amplitude;
      
      if (x === 0) {
        this.ctx.moveTo(x, y1);
      } else {
        this.ctx.lineTo(x, y1);
      }
    }
    
    // Draw the bottom half (mirrored)
    for (let x = width - 1; x >= 0; x--) {
      const sampleIndex = Math.floor(startSample + (x * samplesPerPixel));
      
      if (sampleIndex >= channelData.length) continue;
      
      let sum = 0;
      const samplesToAverage = Math.floor(samplesPerPixel);
      
      for (let i = 0; i < samplesToAverage && sampleIndex + i < channelData.length; i++) {
        const sample = channelData[sampleIndex + i];
        sum += sample * sample;
      }
      
      const rms = Math.sqrt(sum / samplesToAverage);
      const amplitude = rms * height * 0.8;
      const y2 = (height / 2) + amplitude;
      
      this.ctx.lineTo(x, y2);
    }
    
    this.ctx.closePath();
    this.ctx.fillStyle = 'rgba(79, 195, 247, 0.3)';
    this.ctx.fill();
    this.ctx.stroke();
  }

  drawPlayhead(position: number): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    
    const x = position * this.pixelsPerSecond - this.scrollPosition;
    
    if (x >= 0 && x <= width) {
      this.ctx.strokeStyle = '#007acc';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
    }
  }

  resize(): void {
    this.setupCanvas();
    this.render();
  }
}
