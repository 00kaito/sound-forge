import { useEffect, useRef } from 'react';
import { AudioClip } from '@/types/audio';
import { useLocalAudioStorage } from '@/hooks/use-local-audio-storage';

interface WaveformVisualizationProps {
  clip: AudioClip;
  width: number;
  height: number;
  zoomLevel?: number;
  getAudioBuffer?: (audioFileId: string) => AudioBuffer | undefined;
}

export function WaveformVisualization({ clip, width, height, zoomLevel, getAudioBuffer }: WaveformVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { getAudioFile } = useLocalAudioStorage();

  useEffect(() => {
    drawWaveform();
  }, [clip.audioFileId, clip.offset, clip.duration, width, height, zoomLevel]);

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
      // Show placeholder waveform when no buffer available
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
    
    // Create much brighter gradient for better contrast
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(99, 162, 255, 1)');     // Bright blue
    gradient.addColorStop(0.3, 'rgba(139, 192, 255, 0.9)'); // Light blue
    gradient.addColorStop(0.7, 'rgba(139, 192, 255, 0.9)'); // Light blue  
    gradient.addColorStop(1, 'rgba(99, 162, 255, 1)');     // Bright blue
    
    // Enhanced multi-layer rendering
    for (let x = 0; x < w; x++) {
      const sampleIndex = startSample + Math.floor(x * samplesPerPixel);
      if (sampleIndex >= data.length) break;
      
      // Enhanced analysis with better peak and RMS detection
      let sumSquares = 0;
      let maxPeak = -1;
      let minPeak = 1;
      let count = 0;
      
      // More detailed sampling for accuracy 
      const detailSamples = Math.min(samplesPerPixel, 64);
      for (let i = 0; i < detailSamples && sampleIndex + i < data.length; i++) {
        const sample = data[sampleIndex + i];
        sumSquares += sample * sample;
        maxPeak = Math.max(maxPeak, sample);
        minPeak = Math.min(minPeak, sample);
        count++;
      }
      
      if (count === 0) continue;
      
      const rms = Math.sqrt(sumSquares / count);
      
      // Enhanced amplitude scaling for better visibility
      const amplifyFactor = 1.6; // Increase amplitude by 60%
      const maxHeight = Math.abs(maxPeak) * (h / 2) * amplifyFactor;
      const minHeight = Math.abs(minPeak) * (h / 2) * amplifyFactor;
      const rmsHeight = rms * (h / 2) * amplifyFactor * 0.8;
      
      // Draw main RMS body with bright gradient
      ctx.fillStyle = gradient;
      ctx.fillRect(x, centerY - rmsHeight, 1, rmsHeight * 2);
      
      // Bright peak lines for better detail
      if (maxHeight > rmsHeight * 1.1) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'; // Very bright peaks
        ctx.fillRect(x, centerY - maxHeight, 1, Math.max(1, maxHeight - rmsHeight));
      }
      
      if (minHeight > rmsHeight * 1.1) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'; // Very bright peaks
        ctx.fillRect(x, centerY + rmsHeight, 1, Math.max(1, minHeight - rmsHeight));
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
    <div style={{ width, height, position: 'relative' }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          width: '100%',
          height: '100%',
          display: 'block'
        }}
      />
    </div>
  );
}