import { AudioClip, Track, PlaybackState } from "@/types/audio";

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private tracks: Map<string, AudioBuffer> = new Map();
  private trackGains: Map<string, GainNode> = new Map();
  private isInitialized = false;
  private playbackState: PlaybackState = {
    isPlaying: false,
    currentTime: 0,
    totalDuration: 0,
    playhead: 0
  };
  private animationFrame: number | null = null;
  private startTime = 0;
  private pauseTime = 0;
  private currentSources: AudioBufferSourceNode[] = [];
  private currentTracks: Track[] = [];
  private currentClips: AudioClip[] = [];

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
      throw new Error('Web Audio API is not supported in this browser');
    }
  }

  async loadAudioFile(audioFileId: string, file: File | ArrayBuffer): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    try {
      let arrayBuffer: ArrayBuffer;
      
      if (file instanceof File) {
        arrayBuffer = await file.arrayBuffer();
      } else {
        arrayBuffer = file;
      }
      
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.tracks.set(audioFileId, audioBuffer);
      console.log('Audio Engine: Audio buffer loaded and stored', {
        id: audioFileId,
        duration: audioBuffer.duration,
        channels: audioBuffer.numberOfChannels,
        totalLoaded: this.tracks.size
      });
      return audioBuffer;
    } catch (error) {
      console.error('Failed to decode audio data:', error);
      throw new Error('Failed to load audio file');
    }
  }

  getAudioBuffer(audioFileId: string): AudioBuffer | undefined {
    return this.tracks.get(audioFileId);
  }

  createTrackGain(trackId: string): GainNode {
    if (!this.audioContext || !this.masterGain) {
      throw new Error('Audio context not initialized');
    }

    const gainNode = this.audioContext.createGain();
    gainNode.connect(this.masterGain);
    this.trackGains.set(trackId, gainNode);
    return gainNode;
  }

  setTrackVolume(trackId: string, volume: number): void {
    const gainNode = this.trackGains.get(trackId);
    if (gainNode) {
      gainNode.gain.value = volume;
    }
  }

  setTrackPan(trackId: string, pan: number): void {
    if (!this.audioContext) return;

    const gainNode = this.trackGains.get(trackId);
    if (gainNode) {
      // Disconnect and reconnect with stereo panner
      gainNode.disconnect();
      const panNode = this.audioContext.createStereoPanner();
      panNode.pan.value = pan;
      gainNode.connect(panNode);
      panNode.connect(this.masterGain!);
    }
  }

  play(): void {
    if (!this.audioContext || this.playbackState.isPlaying) return;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    this.playbackState.isPlaying = true;
    this.startTime = this.audioContext.currentTime - this.pauseTime;
    
    // Start playing clips from current position
    this.scheduleClips();
    this.updatePlayhead();
  }

  pause(): void {
    if (!this.audioContext || !this.playbackState.isPlaying) return;

    this.playbackState.isPlaying = false;
    this.pauseTime = this.audioContext.currentTime - this.startTime;
    
    // Stop all current sources
    this.stopAllSources();
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  stop(): void {
    this.pause();
    this.pauseTime = 0;
    this.playbackState.currentTime = 0;
    this.playbackState.playhead = 0;
  }

  seekTo(time: number): void {
    const wasPlaying = this.playbackState.isPlaying;
    
    if (wasPlaying) {
      this.pause();
    }
    
    this.pauseTime = time;
    this.playbackState.currentTime = time;
    this.playbackState.playhead = time;
    
    if (wasPlaying) {
      this.play();
    }
  }

  private updatePlayhead(): void {
    if (!this.audioContext || !this.playbackState.isPlaying) return;

    this.playbackState.currentTime = this.audioContext.currentTime - this.startTime;
    this.playbackState.playhead = this.playbackState.currentTime;

    // Auto-stop when reaching the end
    if (this.playbackState.totalDuration > 0 && this.playbackState.currentTime >= this.playbackState.totalDuration) {
      console.log('Audio Engine: Auto-stopping at end of timeline');
      this.stop();
      return;
    }

    this.animationFrame = requestAnimationFrame(() => this.updatePlayhead());
  }

  getPlaybackState(): PlaybackState {
    return { ...this.playbackState };
  }

  setMasterVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = volume;
    }
  }

  // New methods for timeline playback
  setTimelineData(tracks: Track[], clips: AudioClip[]): void {
    this.currentTracks = tracks;
    this.currentClips = clips;
    
    console.log('Audio Engine: Timeline updated', {
      tracks: tracks.length,
      clips: clips.length,
      loadedBuffers: this.tracks.size,
      clipIds: clips.map(c => c.audioFileId),
      loadedBufferIds: Array.from(this.tracks.keys())
    });
    
    // Calculate total duration
    if (clips.length > 0) {
      this.playbackState.totalDuration = Math.max(
        ...clips.map(clip => clip.startTime + clip.duration)
      );
    } else {
      this.playbackState.totalDuration = 0;
    }
  }

  private scheduleClips(): void {
    if (!this.audioContext || !this.masterGain) return;
    
    const currentTime = this.pauseTime;
    const audioContextStartTime = this.audioContext.currentTime;
    
    console.log('Audio Engine: Scheduling clips', {
      currentTime,
      totalClips: this.currentClips.length,
      audioContextTime: audioContextStartTime
    });
    
    // Stop any existing sources
    this.stopAllSources();
    
    // Schedule clips that should be playing
    for (const clip of this.currentClips) {
      const clipStartTime = clip.startTime;
      const clipEndTime = clip.startTime + clip.duration;
      
      // Skip clips that have already ended
      if (currentTime >= clipEndTime) continue;
      
      const audioBuffer = this.tracks.get(clip.audioFileId);
      if (!audioBuffer) {
        console.warn('Audio Engine: Missing audio buffer for clip', clip.audioFileId);
        console.log('Audio Engine: Available buffers:', Array.from(this.tracks.keys()));
        continue;
      }
      
      console.log('Audio Engine: Found audio buffer for clip', {
        clipId: clip.id,
        audioFileId: clip.audioFileId,
        bufferDuration: audioBuffer.duration
      });
      
      const track = this.currentTracks.find(t => t.id === clip.trackId);
      if (!track || track.muted) continue;
      
      // Create audio source
      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();
      const panNode = this.audioContext.createStereoPanner();
      
      source.buffer = audioBuffer;
      source.connect(gainNode);
      gainNode.connect(panNode);
      
      // Connect to track gain node for real-time volume/pan control
      const trackGain = this.trackGains.get(clip.trackId);
      if (trackGain) {
        panNode.connect(trackGain);
        console.log('Audio Engine: Connected clip to track gain', { clipId: clip.id, trackId: clip.trackId });
      } else {
        // Fallback to master gain if track gain doesn't exist
        panNode.connect(this.masterGain);
        console.warn('Audio Engine: No track gain found, connecting to master', clip.trackId);
      }
      
      // Calculate timing first
      let sourceStartTime = audioContextStartTime;
      let sourceOffset = clip.offset;
      let sourceDuration = clip.duration;
      
      if (currentTime > clipStartTime) {
        // We're starting in the middle of this clip
        const timeIntoClip = currentTime - clipStartTime;
        sourceOffset += timeIntoClip;
        sourceDuration -= timeIntoClip;
      } else {
        // Clip starts in the future
        sourceStartTime += (clipStartTime - currentTime);
      }
      
      // Apply base volume and pan
      const baseVolume = clip.volume * track.volume;
      panNode.pan.value = track.pan;
      
      // Apply fade in/out with proper scheduling
      let initialVolume = baseVolume;
      
      // Handle fade in
      if (clip.fadeIn && clip.fadeIn > 0 && currentTime <= clipStartTime + clip.fadeIn) {
        const fadeInEnd = sourceStartTime + clip.fadeIn;
        gainNode.gain.setValueAtTime(0, sourceStartTime);
        gainNode.gain.linearRampToValueAtTime(baseVolume, fadeInEnd);
        console.log('Audio Engine: Applied fade in', {
          clipName: clip.name,
          fadeInDuration: clip.fadeIn,
          startTime: sourceStartTime,
          endTime: fadeInEnd
        });
      } else {
        gainNode.gain.setValueAtTime(baseVolume, sourceStartTime);
      }
      
      // Handle fade out
      if (clip.fadeOut && clip.fadeOut > 0) {
        const sourceEndTime = sourceStartTime + sourceDuration;
        const fadeOutStart = sourceEndTime - clip.fadeOut;
        
        // Always apply fade out if it's defined
        gainNode.gain.setValueAtTime(baseVolume, fadeOutStart);
        gainNode.gain.linearRampToValueAtTime(0, sourceEndTime);
        
        console.log('Audio Engine: Applied fade out', {
          clipName: clip.name,
          fadeOutDuration: clip.fadeOut,
          fadeOutStart: fadeOutStart,
          sourceEndTime: sourceEndTime,
          sourceDuration: sourceDuration
        });
      }
      
      // Start the source
      if (sourceDuration > 0 && sourceOffset < audioBuffer.duration) {
        console.log('Audio Engine: Starting source', {
          clipName: clip.name,
          startTime: sourceStartTime,
          offset: sourceOffset,
          duration: sourceDuration,
          volume: gainNode.gain.value
        });
        source.start(sourceStartTime, sourceOffset, sourceDuration);
        this.currentSources.push(source);
      }
    }
  }
  
  private stopAllSources(): void {
    for (const source of this.currentSources) {
      try {
        source.stop();
      } catch (e) {
        // Source might already be stopped
      }
    }
    this.currentSources = [];
  }

  async exportAudio(tracks: Track[], clips: AudioClip[]): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    // Calculate total duration
    const totalDuration = Math.max(...clips.map(clip => clip.startTime + clip.duration));
    const sampleRate = this.audioContext.sampleRate;
    const numberOfChannels = 2; // Stereo
    const length = totalDuration * sampleRate;

    const offlineContext = new OfflineAudioContext(numberOfChannels, length, sampleRate);
    
    // Create master gain node for offline context
    const masterGain = offlineContext.createGain();
    masterGain.connect(offlineContext.destination);

    // Process each clip
    for (const clip of clips) {
      const audioBuffer = this.tracks.get(clip.audioFileId);
      if (!audioBuffer) continue;

      const source = offlineContext.createBufferSource();
      const gainNode = offlineContext.createGain();
      const panNode = offlineContext.createStereoPanner();

      // Find the track for this clip
      const track = tracks.find(t => t.id === clip.trackId);
      if (!track) continue;

      // Set up audio graph
      source.buffer = audioBuffer;
      source.connect(gainNode);
      gainNode.connect(panNode);
      panNode.connect(masterGain);

      // Apply clip settings
      gainNode.gain.value = clip.volume * track.volume;
      panNode.pan.value = track.pan;

      // Start the source at the correct time
      source.start(clip.startTime, clip.offset, clip.duration);
    }

    return await offlineContext.startRendering();
  }

  destroy(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    this.stopAllSources();
    this.trackGains.clear();
    this.tracks.clear();
    
    if (this.audioContext) {
      this.audioContext.close();
    }
    
    this.isInitialized = false;
  }
}
