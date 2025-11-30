import type { TTSVoice, TTSTextFragment, TTSGenerationResult, TTSEmotion } from "@/types/audio";

export class TTSService {
  static readonly AVAILABLE_EMOTIONS: TTSEmotion[] = [
    "Angry",
    "Calm", 
    "Cheerful",
    "Conversational",
    "Dramatic",
    "Emotional",
    "Formal",
    "Instructional",
    "Narrative",
    "Newcast",
    "Promo",
    "Robotic",
    "Sorrowful",
    "Terrified"
  ];

  static readonly EMOTION_LABELS: Record<TTSEmotion, string> = {
    "Angry": "Zły",
    "Calm": "Spokojny",
    "Cheerful": "Wesoły",
    "Conversational": "Konwersacyjny",
    "Dramatic": "Dramatyczny",
    "Emotional": "Emocjonalny",
    "Formal": "Formalny",
    "Instructional": "Instruktażowy",
    "Narrative": "Narracyjny",
    "Newcast": "Dziennikarski",
    "Promo": "Promocyjny",
    "Robotic": "Robotyczny",
    "Sorrowful": "Smutny",
    "Terrified": "Przerażony"
  };

  static readonly AVAILABLE_VOICES: TTSVoice[] = [
    { id: "Adrian", name: "Adrian", description: "Głos męski", gender: "male", language: "pl-PL" },
    { id: "Alicja", name: "Alicja", description: "Głos żeński", gender: "female", language: "pl-PL" },
    { id: "Andrzej", name: "Andrzej", description: "Głos męski", gender: "male", language: "pl-PL" },
    { id: "Aneta", name: "Aneta", description: "Głos żeński", gender: "female", language: "pl-PL" },
    { id: "Artur", name: "Artur", description: "Głos męski", gender: "male", language: "pl-PL" },
    { id: "Beata", name: "Beata", description: "Głos żeński", gender: "female", language: "pl-PL" },
    { id: "Dariusz", name: "Dariusz", description: "Głos męski", gender: "male", language: "pl-PL" },
    { id: "Dominika", name: "Dominika", description: "Głos żeński", gender: "female", language: "pl-PL" },
    { id: "Elżbieta", name: "Elżbieta", description: "Głos żeński", gender: "female", language: "pl-PL" },
    { id: "Ewa", name: "Ewa", description: "Głos żeński", gender: "female", language: "pl-PL" },
    { id: "Grzegorz", name: "Grzegorz", description: "Głos męski", gender: "male", language: "pl-PL" },
    { id: "Joanna", name: "Joanna", description: "Głos żeński", gender: "female", language: "pl-PL" },
    { id: "Justyna", name: "Justyna", description: "Głos żeński", gender: "female", language: "pl-PL" },
    { id: "Maciej", name: "Maciej", description: "Głos męski", gender: "male", language: "pl-PL" },
    { id: "Magdalena", name: "Magdalena", description: "Głos żeński", gender: "female", language: "pl-PL" },
    { id: "Marcin", name: "Marcin", description: "Głos męski", gender: "male", language: "pl-PL" },
    { id: "Mariusz", name: "Mariusz", description: "Głos męski", gender: "male", language: "pl-PL" },
    { id: "Małgorzata", name: "Małgorzata", description: "Głos żeński", gender: "female", language: "pl-PL" },
    { id: "Michał", name: "Michał", description: "Głos męski", gender: "male", language: "pl-PL" },
    { id: "Monika", name: "Monika", description: "Głos żeński", gender: "female", language: "pl-PL" },
    { id: "Natalia", name: "Natalia", description: "Głos żeński", gender: "female", language: "pl-PL" },
    { id: "Paulina", name: "Paulina", description: "Głos żeński", gender: "female", language: "pl-PL" },
    { id: "Paweł", name: "Paweł", description: "Głos męski", gender: "male", language: "pl-PL" },
    { id: "Piotr", name: "Piotr", description: "Głos męski", gender: "male", language: "pl-PL" },
    { id: "Sebastian", name: "Sebastian", description: "Głos męski", gender: "male", language: "pl-PL" },
    { id: "Tomasz", name: "Tomasz", description: "Głos męski", gender: "male", language: "pl-PL" },
    { id: "Łukasz", name: "Łukasz", description: "Głos męski", gender: "male", language: "pl-PL" }
  ];

  static parseTextToFragments(text: string): string[] {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }

  static async generateAudioForFragment(
    fragment: TTSTextFragment,
    voice: TTSVoice
  ): Promise<TTSGenerationResult> {
    try {
      const response = await fetch("/api/tts/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: fragment.text,
          voice_name: voice.name,
          emotion: fragment.emotion || "Conversational",
          speed_rate: 1.0
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || "Błąd generowania audio");
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBlob = new Blob([arrayBuffer], { type: "audio/mpeg" });

      const wordCount = fragment.text.split(' ').length;
      const estimatedDuration = (wordCount / 150) * 60;

      return {
        fragmentId: fragment.id,
        audioBlob,
        duration: estimatedDuration
      };
    } catch (error) {
      console.error('TTS Generation error:', error);
      throw new Error(`Nie udało się wygenerować audio dla fragmentu: ${fragment.text.substring(0, 50)}...`);
    }
  }

  static async generateAudioForFragments(
    fragments: TTSTextFragment[],
    voices: TTSVoice[],
    onProgress?: (completedCount: number, totalCount: number) => void
  ): Promise<TTSGenerationResult[]> {
    const results: TTSGenerationResult[] = [];

    for (let i = 0; i < fragments.length; i++) {
      const fragment = fragments[i];
      const voice = voices.find(v => v.id === fragment.voiceId);

      if (!voice) {
        throw new Error(`Nie znaleziono głosu o ID: ${fragment.voiceId}`);
      }

      const result = await this.generateAudioForFragment(fragment, voice);
      results.push(result);

      onProgress?.(i + 1, fragments.length);

      if (i < fragments.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    return results;
  }

  static async blobToAudioBuffer(blob: Blob, audioContext: AudioContext): Promise<AudioBuffer> {
    const arrayBuffer = await blob.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
  }

  static estimateTotalDuration(fragments: TTSTextFragment[]): number {
    return fragments.reduce((total, fragment) => {
      const wordCount = fragment.text.split(' ').length;
      const estimatedDuration = (wordCount / 150) * 60;
      return total + estimatedDuration;
    }, 0);
  }

  static groupFragmentsByVoice(fragments: TTSTextFragment[]): Map<string, TTSTextFragment[]> {
    const groupedFragments = new Map<string, TTSTextFragment[]>();

    for (const fragment of fragments) {
      if (!groupedFragments.has(fragment.voiceId)) {
        groupedFragments.set(fragment.voiceId, []);
      }
      groupedFragments.get(fragment.voiceId)!.push(fragment);
    }

    return groupedFragments;
  }
}
