export interface AudioClip {
  id: string;
  audioFileId: string;
  trackId: string;
  startTime: number;
  duration: number;
  offset: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  name: string;
}

export interface Track {
  id: string;
  name: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  clips: AudioClip[];
}

export interface ProjectData {
  tracks: Track[];
  tempo: number;
  totalDuration: number;
  zoomLevel: number;
  viewportStart: number;
}

export interface ExportSettings {
  format: 'mp3' | 'wav' | 'flac';
  quality: number;
  fileName: string;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  totalDuration: number;
  playhead: number;
}
