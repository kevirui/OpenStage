import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { CaptionEvent, SessionMetrics } from '@openstage/shared';

interface ClientConnection {
  ws: WebSocket;
  sessionId?: string;
}

export class RealtimeServer {
  private wss: WebSocketServer;
  private clients: Set<ClientConnection> = new Set();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws) => {
      const conn: ClientConnection = { ws };
      this.clients.add(conn);

      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === 'subscribe' && data.sessionId) {
            conn.sessionId = data.sessionId;
            ws.send(
              JSON.stringify({
                type: 'subscribed',
                sessionId: data.sessionId,
              })
            );
          }
        } catch (err) {
          // ignore malformed message
        }
      });

      ws.on('close', () => {
        this.clients.delete(conn);
      });
    });
  }

  broadcastCaption(event: CaptionEvent): void {
    const payload = JSON.stringify({
      type: 'caption',
      event,
    });

    for (const client of this.clients) {
      if (
        client.ws.readyState === WebSocket.OPEN &&
        (!client.sessionId || client.sessionId === event.sessionId)
      ) {
        client.ws.send(payload);
      }
    }
  }

  broadcastMetrics(metrics: SessionMetrics): void {
    const payload = JSON.stringify({
      type: 'metrics',
      metrics,
    });

    for (const client of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }
}
