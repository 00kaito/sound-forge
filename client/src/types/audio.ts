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

export interface LocalAudioFile {
  id: string;
  file: File;
  name: string;
  duration: number;
  audioBuffer?: AudioBuffer;
  category?: string; // For grouping in library
}

export interface AudioCategory {
  id: string;
  name: string;
  collapsed: boolean;
  fileIds: string[];
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

export interface TranscriptSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

export interface Transcript {
  segments: TranscriptSegment[];
  filename?: string;
}

// Text-to-Speech types
export type TTSEmotion = 
  | "Angry" 
  | "Calm" 
  | "Cheerful" 
  | "Conversational" 
  | "Dramatic" 
  | "Emotional" 
  | "Formal" 
  | "Instructional" 
  | "Narrative" 
  | "Newcast" 
  | "Promo" 
  | "Robotic" 
  | "Sorrowful" 
  | "Terrified";

export interface TTSVoice {
  id: string;
  name: string;
  description: string;
  gender: 'male' | 'female';
  language: string;
}

export interface TTSTextFragment {
  id: string;
  text: string;
  voiceId: string;
  emotion: TTSEmotion;
  order: number;
  speaker?: string;
}

export interface TTSProject {
  id: string;
  name: string;
  fragments: TTSTextFragment[];
  voices: TTSVoice[];
  audioDuration: number; // seconds per fragment estimate
}

export interface TTSGenerationResult {
  fragmentId: string;
  audioBlob: Blob;
  duration: number;
}