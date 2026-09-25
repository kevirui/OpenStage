import { AudioChunk } from '@openstage/shared';

const BYTES_PER_SAMPLE = 2;

/**
 * Splits a continuous stream of 16-bit mono PCM bytes into fixed-duration chunks,
 * keeping track of each chunk's offset within the audio.
 */
export class PcmFramer {
  private readonly sampleRate: number;
  private readonly chunkBytes: number;
  private pending: Buffer = Buffer.alloc(0);
  private emittedBytes = 0;

  constructor(sampleRate: number, chunkDurationMs: number) {
    if (sampleRate <= 0 || chunkDurationMs <= 0) {
      throw new Error('PcmFramer requires a positive sampleRate and chunkDurationMs');
    }
    this.sampleRate = sampleRate;
    this.chunkBytes = Math.floor((sampleRate * BYTES_PER_SAMPLE * chunkDurationMs) / 1000);
  }

  /** Milliseconds of audio already emitted as chunks. */
  get consumedMs(): number {
    return this.bytesToMs(this.emittedBytes);
  }

  push(buffer: Buffer): AudioChunk[] {
    this.pending = this.pending.length === 0 ? buffer : Buffer.concat([this.pending, buffer]);

    const chunks: AudioChunk[] = [];
    while (this.pending.length >= this.chunkBytes) {
      chunks.push(this.take(this.chunkBytes));
    }
    return chunks;
  }

  flush(): AudioChunk | null {
    if (this.pending.length === 0) {
      return null;
    }
    return this.take(this.pending.length);
  }

  private take(byteCount: number): AudioChunk {
    const data = this.pending.subarray(0, byteCount);
    this.pending = this.pending.subarray(byteCount);

    const chunk: AudioChunk = {
      data,
      sampleRate: this.sampleRate,
      offsetMs: this.bytesToMs(this.emittedBytes),
      durationMs: this.bytesToMs(byteCount),
    };

    this.emittedBytes += byteCount;
    return chunk;
  }

  private bytesToMs(bytes: number): number {
    return Math.round((bytes / (this.sampleRate * BYTES_PER_SAMPLE)) * 1000);
  }
}
