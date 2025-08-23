import { useRef, useEffect, useState } from 'react';
import { Track, AudioClip } from '@/types/audio';
import { WaveformVisualization } from './waveform-visualization';

interface WaveformCanvasProps {
  tracks: Track[];
  pixelsPerSecond: number;
  playheadPosition: number;
  onTrackDrop: (e: React.DragEvent, trackId: string) => void;
  onUpdateClip: (clipId: string, updates: Partial<AudioClip>) => void;
  onDeleteClip: (clipId: string) => void;
}

export function WaveformCanvas({
  tracks,
  pixelsPerSecond,
  playheadPosition,
  onTrackDrop,
  onUpdateClip,
  onDeleteClip
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [draggedClip, setDraggedClip] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [fadeEditMode, setFadeEditMode] = useState<{ clipId: string, type: 'fadeIn' | 'fadeOut' } | null>(null);
  const [isDraggingFade, setIsDraggingFade] = useState(false);

  const TRACK_HEIGHT = 96; // 24 * 4 for h-24 equivalent

  useEffect(() => {
    renderWaveforms();
  }, [tracks, pixelsPerSecond, playheadPosition]);

  const renderWaveforms = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Draw track separators
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    
    for (let i = 1; i < tracks.length; i++) {
      const y = i * TRACK_HEIGHT;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw playhead through all tracks
    if (playheadPosition >= 0 && playheadPosition <= width) {
      ctx.strokeStyle = '#007acc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadPosition, 0);
      ctx.lineTo(playheadPosition, height);
      ctx.stroke();
    }
  };

  const handleClipMouseDown = (e: React.MouseEvent, clip: AudioClip) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clipWidth = clip.duration * pixelsPerSecond;
    
    // Check if clicking on fade handles
    const fadeInWidth = (clip.fadeIn || 0) * pixelsPerSecond;
    const fadeOutWidth = (clip.fadeOut || 0) * pixelsPerSecond;
    
    if (clickX <= fadeInWidth + 10) {
      // Clicking on fade-in handle
      setFadeEditMode({ clipId: clip.id, type: 'fadeIn' });
      setIsDraggingFade(true);
    } else if (clickX >= clipWidth - fadeOutWidth - 10) {
      // Clicking on fade-out handle
      setFadeEditMode({ clipId: clip.id, type: 'fadeOut' });
      setIsDraggingFade(true);
    } else {
      // Regular clip dragging
      setDraggedClip(clip.id);
      setDragOffset({
        x: clickX,
        y: e.clientY - rect.top
      });
    }
  };

  const handleClipMouseMove = (e: React.MouseEvent) => {
    if (isDraggingFade && fadeEditMode) {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const clipElement = e.currentTarget.querySelector(`[data-testid="audio-clip-${fadeEditMode.clipId}"]`);
      if (!clipElement) return;
      
      const clipRect = clipElement.getBoundingClientRect();
      const relativeX = e.clientX - clipRect.left;
      const clipWidth = clipRect.width;
      
      if (fadeEditMode.type === 'fadeIn') {
        const fadeInTime = Math.max(0, Math.min(relativeX / pixelsPerSecond, 5)); // Max 5 seconds
        onUpdateClip(fadeEditMode.clipId, { fadeIn: fadeInTime });
      } else if (fadeEditMode.type === 'fadeOut') {
        const fadeOutTime = Math.max(0, Math.min((clipWidth - relativeX) / pixelsPerSecond, 5)); // Max 5 seconds
        onUpdateClip(fadeEditMode.clipId, { fadeOut: fadeOutTime });
      }
    } else if (draggedClip) {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const newX = e.clientX - rect.left - dragOffset.x;
      const newStartTime = Math.max(0, newX / pixelsPerSecond);
      
      onUpdateClip(draggedClip, { startTime: newStartTime });
    }
  };

  const handleClipMouseUp = () => {
    setDraggedClip(null);
    setDragOffset({ x: 0, y: 0 });
    setFadeEditMode(null);
    setIsDraggingFade(false);
  };

  const handleTrackDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const getClipColor = (index: number): string => {
    const colors = [
      'rgb(79, 195, 247)', // Blue
      'rgb(76, 175, 80)', // Green  
      'rgb(156, 39, 176)', // Purple
      'rgb(255, 152, 0)', // Orange
      'rgb(244, 67, 54)', // Red
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="relative w-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full absolute top-0 left-0 pointer-events-none"
        width={Math.max(1200, window.innerWidth * 2)}
        height={tracks.length * TRACK_HEIGHT}
        data-testid="canvas-waveform"
      />
      
      {/* Audio Clips Overlay */}
      <div className="relative w-full">
        {tracks.map((track, trackIndex) => (
          <div
            key={track.id}
            className="h-24 border-b border-gray-700 relative flex items-center justify-center"
            onDragOver={handleTrackDragOver}
            onDrop={(e) => {
              console.log('WaveformCanvas: Drop event on track', track.id);
              onTrackDrop(e, track.id);
            }}
            onMouseMove={handleClipMouseMove}
            onMouseUp={handleClipMouseUp}
            data-testid={`track-lane-${track.id}`}
          >
            {track.clips.length === 0 ? (
              <span className="text-gray-500 text-sm pointer-events-none">
                Drop audio files here
              </span>
            ) : (
              track.clips.map((clip, clipIndex) => (
                <div
                  key={clip.id}
                  className="absolute top-2 bottom-2 rounded cursor-pointer hover:opacity-80 transition-opacity border"
                  style={{
                    left: `${clip.startTime * pixelsPerSecond}px`,
                    width: `${clip.duration * pixelsPerSecond}px`,
                    backgroundColor: `${getClipColor(clipIndex)}33`,
                    borderColor: getClipColor(clipIndex),
                  }}
                  onMouseDown={(e) => handleClipMouseDown(e, clip)}
                  onDoubleClick={() => {
                    console.log('WaveformCanvas: Deleting clip', clip.id);
                    onDeleteClip(clip.id);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    console.log('WaveformCanvas: Right-click delete clip', clip.id);
                    onDeleteClip(clip.id);
                  }}
                  title={`${clip.name} - Double-click or right-click to delete`}
                  data-testid={`audio-clip-${clip.id}`}
                >
                  {/* Waveform background */}
                  <WaveformVisualization
                    clip={clip}
                    width={clip.duration * pixelsPerSecond}
                    height={88} // h-24 minus padding
                  />
                  
                  {/* Fade In Gradient */}
                  {clip.fadeIn && clip.fadeIn > 0 && (
                    <div 
                      className="absolute top-0 left-0 bottom-0 pointer-events-none"
                      style={{
                        width: `${clip.fadeIn * pixelsPerSecond}px`,
                        background: `linear-gradient(to right, rgba(0,0,0,0.7), transparent)`
                      }}
                    >
                      <div className="absolute top-1 left-1 text-xs text-white opacity-75">
                        ↗ {clip.fadeIn.toFixed(2)}s
                      </div>
                    </div>
                  )}
                  
                  {/* Fade Out Gradient */}
                  {clip.fadeOut && clip.fadeOut > 0 && (
                    <div 
                      className="absolute top-0 right-0 bottom-0 pointer-events-none"
                      style={{
                        width: `${clip.fadeOut * pixelsPerSecond}px`,
                        background: `linear-gradient(to left, rgba(0,0,0,0.7), transparent)`
                      }}
                    >
                      <div className="absolute top-1 right-1 text-xs text-white opacity-75">
                        {clip.fadeOut.toFixed(2)}s ↘
                      </div>
                    </div>
                  )}
                  
                  <div className="h-full flex items-center px-2 relative z-10">
                    <span className="text-xs text-white truncate drop-shadow">{clip.name}</span>
                  </div>
                  
                  {/* Fade Handles */}
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-3 cursor-col-resize opacity-0 hover:opacity-100 bg-gradient-to-r from-white to-transparent"
                    title="Drag to adjust fade in"
                  ></div>
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize opacity-0 hover:opacity-100 bg-gradient-to-l from-white to-transparent"
                    title="Drag to adjust fade out"
                  ></div>
                  
                  {/* Resize handles */}
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-current cursor-ew-resize opacity-0 hover:opacity-100"></div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 bg-current cursor-ew-resize opacity-0 hover:opacity-100"></div>
                </div>
              ))
            )}
          </div>
        ))}
        
        {/* Empty tracks for expansion */}
        {Array.from({ length: Math.max(0, 5 - tracks.length) }).map((_, index) => (
          <div
            key={`empty-${index}`}
            className="h-24 border-b border-gray-700 relative flex items-center justify-center opacity-30"
          >
            <span className="text-gray-600 text-sm">Track {tracks.length + index + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
