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
   * Konwertuje AudioBuffer do formatu WAV Blob (asynchronicznie)
   */
  static async audioBufferToWavBlob(buffer: AudioBuffer): Promise<Blob> {
    console.log('WAV Export: Converting buffer', {
      channels: buffer.numberOfChannels,
      sampleRate: buffer.sampleRate,
      length: buffer.length,
      duration: buffer.length / buffer.sampleRate
    });

    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM format
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = buffer.length * blockAlign;
    const bufferSize = 44 + dataSize; // WAV header is 44 bytes

    console.log('WAV Export: Header info', {
      bytesPerSample,
      blockAlign,
      byteRate,
      dataSize,
      bufferSize
    });

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

    // Check for audio data issues
    let hasAudio = false;
    let maxSample = 0;
    let minSample = 0;

    // Convert and write audio data in chunks to prevent UI blocking
    const chunkSize = 44100; // Process ~1 second at a time
    for (let start = 0; start < buffer.length; start += chunkSize) {
      const end = Math.min(start + chunkSize, buffer.length);
      
      // Process chunk
      for (let i = start; i < end; i++) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
          const channelData = buffer.getChannelData(channel);
          // Convert float [-1, 1] to 16-bit signed integer
          const sample = Math.max(-1, Math.min(1, channelData[i]));
          
          // Track audio stats
          if (Math.abs(sample) > 0.001) hasAudio = true;
          maxSample = Math.max(maxSample, sample);
          minSample = Math.min(minSample, sample);
          
          const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
          view.setInt16(offset, intSample, true);
          offset += 2;
        }
      }
      
      // Yield control every chunk except the last one
      if (end < buffer.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    console.log('WAV Export: Audio stats', {
      hasAudio,
      maxSample,
      minSample,
      finalOffset: offset,
      expectedSize: bufferSize
    });

    const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
    console.log('WAV Export: Created blob', {
      size: blob.size,
      type: blob.type
    });

    return blob;
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
   * Renderuje timeline do jednego AudioBuffer z asynchronicznym przetwarzaniem
   */
  static async renderTimeline(
    audioContext: AudioContext,
    tracks: any[],
    clips: any[],
    getAudioBuffer: (id: string) => AudioBuffer | undefined,
    totalDuration: number,
    onProgress?: (progress: number) => void
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

    // Process each clip with async yielding
    const totalClips = clips.length;
    let processedClips = 0;
    
    for (const clip of clips) {
      const sourceBuffer = getAudioBuffer(clip.audioFileId);
      if (!sourceBuffer) {
        processedClips++;
        continue;
      }

      const track = tracks.find(t => t.id === clip.trackId);
      if (!track) {
        processedClips++;
        continue;
      }

      const startSample = Math.floor(clip.startTime * sampleRate);
      const clipDurationSamples = Math.min(
        Math.floor(clip.duration * sampleRate),
        sourceBuffer.length
      );

      // Process this clip in chunks to avoid blocking UI
      await this.processClipAsync(
        outputBuffer, 
        sourceBuffer, 
        clip, 
        track, 
        startSample, 
        clipDurationSamples, 
        sampleRate,
        numberOfChannels
      );
      
      processedClips++;
      const progress = Math.floor((processedClips / totalClips) * 80); // Reserve 20% for normalization
      onProgress?.(progress);
      
      // Yield control to prevent freezing
      await this.yield();
    }

    // Apply simple normalization to prevent clipping
    onProgress?.(85);
    await this.normalizeAudioBufferAsync(outputBuffer);
    onProgress?.(100);
    
    return outputBuffer;
  }

  /**
   * Processes a single clip asynchronously
   */
  private static async processClipAsync(
    outputBuffer: AudioBuffer,
    sourceBuffer: AudioBuffer,
    clip: any,
    track: any,
    startSample: number,
    clipDurationSamples: number,
    sampleRate: number,
    numberOfChannels: number
  ): Promise<void> {
    const chunkSize = 44100; // Process ~1 second at a time
    const volume = clip.volume * track.volume * (track.muted ? 0 : 1);
    
    for (let channel = 0; channel < Math.min(numberOfChannels, sourceBuffer.numberOfChannels); channel++) {
      const outputData = outputBuffer.getChannelData(channel);
      const sourceData = sourceBuffer.getChannelData(
        Math.min(channel, sourceBuffer.numberOfChannels - 1)
      );
      
      // Process in chunks
      for (let chunkStart = 0; chunkStart < clipDurationSamples; chunkStart += chunkSize) {
        const chunkEnd = Math.min(chunkStart + chunkSize, clipDurationSamples);
        
        for (let i = chunkStart; i < chunkEnd; i++) {
          const outputIndex = startSample + i;
          if (outputIndex >= outputData.length) break;
          
          const sourceIndex = Math.floor(clip.offset * sampleRate) + i;
          if (sourceIndex >= sourceData.length) break;
          
          // Apply fade effects
          let sampleVolume = volume;
          const clipTime = i / sampleRate;
          
          // Apply fade in
          if (clip.fadeIn && clip.fadeIn > 0 && clipTime < clip.fadeIn) {
            const fadeProgress = Math.max(0, Math.min(1, clipTime / clip.fadeIn));
            sampleVolume *= fadeProgress;
          }
          
          // Apply fade out
          if (clip.fadeOut && clip.fadeOut > 0) {
            const clipDuration = clipDurationSamples / sampleRate;
            const timeFromEnd = clipDuration - clipTime;
            if (timeFromEnd < clip.fadeOut) {
              const fadeProgress = Math.max(0, Math.min(1, timeFromEnd / clip.fadeOut));
              sampleVolume *= fadeProgress;
            }
          }
          
          // Validate sample volume
          if (isNaN(sampleVolume) || !isFinite(sampleVolume)) {
            sampleVolume = 0;
          }
          
          // Mix the sample (add with volume adjustment)
          outputData[outputIndex] += sourceData[sourceIndex] * sampleVolume;
        }
        
        // Yield every chunk
        if (chunkEnd < clipDurationSamples) {
          await this.yield();
        }
      }
    }
  }

  /**
   * Yield control to prevent UI blocking
   */
  private static async yield(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
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

  /**
   * Asynchroniczna wersja normalizacji AudioBuffer
   */
  private static async normalizeAudioBufferAsync(buffer: AudioBuffer): Promise<void> {
    let maxValue = 0;
    const chunkSize = 44100; // Process ~1 second at a time
    
    // Find maximum absolute value in chunks
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      
      for (let start = 0; start < channelData.length; start += chunkSize) {
        const end = Math.min(start + chunkSize, channelData.length);
        
        for (let i = start; i < end; i++) {
          maxValue = Math.max(maxValue, Math.abs(channelData[i]));
        }
        
        // Yield every chunk
        if (end < channelData.length) {
          await this.yield();
        }
      }
    }
    
    // Apply normalization if needed
    if (maxValue > 1.0) {
      const scale = 0.95 / maxValue; // Leave some headroom
      
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        
        for (let start = 0; start < channelData.length; start += chunkSize) {
          const end = Math.min(start + chunkSize, channelData.length);
          
          for (let i = start; i < end; i++) {
            channelData[i] *= scale;
          }
          
          // Yield every chunk
          if (end < channelData.length) {
            await this.yield();
          }
        }
      }
    }
  }
}