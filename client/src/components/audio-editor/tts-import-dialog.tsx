import { useState, useId } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Trash2, Play, User, Users, CheckSquare, Square, Volume2 } from "lucide-react";
import { TTSService } from "@/lib/tts-service";
import type { TTSVoice, TTSTextFragment } from "@/types/audio";

interface TTSImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (fragments: TTSTextFragment[], voices: TTSVoice[]) => void;
}

export function TTSImportDialog({ isOpen, onClose, onImport }: TTSImportDialogProps) {
  const [rawText, setRawText] = useState("");
  const [fragments, setFragments] = useState<TTSTextFragment[]>([]);
  const [selectedVoices, setSelectedVoices] = useState<Set<string>>(new Set());
  const [selectedFragments, setSelectedFragments] = useState<Set<string>>(new Set());
  const [bulkVoiceId, setBulkVoiceId] = useState<string>("");
  const [isAlternatingVoices, setIsAlternatingVoices] = useState<boolean>(false);
  const [alternatingVoice1, setAlternatingVoice1] = useState<string>("");
  const [alternatingVoice2, setAlternatingVoice2] = useState<string>("");
  const [isDialogMode, setIsDialogMode] = useState<boolean>(false);
  const [speakerVoiceMapping, setSpeakerVoiceMapping] = useState<Map<string, string>>(new Map());
  const [detectedSpeakers, setDetectedSpeakers] = useState<string[]>([]);
  const dialogId = useId();

  const availableVoices = TTSService.AVAILABLE_VOICES;

  // Parse dialog format (name: text)
  const parseDialogText = (text: string): { speakers: string[], fragments: TTSTextFragment[] } => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const speakers = new Set<string>();
    const parsedFragments: TTSTextFragment[] = [];
    
    lines.forEach((line, index) => {
      const match = line.match(/^([^:]+):\s*(.+)$/);
      if (match) {
        const [, speaker, text] = match;
        const speakerName = speaker.trim();
        const speechText = text.trim();
        
        speakers.add(speakerName);
        
        // Get voice for this speaker (default to first voice if not mapped)
        const voiceId = speakerVoiceMapping.get(speakerName) || availableVoices[0].id;
        
        parsedFragments.push({
          id: `fragment-${index + 1}`,
          text: speechText, // Only the speech text, not the speaker name
          voiceId,
          order: index,
          speaker: speakerName // Store speaker name for reference
        });
      }
    });
    
    return {
      speakers: Array.from(speakers),
      fragments: parsedFragments
    };
  };

  // Parse text into fragments when text changes
  const handleTextChange = (text: string) => {
    setRawText(text);
    
    if (text.trim()) {
      // Check if text looks like dialog format (contains lines with "name:")
      const hasDialogFormat = text.split('\n').some(line => /^[^:]+:\s*.+$/.test(line.trim()));
      
      if (hasDialogFormat && isDialogMode) {
        // Parse as dialog
        const { speakers, fragments: dialogFragments } = parseDialogText(text);
        setDetectedSpeakers(speakers);
        setFragments(dialogFragments);
      } else {
        // Parse as regular text
        const textLines = TTSService.parseTextToFragments(text);
        const newFragments: TTSTextFragment[] = textLines.map((line, index) => {
          let voiceId = availableVoices[0].id; // Default to first voice
          
          // Apply alternating voices if enabled
          if (isAlternatingVoices && alternatingVoice1 && alternatingVoice2) {
            voiceId = index % 2 === 0 ? alternatingVoice1 : alternatingVoice2;
          }
          
          return {
            id: `fragment-${index + 1}`,
            text: line,
            voiceId,
            order: index
          };
        });
        setFragments(newFragments);
        setDetectedSpeakers([]);
      }
    } else {
      setFragments([]);
      setDetectedSpeakers([]);
    }
  };

  // Re-apply voice assignment when alternating mode changes
  const handleAlternatingModeChange = (enabled: boolean) => {
    setIsAlternatingVoices(enabled);
    
    if (enabled && alternatingVoice1 && alternatingVoice2 && fragments.length > 0) {
      const updatedFragments = fragments.map((fragment, index) => ({
        ...fragment,
        voiceId: index % 2 === 0 ? alternatingVoice1 : alternatingVoice2
      }));
      setFragments(updatedFragments);
    }
  };

  // Apply alternating voices when voices are selected
  const handleAlternatingVoicesUpdate = (voice1: string, voice2: string) => {
    setAlternatingVoice1(voice1);
    setAlternatingVoice2(voice2);
    
    if (isAlternatingVoices && voice1 && voice2 && fragments.length > 0) {
      const updatedFragments = fragments.map((fragment, index) => ({
        ...fragment,
        voiceId: index % 2 === 0 ? voice1 : voice2
      }));
      setFragments(updatedFragments);
    }
  };

  // Update voice mapping for a speaker
  const updateSpeakerVoice = (speakerName: string, voiceId: string) => {
    const newMapping = new Map(speakerVoiceMapping);
    newMapping.set(speakerName, voiceId);
    setSpeakerVoiceMapping(newMapping);
    
    // Update all fragments for this speaker
    setFragments(prev => prev.map(fragment => 
      fragment.speaker === speakerName 
        ? { ...fragment, voiceId }
        : fragment
    ));
    
    // Track which voices are being used
    const updatedVoices = new Set(selectedVoices);
    updatedVoices.add(voiceId);
    setSelectedVoices(updatedVoices);
  };

  // Change all fragments of one voice to another
  const changeAllVoicesOfType = (fromVoiceId: string, toVoiceId: string) => {
    setFragments(prev => prev.map(fragment => 
      fragment.voiceId === fromVoiceId 
        ? { ...fragment, voiceId: toVoiceId }
        : fragment
    ));
    
    // Track which voices are being used
    const updatedVoices = new Set(selectedVoices);
    updatedVoices.add(toVoiceId);
    setSelectedVoices(updatedVoices);
  };

  // Update voice for a specific fragment
  const updateFragmentVoice = (fragmentId: string, voiceId: string) => {
    setFragments(prev => prev.map(fragment => 
      fragment.id === fragmentId 
        ? { ...fragment, voiceId }
        : fragment
    ));
    
    // Track which voices are being used
    const updatedVoices = new Set(selectedVoices);
    updatedVoices.add(voiceId);
    setSelectedVoices(updatedVoices);
  };

  // Remove a fragment
  const removeFragment = (fragmentId: string) => {
    setFragments(prev => prev.filter(f => f.id !== fragmentId));
    setSelectedFragments(prev => {
      const newSet = new Set(prev);
      newSet.delete(fragmentId);
      return newSet;
    });
  };

  // Toggle fragment selection
  const toggleFragmentSelection = (fragmentId: string) => {
    setSelectedFragments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fragmentId)) {
        newSet.delete(fragmentId);
      } else {
        newSet.add(fragmentId);
      }
      return newSet;
    });
  };

  // Select all fragments
  const selectAllFragments = () => {
    const allIds = new Set(fragments.map(f => f.id));
    setSelectedFragments(allIds);
  };

  // Deselect all fragments
  const deselectAllFragments = () => {
    setSelectedFragments(new Set());
  };

  // Apply voice to selected fragments
  const applyBulkVoice = () => {
    if (!bulkVoiceId || selectedFragments.size === 0) return;
    
    setFragments(prev => prev.map(fragment => 
      selectedFragments.has(fragment.id)
        ? { ...fragment, voiceId: bulkVoiceId }
        : fragment
    ));
    
    // Track which voices are being used
    const updatedVoices = new Set(selectedVoices);
    updatedVoices.add(bulkVoiceId);
    setSelectedVoices(updatedVoices);
    
    // Clear selection after applying
    setSelectedFragments(new Set());
  };

  // Get voice info by ID
  const getVoiceById = (voiceId: string) => {
    return availableVoices.find(v => v.id === voiceId);
  };

  // Get unique voices being used
  const getUsedVoices = (): TTSVoice[] => {
    const usedVoiceIds = new Set(fragments.map(f => f.voiceId));
    return availableVoices.filter(voice => usedVoiceIds.has(voice.id));
  };

  // Group fragments by voice for preview
  const fragmentsByVoice = fragments.reduce((acc, fragment) => {
    if (!acc[fragment.voiceId]) {
      acc[fragment.voiceId] = [];
    }
    acc[fragment.voiceId].push(fragment);
    return acc;
  }, {} as Record<string, TTSTextFragment[]>);

  // Handle import
  const handleImport = () => {
    if (fragments.length === 0) return;
    
    const usedVoices = getUsedVoices();
    onImport(fragments, usedVoices);
    onClose();
    
    // Reset form
    setRawText("");
    setFragments([]);
    setSelectedVoices(new Set());
    setSelectedFragments(new Set());
    setBulkVoiceId("");
    setIsDialogMode(false);
    setSpeakerVoiceMapping(new Map());
    setDetectedSpeakers([]);
  };

  // Estimate total duration
  const estimatedDuration = TTSService.estimateTotalDuration(fragments);
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import tekstu do generowania audio</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Text Input */}
          <div className="space-y-2">
            <Label htmlFor={`${dialogId}-text`}>
              Tekst (każda linia = osobny fragment audio)
            </Label>
            <Textarea
              id={`${dialogId}-text`}
              placeholder={isDialogMode ? 
                "Wprowadź dialog w formacie:&#10;Imię: tekst wypowiedzi&#10;Przykład:&#10;Anna: Witaj w naszym podcaście!&#10;Marek: Dzisiaj rozmawiamy o AI.&#10;Anna: To będzie fascynujący temat." :
                "Wprowadź tekst dialogu...&#10;Każda linia będzie osobnym fragmentem audio.&#10;Przykład:&#10;Witaj w naszym podcaście!&#10;Dzisiaj rozmawiamy o AI.&#10;To będzie fascynujący temat."
              }
              value={rawText}
              onChange={(e) => handleTextChange(e.target.value)}
              className="min-h-32"
              data-testid="textarea-tts-input"
              style={{ whiteSpace: 'pre-wrap' }}
            />
            <p className="text-sm text-muted-foreground">
              Tekst zostanie podzielony na {fragments.length} fragmentów
              {fragments.length > 0 && (
                <> • Szacowany czas: {formatDuration(estimatedDuration)}</>
              )}
            </p>
          </div>

          {/* Dialog Mode Toggle */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="dialog-mode"
                checked={isDialogMode}
                onCheckedChange={(checked) => {
                  setIsDialogMode(!!checked);
                  if (checked) {
                    setIsAlternatingVoices(false); // Disable alternating voices when dialog mode is enabled
                  }
                  // Re-parse text with new mode
                  if (rawText.trim()) {
                    handleTextChange(rawText);
                  }
                }}
                data-testid="checkbox-dialog-mode"
              />
              <Label htmlFor="dialog-mode" className="text-sm font-medium">
                Tryb dialogu (format: imię: tekst)
              </Label>
            </div>

            {/* Speaker Voice Assignment */}
            {isDialogMode && detectedSpeakers.length > 0 && (
              <Card className="p-3 bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Przypisz głosy do mówców ({detectedSpeakers.length} wykrytych)
                  </Label>
                  <div className="grid gap-3">
                    {detectedSpeakers.map(speaker => (
                      <div key={speaker} className="flex items-center gap-2">
                        <Badge variant="outline" className="min-w-fit">
                          {speaker}
                        </Badge>
                        <Select
                          value={speakerVoiceMapping.get(speaker) || ""}
                          onValueChange={(voiceId) => updateSpeakerVoice(speaker, voiceId)}
                        >
                          <SelectTrigger className="flex-1" data-testid={`select-speaker-voice-${speaker}`}>
                            <SelectValue placeholder="Wybierz głos..." />
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
                    ))}
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Alternating Voices Option - only show when dialog mode is off */}
          {!isDialogMode && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="alternating-voices"
                  checked={isAlternatingVoices}
                  onCheckedChange={(checked) => handleAlternatingModeChange(!!checked)}
                  data-testid="checkbox-alternating-voices"
                />
                <Label htmlFor="alternating-voices" className="text-sm font-medium">
                  Głosy naprzemienne (dialog dwuosobowy)
                </Label>
              </div>
            
            {isAlternatingVoices && (
              <Card className="p-3 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Wybierz głosy dla dialogu:</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Głos 1 (nieparzyste linie)</Label>
                      <Select 
                        value={alternatingVoice1} 
                        onValueChange={(voiceId) => handleAlternatingVoicesUpdate(voiceId, alternatingVoice2)}
                      >
                        <SelectTrigger data-testid="select-alternating-voice-1">
                          <SelectValue placeholder="Wybierz głos..." />
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
                    
                    <div>
                      <Label className="text-xs text-muted-foreground">Głos 2 (parzyste linie)</Label>
                      <Select 
                        value={alternatingVoice2} 
                        onValueChange={(voiceId) => handleAlternatingVoicesUpdate(alternatingVoice1, voiceId)}
                      >
                        <SelectTrigger data-testid="select-alternating-voice-2">
                          <SelectValue placeholder="Wybierz głos..." />
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
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Fragment Assignment */}
          {fragments.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">
                  Przypisanie głosów do fragmentów
                </Label>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {getUsedVoices().length} głosów używanych
                </Badge>
              </div>

              {/* Bulk Operations */}
              <Card className="p-3 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Volume2 className="w-4 h-4" />
                      Operacje grupowe
                    </Label>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      Zaznaczono: {selectedFragments.size} fragmentów
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectedFragments.size === fragments.length ? deselectAllFragments : selectAllFragments}
                      data-testid="button-select-all"
                    >
                      {selectedFragments.size === fragments.length ? (
                        <>
                          <Square className="w-3 h-3 mr-1" />
                          Odznacz wszystkie
                        </>
                      ) : (
                        <>
                          <CheckSquare className="w-3 h-3 mr-1" />
                          Zaznacz wszystkie
                        </>
                      )}
                    </Button>
                    
                    <Select value={bulkVoiceId} onValueChange={setBulkVoiceId}>
                      <SelectTrigger className="w-48" data-testid="select-bulk-voice">
                        <SelectValue placeholder="Wybierz głos..." />
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
                    
                    <Button
                      variant="default"
                      size="sm"
                      onClick={applyBulkVoice}
                      disabled={!bulkVoiceId || selectedFragments.size === 0}
                      data-testid="button-apply-bulk-voice"
                    >
                      Zastosuj głos
                    </Button>
                  </div>
                </div>
              </Card>

              <div className="grid gap-3 max-h-60 overflow-y-auto">
                {fragments.map((fragment, index) => {
                  const voice = getVoiceById(fragment.voiceId);
                  const isSelected = selectedFragments.has(fragment.id);
                  return (
                    <Card key={fragment.id} className={`p-3 transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' : ''}`}>
                      <div className="flex items-start gap-3">
                        <div className="flex items-center gap-2 mt-1">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleFragmentSelection(fragment.id)}
                            data-testid={`checkbox-${fragment.id}`}
                          />
                          <Badge variant="secondary">
                            {index + 1}
                          </Badge>
                        </div>
                        
                        <div className="flex-1 space-y-2">
                          {fragment.speaker && (
                            <div className="flex items-center gap-1 mb-1">
                              <Badge variant="secondary" className="text-xs">
                                {fragment.speaker}
                              </Badge>
                            </div>
                          )}
                          <p className="text-sm">{fragment.text}</p>
                          
                          <div className="flex items-center gap-2 flex-wrap">
                            <Select 
                              value={fragment.voiceId} 
                              onValueChange={(voiceId) => updateFragmentVoice(fragment.id, voiceId)}
                            >
                              <SelectTrigger className="w-48" data-testid={`select-voice-${fragment.id}`}>
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
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const newVoiceId = prompt(`Zmień wszystkie fragmenty z głosu "${voice?.name}" na inny głos. Wybierz nowy głos:`);
                                if (newVoiceId && availableVoices.find(v => v.id === newVoiceId)) {
                                  changeAllVoicesOfType(fragment.voiceId, newVoiceId);
                                }
                              }}
                              className="text-xs"
                              data-testid={`button-change-all-${fragment.id}`}
                            >
                              Zmień wszystkie
                            </Button>
                            
                            {voice && (
                              <span className="text-xs text-muted-foreground">
                                {voice.description}
                              </span>
                            )}
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFragment(fragment.id)}
                          data-testid={`button-remove-${fragment.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Voice Preview */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Podgląd ścieżek:</Label>
                <div className="grid gap-2">
                  {Object.entries(fragmentsByVoice).map(([voiceId, voiceFragments]) => {
                    const voice = getVoiceById(voiceId);
                    if (!voice) return null;
                    
                    return (
                      <Card key={voiceId} className="p-3 bg-muted/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span className="font-medium">{voice.name}</span>
                            <Badge variant="outline">{voice.gender}</Badge>
                          </div>
                          <Badge variant="secondary">
                            {voiceFragments.length} fragmentów
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Szacowany czas: {formatDuration(TTSService.estimateTotalDuration(voiceFragments))}
                        </p>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={onClose} data-testid="button-cancel">
              Anuluj
            </Button>
            
            <Button 
              onClick={handleImport}
              disabled={fragments.length === 0}
              data-testid="button-import-tts"
            >
              <Play className="w-4 h-4 mr-2" />
              Generuj audio ({fragments.length} fragmentów)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}