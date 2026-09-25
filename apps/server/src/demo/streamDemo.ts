import WebSocket from 'ws';
import { ServerMessage } from '@openstage/shared';

/**
 * Starts a seeded session on the running backend and mirrors the captions the
 * browser receives. The audio is decoded and streamed to Gemini by the server,
 * not by this script.
 */
const sessionId = process.argv[2] || 'demo-session';
const serverUrl = process.env.OPENSTAGE_SERVER_URL || 'http://localhost:4000';
const wsUrl = process.env.OPENSTAGE_WS_URL || serverUrl.replace(/^http/, 'ws');

function formatOffset(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

async function startSession(): Promise<void> {
  const response = await fetch(`${serverUrl}/api/sessions/${sessionId}/start`, { method: 'POST' });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to start session ${sessionId}: ${response.status} ${body}`);
  }
}

function run(): void {
  console.log('OpenStage');
  console.log('─────────');
  console.log(`Session: ${sessionId}`);
  console.log(`Backend: ${serverUrl}`);
  console.log(`Audience page: http://localhost:3000/session/${sessionId}\n`);

  const ws = new WebSocket(wsUrl);
  let interimLines = 0;

  const clearInterim = () => {
    for (let i = 0; i < interimLines; i++) {
      process.stdout.write('\x1b[1A\x1b[2K');
    }
    interimLines = 0;
  };

  ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'subscribe', sessionId }));
  });

  ws.on('message', (raw) => {
    let message: ServerMessage;
    try {
      message = JSON.parse(raw.toString()) as ServerMessage;
    } catch {
      return;
    }

    if (message.type === 'subscribed') {
      startSession().catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : String(error));
        ws.close();
        process.exitCode = 1;
      });
      return;
    }

    if (message.type === 'caption') {
      clearInterim();
      const { timestamp, original, translation, final } = message.event;
      process.stdout.write(`[${formatOffset(timestamp)}] EN: ${original}\n         ES: ${translation}\n`);
      if (final) {
        process.stdout.write('\n');
      } else {
        interimLines = 2;
      }
      return;
    }

    if (message.type === 'session') {
      if (message.status === 'COMPLETED' || message.status === 'ERROR') {
        clearInterim();
        console.log(`Session ${message.status}${message.error ? `: ${message.error}` : ''}`);
        ws.close();
        process.exitCode = message.status === 'ERROR' ? 1 : 0;
      }
    }
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error: ${error.message}`);
    console.error('Is the backend running? Start it with `npm run dev:server`.');
    process.exitCode = 1;
  });
}

run();
