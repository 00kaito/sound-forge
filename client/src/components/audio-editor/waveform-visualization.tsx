import { useEffect, useRef } from 'react';
import { AudioClip } from '@/types/audio';
import { useLocalAudioStorage } from '@/hooks/use-local-audio-storage';

interface WaveformVisualizationProps {
  clip: AudioClip;
  width: number;
  height: number;
}

export function WaveformVisualization({ clip, width, height }: WaveformVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { getAudioFile } = useLocalAudioStorage();

  useEffect(() => {
    drawWaveform();
  }, [clip.audioFileId, clip.offset, clip.duration, width, height]);

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    const audioFile = getAudioFile(clip.audioFileId);
    if (!audioFile?.audioBuffer) {
      // Draw placeholder waveform
      drawPlaceholderWaveform(ctx, width, height);
      return;
    }

    // Draw real waveform from audio buffer - content stays fixed regardless of clip position
    drawRealWaveform(ctx, audioFile.audioBuffer, width, height, clip.offset, clip.duration);
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
      let highFreqEnergy = 0;
      let count = 0;
      
      for (let i = 0; i < samplesPerPixel && sampleIndex + i < data.length; i++) {
        const sample = data[sampleIndex + i];
        sumSquares += sample * sample;
        maxPeak = Math.max(maxPeak, sample);
        minPeak = Math.min(minPeak, sample);
        
        // Calculate high-frequency content
        if (i > 0 && sampleIndex + i - 1 < data.length) {
          const prevSample = data[sampleIndex + i - 1];
          const diff = sample - prevSample;
          highFreqEnergy += diff * diff;
        }
        count++;
      }
      
      if (count === 0) continue;
      
      const rms = Math.sqrt(sumSquares / count);
      const peakAmplitude = Math.max(Math.abs(maxPeak), Math.abs(minPeak));
      const highFreq = Math.sqrt(highFreqEnergy / count);
      
      // Layer 1: RMS body (main waveform)
      const rmsHeight = rms * (h / 2) * 0.8;
      ctx.fillStyle = gradient;
      ctx.fillRect(x, centerY - rmsHeight, 1, rmsHeight * 2);
      
      // Layer 2: Peak details for transients
      if (peakAmplitude > rms * 1.5) {
        const peakHeight = peakAmplitude * (h / 2) * 0.9;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(x, centerY - peakHeight, 1, 2);
        ctx.fillRect(x, centerY + peakHeight - 1, 1, 2);
      }
      
      // Layer 3: High-frequency content highlighting
      if (highFreq > 0.1 && samplesPerPixel > 4) {
        const hfHeight = highFreq * (h / 2) * 0.4;
        ctx.fillStyle = 'rgba(255, 215, 0, 0.6)'; // Golden color for brightness
        ctx.fillRect(x, centerY - hfHeight, 1, hfHeight * 2);
      }
      
      // Layer 4: Detailed micro-structure for high zoom
      if (samplesPerPixel <= 2 && x % 2 === 0) {
        // Show individual sample points when very zoomed in
        const sampleValue = data[sampleIndex];
        const sampleY = centerY - (sampleValue * h * 0.9 / 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(x, sampleY - 0.5, 1, 1);
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