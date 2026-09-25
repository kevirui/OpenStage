import http from 'http';
import { AddressInfo } from 'net';
import WebSocket from 'ws';
import { CaptionEvent, ServerMessage } from '@openstage/shared';
import { RealtimeServer } from '../RealtimeServer';

function caption(sessionId: string, original: string, final = true): CaptionEvent {
  return {
    sessionId,
    timestamp: 1000,
    original,
    translation: `${original} (es)`,
    language: 'en',
    targetLanguage: 'es',
    final,
  };
}

/** Collects every message a client receives, so absence can be asserted too. */
class Recorder {
  readonly messages: ServerMessage[] = [];

  constructor(private readonly ws: WebSocket) {
    ws.on('message', (raw) => {
      this.messages.push(JSON.parse(raw.toString()) as ServerMessage);
    });
  }

  async waitFor(predicate: (message: ServerMessage) => boolean, timeoutMs = 1000): Promise<ServerMessage> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const found = this.messages.find(predicate);
      if (found) {
        return found;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Timed out waiting for message. Received: ${JSON.stringify(this.messages)}`);
  }

  send(message: unknown): void {
    this.ws.send(JSON.stringify(message));
  }
}

describe('RealtimeServer', () => {
  let server: http.Server;
  let realtime: RealtimeServer;
  let url: string;
  const sockets: WebSocket[] = [];

  beforeEach(async () => {
    server = http.createServer();
    realtime = new RealtimeServer(server, {
      statusLookup: (sessionId) => (sessionId === 'session-a' ? 'LIVE' : undefined),
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    url = `ws://localhost:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    for (const socket of sockets.splice(0)) {
      socket.close();
    }
    realtime.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  async function connect(sessionId: string): Promise<Recorder> {
    const ws = new WebSocket(url);
    sockets.push(ws);
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', reject);
    });

    const recorder = new Recorder(ws);
    recorder.send({ type: 'subscribe', sessionId });
    await recorder.waitFor((message) => message.type === 'subscribed');
    return recorder;
  }

  it('acknowledges a subscription with the current session status', async () => {
    const client = await connect('session-a');

    expect(await client.waitFor((message) => message.type === 'subscribed')).toEqual({
      type: 'subscribed',
      sessionId: 'session-a',
      status: 'LIVE',
    });
    expect(realtime.subscriberCount('session-a')).toBe(1);
  });

  it('delivers captions only to subscribers of that session', async () => {
    const clientA = await connect('session-a');
    const clientB = await connect('session-b');

    realtime.publish(caption('session-a', 'hello stage A'));
    realtime.publish(caption('session-b', 'hello stage B'));

    const received = await clientA.waitFor((message) => message.type === 'caption');
    expect(received).toEqual({ type: 'caption', event: caption('session-a', 'hello stage A') });

    const captionsForB = clientB.messages.filter((message) => message.type === 'caption');
    expect(captionsForB).toEqual([{ type: 'caption', event: caption('session-b', 'hello stage B') }]);
  });

  it('preserves the interim/final state of caption events', async () => {
    const client = await connect('session-a');

    realtime.publish(caption('session-a', 'partial', false));
    realtime.publish(caption('session-a', 'partial sentence', true));

    await client.waitFor((message) => message.type === 'caption' && message.event.final);
    expect(
      client.messages
        .filter((message): message is Extract<ServerMessage, { type: 'caption' }> => message.type === 'caption')
        .map((message) => message.event.final)
    ).toEqual([false, true]);
  });

  it('broadcasts session lifecycle changes to that session only', async () => {
    const clientA = await connect('session-a');
    const clientB = await connect('session-b');

    realtime.broadcastSessionStatus('session-a', 'COMPLETED');

    await clientA.waitFor((message) => message.type === 'session' && message.status === 'COMPLETED');
    expect(clientB.messages.some((message) => message.type === 'session')).toBe(false);
  });

  it('stops delivering captions after unsubscribe', async () => {
    const client = await connect('session-a');

    client.send({ type: 'unsubscribe', sessionId: 'session-a' });
    await client.waitFor((message) => message.type === 'unsubscribed');
    expect(realtime.subscriberCount('session-a')).toBe(0);

    realtime.publish(caption('session-a', 'ignored'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(client.messages.some((message) => message.type === 'caption')).toBe(false);
  });

  it('ignores malformed client messages', async () => {
    const ws = new WebSocket(url);
    sockets.push(ws);
    await new Promise<void>((resolve) => ws.once('open', () => resolve()));

    ws.send('not json');
    ws.send(JSON.stringify({ type: 'subscribe' }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(realtime.subscriberCount('session-a')).toBe(0);
    expect(ws.readyState).toBe(WebSocket.OPEN);
  });
});
