import { useState, useRef } from 'react';
import { CloudUpload, GripVertical, Scissors, Volume2, Zap, Wand2, Plus, X, Link2, FileAudio, FileText, Sparkles, Mic, ChevronRight } from 'lucide-react';
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
  onTTSImport?: () => void;
  isTTSGenerating?: boolean;
  ttsProgress?: { completed: number; total: number };
}

export function Sidebar({ tracks, onAddTrack, onAddClipToTrack, currentTool, onToolChange, audioFiles = [], addAudioFile, removeAudioFile, concatenateFiles, onImportTranscript, onAddEffects, onTTSImport, isTTSGenerating = false, ttsProgress = { completed: 0, total: 0 } }: SidebarProps) {
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

  // State for categories
  const [audioCategories, setAudioCategories] = useState<{ id: string; name: string; collapsed: boolean }[]>(() => {
    const defaultCategories = [
      { id: 'default', name: 'Uncategorized', collapsed: false },
      { id: 'uploaded', name: 'Uploaded', collapsed: false },
      { id: 'tts', name: 'Text-to-Speech', collapsed: false },
    ];
    const storedCategories = localStorage.getItem('audioCategories');
    if (storedCategories) {
      try {
        const parsedCategories = JSON.parse(storedCategories);
        // Ensure default categories are present
        const mergedCategories = [...defaultCategories];
        const existingIds = new Set(defaultCategories.map(c => c.id));
        parsedCategories.forEach((cat: { id: string; name: string; collapsed: boolean }) => {
          if (!existingIds.has(cat.id)) {
            mergedCategories.push(cat);
          }
        });
        return mergedCategories;
      } catch (e) {
        console.error("Failed to parse audioCategories from localStorage", e);
        return defaultCategories;
      }
    }
    return defaultCategories;
  });
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Category management functions
  const createCategory = (name: string) => {
    const newCategory = { id: `cat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, name, collapsed: false };
    setAudioCategories([...audioCategories, newCategory]);
    // Save to localStorage
    localStorage.setItem('audioCategories', JSON.stringify([...audioCategories, newCategory]));
  };

  const deleteCategory = (id: string) => {
    setAudioCategories(audioCategories.filter(cat => cat.id !== id));
    // Update audio files to move them to 'default' category
    audioFiles.forEach(file => {
      if (file.category === id) {
        // In a real app, you'd call an update function here
        // For simplicity, we'll just re-filter them visually
        file.category = 'default'; // This won't update the actual state without a proper setter
      }
    });
    // Save to localStorage
    localStorage.setItem('audioCategories', JSON.stringify(audioCategories.filter(cat => cat.id !== id)));
  };

  const toggleCategoryCollapse = (id: string) => {
    setAudioCategories(audioCategories.map(cat => 
      cat.id === id ? { ...cat, collapsed: !cat.collapsed } : cat
    ));
    // Save to localStorage
    localStorage.setItem('audioCategories', JSON.stringify(audioCategories.map(cat => 
      cat.id === id ? { ...cat, collapsed: !cat.collapsed } : cat
    )));
  };


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

          // Assign to default category initially, can be changed later
          result.category = 'default'; 

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

  const handleDragStart = (e: React.DragEvent, file: LocalAudioFile) => {
    e.dataTransfer.setData('audio-file', JSON.stringify({
      id: file.id,
      name: file.name,
      duration: file.duration,
      category: file.category
    }));
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
    },
    { 
      id: 'tts', 
      icon: Mic, 
      label: isTTSGenerating ? `Generating ${ttsProgress.completed}/${ttsProgress.total}` : 'TTS Import',
      gradient: 'from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400',
      borderColor: 'border-orange-400/60 hover:border-orange-300/80',
      onClick: onTTSImport,
      disabled: isTTSGenerating
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
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-300">Audio Library</h3>
          <Button
            variant="ghost"
            size="sm"
            className="w-6 h-6 p-0 text-green-400 hover:text-green-200"
            onClick={() => setShowCategoryForm(true)}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {showCategoryForm && (
          <div className="bg-track-bg rounded-lg p-3 mb-3 border border-gray-600">
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Category name"
              className="mb-2"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && newCategoryName.trim()) {
                  createCategory(newCategoryName.trim());
                  setNewCategoryName('');
                  setShowCategoryForm(false);
                }
              }}
            />
            <div className="flex space-x-2">
              <Button
                size="sm"
                onClick={() => {
                  if (newCategoryName.trim()) {
                    createCategory(newCategoryName.trim());
                    setNewCategoryName('');
                    setShowCategoryForm(false);
                  }
                }}
              >
                Add
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCategoryForm(false);
                  setNewCategoryName('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="bg-track-bg rounded p-3 mb-2">
            <div className="flex items-center">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
              <span className="text-sm text-gray-300">
                {loadingFile ? `Loading ${loadingFile}...` : 'Processing files...'}
              </span>
            </div>
            {loadingProgress > 0 && (
              <div className="w-full bg-gray-700 rounded-full h-1 mt-2">
                <div 
                  className="bg-blue-500 h-1 rounded-full transition-all duration-200" 
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Multi-select actions */}
        {selectedFiles.size > 0 && (
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-300">
                {selectedFiles.size} file{selectedFiles.size > 1 ? 's' : ''} selected
              </span>
              <div className="flex space-x-2">
                <Button
                  variant="ghost" 
                  size="sm"
                  onClick={() => setConcatenateModalOpen(true)}
                  className="text-blue-300 hover:text-blue-200"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Merge
                </Button>
                <Button
                  variant="ghost"
                  size="sm" 
                  onClick={() => setSelectedFiles(new Set())}
                  className="text-gray-400 hover:text-gray-200"
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Categories */}
        {audioCategories.map(category => {
          const categoryFiles = audioFiles.filter(file => file.category === category.id);
          if (categoryFiles.length === 0 && category.id !== 'default') return null;

          return (
            <div key={category.id} className="mb-4">
              <div 
                className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800/70"
                onClick={() => toggleCategoryCollapse(category.id)}
              >
                <div className="flex items-center space-x-2">
                  <div className={`transform transition-transform ${category.collapsed ? 'rotate-0' : 'rotate-90'}`}>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                  <span className="text-sm font-medium text-gray-300">{category.name}</span>
                  <span className="text-xs text-gray-500">({categoryFiles.length})</span>
                </div>
                {category.id !== 'default' && category.id !== 'uploaded' && category.id !== 'tts' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-6 h-6 p-0 text-red-400 hover:text-red-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteCategory(category.id);
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>

              {!category.collapsed && (
                <div className="ml-4 mt-2 space-y-2">
                  {categoryFiles.map(file => (
                    <div 
                      key={file.id}
                      className={`group bg-track-bg hover:bg-gray-700/80 rounded-lg p-3 border transition-all cursor-pointer ${
                        selectedFiles.has(file.id) ? 'border-blue-500 bg-blue-900/20' : 'border-gray-600'
                      }`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, file)}
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey) {
                          const newSelection = new Set(selectedFiles);
                          if (newSelection.has(file.id)) {
                            newSelection.delete(file.id);
                          } else {
                            newSelection.add(file.id);
                          }
                          setSelectedFiles(newSelection);
                        } else if (selectedFiles.size <= 1) {
                          // Attempt to add clip to the first track that has no clips, or the first track overall
                          const targetTrack = tracks.find(track => track.clips.length === 0) || (tracks.length > 0 ? tracks[0] : null);
                          if (targetTrack) {
                            const clip: AudioClip = {
                              id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                              audioFileId: file.id,
                              name: file.name,
                              startTime: 0,
                              duration: file.duration,
                              volume: 1,
                              fadeIn: 0,
                              fadeOut: 0
                            };
                            onAddClipToTrack(targetTrack.id, clip);
                          } else {
                            toast({
                              title: "No Tracks Available",
                              description: "Please add a track before adding audio clips.",
                              variant: "destructive"
                            });
                          }
                        }
                      }}
                      data-testid={`audio-file-${file.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={selectedFiles.has(file.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              const newSelection = new Set(selectedFiles);
                              if (e.target.checked) {
                                newSelection.add(file.id);
                              } else {
                                newSelection.delete(file.id);
                              }
                              setSelectedFiles(newSelection);
                            }}
                            className="w-3 h-3 text-blue-500 rounded"
                          />
                          <FileAudio className="w-4 h-4 text-blue-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-200 truncate">
                              {file.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {file.duration.toFixed(1)}s
                            </div>
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
                </div>
              )}
            </div>
          );
        })}

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