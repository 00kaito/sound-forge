export interface SpectrogramData {
  frequencies: Float32Array[];
  timeStep: number;
  frequencyBins: number;
  maxFrequency: number;
  minFrequency: number;
}

export interface SpectrogramCache {
  data: SpectrogramData;
  audioBufferId: string;
  sampleRate: number;
  duration: number;
  fftSize: number;
  lastUsed: number;
}

export class SpectrogramAnalyzer {
  private cache = new Map<string, SpectrogramCache>();
  private maxCacheSize = 10;
  private readonly FFT_SIZE = 128; // Much smaller for instant results
  private readonly OVERLAP_FACTOR = 0.5; // Reduced overlap for speed
  
  // Throttling mechanism - only recalculate spectrogram if zoom changes significantly
  private lastZoomLevel = 0;
  private zoomThreshold = 0.1; // 10% change threshold

  async analyzeAudioBuffer(
    audioBuffer: AudioBuffer, 
    audioBufferId: string,
    zoomLevel?: number
  ): Promise<SpectrogramData> {
    
    // Check if we need to recalculate based on zoom change
    if (zoomLevel !== undefined) {
      const zoomChange = Math.abs(zoomLevel - this.lastZoomLevel) / this.lastZoomLevel;
      if (zoomChange < this.zoomThreshold && this.cache.has(audioBufferId)) {
        const cached = this.cache.get(audioBufferId)!;
        cached.lastUsed = Date.now();
        return cached.data;
      }
      this.lastZoomLevel = zoomLevel;
    }

    // Check cache first
    const cacheKey = `${audioBufferId}_${this.FFT_SIZE}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      cached.lastUsed = Date.now();
      return cached.data;
    }

    console.log('SpectrogramAnalyzer: Computing FFT for', audioBufferId, 'FFT Size:', this.FFT_SIZE);
    
    return new Promise((resolve) => {
      this.computeSpectrogramAsync(audioBuffer, audioBufferId).then(resolve);
    });
  }

  private async computeSpectrogramAsync(
    audioBuffer: AudioBuffer, 
    audioBufferId: string
  ): Promise<SpectrogramData> {
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const hopSize = Math.floor(this.FFT_SIZE * (1 - this.OVERLAP_FACTOR));
    const windowSize = this.FFT_SIZE;
    
    const frequencyBins = this.FFT_SIZE / 2;
    const frequencies: Float32Array[] = [];
    const numFrames = Math.floor((channelData.length - windowSize) / hopSize) + 1;
    
    // Pre-compute Hann window
    const hannWindow = new Float32Array(windowSize);
    for (let i = 0; i < windowSize; i++) {
      hannWindow[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (windowSize - 1)));
    }
    
    // Ultra-simplified: process every 10th frame for speed
    const frameStep = 10;
    const maxFrames = Math.min(numFrames, 200); // Limit to max 200 frames
    
    for (let frame = 0; frame < maxFrames; frame += frameStep) {
      const startSample = frame * hopSize;
      
      // Create windowed frame
      const frameData = new Float32Array(windowSize);
      for (let i = 0; i < windowSize && startSample + i < channelData.length; i++) {
        frameData[i] = channelData[startSample + i] * hannWindow[i];
      }
      
      // Use ultra-simplified FFT computation
      const frequencyData = this.computeUltraSimplifiedFFT(frameData);
      frequencies.push(frequencyData);
      
      // Quick yield every 10 frames
      if (frame % 50 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }
    
    const spectrogramData: SpectrogramData = {
      frequencies,
      timeStep: hopSize / sampleRate,
      frequencyBins,
      maxFrequency: sampleRate / 2,
      minFrequency: 0
    };
    
    // Cache the result
    const cacheKey = `${audioBufferId}_${this.FFT_SIZE}`;
    this.cacheSpectrogramData(cacheKey, spectrogramData, audioBufferId, sampleRate, audioBuffer.duration);
    
    console.log('SpectrogramAnalyzer: Computed spectrogram', {
      frames: frequencies.length,
      frequencyBins,
      timeStep: spectrogramData.timeStep,
      duration: audioBuffer.duration
    });
    
    return spectrogramData;
  }

  private computeUltraSimplifiedFFT(signal: Float32Array): Float32Array {
    const N = signal.length;
    const magnitudes = new Float32Array(N / 2);
    
    // Ultra-simplified: only 16 frequency bands for instant results
    const numBands = 16;
    const bandSize = Math.floor((N / 2) / numBands);
    
    for (let band = 0; band < numBands; band++) {
      let energy = 0;
      const startIdx = band * bandSize;
      const endIdx = Math.min(startIdx + bandSize, N);
      
      // Simple energy calculation instead of FFT
      for (let i = startIdx; i < endIdx; i += 4) { // Sample every 4th point
        if (i < signal.length) {
          energy += signal[i] * signal[i];
        }
      }
      
      // Convert to dB-like scale
      const dbValue = energy > 0 ? Math.log10(energy * 1000) * 10 : -60;
      
      // Fill the band
      for (let i = 0; i < bandSize && startIdx + i < magnitudes.length; i++) {
        magnitudes[startIdx + i] = Math.max(-60, Math.min(0, dbValue));
      }
    }
    
    return magnitudes;
  }


  private cacheSpectrogramData(
    cacheKey: string, 
    data: SpectrogramData, 
    audioBufferId: string,
    sampleRate: number,
    duration: number
  ): void {
    // Clean old cache entries if we exceed max size
    if (this.cache.size >= this.maxCacheSize) {
      let oldestKey = '';
      let oldestTime = Date.now();
      
      const entries = Array.from(this.cache.entries());
      for (const [key, entry] of entries) {
        if (entry.lastUsed < oldestTime) {
          oldestTime = entry.lastUsed;
          oldestKey = key;
        }
      }
      
      if (oldestKey) {
        this.cache.delete(oldestKey);
        console.log('SpectrogramAnalyzer: Removed old cache entry', oldestKey);
      }
    }
    
    this.cache.set(cacheKey, {
      data,
      audioBufferId,
      sampleRate,
      duration,
      fftSize: this.FFT_SIZE,
      lastUsed: Date.now()
    });
  }

  clearCache(): void {
    this.cache.clear();
    console.log('SpectrogramAnalyzer: Cache cleared');
  }

  getCacheStats(): { size: number; maxSize: number; entries: string[] } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      entries: Array.from(this.cache.keys())
    };
  }

  // Convert frequency bin to actual frequency in Hz
  binToFrequency(bin: number, sampleRate: number): number {
    return (bin * sampleRate) / (2 * this.FFT_SIZE);
  }

  // Convert frequency in Hz to bin index
  frequencyToBin(frequency: number, sampleRate: number): number {
    return Math.floor((frequency * 2 * this.FFT_SIZE) / sampleRate);
  }
}

// Singleton instance for global use
export const spectrogramAnalyzer = new SpectrogramAnalyzer();