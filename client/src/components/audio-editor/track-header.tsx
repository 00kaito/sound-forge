import { Volume2, VolumeX, Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Track } from '@/types/audio';

interface TrackHeaderProps {
  track: Track;
  onUpdate: (updates: Partial<Track>) => void;
  isLoading?: boolean;
}

export function TrackHeader({ track, onUpdate, isLoading = false }: TrackHeaderProps) {
  const handleVolumeChange = (value: number[]) => {
    onUpdate({ volume: value[0] / 100 });
  };

  const handlePanChange = (value: number[]) => {
    onUpdate({ pan: value[0] / 100 });
  };

  const toggleMute = () => {
    onUpdate({ muted: !track.muted });
  };

  const toggleSolo = () => {
    onUpdate({ solo: !track.solo });
  };

  const formatPan = (pan: number): string => {
    if (pan === 0) return 'C';
    if (pan < 0) return `L${Math.abs(Math.round(pan * 100))}`;
    return `R${Math.round(pan * 100)}`;
  };

  return (
    <div className="h-24 border-b border-gray-700 p-3 flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium truncate" data-testid={`text-track-name-${track.id}`}>
          {track.name}
        </span>
        <div className="flex space-x-1">
          {isLoading && (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent mr-2" />
          )}
          <Button
            variant="secondary"
            size="sm"
            className={`w-5 h-5 p-0 text-xs ${
              track.muted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-blue-600'
            }`}
            onClick={toggleMute}
            data-testid={`button-mute-${track.id}`}
          >
            <VolumeX className="w-3 h-3" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className={`w-5 h-5 p-0 text-xs ${
              track.solo ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-gray-700 hover:bg-yellow-600'
            }`}
            onClick={toggleSolo}
            data-testid={`button-solo-${track.id}`}
          >
            <Headphones className="w-3 h-3" />
          </Button>
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
