import WebSocket from 'ws';
import { ServerMessage } from '@openstage/shared';

/**
 * Starts two seeded sessions on the running backend at the same time and prints
 * their captions interleaved, labelled per session. Each session is processed by
 * its own worker, Gemini connection and audio source on the server.
 */
const sessionIds = process.argv.slice(2);
const sessions = sessionIds.length > 0 ? sessionIds : ['stage-a', 'stage-b'];
const serverUrl = process.env.OPENSTAGE_SERVER_URL || 'http://localhost:4000';
const wsUrl = process.env.OPENSTAGE_WS_URL || serverUrl.replace(/^http/, 'ws');

function formatOffset(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

async function startSession(sessionId: string): Promise<void> {
  const response = await fetch(`${serverUrl}/api/sessions/${sessionId}/start`, { method: 'POST' });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to start ${sessionId}: ${response.status} ${body}`);
  }
}

/** Resolves with the terminal status of one session; failures stay local to it. */
function followSession(sessionId: string): Promise<'COMPLETED' | 'ERROR'> {
  const label = `[${sessionId.toUpperCase()}]`;

  return new Promise((resolve) => {
    const ws = new WebSocket(wsUrl);
    let lastOriginal = '';
    let lastTranslation = '';

    const finish = (status: 'COMPLETED' | 'ERROR', detail?: string) => {
      console.log(`${label} ${status}${detail ? `: ${detail}` : ''}`);
      ws.close();
      resolve(status);
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
        startSession(sessionId).catch((error: unknown) => {
          finish('ERROR', error instanceof Error ? error.message : String(error));
        });
        return;
      }

      if (message.type === 'caption') {
        const { timestamp, original, translation, final } = message.event;
        // Interleaved output stays readable if only the newly added text is printed.
        const newOriginal = original.startsWith(lastOriginal) ? original.slice(lastOriginal.length).trim() : original;
        const newTranslation = translation.startsWith(lastTranslation)
          ? translation.slice(lastTranslation.length).trim()
          : translation;
        lastOriginal = original;
        lastTranslation = translation;
        if (!newOriginal && !newTranslation && !final) {
          return;
        }
        const offset = formatOffset(timestamp);
        console.log(`${label} [${offset}] EN: ${final ? original : newOriginal || original}`);
        console.log(`${label} [${offset}] ES: ${final ? translation : newTranslation || translation}`);
        return;
      }

      if (message.type === 'session') {
        if (message.status === 'COMPLETED' || message.status === 'ERROR') {
          finish(message.status, message.error);
        } else {
          console.log(`${label} ${message.status}`);
        }
      }
    });

    ws.on('error', (error) => {
      finish('ERROR', `${error.message} (is the backend running? \`npm run dev:server\`)`);
    });
  });
}

async function run(): Promise<void> {
  console.log('OpenStage — concurrent sessions');
  console.log('──────────────────────────────');
  for (const sessionId of sessions) {
    console.log(`  ${sessionId}: http://localhost:3000/session/${sessionId}`);
  }
  console.log('');

  // Started together: neither session waits for the other to finish.
  const results = await Promise.all(sessions.map((sessionId) => followSession(sessionId)));

  console.log('');
  sessions.forEach((sessionId, index) => {
    console.log(`${sessionId}: ${results[index]}`);
  });

  process.exitCode = results.every((status) => status === 'COMPLETED') ? 0 : 1;
}

void run();
