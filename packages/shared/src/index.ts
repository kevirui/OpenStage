export type SessionStatus =
  | 'CREATED'
  | 'STARTING'
  | 'LIVE'
  | 'STOPPING'
  | 'COMPLETED'
  | 'ERROR';

export type AudioSourceType = 'file' | 'stream' | 'mic';

export interface AudioSource {
  type: AudioSourceType;
  path?: string;
  url?: string;
}

export interface Session {
  id: string;
  name: string;
  sourceLanguage: string;
  targetLanguage: string;
  status: SessionStatus;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  audioSource?: AudioSource;
}

export interface CaptionEvent {
  id?: string;
  sessionId: string;
  timestamp: number;
  original: string;
  translation: string;
  language: string;
  targetLanguage: string;
  final: boolean;
}

export interface ProviderOptions {
  sessionId: string;
  sourceLanguage: string;
  targetLanguage: string;
  audioSource?: AudioSource;
  glossary?: string[];
}

export interface AudioChunk {
  /** Raw PCM samples, 16-bit signed, little-endian, mono. */
  data: Uint8Array;
  sampleRate: number;
  /** Offset of the first sample from the start of the audio, in milliseconds. */
  offsetMs: number;
  /** Duration covered by this chunk, in milliseconds. */
  durationMs: number;
}

export interface AudioChunkSource {
  readonly description: string;
  chunks(): AsyncIterable<AudioChunk>;
}

export interface CaptionSink {
  publish(event: CaptionEvent): void;
}

export interface SpeechProvider {
  readonly providerName: string;
  startStream(options: ProviderOptions): Promise<void>;
  sendAudioChunk(sessionId: string, chunk: AudioChunk): Promise<void>;
  stopStream(sessionId: string): Promise<void>;
  onCaption(callback: (event: CaptionEvent) => void): void;
}

export interface SessionMetrics {
  sessionId: string;
  status: SessionStatus;
  captionCount: number;
  latencyMs?: number;
  lastActiveTimestamp?: number;
}
