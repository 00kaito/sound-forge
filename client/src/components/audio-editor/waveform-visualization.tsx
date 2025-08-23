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
  }, [clip, width, height]);

  const drawWaveform = async () => {
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

    // Draw real waveform from audio buffer
    drawRealWaveform(ctx, audioFile.audioBuffer, width, height, clip.offset, clip.duration);
  };

  const drawPlaceholderWaveform = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    const barCount = Math.min(w / 4, 50);
    const barWidth = w / barCount;

    for (let i = 0; i < barCount; i++) {
      const barHeight = Math.random() * h * 0.8 + h * 0.1;
      const x = i * barWidth;
      const y = (h - barHeight) / 2;
      
      ctx.fillRect(x + 1, y, barWidth - 2, barHeight);
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

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;

    const centerY = h / 2;
    
    // Draw waveform
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    
    for (let x = 0; x < w; x++) {
      const sampleIndex = startSample + Math.floor(x * samplesPerPixel);
      if (sampleIndex >= data.length) break;
      
      // Calculate RMS for this pixel
      let sum = 0;
      let count = 0;
      for (let i = 0; i < samplesPerPixel && sampleIndex + i < data.length; i++) {
        const sample = data[sampleIndex + i];
        sum += sample * sample;
        count++;
      }
      
      const rms = Math.sqrt(sum / count);
      const amplitude = rms * (h / 2) * 0.9; // Scale to 90% of half height
      
      // Draw positive and negative parts
      ctx.fillRect(x, centerY - amplitude, 1, amplitude * 2);
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