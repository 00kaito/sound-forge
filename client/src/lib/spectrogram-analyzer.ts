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
  private readonly FFT_SIZE = 512; // Reduced for better performance
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
    
    // Process frames in batches to avoid blocking UI
    const batchSize = 20; // Smaller batches for better responsiveness
    let frameIndex = 0;
    
    const processBatch = async (): Promise<void> => {
      const batchEnd = Math.min(frameIndex + batchSize, numFrames);
      
      for (let frame = frameIndex; frame < batchEnd; frame++) {
        const startSample = frame * hopSize;
        
        // Create windowed frame
        const frameData = new Float32Array(windowSize);
        for (let i = 0; i < windowSize && startSample + i < channelData.length; i++) {
          frameData[i] = channelData[startSample + i] * hannWindow[i];
        }
        
        // Use simplified FFT computation
        const frequencyData = this.computeSimplifiedFFT(frameData);
        frequencies.push(frequencyData);
      }
      
      frameIndex = batchEnd;
      
      // Yield control to prevent UI blocking
      if (frameIndex < numFrames) {
        await new Promise(resolve => setTimeout(resolve, 5));
        return processBatch();
      }
    };
    
    await processBatch();
    
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

  private computeSimplifiedFFT(signal: Float32Array): Float32Array {
    const N = signal.length;
    const magnitudes = new Float32Array(N / 2);
    
    // Use simplified approach - sample only key frequency bins for visualization
    const maxBins = Math.min(64, N / 2); // Limit to 64 bins for performance
    const binStep = Math.floor((N / 2) / maxBins);
    
    for (let k = 0; k < maxBins; k++) {
      const binIndex = k * binStep;
      let realSum = 0;
      let imagSum = 0;
      
      // Sample fewer points for performance
      const sampleStep = Math.max(1, Math.floor(N / 128));
      
      for (let n = 0; n < N; n += sampleStep) {
        const angle = (-2 * Math.PI * binIndex * n) / N;
        realSum += signal[n] * Math.cos(angle);
        imagSum += signal[n] * Math.sin(angle);
      }
      
      // Convert to dB scale magnitude
      const magnitude = Math.sqrt(realSum * realSum + imagSum * imagSum);
      const dbValue = magnitude > 0 ? 20 * Math.log10(magnitude) : -100;
      
      // Fill multiple output bins with same value for visualization
      for (let i = 0; i < binStep && binIndex + i < magnitudes.length; i++) {
        magnitudes[binIndex + i] = dbValue;
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