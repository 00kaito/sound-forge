import { useState, useEffect, useCallback } from 'react';
import { useAudioEngine } from '@/hooks/use-audio-engine';
import { useLocalAudioStorage } from '@/hooks/use-local-audio-storage';
import { useHistory } from '@/hooks/use-history';
import { AudioConcatenator } from '@/lib/audio-concatenator';
import { Toolbar } from '@/components/audio-editor/toolbar';
import { Sidebar } from '@/components/audio-editor/sidebar';
import { Timeline } from '@/components/audio-editor/timeline';
import { ExportModal } from '@/components/audio-editor/export-modal';
import { TranscriptPanel } from '@/components/audio-editor/transcript-panel';
import { EffectsModal } from '@/components/audio-editor/effects-modal';
import { TTSImportDialog } from '@/components/audio-editor/tts-import-dialog';
import { loadSRTFile } from '@/lib/transcript-parser';
import { TTSService } from '@/lib/tts-service';
import { Track, AudioClip, ProjectData, ExportSettings, Transcript, TranscriptSegment, TTSVoice, TTSTextFragment, TTSGenerationResult } from '@/types/audio';
import { useToast } from '@/hooks/use-toast';

export default function AudioEditor() {
  const { 
    initialize, 
    isInitialized, 
    playbackState, 
    error: audioError, 
    loadAudioFile, 
    getAudioBuffer,
    exportAudio, 
    play, 
    pause, 
    stop, 
    seekTo,
    setTimelineData,
    setTrackVolume,
    setTrackPan,
    createTrackGain
  } = useAudioEngine();
  const { audioFiles, getAudioFile, loadAudioBuffer, addAudioFile, removeAudioFile, concatenateFiles, exportProject, importProject } = useLocalAudioStorage();
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

  // History management for undo/redo
  const { saveState, undo, redo, canUndo, canRedo, getPreviousAction, getNextAction } = useHistory(tracks);

  const [projectData, setProjectData] = useState<ProjectData>({
    tracks,
    tempo: 120,
    totalDuration: 0,
    zoomLevel: 1,
    viewportStart: 0
  });

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [currentTool, setCurrentTool] = useState<string>('select');
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [loadingTracks, setLoadingTracks] = useState<Set<string>>(new Set());

  // Transcript state
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [isTranscriptVisible, setIsTranscriptVisible] = useState(false);
  const [transcriptPanelWidth, setTranscriptPanelWidth] = useState(350);

  // Effects modal state
  const [isEffectsModalOpen, setIsEffectsModalOpen] = useState(false);

  // TTS modal state
  const [isTTSModalOpen, setIsTTSModalOpen] = useState(false);
  const [isTTSGenerating, setIsTTSGenerating] = useState(false);
  const [ttsProgress, setTTSProgress] = useState({ completed: 0, total: 0 });

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Keyboard shortcuts including undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo/Redo shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) {
          const restoredTracks = undo();
          if (restoredTracks) {
            setTracks(restoredTracks);
            const action = getPreviousAction();
            toast({
              title: "Undo",
              description: `Undone: ${action}`
            });
          }
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (canRedo) {
          const restoredTracks = redo();
          if (restoredTracks) {
            setTracks(restoredTracks);
            const action = getNextAction();
            toast({
              title: "Redo",
              description: `Redone: ${action}`
            });
          }
        }
        return;
      }

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
  }, [playbackState.isPlaying, play, pause, canUndo, canRedo, undo, redo, getPreviousAction, getNextAction, toast]);

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
      // Create track gains for all tracks
      tracks.forEach(track => {
        createTrackGain(track.id);
        // Initialize track settings in audio engine
        setTrackVolume(track.id, track.muted ? 0 : track.volume);
        setTrackPan(track.id, track.pan);
      });

      const allClips = tracks.flatMap(track => track.clips);
      setTimelineData(tracks, allClips);

      console.log('Audio Engine: Initialized track gains and settings');
    }
  }, [tracks, isInitialized, setTimelineData, createTrackGain, setTrackVolume, setTrackPan]);

  const addTrack = () => {
    const newTrack: Track = {
      id: `track-${Date.now()}`,
      name: `Track ${tracks.length + 1}`,
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
      clips: []
    };
    setTracks([...tracks, newTrack]);

    // Create audio engine track
    if (isInitialized) {
      createTrackGain(newTrack.id);
      // Set initial volume and pan
      setTrackVolume(newTrack.id, newTrack.volume);
      setTrackPan(newTrack.id, newTrack.pan);
    }
  };

  const deleteTrack = (trackId: string) => {
    if (tracks.length <= 1) {
      toast({
        title: "Cannot Delete Track",
        description: "You must have at least one track in your project.",
        variant: "destructive"
      });
      return;
    }

    const trackToDelete = tracks.find(track => track.id === trackId);
    if (!trackToDelete) return;

    const clipCount = trackToDelete.clips.length;

    // Save state before deleting track
    saveState(tracks, `Delete track: ${trackToDelete.name}`);

    // Remove track and its clips
    setTracks(prevTracks => prevTracks.filter(track => track.id !== trackId));

    toast({
      title: "Track Deleted",
      description: `Deleted "${trackToDelete.name}" with ${clipCount} clip(s).`,
      variant: "destructive"
    });
  };


  const updateTrack = (trackId: string, updates: Partial<Track>) => {
    setTracks(tracks.map(track => 
      track.id === trackId ? { ...track, ...updates } : track
    ));

    // Update audio engine with new track settings
    if (isInitialized) {
      // Create track gain if it doesn't exist
      createTrackGain(trackId);

      // Apply volume changes
      if (updates.volume !== undefined) {
        setTrackVolume(trackId, updates.volume);
        console.log('Track volume updated:', trackId, updates.volume);
      }

      // Apply pan changes
      if (updates.pan !== undefined) {
        setTrackPan(trackId, updates.pan);
        console.log('Track pan updated:', trackId, updates.pan);
      }

      // Handle mute/solo changes - need to update all tracks
      if (updates.muted !== undefined || updates.solo !== undefined) {
        // Get current tracks state with this update applied
        const updatedTracks = tracks.map(track => 
          track.id === trackId ? { ...track, ...updates } : track
        );

        const hasSoloedTracks = updatedTracks.some(t => t.solo);

        // Apply solo/mute logic to all tracks immediately
        updatedTracks.forEach(track => {
          let effectiveVolume = track.volume;

          if (track.muted) {
            effectiveVolume = 0;
          } else if (hasSoloedTracks) {
            // If any track is solo'd, non-solo tracks should be muted
            effectiveVolume = track.solo ? track.volume : 0;
          }

          setTrackVolume(track.id, effectiveVolume);
        });

        console.log('All tracks mute/solo updated:', { 
          hasSoloedTracks,
          updatedTrackId: trackId,
          tracks: updatedTracks.map(t => ({ 
            id: t.id, 
            muted: t.muted, 
            solo: t.solo, 
            effectiveVolume: t.muted ? 0 : (hasSoloedTracks ? (t.solo ? t.volume : 0) : t.volume)
          }))
        });
      }
    }
  };

  const addClipToTrack = async (trackId: string, clip: AudioClip) => {
    console.log('Editor: addClipToTrack called', { trackId, clipId: clip.id, clipName: clip.name });

    // Add track to loading state
    setLoadingTracks(prev => new Set(prev).add(trackId));

    // Check if this will be the first clip in the entire project
    const totalClips = tracks.flatMap(track => track.clips).length;
    const isFirstClip = totalClips === 0;
    console.log('Editor: Is first clip?', isFirstClip, 'Total clips:', totalClips);

    // Load the audio file into both local storage and audio engine
    console.log('Editor: Looking for audio file with ID', clip.audioFileId);
    console.log('Editor: Available audio files:', audioFiles.map(f => ({ id: f.id, name: f.name })));

    const audioFile = getAudioFile(clip.audioFileId);
    if (!audioFile) {
      console.error('Editor: Audio file not found for clip', clip.audioFileId);
      console.error('Editor: Available audio file IDs:', audioFiles.map(f => f.id));
      setLoadingTracks(prev => {
        const newSet = new Set(prev);
        newSet.delete(trackId);
        return newSet;
      });
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
        // Use cached buffer if available to avoid re-decoding
        const bufferToLoad = audioFile.audioBuffer || audioFile.file;
        const buffer = await loadAudioFile(clip.audioFileId, bufferToLoad);
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
      setLoadingTracks(prev => {
        const newSet = new Set(prev);
        newSet.delete(trackId);
        return newSet;
      });
      toast({
        title: "Audio Loading Error",
        description: `Failed to load ${clip.name} for playback`,
        variant: "destructive"
      });
      return;
    }

    // Only add clip after successful audio loading
    console.log('Editor: Adding clip to tracks state');

    // Save state before adding new clip
    saveState(tracks, `Add ${clip.name} to track`);

    setTracks(prevTracks => {
      const newTracks = prevTracks.map(track =>
        track.id === trackId
          ? { ...track, clips: [...track.clips, clip] }
          : track
      );
      console.log('Editor: New tracks state', newTracks.map(t => ({ id: t.id, clipCount: t.clips.length })));
      return newTracks;
    });

    // Auto-fit after adding the first clip
    if (isFirstClip) {
      console.log('Editor: Auto-fitting after first clip');
      // Delay auto-fit slightly to ensure tracks state is updated
      setTimeout(() => {
        // Calculate auto-fit zoom based on new audio duration
        const maxEndTime = clip.startTime + clip.duration;
        const availableWidth = 1600; // Approximate timeline width
        const paddedWidth = availableWidth - 100;
        const targetPixelsPerSecond = paddedWidth / maxEndTime;
        const newZoom = Math.max(0.01, Math.min(800, targetPixelsPerSecond));

        updateProjectData({ zoomLevel: newZoom });
        console.log('Editor: Auto-fit zoom applied:', newZoom);
      }, 100);
    }

    // Remove track from loading state
    setLoadingTracks(prev => {
      const newSet = new Set(prev);
      newSet.delete(trackId);
      return newSet;
    });
  };

  const updateClip = (clipId: string, updates: Partial<AudioClip>) => {
    // Only save state for duration changes, not position changes during drag
    const isDurationChange = updates.duration !== undefined;
    if (isDurationChange) {
      saveState(tracks, 'Resize clip');
    }

    setTracks(tracks.map(track => ({
      ...track,
      clips: track.clips.map(clip =>
        clip.id === clipId ? { ...clip, ...updates } : clip
      )
    })));
  };

  const handleClipMove = (clipId: string, newStartTime: number) => {
    updateClip(clipId, { startTime: newStartTime });
  };

  const handleClipResize = (clipId: string, newDuration: number) => {
    updateClip(clipId, { duration: newDuration });
  };

  const handleTrackVolumeChange = (trackId: string, volume: number) => {
    updateTrack(trackId, { volume });
  };

  const handleTrackPanChange = (trackId: string, pan: number) => {
    updateTrack(trackId, { pan });
  };

  const handleTrackMuteToggle = (trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (track) {
      updateTrack(trackId, { muted: !track.muted });
    }
  };

  const handleTrackSoloToggle = (trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (track) {
      updateTrack(trackId, { solo: !track.solo });
    }
  };

  // Split clip at a specific time (for cut tool)
  const splitClip = (clipId: string, splitTime: number) => {
    // Save state before splitting for undo
    saveState(tracks, 'Split clip');

    setTracks(tracks.map(track => ({
      ...track,
      clips: track.clips.flatMap(clip => {
        if (clip.id !== clipId) return clip;

        // Calculate split position relative to clip start
        const relativeTime = splitTime - clip.startTime;
        if (relativeTime <= 0 || relativeTime >= clip.duration) return clip;

        // Create two new clips
        const firstClip: AudioClip = {
          ...clip,
          id: `${clip.id}_part1`,
          duration: relativeTime,
          fadeOut: 0 // Reset fade out for first part
        };

        const secondClip: AudioClip = {
          ...clip,
          id: `${clip.id}_part2`,
          startTime: splitTime,
          offset: clip.offset + relativeTime,
          duration: clip.duration - relativeTime,
          fadeIn: 0 // Reset fade in for second part
        };

        return [firstClip, secondClip];
      })
    })));

    toast({
      title: "Clip Split",
      description: "Clip has been split at the selected position"
    });
  };

  // Cut out selected region (for cut tool)
  const cutRegion = (trackId: string, startTime: number, endTime: number) => {
    if (startTime >= endTime) return;

    // Save state before cutting for undo
    saveState(tracks, `Cut region ${startTime.toFixed(2)}s-${endTime.toFixed(2)}s`);

    setTracks(tracks.map(track => {
      if (track.id !== trackId) return track;

      return {
        ...track,
        clips: track.clips.flatMap(clip => {
          const clipStart = clip.startTime;
          const clipEnd = clip.startTime + clip.duration;

          // If clip doesn't overlap with cut region, keep it
          if (clipEnd <= startTime || clipStart >= endTime) return clip;

          // If clip is completely within cut region, remove it
          if (clipStart >= startTime && clipEnd <= endTime) return [];

          // If cut region is completely within clip, split into two parts
          if (clipStart < startTime && clipEnd > endTime) {
            const firstPart: AudioClip = {
              ...clip,
              id: `${clip.id}_before_cut`,
              duration: startTime - clipStart,
              fadeOut: 0
            };

            const secondPart: AudioClip = {
              ...clip,
              id: `${clip.id}_after_cut`,
              startTime: startTime, // Moved to where cut ends
              offset: clip.offset + (endTime - clipStart),
              duration: clipEnd - endTime,
              fadeIn: 0
            };

            return [firstPart, secondPart];
          }

          // If cut overlaps beginning of clip
          if (startTime <= clipStart && endTime > clipStart && endTime < clipEnd) {
            return {
              ...clip,
              startTime: endTime,
              offset: clip.offset + (endTime - clipStart),
              duration: clipEnd - endTime,
              fadeIn: 0
            };
          }

          // If cut overlaps end of clip
          if (startTime > clipStart && startTime < clipEnd && endTime >= clipEnd) {
            return {
              ...clip,
              duration: startTime - clipStart,
              fadeOut: 0
            };
          }

          return clip;
        })
      };
    }));

    toast({
      title: "Region Cut",
      description: `Cut region from ${startTime.toFixed(2)}s to ${endTime.toFixed(2)}s`
    });
  };

  // Remove audio file and all associated clips
  const handleRemoveAudioFile = (audioFileId: string) => {
    // Count clips that will be removed
    let removedClipsCount = 0;
    tracks.forEach(track => {
      track.clips.forEach(clip => {
        if (clip.audioFileId === audioFileId) {
          removedClipsCount++;
        }
      });
    });

    // Remove clips from tracks
    setTracks(tracks.map(track => ({
      ...track,
      clips: track.clips.filter(clip => clip.audioFileId !== audioFileId)
    })));

    // Remove from audio storage
    removeAudioFile(audioFileId, (count) => {
      if (removedClipsCount > 0) {
        toast({
          title: "Audio File Removed",
          description: `Removed audio file and ${removedClipsCount} clip(s) from tracks`,
          variant: "destructive"
        });
      }
    });
  };

  const updateProjectData = (updates: Partial<ProjectData>) => {
    setProjectData(prev => ({ ...prev, ...updates }));
  };

  const deleteClip = (clipId: string) => {
    console.log('Editor: Deleting clip', clipId);

    // Save state before deleting clip
    saveState(tracks, 'Delete clip');

    setTracks(prevTracks => {
      const newTracks = prevTracks.map(track => ({
        ...track,
        clips: track.clips.filter(clip => clip.id !== clipId)
      }));
      console.log('Editor: Tracks after deletion', newTracks.map(t => ({ id: t.id, clipCount: t.clips.length })));
      return newTracks;
    });
  };

  const moveClipBetweenTracks = (clipId: string, targetTrackId: string) => {
    console.log('Editor: Moving clip between tracks', { clipId, targetTrackId });

    // Save state before moving clip
    saveState(tracks, 'Move clip between tracks');

    setTracks(prevTracks => {
      // Find the clip and its current track
      let clipToMove: AudioClip | null = null;

      const newTracks = prevTracks.map(track => {
        const clipIndex = track.clips.findIndex(clip => clip.id === clipId);
        if (clipIndex !== -1) {
          // Found the clip, remove it from current track
          clipToMove = track.clips[clipIndex];
          return {
            ...track,
            clips: track.clips.filter(clip => clip.id !== clipId)
          };
        }
        return track;
      });

      // Add the clip to the target track
      if (clipToMove) {
        const finalTracks = newTracks.map(track => {
          if (track.id === targetTrackId) {
            return {
              ...track,
              clips: [...track.clips, clipToMove as AudioClip]
            };
          }
          return track;
        });

        console.log('Editor: Clip moved successfully', {
          clipId,
          fromTrack: prevTracks.find(t => t.clips.some(c => c.id === clipId))?.id,
          toTrack: targetTrackId
        });

        return finalTracks;
      }

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
            console.log('Export: Loading audio buffer for', audioFile.name);
            await loadAudioBuffer(audioFile, (progress) => {
              console.log(`Loading ${audioFile.name}: ${progress}%`);
            });
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

      // Convert to selected format and download
      console.log('Export: Rendered buffer info', {
        channels: renderedBuffer.numberOfChannels,
        sampleRate: renderedBuffer.sampleRate,
        length: renderedBuffer.length,
        duration: renderedBuffer.length / renderedBuffer.sampleRate,
        selectedFormat: settings.format
      });

      let audioBlob: Blob;

      if (settings.format === 'mp3') {
        // For now, convert to WAV but warn user that MP3 is not yet supported
        console.warn('MP3 export not yet implemented, exporting as WAV instead');
        audioBlob = await AudioConcatenator.audioBufferToWavBlob(renderedBuffer);

        toast({
          title: "Format Note",
          description: "MP3 export is not yet available. Exported as WAV instead.",
          variant: "default"
        });
      } else {
        // Default to WAV for now
        audioBlob = await AudioConcatenator.audioBufferToWavBlob(renderedBuffer);
      }

      // Download with correct extension
      const actualFormat = settings.format === 'mp3' ? 'wav' : settings.format;
      AudioConcatenator.downloadBlob(audioBlob, `${settings.fileName}.${actualFormat}`);

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

  const handleSaveProject = () => {
    try {
      const projectData = {
        timeline: {
          duration: Math.max(...tracks.flatMap(track => 
            track.clips.map(clip => clip.startTime + clip.duration)
          )),
          tracks,
          clips: tracks.flatMap(track => track.clips)
        },
        tracks,
        clips: tracks.flatMap(track => track.clips)
      };

      const projectName = prompt('Enter project name:', 'my-audio-project') || 'my-audio-project';
      exportProject(projectData, projectName);

      toast({
        title: "Project Saved",
        description: `Project "${projectName}" has been exported successfully.`
      });
    } catch (error) {
      console.error('Error saving project:', error);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "There was an error saving your project."
      });
    }
  };

  const handleOpenProject = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.audioforge.json,.json';
    input.style.display = 'none';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const projectData = await importProject(file);

        // Create mapping from old audioFileId to new audioFileId based on filenames
        const audioFileMapping = new Map<string, string>();

        if (projectData.audioFiles) {
          for (const savedFile of projectData.audioFiles) {
            const currentFile = audioFiles.find(af => af.name === savedFile.originalName);
            if (currentFile) {
              audioFileMapping.set(savedFile.id, currentFile.id);
              console.log('Audio file mapping:', savedFile.id, '->', currentFile.id, savedFile.originalName);
            }
          }
        }

        // Load project data with remapped audio file IDs
        if (projectData.tracks) {
          const updatedTracks = projectData.tracks.map((track: Track) => ({
            ...track,
            clips: track.clips.map((clip: AudioClip) => {
              const newAudioFileId = audioFileMapping.get(clip.audioFileId);
              if (newAudioFileId) {
                return { ...clip, audioFileId: newAudioFileId };
              }
              console.warn('No mapping found for audio file ID:', clip.audioFileId);
              return clip;
            })
          }));

          console.log('Setting tracks with updated audio file IDs');
          setTracks(updatedTracks);

          // Load all audio files into audio engine first
          const uniqueFileIds = new Set(updatedTracks.flatMap((track: Track) => 
            track.clips.map((clip: AudioClip) => clip.audioFileId)
          ));

          for (const fileId of Array.from(uniqueFileIds)) {
            const audioFile = getAudioFile(fileId as string);
            if (audioFile && isInitialized) {
              try {
                console.log('Loading audio file into engine after import:', fileId, audioFile.name);
                // Use cached buffer if available to avoid re-decoding
                const bufferToLoad = audioFile.audioBuffer || audioFile.file;
                await loadAudioFile(fileId as string, bufferToLoad);
              } catch (error) {
                console.error('Error loading audio file into engine:', fileId, error);
              }
            }
          }

          // Update audio engine with new timeline data
          const allClips = updatedTracks.flatMap((track: Track) => track.clips);
          setTimelineData(updatedTracks, allClips);

          console.log('Timeline data updated in audio engine', {
            tracks: updatedTracks.length,
            clips: allClips.length,
            mappings: audioFileMapping.size,
            loadedFiles: uniqueFileIds.size
          });
        }

        // Check if required audio files are available
        const missingFiles = projectData.audioFiles?.filter((reqFile: any) => 
          !audioFiles.find(audioFile => audioFile.name === reqFile.originalName)
        ) || [];

        if (missingFiles.length > 0) {
          toast({
            variant: "destructive", 
            title: "Missing Audio Files",
            description: `Please add these files: ${missingFiles.map((f: any) => f.originalName).join(', ')}`
          });
        } else {
          toast({
            title: "Project Loaded",
            description: `Project "${projectData.projectName}" loaded successfully.`
          });
        }
      } catch (error) {
        console.error('Error loading project:', error);
        toast({
          variant: "destructive",
          title: "Import Failed", 
          description: "There was an error loading the project file."
        });
      }
    };

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  };

  // Import transcript functionality
  const handleImportTranscript = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.srt';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const segments = await loadSRTFile(file);
        setTranscript({
          segments,
          filename: file.name
        });
        setIsTranscriptVisible(true);

        toast({
          title: "Transcript Imported",
          description: `Successfully loaded ${segments.length} segments from ${file.name}`
        });
      } catch (error) {
        console.error('Error loading transcript:', error);
        toast({
          variant: "destructive",
          title: "Import Failed",
          description: "There was an error loading the transcript file. Please check the SRT format."
        });
      }
    };

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  };

  // Single segment regeneration functionality
  const handleRegenerateSegment = async (segmentId: string, text: string, voiceId: string, startTime: number, duration: number) => {
    setIsTTSGenerating(true);

    try {
      if (!isInitialized) {
        await initialize();
      }

      // Find the voice
      const voice = TTSService.AVAILABLE_VOICES.find(v => v.id === voiceId);
      if (!voice) {
        throw new Error(`Nie znaleziono głosu o ID: ${voiceId}`);
      }

      // Create fragment for this single segment
      const fragment: TTSTextFragment = {
        id: `regen-${segmentId}-${Date.now()}`,
        text,
        voiceId,
        order: 0
      };

      // Generate audio
      const result = await TTSService.generateAudioForFragment(fragment, voice);

      // Convert blob to audio file and add to storage
      const audioFile = new File([result.audioBlob], `tts-regen-${segmentId}.mp3`, { type: 'audio/mp3' });
      const localAudioFile = await addAudioFile(audioFile);

      // Load audio buffer to get real duration
      const audioBuffer = await loadAudioBuffer(localAudioFile);
      if (!audioBuffer) throw new Error('Failed to load audio buffer');

      // Load into audio engine
      if (isInitialized) {
        await loadAudioFile(localAudioFile.id, localAudioFile.file);
      }

      // Find or create track for this voice
      let targetTrackId: string | null = null;
      const voiceTrackName = `${voice.name} Track`;

      // Look for existing track for this voice
      const existingTrack = tracks.find(track => track.name === voiceTrackName);
      if (existingTrack) {
        targetTrackId = existingTrack.id;
      } else {
        // Create new track
        const newTrackId = `track-${Date.now()}-${voiceId}`;
        const newTrack: Track = {
          id: newTrackId,
          name: voiceTrackName,
          volume: 0.8,
          pan: 0,
          muted: false,
          solo: false,
          clips: []
        };

        setTracks(prev => [...prev, newTrack]);
        createTrackGain(newTrackId);
        targetTrackId = newTrackId;

        // Wait for track to be created
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Remove any existing clips at this time position on the target track
      setTracks(prev => prev.map(track => {
        if (track.id === targetTrackId) {
          return {
            ...track,
            clips: track.clips.filter(clip => {
              const clipEnd = clip.startTime + clip.duration;
              const segmentEnd = startTime + duration;
              // Remove clips that overlap with this time range
              return !(clip.startTime < segmentEnd && clipEnd > startTime);
            })
          };
        }
        return track;
      }));

      // Create new clip at the exact same time position
      const newClip: AudioClip = {
        id: `regen-clip-${segmentId}-${Date.now()}`,
        audioFileId: localAudioFile.id,
        trackId: targetTrackId,
        startTime: startTime,
        duration: audioBuffer.duration,
        offset: 0,
        volume: 1.0,
        fadeIn: 0.1,
        fadeOut: 0.1,
        name: `TTS: ${text.substring(0, 30)}...`
      };

      // Add the new clip
      setTracks(prev => prev.map(track => {
        if (track.id === targetTrackId) {
          return {
            ...track,
            clips: [...track.clips, newClip]
          };
        }
        return track;
      }));

      // Update transcript segment with new duration if needed
      if (transcript) {
        const updatedSegments = transcript.segments.map(segment => {
          if (segment.id === segmentId) {
            return {
              ...segment,
              endTime: startTime + audioBuffer.duration
            };
          }
          return segment;
        });

        setTranscript({
          ...transcript,
          segments: updatedSegments
        });
      }

      toast({
        title: "Fragment Regenerated",
        description: `Successfully regenerated segment with ${voice.name} voice`
      });

    } catch (error) {
      console.error('Regeneration error:', error);
      toast({
        variant: "destructive",
        title: "Regeneration Failed",
        description: error instanceof Error ? error.message : "An error occurred during regeneration"
      });
    } finally {
      setIsTTSGenerating(false);
    }
  };

  // TTS Generation functionality
  const handleTTSImport = async (fragments: TTSTextFragment[], voices: TTSVoice[]) => {
    setIsTTSGenerating(true);
    setTTSProgress({ completed: 0, total: fragments.length });

    try {
      // Generate audio for all fragments
      const results = await TTSService.generateAudioForFragments(
        fragments,
        voices,
        (completed, total) => {
          setTTSProgress({ completed, total });
        }
      );

      if (!isInitialized) {
        await initialize();
      }

      // Group fragments by voice to organize into tracks
      const fragmentsByVoice = TTSService.groupFragmentsByVoice(fragments);
      const voiceTrackMap = new Map<string, string>();

      // Save state for undo before making changes
      saveState(tracks, 'Generate TTS Audio');

      // Clear old TTS tracks and create fresh ones for each voice
      const baseTracks = tracks.filter(track => !track.name.includes('Track') || track.clips.length > 0);
      const updatedTracks: Track[] = [...baseTracks];

      // Create tracks for each voice
      for (const voiceId of Array.from(fragmentsByVoice.keys())) {
        const voice = voices.find(v => v.id === voiceId);
        if (!voice) continue;

        const newTrackId = `track-${Date.now()}-${voiceId}`;
        const newTrack: Track = {
          id: newTrackId,
          name: `${voice.name} Track`,
          volume: 0.8,
          pan: 0,
          muted: false,
          solo: false,
          clips: []
        };

        updatedTracks.push(newTrack);
        voiceTrackMap.set(voiceId, newTrackId);

        // Create track gain for new track
        createTrackGain(newTrackId);
        console.log('TTS: Created track for voice', voice.name, newTrackId);
      }

      // Update tracks with new structure
      setTracks(updatedTracks);

      // Wait for tracks state to be updated
      await new Promise(resolve => setTimeout(resolve, 100));

      // Process fragments in dialog order (chronologically) instead of by voice
      // This ensures proper dialog flow across different voice tracks

      // Sort fragments by their original order (index in fragments array)
      const sortedFragments = [...fragments].sort((a, b) => {
        const aIndex = fragments.findIndex(f => f.id === a.id);
        const bIndex = fragments.findIndex(f => f.id === b.id);
        return aIndex - bIndex;
      });

      let globalTime = 0; // Global timeline position for dialog flow
      const transcriptSegments: any[] = []; // For creating transcript

      console.log(`TTS: Processing ${sortedFragments.length} fragments in dialog order`);

      // Process fragments in chronological order
      for (const fragment of sortedFragments) {
        const result = results.find(r => r.fragmentId === fragment.id);
        if (!result) continue;

        const trackId = voiceTrackMap.get(fragment.voiceId);
        if (!trackId) continue;

        // Convert blob to audio file and add to storage
        const audioFile = new File([result.audioBlob], `tts-${fragment.id}.mp3`, { type: 'audio/mp3' });
        const localAudioFile = await addAudioFile(audioFile);

        // Load audio buffer to get real duration
        const audioBuffer = await loadAudioBuffer(localAudioFile);
        if (!audioBuffer) continue;

        // Load into audio engine
        if (isInitialized) {
          console.log('TTS: Loading audio file into engine', localAudioFile.id);
          await loadAudioFile(localAudioFile.id, localAudioFile.file);
        }

        // Create clip at global timeline position
        const newClip: AudioClip = {
          id: `tts-clip-${fragment.id}`,
          audioFileId: localAudioFile.id,
          trackId,
          startTime: globalTime,
          duration: audioBuffer.duration,
          offset: 0,
          volume: 1.0,
          fadeIn: 0.1,
          fadeOut: 0.1,
          name: `TTS: ${fragment.text.substring(0, 30)}...`
        };

        // Add clip to the specific voice track
        setTracks(prevTracks => {
          return prevTracks.map(track => {
            if (track.id === trackId) {
              console.log('TTS: Adding clip to track', trackId, track.name, newClip.name, 'at time', globalTime);
              return {
                ...track,
                clips: [...track.clips, newClip]
              };
            }
            return track;
          });
        });

        // Create transcript segment
        transcriptSegments.push({
          id: `tts-segment-${fragment.id}`,
          startTime: globalTime,
          endTime: globalTime + audioBuffer.duration,
          text: fragment.text
        });

        // Move global time forward for next fragment
        globalTime += audioBuffer.duration + 0.5; // 0.5s gap between fragments

        // Small delay to ensure state updates properly
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Create and display transcript from generated TTS
      if (transcriptSegments.length > 0) {
        setTranscript({
          segments: transcriptSegments,
          filename: 'Generated TTS Dialog'
        });
        setIsTranscriptVisible(true);

        console.log('TTS: Created transcript with', transcriptSegments.length, 'segments');
      }

      toast({
        title: "TTS Audio Generated",
        description: `Successfully generated ${results.length} audio fragments using ${voices.length} voices`
      });

    } catch (error) {
      console.error('TTS generation error:', error);
      toast({
        variant: "destructive",
        title: "TTS Generation Failed",
        description: error instanceof Error ? error.message : "An error occurred during audio generation"
      });
    } finally {
      setIsTTSGenerating(false);
      setTTSProgress({ completed: 0, total: 0 });
    }
  };

  // Handler for adding sound effect at current playhead position
  const handleAddEffect = async (effectUrl: string, effectName: string) => {
    try {
      // Create a mock audio file for the effect (in real implementation, this would be downloaded from Freesound)
      const effectResponse = await fetch('/mock-audio.mp3').catch(() => null);
      let effectFile: File;

      if (effectResponse && effectResponse.ok) {
        const audioBlob = await effectResponse.blob();
        effectFile = new File([audioBlob], `${effectName}.mp3`, { type: 'audio/mp3' });
      } else {
        // Create a proper WAV file using Web Audio API
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const sampleRate = audioContext.sampleRate;
        const duration = 3; // 3 seconds
        const length = sampleRate * duration;

        // Create audio buffer
        const audioBuffer = audioContext.createBuffer(1, length, sampleRate);
        const channelData = audioBuffer.getChannelData(0);

        // Generate a pleasant tone (major chord: 440Hz + 554Hz + 659Hz)
        for (let i = 0; i < length; i++) {
          const time = i / sampleRate;
          const fundamental = Math.sin(2 * Math.PI * 440 * time) * 0.3;
          const third = Math.sin(2 * Math.PI * 554.37 * time) * 0.2;
          const fifth = Math.sin(2 * Math.PI * 659.25 * time) * 0.2;

          // Add envelope (fade in/out)
          const fadeTime = 0.1; // 100ms fade
          let envelope = 1;
          if (time < fadeTime) {
            envelope = time / fadeTime;
          } else if (time > duration - fadeTime) {
            envelope = (duration - time) / fadeTime;
          }

          channelData[i] = (fundamental + third + fifth) * envelope * 0.1;
        }

        // Convert to WAV format
        const wav = audioBufferToWav(audioBuffer);
        effectFile = new File([wav], `${effectName}.wav`, { type: 'audio/wav' });

        // Clean up context
        audioContext.close();
      }

      // Add the effect file to audio storage with progress tracking
      const audioFile = await addAudioFile(effectFile, (progress) => {
        console.log(`Adding effect ${effectName}: ${progress}%`);
      });

      // Find the first track to add the effect to
      const targetTrack = tracks[0];
      if (!targetTrack) {
        toast({
          variant: "destructive",
          title: "No Track Available",
          description: "Create a track first to add sound effects."
        });
        return;
      }

      // Load the audio buffer for this effect
      const audioBuffer = await loadAudioBuffer(audioFile);
      if (!audioBuffer) {
        toast({
          variant: "destructive",
          title: "Error Loading Effect",
          description: "Failed to load audio data for the effect."
        });
        return;
      }

      // Create a new clip at the current playhead position
      const newClip: AudioClip = {
        id: `effect-${Date.now()}`,
        audioFileId: audioFile.id,
        startTime: playbackState.currentTime,
        duration: audioBuffer.duration,
        offset: 0,
        volume: 0.8,
        fadeIn: 0,
        fadeOut: 0,
        trackId: targetTrack.id,
        name: effectName
      };

      // Update tracks with new effect clip
      const newTracks = tracks.map(track => 
        track.id === targetTrack.id 
          ? { ...track, clips: [...track.clips, newClip] }
          : track
      );

      setTracks(newTracks);

      // Update timeline data in audio engine
      const allClips = newTracks.flatMap(track => track.clips);
      setTimelineData(newTracks, allClips);

      toast({
        title: "Effect Added",
        description: `${effectName} added to ${targetTrack.name} at ${formatTime(playbackState.currentTime)}`
      });

      saveState(newTracks, `Added effect: ${effectName}`);
    } catch (error) {
      console.error('Error adding effect:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add sound effect to timeline."
      });
    }
  };

  // Helper function to convert AudioBuffer to WAV
  const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bytesPerSample = 2;
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;
    const bufferSize = 44 + dataSize;

    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);

    // Helper function to write string
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    // RIFF header
    writeString(0, 'RIFF');
    view.setUint32(4, bufferSize - 8, true);
    writeString(8, 'WAVE');

    // fmt chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM format
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // bits per sample

    // data chunk
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // Convert float samples to int16
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = buffer.getChannelData(channel)[i];
        const intSample = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return arrayBuffer;
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
    <div className="h-screen flex flex-col bg-editor-bg text-white font-inter overflow-hidden audio-editor fixed inset-0">
      <Toolbar
        playbackState={playbackState}
        formatTime={formatTime}
        onExport={() => setIsExportModalOpen(true)}
        onPlay={play}
        onPause={pause}
        onStop={stop}
        onSeekToStart={() => seekTo(0)}
        onSaveProject={handleSaveProject}
        onOpenProject={handleOpenProject}
        onImportTranscript={handleImportTranscript}
        onAddEffects={() => setIsEffectsModalOpen(true)}
        onTTSImport={() => setIsTTSModalOpen(true)}
        isTTSGenerating={isTTSGenerating}
        ttsProgress={ttsProgress}
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
          removeAudioFile={handleRemoveAudioFile}
          concatenateFiles={concatenateFiles}
          onImportTranscript={handleImportTranscript}
          onAddEffects={() => setIsEffectsModalOpen(true)}
          onTTSImport={() => setIsTTSModalOpen(true)}
          isTTSGenerating={isTTSGenerating}
          ttsProgress={ttsProgress}
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
          currentTool={currentTool}
          onSplitClip={splitClip}
          onCutRegion={cutRegion}
          selectionStart={selectionStart}
          selectionEnd={selectionEnd}
          selectedTrackId={selectedTrackId}
          onSelectionChange={(start: number | null, end: number | null, trackId: string | null) => {
            setSelectionStart(start);
            setSelectionEnd(end);
            setSelectedTrackId(trackId);
          }}
          onToolChange={setCurrentTool}
          onAddTrack={addTrack}
          onMoveClipBetweenTracks={moveClipBetweenTracks}
          onSaveState={saveState}
          loadingTracks={loadingTracks}
          onImportTranscript={handleImportTranscript}
          onAddEffects={() => setIsEffectsModalOpen(true)}
          onTTSImport={() => setIsTTSModalOpen(true)}
          isTTSGenerating={isTTSGenerating}
          ttsProgress={ttsProgress}
          getAudioBuffer={getAudioBuffer}
          onTrackDelete={deleteTrack}
          data-testid="timeline"
        />

      </div>

      {/* Transcript Panel - Fixed overlay on the right */}
      <TranscriptPanel
        transcript={transcript?.segments || null}
        currentTime={playbackState.currentTime}
        isVisible={isTranscriptVisible}
        onClose={() => setIsTranscriptVisible(false)}
        onSeekTo={seekTo}
        width={transcriptPanelWidth}
        onWidthChange={setTranscriptPanelWidth}
        onRegenerateSegment={handleRegenerateSegment}
        isTTSGenerating={isTTSGenerating}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExport}
        data-testid="export-modal"
      />

      <EffectsModal
        isOpen={isEffectsModalOpen}
        onClose={() => setIsEffectsModalOpen(false)}
        onSelectEffect={handleAddEffect}
        currentTime={playbackState.currentTime}
      />

      <TTSImportDialog
        isOpen={isTTSModalOpen}
        onClose={() => setIsTTSModalOpen(false)}
        onImport={handleTTSImport}
      />
    </div>
  );
}