import { CaptionEvent, ProviderOptions, ServerMessage, SpeechProvider } from '@openstage/shared';
import { InMemorySessionRepository } from '../../persistence/InMemorySessionRepository';
import { CaptionNormalizer } from '../../captions/CaptionNormalizer';
import { RealtimeServer } from '../../realtime/RealtimeServer';
import { SessionManager } from '../SessionManager';

class FakeProvider implements SpeechProvider {
  readonly providerName = 'FakeProvider';
  private callbacks: ((event: CaptionEvent) => void)[] = [];
  private sessionId = '';

  async startStream(options: ProviderOptions): Promise<void> {
    this.sessionId = options.sessionId;
  }

  async sendAudioChunk(): Promise<void> {}

  async stopStream(): Promise<void> {}

  onCaption(callback: (event: CaptionEvent) => void): void {
    this.callbacks.push(callback);
  }

  emit(original: string, final = true): void {
    for (const callback of this.callbacks) {
      callback({
        sessionId: this.sessionId,
        timestamp: 0,
        original,
        translation: `${original} (es)`,
        language: 'en',
        targetLanguage: 'es',
        final,
      });
    }
  }
}

class FakeClient {
  readonly readyState = 1;
  readonly messages: ServerMessage[] = [];

  send(data: string): void {
    this.messages.push(JSON.parse(data) as ServerMessage);
  }
}

describe('SessionManager', () => {
  it('routes captions of a started session to that session subscribers only', async () => {
    const repository = new InMemorySessionRepository();
    const realtime = new RealtimeServer();
    const providers = new Map<string, FakeProvider>();
    const manager = new SessionManager(
      repository,
      (session) => {
        const provider = new FakeProvider();
        providers.set(session.id, provider);
        return provider;
      },
      new CaptionNormalizer(),
      realtime
    );

    await manager.createSession({ id: 'session-a', name: 'A', sourceLanguage: 'en', targetLanguage: 'es' });
    await manager.createSession({ id: 'session-b', name: 'B', sourceLanguage: 'en', targetLanguage: 'es' });

    const clientA = new FakeClient();
    const clientB = new FakeClient();
    realtime.subscribe(clientA, 'session-a');
    realtime.subscribe(clientB, 'session-b');

    await manager.startSession('session-a');
    providers.get('session-a')!.emit('hello');

    expect(clientA.messages.filter((message) => message.type === 'session').map((m) => m.type === 'session' && m.status))
      .toEqual(['STARTING', 'LIVE']);
    expect(
      clientA.messages
        .filter((message): message is Extract<ServerMessage, { type: 'caption' }> => message.type === 'caption')
        .map((message) => message.event.original)
    ).toEqual(['hello']);
    expect(clientB.messages.some((message) => message.type === 'caption')).toBe(false);
  });

  it('reports ERROR when the provider fails to start', async () => {
    const repository = new InMemorySessionRepository();
    const realtime = new RealtimeServer();
    const manager = new SessionManager(
      repository,
      () => {
        const provider = new FakeProvider();
        provider.startStream = async () => {
          throw new Error('provider unavailable');
        };
        return provider;
      },
      new CaptionNormalizer(),
      realtime
    );

    await manager.createSession({ id: 'session-a', name: 'A', sourceLanguage: 'en', targetLanguage: 'es' });
    const client = new FakeClient();
    realtime.subscribe(client, 'session-a');

    await expect(manager.startSession('session-a')).rejects.toThrow('provider unavailable');
    expect(client.messages.at(-1)).toEqual({
      type: 'session',
      sessionId: 'session-a',
      status: 'ERROR',
      error: 'provider unavailable',
    });
  });
});
