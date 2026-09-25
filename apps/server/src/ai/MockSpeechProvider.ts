import { SpeechProvider, ProviderOptions, CaptionEvent } from '@openstage/shared';

export class MockSpeechProvider implements SpeechProvider {
  readonly providerName = 'MockSpeechProvider';
  private callbacks: ((event: CaptionEvent) => void)[] = [];
  private activeStreams: Map<string, NodeJS.Timeout> = new Map();

  async startStream(options: ProviderOptions): Promise<void> {
    if (this.activeStreams.has(options.sessionId)) {
      return;
    }

    let count = 0;
    const interval = setInterval(() => {
      count++;
      const event: CaptionEvent = {
        sessionId: options.sessionId,
        timestamp: Date.now(),
        original: `[Mock Audio Chunk #${count}] Speaking in ${options.sourceLanguage}`,
        translation: `[Subtítulo Simulado #${count}] Hablando en ${options.targetLanguage}`,
        language: options.sourceLanguage,
        targetLanguage: options.targetLanguage,
        final: true,
      };

      this.callbacks.forEach((cb) => cb(event));
    }, 4000);

    this.activeStreams.set(options.sessionId, interval);
  }

  async sendAudioChunk(): Promise<void> {
    // The mock generates captions on a timer and ignores incoming audio.
  }

  async stopStream(sessionId: string): Promise<void> {
    const interval = this.activeStreams.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.activeStreams.delete(sessionId);
    }
  }

  onCaption(callback: (event: CaptionEvent) => void): void {
    this.callbacks.push(callback);
  }
}
