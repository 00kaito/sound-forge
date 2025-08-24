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
  onMoveClipBetweenTracks?: (clipId: string, targetTrackId: string) => void;
  onSaveState?: (tracks: any[], action: string) => void;
  currentTool?: string;
  onSplitClip?: (clipId: string, splitTime: number) => void;
  onCutRegion?: (trackId: string, startTime: number, endTime: number) => void;
  selectionStart?: number | null;
  selectionEnd?: number | null;
  selectedTrackId?: string | null;
  onSelectionChange?: (start: number | null, end: number | null, trackId: string | null) => void;
}

export function WaveformCanvas({
  tracks,
  pixelsPerSecond,
  playheadPosition,
  onTrackDrop,
  onUpdateClip,
  onDeleteClip,
  currentTool,
  onSplitClip,
  onCutRegion,
  selectionStart,
  selectionEnd,
  selectedTrackId,
  onSelectionChange,
  onMoveClipBetweenTracks,
  onSaveState
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [draggedClip, setDraggedClip] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStarted, setDragStarted] = useState(false);
  const [initialClipPosition, setInitialClipPosition] = useState<{ clipId: string, startTime: number, trackId: string } | null>(null);
  const [draggedOverTrackId, setDraggedOverTrackId] = useState<string | null>(null);
  const [fadeEditMode, setFadeEditMode] = useState<{ clipId: string, type: 'fadeIn' | 'fadeOut' } | null>(null);
  const [isDraggingFade, setIsDraggingFade] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStartX, setSelectionStartX] = useState(0);
  const [selectionTrackId, setSelectionTrackId] = useState<string | null>(null);

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

    // Playhead is drawn in timeline component, not here
  };

  const handleClipMouseDown = (e: React.MouseEvent, clip: AudioClip) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clipWidth = clip.duration * pixelsPerSecond;
    
    // Check if cut tool is active
    if (currentTool === 'cut') {
      // Calculate the split time based on click position
      const relativeTime = clickX / pixelsPerSecond;
      const splitTime = clip.startTime + relativeTime;
      
      if (onSplitClip) {
        onSplitClip(clip.id, splitTime);
      }
      return;
    }
    
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
      // Regular clip dragging - save initial position for undo
      setDraggedClip(clip.id);
      setDragOffset({
        x: clickX,
        y: e.clientY - rect.top
      });
      
      // Save initial clip position for potential undo
      const currentTrack = tracks.find(track => track.clips.some(c => c.id === clip.id));
      if (currentTrack) {
        setInitialClipPosition({ clipId: clip.id, startTime: clip.startTime, trackId: currentTrack.id });
      }
      setDragStarted(false);
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
      
      // Calculate which track the clip is being dragged over
      const mouseY = e.clientY - rect.top;
      const trackIndex = Math.floor(mouseY / TRACK_HEIGHT);
      const targetTrack = tracks[trackIndex];
      
      if (targetTrack) {
        setDraggedOverTrackId(targetTrack.id);
      }
      
      onUpdateClip(draggedClip, { startTime: newStartTime });
    }
  };

  const handleClipMouseUp = () => {
    // Handle clip movement between tracks
    if (draggedClip && initialClipPosition && draggedOverTrackId && 
        draggedOverTrackId !== initialClipPosition.trackId && onMoveClipBetweenTracks) {
      // Clip was moved to a different track
      onMoveClipBetweenTracks(draggedClip, draggedOverTrackId);
    } else if (draggedClip && initialClipPosition && onSaveState) {
      // Regular position change on same track
      const currentClip = tracks.flatMap(t => t.clips).find(c => c.id === draggedClip);
      if (currentClip && Math.abs(currentClip.startTime - initialClipPosition.startTime) > 0.01) {
        // Position changed significantly, save the previous state for undo
        onSaveState(tracks, 'Move clip');
      }
    }
    
    setDraggedClip(null);
    setDragOffset({ x: 0, y: 0 });
    setInitialClipPosition(null);
    setDraggedOverTrackId(null);
    setFadeEditMode(null);
    setIsDraggingFade(false);
    
    // End region selection
    if (isSelecting && currentTool === 'cut') {
      setIsSelecting(false);
      setSelectionTrackId(null);
    }
  };

  const handleTrackMouseDown = (e: React.MouseEvent, trackId: string) => {
    if (currentTool !== 'cut') return;
    
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickTime = clickX / pixelsPerSecond;
    
    setIsSelecting(true);
    setSelectionStartX(clickX);
    setSelectionTrackId(trackId);
    
    if (onSelectionChange) {
      onSelectionChange(clickTime, null, trackId);
    }
  };

  const handleTrackMouseMove = (e: React.MouseEvent) => {
    if (isSelecting && currentTool === 'cut' && selectionTrackId) {
      const rect = e.currentTarget.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentTime = currentX / pixelsPerSecond;
      const startTime = selectionStartX / pixelsPerSecond;
      
      const start = Math.min(startTime, currentTime);
      const end = Math.max(startTime, currentTime);
      
      if (onSelectionChange) {
        onSelectionChange(start, end, selectionTrackId);
      }
    }
  };

  const handleTrackMouseUp = (e: React.MouseEvent) => {
    if (isSelecting && currentTool === 'cut' && selectionTrackId) {
      const rect = e.currentTarget.getBoundingClientRect();
      const endX = e.clientX - rect.left;
      const endTime = endX / pixelsPerSecond;
      const startTime = selectionStartX / pixelsPerSecond;
      
      const start = Math.min(startTime, endTime);
      const end = Math.max(startTime, endTime);
      
      // Only cut if there's a meaningful selection (at least 0.1 seconds)
      if (Math.abs(end - start) > 0.1 && onCutRegion) {
        onCutRegion(selectionTrackId, start, end);
      }
      
      setIsSelecting(false);
      setSelectionTrackId(null);
      
      if (onSelectionChange) {
        onSelectionChange(null, null, null);
      }
    }
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
            className={`h-24 border-b border-gray-700 relative flex items-center justify-center ${
              currentTool === 'cut' ? 'cut-tool-active' : 'cursor-default'
            } ${
              draggedOverTrackId === track.id && draggedClip ? 'bg-blue-500 bg-opacity-20 border-blue-400' : ''
            }`}
            onDragOver={handleTrackDragOver}
            onDrop={(e) => {
              console.log('WaveformCanvas: Drop event on track', track.id);
              onTrackDrop(e, track.id);
            }}
            onMouseDown={(e) => handleTrackMouseDown(e, track.id)}
            onMouseMove={(e) => {
              handleClipMouseMove(e);
              handleTrackMouseMove(e);
            }}
            onMouseUp={(e) => {
              handleClipMouseUp();
              handleTrackMouseUp(e);
            }}
            data-testid={`track-lane-${track.id}`}
          >
            {/* Selection overlay */}
            {currentTool === 'cut' && 
             selectedTrackId === track.id && 
             selectionStart !== null && 
             selectionEnd !== null && 
             typeof selectionStart !== 'undefined' && 
             typeof selectionEnd !== 'undefined' && (
              <div
                className="absolute top-0 bottom-0 bg-red-500 bg-opacity-30 border border-red-500 pointer-events-none z-10"
                style={{
                  left: `${selectionStart * pixelsPerSecond}px`,
                  width: `${(selectionEnd - selectionStart) * pixelsPerSecond}px`,
                }}
              />
            )}
            
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
