import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { AudioChunk, AudioChunkSource } from '@openstage/shared';
import { PcmFramer } from './PcmFramer.js';

export interface FileAudioChunkSourceOptions {
  /** Sample rate required by the speech provider. Gemini Live expects 16 kHz. */
  sampleRate?: number;
  chunkDurationMs?: number;
  /** Pace chunks at the natural speed of the recording, like a live feed would. */
  realtime?: boolean;
  ffmpegPath?: string;
  /**
   * Silence appended after the recording. Voice activity detection on the
   * provider side needs a pause to close the last segment, and demo files
   * usually end mid-word.
   */
  trailingSilenceMs?: number;
}

/**
 * Reads a local audio file progressively and yields 16-bit mono PCM chunks.
 *
 * ffmpeg is used only as a decoder: the Gemini Live API accepts raw PCM input
 * exclusively, and the demo recordings are compressed (mp3/m4a/...).
 */
export class FileAudioChunkSource implements AudioChunkSource {
  readonly description: string;
  private readonly filePath: string;
  private readonly sampleRate: number;
  private readonly chunkDurationMs: number;
  private readonly realtime: boolean;
  private readonly ffmpegPath: string;
  private readonly trailingSilenceMs: number;

  constructor(filePath: string, options: FileAudioChunkSourceOptions = {}) {
    this.filePath = filePath;
    this.description = path.basename(filePath);
    this.sampleRate = options.sampleRate ?? 16000;
    this.chunkDurationMs = options.chunkDurationMs ?? 200;
    this.realtime = options.realtime ?? true;
    this.ffmpegPath = options.ffmpegPath ?? process.env.FFMPEG_PATH ?? 'ffmpeg';
    // The translation trails the original by a few seconds, so the silence has
    // to outlast that lag or the last words are never translated.
    this.trailingSilenceMs = options.trailingSilenceMs ?? 4000;
  }

  async *chunks(): AsyncGenerator<AudioChunk> {
    if (!fs.existsSync(this.filePath)) {
      throw new Error(`Audio file not found: ${this.filePath}`);
    }

    const ffmpeg = spawn(this.ffmpegPath, [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      this.filePath,
      '-f',
      's16le',
      '-acodec',
      'pcm_s16le',
      '-ac',
      '1',
      '-ar',
      String(this.sampleRate),
      'pipe:1',
    ]);

    let stderr = '';
    ffmpeg.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    const spawnFailure = new Promise<never>((_resolve, reject) => {
      ffmpeg.on('error', (err: NodeJS.ErrnoException) => {
        reject(
          err.code === 'ENOENT'
            ? new Error(
                `ffmpeg was not found (tried '${this.ffmpegPath}'). Install ffmpeg or set FFMPEG_PATH; it decodes the audio file into the raw PCM required by Gemini Live.`
              )
            : err
        );
      });
    });
    spawnFailure.catch(() => undefined);

    const exited = new Promise<void>((resolve, reject) => {
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(
              `ffmpeg could not decode '${this.filePath}' (exit code ${code}). The audio format may be unsupported. ${stderr.trim()}`
            )
          );
        }
      });
    });
    exited.catch(() => undefined);

    const framer = new PcmFramer(this.sampleRate, this.chunkDurationMs);
    const startedAt = Date.now();

    try {
      for await (const buffer of ffmpeg.stdout as AsyncIterable<Buffer>) {
        for (const chunk of framer.push(buffer)) {
          await this.pace(chunk, startedAt);
          yield chunk;
        }
      }

      const tail = framer.flush();
      let offsetMs = 0;
      if (tail) {
        await this.pace(tail, startedAt);
        yield tail;
        offsetMs = tail.offsetMs + tail.durationMs;
      } else {
        offsetMs = framer.consumedMs;
      }

      for (const silence of this.silenceChunks(offsetMs)) {
        await this.pace(silence, startedAt);
        yield silence;
      }

      await Promise.race([exited, spawnFailure]);
    } finally {
      if (ffmpeg.exitCode === null) {
        ffmpeg.kill('SIGKILL');
      }
    }
  }

  private *silenceChunks(startOffsetMs: number): Generator<AudioChunk> {
    const bytesPerChunk = Math.round((this.sampleRate * this.chunkDurationMs) / 1000) * 2;
    let offsetMs = startOffsetMs;

    for (let elapsed = 0; elapsed < this.trailingSilenceMs; elapsed += this.chunkDurationMs) {
      yield {
        data: new Uint8Array(bytesPerChunk),
        sampleRate: this.sampleRate,
        offsetMs,
        durationMs: this.chunkDurationMs,
      };
      offsetMs += this.chunkDurationMs;
    }
  }

  private async pace(chunk: AudioChunk, startedAt: number): Promise<void> {
    if (!this.realtime) {
      return;
    }
    const dueAt = startedAt + chunk.offsetMs;
    const waitMs = dueAt - Date.now();
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}
