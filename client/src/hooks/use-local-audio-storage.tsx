import { useState, useCallback } from 'react';
import { LocalAudioFile } from '@/types/audio';

export function useLocalAudioStorage() {
  const [audioFiles, setAudioFiles] = useState<LocalAudioFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addAudioFile = useCallback(async (file: File): Promise<LocalAudioFile> => {
    // Get duration from audio file
    const duration = await getAudioDuration(file);
    
    const audioFile: LocalAudioFile = {
      id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      name: file.name.split('.')[0],
      duration
    };

    setAudioFiles(prev => [...prev, audioFile]);
    return audioFile;
  }, []);

  const removeAudioFile = useCallback((id: string) => {
    setAudioFiles(prev => prev.filter(file => file.id !== id));
  }, []);

  const getAudioFile = useCallback((id: string): LocalAudioFile | undefined => {
    return audioFiles.find(file => file.id === id);
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