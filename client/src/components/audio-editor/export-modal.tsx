import { useState } from 'react';
import { X, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ExportSettings } from '@/types/audio';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (settings: ExportSettings) => Promise<void>;
}

export function ExportModal({ isOpen, onClose, onExport }: ExportModalProps) {
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    format: 'mp3',
    quality: 192,
    fileName: 'my-audio-project'
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setExportProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      await onExport(exportSettings);
      
      clearInterval(progressInterval);
      setExportProgress(100);
      
      // Close modal after a brief delay
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
        onClose();
      }, 1000);
    } catch (error) {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const qualityOptions = {
    mp3: [
      { value: 320, label: '320 kbps (High)' },
      { value: 192, label: '192 kbps (Standard)' },
      { value: 128, label: '128 kbps (Low)' }
    ],
    wav: [
      { value: 44100, label: '44.1 kHz / 16-bit' },
      { value: 48000, label: '48 kHz / 24-bit' }
    ],
    flac: [
      { value: 44100, label: '44.1 kHz / 16-bit' },
      { value: 48000, label: '48 kHz / 24-bit' }
    ]
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-panel-bg border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Export Audio
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white"
              data-testid="button-close-export"
            >
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Format Selection */}
          <div>
            <Label htmlFor="format" className="text-sm font-medium mb-2 block">
              Format
            </Label>
            <Select
              value={exportSettings.format}
              onValueChange={(value: any) => 
                setExportSettings(prev => ({ ...prev, format: value, quality: qualityOptions[value][0].value }))
              }
              data-testid="select-export-format"
            >
              <SelectTrigger className="bg-track-bg border-gray-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-track-bg border-gray-600">
                <SelectItem value="mp3">MP3</SelectItem>
                <SelectItem value="wav">WAV</SelectItem>
                <SelectItem value="flac">FLAC</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Quality Settings */}
          <div>
            <Label htmlFor="quality" className="text-sm font-medium mb-2 block">
              Quality
            </Label>
            <Select
              value={exportSettings.quality.toString()}
              onValueChange={(value) => 
                setExportSettings(prev => ({ ...prev, quality: parseInt(value) }))
              }
              data-testid="select-export-quality"
            >
              <SelectTrigger className="bg-track-bg border-gray-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-track-bg border-gray-600">
                {qualityOptions[exportSettings.format].map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* File Name */}
          <div>
            <Label htmlFor="fileName" className="text-sm font-medium mb-2 block">
              File Name
            </Label>
            <Input
              id="fileName"
              value={exportSettings.fileName}
              onChange={(e) => 
                setExportSettings(prev => ({ ...prev, fileName: e.target.value }))
              }
              className="bg-track-bg border-gray-600 focus:border-blue-500"
              data-testid="input-export-filename"
            />
          </div>
          
          {/* Progress Bar */}
          {isExporting && (
            <div data-testid="export-progress">
              <Progress value={exportProgress} className="h-2" />
              <p className="text-sm text-gray-400 mt-2">
                Exporting... {exportProgress}%
              </p>
            </div>
          )}
        </div>
        
        <div className="flex space-x-3 mt-6">
          <Button
            variant="secondary"
            className="flex-1 bg-gray-700 hover:bg-gray-600"
            onClick={onClose}
            disabled={isExporting}
            data-testid="button-cancel-export"
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-green-600 hover:bg-green-700"
            onClick={handleExport}
            disabled={isExporting}
            data-testid="button-start-export"
          >
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
