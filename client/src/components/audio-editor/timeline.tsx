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
  const timelineContainerRef = useRef<HTMLDivElement>(null);

  // Mouse cursor position tracking
  const [tracksCursorPosition, setTracksCursorPosition] = useState<number | null>(null);

  // Use zoomLevel from projectData or default to 100%
  const zoomLevel = projectData.zoomLevel || 100;

  // Calculate content-based pixels per second
  // 100% = all loaded audio content fits in available timeline width
  const calculatePixelsPerSecond = () => {
    const allClips = tracks.flatMap(track => track.clips);
    const maxContentTime = allClips.length > 0 
      ? Math.max(...allClips.map(clip => clip.startTime + clip.duration))
      : 300; // Default 5 minutes if no content
    
    // Get actual timeline area width (not the whole container)
    const timelineArea = timelineContainerRef.current?.querySelector('.flex-1.overflow-x-auto') as HTMLElement;
    const availableWidth = timelineArea?.clientWidth || 1200;
    
    // Calculate base pixels per second for 100% (content fits in view)
    const basePixelsPerSecond = (availableWidth - 100) / maxContentTime; // 100px padding
    
    return basePixelsPerSecond * (zoomLevel / 100);
  };
  
  const pixelsPerSecond = calculatePixelsPerSecond();

  // Mouse drag state for zooming
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [initialZoom, setInitialZoom] = useState(0);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);


  const updateZoom = (newZoom: number) => {
    const clampedZoom = Math.min(Math.max(newZoom, 0.01), 1500);
    onUpdateProjectData?.({ zoomLevel: clampedZoom });
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
      updateZoom(100);
      return;
    }

    // Auto-fit always sets to 100% (content fits in view)
    updateZoom(100);
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
      <div className="panel-bg border-b border-gray-700 h-8 flex items-center">
        <div className="w-48 px-4 border-r border-gray-700 h-full flex items-center">
          <span className="text-sm font-medium text-gray-300">Tracks</span>
        </div>
        <div className="flex-1 h-full bg-editor-bg"></div>
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
                onVolumeChange={(volume) => onUpdateTrack(track.id, { volume })}
                onPanChange={(pan) => onUpdateTrack(track.id, { pan })}
                onMuteToggle={() => onUpdateTrack(track.id, { muted: !track.muted })}
                onSoloToggle={() => onUpdateTrack(track.id, { solo: !track.solo })}
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
            // Calculate mouse position for cursor line
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const timeAtCursor = Math.max(0, mouseX / pixelsPerSecond);
            setTracksCursorPosition(timeAtCursor * pixelsPerSecond);
          }}
          onMouseLeave={() => {
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