import { Play, Pause, Square, SkipBack, Download, Settings, FolderOpen, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlaybackState } from '@/types/audio';

interface ToolbarProps {
  playbackState: PlaybackState;
  formatTime: (seconds: number) => string;
  onExport: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onSeekToStart?: () => void;
}

export function Toolbar({ 
  playbackState, 
  formatTime, 
  onExport,
  onPlay,
  onPause, 
  onStop,
  onSeekToStart
}: ToolbarProps) {
  const handlePlay = () => {
    if (playbackState.isPlaying) {
      onPause?.();
    } else {
      onPlay?.();
    }
  };

  const handleStop = () => {
    onStop?.();
  };

  const handleGoToStart = () => {
    onSeekToStart?.();
  };

  return (
    <header className="panel-bg border-b border-gray-700 p-3 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-bold text-blue-500">
          <i className="fas fa-waveform-lines mr-2"></i>
          AudioForge
        </h1>
        <div className="hidden md:flex space-x-2">
          <Button
            variant="secondary"
            size="sm"
            className="bg-gray-700 hover:bg-gray-600"
            data-testid="button-open-project"
          >
            <FolderOpen className="w-4 h-4 mr-1" />
            Open Project
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="bg-gray-700 hover:bg-gray-600"
            data-testid="button-save-project"
          >
            <Save className="w-4 h-4 mr-1" />
            Save Project
          </Button>
        </div>
      </div>
      
      {/* Transport Controls */}
      <div className="flex items-center space-x-2">
        <Button
          onClick={handlePlay}
          className="w-10 h-10 bg-blue-600 hover:bg-blue-700 rounded-full p-0"
          data-testid="button-play-pause"
        >
          {playbackState.isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </Button>
        <Button
          onClick={handleStop}
          variant="secondary"
          size="sm"
          className="w-8 h-8 bg-gray-700 hover:bg-gray-600 p-0"
          data-testid="button-stop"
        >
          <Square className="w-3 h-3" />
        </Button>
        <Button
          onClick={handleGoToStart}
          variant="secondary"
          size="sm"
          className="w-8 h-8 bg-gray-700 hover:bg-gray-600 p-0"
          data-testid="button-go-to-start"
        >
          <SkipBack className="w-3 h-3" />
        </Button>
        
        {/* Time Display */}
        <div className="bg-black px-3 py-1 rounded font-mono text-sm" data-testid="text-time-display">
          <span>{formatTime(playbackState.currentTime)}</span>
          <span className="text-gray-400 mx-1">/</span>
          <span className="text-gray-400">{formatTime(playbackState.totalDuration)}</span>
        </div>
      </div>
      
      {/* Export Controls */}
      <div className="flex items-center space-x-2">
        <Button
          onClick={onExport}
          className="bg-green-600 hover:bg-green-700"
          data-testid="button-export"
        >
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="w-8 h-8 bg-gray-700 hover:bg-gray-600 p-0"
          data-testid="button-settings"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
