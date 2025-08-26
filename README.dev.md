# AudioForge Developer Guide

## 🏗️ Architektura aplikacji

AudioForge jest kompleksowym edytorem audio zbudowanym w architekturze komponentowej z centralnym zarządzaniem stanem audio. System został zaprojektowany dla wysokiej wydajności przy pracy z długimi plikami audio (30+ minut).

### 🔧 Główne klasy i komponenty

## 📦 Core Audio Classes

### `AudioEngine` (`client/src/lib/audio-engine.ts`)

**Podstawowa klasa** obsługująca wszystkie operacje audio za pomocą Web Audio API.

**Kluczowe właściwości:**
```typescript
private audioContext: AudioContext | null = null;
private masterGain: GainNode | null = null;
private tracks: Map<string, AudioBuffer> = new Map(); // Cached audio buffers
private trackGains: Map<string, GainNode> = new Map(); // Track volume controls
private trackPans: Map<string, StereoPannerNode> = new Map(); // Track pan controls
private currentSources: AudioBufferSourceNode[] = []; // Active audio sources
```

**Najważniejsze metody:**
- `initialize()` - Inicjalizuje AudioContext i master gain
- `loadAudioFile(id, file)` - Dekoduje i cache'uje buffer audio
- `getAudioBuffer(id)` - Zwraca bufor audio dla ID
- `play()` / `pause()` / `stop()` - Kontrola odtwarzania
- `setTimelineData(tracks, clips)` - Aktualizuje dane timeline
- `createTrackGain(trackId)` - Tworzy węzły gain/pan dla ścieżki
- `scheduleClips()` - Scheduluje odtwarzanie klipów z fade in/out
- `exportAudio()` - Renderuje timeline do AudioBuffer

**Wzorzec komunikacji:**
AudioEngine jest singleton'em zarządzanym przez `useAudioEngine` hook. Wszystkie komponenty komunikują się z nim przez hook, a nie bezpośrednio.

### `useAudioEngine` (`client/src/hooks/use-audio-engine.tsx`)

**React Hook** opakowujący AudioEngine w interfejs React'a.

**Główne funkcje:**
- Zarządza lifecycle AudioEngine (inicjalizacja, cleanup)
- Synchronizuje stan playback z React state
- Udostępnia callback'i dla komponentów
- Automatyczne aktualizacje stanu co 50ms

**Wzorzec użycia:**
```typescript
const { 
  initialize, isInitialized, playbackState,
  loadAudioFile, getAudioBuffer,
  play, pause, stop, seekTo,
  setTrackVolume, setTrackPan, createTrackGain 
} = useAudioEngine();
```

## 🗂️ Storage & State Management

### `useLocalAudioStorage` (`client/src/hooks/use-local-audio-storage.tsx`)

**Hook zarządzający** plikami audio w browser storage.

**Kluczowe funkcje:**
- `addAudioFile(file)` - Dodaje plik, detektuje duration
- `getAudioFile(id)` - Pobiera metadane pliku
- `loadAudioBuffer(audioFile)` - Ładuje buffer audio do pamięci
- `concatenateFiles()` - Łączy pliki w jeden
- `exportProject()` / `importProject()` - Serializacja projektów

**Wzorzec cache:**
```typescript
interface LocalAudioFile {
  id: string;
  file: File;
  name: string;
  duration: number;
  audioBuffer?: AudioBuffer; // Lazy loaded
}
```

### `useHistory` (`client/src/hooks/use-history.tsx`)

**Hook implementujący** undo/redo z deep cloning.

**API:**
- `saveState(tracks, action)` - Zapisuje snapshot stanu
- `undo()` / `redo()` - Przywraca poprzedni/następny stan
- `canUndo` / `canRedo` - Boolean flags dla UI
- Max 50 entries w historii

## 🎨 UI Components Architecture

### `Editor` (`client/src/pages/editor.tsx`)

**Główny orchestrator** aplikacji. Zarządza całym stanem i komunikacją między komponentami.

**Stan centralny:**
```typescript
const [tracks, setTracks] = useState<Track[]>([...]); // Timeline tracks
const [projectData, setProjectData] = useState<ProjectData>({...}); // Project settings
const [currentTool, setCurrentTool] = useState<string>('select'); // Active tool
const [transcript, setTranscript] = useState<Transcript | null>(null); // SRT data
```

**Kluczowe funkcje:**
- `addClipToTrack()` - Dodaje klip + ładuje audio do engine
- `updateClip()` - Modyfikuje właściwości klipa
- `splitClip()` - Dzieli klip w wybranym miejscu
- `cutRegion()` - Wycina fragment z timeline
- `handleExport()` - Eksportuje projekt do audio

### `Timeline` (`client/src/components/audio-editor/timeline.tsx`)

**Główny UI timeline** z obsługą zoom, narzędzi i nawigacji.

**Zarządzanie zoom:**
```typescript
const basePixelsPerSecond = 5.33; // 100% = 5min visible
const pixelsPerSecond = basePixelsPerSecond * (zoomLevel / 100);
```

**Kluczowe features:**
- Mouse/scroll zoom (Shift + drag/scroll)
- Auto-fit dla różnych długości audio
- Timeline ruler z adaptive time intervals
- Tool switching (select, cut)
- Drag & drop obsługa

### `WaveformCanvas` (`client/src/components/audio-editor/waveform-canvas.tsx`)

**Canvas component** odpowiedzialny za interakcje i renderowanie podstawy.

**Obsługuje:**
- Drag & drop klipów między ścieżkami
- Resize klipów (fade handles)
- Selection regions dla cut tool
- Split clip on click
- Track visual rendering (96px height per track)

### `WaveformVisualization` (`client/src/components/audio-editor/waveform-visualization.tsx`)

**Zoptymalizowany renderer** waveform z 3-poziomowym cache.

**Cache system:**
```typescript
interface WaveformCache {
  lowDetail: Float32Array;    // 1/1000 samples - zoom < 100%
  mediumDetail: Float32Array; // 1/200 samples - zoom 100-500%
  highDetail: Float32Array;   // 1/50 samples - zoom > 500%
}
```

**Algorytm renderowania:**
1. Sprawdź cache dla audio file
2. Jeśli brak - procesuj asynchronicznie 
3. Wybierz odpowiedni poziom szczegółów based on zoom
4. Renderuj z enhanced contrast (60% amplitude boost)

## 🔄 Communication Patterns

### Props Drilling Pattern

**Audio Buffer Sharing:**
```
Editor (useAudioEngine.getAudioBuffer)
  ↓ props
Timeline (getAudioBuffer prop)
  ↓ props  
WaveformCanvas (getAudioBuffer prop)
  ↓ props
WaveformVisualization (receives buffer via prop)
```

**Dlaczego nie Context?** 
- Potrzebujemy kontroli nad re-renders
- Buffer sharing musi być synchroniczne
- Performance-critical path

### Event Callback Pattern

**Timeline → Editor communication:**
```typescript
// Timeline passes events up to Editor
<Timeline
  onUpdateClip={(clipId, updates) => updateClip(clipId, updates)}
  onDeleteClip={(clipId) => deleteClip(clipId)} 
  onSplitClip={(clipId, time) => splitClip(clipId, time)}
  onAddClipToTrack={(trackId, clip) => addClipToTrack(trackId, clip)}
/>
```

### State Synchronization

**Audio Engine ↔ React sync:**
```typescript
// Hook updates React state from Audio Engine every 50ms
useEffect(() => {
  const interval = setInterval(() => {
    const state = engineRef.current!.getPlaybackState();
    setPlaybackState(state); // Triggers re-render
  }, 50);
}, [isInitialized]);
```

## 🎯 Case Studies - Feature Implementation

### Case Study 1: Dodanie nowego narzędzia "Volume Automation"

**User Story:** 
> Jako editor audiobooka chcę móc dodawać punkty automatyzacji głośności do klipów, żeby płynnie regulować volume podczas odtwarzania.

**Pliki do modyfikacji:**

**1. Types (`client/src/types/audio.ts`)**
```typescript
interface AutomationPoint {
  time: number; // relative to clip start
  value: number; // 0-1 volume multiplier
}

interface AudioClip {
  // existing fields...
  volumeAutomation?: AutomationPoint[];
}
```

**2. Timeline Tools (`client/src/components/audio-editor/timeline.tsx`)**
```typescript
// Add new tool button
<Button
  onClick={() => onToolChange?.('volume-automation')}
  variant={currentTool === 'volume-automation' ? "default" : "outline"}
>
  <TrendingUp className="w-4 h-4" />
</Button>
```

**3. WaveformCanvas interaction (`client/src/components/audio-editor/waveform-canvas.tsx`)**
```typescript
const handleCanvasClick = (e: React.MouseEvent) => {
  if (currentTool === 'volume-automation') {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Find clicked clip
    const clickedClip = findClipAtPosition(x, y);
    if (clickedClip) {
      // Calculate relative time and volume value
      const relativeTime = (x - clipStartPixel) / pixelsPerSecond;
      const volumeValue = 1 - (y - trackY) / TRACK_HEIGHT;
      
      // Add automation point
      onAddAutomationPoint?.(clickedClip.id, relativeTime, volumeValue);
    }
  }
};
```

**4. Audio Engine scheduling (`client/src/lib/audio-engine.ts`)**
```typescript
private scheduleClips(): void {
  // existing code...
  
  // Apply volume automation if present
  if (clip.volumeAutomation && clip.volumeAutomation.length > 0) {
    for (const point of clip.volumeAutomation) {
      const timeInAudioContext = sourceStartTime + point.time;
      const volume = clipVolume * point.value;
      clipGainNode.gain.setValueAtTime(volume, timeInAudioContext);
    }
  }
}
```

**5. Editor orchestration (`client/src/pages/editor.tsx`)**
```typescript
const addAutomationPoint = (clipId: string, time: number, value: number) => {
  saveState(tracks, 'Add volume automation');
  
  setTracks(tracks.map(track => ({
    ...track,
    clips: track.clips.map(clip => {
      if (clip.id === clipId) {
        const automation = clip.volumeAutomation || [];
        return {
          ...clip,
          volumeAutomation: [...automation, { time, value }].sort((a, b) => a.time - b.time)
        };
      }
      return clip;
    })
  })));
};
```

### Case Study 2: Implementacja eksportu do MP3

**User Story:**
> Jako użytkownik chcę eksportować projekt do formatu MP3 z konfigurowalnymi ustawieniami jakości.

**Pliki do modyfikacji:**

**1. Export Types (`client/src/types/audio.ts`)**
```typescript
interface ExportSettings {
  format: 'wav' | 'mp3';
  mp3Quality?: 'high' | 'medium' | 'low'; // 320kbps, 192kbps, 128kbps
  mp3Mode?: 'cbr' | 'vbr'; // Constant/Variable Bitrate
}
```

**2. Export Modal UI (`client/src/components/audio-editor/export-modal.tsx`)**
```typescript
// Add MP3 settings section
{settings.format === 'mp3' && (
  <div className="space-y-4">
    <div>
      <Label>Quality</Label>
      <Select 
        value={settings.mp3Quality} 
        onValueChange={(value) => updateSettings({mp3Quality: value})}
      >
        <SelectItem value="high">High (320kbps)</SelectItem>
        <SelectItem value="medium">Medium (192kbps)</SelectItem>
        <SelectItem value="low">Low (128kbps)</SelectItem>
      </Select>
    </div>
  </div>
)}
```

**3. Install MP3 Encoder (`package.json`)**
```bash
npm install lamejs @types/lamejs
```

**4. MP3 Encoding (`client/src/lib/mp3-encoder.ts`)**
```typescript
import lamejs from 'lamejs';

export class MP3Encoder {
  static audioBufferToMp3Blob(
    audioBuffer: AudioBuffer, 
    quality: 'high' | 'medium' | 'low' = 'medium'
  ): Blob {
    const bitrates = { high: 320, medium: 192, low: 128 };
    const bitrate = bitrates[quality];
    
    const mp3encoder = new lamejs.Mp3Encoder(
      audioBuffer.numberOfChannels,
      audioBuffer.sampleRate,
      bitrate
    );
    
    const samples = new Int16Array(audioBuffer.length * audioBuffer.numberOfChannels);
    
    // Convert float32 to int16
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      for (let i = 0; i < audioBuffer.length; i++) {
        samples[i * audioBuffer.numberOfChannels + channel] = channelData[i] * 0x7FFF;
      }
    }
    
    const mp3Data = [];
    const sampleBlockSize = 1152;
    
    for (let i = 0; i < samples.length; i += sampleBlockSize) {
      const sampleChunk = samples.subarray(i, i + sampleBlockSize);
      const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
      if (mp3buf.length > 0) mp3Data.push(mp3buf);
    }
    
    const mp3buf = mp3encoder.flush();
    if (mp3buf.length > 0) mp3Data.push(mp3buf);
    
    return new Blob(mp3Data, { type: 'audio/mp3' });
  }
}
```

**5. Export Integration (`client/src/pages/editor.tsx`)**
```typescript
const handleExport = async (settings: ExportSettings) => {
  // existing rendering code...
  
  let audioBlob: Blob;
  
  if (settings.format === 'mp3') {
    audioBlob = MP3Encoder.audioBufferToMp3Blob(
      renderedBuffer, 
      settings.mp3Quality
    );
  } else {
    audioBlob = await AudioConcatenator.audioBufferToWavBlob(renderedBuffer);
  }
  
  // Download logic...
};
```

### Case Study 3: Panel transkrypcji z click-to-seek

**User Story:**
> Jako editor audiobooka chcę widzieć transkrypcję (SRT) w panelu bocznym i móc kliknąć segment żeby przeskoczyć do tego momentu w audio.

**Pliki do implementacji:**

**1. Transcript Types (`client/src/types/audio.ts`)**
```typescript
interface TranscriptSegment {
  id: string;
  startTime: number; // seconds
  endTime: number;   // seconds  
  text: string;
  speaker?: string;
}

interface Transcript {
  segments: TranscriptSegment[];
  language?: string;
}
```

**2. SRT Parser Enhancement (`client/src/lib/transcript-parser.ts`)**
```typescript
export function parseSRTWithSpeakers(content: string): Transcript {
  const segments: TranscriptSegment[] = [];
  const blocks = content.split('\n\n').filter(block => block.trim());
  
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length >= 3) {
      const id = lines[0].trim();
      const timecode = lines[1].trim();
      const text = lines.slice(2).join(' ').trim();
      
      // Parse speaker from text like "[Speaker 1]: Hello world"
      const speakerMatch = text.match(/^\[([^\]]+)\]:\s*(.+)$/);
      const speaker = speakerMatch ? speakerMatch[1] : undefined;
      const cleanText = speakerMatch ? speakerMatch[2] : text;
      
      const times = parseTimecode(timecode);
      if (times) {
        segments.push({
          id,
          startTime: times.start,
          endTime: times.end,
          text: cleanText,
          speaker
        });
      }
    }
  }
  
  return { segments };
}
```

**3. Transcript Panel Component (`client/src/components/audio-editor/transcript-panel.tsx`)**
```typescript
interface TranscriptPanelProps {
  transcript: Transcript | null;
  currentTime: number;
  onSeekTo: (time: number) => void;
  isVisible: boolean;
  width: number;
}

export function TranscriptPanel({ transcript, currentTime, onSeekTo, isVisible, width }: TranscriptPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  if (!isVisible || !transcript) return null;
  
  const filteredSegments = transcript.segments.filter(segment =>
    segment.text.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const handleSegmentClick = (segment: TranscriptSegment) => {
    onSeekTo(segment.startTime);
  };
  
  return (
    <div className="h-full flex flex-col bg-slate-900 border-l border-gray-700" style={{ width }}>
      {/* Search */}
      <div className="p-4 border-b border-gray-700">
        <Input
          placeholder="Search transcript..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      {/* Segments */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredSegments.map((segment) => {
          const isActive = currentTime >= segment.startTime && currentTime <= segment.endTime;
          
          return (
            <div
              key={segment.id}
              className={`p-3 mb-2 rounded cursor-pointer transition-colors ${
                isActive 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-800 hover:bg-slate-700 text-gray-300'
              }`}
              onClick={() => handleSegmentClick(segment)}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs text-blue-400">
                  {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                </span>
                {segment.speaker && (
                  <span className="text-xs bg-purple-600 px-2 py-0.5 rounded">
                    {segment.speaker}
                  </span>
                )}
              </div>
              <p className="text-sm">{segment.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**4. Editor Integration (`client/src/pages/editor.tsx`)**
```typescript
// Add transcript panel state
const [transcript, setTranscript] = useState<Transcript | null>(null);
const [isTranscriptVisible, setIsTranscriptVisible] = useState(false);
const [transcriptPanelWidth, setTranscriptPanelWidth] = useState(350);

const handleImportTranscript = async () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.srt';
  
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    
    try {
      const content = await file.text();
      const parsedTranscript = parseSRTWithSpeakers(content);
      setTranscript(parsedTranscript);
      setIsTranscriptVisible(true);
      
      toast({
        title: "Transcript Imported",
        description: `Loaded ${parsedTranscript.segments.length} segments`
      });
    } catch (error) {
      toast({
        title: "Import Error",
        description: "Failed to parse SRT file",
        variant: "destructive"
      });
    }
  };
  
  input.click();
};

// In render:
<div className="flex-1 flex">
  <div className={`flex-1 ${isTranscriptVisible ? 'mr-2' : ''}`}>
    <Timeline {...timelineProps} />
  </div>
  
  {isTranscriptVisible && (
    <TranscriptPanel
      transcript={transcript}
      currentTime={playbackState.currentTime}
      onSeekTo={seekTo}
      isVisible={isTranscriptVisible}
      width={transcriptPanelWidth}
    />
  )}
</div>
```

## 🚀 Performance Considerations

### Waveform Rendering

**Problem:** Renderowanie 30+ min audio blokuje UI
**Rozwiązanie:** Multi-resolution async processing
```typescript
// Process in chunks with setTimeout to avoid blocking
setTimeout(() => {
  const waveformData = processAudioBuffer(audioBuffer);
  setCache(audioFileId, waveformData);
}, 0);
```

### Audio Buffer Memory

**Problem:** Multiple buffers mogą zużywać GB RAM
**Rozwiązanie:** Lazy loading + cache cleanup
```typescript
// Load buffer only when needed for playback/visualization
if (!audioFile.audioBuffer && needsBuffer) {
  await loadAudioBuffer(audioFile);
}
```

### React Re-renders

**Problem:** Audio state updates powodują re-renders całego UI
**Rozwiązanie:** Selective memoization
```typescript
const WaveformCanvas = memo(({ tracks, ...props }) => {
  // Only re-render when tracks actually change
}, (prevProps, nextProps) => {
  return JSON.stringify(prevProps.tracks) === JSON.stringify(nextProps.tracks);
});
```

## 🔧 Development Setup

### Hot Reload Audio Engine

**Problem:** HMR resetuje Audio Engine i LocalStorage
**Workaround:** Re-import files after każdym HMR

### Debug Audio Issues

```typescript
// Enable verbose audio logging
localStorage.setItem('audioDebug', 'true');

// Check Audio Engine state
console.log('Loaded buffers:', Array.from(engineRef.current.tracks.keys()));
console.log('Track gains:', Array.from(engineRef.current.trackGains.keys()));
```

### Testing z długimi plikami

```typescript
// Generate test audio buffer
function createTestBuffer(durationSec: number): AudioBuffer {
  const sampleRate = 44100;
  const buffer = audioContext.createBuffer(2, durationSec * sampleRate, sampleRate);
  
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.1;
    }
  }
  return buffer;
}
```

Ten guide powinien dostarczyć solid foundation dla nowych developerów do rozwijania AudioForge dalej! 🎵