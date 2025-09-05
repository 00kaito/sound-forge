import OpenAI from "openai";
import type { TTSVoice, TTSTextFragment, TTSGenerationResult } from "@/types/audio";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const getOpenAIClient = () => {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key nie został skonfigurowany. Sprawdź ustawienia środowiska.");
  }

  return new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true
  });
};

export class TTSService {
  // Available OpenAI TTS voices
  static readonly AVAILABLE_VOICES: TTSVoice[] = [
    {
      id: "alloy",
      name: "Alloy",
      description: "Neutralny, profesjonalny głos",
      gender: "female",
      language: "en-US"
    },
    {
      id: "echo",
      name: "Echo",
      description: "Męski, ciepły głos",
      gender: "male",
      language: "en-US"
    },
    {
      id: "fable",
      name: "Fable",
      description: "Brytyjski akcent, męski",
      gender: "male",
      language: "en-GB"
    },
    {
      id: "onyx",
      name: "Onyx",
      description: "Głęboki, męski głos",
      gender: "male",
      language: "en-US"
    },
    {
      id: "nova",
      name: "Nova",
      description: "Energiczny, żeński głos",
      gender: "female",
      language: "en-US"
    },
    {
      id: "shimmer",
      name: "Shimmer",
      description: "Delikatny, żeński głos",
      gender: "female",
      language: "en-US"
    }
  ];

  /**
   * Parse plain text into fragments (split by newlines)
   */
  static parseTextToFragments(text: string): string[] {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }

  /**
   * Generate audio for a single text fragment
   */
  static async generateAudioForFragment(
    fragment: TTSTextFragment,
    voice: TTSVoice
  ): Promise<TTSGenerationResult> {
    try {
      const openai = getOpenAIClient();
      const response = await openai.audio.speech.create({
        model: "tts-1",
        voice: voice.id as any, // OpenAI voice IDs
        input: fragment.text,
        response_format: "mp3",
        speed: 1.0
      });

      const arrayBuffer = await response.arrayBuffer();
      const audioBlob = new Blob([arrayBuffer], { type: "audio/mp3" });

      // Estimate duration based on text length (rough estimate: ~150 words per minute)
      const wordCount = fragment.text.split(' ').length;
      const estimatedDuration = (wordCount / 150) * 60; // seconds

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

  /**
   * Generate audio for multiple fragments with progress tracking
   */
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

      // Small delay to avoid rate limiting
      if (i < fragments.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return results;
  }

  /**
   * Convert audio blob to AudioBuffer for Web Audio API
   */
  static async blobToAudioBuffer(blob: Blob, audioContext: AudioContext): Promise<AudioBuffer> {
    const arrayBuffer = await blob.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
  }

  /**
   * Estimate total duration for all fragments
   */
  static estimateTotalDuration(fragments: TTSTextFragment[]): number {
    return fragments.reduce((total, fragment) => {
      const wordCount = fragment.text.split(' ').length;
      const estimatedDuration = (wordCount / 150) * 60; // 150 words per minute
      return total + estimatedDuration;
    }, 0);
  }

  /**
   * Group fragments by voice for track organization
   */
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