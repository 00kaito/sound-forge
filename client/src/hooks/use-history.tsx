import { useState, useCallback } from 'react';
import { Track } from '@/types/audio';

interface HistoryState {
  tracks: Track[];
  timestamp: number;
  action: string;
}

export function useHistory(initialTracks: Track[]) {
  const [history, setHistory] = useState<HistoryState[]>([
    { tracks: initialTracks, timestamp: Date.now(), action: 'initial' }
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const saveState = useCallback((tracks: Track[], action: string) => {
    const newState: HistoryState = {
      tracks: JSON.parse(JSON.stringify(tracks)), // Deep clone
      timestamp: Date.now(),
      action
    };

    // Remove any future history if we're not at the end
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);

    // Limit history to 50 entries
    const limitedHistory = newHistory.slice(-50);
    
    setHistory(limitedHistory);
    setHistoryIndex(limitedHistory.length - 1);
  }, [history, historyIndex]);

  const undo = useCallback((): Track[] | null => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      return JSON.parse(JSON.stringify(history[newIndex].tracks));
    }
    return null;
  }, [history, historyIndex]);

  const redo = useCallback((): Track[] | null => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      return JSON.parse(JSON.stringify(history[newIndex].tracks));
    }
    return null;
  }, [history, historyIndex]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const getCurrentAction = () => {
    return historyIndex >= 0 ? history[historyIndex]?.action : '';
  };

  const getPreviousAction = () => {
    return historyIndex > 0 ? history[historyIndex - 1]?.action : '';
  };

  const getNextAction = () => {
    return historyIndex < history.length - 1 ? history[historyIndex + 1]?.action : '';
  };

  return {
    saveState,
    undo,
    redo,
    canUndo,
    canRedo,
    getCurrentAction,
    getPreviousAction,
    getNextAction
  };
}