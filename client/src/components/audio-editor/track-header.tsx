import { Volume2, VolumeX, Headphones, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Track } from '@/types/audio';

interface TrackHeaderProps {
  track: Track;
  isSelected: boolean;
  onSelect: () => void;
  onVolumeChange: (volume: number) => void;
  onPanChange: (pan: number) => void;
  onMuteToggle: () => void;
  onSoloToggle: () => void;
  onDelete?: () => void;
}

export function TrackHeader({ track, isSelected, onSelect, onVolumeChange, onPanChange, onMuteToggle, onSoloToggle, onDelete }: TrackHeaderProps) {
  const handleVolumeChange = (value: number[]) => {
    onVolumeChange(value[0] / 100);
  };

  const handlePanChange = (value: number[]) => {
    onPanChange(value[0] / 100);
  };

  const formatPan = (pan: number): string => {
    if (pan === 0) return 'C';
    if (pan < 0) return `L${Math.abs(Math.round(pan * 100))}`;
    return `R${Math.round(pan * 100)}`;
  };

  return (
    <div className={`p-3 space-y-2 border-b ${isSelected ? 'border-blue-500' : 'border-gray-700'}`} data-testid={`track-header-${track.id}`}>
      <div className="flex items-center justify-between">
        <span
          className={`text-sm font-medium truncate ${isSelected ? 'text-blue-500' : 'text-white'}`}
          onClick={onSelect}
          data-testid={`text-track-name-${track.id}`}
        >
          {track.name}
        </span>
        <div className="flex space-x-1">
          <Button
            variant="ghost"
            size="sm"
            className={`w-8 h-8 p-0 ${track.muted ? 'text-red-400' : 'text-gray-400 hover:text-white'}`}
            onClick={onMuteToggle}
            data-testid={`button-mute-${track.id}`}
          >
            {track.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`w-8 h-8 p-0 ${track.solo ? 'text-yellow-400' : 'text-gray-400 hover:text-white'}`}
            onClick={onSoloToggle}
            data-testid={`button-solo-${track.id}`}
          >
            <Headphones className="w-4 h-4" />
          </Button>
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="w-8 h-8 p-0 text-red-400 hover:text-red-200 hover:bg-red-900/20"
              onClick={onDelete}
              data-testid={`button-delete-track-${track.id}`}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <span className="text-xs text-gray-400">Vol</span>
        <Slider
          value={[track.volume * 100]}
          onValueChange={handleVolumeChange}
          max={100}
          step={1}
          className="flex-1"
          data-testid={`slider-volume-${track.id}`}
        />
        <span className="text-xs text-gray-400 font-mono w-8" data-testid={`text-volume-${track.id}`}>
          {Math.round(track.volume * 100)}%
        </span>
      </div>

      <div className="flex items-center space-x-2">
        <span className="text-xs text-gray-400">Pan</span>
        <Slider
          value={[track.pan * 100]}
          onValueChange={handlePanChange}
          min={-100}
          max={100}
          step={1}
          className="flex-1"
          data-testid={`slider-pan-${track.id}`}
        />
        <span className="text-xs text-gray-400 font-mono w-8" data-testid={`text-pan-${track.id}`}>
          {formatPan(track.pan)}
        </span>
      </div>
    </div>
  );
}