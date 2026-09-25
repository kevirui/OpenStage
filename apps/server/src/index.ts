import express from 'express';
import http from 'http';
import cors from 'cors';
import { config } from './config/index.js';
import { InMemorySessionRepository } from './persistence/InMemorySessionRepository.js';
import { MockSpeechProvider } from './ai/MockSpeechProvider.js';
import { GeminiSpeechProvider } from './ai/GeminiSpeechProvider.js';
import { FileAudioChunkSource } from './audio/FileAudioChunkSource.js';
import { CaptionNormalizer } from './captions/CaptionNormalizer.js';
import { RealtimeServer } from './realtime/RealtimeServer.js';
import { SessionManager } from './sessions/SessionManager.js';
import { resolveFromRepoRoot } from './config/paths.js';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// Initialize architecture components
const repository = new InMemorySessionRepository();
const captionNormalizer = new CaptionNormalizer();
const realtimeServer = new RealtimeServer(server, {
  statusLookup: (sessionId) => repository.peekStatus(sessionId),
});

// Without a key the server still runs, serving mock captions instead of Gemini ones.
const useGemini = Boolean(config.geminiApiKey);
if (!useGemini) {
  console.warn('[OpenStage] GEMINI_API_KEY is not set: sessions will emit mock captions.');
}

const sessionManager = new SessionManager(
  repository,
  () => (useGemini ? new GeminiSpeechProvider({ apiKey: config.geminiApiKey }) : new MockSpeechProvider()),
  captionNormalizer,
  realtimeServer,
  (session) => {
    const path = session.audioSource?.type === 'file' ? session.audioSource.path : undefined;
    return useGemini && path ? new FileAudioChunkSource(resolveFromRepoRoot(path)) : undefined;
  }
);

// Pre-seed demo sessions (Stage A & Stage B) for hackathon demo reproducibility
async function seedDemoSessions() {
  await sessionManager.createSession({
    id: 'stage-a',
    name: 'Stage A: Keynote & Core Track',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    audioSource: {
      type: 'file',
      path: resolveFromRepoRoot('demo/audio/stage-a.mp3'),
    },
  });

  await sessionManager.createSession({
    id: 'stage-b',
    name: 'Stage B: Architecture & AI Track',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    audioSource: {
      type: 'file',
      path: resolveFromRepoRoot('demo/audio/stage-b.mp3'),
    },
  });

  await sessionManager.createSession({
    id: 'demo-session',
    name: 'Demo Session',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    audioSource: {
      type: 'file',
      path: resolveFromRepoRoot('demo/audio/stage-a.mp3'),
    },
  });

  console.log('[OpenStage] Demo sessions (demo-session, stage-a, stage-b) initialized.');
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// REST Endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    provider: useGemini ? 'GeminiSpeechProvider' : 'MockSpeechProvider',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/sessions', async (req, res) => {
  const sessions = await sessionManager.listSessions();
  res.json(sessions);
});

app.post('/api/sessions', async (req, res) => {
  try {
    const session = await sessionManager.createSession(req.body);
    res.status(201).json(session);
  } catch (err) {
    res.status(400).json({ error: errorMessage(err) });
  }
});

app.get('/api/sessions/:id', async (req, res) => {
  const session = await sessionManager.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  const metrics = sessionManager.getMetrics(req.params.id);
  res.json({ ...session, metrics });
});

app.post('/api/sessions/:id/start', async (req, res) => {
  try {
    const session = await sessionManager.startSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: errorMessage(err) });
  }
});

app.post('/api/sessions/:id/stop', async (req, res) => {
  try {
    const session = await sessionManager.stopSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: errorMessage(err) });
  }
});

seedDemoSessions().then(() => {
  server.listen(config.port, () => {
    console.log(`[OpenStage Server] Running on http://localhost:${config.port}`);
  });
});
