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
  const dialogId = useId();

  const availableVoices = TTSService.AVAILABLE_VOICES;

  // Parse text into fragments when text changes
  const handleTextChange = (text: string) => {
    setRawText(text);
    
    if (text.trim()) {
      const textLines = TTSService.parseTextToFragments(text);
      const newFragments: TTSTextFragment[] = textLines.map((line, index) => ({
        id: `fragment-${index + 1}`,
        text: line,
        voiceId: availableVoices[0].id, // Default to first voice
        order: index
      }));
      setFragments(newFragments);
    } else {
      setFragments([]);
    }
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
              placeholder="Wprowadź tekst dialogu...&#10;Każda linia będzie osobnym fragmentem audio.&#10;Przykład:&#10;Witaj w naszym podcaście!&#10;Dzisiaj rozmawiamy o AI.&#10;To będzie fascynujący temat."
              value={rawText}
              onChange={(e) => handleTextChange(e.target.value)}
              className="min-h-32"
              data-testid="textarea-tts-input"
            />
            <p className="text-sm text-muted-foreground">
              Tekst zostanie podzielony na {fragments.length} fragmentów
              {fragments.length > 0 && (
                <> • Szacowany czas: {formatDuration(estimatedDuration)}</>
              )}
            </p>
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
                          <p className="text-sm">{fragment.text}</p>
                          
                          <div className="flex items-center gap-2">
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