import { useState, useCallback } from 'react';
import { LocalAudioFile } from '@/types/audio';
import { AudioConcatenator } from '@/lib/audio-concatenator';

export function useLocalAudioStorage() {
  const [audioFiles, setAudioFiles] = useState<LocalAudioFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addAudioFile = useCallback(async (file: File): Promise<LocalAudioFile> => {
    console.log('LocalAudioStorage: Adding audio file', file.name);
    // Get duration from audio file
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
  }, []);

  const addMultipleAudioFiles = useCallback(async (files: File[]): Promise<LocalAudioFile[]> => {
    const audioFiles: LocalAudioFile[] = [];
    
    for (const file of files) {
      const duration = await getAudioDuration(file);
      const audioFile: LocalAudioFile = {
        id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        name: file.name.split('.')[0],
        duration
      };
      audioFiles.push(audioFile);
    }
    
    setAudioFiles(prev => [...prev, ...audioFiles]);
    return audioFiles;
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
      const wavBlob = AudioConcatenator.audioBufferToWavBlob(concatenatedBuffer);
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
  }, []);

  return {
    audioFiles,
    isLoading,
    addAudioFile,
    addMultipleAudioFiles,
    concatenateFiles,
    removeAudioFile,
    getAudioFile,
    loadAudioBuffer
  };
}

// Helper function to get audio file duration
async function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    
    audio.onloadedmetadata = () => {
      window.URL.revokeObjectURL(audio.src);
      resolve(audio.duration || 0);
    };
    
    audio.onerror = () => {
      window.URL.revokeObjectURL(audio.src);
      resolve(0);
    };
    
    audio.src = window.URL.createObjectURL(file);
  });
}