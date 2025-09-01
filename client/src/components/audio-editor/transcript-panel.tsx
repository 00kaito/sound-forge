import { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, RefreshCw, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TranscriptSegment, TTSVoice } from '@/types/audio';
import { formatTranscriptTime } from '@/lib/transcript-parser';
import { TTSService } from '@/lib/tts-service';

interface TranscriptPanelProps {
  transcript: TranscriptSegment[] | null;
  currentTime: number;
  isVisible: boolean;
  onClose: () => void;
  onSeekTo: (time: number) => void;
  width: number;
  onWidthChange: (width: number) => void;
  onRegenerateSegment?: (segmentId: string, text: string, voiceId: string, startTime: number, duration: number) => void;
  isTTSGenerating?: boolean;
}

export function TranscriptPanel({
  transcript,
  currentTime,
  isVisible,
  onClose,
  onSeekTo,
  width,
  onWidthChange,
  onRegenerateSegment,
  isTTSGenerating = false
}: TranscriptPanelProps) {
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const activeSegmentRef = useRef<HTMLDivElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set());
  const [selectedVoices, setSelectedVoices] = useState<Map<string, string>>(new Map());

  const availableVoices = TTSService.AVAILABLE_VOICES;

  // Find active segment based on current time
  useEffect(() => {
    if (!transcript) return;

    const activeSegment = transcript.find(
      segment => currentTime >= segment.startTime && currentTime <= segment.endTime
    );

    if (activeSegment && activeSegment.id !== activeSegmentId) {
      setActiveSegmentId(activeSegment.id);
      
      // Auto-scroll to active segment within the transcript panel only
      setTimeout(() => {
        if (activeSegmentRef.current) {
          const transcriptContainer = activeSegmentRef.current.closest('[data-testid="transcript-content"]');
          if (transcriptContainer) {
            const elementTop = activeSegmentRef.current.offsetTop;
            const containerHeight = transcriptContainer.clientHeight;
            const scrollTop = elementTop - (containerHeight / 2);
            
            transcriptContainer.scrollTo({
              top: Math.max(0, scrollTop),
              behavior: 'smooth'
            });
          }
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
      const maxWidth = Math.min(800, window.innerWidth - 400); // Max width based on screen size
      
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
      className="fixed top-0 right-0 h-full panel-bg border-l border-gray-700 flex flex-col shadow-lg backdrop-blur-sm z-20"
      style={{ 
        width: `${displayWidth}px`, 
        minWidth: isCollapsed ? '40px' : '250px',
        marginTop: '80px' // Account for toolbar height with extra padding
      }}
      data-testid="transcript-panel"
    >
      {/* Resize Handle - visible border that extends beyond panel */}
      {!isCollapsed && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize border-l-2 border-blue-500/60 hover:border-blue-400 transition-colors z-50"
          onMouseDown={handleMouseDown}
          data-testid="transcript-resize-handle"
          style={{ 
            marginLeft: '-3px',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderRadius: '2px 0 0 2px'
          }}
        >
          {/* Visual indicator */}
          <div className="absolute inset-y-0 left-0 w-full flex items-center justify-center">
            <div className="w-0.5 h-8 bg-blue-400 rounded-full opacity-60"></div>
          </div>
        </div>
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
        <div className="flex-1 overflow-y-auto" data-testid="transcript-content">
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
                    className={`p-3 rounded transition-all duration-200 ${
                      isActive 
                        ? 'bg-blue-600/30 border border-blue-500/50 shadow-md' 
                        : 'hover:bg-gray-700/50 border border-transparent'
                    }`}
                    data-testid={`transcript-segment-${segment.id}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400 font-mono">
                        {formatTranscriptTime(segment.startTime)}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">
                          {formatTranscriptTime(segment.endTime)}
                        </span>
                        {onRegenerateSegment && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              const isExpanded = expandedSegments.has(segment.id);
                              const newExpanded = new Set(expandedSegments);
                              if (isExpanded) {
                                newExpanded.delete(segment.id);
                              } else {
                                newExpanded.add(segment.id);
                              }
                              setExpandedSegments(newExpanded);
                            }}
                            className="h-6 w-6 p-0 hover:bg-gray-600"
                            data-testid={`button-expand-${segment.id}`}
                          >
                            <RefreshCw className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <p 
                      className={`text-sm leading-relaxed cursor-pointer ${
                        isActive ? 'text-white font-medium' : 'text-gray-200'
                      }`}
                      onClick={() => onSeekTo(segment.startTime)}
                    >
                      {segment.text}
                    </p>

                    {/* Regeneration Controls */}
                    {expandedSegments.has(segment.id) && onRegenerateSegment && (
                      <div className="mt-3 pt-2 border-t border-gray-600 space-y-2">
                        <div className="flex items-center gap-2">
                          <Select 
                            value={selectedVoices.get(segment.id) || availableVoices[0].id}
                            onValueChange={(voiceId) => {
                              const newSelectedVoices = new Map(selectedVoices);
                              newSelectedVoices.set(segment.id, voiceId);
                              setSelectedVoices(newSelectedVoices);
                            }}
                          >
                            <SelectTrigger className="flex-1" data-testid={`select-voice-${segment.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {availableVoices.map(voice => (
                                <SelectItem key={voice.id} value={voice.id}>
                                  <div className="flex items-center gap-2">
                                    <User className="w-3 h-3" />
                                    <span>{voice.name}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {voice.gender}
                                    </Badge>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const voiceId = selectedVoices.get(segment.id) || availableVoices[0].id;
                              const duration = segment.endTime - segment.startTime;
                              onRegenerateSegment(segment.id, segment.text, voiceId, segment.startTime, duration);
                              
                              // Close expanded panel after regeneration
                              const newExpanded = new Set(expandedSegments);
                              newExpanded.delete(segment.id);
                              setExpandedSegments(newExpanded);
                            }}
                            disabled={isTTSGenerating}
                            className="flex-1"
                            data-testid={`button-regenerate-${segment.id}`}
                          >
                            <RefreshCw className={`w-3 h-3 mr-1 ${isTTSGenerating ? 'animate-spin' : ''}`} />
                            {isTTSGenerating ? 'Generuję...' : 'Regeneruj'}
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newExpanded = new Set(expandedSegments);
                              newExpanded.delete(segment.id);
                              setExpandedSegments(newExpanded);
                            }}
                            data-testid={`button-cancel-${segment.id}`}
                          >
                            Anuluj
                          </Button>
                        </div>
                      </div>
                    )}
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