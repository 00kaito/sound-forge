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
  const dialogId = useId();

  const availableVoices = TTSService.AVAILABLE_VOICES;

  // Parse text into fragments when text changes
  const handleTextChange = (text: string) => {
    setRawText(text);

    if (text.trim()) {
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
    } else {
      setFragments([]);
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

  // Delete selected fragments
  const deleteSelectedFragments = () => {
    setFragments(prev => prev.filter(fragment => 
      !selectedFragments.has(fragment.id)
    ));
    setSelectedFragments(new Set());
  };

  // Toggle fragment selection
  const toggleFragmentSelection = (fragmentId: string) => {
    const newSelection = new Set(selectedFragments);
    if (newSelection.has(fragmentId)) {
      newSelection.delete(fragmentId);
    } else {
      newSelection.add(fragmentId);
    }
    setSelectedFragments(newSelection);
  };

  // Select all fragments
  const selectAllFragments = () => {
    if (selectedFragments.size === fragments.length) {
      setSelectedFragments(new Set()); // Deselect all if all are selected
    } else {
      setSelectedFragments(new Set(fragments.map(f => f.id))); // Select all
    }
  };

  // Apply bulk voice assignment
  const applyBulkVoice = () => {
    if (!bulkVoiceId) return;

    setFragments(prev => prev.map(fragment => ({
      ...fragment,
      voiceId: bulkVoiceId
    })));

    const updatedVoices = new Set([bulkVoiceId]);
    setSelectedVoices(updatedVoices);
    setBulkVoiceId("");
  };

  // Get voice by ID
  const getVoiceById = (voiceId: string): TTSVoice | undefined => {
    return availableVoices.find(voice => voice.id === voiceId);
  };

  // Format duration in minutes and seconds
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Reset form
  const resetForm = () => {
    setRawText("");
    setFragments([]);
    setSelectedVoices(new Set());
    setSelectedFragments(new Set());
    setBulkVoiceId("");
    setIsAlternatingVoices(false);
    setAlternatingVoice1("");
    setAlternatingVoice2("");
  };

  // Handle import
  const handleImport = () => {
    if (fragments.length === 0) return;

    // Get unique voices used in fragments
    const usedVoices: TTSVoice[] = [];
    const usedVoiceIds = new Set(fragments.map(f => f.voiceId));
    
    usedVoiceIds.forEach(voiceId => {
      const voice = getVoiceById(voiceId);
      if (voice) {
        usedVoices.push(voice);
      }
    });

    onImport(fragments, usedVoices);
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import tekstu do TTS</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Text Input */}
          <div className="space-y-2">
            <Label htmlFor={`${dialogId}-text`}>Wklej tekst do wygenerowania</Label>
            <Textarea
              id={`${dialogId}-text`}
              placeholder="Wklej tutaj tekst, który ma zostać przekonwertowany na mowę. Każda linia stanie się osobnym fragmentem audio."
              value={rawText}
              onChange={(e) => handleTextChange(e.target.value)}
              className="min-h-[120px]"
              data-testid="textarea-tts-text"
            />
            {rawText && (
              <p className="text-xs text-muted-foreground">
                Wykryto {fragments.length} fragmentów
              </p>
            )}
          </div>

          {/* Voice Assignment Controls */}
          {fragments.length > 0 && (
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="text-sm font-medium">Przypisanie głosów</h3>
              
              {/* Alternating Voices Option */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id={`${dialogId}-alternating`}
                    checked={isAlternatingVoices}
                    onCheckedChange={handleAlternatingModeChange}
                    data-testid="checkbox-alternating-voices"
                  />
                  <Label htmlFor={`${dialogId}-alternating`}>Używaj przemiennych głosów</Label>
                </div>

                {isAlternatingVoices && (
                  <div className="grid grid-cols-2 gap-4 pl-6">
                    <div className="space-y-2">
                      <Label>Głos 1 (nieparzyste)</Label>
                      <Select 
                        value={alternatingVoice1} 
                        onValueChange={(value) => handleAlternatingVoicesUpdate(value, alternatingVoice2)}
                      >
                        <SelectTrigger data-testid="select-alternating-voice-1">
                          <SelectValue placeholder="Wybierz głos" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableVoices.map((voice) => (
                            <SelectItem key={voice.id} value={voice.id}>
                              {voice.name} ({voice.gender})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Głos 2 (parzyste)</Label>
                      <Select 
                        value={alternatingVoice2} 
                        onValueChange={(value) => handleAlternatingVoicesUpdate(alternatingVoice1, value)}
                      >
                        <SelectTrigger data-testid="select-alternating-voice-2">
                          <SelectValue placeholder="Wybierz głos" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableVoices.map((voice) => (
                            <SelectItem key={voice.id} value={voice.id}>
                              {voice.name} ({voice.gender})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* Bulk Voice Assignment */}
              {!isAlternatingVoices && (
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-2">
                    <Label>Przypisz jeden głos do wszystkich</Label>
                    <Select value={bulkVoiceId} onValueChange={setBulkVoiceId}>
                      <SelectTrigger data-testid="select-bulk-voice">
                        <SelectValue placeholder="Wybierz głos" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableVoices.map((voice) => (
                          <SelectItem key={voice.id} value={voice.id}>
                            {voice.name} ({voice.gender})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    onClick={applyBulkVoice} 
                    disabled={!bulkVoiceId}
                    data-testid="button-apply-bulk-voice"
                  >
                    Zastosuj
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Fragment List */}
          {fragments.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Fragmenty ({fragments.length})</h3>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={selectAllFragments}
                    data-testid="button-select-all"
                  >
                    {selectedFragments.size === fragments.length ? (
                      <>
                        <Square className="w-4 h-4 mr-1" />
                        Odznacz wszystko
                      </>
                    ) : (
                      <>
                        <CheckSquare className="w-4 h-4 mr-1" />
                        Zaznacz wszystko
                      </>
                    )}
                  </Button>
                  {selectedFragments.size > 0 && (
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={deleteSelectedFragments}
                      data-testid="button-delete-selected"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Usuń zaznaczone ({selectedFragments.size})
                    </Button>
                  )}
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2">
                {fragments.map((fragment) => {
                  const voice = getVoiceById(fragment.voiceId);
                  return (
                    <Card 
                      key={fragment.id} 
                      className={`p-3 ${selectedFragments.has(fragment.id) ? 'ring-2 ring-blue-500' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedFragments.has(fragment.id)}
                          onCheckedChange={() => toggleFragmentSelection(fragment.id)}
                          data-testid={`checkbox-fragment-${fragment.id}`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-muted-foreground mb-1">Fragment {fragment.order + 1}</p>
                          <p className="text-sm mb-2 break-words">{fragment.text}</p>
                          <div className="flex items-center gap-2">
                            <Select 
                              value={fragment.voiceId} 
                              onValueChange={(voiceId) => updateFragmentVoice(fragment.id, voiceId)}
                            >
                              <SelectTrigger className="w-48" data-testid={`select-fragment-voice-${fragment.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableVoices.map((voice) => (
                                  <SelectItem key={voice.id} value={voice.id}>
                                    {voice.name} ({voice.gender})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {voice && (
                              <Badge variant="outline" className="text-xs">
                                ~{formatDuration(TTSService.estimateTotalDuration([fragment]))}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Summary */}
          {fragments.length > 0 && (
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Volume2 className="w-4 h-4" />
                Podsumowanie
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Fragmenty:</span>{' '}
                  <span className="font-medium">{fragments.length}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Całkowity czas:</span>{' '}
                  <span className="font-medium">{formatDuration(TTSService.estimateTotalDuration(fragments))}</span>
                </div>
              </div>
              
              {/* Voices Used */}
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">Używane głosy:</span>
                <div className="space-y-1">
                  {Array.from(new Set(fragments.map(f => f.voiceId))).map(voiceId => {
                    const voice = getVoiceById(voiceId);
                    const voiceFragments = fragments.filter(f => f.voiceId === voiceId);
                    if (!voice) return null;
                    return (
                      <Card key={voiceId} className="p-2">
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