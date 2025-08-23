import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CloudUpload, GripVertical, Scissors, Volume2, Zap, Wand2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Track, AudioClip } from '@/types/audio';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface SidebarProps {
  tracks: Track[];
  onAddTrack: () => void;
  onAddClipToTrack: (trackId: string, clip: AudioClip) => void;
  currentTool: string;
  onToolChange: (tool: string) => void;
}

export function Sidebar({ tracks, onAddTrack, onAddClipToTrack, currentTool, onToolChange }: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: audioFiles = [] } = useQuery({
    queryKey: ['/api/audio'],
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('audio', file);
      const response = await apiRequest('POST', '/api/audio/upload', formData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/audio'] });
      toast({
        title: "Upload Complete",
        description: "Audio file has been uploaded successfully."
      });
    },
    onError: () => {
      toast({
        title: "Upload Failed",
        description: "There was an error uploading your audio file.",
        variant: "destructive"
      });
    }
  });

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    
    Array.from(files).forEach(file => {
      if (file.type.startsWith('audio/')) {
        uploadMutation.mutate(file);
      } else {
        toast({
          title: "Invalid File",
          description: "Please select an audio file (MP3, WAV, FLAC, M4A).",
          variant: "destructive"
        });
      }
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const tools = [
    { id: 'cut', icon: Scissors, label: 'Cut' },
    { id: 'fade', icon: Volume2, label: 'Fade' },
    { id: 'volume', icon: Volume2, label: 'Volume' },
    { id: 'effects', icon: Wand2, label: 'Effects' }
  ];

  return (
    <aside className="w-64 panel-bg border-r border-gray-700 flex flex-col">
      {/* File Upload Area */}
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-sm font-semibold mb-3 text-gray-300">Import Audio</h3>
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-blue-500' : 'border-gray-600 hover:border-blue-500'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          data-testid="drop-zone-upload"
        >
          <CloudUpload className="w-8 h-8 text-gray-400 mb-2 mx-auto" />
          <p className="text-sm text-gray-400">Drop audio files here</p>
          <p className="text-xs text-gray-500 mt-1">MP3, WAV, FLAC, M4A</p>
          <Input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
            data-testid="input-file-upload"
          />
        </div>
      </div>
      
      {/* Audio Library */}
      <div className="flex-1 p-4 overflow-y-auto">
        <h3 className="text-sm font-semibold mb-3 text-gray-300">Audio Library</h3>
        
        {uploadMutation.isPending && (
          <div className="bg-track-bg rounded p-3 mb-2">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
              <span className="text-sm">Uploading...</span>
            </div>
          </div>
        )}
        
        {audioFiles.map((file: any) => (
          <div
            key={file.id}
            className="bg-track-bg rounded p-3 mb-2 cursor-pointer hover:bg-gray-600 transition-colors"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('audio-file', JSON.stringify(file));
            }}
            data-testid={`audio-file-${file.id}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" data-testid={`text-filename-${file.id}`}>
                  {file.name}
                </p>
                <p className="text-xs text-gray-400" data-testid={`text-duration-${file.id}`}>
                  {formatDuration(file.duration)}
                </p>
              </div>
              <GripVertical className="w-4 h-4 text-gray-500 ml-2" />
            </div>
          </div>
        ))}
        
        {audioFiles.length === 0 && !uploadMutation.isPending && (
          <p className="text-sm text-gray-500 text-center py-8">
            No audio files uploaded yet
          </p>
        )}
      </div>
      
      {/* Tools Panel */}
      <div className="p-4 border-t border-gray-700">
        <h3 className="text-sm font-semibold mb-3 text-gray-300">Tools</h3>
        <div className="grid grid-cols-2 gap-2">
          {tools.map((tool) => (
            <Button
              key={tool.id}
              variant={currentTool === tool.id ? "default" : "secondary"}
              size="sm"
              className={`h-12 flex flex-col items-center justify-center text-xs ${
                currentTool === tool.id 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-track-bg hover:bg-gray-600'
              }`}
              onClick={() => onToolChange(tool.id)}
              data-testid={`button-tool-${tool.id}`}
            >
              <tool.icon className="w-4 h-4 mb-1" />
              {tool.label}
            </Button>
          ))}
        </div>
        
        <Button
          onClick={onAddTrack}
          variant="secondary"
          className="w-full mt-4 bg-gray-700 hover:bg-gray-600"
          data-testid="button-add-track"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Track
        </Button>
      </div>
    </aside>
  );
}
