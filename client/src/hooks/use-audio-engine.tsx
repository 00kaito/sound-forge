import { useState, useRef, useEffect, useCallback } from 'react';
import { AudioEngine } from '@/lib/audio-engine';
import { AudioClip, Track, PlaybackState } from '@/types/audio';

export function useAudioEngine() {
  const engineRef = useRef<AudioEngine | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentTime: 0,
    totalDuration: 0,
    playhead: 0
  });
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    if (engineRef.current) return;

    try {
      const engine = new AudioEngine();
      await engine.initialize();
      engineRef.current = engine;
      setIsInitialized(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize audio engine');
    }
  }, []);

  const loadAudioFile = useCallback(async (audioFileId: string, file: File | ArrayBuffer | AudioBuffer) => {
    if (!engineRef.current) {
      throw new Error('Audio engine not initialized');
    }
    
    return await engineRef.current.loadAudioFile(audioFileId, file);
  }, []);

  const getAudioBuffer = useCallback((audioFileId: string) => {
    if (!engineRef.current) {
      console.log('useAudioEngine: getAudioBuffer called but engine not ready');
      return undefined;
    }
    const buffer = engineRef.current.getAudioBuffer(audioFileId);
    console.log('useAudioEngine: getAudioBuffer called for', audioFileId, 'result:', !!buffer);
    return buffer;
  }, []);

  const play = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.play();
    }
  }, []);

  const pause = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.pause();
    }
  }, []);

  const stop = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.stop();
    }
  }, []);

  const seekTo = useCallback((time: number) => {
    if (engineRef.current) {
      engineRef.current.seekTo(time);
    }
  }, []);

  const setTrackVolume = useCallback((trackId: string, volume: number) => {
    if (engineRef.current) {
      engineRef.current.setTrackVolume(trackId, volume);
    }
  }, []);

  const setTrackPan = useCallback((trackId: string, pan: number) => {
    if (engineRef.current) {
      engineRef.current.setTrackPan(trackId, pan);
    }
  }, []);

  const createTrackGain = useCallback((trackId: string) => {
    if (engineRef.current) {
      return engineRef.current.createTrackGain(trackId);
    }
  }, []);

  const exportAudio = useCallback(async (tracks: Track[], clips: AudioClip[]) => {
    if (!engineRef.current) {
      throw new Error('Audio engine not initialized');
    }
    
    return await engineRef.current.exportAudio(tracks, clips);
  }, []);

  const setTimelineData = useCallback((tracks: Track[], clips: AudioClip[]) => {
    if (engineRef.current) {
      engineRef.current.setTimelineData(tracks, clips);
    }
  }, []);

  // Update playback state periodically
  useEffect(() => {
    if (!isInitialized || !engineRef.current) return;

    const interval = setInterval(() => {
      const state = engineRef.current!.getPlaybackState();
      setPlaybackState(state);
    }, 50); // Update 20 times per second

    return () => clearInterval(interval);
  }, [isInitialized]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
      }
    };
  }, []);

  return {
    initialize,
    isInitialized,
    playbackState,
    error,
    loadAudioFile,
    getAudioBuffer,
    play,
    pause,
    stop,
    seekTo,
    setTrackVolume,
    setTrackPan,
    createTrackGain,
    exportAudio,
    setTimelineData
  };
}
