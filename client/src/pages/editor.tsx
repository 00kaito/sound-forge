import { useState, useEffect } from 'react';
import { useAudioEngine } from '@/hooks/use-audio-engine';
import { useLocalAudioStorage } from '@/hooks/use-local-audio-storage';
import { AudioConcatenator } from '@/lib/audio-concatenator';
import { Toolbar } from '@/components/audio-editor/toolbar';
import { Sidebar } from '@/components/audio-editor/sidebar';
import { Timeline } from '@/components/audio-editor/timeline';
import { ExportModal } from '@/components/audio-editor/export-modal';
import { Track, AudioClip, ProjectData, ExportSettings } from '@/types/audio';
import { useToast } from '@/hooks/use-toast';

export default function AudioEditor() {
  const { 
    initialize, 
    isInitialized, 
    playbackState, 
    error: audioError, 
    loadAudioFile, 
    exportAudio, 
    play, 
    pause, 
    stop, 
    seekTo,
    setTimelineData
  } = useAudioEngine();
  const { audioFiles, getAudioFile, loadAudioBuffer } = useLocalAudioStorage();
  const { toast } = useToast();
  
  const [tracks, setTracks] = useState<Track[]>([
    {
      id: 'track-1',
      name: 'Track 1',
      volume: 0.75,
      pan: 0,
      muted: false,
      solo: false,
      clips: []
    },
    {
      id: 'track-2', 
      name: 'Track 2',
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
      clips: []
    },
    {
      id: 'track-3',
      name: 'Track 3',
      volume: 0.75,
      pan: 0,
      muted: false,
      solo: false,
      clips: []
    }
  ]);

  const [projectData, setProjectData] = useState<ProjectData>({
    tracks,
    tempo: 120,
    totalDuration: 0,
    zoomLevel: 1,
    viewportStart: 0
  });

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [currentTool, setCurrentTool] = useState<string>('select');

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (audioError) {
      toast({
        title: "Audio Error",
        description: audioError,
        variant: "destructive"
      });
    }
  }, [audioError, toast]);

  // Update timeline data in audio engine whenever tracks change
  useEffect(() => {
    if (isInitialized) {
      const allClips = tracks.flatMap(track => track.clips);
      setTimelineData(tracks, allClips);
    }
  }, [tracks, isInitialized, setTimelineData]);

  const addTrack = () => {
    const newTrack: Track = {
      id: `track-${tracks.length + 1}`,
      name: `Track ${tracks.length + 1}`,
      volume: 0.75,
      pan: 0,
      muted: false,
      solo: false,
      clips: []
    };
    setTracks([...tracks, newTrack]);
  };

  const updateTrack = (trackId: string, updates: Partial<Track>) => {
    setTracks(tracks.map(track => 
      track.id === trackId ? { ...track, ...updates } : track
    ));
  };

  const addClipToTrack = async (trackId: string, clip: AudioClip) => {
    // Load the audio file into both local storage and audio engine
    const audioFile = getAudioFile(clip.audioFileId);
    if (audioFile) {
      try {
        // Load buffer in local storage if not already loaded
        if (!audioFile.audioBuffer) {
          await loadAudioBuffer(audioFile);
        }
        
        // Load into audio engine for playback
        if (isInitialized) {
          await loadAudioFile(clip.audioFileId, audioFile.file);
        }
      } catch (error) {
        console.error('Failed to load audio buffer:', error);
        toast({
          title: "Audio Loading Error",
          description: "Failed to load audio file for playback",
          variant: "destructive"
        });
        return;
      }
    }
    
    setTracks(tracks.map(track =>
      track.id === trackId
        ? { ...track, clips: [...track.clips, clip] }
        : track
    ));
  };

  const updateClip = (clipId: string, updates: Partial<AudioClip>) => {
    setTracks(tracks.map(track => ({
      ...track,
      clips: track.clips.map(clip =>
        clip.id === clipId ? { ...clip, ...updates } : clip
      )
    })));
  };

  const deleteClip = (clipId: string) => {
    setTracks(tracks.map(track => ({
      ...track,
      clips: track.clips.filter(clip => clip.id !== clipId)
    })));
  };

  const handleExport = async (settings: ExportSettings) => {
    try {
      toast({
        title: "Export Started",
        description: "Your audio is being processed..."
      });

      // Calculate total duration
      const allClips = tracks.flatMap(track => track.clips);
      const totalDuration = Math.max(
        ...allClips.map(clip => clip.startTime + clip.duration),
        10 // Minimum 10 seconds
      );

      if (allClips.length === 0) {
        toast({
          title: "Nothing to Export",
          description: "Please add some audio clips to the timeline first.",
          variant: "destructive"
        });
        return;
      }

      // Load audio buffers for all clips
      for (const track of tracks) {
        for (const clip of track.clips) {
          const audioFile = getAudioFile(clip.audioFileId);
          if (audioFile && !audioFile.audioBuffer) {
            await loadAudioBuffer(audioFile);
          }
        }
      }

      // Create audio context for rendering
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Get audio buffer function
      const getBufferFn = (id: string) => {
        const audioFile = getAudioFile(id);
        return audioFile?.audioBuffer;
      };

      // Render timeline to audio buffer using our advanced concatenator
      const renderedBuffer = await AudioConcatenator.renderTimeline(
        audioContext,
        tracks,
        allClips,
        getBufferFn,
        totalDuration
      );
      
      // Convert to WAV and download
      const wavBlob = AudioConcatenator.audioBufferToWavBlob(renderedBuffer);
      AudioConcatenator.downloadBlob(wavBlob, `${settings.fileName}.${settings.format}`);
      
      toast({
        title: "Export Complete",
        description: `${settings.fileName}.${settings.format} has been downloaded.`
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "There was an error exporting your audio.",
        variant: "destructive"
      });
    }
  };


  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  if (!isInitialized) {
    return (
      <div className="h-screen flex items-center justify-center bg-editor-bg text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue mx-auto mb-4"></div>
          <p>Initializing Audio Engine...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-editor-bg text-white font-inter overflow-hidden audio-editor">
      <Toolbar
        playbackState={playbackState}
        formatTime={formatTime}
        onExport={() => setIsExportModalOpen(true)}
        onPlay={play}
        onPause={pause}
        onStop={stop}
        onSeekToStart={() => seekTo(0)}
        data-testid="toolbar"
      />
      
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          tracks={tracks}
          onAddTrack={addTrack}
          onAddClipToTrack={addClipToTrack}
          currentTool={currentTool}
          onToolChange={setCurrentTool}
          data-testid="sidebar"
        />
        
        <Timeline
          tracks={tracks}
          playbackState={playbackState}
          projectData={projectData}
          onUpdateTrack={updateTrack}
          onAddClipToTrack={addClipToTrack}
          onUpdateClip={updateClip}
          onDeleteClip={deleteClip}
          formatTime={formatTime}
          data-testid="timeline"
        />
      </div>

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExport}
        data-testid="export-modal"
      />
    </div>
  );
}
