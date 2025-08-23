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

  async loadAudioFile(audioFileId: string, arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    try {
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.tracks.set(audioFileId, audioBuffer);
      return audioBuffer;
    } catch (error) {
      console.error('Failed to decode audio data:', error);
      throw new Error('Failed to load audio file');
    }
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
    this.updatePlayhead();
  }

  pause(): void {
    if (!this.audioContext || !this.playbackState.isPlaying) return;

    this.playbackState.isPlaying = false;
    this.pauseTime = this.audioContext.currentTime - this.startTime;
    
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
    this.pauseTime = time;
    this.playbackState.currentTime = time;
    this.playbackState.playhead = time;
  }

  private updatePlayhead(): void {
    if (!this.audioContext || !this.playbackState.isPlaying) return;

    this.playbackState.currentTime = this.audioContext.currentTime - this.startTime;
    this.playbackState.playhead = this.playbackState.currentTime;

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
    
    // TODO: Implement full audio rendering logic
    // This is a simplified version - in production you'd need to:
    // 1. Create source nodes for each clip
    // 2. Apply volume, pan, and effects
    // 3. Schedule all clips according to their timeline positions
    // 4. Render the final mix

    return await offlineContext.startRendering();
  }

  destroy(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    this.trackGains.clear();
    this.tracks.clear();
    
    if (this.audioContext) {
      this.audioContext.close();
    }
    
    this.isInitialized = false;
  }
}
