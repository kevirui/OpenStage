import dotenv from 'dotenv';
import fs from 'fs';
import { CaptionEvent, CaptionSink, Session } from '@openstage/shared';
import { GeminiSpeechProvider } from '../ai/GeminiSpeechProvider.js';
import { CaptionNormalizer } from '../captions/CaptionNormalizer.js';
import { FileAudioChunkSource } from '../audio/FileAudioChunkSource.js';
import { SessionWorker } from '../sessions/SessionWorker.js';
import { resolveFromRepoRoot, rootEnvPath } from '../config/paths.js';

dotenv.config({ path: rootEnvPath });
dotenv.config();

class TerminalCaptionSink implements CaptionSink {
  private interimLines = 0;

  publish(event: CaptionEvent): void {
    this.clearInterim();

    const line = `[${formatOffset(event.timestamp)}] EN: ${event.original}\n         ES: ${event.translation}`;
    if (event.final) {
      process.stdout.write(`${line}\n\n`);
    } else {
      process.stdout.write(`${line}\n`);
      this.interimLines = 2;
    }
  }

  clearInterim(): void {
    for (let i = 0; i < this.interimLines; i++) {
      process.stdout.write('\x1b[1A\x1b[2K');
    }
    this.interimLines = 0;
  }
}

function formatOffset(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

async function runDemo() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY is not set.');
    console.error(`Create a .env file at ${rootEnvPath} or export GEMINI_API_KEY in your environment.`);
    process.exit(1);
  }

  const audioPath = process.argv[2] || 'demo/audio/stage-a.mp3';
  const resolvedAudioPath = resolveFromRepoRoot(audioPath);

  if (!fs.existsSync(resolvedAudioPath)) {
    console.error(`Error: audio file not found at ${resolvedAudioPath}`);
    console.error('Place a recording in demo/audio/ (e.g. stage-a.mp3) or pass a path as the first argument.');
    process.exit(1);
  }

  const provider = new GeminiSpeechProvider({ apiKey });
  const session: Session = {
    id: 'demo-session',
    name: 'Demo session',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LIVE',
    createdAt: new Date().toISOString(),
    audioSource: { type: 'file', path: resolvedAudioPath },
  };

  const sink = new TerminalCaptionSink();
  const audioChunkSource = new FileAudioChunkSource(resolvedAudioPath);
  const worker = new SessionWorker(session, provider, new CaptionNormalizer(), sink, audioChunkSource);

  console.log('OpenStage');
  console.log('─────────');
  console.log(`Session: ${session.id}`);
  console.log(`Source: ${audioPath}`);
  console.log(`Language: ${session.sourceLanguage.toUpperCase()} → ${session.targetLanguage.toUpperCase()}`);
  console.log(`Provider: ${provider.providerName} (Gemini Live streaming)\n`);

  try {
    await worker.start();
    await worker.waitForAudioEnd();
    await worker.stop();
    sink.clearInterim();
    console.log(`Session completed (${worker.getMetrics().captionCount} caption events).`);
  } catch (error) {
    sink.clearInterim();
    console.error(`\nDemo failed: ${error instanceof Error ? error.message : String(error)}`);
    await worker.stop().catch(() => undefined);
    process.exit(1);
  }
}

runDemo();
