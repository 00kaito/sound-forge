import { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TranscriptSegment } from '@/types/audio';
import { formatTranscriptTime } from '@/lib/transcript-parser';

interface TranscriptPanelProps {
  transcript: TranscriptSegment[] | null;
  currentTime: number;
  isVisible: boolean;
  onClose: () => void;
  onSeekTo: (time: number) => void;
  width: number;
  onWidthChange: (width: number) => void;
}

export function TranscriptPanel({
  transcript,
  currentTime,
  isVisible,
  onClose,
  onSeekTo,
  width,
  onWidthChange
}: TranscriptPanelProps) {
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const activeSegmentRef = useRef<HTMLDivElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Find active segment based on current time
  useEffect(() => {
    if (!transcript) return;

    const activeSegment = transcript.find(
      segment => currentTime >= segment.startTime && currentTime <= segment.endTime
    );

    if (activeSegment && activeSegment.id !== activeSegmentId) {
      setActiveSegmentId(activeSegment.id);
      
      // Auto-scroll to active segment
      setTimeout(() => {
        if (activeSegmentRef.current) {
          activeSegmentRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }, 100);
    }
  }, [currentTime, transcript, activeSegmentId]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const newWidth = window.innerWidth - e.clientX;
      const minWidth = 250;
      const maxWidth = 600;
      
      onWidthChange(Math.max(minWidth, Math.min(maxWidth, newWidth)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onWidthChange]);

  if (!isVisible) return null;

  const displayWidth = isCollapsed ? 40 : width;

  return (
    <div 
      className="panel-bg border-l border-gray-700 flex flex-col shadow-lg backdrop-blur-sm"
      style={{ width: `${displayWidth}px` }}
      data-testid="transcript-panel"
    >
      {/* Resize Handle */}
      {!isCollapsed && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/50 transition-colors"
          onMouseDown={handleMouseDown}
          data-testid="transcript-resize-handle"
        />
      )}

      {/* Header */}
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        {!isCollapsed && (
          <>
            <h3 className="font-medium text-white">Transcript</h3>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCollapsed(true)}
                className="h-6 w-6 p-0 hover:bg-gray-700"
                data-testid="button-collapse-transcript"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-6 w-6 p-0 hover:bg-gray-700 text-red-400 hover:text-red-300"
                data-testid="button-close-transcript"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
        
        {isCollapsed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(false)}
            className="h-6 w-6 p-0 hover:bg-gray-700 mx-auto"
            data-testid="button-expand-transcript"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto">
          {!transcript || transcript.length === 0 ? (
            <div className="p-4 text-center text-gray-400">
              <p>No transcript loaded</p>
              <p className="text-sm mt-1">Import an SRT file to see the transcript</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {transcript.map((segment) => {
                const isActive = segment.id === activeSegmentId;
                
                return (
                  <div
                    key={segment.id}
                    ref={isActive ? activeSegmentRef : null}
                    className={`p-3 rounded cursor-pointer transition-all duration-200 ${
                      isActive 
                        ? 'bg-blue-600/30 border border-blue-500/50 shadow-md' 
                        : 'hover:bg-gray-700/50 border border-transparent'
                    }`}
                    onClick={() => onSeekTo(segment.startTime)}
                    data-testid={`transcript-segment-${segment.id}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400 font-mono">
                        {formatTranscriptTime(segment.startTime)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTranscriptTime(segment.endTime)}
                      </span>
                    </div>
                    <p className={`text-sm leading-relaxed ${
                      isActive ? 'text-white font-medium' : 'text-gray-200'
                    }`}>
                      {segment.text}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Footer with stats when expanded */}
      {!isCollapsed && transcript && transcript.length > 0 && (
        <div className="p-2 border-t border-gray-700">
          <p className="text-xs text-gray-400 text-center">
            {transcript.length} segments • {formatTranscriptTime(transcript[transcript.length - 1]?.endTime || 0)} total
          </p>
        </div>
      )}
    </div>
  );
}