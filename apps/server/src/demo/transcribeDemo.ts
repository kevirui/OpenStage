import dotenv from 'dotenv';
import fs from 'fs';
import { GeminiSpeechProvider } from '../ai/GeminiSpeechProvider.js';
import { CaptionNormalizer } from '../captions/CaptionNormalizer.js';
import { AudioSourceManager } from '../audio/AudioSourceManager.js';
import { resolveFromRepoRoot, rootEnvPath } from '../config/paths.js';

dotenv.config({ path: rootEnvPath });
dotenv.config();

async function runDemo() {
  console.log('=== OpenStage Vertical Slice Demo: Gemini Speech & Translation ===\n');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: GEMINI_API_KEY is not set.');
    console.error(`Please create a .env file at ${rootEnvPath} or export GEMINI_API_KEY in your environment.`);
    console.error('Example: GEMINI_API_KEY=your_google_gemini_api_key\n');
    process.exit(1);
  }

  const audioPath = process.argv[2] || 'demo/audio/stage-a.mp3';
  const resolvedAudioPath = resolveFromRepoRoot(audioPath);

  const audioSourceManager = new AudioSourceManager();
  const isValidSource = audioSourceManager.validateSource({
    type: 'file',
    path: resolvedAudioPath,
  });

  if (!isValidSource || !fs.existsSync(resolvedAudioPath)) {
    console.error(`❌ Error: Demo audio file not found at path: ${resolvedAudioPath}`);
    console.error('Please place a valid audio file (e.g. stage-a.mp3) in the demo/audio/ directory.');
    console.error('Example: demo/audio/stage-a.mp3\n');
    process.exit(1);
  }

  console.log(`🎙 Processing Audio File: ${resolvedAudioPath}`);
  console.log('🤖 Sending audio payload to Gemini API (gemini-2.5-flash)...\n');

  const provider = new GeminiSpeechProvider({ apiKey });
  const normalizer = new CaptionNormalizer();

  provider.onCaption((event) => {
    const normalized = normalizer.normalize(event);
    console.log('✨ [CaptionEvent Received]:');
    console.log(JSON.stringify(normalized, null, 2));
    console.log('\n✅ Demo vertical slice executed successfully!');
  });

  try {
    await provider.startStream({
      sessionId: 'demo-session-stage-a',
      sourceLanguage: 'en',
      targetLanguage: 'es',
      audioSource: {
        type: 'file',
        path: resolvedAudioPath,
      },
    });
  } catch (error: any) {
    console.error('❌ Demo processing error:', error.message || error);
    process.exit(1);
  }
}

runDemo();
