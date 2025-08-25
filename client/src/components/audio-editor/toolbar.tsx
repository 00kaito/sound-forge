import { Play, Pause, Square, SkipBack, Download, Settings, FolderOpen, Save, FileText, Volume2 } from 'lucide-react';
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
  onSaveProject?: () => void;
  onOpenProject?: () => void;
  onImportTranscript?: () => void;
  onAddEffects?: () => void;
}

export function Toolbar({ 
  playbackState, 
  formatTime, 
  onExport,
  onPlay,
  onPause, 
  onStop,
  onSeekToStart,
  onSaveProject,
  onOpenProject,
  onImportTranscript,
  onAddEffects
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
    <header className="panel-bg border-b border-gray-700/50 p-4 flex items-center justify-between shadow-lg rounded-t-lg">
      <div className="flex items-center space-x-4">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
          <i className="fas fa-waveform-lines mr-2 text-blue-400"></i>
          AudioForge
        </h1>
        <div className="hidden md:flex space-x-2">
          <Button
            onClick={onOpenProject}
            variant="secondary"
            size="sm"
            className="bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-white border border-slate-500/50 hover:border-slate-400/60 shadow-lg backdrop-blur-sm"
            data-testid="button-open-project"
          >
            <FolderOpen className="w-4 h-4 mr-1" />
            Open Project
          </Button>
          <Button
            onClick={onSaveProject}
            variant="secondary"
            size="sm"
            className="bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-white border border-slate-500/50 hover:border-slate-400/60 shadow-lg backdrop-blur-sm"
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
          className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white border-2 border-blue-400/60 hover:border-blue-300/80 rounded-full p-0 shadow-xl backdrop-blur-sm transition-all duration-200 hover:scale-105"
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
          className="w-8 h-8 bg-slate-600 hover:bg-slate-500 text-white border border-slate-500 hover:border-slate-400 p-0"
          data-testid="button-stop"
        >
          <Square className="w-3 h-3" />
        </Button>
        <Button
          onClick={handleGoToStart}
          variant="secondary"
          size="sm"
          className="w-8 h-8 bg-slate-600 hover:bg-slate-500 text-white border border-slate-500 hover:border-slate-400 p-0"
          data-testid="button-go-to-start"
        >
          <SkipBack className="w-3 h-3" />
        </Button>
        
        {/* Time Display */}
        <div className="bg-gradient-to-r from-gray-900/80 to-black/80 px-4 py-2 rounded-lg font-mono text-sm backdrop-blur-sm border border-gray-700/50 shadow-lg" data-testid="text-time-display">
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
          className="w-8 h-8 bg-slate-600 hover:bg-slate-500 text-white border border-slate-500 hover:border-slate-400 p-0"
          data-testid="button-settings"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
