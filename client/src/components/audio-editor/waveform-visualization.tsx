import { useEffect, useRef, useState, useMemo } from 'react';
import { AudioClip } from '@/types/audio';
import { useLocalAudioStorage } from '@/hooks/use-local-audio-storage';

interface WaveformVisualizationProps {
  clip: AudioClip;
  width: number;
  height: number;
  zoomLevel?: number;
  getAudioBuffer?: (audioFileId: string) => AudioBuffer | undefined;
}

// Cache for processed waveform data
interface WaveformCache {
  audioFileId: string;
  sampleRate: number;
  duration: number;
  // Different levels of detail for different zoom levels
  lowDetail: Float32Array; // For zoom < 100%
  mediumDetail: Float32Array; // For zoom 100-500%
  highDetail: Float32Array; // For zoom > 500%
}

const waveformCache = new Map<string, WaveformCache>();

export function WaveformVisualization({ clip, width, height, zoomLevel = 100, getAudioBuffer }: WaveformVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { getAudioFile } = useLocalAudioStorage();
  const [isProcessing, setIsProcessing] = useState(false);

  // Determine which level of detail to use based on zoom
  const detailLevel = useMemo(() => {
    if (zoomLevel < 100) return 'low';
    if (zoomLevel < 500) return 'medium';
    return 'high';
  }, [zoomLevel]);

  useEffect(() => {
    drawWaveform();
  }, [clip.audioFileId, clip.offset, clip.duration, width, height, zoomLevel]);

  const processAudioBuffer = async (audioBuffer: AudioBuffer): Promise<WaveformCache> => {
    return new Promise((resolve) => {
      // Use Web Worker or setTimeout to avoid blocking UI
      setTimeout(() => {
        const data = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const duration = audioBuffer.duration;
        
        console.log(`Processing waveform for ${duration.toFixed(1)}s audio, ${data.length} samples`);
        
        // Calculate different levels of detail
        // Low detail: 1 sample per 1000 original samples (for overview)
        const lowDetailSamples = Math.ceil(data.length / 1000);
        const lowDetail = new Float32Array(lowDetailSamples);
        
        // Medium detail: 1 sample per 200 original samples  
        const mediumDetailSamples = Math.ceil(data.length / 200);
        const mediumDetail = new Float32Array(mediumDetailSamples);
        
        // High detail: 1 sample per 50 original samples
        const highDetailSamples = Math.ceil(data.length / 50);
        const highDetail = new Float32Array(highDetailSamples);
        
        // Process low detail
        for (let i = 0; i < lowDetailSamples; i++) {
          const startIdx = i * 1000;
          const endIdx = Math.min(startIdx + 1000, data.length);
          let rms = 0;
          let count = 0;
          
          for (let j = startIdx; j < endIdx; j++) {
            rms += data[j] * data[j];
            count++;
          }
          
          lowDetail[i] = count > 0 ? Math.sqrt(rms / count) : 0;
        }
        
        // Process medium detail
        for (let i = 0; i < mediumDetailSamples; i++) {
          const startIdx = i * 200;
          const endIdx = Math.min(startIdx + 200, data.length);
          let rms = 0;
          let count = 0;
          
          for (let j = startIdx; j < endIdx; j++) {
            rms += data[j] * data[j];
            count++;
          }
          
          mediumDetail[i] = count > 0 ? Math.sqrt(rms / count) : 0;
        }
        
        // Process high detail
        for (let i = 0; i < highDetailSamples; i++) {
          const startIdx = i * 50;
          const endIdx = Math.min(startIdx + 50, data.length);
          let rms = 0;
          let count = 0;
          
          for (let j = startIdx; j < endIdx; j++) {
            rms += data[j] * data[j];
            count++;
          }
          
          highDetail[i] = count > 0 ? Math.sqrt(rms / count) : 0;
        }
        
        console.log(`Processed: Low=${lowDetailSamples}, Medium=${mediumDetailSamples}, High=${highDetailSamples} samples`);
        
        resolve({
          audioFileId: clip.audioFileId,
          sampleRate,
          duration,
          lowDetail,
          mediumDetail,
          highDetail
        });
      }, 10);
    });
  };

  const drawWaveform = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Get audio buffer
    let audioBuffer = getAudioBuffer?.(clip.audioFileId);
    if (!audioBuffer) {
      const audioFile = getAudioFile(clip.audioFileId);
      audioBuffer = audioFile?.audioBuffer;
    }

    if (!audioBuffer) {
      drawPlaceholderWaveform(ctx, width, height);
      return;
    }

    // Check cache
    let cachedData = waveformCache.get(clip.audioFileId);
    
    if (!cachedData) {
      // Only process if not already processing
      if (!isProcessing) {
        setIsProcessing(true);
        console.log('Processing new waveform data...');
        try {
          cachedData = await processAudioBuffer(audioBuffer);
          waveformCache.set(clip.audioFileId, cachedData);
          console.log('Waveform data cached successfully');
        } catch (error) {
          console.error('Error processing waveform:', error);
          drawPlaceholderWaveform(ctx, width, height);
          return;
        } finally {
          setIsProcessing(false);
        }
      } else {
        // Show loading state
        drawLoadingWaveform(ctx, width, height);
        return;
      }
    }

    // Use cached data to draw waveform quickly
    drawCachedWaveform(ctx, cachedData, width, height, clip.offset, clip.duration, detailLevel);
  };

  const drawCachedWaveform = (
    ctx: CanvasRenderingContext2D,
    cache: WaveformCache,
    w: number,
    h: number,
    offset: number,
    duration: number,
    detail: string
  ) => {
    const centerY = h / 2;
    
    // Select appropriate detail level
    let waveformData: Float32Array;
    let samplesPerSecond: number;
    
    switch (detail) {
      case 'low':
        waveformData = cache.lowDetail;
        samplesPerSecond = cache.sampleRate / 1000;
        break;
      case 'medium':
        waveformData = cache.mediumDetail;
        samplesPerSecond = cache.sampleRate / 200;
        break;
      case 'high':
        waveformData = cache.highDetail;
        samplesPerSecond = cache.sampleRate / 50;
        break;
      default:
        waveformData = cache.mediumDetail;
        samplesPerSecond = cache.sampleRate / 200;
    }
    
    console.log(`Drawing with ${detail} detail, ${waveformData.length} samples, zoom: ${zoomLevel}%`);
    
    // Calculate which part of the cached data to use
    const startSample = Math.floor(offset * samplesPerSecond);
    const endSample = Math.min(startSample + Math.floor(duration * samplesPerSecond), waveformData.length);
    const visibleSamples = endSample - startSample;
    
    // Prevent issues with very small or zero sample counts
    if (visibleSamples <= 0) {
      console.warn('No visible samples to draw');
      drawPlaceholderWaveform(ctx, w, h);
      return;
    }
    
    const samplesPerPixel = Math.max(0.1, visibleSamples / w); // Prevent division by zero
    
    // Create bright gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(99, 162, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(139, 192, 255, 0.9)');
    gradient.addColorStop(0.7, 'rgba(139, 192, 255, 0.9)');
    gradient.addColorStop(1, 'rgba(99, 162, 255, 1)');
    
    // Draw waveform efficiently
    for (let x = 0; x < w; x++) {
      const sampleIndex = startSample + Math.floor(x * samplesPerPixel);
      
      if (sampleIndex >= waveformData.length || sampleIndex < 0) continue;
      
      const amplitude = waveformData[sampleIndex];
      const height = amplitude * (h / 2) * 1.6; // 60% amplification
      
      // Draw main body
      ctx.fillStyle = gradient;
      ctx.fillRect(x, centerY - height, 1, height * 2);
      
      // Add peak highlights for better visibility
      if (amplitude > 0.1) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(x, centerY - height, 1, 2);
        ctx.fillRect(x, centerY + height - 1, 1, 2);
      }
    }
  };

  const drawLoadingWaveform = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const centerY = h / 2;
    
    // Animated loading bars
    const time = Date.now() / 1000;
    const barCount = 20;
    const barWidth = w / barCount;
    
    ctx.fillStyle = 'rgba(99, 162, 255, 0.5)';
    
    for (let i = 0; i < barCount; i++) {
      const animOffset = Math.sin(time * 2 + i * 0.5) * 0.5 + 0.5;
      const barHeight = (h * 0.3) * animOffset;
      const x = i * barWidth;
      const y = centerY - barHeight / 2;
      
      ctx.fillRect(x + 2, y, barWidth - 4, barHeight);
    }
    
    // Loading text
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Processing...', w / 2, centerY + h * 0.3);
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
      {isProcessing && (
        <div 
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            background: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: '2px 6px',
            fontSize: '10px',
            borderRadius: '0 0 0 4px'
          }}
        >
          Processing...
        </div>
      )}
    </div>
  );
}