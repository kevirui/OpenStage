import { AudioChunk, CaptionEvent, ProviderOptions, SpeechProvider } from '@openstage/shared';
import { GoogleGenAI, Modality, type LiveServerMessage, type Session as LiveSession } from '@google/genai';
import { LiveCaptionAccumulator } from './LiveCaptionAccumulator.js';
import { buildInterpreterInstruction } from './prompts.js';

export interface GeminiSpeechProviderConfig {
  apiKey?: string;
  modelName?: string;
  /** Upper bound for the wait for trailing captions after the audio ends. */
  finalizeTimeoutMs?: number;
  /** Silence from the model that marks the end of the trailing captions. */
  finalizeIdleMs?: number;
}

export const DEFAULT_LIVE_MODEL = 'gemini-3.5-live-translate-preview';

interface LiveSessionState {
  session: LiveSession;
  accumulator: LiveCaptionAccumulator;
  offsetMs: number;
  closed: boolean;
  error?: Error;
  lastMessageAt: number;
}

/**
 * Streams audio to the Gemini Live API (bidirectional WebSocket) and emits
 * incremental caption events. The model acts as a simultaneous interpreter:
 * its input transcription is the original speech, its output transcription is
 * the translation.
 */
export class GeminiSpeechProvider implements SpeechProvider {
  readonly providerName = 'GeminiSpeechProvider';
  private readonly apiKey: string;
  private readonly modelName: string;
  private readonly finalizeTimeoutMs: number;
  private readonly finalizeIdleMs: number;
  private callbacks: ((event: CaptionEvent) => void)[] = [];
  private states: Map<string, LiveSessionState> = new Map();

  constructor(config: GeminiSpeechProviderConfig = {}) {
    this.apiKey = config.apiKey ?? process.env.GEMINI_API_KEY ?? '';
    this.modelName = config.modelName || process.env.GEMINI_LIVE_MODEL || DEFAULT_LIVE_MODEL;
    this.finalizeTimeoutMs = config.finalizeTimeoutMs ?? 20000;
    this.finalizeIdleMs = config.finalizeIdleMs ?? 3000;
  }

  async startStream(options: ProviderOptions): Promise<void> {
    if (!this.apiKey) {
      throw new Error(
        'GEMINI_API_KEY environment variable is missing. Please set GEMINI_API_KEY in your .env file or environment.'
      );
    }
    if (this.states.has(options.sessionId)) {
      throw new Error(`A Gemini Live session is already running for '${options.sessionId}'.`);
    }

    const ai = new GoogleGenAI({ apiKey: this.apiKey });
    const accumulator = new LiveCaptionAccumulator(
      options.sessionId,
      options.sourceLanguage,
      options.targetLanguage
    );

    let session: LiveSession;
    try {
      session = await ai.live.connect({
        model: this.modelName,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: buildInterpreterInstruction(
            options.sourceLanguage,
            options.targetLanguage,
            options.glossary
          ),
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => this.handleMessage(options.sessionId, message),
          onerror: (event: ErrorEvent) => {
            this.failSession(
              options.sessionId,
              new Error(`Gemini Live session error: ${event.message || 'unknown error'}`)
            );
          },
          onclose: (event: CloseEvent) => {
            const state = this.states.get(options.sessionId);
            if (state && !state.closed) {
              this.failSession(
                options.sessionId,
                new Error(
                  `Gemini Live connection closed unexpectedly (code ${event.code}): ${event.reason || 'no reason given'}`
                )
              );
            }
          },
        },
      });
    } catch (err) {
      throw new Error(
        `Could not open a Gemini Live session with model '${this.modelName}': ${errorMessage(err)}. ` +
          'Check GEMINI_API_KEY and, if the model is unavailable for your key, set GEMINI_LIVE_MODEL to a model that supports the Live API.'
      );
    }

    this.states.set(options.sessionId, {
      session,
      accumulator,
      offsetMs: 0,
      closed: false,
      lastMessageAt: Date.now(),
    });
  }

  async sendAudioChunk(sessionId: string, chunk: AudioChunk): Promise<void> {
    const state = this.requireState(sessionId);
    if (state.error) {
      throw state.error;
    }

    state.offsetMs = chunk.offsetMs + chunk.durationMs;
    state.session.sendRealtimeInput({
      audio: {
        data: Buffer.from(chunk.data).toString('base64'),
        mimeType: `audio/pcm;rate=${chunk.sampleRate}`,
      },
    });
  }

  async stopStream(sessionId: string): Promise<void> {
    const state = this.states.get(sessionId);
    if (!state) {
      return;
    }

    try {
      if (!state.error) {
        await this.waitForTrailingCaptions(state);
        state.session.sendRealtimeInput({ audioStreamEnd: true });
        await this.waitForTrailingCaptions(state);
      }

      const pending = state.accumulator.flush(state.offsetMs);
      if (pending) {
        this.emit(pending);
      }
    } finally {
      state.closed = true;
      this.states.delete(sessionId);
      try {
        state.session.close();
      } catch {
        // connection already gone
      }
    }

    if (state.error) {
      throw state.error;
    }
  }

  onCaption(callback: (event: CaptionEvent) => void): void {
    this.callbacks.push(callback);
  }

  /** Waits until the model stops sending captions, bounded by finalizeTimeoutMs. */
  private async waitForTrailingCaptions(state: LiveSessionState): Promise<void> {
    const deadline = Date.now() + this.finalizeTimeoutMs;
    state.lastMessageAt = Date.now();

    while (Date.now() < deadline && Date.now() - state.lastMessageAt < this.finalizeIdleMs) {
      if (state.error) {
        return;
      }
      await delay(200);
    }
  }

  private handleMessage(sessionId: string, message: LiveServerMessage): void {
    const state = this.states.get(sessionId);
    if (!state) {
      return;
    }

    state.lastMessageAt = Date.now();

    const event = state.accumulator.accept(message, state.offsetMs);
    if (event) {
      this.emit(event);
    }
  }

  private failSession(sessionId: string, error: Error): void {
    const state = this.states.get(sessionId);
    if (state && !state.error) {
      state.error = error;
    }
  }

  private requireState(sessionId: string): LiveSessionState {
    const state = this.states.get(sessionId);
    if (!state) {
      throw new Error(
        `No active Gemini Live session for '${sessionId}'. Call startStream() before sending audio chunks.`
      );
    }
    return state;
  }

  private emit(event: CaptionEvent): void {
    this.callbacks.forEach((cb) => cb(event));
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
