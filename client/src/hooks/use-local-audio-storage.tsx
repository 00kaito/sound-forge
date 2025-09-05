import { useState, useCallback } from 'react';
import { LocalAudioFile, AudioCategory } from '@/types/audio'; // Assuming AudioCategory is defined here
import { AudioConcatenator } from '@/lib/audio-concatenator';

export function useLocalAudioStorage() {
  const [audioFiles, setAudioFiles] = useState<LocalAudioFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [audioCategories, setAudioCategories] = useState<AudioCategory[]>([
    { id: 'default', name: 'Uncategorized', collapsed: false, fileIds: [] },
    { id: 'tts', name: 'Generated Audio', collapsed: false, fileIds: [] },
    { id: 'uploaded', name: 'Uploaded Files', collapsed: false, fileIds: [] }
  ]);
  console.log('LocalAudioStorage initialized with files:', audioFiles.map(f => ({ id: f.id, name: f.name, hasBuffer: !!f.audioBuffer })));

  const addAudioFile = useCallback(async (file: File, onProgress?: (progress: number) => void, category?: string): Promise<LocalAudioFile> => {
    const fileSizeMB = Math.round(file.size / 1024 / 1024 * 100) / 100;
    console.log('LocalAudioStorage: Adding audio file', file.name, `${fileSizeMB}MB`);

    try {
      onProgress?.(10); // Starting duration detection

      // Get duration from audio file with error handling
      const duration = await getAudioDuration(file);

      onProgress?.(60); // Duration detected

      const audioFile: LocalAudioFile = {
        id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        name: file.name.split('.')[0],
        duration,
        category: category || 'uploaded'
      };

      onProgress?.(90); // File object created

      console.log('LocalAudioStorage: Created file object', { id: audioFile.id, name: audioFile.name, duration });

      setAudioFiles(prev => {
        const newFiles = [...prev, audioFile];
        console.log('LocalAudioStorage: Updated files array to length', newFiles.length);
        console.log('LocalAudioStorage: Files:', newFiles.map(f => ({ id: f.id, name: f.name })));
        return newFiles;
      });

      // Add file to category
      setAudioCategories(prev => prev.map(cat => 
        cat.id === (category || 'uploaded') ? { ...cat, fileIds: [...cat.fileIds, audioFile.id] } : cat
      ));

      onProgress?.(100); // Complete

      console.log('LocalAudioStorage: File added successfully');
      return audioFile;
    } catch (error) {
      console.error('LocalAudioStorage: Error adding audio file:', file.name, error);
      throw error;
    }
  }, []);

  const addMultipleAudioFiles = useCallback(async (files: File[], category?: string): Promise<LocalAudioFile[]> => {
    const addedFiles: LocalAudioFile[] = [];

    try {
      for (const file of files) {
        try {
          const duration = await getAudioDuration(file);
          const audioFile: LocalAudioFile = {
            id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            file,
            name: file.name.split('.')[0],
            duration,
            category: category || 'uploaded'
          };
          addedFiles.push(audioFile);
        } catch (error) {
          console.error('LocalAudioStorage: Error processing file:', file.name, error);
          // Continue with other files
        }
      }

      setAudioFiles(prev => [...prev, ...addedFiles]);

      // Add files to category
      setAudioCategories(prev => prev.map(cat => 
        cat.id === (category || 'uploaded') ? { ...cat, fileIds: [...cat.fileIds, ...addedFiles.map(f => f.id)] } : cat
      ));

      return addedFiles;
    } catch (error) {
      console.error('LocalAudioStorage: Error adding multiple files:', error);
      throw error;
    }
  }, []);

  const concatenateFiles = useCallback(async (fileIds: string[], newName: string): Promise<LocalAudioFile | null> => {
    try {
      const filesToConcatenate = audioFiles.filter(f => fileIds.includes(f.id));
      if (filesToConcatenate.length < 2) return null;

      // Load audio buffers
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const buffers: AudioBuffer[] = [];

      for (const audioFile of filesToConcatenate) {
        const arrayBuffer = await audioFile.file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        buffers.push(audioBuffer);
      }

      // Concatenate buffers
      const concatenatedBuffer = AudioConcatenator.concatenateAudioBuffers(audioContext, buffers);

      // Convert back to WAV file
      const wavBlob = await AudioConcatenator.audioBufferToWavBlob(concatenatedBuffer);
      const wavFile = new File([wavBlob], `${newName}.wav`, { type: 'audio/wav' });

      // Add as new audio file
      const newAudioFile: LocalAudioFile = {
        id: `concat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file: wavFile,
        name: newName,
        duration: concatenatedBuffer.duration,
        audioBuffer: concatenatedBuffer,
        category: 'default' // Default category for concatenated files
      };

      setAudioFiles(prev => [...prev, newAudioFile]);
      // Add to default category
      setAudioCategories(prev => prev.map(cat => 
        cat.id === 'default' ? { ...cat, fileIds: [...cat.fileIds, newAudioFile.id] } : cat
      ));
      
      return newAudioFile;
    } catch (error) {
      console.error('Error concatenating files:', error);
      return null;
    }
  }, [audioFiles]);

  const removeAudioFile = useCallback((id: string, onClipsRemoved?: (removedClips: number) => void) => {
    setAudioFiles(prev => {
      const newFiles = prev.filter(file => file.id !== id);
      // Remove file from its category
      setAudioCategories(cats => cats.map(cat => ({
        ...cat,
        fileIds: cat.fileIds.filter(fileId => fileId !== id)
      })));
      return newFiles;
    });

    // Notify about clips that will be orphaned - parent component should handle removing them
    if (onClipsRemoved) {
      onClipsRemoved(0); // Will be filled by parent component logic
    }
  }, []);

  const getAudioFile = useCallback((id: string): LocalAudioFile | undefined => {
    console.log('LocalAudioStorage: getAudioFile called with ID', id);
    console.log('LocalAudioStorage: Available files:', audioFiles.map(f => ({ id: f.id, name: f.name, hasBuffer: !!f.audioBuffer })));
    console.log('LocalAudioStorage: Total files in storage:', audioFiles.length);
    const found = audioFiles.find(file => file.id === id);
    console.log('LocalAudioStorage: Found file:', found ? { id: found.id, name: found.name, hasBuffer: !!found.audioBuffer } : 'NOT FOUND');
    return found;
  }, [audioFiles]);

  const loadAudioBuffer = useCallback(async (audioFile: LocalAudioFile, onProgress?: (progress: number) => void): Promise<AudioBuffer> => {
    // Return cached buffer if available
    if (audioFile.audioBuffer) {
      console.log('LocalAudioStorage: Using cached audio buffer for', audioFile.name);
      onProgress?.(100);
      return audioFile.audioBuffer;
    }

    const startTime = performance.now();
    const fileSizeMB = Math.round(audioFile.file.size / 1024 / 1024 * 100) / 100;
    console.log('LocalAudioStorage: Loading audio buffer for', audioFile.name, `${fileSizeMB}MB`);

    try {
      onProgress?.(20); // Starting to read file

      // Use streaming approach for large files
      const arrayBuffer = await audioFile.file.arrayBuffer();

      onProgress?.(60); // File read, starting decode

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      onProgress?.(90); // Decoded, caching

      // Cache the buffer for future use
      setAudioFiles(prev => {
        const updated = prev.map(file => 
          file.id === audioFile.id ? { ...file, audioBuffer } : file
        );
        console.log('LocalAudioStorage: Cached buffer for', audioFile.name, 'Files after cache:', updated.length);
        return updated;
      });

      const loadTime = Math.round(performance.now() - startTime);
      console.log(`LocalAudioStorage: Audio buffer loaded in ${loadTime}ms for ${audioFile.name}`);

      onProgress?.(100); // Complete

      return audioBuffer;
    } catch (error) {
      console.error('Error loading audio buffer for file:', audioFile.name, error);
      throw error;
    }
  }, []);

  const exportProject = useCallback((projectData: any, projectName: string = 'my-project') => {
    // Create project export object
    const exportData = {
      projectName,
      version: '1.0',
      timestamp: new Date().toISOString(),
      audioForgeProject: true,
      timeline: projectData.timeline,
      tracks: projectData.tracks,
      clips: projectData.clips,
      audioFiles: audioFiles.map(file => ({
        id: file.id,
        originalName: file.name,
        duration: file.duration,
        category: file.category,
        // Don't include the actual file data
      }))
    };

    // Download as JSON file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName}.audioforge.json`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('Project exported:', projectName);
  }, [audioFiles]);

  const importProject = useCallback(async (file: File): Promise<any> => {
    try {
      const text = await file.text();
      const projectData = JSON.parse(text);

      // Validate project format
      if (!projectData.audioForgeProject) {
        throw new Error('Invalid AudioForge project file');
      }

      console.log('Project imported:', projectData.projectName);
      console.log('Required audio files:', projectData.audioFiles);

      // Load audio files from imported project
      const importedAudioFiles: LocalAudioFile[] = projectData.audioFiles.map((fileInfo: any) => ({
        id: fileInfo.id,
        name: fileInfo.originalName,
        duration: fileInfo.duration,
        category: fileInfo.category || 'default', // Assign category or default
        file: null, // File data is not embedded in JSON
        audioBuffer: null, // Buffer not loaded initially
      }));

      setAudioFiles(prev => [...prev, ...importedAudioFiles]);

      // Update categories based on imported files
      setAudioCategories(prevCategories => {
        const updatedCategories = [...prevCategories];
        importedAudioFiles.forEach(file => {
          if (!updatedCategories.some(cat => cat.id === file.category)) {
            updatedCategories.push({ id: file.category, name: file.category, collapsed: false, fileIds: [] });
          }
          const categoryIndex = updatedCategories.findIndex(cat => cat.id === file.category);
          if (!updatedCategories[categoryIndex].fileIds.includes(file.id)) {
            updatedCategories[categoryIndex].fileIds.push(file.id);
          }
        });
        return updatedCategories;
      });

      return projectData;
    } catch (error) {
      console.error('Error importing project:', error);
      throw error;
    }
  }, []);

  const createCategory = useCallback((name: string) => {
    const id = `cat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setAudioCategories(prev => [...prev, { id, name, collapsed: false, fileIds: [] }]);
    return id;
  }, []);

  const deleteCategory = useCallback((categoryId: string) => {
    setAudioCategories(prev => prev.filter(cat => cat.id !== categoryId));
    // Move files back to default category
    setAudioFiles(prev => prev.map(file => 
      file.category === categoryId ? { ...file, category: 'default' } : file
    ));
    // Also remove from default category's fileIds if it was moved there
    setAudioCategories(prev => prev.map(cat => 
      cat.id === 'default' ? { ...cat, fileIds: cat.fileIds.filter(fileId => fileId !== categoryId) } : cat
    ));
  }, []);

  const moveFileToCategory = useCallback((fileId: string, categoryId: string) => {
    setAudioFiles(prev => prev.map(file => 
      file.id === fileId ? { ...file, category: categoryId } : file
    ));
    
    // Update category fileIds arrays
    setAudioCategories(prev => prev.map(cat => {
      if (cat.id === categoryId) {
        // Add to new category if not already present
        if (!cat.fileIds.includes(fileId)) {
          return { ...cat, fileIds: [...cat.fileIds, fileId] };
        }
      } else {
        // Remove from old category if present
        if (cat.fileIds.includes(fileId)) {
          return { ...cat, fileIds: cat.fileIds.filter(id => id !== fileId) };
        }
      }
      return cat;
    }));
  }, []);

  const toggleCategoryCollapse = useCallback((categoryId: string) => {
    setAudioCategories(prev => prev.map(cat => 
      cat.id === categoryId ? { ...cat, collapsed: !cat.collapsed } : cat
    ));
  }, []);

  return {
    audioFiles,
    isLoading,
    audioCategories,
    addAudioFile,
    addMultipleAudioFiles,
    concatenateFiles,
    removeAudioFile,
    getAudioFile,
    loadAudioBuffer,
    exportProject,
    importProject,
    createCategory,
    deleteCategory,
    moveFileToCategory,
    toggleCategoryCollapse
  };
}

// Helper function to get audio file duration
async function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement('audio');
    audio.preload = 'metadata';

    const cleanup = () => {
      if (audio.src) {
        window.URL.revokeObjectURL(audio.src);
      }
    };

    audio.onloadedmetadata = () => {
      const duration = audio.duration || 0;
      cleanup();
      resolve(duration);
    };

    audio.onerror = (error) => {
      console.warn('Could not get audio duration:', error);
      cleanup();
      resolve(0);
    };

    // Add timeout to prevent hanging promises
    setTimeout(() => {
      console.warn('Audio duration detection timeout');
      cleanup();
      resolve(0);
    }, 5000);

    try {
      audio.src = window.URL.createObjectURL(file);
    } catch (error) {
      console.warn('Error creating object URL:', error);
      resolve(0);
    }
  });
}