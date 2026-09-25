import {
  AudioChunk,
  AudioChunkSource,
  CaptionEvent,
  ProviderOptions,
  ServerMessage,
  SessionStatus,
  SpeechProvider,
} from '@openstage/shared';
import { InMemorySessionRepository } from '../../persistence/InMemorySessionRepository';
import { CaptionNormalizer } from '../../captions/CaptionNormalizer';
import { RealtimeServer } from '../../realtime/RealtimeServer';
import { SessionManager } from '../SessionManager';

const tick = () => new Promise((resolve) => setImmediate(resolve));

/** Emits one caption per received chunk so the caption order mirrors the audio order. */
class EchoProvider implements SpeechProvider {
  readonly providerName = 'EchoProvider';
  readonly chunkOffsets: number[] = [];
  stopped = false;
  private callbacks: ((event: CaptionEvent) => void)[] = [];
  private sessionId = '';

  async startStream(options: ProviderOptions): Promise<void> {
    this.sessionId = options.sessionId;
  }

  async sendAudioChunk(sessionId: string, chunk: AudioChunk): Promise<void> {
    this.chunkOffsets.push(chunk.offsetMs);
    for (const callback of this.callbacks) {
      callback({
        sessionId,
        timestamp: chunk.offsetMs,
        original: `${sessionId}-chunk-${chunk.offsetMs}`,
        translation: `${sessionId}-fragmento-${chunk.offsetMs}`,
        language: 'en',
        targetLanguage: 'es',
        final: false,
      });
    }
  }

  async stopStream(): Promise<void> {
    this.stopped = true;
  }

  onCaption(callback: (event: CaptionEvent) => void): void {
    this.callbacks.push(callback);
  }
}

/** Yields `count` chunks, optionally throwing at `failAt` to simulate a broken source. */
class FakeAudioSource implements AudioChunkSource {
  readonly description = 'fake';

  constructor(private count: number, private failAt?: number) {}

  async *chunks(): AsyncIterable<AudioChunk> {
    for (let index = 0; index < this.count; index++) {
      await tick();
      if (this.failAt === index) {
        throw new Error('audio source failed');
      }
      yield {
        data: new Uint8Array([index]),
        sampleRate: 16000,
        offsetMs: index * 200,
        durationMs: 200,
      };
    }
  }
}

class FakeClient {
  readonly readyState = 1;
  readonly messages: ServerMessage[] = [];

  send(data: string): void {
    this.messages.push(JSON.parse(data) as ServerMessage);
  }

  captions(): string[] {
    return this.messages
      .filter((message): message is Extract<ServerMessage, { type: 'caption' }> => message.type === 'caption')
      .map((message) => message.event.original);
  }

  statuses(): SessionStatus[] {
    return this.messages
      .filter((message): message is Extract<ServerMessage, { type: 'session' }> => message.type === 'session')
      .map((message) => message.status);
  }
}

interface Harness {
  manager: SessionManager;
  realtime: RealtimeServer;
  repository: InMemorySessionRepository;
  providers: Map<string, EchoProvider>;
}

function buildHarness(sources: Record<string, AudioChunkSource>): Harness {
  const repository = new InMemorySessionRepository();
  const realtime = new RealtimeServer();
  const providers = new Map<string, EchoProvider>();

  const manager = new SessionManager(
    repository,
    (session) => {
      const provider = new EchoProvider();
      providers.set(session.id, provider);
      return provider;
    },
    new CaptionNormalizer(),
    realtime,
    (session) => sources[session.id]
  );

  return { manager, realtime, repository, providers };
}

async function waitForStatus(
  repository: InMemorySessionRepository,
  id: string,
  status: SessionStatus
): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (repository.peekStatus(id) === status) {
      return;
    }
    await tick();
  }
  throw new Error(`Timed out waiting for ${id} to reach ${status} (was ${repository.peekStatus(id)})`);
}

describe('concurrent sessions', () => {
  it('runs two sessions at the same time with independent pipelines', async () => {
    const harness = buildHarness({
      'session-a': new FakeAudioSource(4),
      'session-b': new FakeAudioSource(4),
    });

    await harness.manager.createSession({ id: 'session-a', name: 'A', sourceLanguage: 'en', targetLanguage: 'es' });
    await harness.manager.createSession({ id: 'session-b', name: 'B', sourceLanguage: 'en', targetLanguage: 'es' });

    const clientA = new FakeClient();
    const clientB = new FakeClient();
    harness.realtime.subscribe(clientA, 'session-a');
    harness.realtime.subscribe(clientB, 'session-b');

    // Both started before either finishes: the pipelines overlap in time.
    await Promise.all([harness.manager.startSession('session-a'), harness.manager.startSession('session-b')]);
    expect(harness.repository.peekStatus('session-a')).toBe('LIVE');
    expect(harness.repository.peekStatus('session-b')).toBe('LIVE');

    await waitForStatus(harness.repository, 'session-a', 'COMPLETED');
    await waitForStatus(harness.repository, 'session-b', 'COMPLETED');

    expect(harness.providers.get('session-a')).not.toBe(harness.providers.get('session-b'));
    expect(harness.providers.get('session-a')!.chunkOffsets).toEqual([0, 200, 400, 600]);
    expect(harness.providers.get('session-b')!.chunkOffsets).toEqual([0, 200, 400, 600]);

    expect(clientA.captions().every((caption) => caption.startsWith('session-a'))).toBe(true);
    expect(clientB.captions().every((caption) => caption.startsWith('session-b'))).toBe(true);
    expect(clientA.captions().length).toBe(4);
    expect(clientB.captions().length).toBe(4);
  });

  it('keeps session B running when session A fails mid-stream', async () => {
    const harness = buildHarness({
      'session-a': new FakeAudioSource(4, 1),
      'session-b': new FakeAudioSource(4),
    });

    await harness.manager.createSession({ id: 'session-a', name: 'A', sourceLanguage: 'en', targetLanguage: 'es' });
    await harness.manager.createSession({ id: 'session-b', name: 'B', sourceLanguage: 'en', targetLanguage: 'es' });

    const clientA = new FakeClient();
    const clientB = new FakeClient();
    harness.realtime.subscribe(clientA, 'session-a');
    harness.realtime.subscribe(clientB, 'session-b');

    await Promise.all([harness.manager.startSession('session-a'), harness.manager.startSession('session-b')]);

    await waitForStatus(harness.repository, 'session-a', 'ERROR');
    await waitForStatus(harness.repository, 'session-b', 'COMPLETED');

    expect(clientA.statuses()).toEqual(['STARTING', 'LIVE', 'ERROR']);
    expect(clientB.statuses()).toEqual(['STARTING', 'LIVE', 'STOPPING', 'COMPLETED']);
    expect(clientB.captions().length).toBe(4);

    // The failed session releases its provider; the healthy one is cleaned up too.
    expect(harness.providers.get('session-a')!.stopped).toBe(true);
    expect(harness.providers.get('session-b')!.stopped).toBe(true);
    expect(harness.manager.getMetrics('session-a')).toBeNull();
    expect(harness.manager.getMetrics('session-b')).toBeNull();
  });
});
