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
  const { audioFiles, getAudioFile, loadAudioBuffer, addAudioFile, removeAudioFile, concatenateFiles } = useLocalAudioStorage();
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // For now, we'd need to track selected clips
        // This is a placeholder for future selection functionality
        console.log('Delete key pressed - would delete selected clips');
      }
      if (e.key === ' ') {
        e.preventDefault();
        if (playbackState.isPlaying) {
          pause();
        } else {
          play();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playbackState.isPlaying, play, pause]);

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
    console.log('Editor: addClipToTrack called', { trackId, clipId: clip.id, clipName: clip.name });
    
    // Load the audio file into both local storage and audio engine
    console.log('Editor: Looking for audio file with ID', clip.audioFileId);
    console.log('Editor: Available audio files:', audioFiles.map(f => ({ id: f.id, name: f.name })));
    
    const audioFile = getAudioFile(clip.audioFileId);
    if (!audioFile) {
      console.error('Editor: Audio file not found for clip', clip.audioFileId);
      console.error('Editor: Available audio file IDs:', audioFiles.map(f => f.id));
      toast({
        title: "Audio File Error",
        description: `Audio file not found: ${clip.name}`,
        variant: "destructive"
      });
      return;
    }
    
    console.log('Editor: Found audio file', { id: audioFile.id, name: audioFile.name });

    try {
      // Load buffer in local storage if not already loaded
      if (!audioFile.audioBuffer) {
        console.log('Editor: Loading audio buffer for local storage', clip.name);
        await loadAudioBuffer(audioFile);
      }
      
      // Load into audio engine for playback - CRITICAL STEP
      if (isInitialized) {
        console.log('Editor: Loading audio file into engine', clip.audioFileId);
        const buffer = await loadAudioFile(clip.audioFileId, audioFile.file);
        console.log('Editor: Audio buffer loaded successfully into engine', { 
          id: clip.audioFileId, 
          duration: buffer.duration,
          channels: buffer.numberOfChannels
        });
      } else {
        console.error('Editor: Audio engine not initialized!');
        throw new Error('Audio engine not initialized');
      }
    } catch (error) {
      console.error('Editor: Failed to load audio:', error);
      toast({
        title: "Audio Loading Error",
        description: `Failed to load ${clip.name} for playback`,
        variant: "destructive"
      });
      return;
    }
    
    // Only add clip after successful audio loading
    console.log('Editor: Adding clip to tracks state');
    setTracks(prevTracks => {
      const newTracks = prevTracks.map(track =>
        track.id === trackId
          ? { ...track, clips: [...track.clips, clip] }
          : track
      );
      console.log('Editor: New tracks state', newTracks.map(t => ({ id: t.id, clipCount: t.clips.length })));
      return newTracks;
    });
  };

  const updateClip = (clipId: string, updates: Partial<AudioClip>) => {
    setTracks(tracks.map(track => ({
      ...track,
      clips: track.clips.map(clip =>
        clip.id === clipId ? { ...clip, ...updates } : clip
      )
    })));
  };
  
  const updateProjectData = (updates: Partial<ProjectData>) => {
    setProjectData(prev => ({ ...prev, ...updates }));
  };

  const deleteClip = (clipId: string) => {
    console.log('Editor: Deleting clip', clipId);
    setTracks(prevTracks => {
      const newTracks = prevTracks.map(track => ({
        ...track,
        clips: track.clips.filter(clip => clip.id !== clipId)
      }));
      console.log('Editor: Tracks after deletion', newTracks.map(t => ({ id: t.id, clipCount: t.clips.length })));
      return newTracks;
    });
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
        totalDuration,
        (progress) => {
          // Progress will be updated in ExportModal automatically
          console.log(`Export progress: ${progress}%`);
        }
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
          audioFiles={audioFiles}
          addAudioFile={addAudioFile}
          removeAudioFile={removeAudioFile}
          concatenateFiles={concatenateFiles}
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
          onUpdateProjectData={updateProjectData}
          onSeekTo={seekTo}
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
