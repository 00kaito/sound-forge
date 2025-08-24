import { useState, useCallback } from 'react';
import { LocalAudioFile } from '@/types/audio';
import { AudioConcatenator } from '@/lib/audio-concatenator';

export function useLocalAudioStorage() {
  const [audioFiles, setAudioFiles] = useState<LocalAudioFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addAudioFile = useCallback(async (file: File): Promise<LocalAudioFile> => {
    console.log('LocalAudioStorage: Adding audio file', file.name);
    
    try {
      // Get duration from audio file with error handling
      const duration = await getAudioDuration(file);
      
      const audioFile: LocalAudioFile = {
        id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        name: file.name.split('.')[0],
        duration
      };

      console.log('LocalAudioStorage: Created file object', { id: audioFile.id, name: audioFile.name, duration });
      
      setAudioFiles(prev => {
        const newFiles = [...prev, audioFile];
        console.log('LocalAudioStorage: Updated files array to length', newFiles.length);
        console.log('LocalAudioStorage: Files:', newFiles.map(f => ({ id: f.id, name: f.name })));
        return newFiles;
      });
      
      console.log('LocalAudioStorage: File added successfully');
      return audioFile;
    } catch (error) {
      console.error('LocalAudioStorage: Error adding audio file:', file.name, error);
      throw error;
    }
  }, []);

  const addMultipleAudioFiles = useCallback(async (files: File[]): Promise<LocalAudioFile[]> => {
    const audioFiles: LocalAudioFile[] = [];
    
    try {
      for (const file of files) {
        try {
          const duration = await getAudioDuration(file);
          const audioFile: LocalAudioFile = {
            id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            file,
            name: file.name.split('.')[0],
            duration
          };
          audioFiles.push(audioFile);
        } catch (error) {
          console.error('LocalAudioStorage: Error processing file:', file.name, error);
          // Continue with other files
        }
      }
      
      setAudioFiles(prev => [...prev, ...audioFiles]);
      return audioFiles;
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
        audioBuffer: concatenatedBuffer
      };
      
      setAudioFiles(prev => [...prev, newAudioFile]);
      return newAudioFile;
    } catch (error) {
      console.error('Error concatenating files:', error);
      return null;
    }
  }, [audioFiles]);

  const removeAudioFile = useCallback((id: string) => {
    setAudioFiles(prev => prev.filter(file => file.id !== id));
  }, []);

  const getAudioFile = useCallback((id: string): LocalAudioFile | undefined => {
    console.log('LocalAudioStorage: getAudioFile called with ID', id);
    console.log('LocalAudioStorage: Available files:', audioFiles.map(f => ({ id: f.id, name: f.name })));
    const found = audioFiles.find(file => file.id === id);
    console.log('LocalAudioStorage: Found file:', found ? { id: found.id, name: found.name } : 'NOT FOUND');
    return found;
  }, [audioFiles]);

  const loadAudioBuffer = useCallback(async (audioFile: LocalAudioFile): Promise<AudioBuffer> => {
    if (audioFile.audioBuffer) {
      return audioFile.audioBuffer;
    }

    try {
      const arrayBuffer = await audioFile.file.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Cache the buffer
      setAudioFiles(prev => 
        prev.map(file => 
          file.id === audioFile.id ? { ...file, audioBuffer } : file
        )
      );

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
      
      return projectData;
    } catch (error) {
      console.error('Error importing project:', error);
      throw error;
    }
  }, []);

  return {
    audioFiles,
    isLoading,
    addAudioFile,
    addMultipleAudioFiles,
    concatenateFiles,
    removeAudioFile,
    getAudioFile,
    loadAudioBuffer,
    exportProject,
    importProject
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