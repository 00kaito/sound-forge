import { useState, useRef } from 'react';
import { CloudUpload, GripVertical, Scissors, Volume2, Zap, Wand2, Plus, X, Link2, FileAudio, FileText, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Track, AudioClip, LocalAudioFile } from '@/types/audio';
import { useToast } from '@/hooks/use-toast';
import { useLocalAudioStorage } from '@/hooks/use-local-audio-storage';

interface SidebarProps {
  tracks: Track[];
  onAddTrack: () => void;
  onAddClipToTrack: (trackId: string, clip: AudioClip) => void;
  currentTool: string;
  onToolChange: (tool: string) => void;
  audioFiles: LocalAudioFile[];
  addAudioFile: (file: File, onProgress?: (progress: number) => void) => Promise<LocalAudioFile>;
  removeAudioFile: (id: string) => void;
  concatenateFiles: (fileIds: string[], newName: string) => Promise<LocalAudioFile | null>;
  onImportTranscript?: () => void;
  onAddEffects?: () => void;
}

export function Sidebar({ tracks, onAddTrack, onAddClipToTrack, currentTool, onToolChange, audioFiles = [], addAudioFile, removeAudioFile, concatenateFiles, onImportTranscript, onAddEffects }: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [concatenateModalOpen, setConcatenateModalOpen] = useState(false);
  const [concatenateName, setConcatenateName] = useState('');
  const [loadingFile, setLoadingFile] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const { toast } = useToast();
  // Audio storage functions now passed as props

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;
    
    setIsProcessing(true);
    
    try {
      const promises = Array.from(files).map(async (file) => {
        if (file.type.startsWith('audio/')) {
          setLoadingFile(file.name);
          setLoadingProgress(0);
          
          const result = await addAudioFile(file, (progress) => {
            setLoadingProgress(progress);
          });
          
          setLoadingFile(null);
          setLoadingProgress(0);
          return result;
        } else {
          toast({
            title: "Invalid File",
            description: "Please select an audio file (MP3, WAV, FLAC, M4A).",
            variant: "destructive"
          });
          return null;
        }
      });
      
      const results = await Promise.allSettled(promises);
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
      
      if (successCount > 0) {
        toast({
          title: "Files Added",
          description: `Successfully added ${successCount} audio file${successCount > 1 ? 's' : ''} to library.`
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "There was an error processing your audio files.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      // Reset file input so same file can be re-uploaded
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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
    { 
      id: 'cut', 
      icon: Scissors, 
      label: 'Cut',
      gradient: 'from-red-500 to-pink-500 hover:from-red-400 hover:to-pink-400',
      borderColor: 'border-red-400/60 hover:border-red-300/80'
    },
    { 
      id: 'transcript', 
      icon: FileText, 
      label: 'Import Transcript',
      gradient: 'from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400',
      borderColor: 'border-emerald-400/60 hover:border-emerald-300/80',
      onClick: onImportTranscript
    },
    { 
      id: 'effects', 
      icon: Sparkles, 
      label: 'Add Effects',
      gradient: 'from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400',
      borderColor: 'border-purple-400/60 hover:border-purple-300/80',
      onClick: onAddEffects
    }
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
        
        {isProcessing && (
          <div className="bg-track-bg rounded p-3 mb-2">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
              <span className="text-sm">Processing files...</span>
            </div>
          </div>
        )}
        
        {/* Loading Progress */}
        {loadingFile && (
          <div className="bg-gray-800 rounded p-3 mb-3">
            <div className="text-sm text-gray-300 mb-2">
              📁 Loading: {loadingFile}
            </div>
            <Progress value={loadingProgress} className="h-2 bg-gray-700" />
            <div className="text-xs text-gray-400 mt-1">
              {loadingProgress}% complete
            </div>
          </div>
        )}
        
        {/* Tools Section */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold mb-3 text-gray-300">Tools</h4>
          <div className="grid grid-cols-1 gap-2">
            {tools.map((tool) => {
              const Icon = tool.icon;
              const handleClick = () => {
                if (tool.onClick) {
                  tool.onClick();
                } else if (tool.id === 'cut') {
                  onToolChange(tool.id);
                }
              };
              
              return (
                <Button
                  key={tool.id}
                  onClick={handleClick}
                  variant="secondary"
                  size="sm"
                  className={`w-full bg-gradient-to-r ${tool.gradient} text-white border ${tool.borderColor} shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-105 active:scale-95`}
                  data-testid={`button-tool-${tool.id}`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tool.label}
                </Button>
              );
            })}
          </div>
        </div>
        
        {/* Merge Files Button */}
        {audioFiles.length > 1 && (
          <div className="mb-3">
            <Dialog open={concatenateModalOpen} onOpenChange={setConcatenateModalOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border border-blue-500/60 hover:border-blue-400/80 shadow-lg backdrop-blur-sm"
                  data-testid="button-merge-files"
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  Merge Selected Files
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-panel-bg border-gray-700 text-white">
                <DialogHeader>
                  <DialogTitle>Merge Audio Files</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">
                      Select files to merge (in order):
                    </Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {audioFiles.map((file) => (
                        <div key={file.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`merge-${file.id}`}
                            checked={selectedFiles.has(file.id)}
                            onCheckedChange={(checked) => {
                              const newSelected = new Set(selectedFiles);
                              if (checked) {
                                newSelected.add(file.id);
                              } else {
                                newSelected.delete(file.id);
                              }
                              setSelectedFiles(newSelected);
                            }}
                            data-testid={`checkbox-merge-${file.id}`}
                          />
                          <Label htmlFor={`merge-${file.id}`} className="text-sm">
                            {file.name} ({formatDuration(file.duration)})
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="merge-name" className="text-sm font-medium mb-2 block">
                      Name for merged file:
                    </Label>
                    <Input
                      id="merge-name"
                      value={concatenateName}
                      onChange={(e) => setConcatenateName(e.target.value)}
                      placeholder="merged-audio"
                      className="bg-track-bg border-gray-600"
                      data-testid="input-merge-name"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() => {
                        setConcatenateModalOpen(false);
                        setSelectedFiles(new Set());
                        setConcatenateName('');
                      }}
                      data-testid="button-cancel-merge"
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={async () => {
                        if (selectedFiles.size < 2) {
                          toast({
                            title: "Error",
                            description: "Please select at least 2 files to merge.",
                            variant: "destructive"
                          });
                          return;
                        }
                        
                        const name = concatenateName || 'merged-audio';
                        const fileIds = Array.from(selectedFiles);
                        
                        setIsProcessing(true);
                        try {
                          const result = await concatenateFiles(fileIds, name);
                          if (result) {
                            toast({
                              title: "Files Merged",
                              description: `Created merged file: ${name}`
                            });
                            setConcatenateModalOpen(false);
                            setSelectedFiles(new Set());
                            setConcatenateName('');
                          } else {
                            toast({
                              title: "Merge Failed",
                              description: "Unable to merge selected files.",
                              variant: "destructive"
                            });
                          }
                        } finally {
                          setIsProcessing(false);
                        }
                      }}
                      disabled={selectedFiles.size < 2 || isProcessing}
                      data-testid="button-confirm-merge"
                    >
                      {isProcessing ? 'Merging...' : 'Merge Files'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
        
        {audioFiles.map((file: LocalAudioFile) => (
          <div
            key={file.id}
            className="bg-track-bg rounded-lg p-4 mb-3 cursor-pointer hover:bg-gradient-to-r hover:from-slate-700/60 hover:to-slate-600/60 transition-all duration-200 group shadow-lg border border-gray-700/30 backdrop-blur-sm"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('audio-file', JSON.stringify({
                id: file.id,
                name: file.name,
                duration: file.duration
              }));
            }}
            data-testid={`audio-file-${file.id}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center flex-1 min-w-0">
                <FileAudio className="w-4 h-4 text-blue-400 mr-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" data-testid={`text-filename-${file.id}`}>
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-400" data-testid={`text-duration-${file.id}`}>
                    {formatDuration(file.duration)}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-6 h-6 p-0 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-200 hover:bg-red-900/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAudioFile(file.id);
                  }}
                  data-testid={`button-delete-${file.id}`}
                >
                  <X className="w-3 h-3" />
                </Button>
                <GripVertical className="w-4 h-4 text-gray-500" />
              </div>
            </div>
          </div>
        ))}
        
        {audioFiles.length === 0 && !isProcessing && (
          <div className="text-center py-8">
            <FileAudio className="w-12 h-12 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              No audio files added yet
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Drag & drop files or click above to add
            </p>
          </div>
        )}
      </div>
      
    </aside>
  );
}
