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
    
    // Calculate visible time range
    const timePerPixel = 1 / this.pixelsPerSecond;
    const startTime = this.scrollPosition * timePerPixel;
    const endTime = startTime + (width * timePerPixel);
    
    // Calculate sample indices
    const startSample = Math.floor(startTime * sampleRate);
    const endSample = Math.min(Math.floor(endTime * sampleRate), channelData.length);
    
    if (startSample >= endSample) return;

    const samplesPerPixel = Math.max(1, (endSample - startSample) / width);
    const centerY = height / 2;
    
    // Create gradient for more appealing visuals
    const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(79, 195, 247, 0.8)');
    gradient.addColorStop(0.5, 'rgba(79, 195, 247, 0.4)');
    gradient.addColorStop(1, 'rgba(79, 195, 247, 0.8)');
    
    // Enhanced waveform rendering with peak and RMS detection
    for (let x = 0; x < width; x++) {
      const sampleIndex = Math.floor(startSample + (x * samplesPerPixel));
      
      if (sampleIndex >= channelData.length) break;
      
      // Enhanced analysis - get both peak and RMS for this pixel
      let sumSquares = 0;
      let maxPeak = 0;
      let minPeak = 0;
      const samplesToAnalyze = Math.max(1, Math.floor(samplesPerPixel));
      
      for (let i = 0; i < samplesToAnalyze && sampleIndex + i < channelData.length; i++) {
        const sample = channelData[sampleIndex + i];
        sumSquares += sample * sample;
        maxPeak = Math.max(maxPeak, sample);
        minPeak = Math.min(minPeak, sample);
      }
      
      const rms = Math.sqrt(sumSquares / samplesToAnalyze);
      const peakAmplitude = Math.max(Math.abs(maxPeak), Math.abs(minPeak));
      
      // Use RMS for body and peak for spikes
      const rmsHeight = rms * height * 0.7;
      const peakHeight = peakAmplitude * height * 0.9;
      
      // Draw RMS body (main waveform)
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(x, centerY - rmsHeight, 1, rmsHeight * 2);
      
      // Draw peak lines for detail
      if (peakHeight > rmsHeight) {
        this.ctx.fillStyle = 'rgba(79, 195, 247, 0.9)';
        this.ctx.fillRect(x, centerY - peakHeight, 1, 2); // Top peak
        this.ctx.fillRect(x, centerY + peakHeight - 1, 1, 2); // Bottom peak
      }
      
      // Clean waveform without pseudo-spectrogram
    }
    
    // Add subtle outline for definition
    this.ctx.strokeStyle = 'rgba(79, 195, 247, 0.6)';
    this.ctx.lineWidth = 0.5;
    this.ctx.beginPath();
    
    // Draw outline following the RMS envelope
    for (let x = 0; x < width; x++) {
      const sampleIndex = Math.floor(startSample + (x * samplesPerPixel));
      
      if (sampleIndex >= channelData.length) break;
      
      let sumSquares = 0;
      const samplesToAnalyze = Math.max(1, Math.floor(samplesPerPixel));
      
      for (let i = 0; i < samplesToAnalyze && sampleIndex + i < channelData.length; i++) {
        const sample = channelData[sampleIndex + i];
        sumSquares += sample * sample;
      }
      
      const rms = Math.sqrt(sumSquares / samplesToAnalyze);
      const amplitude = rms * height * 0.7;
      
      if (x === 0) {
        this.ctx.moveTo(x, centerY - amplitude);
      } else {
        this.ctx.lineTo(x, centerY - amplitude);
      }
    }
    
    // Complete the outline
    for (let x = width - 1; x >= 0; x--) {
      const sampleIndex = Math.floor(startSample + (x * samplesPerPixel));
      
      if (sampleIndex >= channelData.length) continue;
      
      let sumSquares = 0;
      const samplesToAnalyze = Math.max(1, Math.floor(samplesPerPixel));
      
      for (let i = 0; i < samplesToAnalyze && sampleIndex + i < channelData.length; i++) {
        const sample = channelData[sampleIndex + i];
        sumSquares += sample * sample;
      }
      
      const rms = Math.sqrt(sumSquares / samplesToAnalyze);
      const amplitude = rms * height * 0.7;
      
      this.ctx.lineTo(x, centerY + amplitude);
    }
    
    this.ctx.closePath();
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
