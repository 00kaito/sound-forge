import { Button } from '@/components/ui/button';
import { Activity, BarChart3 } from 'lucide-react';

interface ViewModeToggleProps {
  mode: 'waveform' | 'spectrogram';
  onModeChange: (mode: 'waveform' | 'spectrogram') => void;
  className?: string;
}

export function ViewModeToggle({ mode, onModeChange, className = '' }: ViewModeToggleProps) {
  return (
    <div className={`flex items-center space-x-1 bg-gray-800/80 rounded-lg p-1 backdrop-blur-sm border border-gray-600/50 ${className}`}>
      <Button
        onClick={() => onModeChange('waveform')}
        variant="ghost"
        size="sm"
        className={`px-2 py-1 h-7 transition-all duration-200 ${
          mode === 'waveform'
            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md'
            : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
        }`}
        title="Waveform View - Shows amplitude over time"
        data-testid="button-view-waveform"
      >
        <Activity className="w-3 h-3 mr-1" />
        <span className="text-xs">Wave</span>
      </Button>
      
      <Button
        onClick={() => onModeChange('spectrogram')}
        variant="ghost"
        size="sm"
        className={`px-2 py-1 h-7 transition-all duration-200 ${
          mode === 'spectrogram'
            ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-md'
            : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
        }`}
        title="Spectrogram View - Shows frequency analysis over time"
        data-testid="button-view-spectrogram"
      >
        <BarChart3 className="w-3 h-3 mr-1" />
        <span className="text-xs">Spec</span>
      </Button>
    </div>
  );
}