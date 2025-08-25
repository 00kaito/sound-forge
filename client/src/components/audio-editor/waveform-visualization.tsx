import { useEffect, useRef, useState } from 'react';
import { AudioClip } from '@/types/audio';
import { useLocalAudioStorage } from '@/hooks/use-local-audio-storage';
import { spectrogramAnalyzer, SpectrogramData } from '@/lib/spectrogram-analyzer';

interface WaveformVisualizationProps {
  clip: AudioClip;
  width: number;
  height: number;
  showSpectrogram?: boolean;
  zoomLevel?: number;
  getAudioBuffer?: (audioFileId: string) => AudioBuffer | undefined;
}

export function WaveformVisualization({ clip, width, height, showSpectrogram = false, zoomLevel, getAudioBuffer }: WaveformVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { getAudioFile } = useLocalAudioStorage();
  const [spectrogramData, setSpectrogramData] = useState<SpectrogramData | null>(null);

  useEffect(() => {
    if (showSpectrogram) {
      loadSpectrogramData();
    } else {
      drawWaveform();
    }
  }, [clip.audioFileId, clip.offset, clip.duration, width, height, showSpectrogram, zoomLevel]);

  const loadSpectrogramData = async () => {
    // Try to get buffer from passed function (more reliable)
    let audioBuffer = getAudioBuffer?.(clip.audioFileId);
    
    // Fallback to LocalAudioStorage
    if (!audioBuffer) {
      console.log('Spectrogram: No buffer from getAudioBuffer, trying LocalAudioStorage');
      const audioFile = getAudioFile(clip.audioFileId);
      audioBuffer = audioFile?.audioBuffer;
    }
    
    if (!audioBuffer) {
      console.log('Spectrogram: No audio buffer found for clip', clip.audioFileId);
      console.log('Spectrogram: getAudioBuffer prop:', !!getAudioBuffer);
      console.log('Spectrogram: getAudioBuffer result:', !!getAudioBuffer?.(clip.audioFileId));
      console.log('Spectrogram: LocalStorage buffer:', !!getAudioFile(clip.audioFileId)?.audioBuffer);
      return;
    }

    try {
      console.log('Spectrogram: Starting analysis for clip', clip.audioFileId);
      const data = await spectrogramAnalyzer.analyzeAudioBuffer(
        audioBuffer, 
        clip.audioFileId,
        zoomLevel
      );
      console.log('Spectrogram: Analysis complete, frames:', data.frequencies.length);
      setSpectrogramData(data);
      drawSpectrogram(data);
    } catch (error) {
      console.error('Failed to load spectrogram data:', error);
      drawWaveform(); // Fallback to waveform
    }
  };

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // First try to get buffer from passed function (more reliable)
    let audioBuffer = getAudioBuffer?.(clip.audioFileId);
    
    // Fallback to LocalAudioStorage
    if (!audioBuffer) {
      const audioFile = getAudioFile(clip.audioFileId);
      audioBuffer = audioFile?.audioBuffer;
    }
    
    if (!audioBuffer) {
      // Draw placeholder waveform
      drawPlaceholderWaveform(ctx, width, height);
      return;
    }

    // Draw real waveform from audio buffer - content stays fixed regardless of clip position
    drawRealWaveform(ctx, audioBuffer, width, height, clip.offset, clip.duration);
  };

  const drawPlaceholderWaveform = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const centerY = h / 2;
    const barCount = Math.min(w / 3, 80);
    const barWidth = w / barCount;
    
    // Create gradient for placeholder
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.4)');

    for (let i = 0; i < barCount; i++) {
      // Generate more realistic waveform pattern
      const time = (i / barCount) * Math.PI * 4;
      const baseHeight = (Math.sin(time) * 0.3 + 0.3) * h * 0.6;
      const randomVariation = (Math.random() - 0.5) * h * 0.4;
      const barHeight = Math.max(h * 0.1, Math.abs(baseHeight + randomVariation));
      
      const x = i * barWidth;
      const y = centerY - barHeight / 2;
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x + 0.5, y, barWidth - 1, barHeight);
      
      // Add some variation with peaks
      if (Math.random() > 0.7) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        const peakHeight = barHeight * 1.3;
        const peakY = centerY - peakHeight / 2;
        ctx.fillRect(x + barWidth * 0.3, peakY, barWidth * 0.4, peakHeight);
      }
    }
  };

  const drawRealWaveform = (
    ctx: CanvasRenderingContext2D, 
    buffer: AudioBuffer, 
    w: number, 
    h: number,
    offset: number,
    duration: number
  ) => {
    const data = buffer.getChannelData(0); // Use first channel
    const sampleRate = buffer.sampleRate;
    const startSample = Math.floor(offset * sampleRate);
    const endSample = Math.min(startSample + Math.floor(duration * sampleRate), data.length);
    const samplesPerPixel = Math.max(1, Math.floor((endSample - startSample) / w));

    const centerY = h / 2;
    
    // Create enhanced gradient for clips
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
    gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.7)');
    
    // Enhanced multi-layer rendering
    for (let x = 0; x < w; x++) {
      const sampleIndex = startSample + Math.floor(x * samplesPerPixel);
      if (sampleIndex >= data.length) break;
      
      // Enhanced analysis with peak and RMS detection
      let sumSquares = 0;
      let maxPeak = 0;
      let minPeak = 0;
      let count = 0;
      
      for (let i = 0; i < samplesPerPixel && sampleIndex + i < data.length; i++) {
        const sample = data[sampleIndex + i];
        sumSquares += sample * sample;
        maxPeak = Math.max(maxPeak, sample);
        minPeak = Math.min(minPeak, sample);
        count++;
      }
      
      if (count === 0) continue;
      
      const rms = Math.sqrt(sumSquares / count);
      const peakAmplitude = Math.max(Math.abs(maxPeak), Math.abs(minPeak));
      
      // Clean waveform visualization - RMS body
      const rmsHeight = rms * (h / 2) * 0.8;
      ctx.fillStyle = gradient;
      ctx.fillRect(x, centerY - rmsHeight, 1, rmsHeight * 2);
      
      // Peak details for transients
      if (peakAmplitude > rms * 1.5) {
        const peakHeight = peakAmplitude * (h / 2) * 0.9;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(x, centerY - peakHeight, 1, 2);
        ctx.fillRect(x, centerY + peakHeight - 1, 1, 2);
      }
    }
    
    // Add subtle outline for definition
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    
    // Draw smooth envelope outline
    for (let x = 0; x < w; x++) {
      const sampleIndex = startSample + Math.floor(x * samplesPerPixel);
      if (sampleIndex >= data.length) break;
      
      let sumSquares = 0;
      let count = 0;
      for (let i = 0; i < samplesPerPixel && sampleIndex + i < data.length; i++) {
        const sample = data[sampleIndex + i];
        sumSquares += sample * sample;
        count++;
      }
      
      if (count === 0) continue;
      
      const rms = Math.sqrt(sumSquares / count);
      const amplitude = rms * (h / 2) * 0.8;
      
      if (x === 0) {
        ctx.moveTo(x, centerY - amplitude);
      } else {
        ctx.lineTo(x, centerY - amplitude);
      }
    }
    
    // Complete the envelope
    for (let x = w - 1; x >= 0; x--) {
      const sampleIndex = startSample + Math.floor(x * samplesPerPixel);
      if (sampleIndex >= data.length) continue;
      
      let sumSquares = 0;
      let count = 0;
      for (let i = 0; i < samplesPerPixel && sampleIndex + i < data.length; i++) {
        const sample = data[sampleIndex + i];
        sumSquares += sample * sample;
        count++;
      }
      
      if (count === 0) continue;
      
      const rms = Math.sqrt(sumSquares / count);
      const amplitude = rms * (h / 2) * 0.8;
      
      ctx.lineTo(x, centerY + amplitude);
    }
    
    ctx.closePath();
    ctx.stroke();
  };

  const drawSpectrogram = (data: SpectrogramData) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.log('Spectrogram: No canvas ref');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.log('Spectrogram: No canvas context');
      return;
    }

    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    console.log('Spectrogram: Canvas cleared, size:', width, 'x', height);

    const { frequencies, timeStep, frequencyBins, maxFrequency } = data;
    if (frequencies.length === 0) {
      console.log('Spectrogram: No frequency data');
      return;
    }

    console.log('Spectrogram: Drawing', frequencies.length, 'frames, max freq:', maxFrequency);

    // Calculate display parameters
    const timeRange = clip.duration;
    const startTimeIndex = Math.floor(clip.offset / timeStep);
    const endTimeIndex = Math.min(startTimeIndex + Math.floor(timeRange / timeStep), frequencies.length);
    const visibleFrames = endTimeIndex - startTimeIndex;

    console.log('Spectrogram: Visible frames:', visibleFrames, 'from', startTimeIndex, 'to', endTimeIndex);

    if (visibleFrames <= 0) {
      console.log('Spectrogram: No visible frames');
      return;
    }

    // Frequency range (focus on audible range)
    const minDisplayFreq = 0;
    const maxDisplayFreq = Math.min(maxFrequency, 8000); // Focus on 0-8kHz for better visual density
    const minBin = Math.floor((minDisplayFreq / maxFrequency) * frequencyBins);
    const maxBin = Math.floor((maxDisplayFreq / maxFrequency) * frequencyBins);

    console.log('Spectrogram: Frequency bins:', minBin, 'to', maxBin, 'of', frequencyBins);

    // Draw spectrogram
    const timePixelWidth = Math.max(1, width / visibleFrames);
    const freqPixelHeight = Math.max(1, height / (maxBin - minBin));

    console.log('Spectrogram: Pixel dimensions:', timePixelWidth, 'x', freqPixelHeight);

    // Track if we're actually drawing anything
    let pixelsDrawn = 0;

    for (let timeIndex = 0; timeIndex < visibleFrames; timeIndex++) {
      const frameIndex = startTimeIndex + timeIndex;
      if (frameIndex >= frequencies.length) break;

      const frame = frequencies[frameIndex];
      const x = Math.floor(timeIndex * timePixelWidth);

      for (let binIndex = minBin; binIndex < maxBin; binIndex++) {
        if (binIndex >= frame.length) break;

        // Convert magnitude to color intensity
        const magnitude = frame[binIndex];
        // Improve normalization - typical audio magnitude ranges
        const normalizedMag = Math.max(0, Math.min(1, (magnitude + 80) / 80)); // dB to 0-1 range
        const intensity = Math.pow(normalizedMag, 0.5); // Apply gamma correction for better visibility

        if (intensity > 0.05) { // Only draw if there's meaningful signal
          // Create color based on frequency and intensity
          const freqRatio = (binIndex - minBin) / (maxBin - minBin);
          const hue = (1 - freqRatio) * 240; // Blue to red (high to low freq)
          const saturation = 70 + (intensity * 30); // More saturated for higher intensity
          const lightness = 20 + (intensity * 60); // Brighter for higher intensity

          ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

          const y = height - ((binIndex - minBin) * freqPixelHeight);
          ctx.fillRect(x, y - freqPixelHeight, Math.max(1, timePixelWidth), Math.max(1, freqPixelHeight));
          
          pixelsDrawn++;
        }
      }
    }

    console.log('Spectrogram: Drew', pixelsDrawn, 'pixels');

    // Add frequency scale overlay (optional)
    if (width > 200) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '10px monospace';
      const freqLabels = [1000, 2000, 4000, 8000];
      
      freqLabels.forEach(freq => {
        if (freq <= maxDisplayFreq) {
          const bin = Math.floor((freq / maxFrequency) * frequencyBins);
          const y = height - ((bin - minBin) * freqPixelHeight);
          ctx.fillText(`${freq/1000}k`, 2, y - 2);
        }
      });
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 opacity-40"
      style={{ width: `${width}px`, height: `${height}px` }}
    />
  );
}