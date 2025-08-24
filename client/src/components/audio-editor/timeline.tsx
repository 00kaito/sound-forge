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
  onMoveClipBetweenTracks?: (clipId: string, targetTrackId: string) => void;
  onSaveState?: (tracks: any[], action: string) => void;
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
  onAddTrack,
  onMoveClipBetweenTracks,
  onSaveState
}: TimelineProps) {
  const timelineRef = useRef<HTMLCanvasElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  
  // Mouse cursor position tracking
  const [mousePosition, setMousePosition] = useState<number | null>(null);
  
  // Use zoomLevel from projectData or default to 25%
  const zoomLevel = projectData.zoomLevel || 25;
  
  // Calculate pixels per second based on new scale: 100% = 30 minutes visible
  // If screen is ~1600px wide, then 100% should show 1800s (30min)
  // So base rate = 1600/1800 ≈ 0.89 pixels per second at 100%
  const basePixelsPerSecond = 0.89; // This makes 100% = ~30min on typical screen
  const pixelsPerSecond = basePixelsPerSecond * (zoomLevel / 100);
  
  // Mouse drag state for zooming
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [initialZoom, setInitialZoom] = useState(0);

  const updateZoom = (newZoom: number) => {
    const clampedZoom = Math.min(Math.max(newZoom, 0.01), 800);
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
    const newZoom = zoomLevel / 1.5;
    // Allow zoom out down to 0.01%
    updateZoom(Math.max(0.01, newZoom));
  };
  
  const handleAutoFit = (e?: React.MouseEvent) => {
    // Prevent event propagation to avoid interfering with mouse handlers
    e?.preventDefault();
    e?.stopPropagation();
    
    // Find all clips from all tracks
    const allClips = tracks.flatMap(track => track.clips);
    if (allClips.length === 0) {
      updateZoom(25);
      return;
    }
    
    // Find the furthest end time across all tracks
    const maxEndTime = Math.max(...allClips.map(clip => clip.startTime + clip.duration));
    
    // Get the actual timeline area width (not the whole container)
    const timelineArea = timelineContainerRef.current?.querySelector('.flex-1.overflow-x-auto') as HTMLElement;
    const availableWidth = timelineArea?.clientWidth || 800;
    
    // Check if content already fits at current zoom level
    const currentContentWidth = maxEndTime * pixelsPerSecond;
    const contentFitsOnScreen = currentContentWidth <= availableWidth;
    
    if (contentFitsOnScreen) {
      // Content already fits, don't zoom out - try to zoom in instead
      console.log('Auto-fit: Content already fits, attempting to zoom in');
      
      // Calculate maximum zoom where content still fits
      const maxPixelsPerSecond = availableWidth / maxEndTime;
      const maxZoomForFit = (maxPixelsPerSecond / basePixelsPerSecond) * 100;
      const targetZoom = Math.min(800, maxZoomForFit * 0.9); // 90% of max to leave some padding
      
      // Only zoom in if it would be significantly higher than current
      if (targetZoom > zoomLevel * 1.2) {
        updateZoom(targetZoom);
        console.log('Auto-fit: Zoomed in to', targetZoom);
      } else {
        console.log('Auto-fit: Current zoom is already optimal');
      }
      return;
    }
    
    // Content doesn't fit, calculate optimal zoom to fit
    const paddedWidth = availableWidth - 100; // 100px padding
    const targetPixelsPerSecond = paddedWidth / maxEndTime;
    
    // Convert to zoom percentage using new base scale
    const calculatedZoom = (targetPixelsPerSecond / basePixelsPerSecond) * 100;
    
    // For very long audio, allow extremely low zoom to fit everything
    let minZoom = 10; // Default minimum
    if (maxEndTime > 1800) minZoom = 0.5; // 30+ min: 0.5%
    if (maxEndTime > 3600) minZoom = 0.2; // 1+ hour: 0.2%  
    if (maxEndTime > 7200) minZoom = 0.1; // 2+ hours: 0.1%
    if (maxEndTime > 10800) minZoom = 0.05; // 3+ hours: 0.05%
    
    const newZoom = Math.max(minZoom, Math.min(800, calculatedZoom));
    updateZoom(newZoom);
    console.log('Auto-fit: Content too wide, zoomed out to', newZoom);
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

  const handleTimelineMouseMove = (e: React.MouseEvent) => {
    // Track mouse position for cursor time display
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const timeAtCursor = Math.max(0, mouseX / pixelsPerSecond);
    setMousePosition(timeAtCursor);
  };

  const handleTimelineMouseLeave = () => {
    setMousePosition(null);
  };

  // Scroll wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    if (e.shiftKey) {
      e.preventDefault();
      
      // Determine zoom direction based on wheel delta
      const zoomDirection = e.deltaY > 0 ? -1 : 1;
      const zoomFactor = 1.1; // 10% zoom per scroll step
      
      const newZoom = zoomDirection > 0 
        ? zoomLevel * zoomFactor 
        : zoomLevel / zoomFactor;
      
      // Clamp zoom between 0.01% and 800% for very long audio support
      const clampedZoom = Math.max(0.01, Math.min(800, newZoom));
      updateZoom(clampedZoom);
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
    
    // Draw time markers with improved scaling
    ctx.fillStyle = '#ffffff';
    
    // Calculate appropriate time interval and font size based on zoom level
    // Adjusted for new scale where 100% = 30min visible
    let timeInterval = 1;
    let fontSize = 10;
    let minSpacing = 80; // Minimum pixels between labels to avoid overlap
    
    if (pixelsPerSecond > 4) {
      timeInterval = 30; // Every 30s when zoomed in (new scale)
      fontSize = 10;
      minSpacing = 70;
    } else if (pixelsPerSecond > 2) {
      timeInterval = 60; // Every 1min at normal zoom
      fontSize = 10;
      minSpacing = 80;
    } else if (pixelsPerSecond > 1) {
      timeInterval = 120; // Every 2min when zoomed out
      fontSize = 10;
      minSpacing = 90;
    } else if (pixelsPerSecond > 0.5) {
      timeInterval = 300; // Every 5min when very zoomed out
      fontSize = 10;
      minSpacing = 100;
    } else if (pixelsPerSecond > 0.2) {
      timeInterval = 600; // Every 10min when extremely zoomed out
      fontSize = 10;
      minSpacing = 120;
    } else if (pixelsPerSecond > 0.1) {
      timeInterval = 900; // Every 15min when ultra zoomed out
      fontSize = 9;
      minSpacing = 150;
    } else if (pixelsPerSecond > 0.05) {
      timeInterval = 1800; // Every 30min for very long audio
      fontSize = 9;
      minSpacing = 180;
    } else {
      timeInterval = 3600; // Every 1 hour for 3+ hour audio
      fontSize = 9;
      minSpacing = 200;
    }
    
    ctx.font = `${fontSize}px Inter`;
    
    let lastLabelX = -minSpacing; // Track last label position to prevent overlap
    
    for (let time = 0; time < width / pixelsPerSecond; time += timeInterval) {
      const x = time * pixelsPerSecond;
      
      // Draw tick mark
      ctx.fillRect(x, height - 10, 1, 10);
      
      // Draw time label only if there's enough space
      if (x > 20 && x - lastLabelX >= minSpacing) {
        const timeText = formatTime(time);
        const textWidth = ctx.measureText(timeText).width;
        
        // Only draw if it fits without overlap
        if (x + textWidth + 4 < width) {
          ctx.fillText(timeText, x + 2, height - 15);
          lastLabelX = x;
        }
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
              {zoomLevel < 1 ? zoomLevel.toFixed(2) : Math.round(zoomLevel)}%
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
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
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
          Shift + drag/scroll to zoom
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
            onMouseMove={handleTimelineMouseMove}
            onMouseLeave={handleTimelineMouseLeave}
            data-testid="canvas-timeline-ruler"
            title="Click to seek to position"
          />
          
          {/* Cursor Time Display - positioned on timeline ruler */}
          {mousePosition !== null && (
            <div className="absolute top-1 left-2 bg-gray-900 text-white px-2 py-1 rounded text-xs font-mono border border-gray-500 pointer-events-none z-20 shadow-lg">
              {formatTime(mousePosition)}
            </div>
          )}
          
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
        <div 
          className={`flex-1 overflow-x-auto overflow-y-auto relative bg-editor-bg ${
            currentTool === 'cut' ? 'cut-tool-active' : 'cursor-default'
          }`}
          onMouseMove={handleTimelineMouseMove}
          onMouseLeave={handleTimelineMouseLeave}
          onWheel={handleWheel}
        >
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
              onMoveClipBetweenTracks={onMoveClipBetweenTracks}
              onSaveState={onSaveState}
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
