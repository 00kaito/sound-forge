import { useRef, useEffect, useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TrackHeader } from '@/components/audio-editor/track-header';
import { WaveformCanvas } from '@/components/audio-editor/waveform-canvas';
import { Track, PlaybackState, ProjectData, AudioClip } from '@/types/audio';

interface TimelineProps {
  tracks: Track[];
  playbackState: PlaybackState;
  projectData: ProjectData;
  onUpdateTrack: (trackId: string, updates: Partial<Track>) => void;
  onAddClipToTrack: (trackId: string, clip: AudioClip) => void;
  onUpdateClip: (clipId: string, updates: Partial<AudioClip>) => void;
  onDeleteClip: (clipId: string) => void;
  formatTime: (seconds: number) => string;
}

export function Timeline({
  tracks,
  playbackState,
  projectData,
  onUpdateTrack,
  onAddClipToTrack,
  onUpdateClip,
  onDeleteClip,
  formatTime
}: TimelineProps) {
  const timelineRef = useRef<HTMLCanvasElement>(null);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(100);

  useEffect(() => {
    setPixelsPerSecond(100 * (zoomLevel / 100));
  }, [zoomLevel]);

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev * 1.5, 800));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev / 1.5, 25));
  };

  const handleTrackDrop = (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    
    try {
      const audioFileData = e.dataTransfer.getData('audio-file');
      if (!audioFileData) return;
      
      const audioFile = JSON.parse(audioFileData);
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const startTime = Math.max(0, x / pixelsPerSecond);
      
      const newClip: AudioClip = {
        id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        audioFileId: audioFile.id,
        trackId,
        startTime,
        duration: audioFile.duration,
        offset: 0,
        volume: 1,
        fadeIn: 0,
        fadeOut: 0,
        name: audioFile.name
      };
      
      // Add clip to track via dedicated callback
      onAddClipToTrack(trackId, newClip);
    } catch (error) {
      console.error('Error handling drop:', error);
    }
  };

  const renderTimelineRuler = () => {
    if (!timelineRef.current) return;
    
    const canvas = timelineRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.fillStyle = '#2d2d30';
    ctx.fillRect(0, 0, width, height);
    
    // Draw time markers
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Inter';
    
    const timeInterval = Math.max(1, Math.floor(100 / pixelsPerSecond)); // At least 1 second between markers
    
    for (let time = 0; time < width / pixelsPerSecond; time += timeInterval) {
      const x = time * pixelsPerSecond;
      
      // Draw tick mark
      ctx.fillRect(x, height - 10, 1, 10);
      
      // Draw time label
      if (x > 20) { // Avoid overlapping with first label
        ctx.fillText(formatTime(time), x + 2, height - 15);
      }
    }
  };

  useEffect(() => {
    renderTimelineRuler();
  }, [pixelsPerSecond, formatTime]);

  const playheadPosition = playbackState.currentTime * pixelsPerSecond;

  return (
    <main className="flex-1 flex flex-col bg-editor-bg">
      {/* Timeline Header */}
      <div className="panel-bg border-b border-gray-700 h-12 flex items-center">
        <div className="w-48 px-4 border-r border-gray-700 h-full flex items-center">
          <span className="text-sm font-medium text-gray-300">Tracks</span>
        </div>
        
        {/* Timeline Ruler */}
        <div className="flex-1 relative h-full">
          <canvas
            ref={timelineRef}
            className="w-full h-full"
            width={800}
            height={48}
            data-testid="canvas-timeline-ruler"
          />
          
          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-10 pointer-events-none"
            style={{ left: `${playheadPosition}px` }}
            data-testid="playhead"
          >
            <div className="w-3 h-3 bg-blue-500 transform -translate-x-1/2 -translate-y-1/2 absolute top-1/2"></div>
          </div>
        </div>
        
        {/* Zoom Controls */}
        <div className="w-32 px-4 border-l border-gray-700 h-full flex items-center justify-center space-x-2">
          <Button
            variant="secondary"
            size="sm"
            className="w-6 h-6 p-0 bg-gray-700 hover:bg-gray-600"
            onClick={handleZoomOut}
            data-testid="button-zoom-out"
          >
            <Minus className="w-3 h-3" />
          </Button>
          <span className="text-xs text-gray-400 font-mono w-12 text-center" data-testid="text-zoom-level">
            {Math.round(zoomLevel)}%
          </span>
          <Button
            variant="secondary"
            size="sm"
            className="w-6 h-6 p-0 bg-gray-700 hover:bg-gray-600"
            onClick={handleZoomIn}
            data-testid="button-zoom-in"
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Tracks Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track Headers */}
        <div className="w-48 panel-bg border-r border-gray-700 overflow-y-auto">
          {tracks.map((track) => (
            <TrackHeader
              key={track.id}
              track={track}
              onUpdate={(updates: Partial<Track>) => onUpdateTrack(track.id, updates)}
              data-testid={`track-header-${track.id}`}
            />
          ))}
        </div>

        {/* Waveform/Timeline Area */}
        <div className="flex-1 overflow-auto relative bg-editor-bg">
          <WaveformCanvas
            tracks={tracks}
            pixelsPerSecond={pixelsPerSecond}
            playheadPosition={playheadPosition}
            onTrackDrop={handleTrackDrop}
            onUpdateClip={onUpdateClip}
            onDeleteClip={onDeleteClip}
            data-testid="waveform-canvas"
          />
        </div>
      </div>
    </main>
  );
}
