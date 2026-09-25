import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import {
  CaptionEvent,
  CaptionSink,
  ServerMessage,
  SessionMetrics,
  SessionStatus,
} from '@openstage/shared';

/** Minimal view of a connected client, so the routing logic stays testable. */
export interface RealtimeClient {
  readonly readyState: number;
  send(data: string): void;
}

export interface RealtimeServerOptions {
  /** Lets a subscriber learn the current lifecycle state on connect. */
  statusLookup?: (sessionId: string) => SessionStatus | undefined;
}

/**
 * In-memory WebSocket fan-out. Captions are routed by session: a client only
 * receives events for the sessions it subscribed to.
 */
export class RealtimeServer implements CaptionSink {
  private wss?: WebSocketServer;
  private subscriptions: Map<string, Set<RealtimeClient>> = new Map();
  private statusLookup?: (sessionId: string) => SessionStatus | undefined;

  constructor(server?: Server, options: RealtimeServerOptions = {}) {
    this.statusLookup = options.statusLookup;

    if (!server) {
      return;
    }

    this.wss = new WebSocketServer({ server });
    this.wss.on('connection', (ws) => {
      ws.on('message', (message) => {
        this.handleClientMessage(ws, message.toString());
      });

      ws.on('close', () => {
        this.removeClient(ws);
      });

      ws.on('error', () => {
        this.removeClient(ws);
      });
    });
  }

  subscribe(client: RealtimeClient, sessionId: string): void {
    let clients = this.subscriptions.get(sessionId);
    if (!clients) {
      clients = new Set();
      this.subscriptions.set(sessionId, clients);
    }
    clients.add(client);

    this.send(client, {
      type: 'subscribed',
      sessionId,
      status: this.statusLookup?.(sessionId),
    });
  }

  unsubscribe(client: RealtimeClient, sessionId: string): void {
    const clients = this.subscriptions.get(sessionId);
    if (!clients) {
      return;
    }

    clients.delete(client);
    if (clients.size === 0) {
      this.subscriptions.delete(sessionId);
    }

    this.send(client, { type: 'unsubscribed', sessionId });
  }

  removeClient(client: RealtimeClient): void {
    for (const [sessionId, clients] of this.subscriptions) {
      clients.delete(client);
      if (clients.size === 0) {
        this.subscriptions.delete(sessionId);
      }
    }
  }

  close(): void {
    this.subscriptions.clear();
    this.wss?.close();
  }

  subscriberCount(sessionId: string): number {
    return this.subscriptions.get(sessionId)?.size ?? 0;
  }

  /** `CaptionSink`: the domain layer publishes events without knowing about WebSockets. */
  publish(event: CaptionEvent): void {
    this.broadcastCaption(event);
  }

  broadcastCaption(event: CaptionEvent): void {
    this.broadcast(event.sessionId, { type: 'caption', event });
  }

  broadcastSessionStatus(sessionId: string, status: SessionStatus, error?: string): void {
    this.broadcast(sessionId, { type: 'session', sessionId, status, error });
  }

  broadcastMetrics(metrics: SessionMetrics): void {
    this.broadcast(metrics.sessionId, { type: 'metrics', metrics });
  }

  private broadcast(sessionId: string, message: ServerMessage): void {
    const clients = this.subscriptions.get(sessionId);
    if (!clients) {
      return;
    }

    for (const client of clients) {
      this.send(client, message);
    }
  }

  private send(client: RealtimeClient, message: ServerMessage): void {
    if (client.readyState !== WebSocket.OPEN) {
      return;
    }
    client.send(JSON.stringify(message));
  }

  private handleClientMessage(client: RealtimeClient, raw: string): void {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    if (typeof data !== 'object' || data === null) {
      return;
    }

    const { type, sessionId } = data as { type?: unknown; sessionId?: unknown };
    if (typeof sessionId !== 'string' || sessionId.length === 0) {
      return;
    }

    if (type === 'subscribe') {
      this.subscribe(client, sessionId);
    } else if (type === 'unsubscribe') {
      this.unsubscribe(client, sessionId);
    }
  }
}
