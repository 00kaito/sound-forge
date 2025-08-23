export class AudioConcatenator {
  /**
   * Łączy wiele AudioBuffer w jeden, zgodnie z algorytmem z załączonego tekstu
   */
  static concatenateAudioBuffers(audioContext: AudioContext, buffers: AudioBuffer[]): AudioBuffer {
    if (buffers.length === 0) {
      throw new Error('No buffers provided for concatenation');
    }

    // 1. Oblicz łączną długość
    const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
    
    // 2. Stwórz nowy bufor
    const outputBuffer = audioContext.createBuffer(
      buffers[0].numberOfChannels, // np. 2 dla stereo
      totalLength,
      buffers[0].sampleRate // np. 44100 Hz
    );
    
    // 3. Skopiuj dane kanał po kanale
    let offset = 0;
    for (const buffer of buffers) {
      for (let channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
        const outputData = outputBuffer.getChannelData(channel);
        const inputData = buffer.getChannelData(channel);
        // Skopiuj próbki z inputData do outputData, zaczynając od 'offset'
        outputData.set(inputData, offset);
      }
      offset += buffer.length; // Przesuń offset o długość właśnie skopiowanego pliku
    }
    
    return outputBuffer;
  }

  /**
   * Konwertuje AudioBuffer do formatu WAV Blob
   */
  static audioBufferToWavBlob(buffer: AudioBuffer): Blob {
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM format
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = buffer.length * blockAlign;
    const bufferSize = 44 + dataSize; // WAV header is 44 bytes

    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);
    
    let offset = 0;

    // WAV Header
    // ChunkID "RIFF"
    view.setUint32(offset, 0x46464952, false); offset += 4;
    // ChunkSize
    view.setUint32(offset, bufferSize - 8, true); offset += 4;
    // Format "WAVE"
    view.setUint32(offset, 0x45564157, false); offset += 4;
    
    // Subchunk1ID "fmt "
    view.setUint32(offset, 0x20746d66, false); offset += 4;
    // Subchunk1Size (16 for PCM)
    view.setUint32(offset, 16, true); offset += 4;
    // AudioFormat (1 for PCM)
    view.setUint16(offset, format, true); offset += 2;
    // NumChannels
    view.setUint16(offset, numberOfChannels, true); offset += 2;
    // SampleRate
    view.setUint32(offset, sampleRate, true); offset += 4;
    // ByteRate
    view.setUint32(offset, byteRate, true); offset += 4;
    // BlockAlign
    view.setUint16(offset, blockAlign, true); offset += 2;
    // BitsPerSample
    view.setUint16(offset, bitDepth, true); offset += 2;
    
    // Subchunk2ID "data"
    view.setUint32(offset, 0x61746164, false); offset += 4;
    // Subchunk2Size
    view.setUint32(offset, dataSize, true); offset += 4;

    // Convert and write audio data
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        // Convert float [-1, 1] to 16-bit signed integer
        const sample = Math.max(-1, Math.min(1, channelData[i]));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  /**
   * Pobiera plik Blob na dysk użytkownika
   */
  static downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Renderuje timeline do jednego AudioBuffer
   */
  static async renderTimeline(
    audioContext: AudioContext,
    tracks: any[],
    clips: any[],
    getAudioBuffer: (id: string) => AudioBuffer | undefined,
    totalDuration: number
  ): Promise<AudioBuffer> {
    const sampleRate = audioContext.sampleRate;
    const numberOfChannels = 2; // Stereo
    const length = Math.ceil(totalDuration * sampleRate);
    
    if (length === 0) {
      // Return empty buffer if no content
      return audioContext.createBuffer(numberOfChannels, 1, sampleRate);
    }

    const outputBuffer = audioContext.createBuffer(numberOfChannels, length, sampleRate);
    
    // Clear output buffer
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const channelData = outputBuffer.getChannelData(channel);
      channelData.fill(0);
    }

    // Process each clip
    for (const clip of clips) {
      const sourceBuffer = getAudioBuffer(clip.audioFileId);
      if (!sourceBuffer) continue;

      const track = tracks.find(t => t.id === clip.trackId);
      if (!track) continue;

      const startSample = Math.floor(clip.startTime * sampleRate);
      const clipDurationSamples = Math.min(
        Math.floor(clip.duration * sampleRate),
        sourceBuffer.length
      );

      // Mix this clip into the output buffer
      for (let channel = 0; channel < Math.min(numberOfChannels, sourceBuffer.numberOfChannels); channel++) {
        const outputData = outputBuffer.getChannelData(channel);
        const sourceData = sourceBuffer.getChannelData(
          Math.min(channel, sourceBuffer.numberOfChannels - 1)
        );
        
        const volume = clip.volume * track.volume * (track.muted ? 0 : 1);
        
        for (let i = 0; i < clipDurationSamples; i++) {
          const outputIndex = startSample + i;
          if (outputIndex >= outputData.length) break;
          
          const sourceIndex = Math.floor(clip.offset * sampleRate) + i;
          if (sourceIndex >= sourceData.length) break;
          
          // Mix the sample (add with volume adjustment)
          outputData[outputIndex] += sourceData[sourceIndex] * volume;
        }
      }
    }

    // Apply simple normalization to prevent clipping
    this.normalizeAudioBuffer(outputBuffer);
    
    return outputBuffer;
  }

  /**
   * Normalizuje AudioBuffer żeby zapobiec clippingowi
   */
  private static normalizeAudioBuffer(buffer: AudioBuffer): void {
    let maxValue = 0;
    
    // Find maximum absolute value
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < channelData.length; i++) {
        maxValue = Math.max(maxValue, Math.abs(channelData[i]));
      }
    }
    
    // Apply normalization if needed
    if (maxValue > 1.0) {
      const scale = 0.95 / maxValue; // Leave some headroom
      
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < channelData.length; i++) {
          channelData[i] *= scale;
        }
      }
    }
  }
}