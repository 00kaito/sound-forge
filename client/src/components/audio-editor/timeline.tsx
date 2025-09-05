import { useRef, useEffect, useState } from 'react';
import { Plus, Minus, Maximize2, Scissors, FileText, Sparkles, Mic } from 'lucide-react';
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
  loadingTracks?: Set<string>;
  onImportTranscript?: () => void;
  onAddEffects?: () => void;
  onTTSImport?: () => void;
  isTTSGenerating?: boolean;
  ttsProgress?: { completed: number; total: number };
  getAudioBuffer?: (audioFileId: string) => AudioBuffer | undefined;
  onTrackDelete?: (trackId: string) => void;
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
  onSaveState,
  loadingTracks,
  onImportTranscript,
  onAddEffects,
  onTTSImport,
  isTTSGenerating = false,
  ttsProgress = { completed: 0, total: 0 },
  getAudioBuffer,
  onTrackDelete
}: TimelineProps) {
  const timelineRef = useRef<HTMLCanvasElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);

  // Mouse cursor position tracking
  const [mousePosition, setMousePosition] = useState<number | null>(null);
  const [tracksCursorPosition, setTracksCursorPosition] = useState<number | null>(null);

  // Use zoomLevel from projectData or default to 25%
  const zoomLevel = projectData.zoomLevel || 25;

  // Calculate pixels per second based on new scale: 100% = 5 minutes visible
  // If screen is ~1600px wide, then 100% should show 300s (5min)
  // So base rate = 1600/300 ≈ 5.33 pixels per second at 100%
  const basePixelsPerSecond = 5.33; // This makes 100% = ~5min on typical screen
  const pixelsPerSecond = basePixelsPerSecond * (zoomLevel / 100);

  // Mouse drag state for zooming
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [initialZoom, setInitialZoom] = useState(0);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);


  const updateZoom = (newZoom: number) => {
    const clampedZoom = Math.min(Math.max(newZoom, 0.01), 1500);
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

      // Calculate maximum zoom where content still fits
      const maxPixelsPerSecond = availableWidth / maxEndTime;
      const maxZoomForFit = (maxPixelsPerSecond / basePixelsPerSecond) * 100;
      const targetZoom = Math.min(1500, maxZoomForFit * 0.9); // 90% of max to leave some padding

      // Only zoom in if it would be significantly higher than current
      if (targetZoom > zoomLevel * 1.2) {
        updateZoom(targetZoom);
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

    const newZoom = Math.max(minZoom, Math.min(1500, calculatedZoom));
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


  // Scroll wheel zoom handler with passive event safety
  const handleWheel = (e: React.WheelEvent) => {
    if (e.shiftKey) {
      try {
        e.preventDefault();
      } catch (error) {
        // Ignore passive event listener errors
      }

      // Determine zoom direction based on wheel delta
      const zoomDirection = e.deltaY > 0 ? -1 : 1;
      const zoomFactor = 1.1; // 10% zoom per scroll step

      const newZoom = zoomDirection > 0 
        ? zoomLevel * zoomFactor 
        : zoomLevel / zoomFactor;

      // Limit zoom to safer range to avoid passive event issues
      const clampedZoom = Math.max(0.01, Math.min(1500, newZoom));
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
        return;
      }

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

    // Draw time markers with improved scaling
    ctx.fillStyle = '#ffffff';

    // Calculate appropriate time interval and font size based on zoom level
    // Adjusted for new scale where 100% = 5min visible
    let timeInterval = 1;
    let fontSize = 10;
    let minSpacing = 80; // Minimum pixels between labels to avoid overlap

    if (pixelsPerSecond > 20) {
      timeInterval = 5; // Every 5s when very zoomed in
      fontSize = 10;
      minSpacing = 60;
    } else if (pixelsPerSecond > 10) {
      timeInterval = 10; // Every 10s when zoomed in
      fontSize = 10;
      minSpacing = 70;
    } else if (pixelsPerSecond > 5) {
      timeInterval = 30; // Every 30s at normal zoom
      fontSize = 10;
      minSpacing = 80;
    } else if (pixelsPerSecond > 2) {
      timeInterval = 60; // Every 1min when zoomed out
      fontSize = 10;
      minSpacing = 90;
    } else if (pixelsPerSecond > 1) {
      timeInterval = 120; // Every 2min when very zoomed out
      fontSize = 10;
      minSpacing = 100;
    } else if (pixelsPerSecond > 0.5) {
      timeInterval = 300; // Every 5min when extremely zoomed out
      fontSize = 10;
      minSpacing = 120;
    } else if (pixelsPerSecond > 0.2) {
      timeInterval = 600; // Every 10min when ultra zoomed out
      fontSize = 9;
      minSpacing = 150;
    } else if (pixelsPerSecond > 0.1) {
      timeInterval = 900; // Every 15min for very long audio
      fontSize = 9;
      minSpacing = 180;
    } else {
      timeInterval = 1800; // Every 30min for 3+ hour audio
      fontSize = 9;
      minSpacing = 200;
    }

    ctx.font = `${fontSize}px Inter`;

    let lastLabelX = -minSpacing; // Track last label position to prevent overlap

    // Calculate actual audio duration from all clips
    const allClips = tracks.flatMap(track => track.clips);
    const maxAudioTime = allClips.length > 0 
      ? Math.max(...allClips.map(clip => clip.startTime + clip.duration))
      : 60; // Default 60s if no clips

    // Use actual audio duration instead of canvas width
    const maxTimeToRender = Math.max(maxAudioTime, width / pixelsPerSecond);

    for (let time = 0; time < maxTimeToRender; time += timeInterval) {
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
  }, [pixelsPerSecond, formatTime, tracks]);

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
      <div className="flex items-center justify-between p-3 border-b border-gray-700/50 bg-gradient-to-r from-slate-900/30 to-slate-800/30 backdrop-blur-sm">
        <div className="flex items-center space-x-4">
          {/* Zoom Controls */}
          <div className="flex items-center space-x-2">
            <Button
              onClick={handleZoomOut}
              variant="outline"
              size="sm"
              className="text-white bg-gradient-to-r from-slate-700/80 to-slate-600/80 border-slate-500/60 hover:from-slate-600/90 hover:to-slate-500/90 hover:border-slate-400/70 backdrop-blur-sm shadow-lg"
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
              className="text-white bg-gradient-to-r from-slate-700/80 to-slate-600/80 border-slate-500/60 hover:from-slate-600/90 hover:to-slate-500/90 hover:border-slate-400/70 backdrop-blur-sm shadow-lg"
              title="Zoom In"
            >
              <Plus className="w-4 h-4" />
            </Button>
            <Button
              onClick={handleAutoFit}
              variant="outline"
              size="sm"
              className="text-white bg-gradient-to-r from-slate-700/80 to-slate-600/80 border-slate-500/60 hover:from-slate-600/90 hover:to-slate-500/90 hover:border-slate-400/70 backdrop-blur-sm shadow-lg"
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
                  ? 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-400 hover:to-pink-400 text-white border-2 border-red-400/60 hover:border-red-300/80 shadow-lg' 
                  : 'text-white bg-gradient-to-r from-slate-700/80 to-slate-600/80 border-slate-500/60 hover:from-slate-600/90 hover:to-slate-500/90 hover:border-slate-400/70 backdrop-blur-sm shadow-lg'
              }`}
              title="Cut Tool - Click clips to split or drag to select region"
              data-testid="button-tool-cut"
            >
              <Scissors className="w-4 h-4" />
            </Button>

            <Button
              onClick={onImportTranscript}
              variant="outline"
              size="sm"
              className="text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 border border-emerald-400/60 hover:border-emerald-300/80 backdrop-blur-sm shadow-lg transition-all duration-200 hover:scale-105"
              title="Import Transcript - Import SRT subtitles for timeline navigation"
              data-testid="button-tool-transcript"
            >
              <FileText className="w-4 h-4" />
            </Button>

            <Button
              onClick={onAddEffects}
              variant="outline"
              size="sm"
              className="text-white bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 border border-purple-400/60 hover:border-purple-300/80 backdrop-blur-sm shadow-lg transition-all duration-200 hover:scale-105"
              title="Add Effects - Add sound effects to timeline"
              data-testid="button-tool-effects"
            >
              <Sparkles className="w-4 h-4" />
            </Button>

            <Button
              onClick={onTTSImport}
              variant="outline"
              size="sm"
              disabled={isTTSGenerating}
              className="text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 border border-orange-400/60 hover:border-orange-300/80 backdrop-blur-sm shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              title="TTS Import - Generate audio from text using AI voices"
              data-testid="button-tool-tts"
            >
              <Mic className="w-4 h-4" />
              {isTTSGenerating && (
                <span className="ml-1 text-xs">{ttsProgress.completed}/{ttsProgress.total}</span>
              )}
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
            onMouseMove={(e) => {
              // Calculate time position for timeline ruler
              const rect = e.currentTarget.getBoundingClientRect();
              const mouseX = e.clientX - rect.left;
              const timeAtCursor = Math.max(0, mouseX / pixelsPerSecond);
              setMousePosition(timeAtCursor);

              // Update tracks cursor position based on audio time
              setTracksCursorPosition(timeAtCursor * pixelsPerSecond);
            }}
            onMouseLeave={() => {
              setMousePosition(null);
              setTracksCursorPosition(null);
            }}
            data-testid="canvas-timeline-ruler"
            title="Click to seek to position"
          />

          {/* Cursor Time Display - positioned on timeline ruler */}
          {mousePosition !== null && (
            <div className="absolute top-1 left-2 bg-gray-900 text-white px-2 py-1 rounded text-xs font-mono border border-gray-500 pointer-events-none z-20 shadow-lg">
              {formatTime(mousePosition)}
            </div>
          )}

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
                isSelected={selectedTrack === track.id}
                onSelect={() => setSelectedTrack(track.id)}
                onVolumeChange={(volume) => onTrackVolumeChange?.(track.id, volume)}
                onPanChange={(pan) => onTrackPanChange?.(track.id, pan)}
                onMuteToggle={() => onTrackMuteToggle?.(track.id)}
                onSoloToggle={() => onTrackSoloToggle?.(track.id)}
                onDelete={tracks.length > 1 ? () => onTrackDelete?.(track.id) : undefined}
              />
          ))}

          {/* Add Track Button */}
          {onAddTrack && (
            <div className="h-24 flex items-center justify-center border-b border-gray-700">
              <Button
                onClick={onAddTrack}
                variant="secondary"
                size="sm"
                className="bg-gradient-to-r from-slate-700/80 to-slate-600/80 hover:from-slate-600/90 hover:to-slate-500/90 text-white border border-slate-500/60 hover:border-slate-400/70 backdrop-blur-sm shadow-lg"
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
          onMouseMove={(e) => {
            // Calculate mouse position once and use for both systems
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const timeAtCursor = Math.max(0, mouseX / pixelsPerSecond);

            // Update time position (used for tooltip and cursor line calculation)
            setMousePosition(timeAtCursor);
            // Cursor line position will be calculated from time, not pixels
            setTracksCursorPosition(timeAtCursor * pixelsPerSecond);
          }}
          onMouseLeave={() => {
            setMousePosition(null);
            setTracksCursorPosition(null);
          }}
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
              zoomLevel={zoomLevel}
              getAudioBuffer={getAudioBuffer}
              data-testid="waveform-canvas"
            />
          </div>

          {/* Playhead - shows current playback position */}
          <div
            className="absolute top-0 w-0.5 bg-blue-500 z-50 pointer-events-none"
            style={{ 
              left: `${playheadPosition}px`,
              height: '100%'
            }}
            data-testid="playhead"
          >
            <div className="w-3 h-3 bg-blue-500 rounded-full transform -translate-x-1/2 absolute top-2"></div>
          </div>

          {/* Cursor Line - follows mouse across all tracks */}
          {tracksCursorPosition !== null && (
            <div
              className="absolute top-0 w-0.5 bg-yellow-300 opacity-60 pointer-events-none z-30"
              style={{ 
                left: `${tracksCursorPosition}px`,
                height: '100%'
              }}
              data-testid="cursor-line"
            />
          )}


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