import { useRef, useEffect, useState } from 'react';
import { Plus, Minus, Maximize2, Scissors } from 'lucide-react';
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
  onUpdateProjectData?: (updates: Partial<ProjectData>) => void;
  onSeekTo?: (time: number) => void;
  currentTool?: string;
  onSplitClip?: (clipId: string, splitTime: number) => void;
  onCutRegion?: (trackId: string, startTime: number, endTime: number) => void;
  selectionStart?: number | null;
  selectionEnd?: number | null;
  selectedTrackId?: string | null;
  onSelectionChange?: (start: number | null, end: number | null, trackId: string | null) => void;
  onToolChange?: (tool: string) => void;
  onAddTrack?: () => void;
}

export function Timeline({
  tracks,
  playbackState,
  projectData,
  onUpdateTrack,
  onAddClipToTrack,
  onUpdateClip,
  onDeleteClip,
  formatTime,
  onUpdateProjectData,
  onSeekTo,
  currentTool,
  onSplitClip,
  onCutRegion,
  selectionStart,
  selectionEnd,
  selectedTrackId,
  onSelectionChange,
  onToolChange,
  onAddTrack
}: TimelineProps) {
  const timelineRef = useRef<HTMLCanvasElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  
  // Use zoomLevel from projectData or default
  const zoomLevel = projectData.zoomLevel || 100;
  const pixelsPerSecond = 100 * (zoomLevel / 100);
  
  // Mouse drag state for zooming
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [initialZoom, setInitialZoom] = useState(0);

  const updateZoom = (newZoom: number) => {
    const clampedZoom = Math.min(Math.max(newZoom, 25), 800);
    onUpdateProjectData?.({ zoomLevel: clampedZoom });
  };
  
  // Handle timeline clicking for scrubbing
  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!onSeekTo || isDragging) return;
    
    const timelineElement = e.currentTarget;
    const rect = timelineElement.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const timePosition = clickX / pixelsPerSecond;
    
    // Ensure we don't seek beyond available content
    const maxTime = Math.max(0, ...tracks.flatMap(track => 
      track.clips.map(clip => clip.startTime + clip.duration)
    ));
    
    const clampedTime = Math.max(0, Math.min(timePosition, maxTime));
    onSeekTo(clampedTime);
  };

  const handleZoomIn = () => {
    updateZoom(zoomLevel * 1.5);
  };

  const handleZoomOut = () => {
    updateZoom(zoomLevel / 1.5);
  };
  
  const handleAutoFit = () => {
    // Find all clips from all tracks
    const allClips = tracks.flatMap(track => track.clips);
    if (allClips.length === 0) {
      updateZoom(100);
      return;
    }
    
    // Find the furthest end time across all tracks
    const maxEndTime = Math.max(...allClips.map(clip => clip.startTime + clip.duration));
    const containerWidth = timelineContainerRef.current?.clientWidth || 800;
    
    // Calculate available width (subtract sidebar width and margins)
    const availableWidth = containerWidth - 250; // 250px for sidebar and margins
    
    // Calculate target pixels per second to fit all content
    const targetPixelsPerSecond = availableWidth / maxEndTime;
    
    // Convert to zoom percentage (100 pixels per second = 100% zoom)
    const newZoom = Math.max(25, Math.min(800, targetPixelsPerSecond));
    updateZoom(newZoom);
  };
  
  // Mouse drag zoom handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.shiftKey) { // Only start drag zoom when Shift is held
      setIsDragging(true);
      setDragStartX(e.clientX);
      setInitialZoom(zoomLevel);
      e.preventDefault();
    }
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && e.shiftKey) {
      const deltaX = e.clientX - dragStartX;
      const sensitivity = 0.01; // Adjust sensitivity
      const zoomMultiplier = 1 + (deltaX * sensitivity);
      const newZoom = initialZoom * zoomMultiplier;
      updateZoom(newZoom);
    }
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  // Add global mouse up listener when dragging
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => setIsDragging(false);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging]);

  const handleTrackDrop = (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    
    try {
      const audioFileData = e.dataTransfer.getData('audio-file');
      if (!audioFileData) {
        console.log('Timeline: No audio-file data in drop');
        return;
      }
      
      const audioFile = JSON.parse(audioFileData);
      console.log('Timeline: Parsed audio file data', audioFile);
      
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
      
      console.log('Timeline: Adding clip to track', { 
        trackId, 
        clipName: newClip.name, 
        startTime, 
        audioFileId: audioFile.id,
        clipId: newClip.id
      });
      
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
    
    // Calculate appropriate time interval based on zoom level
    let timeInterval = 1;
    if (pixelsPerSecond > 200) timeInterval = 0.5; // Every 0.5s when zoomed in
    else if (pixelsPerSecond > 100) timeInterval = 1; // Every 1s at normal zoom
    else if (pixelsPerSecond > 50) timeInterval = 2; // Every 2s when zoomed out
    else if (pixelsPerSecond > 25) timeInterval = 5; // Every 5s when very zoomed out
    else timeInterval = 10; // Every 10s when extremely zoomed out
    
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
    <main 
      className="flex-1 flex flex-col bg-editor-bg"
      ref={timelineContainerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ cursor: isDragging ? 'ew-resize' : 'default' }}
    >
      {/* Zoom Controls */}
      <div className="flex items-center justify-between p-2 border-b border-gray-700">
        <div className="flex items-center space-x-4">
          {/* Zoom Controls */}
          <div className="flex items-center space-x-2">
            <Button
              onClick={handleZoomOut}
              variant="outline"
              size="sm"
              className="text-gray-300 border-gray-600 hover:bg-gray-700"
              title="Zoom Out"
            >
              <Minus className="w-4 h-4" />
            </Button>
            <span className="text-sm text-gray-300 min-w-[60px] text-center">
              {Math.round(zoomLevel)}%
            </span>
            <Button
              onClick={handleZoomIn}
              variant="outline"
              size="sm"
              className="text-gray-300 border-gray-600 hover:bg-gray-700"
              title="Zoom In"
            >
              <Plus className="w-4 h-4" />
            </Button>
            <Button
              onClick={handleAutoFit}
              variant="outline"
              size="sm"
              className="text-gray-300 border-gray-600 hover:bg-gray-700"
              title="Auto-fit to content"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>

          {/* Tools */}
          <div className="flex items-center space-x-2 border-l border-gray-600 pl-4">
            <Button
              onClick={() => {
                // Toggle off if tool is already selected
                if (currentTool === 'cut') {
                  onToolChange?.('select');
                } else {
                  onToolChange?.('cut');
                }
              }}
              variant={currentTool === 'cut' ? "default" : "outline"}
              size="sm"
              className={`${
                currentTool === 'cut' 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'text-gray-300 border-gray-600 hover:bg-gray-700'
              }`}
              title="Cut Tool - Click clips to split or drag to select region"
              data-testid="button-tool-cut"
            >
              <Scissors className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="text-xs text-gray-400">
          Shift + drag to zoom
        </div>
      </div>
      
      {/* Timeline Header */}
      <div className="panel-bg border-b border-gray-700 h-12 flex items-center">
        <div className="w-48 px-4 border-r border-gray-700 h-full flex items-center">
          <span className="text-sm font-medium text-gray-300">Tracks</span>
        </div>
        
        {/* Timeline Ruler */}
        <div className="flex-1 relative h-full">
          <canvas
            ref={timelineRef}
            className="w-full h-full cursor-pointer"
            width={800}
            height={48}
            onClick={handleTimelineClick}
            data-testid="canvas-timeline-ruler"
            title="Click to seek to position"
          />
          
          {/* Playhead */}
          <div
            className="absolute top-0 w-0.5 bg-blue-500 z-10 pointer-events-none"
            style={{ 
              left: `${playheadPosition}px`,
              height: '100vh' // Full viewport height to go through all tracks
            }}
            data-testid="playhead"
          >
            <div className="w-3 h-3 bg-blue-500 transform -translate-x-1/2 -translate-y-1/2 absolute top-1/2"></div>
          </div>
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
          
          {/* Add Track Button */}
          {onAddTrack && (
            <div className="h-24 flex items-center justify-center border-b border-gray-700">
              <Button
                onClick={onAddTrack}
                variant="secondary"
                size="sm"
                className="bg-gray-700 hover:bg-gray-600 text-gray-300"
                data-testid="button-add-track"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Track
              </Button>
            </div>
          )}
        </div>

        {/* Waveform/Timeline Area */}
        <div className={`flex-1 overflow-x-auto overflow-y-auto relative bg-editor-bg ${
          currentTool === 'cut' ? 'cut-tool-active' : 'cursor-default'
        }`}>
          <div className="min-w-max" style={{ width: Math.max(1200, (playbackState.totalDuration || 60) * pixelsPerSecond + 200) }}>
            <WaveformCanvas
              tracks={tracks}
              pixelsPerSecond={pixelsPerSecond}
              playheadPosition={playheadPosition}
              onTrackDrop={handleTrackDrop}
              onUpdateClip={onUpdateClip}
              onDeleteClip={onDeleteClip}
              currentTool={currentTool}
              onSplitClip={onSplitClip}
              onCutRegion={onCutRegion}
              selectionStart={selectionStart}
              selectionEnd={selectionEnd}
              selectedTrackId={selectedTrackId}
              onSelectionChange={onSelectionChange}
              data-testid="waveform-canvas"
            />
          </div>
          
          {/* Zoom Hint */}
          {isDragging && (
            <div className="absolute bottom-4 right-4 bg-black bg-opacity-70 text-white px-3 py-2 rounded text-sm">
              Przeciągnij w prawo aby przybliżyć, w lewo aby oddalić
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
