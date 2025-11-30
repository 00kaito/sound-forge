import { useState, useId } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Trash2, Play, User, Users, CheckSquare, Square, Volume2, Palette } from "lucide-react";
import { TTSService } from "@/lib/tts-service";
import type { TTSVoice, TTSTextFragment, TTSEmotion } from "@/types/audio";

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
  const [bulkEmotion, setBulkEmotion] = useState<TTSEmotion>("Conversational");
  const [globalEmotion, setGlobalEmotion] = useState<TTSEmotion>("Conversational");
  const [isAlternatingVoices, setIsAlternatingVoices] = useState<boolean>(false);
  const [alternatingVoice1, setAlternatingVoice1] = useState<string>("");
  const [alternatingVoice2, setAlternatingVoice2] = useState<string>("");
  const [isDialogMode, setIsDialogMode] = useState<boolean>(false);
  const [detectedSpeakers, setDetectedSpeakers] = useState<string[]>([]);
  const [speakerVoiceMapping, setSpeakerVoiceMapping] = useState<Record<string, string>>({});
  const [speakerEmotionMapping, setSpeakerEmotionMapping] = useState<Record<string, TTSEmotion>>({});
  const dialogId = useId();

  const availableVoices = TTSService.AVAILABLE_VOICES;
  const availableEmotions = TTSService.AVAILABLE_EMOTIONS;
  const emotionLabels = TTSService.EMOTION_LABELS;

  const parseDialogText = (
    text: string, 
    voiceMapping: Record<string, string>,
    emotionMapping: Record<string, TTSEmotion>,
    defaultEmotion: TTSEmotion
  ): { speakers: string[], fragments: TTSTextFragment[] } => {
    const lines = text.split('\n').filter(line => line.trim());
    const speakers = new Set<string>();
    const fragments: TTSTextFragment[] = [];

    lines.forEach((line, index) => {
      const match = line.match(/^([^:]+):\s*(.+)$/);
      if (match) {
        const speaker = match[1].trim();
        const text = match[2].trim();
        
        speakers.add(speaker);
        
        const voiceId = voiceMapping[speaker] || availableVoices[0].id;
        const emotion = emotionMapping[speaker] || defaultEmotion;
        
        fragments.push({
          id: `fragment-${index + 1}`,
          text,
          voiceId,
          emotion,
          order: index,
          speaker
        });
      }
    });

    return {
      speakers: Array.from(speakers),
      fragments
    };
  };

  const handleTextChange = (text: string) => {
    setRawText(text);

    if (text.trim()) {
      if (isDialogMode) {
        const { speakers, fragments: dialogFragments } = parseDialogText(
          text, 
          speakerVoiceMapping, 
          speakerEmotionMapping, 
          globalEmotion
        );
        setDetectedSpeakers(speakers);
        setFragments(dialogFragments);
      } else {
        const textLines = TTSService.parseTextToFragments(text);
        const newFragments: TTSTextFragment[] = textLines.map((line, index) => {
          let voiceId = availableVoices[0].id;

          if (isAlternatingVoices && alternatingVoice1 && alternatingVoice2) {
            voiceId = index % 2 === 0 ? alternatingVoice1 : alternatingVoice2;
          }

          return {
            id: `fragment-${index + 1}`,
            text: line,
            voiceId,
            emotion: globalEmotion,
            order: index
          };
        });
        setFragments(newFragments);
      }
    } else {
      setFragments([]);
      setDetectedSpeakers([]);
    }
  };

  const handleGlobalEmotionChange = (emotion: TTSEmotion) => {
    setGlobalEmotion(emotion);
    
    if (fragments.length > 0) {
      setFragments(prev => prev.map(fragment => ({
        ...fragment,
        emotion
      })));
    }
  };

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

  const changeAllVoicesOfType = (fromVoiceId: string, toVoiceId: string) => {
    setFragments(prev => prev.map(fragment => 
      fragment.voiceId === fromVoiceId 
        ? { ...fragment, voiceId: toVoiceId }
        : fragment
    ));

    const updatedVoices = new Set(selectedVoices);
    updatedVoices.add(toVoiceId);
    setSelectedVoices(updatedVoices);
  };

  const updateFragmentVoice = (fragmentId: string, voiceId: string) => {
    setFragments(prev => prev.map(fragment => 
      fragment.id === fragmentId 
        ? { ...fragment, voiceId }
        : fragment
    ));

    const updatedVoices = new Set(selectedVoices);
    updatedVoices.add(voiceId);
    setSelectedVoices(updatedVoices);
  };

  const updateFragmentEmotion = (fragmentId: string, emotion: TTSEmotion) => {
    setFragments(prev => prev.map(fragment => 
      fragment.id === fragmentId 
        ? { ...fragment, emotion }
        : fragment
    ));
  };

  const deleteSelectedFragments = () => {
    setFragments(prev => prev.filter(fragment => 
      !selectedFragments.has(fragment.id)
    ));
    setSelectedFragments(new Set());
  };

  const toggleFragmentSelection = (fragmentId: string) => {
    const newSelection = new Set(selectedFragments);
    if (newSelection.has(fragmentId)) {
      newSelection.delete(fragmentId);
    } else {
      newSelection.add(fragmentId);
    }
    setSelectedFragments(newSelection);
  };

  const selectAllFragments = () => {
    if (selectedFragments.size === fragments.length) {
      setSelectedFragments(new Set());
    } else {
      setSelectedFragments(new Set(fragments.map(f => f.id)));
    }
  };

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

  const applyBulkEmotion = () => {
    setFragments(prev => prev.map(fragment => ({
      ...fragment,
      emotion: bulkEmotion
    })));
  };

  const getVoiceById = (voiceId: string): TTSVoice | undefined => {
    return availableVoices.find(voice => voice.id === voiceId);
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleDialogModeChange = (enabled: boolean) => {
    setIsDialogMode(enabled);
    
    if (enabled) {
      setIsAlternatingVoices(false);
    }
    
    if (rawText.trim()) {
      if (enabled) {
        const { speakers, fragments: dialogFragments } = parseDialogText(
          rawText, 
          speakerVoiceMapping, 
          speakerEmotionMapping, 
          globalEmotion
        );
        setDetectedSpeakers(speakers);
        setFragments(dialogFragments);
      } else {
        const textLines = TTSService.parseTextToFragments(rawText);
        const newFragments: TTSTextFragment[] = textLines.map((line, index) => {
          let voiceId = availableVoices[0].id;
          if (isAlternatingVoices && alternatingVoice1 && alternatingVoice2) {
            voiceId = index % 2 === 0 ? alternatingVoice1 : alternatingVoice2;
          }
          return {
            id: `fragment-${index + 1}`,
            text: line,
            voiceId,
            emotion: globalEmotion,
            order: index
          };
        });
        setFragments(newFragments);
        setDetectedSpeakers([]);
      }
    }
  };

  const updateSpeakerVoice = (speaker: string, voiceId: string) => {
    const newMapping = { ...speakerVoiceMapping, [speaker]: voiceId };
    setSpeakerVoiceMapping(newMapping);
    
    setFragments(prev => prev.map(fragment => 
      fragment.speaker === speaker 
        ? { ...fragment, voiceId }
        : fragment
    ));
  };

  const updateSpeakerEmotion = (speaker: string, emotion: TTSEmotion) => {
    const newMapping = { ...speakerEmotionMapping, [speaker]: emotion };
    setSpeakerEmotionMapping(newMapping);
    
    setFragments(prev => prev.map(fragment => 
      fragment.speaker === speaker 
        ? { ...fragment, emotion }
        : fragment
    ));
  };

  const resetForm = () => {
    setRawText("");
    setFragments([]);
    setSelectedVoices(new Set());
    setSelectedFragments(new Set());
    setBulkVoiceId("");
    setBulkEmotion("Conversational");
    setGlobalEmotion("Conversational");
    setIsAlternatingVoices(false);
    setAlternatingVoice1("");
    setAlternatingVoice2("");
    setIsDialogMode(false);
    setDetectedSpeakers([]);
    setSpeakerVoiceMapping({});
    setSpeakerEmotionMapping({});
  };

  const handleImport = () => {
    if (fragments.length === 0) return;

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
          <DialogTitle>Import tekstu do TTS (Transkriptor)</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor={`${dialogId}-text`}>Wklej tekst do wygenerowania</Label>
            <Textarea
              id={`${dialogId}-text`}
              placeholder={isDialogMode 
                ? "Wklej dialog w formacie:\nImię: tekst\nImię2: kolejny tekst" 
                : "Wklej tutaj tekst, który ma zostać przekonwertowany na mowę. Każda linia stanie się osobnym fragmentem audio."}
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

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id={`${dialogId}-dialog-mode`}
                checked={isDialogMode}
                onCheckedChange={handleDialogModeChange}
                data-testid="checkbox-dialog-mode"
              />
              <Label htmlFor={`${dialogId}-dialog-mode`}>Tryb dialogu (imię: tekst)</Label>
            </div>

            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm">Globalny styl:</Label>
              <Select value={globalEmotion} onValueChange={(v) => handleGlobalEmotionChange(v as TTSEmotion)}>
                <SelectTrigger className="w-40" data-testid="select-global-emotion">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableEmotions.map((emotion) => (
                    <SelectItem key={emotion} value={emotion}>
                      {emotionLabels[emotion]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isDialogMode && (
            <p className="text-xs text-muted-foreground">
              Wprowadź tekst w formacie "Imię: tekst" w każdej linii. Głosy i style zostaną automatycznie przypisane do wykrytych mówców.
            </p>
          )}

          {isDialogMode && detectedSpeakers.length > 0 && (
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4" />
                Przypisz głosy i style do mówców
              </h3>
              <div className="grid gap-3">
                {detectedSpeakers.map((speaker) => (
                  <div key={speaker} className="flex flex-wrap items-center gap-3">
                    <div className="w-24">
                      <Label className="text-sm font-medium">{speaker}</Label>
                    </div>
                    <Select 
                      value={speakerVoiceMapping[speaker] || ''} 
                      onValueChange={(voiceId) => updateSpeakerVoice(speaker, voiceId)}
                    >
                      <SelectTrigger className="w-40" data-testid={`select-speaker-voice-${speaker}`}>
                        <SelectValue placeholder="Wybierz głos" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableVoices.map((voice) => (
                          <SelectItem key={voice.id} value={voice.id}>
                            {voice.name} ({voice.gender === 'male' ? 'M' : 'K'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select 
                      value={speakerEmotionMapping[speaker] || globalEmotion} 
                      onValueChange={(emotion) => updateSpeakerEmotion(speaker, emotion as TTSEmotion)}
                    >
                      <SelectTrigger className="w-40" data-testid={`select-speaker-emotion-${speaker}`}>
                        <SelectValue placeholder="Styl" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableEmotions.map((emotion) => (
                          <SelectItem key={emotion} value={emotion}>
                            {emotionLabels[emotion]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {fragments.length > 0 && !isDialogMode && (
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="text-sm font-medium">Przypisanie głosów</h3>
              
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
                              {voice.name} ({voice.gender === 'male' ? 'M' : 'K'})
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
                              {voice.name} ({voice.gender === 'male' ? 'M' : 'K'})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {!isAlternatingVoices && (
                <div className="flex flex-wrap gap-2 items-end">
                  <div className="flex-1 min-w-[150px] space-y-2">
                    <Label>Przypisz jeden głos do wszystkich</Label>
                    <Select value={bulkVoiceId} onValueChange={setBulkVoiceId}>
                      <SelectTrigger data-testid="select-bulk-voice">
                        <SelectValue placeholder="Wybierz głos" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableVoices.map((voice) => (
                          <SelectItem key={voice.id} value={voice.id}>
                            {voice.name} ({voice.gender === 'male' ? 'M' : 'K'})
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
                    Zastosuj głos
                  </Button>
                </div>
              )}

              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[150px] space-y-2">
                  <Label>Przypisz jeden styl do wszystkich</Label>
                  <Select value={bulkEmotion} onValueChange={(v) => setBulkEmotion(v as TTSEmotion)}>
                    <SelectTrigger data-testid="select-bulk-emotion">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableEmotions.map((emotion) => (
                        <SelectItem key={emotion} value={emotion}>
                          {emotionLabels[emotion]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={applyBulkEmotion}
                  data-testid="button-apply-bulk-emotion"
                >
                  Zastosuj styl
                </Button>
              </div>
            </div>
          )}

          {fragments.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium">Fragmenty ({fragments.length})</h3>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={selectAllFragments}
                    data-testid="button-select-all"
                  >
                    {selectedFragments.size === fragments.length ? (
                      <>
                        <Square className="w-4 h-4 mr-1" />
                        Odznacz
                      </>
                    ) : (
                      <>
                        <CheckSquare className="w-4 h-4 mr-1" />
                        Zaznacz
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
                      Usuń ({selectedFragments.size})
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
                      className={`p-3 ${selectedFragments.has(fragment.id) ? 'ring-2 ring-primary' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedFragments.has(fragment.id)}
                          onCheckedChange={() => toggleFragmentSelection(fragment.id)}
                          data-testid={`checkbox-fragment-${fragment.id}`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-muted-foreground mb-1">
                            Fragment {fragment.order + 1}
                            {fragment.speaker && (
                              <span className="ml-2 font-medium">({fragment.speaker})</span>
                            )}
                          </p>
                          <p className="text-sm mb-2 break-words">{fragment.text}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Select 
                              value={fragment.voiceId} 
                              onValueChange={(voiceId) => updateFragmentVoice(fragment.id, voiceId)}
                            >
                              <SelectTrigger className="w-36" data-testid={`select-fragment-voice-${fragment.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableVoices.map((voice) => (
                                  <SelectItem key={voice.id} value={voice.id}>
                                    {voice.name} ({voice.gender === 'male' ? 'M' : 'K'})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select 
                              value={fragment.emotion} 
                              onValueChange={(emotion) => updateFragmentEmotion(fragment.id, emotion as TTSEmotion)}
                            >
                              <SelectTrigger className="w-36" data-testid={`select-fragment-emotion-${fragment.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableEmotions.map((emotion) => (
                                  <SelectItem key={emotion} value={emotion}>
                                    {emotionLabels[emotion]}
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
              
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">Używane głosy:</span>
                <div className="space-y-1">
                  {Array.from(new Set(fragments.map(f => f.voiceId))).map(voiceId => {
                    const voice = getVoiceById(voiceId);
                    const voiceFragments = fragments.filter(f => f.voiceId === voiceId);
                    if (!voice) return null;
                    return (
                      <Card key={voiceId} className="p-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span className="font-medium">{voice.name}</span>
                            <Badge variant="outline">
                              {voice.gender === 'male' ? 'M' : 'K'}
                            </Badge>
                          </div>
                          <Badge variant="secondary">
                            {voiceFragments.length} frag.
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Czas: {formatDuration(TTSService.estimateTotalDuration(voiceFragments))}
                        </p>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={() => { resetForm(); onClose(); }} data-testid="button-cancel">
              Anuluj
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={fragments.length === 0}
              data-testid="button-import"
            >
              Importuj ({fragments.length} fragmentów)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
