import type { TTSVoice, TTSTextFragment, TTSGenerationResult, TTSEmotion, TTSProvider } from "@/types/audio";

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

  static readonly TRANSKRIPTOR_VOICES: TTSVoice[] = [
    { id: "Adrian", name: "Adrian", description: "Głos męski", gender: "male", language: "pl-PL", provider: "transkriptor" },
    { id: "Alicja", name: "Alicja", description: "Głos żeński", gender: "female", language: "pl-PL", provider: "transkriptor" },
    { id: "Andrzej", name: "Andrzej", description: "Głos męski", gender: "male", language: "pl-PL", provider: "transkriptor" },
    { id: "Aneta", name: "Aneta", description: "Głos żeński", gender: "female", language: "pl-PL", provider: "transkriptor" },
    { id: "Artur", name: "Artur", description: "Głos męski", gender: "male", language: "pl-PL", provider: "transkriptor" },
    { id: "Beata", name: "Beata", description: "Głos żeński", gender: "female", language: "pl-PL", provider: "transkriptor" },
    { id: "Dariusz", name: "Dariusz", description: "Głos męski", gender: "male", language: "pl-PL", provider: "transkriptor" },
    { id: "Dominika", name: "Dominika", description: "Głos żeński", gender: "female", language: "pl-PL", provider: "transkriptor" },
    { id: "Elżbieta", name: "Elżbieta", description: "Głos żeński", gender: "female", language: "pl-PL", provider: "transkriptor" },
    { id: "Ewa", name: "Ewa", description: "Głos żeński", gender: "female", language: "pl-PL", provider: "transkriptor" },
    { id: "Grzegorz", name: "Grzegorz", description: "Głos męski", gender: "male", language: "pl-PL", provider: "transkriptor" },
    { id: "Joanna", name: "Joanna", description: "Głos żeński", gender: "female", language: "pl-PL", provider: "transkriptor" },
    { id: "Justyna", name: "Justyna", description: "Głos żeński", gender: "female", language: "pl-PL", provider: "transkriptor" },
    { id: "Maciej", name: "Maciej", description: "Głos męski", gender: "male", language: "pl-PL", provider: "transkriptor" },
    { id: "Magdalena", name: "Magdalena", description: "Głos żeński", gender: "female", language: "pl-PL", provider: "transkriptor" },
    { id: "Marcin", name: "Marcin", description: "Głos męski", gender: "male", language: "pl-PL", provider: "transkriptor" },
    { id: "Mariusz", name: "Mariusz", description: "Głos męski", gender: "male", language: "pl-PL", provider: "transkriptor" },
    { id: "Małgorzata", name: "Małgorzata", description: "Głos żeński", gender: "female", language: "pl-PL", provider: "transkriptor" },
    { id: "Michał", name: "Michał", description: "Głos męski", gender: "male", language: "pl-PL", provider: "transkriptor" },
    { id: "Monika", name: "Monika", description: "Głos żeński", gender: "female", language: "pl-PL", provider: "transkriptor" },
    { id: "Natalia", name: "Natalia", description: "Głos żeński", gender: "female", language: "pl-PL", provider: "transkriptor" },
    { id: "Paulina", name: "Paulina", description: "Głos żeński", gender: "female", language: "pl-PL", provider: "transkriptor" },
    { id: "Paweł", name: "Paweł", description: "Głos męski", gender: "male", language: "pl-PL", provider: "transkriptor" },
    { id: "Piotr", name: "Piotr", description: "Głos męski", gender: "male", language: "pl-PL", provider: "transkriptor" },
    { id: "Sebastian", name: "Sebastian", description: "Głos męski", gender: "male", language: "pl-PL", provider: "transkriptor" },
    { id: "Tomasz", name: "Tomasz", description: "Głos męski", gender: "male", language: "pl-PL", provider: "transkriptor" },
    { id: "Łukasz", name: "Łukasz", description: "Głos męski", gender: "male", language: "pl-PL", provider: "transkriptor" }
  ];

  static readonly OPENAI_VOICES: TTSVoice[] = [
    { id: "alloy", name: "Alloy", description: "Neutralny, wszechstronny głos", gender: "neutral", language: "multi", provider: "openai" },
    { id: "echo", name: "Echo", description: "Głos męski, ciepły", gender: "male", language: "multi", provider: "openai" },
    { id: "fable", name: "Fable", description: "Głos narracyjny, ekspresyjny", gender: "neutral", language: "multi", provider: "openai" },
    { id: "onyx", name: "Onyx", description: "Głos męski, głęboki", gender: "male", language: "multi", provider: "openai" },
    { id: "nova", name: "Nova", description: "Głos żeński, młody", gender: "female", language: "multi", provider: "openai" },
    { id: "shimmer", name: "Shimmer", description: "Głos żeński, delikatny", gender: "female", language: "multi", provider: "openai" }
  ];

  static getVoicesByProvider(provider: TTSProvider): TTSVoice[] {
    return provider === 'openai' ? this.OPENAI_VOICES : this.TRANSKRIPTOR_VOICES;
  }

  static readonly AVAILABLE_VOICES: TTSVoice[] = [...TTSService.TRANSKRIPTOR_VOICES];

  static parseTextToFragments(text: string): string[] {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }

  static async generateAudioForFragment(
    fragment: TTSTextFragment,
    voice: TTSVoice,
    provider: TTSProvider = 'transkriptor',
    maxRetries: number = 3
  ): Promise<TTSGenerationResult> {
    let lastError: Error | null = null;
    
    const endpoint = provider === 'openai' ? '/api/tts/generate/openai' : '/api/tts/generate';
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`TTS [${provider}]: Generowanie fragmentu "${fragment.text.substring(0, 30)}..." (próba ${attempt}/${maxRetries})`);
        
        const body = provider === 'openai' 
          ? {
              text: fragment.text,
              voice: voice.id,
              model: 'tts-1'
            }
          : {
              text: fragment.text,
              voice_name: voice.name,
              emotion: fragment.emotion || "Conversational",
              speed_rate: 1.0
            };

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: response.statusText }));
          const errorMessage = errorData.message || "Błąd generowania audio";
          
          if (response.status >= 500 && attempt < maxRetries) {
            console.warn(`TTS [${provider}]: Błąd serwera (${response.status}), ponawiam za ${attempt * 2} sekundy...`);
            await new Promise(resolve => setTimeout(resolve, attempt * 2000));
            continue;
          }
          
          throw new Error(errorMessage);
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioBlob = new Blob([arrayBuffer], { type: "audio/mpeg" });

        const wordCount = fragment.text.split(' ').length;
        const estimatedDuration = (wordCount / 150) * 60;

        console.log(`TTS [${provider}]: Fragment wygenerowany pomyślnie`);
        
        return {
          fragmentId: fragment.id,
          audioBlob,
          duration: estimatedDuration
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`TTS [${provider}]: Błąd próby ${attempt}:`, lastError.message);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
        }
      }
    }
    
    throw new Error(`Nie udało się wygenerować audio dla fragmentu: ${fragment.text.substring(0, 50)}...`);
  }

  static async generateAudioForFragments(
    fragments: TTSTextFragment[],
    voices: TTSVoice[],
    provider: TTSProvider = 'transkriptor',
    onProgress?: (completedCount: number, totalCount: number) => void
  ): Promise<TTSGenerationResult[]> {
    const results: TTSGenerationResult[] = [];
    const delayBetweenRequests = provider === 'openai' ? 500 : 2000;

    for (let i = 0; i < fragments.length; i++) {
      const fragment = fragments[i];
      const voice = voices.find(v => v.id === fragment.voiceId);

      if (!voice) {
        throw new Error(`Nie znaleziono głosu o ID: ${fragment.voiceId}`);
      }

      const result = await this.generateAudioForFragment(fragment, voice, provider);
      results.push(result);

      onProgress?.(i + 1, fragments.length);

      if (i < fragments.length - 1) {
        console.log(`TTS [${provider}]: Czekam ${delayBetweenRequests}ms przed następnym fragmentem...`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
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
