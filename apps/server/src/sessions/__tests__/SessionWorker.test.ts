import {
  AudioChunk,
  AudioChunkSource,
  CaptionEvent,
  ProviderOptions,
  Session,
  SpeechProvider,
} from '@openstage/shared';
import { SessionWorker } from '../SessionWorker.js';
import { CaptionNormalizer } from '../../captions/CaptionNormalizer.js';

class FakeStreamingProvider implements SpeechProvider {
  readonly providerName = 'FakeStreamingProvider';
  readonly received: AudioChunk[] = [];
  stopped = false;
  private callbacks: ((event: CaptionEvent) => void)[] = [];

  async startStream(_options: ProviderOptions): Promise<void> {}

  async sendAudioChunk(sessionId: string, chunk: AudioChunk): Promise<void> {
    this.received.push(chunk);
    this.emit({
      sessionId,
      timestamp: chunk.offsetMs,
      original: `chunk ${this.received.length}`,
      translation: `fragmento ${this.received.length}`,
      language: 'en',
      targetLanguage: 'es',
      final: this.received.length === 2,
    });
  }

  async stopStream(): Promise<void> {
    this.stopped = true;
  }

  onCaption(callback: (event: CaptionEvent) => void): void {
    this.callbacks.push(callback);
  }

  private emit(event: CaptionEvent): void {
    this.callbacks.forEach((cb) => cb(event));
  }
}

class FakeAudioChunkSource implements AudioChunkSource {
  readonly description = 'fake-audio';

  constructor(private readonly count: number) {}

  async *chunks(): AsyncGenerator<AudioChunk> {
    for (let i = 0; i < this.count; i++) {
      yield {
        data: new Uint8Array(4),
        sampleRate: 16000,
        offsetMs: i * 100,
        durationMs: 100,
      };
    }
  }
}

function demoSession(): Session {
  return {
    id: 'demo-session',
    name: 'demo',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LIVE',
    createdAt: new Date().toISOString(),
  };
}

describe('SessionWorker', () => {
  it('pumps audio chunks to the provider and publishes normalized captions', async () => {
    const provider = new FakeStreamingProvider();
    const published: CaptionEvent[] = [];
    const worker = new SessionWorker(
      demoSession(),
      provider,
      new CaptionNormalizer(),
      { publish: (event) => published.push(event) },
      new FakeAudioChunkSource(2)
    );

    await worker.start();
    await worker.waitForAudioEnd();
    await worker.stop();

    expect(provider.received).toHaveLength(2);
    expect(provider.stopped).toBe(true);
    expect(published.map((event) => [event.timestamp, event.original, event.final])).toEqual([
      [0, 'chunk 1', false],
      [100, 'chunk 2', true],
    ]);
    expect(published[0].id).toBeDefined();
    expect(worker.getMetrics().captionCount).toBe(2);
  });

  it('ignores captions belonging to another session', async () => {
    const provider = new FakeStreamingProvider();
    const published: CaptionEvent[] = [];
    const worker = new SessionWorker(demoSession(), provider, new CaptionNormalizer(), {
      publish: (event) => published.push(event),
    });

    await worker.start();
    await provider.sendAudioChunk('other-session', {
      data: new Uint8Array(4),
      sampleRate: 16000,
      offsetMs: 0,
      durationMs: 100,
    });

    expect(published).toHaveLength(0);
  });
});
