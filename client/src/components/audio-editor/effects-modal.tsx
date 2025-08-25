import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Play, Pause, Download, X } from "lucide-react";

interface FreesoundResult {
  id: number;
  name: string;
  description: string;
  username: string;
  duration: number;
  previews: {
    "preview-hq-mp3": string;
    "preview-lq-mp3": string;
  };
  license: string;
  tags: string[];
}

interface EffectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEffect: (url: string, name: string) => void;
  currentTime: number;
}

export function EffectsModal({ isOpen, onClose, onSelectEffect, currentTime }: EffectsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FreesoundResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    try {
      // Placeholder for Freesound API integration
      // For now, showing mock data structure
      const mockResults: FreesoundResult[] = [
        {
          id: 1,
          name: "Thunder Sound",
          description: "Loud thunder clap for dramatic effect",
          username: "SoundDesigner",
          duration: 3.2,
          previews: {
            "preview-hq-mp3": "/mock-thunder.mp3",
            "preview-lq-mp3": "/mock-thunder.mp3"
          },
          license: "CC BY 3.0",
          tags: ["thunder", "storm", "dramatic"]
        },
        {
          id: 2,
          name: "Bird Chirping",
          description: "Peaceful bird sounds for nature scenes",
          username: "NatureSounds",
          duration: 5.1,
          previews: {
            "preview-hq-mp3": "/mock-birds.mp3",
            "preview-lq-mp3": "/mock-birds.mp3"
          },
          license: "CC BY 4.0",
          tags: ["birds", "nature", "peaceful"]
        },
        {
          id: 3,
          name: "Door Slam",
          description: "Heavy door slamming sound effect",
          username: "FoleyArtist",
          duration: 1.8,
          previews: {
            "preview-hq-mp3": "/mock-door.mp3",
            "preview-lq-mp3": "/mock-door.mp3"
          },
          license: "CC0",
          tags: ["door", "slam", "impact"]
        },
        {
          id: 4,
          name: "Ocean Waves",
          description: "Relaxing ocean waves sound",
          username: "OceanSounds",
          duration: 7.3,
          previews: {
            "preview-hq-mp3": "/mock-waves.mp3",
            "preview-lq-mp3": "/mock-waves.mp3"
          },
          license: "CC BY 3.0",
          tags: ["ocean", "waves", "relaxing"]
        },
        {
          id: 5,
          name: "Footsteps",
          description: "Walking footsteps on gravel",
          username: "WalkingSounds",
          duration: 2.5,
          previews: {
            "preview-hq-mp3": "/mock-footsteps.mp3",
            "preview-lq-mp3": "/mock-footsteps.mp3"
          },
          license: "CC BY 4.0",
          tags: ["footsteps", "walking", "gravel"]
        }
      ];

      // Filter mock results based on search query
      const filtered = mockResults.filter(result => 
        result.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        result.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );

      setSearchResults(filtered.slice(0, 5));
    } catch (error) {
      console.error('Error searching for sound effects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlay = (sound: FreesoundResult) => {
    if (playingId === sound.id) {
      // Stop current audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlayingId(null);
    } else {
      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      // Create new audio element
      const audio = new Audio(sound.previews["preview-lq-mp3"]);
      audioRef.current = audio;
      
      audio.onended = () => setPlayingId(null);
      audio.onerror = () => {
        console.error('Error playing sound preview');
        setPlayingId(null);
      };
      
      audio.play().catch(err => {
        console.error('Error playing audio:', err);
        setPlayingId(null);
      });
      
      setPlayingId(sound.id);
    }
  };

  const handleSelectEffect = (sound: FreesoundResult) => {
    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      setPlayingId(null);
    }
    
    // Call parent function to add effect to timeline
    onSelectEffect(sound.previews["preview-hq-mp3"], sound.name);
    onClose();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="panel-bg border border-gray-700 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Add Sound Effects
          </DialogTitle>
          <p className="text-gray-400 text-sm">
            Search for sound effects to add at {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
          </p>
        </DialogHeader>

        {/* Search Section */}
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Search by keyword or tag (e.g. thunder, birds, door)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 bg-gray-800 border-gray-600 text-white"
            data-testid="input-effects-search"
          />
          <Button
            onClick={handleSearch}
            disabled={isLoading || !searchQuery.trim()}
            className="bg-purple-600 hover:bg-purple-500 text-white"
            data-testid="button-search-effects"
          >
            <Search className="w-4 h-4" />
          </Button>
        </div>

        {/* Results Section */}
        <div className="max-h-96 overflow-y-auto">
          {isLoading && (
            <div className="text-center py-8 text-gray-400">
              Searching for sound effects...
            </div>
          )}

          {searchResults.length === 0 && !isLoading && searchQuery && (
            <div className="text-center py-8 text-gray-400">
              No sound effects found for "{searchQuery}"
            </div>
          )}

          {searchResults.length === 0 && !searchQuery && (
            <div className="text-center py-8 text-gray-400">
              Enter a search term to find sound effects
            </div>
          )}

          {searchResults.map((sound) => (
            <div
              key={sound.id}
              className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-3 hover:bg-gray-700/50 transition-colors"
              data-testid={`effect-item-${sound.id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white truncate">{sound.name}</h3>
                  <p className="text-sm text-gray-400 line-clamp-2 mb-2">{sound.description}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>by {sound.username}</span>
                    <span>{formatDuration(sound.duration)}</span>
                    <span>{sound.license}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {sound.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-gray-700 text-xs text-gray-300 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <Button
                    onClick={() => handlePlay(sound)}
                    variant="secondary"
                    size="sm"
                    className="w-8 h-8 p-0 bg-gray-700 hover:bg-gray-600"
                    data-testid={`button-play-effect-${sound.id}`}
                  >
                    {playingId === sound.id ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    onClick={() => handleSelectEffect(sound)}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-500 text-white"
                    data-testid={`button-select-effect-${sound.id}`}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-700">
          <p className="text-xs text-gray-500">
            Sound effects will be added at the current playhead position
          </p>
          <Button
            onClick={onClose}
            variant="secondary"
            className="bg-gray-700 hover:bg-gray-600 text-white"
            data-testid="button-close-effects-modal"
          >
            <X className="w-4 h-4 mr-1" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}