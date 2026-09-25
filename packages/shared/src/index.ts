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
  glossary?: string[];
}

export interface SpeechProvider {
  readonly providerName: string;
  startStream(options: ProviderOptions): Promise<void>;
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
