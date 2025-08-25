import { TranscriptSegment } from '@/types/audio';

/**
 * Parse SRT subtitle format to transcript segments
 * SRT format:
 * 1
 * 00:00:00,000 --> 00:00:05,000
 * Text content here
 * 
 * 2
 * 00:00:05,000 --> 00:00:10,000
 * Next text segment
 */
export function parseSRT(content: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  
  // Split by double newlines to get individual segments
  const blocks = content.trim().split(/\n\s*\n/);
  
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    
    if (lines.length < 3) continue; // Skip invalid blocks
    
    const sequenceNumber = lines[0].trim();
    const timeLine = lines[1].trim();
    const text = lines.slice(2).join(' ').trim();
    
    // Parse time format: 00:00:00,000 --> 00:00:05,000
    const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
    
    if (!timeMatch) continue; // Skip invalid time format
    
    // Convert to seconds
    const startTime = parseInt(timeMatch[1]) * 3600 + 
                      parseInt(timeMatch[2]) * 60 + 
                      parseInt(timeMatch[3]) + 
                      parseInt(timeMatch[4]) / 1000;
                      
    const endTime = parseInt(timeMatch[5]) * 3600 + 
                    parseInt(timeMatch[6]) * 60 + 
                    parseInt(timeMatch[7]) + 
                    parseInt(timeMatch[8]) / 1000;
    
    segments.push({
      id: `segment-${sequenceNumber}`,
      startTime,
      endTime,
      text: text.replace(/<[^>]*>/g, '') // Remove HTML tags
    });
  }
  
  return segments.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Load SRT file and parse it
 */
export async function loadSRTFile(file: File): Promise<TranscriptSegment[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const segments = parseSRT(content);
        resolve(segments);
      } catch (error) {
        reject(new Error('Failed to parse SRT file: ' + error));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file, 'utf-8');
  });
}

/**
 * Format time for display (MM:SS or HH:MM:SS)
 */
export function formatTranscriptTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}