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
  private readonly FFT_SIZE = 2048; // Optimized for performance vs quality
  private readonly OVERLAP_FACTOR = 0.75; // 75% overlap for smooth visualization
  
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
    
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const hopSize = Math.floor(this.FFT_SIZE * (1 - this.OVERLAP_FACTOR));
    const windowSize = this.FFT_SIZE;
    
    const frequencyBins = this.FFT_SIZE / 2;
    const frequencies: Float32Array[] = [];
    const numFrames = Math.floor((channelData.length - windowSize) / hopSize) + 1;
    
    // Pre-compute Hann window for better frequency resolution
    const hannWindow = new Float32Array(windowSize);
    for (let i = 0; i < windowSize; i++) {
      hannWindow[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (windowSize - 1)));
    }
    
    // Process audio in chunks with manual FFT
    for (let frame = 0; frame < numFrames; frame++) {
      const startSample = frame * hopSize;
      
      // Create windowed frame
      const frameData = new Float32Array(windowSize);
      for (let i = 0; i < windowSize && startSample + i < channelData.length; i++) {
        frameData[i] = channelData[startSample + i] * hannWindow[i];
      }
      
      // Perform FFT manually (simplified for performance)
      const frequencyData = this.computeFFT(frameData);
      frequencies.push(frequencyData);
    }
    
    const spectrogramData: SpectrogramData = {
      frequencies,
      timeStep: hopSize / sampleRate,
      frequencyBins,
      maxFrequency: sampleRate / 2,
      minFrequency: 0
    };
    
    // Cache the result
    this.cacheSpectrogramData(cacheKey, spectrogramData, audioBufferId, sampleRate, audioBuffer.duration);
    
    console.log('SpectrogramAnalyzer: Computed spectrogram', {
      frames: frequencies.length,
      frequencyBins,
      timeStep: spectrogramData.timeStep,
      duration: audioBuffer.duration
    });
    
    return spectrogramData;
  }

  private computeFFT(signal: Float32Array): Float32Array {
    const N = signal.length;
    const magnitudes = new Float32Array(N / 2);
    
    // Simplified FFT using DFT for specific frequency bins
    // This is optimized for visualization rather than perfect accuracy
    for (let k = 0; k < N / 2; k++) {
      let realSum = 0;
      let imagSum = 0;
      
      for (let n = 0; n < N; n++) {
        const angle = (-2 * Math.PI * k * n) / N;
        realSum += signal[n] * Math.cos(angle);
        imagSum += signal[n] * Math.sin(angle);
      }
      
      // Convert to dB scale magnitude
      const magnitude = Math.sqrt(realSum * realSum + imagSum * imagSum);
      magnitudes[k] = magnitude > 0 ? 20 * Math.log10(magnitude) : -100;
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