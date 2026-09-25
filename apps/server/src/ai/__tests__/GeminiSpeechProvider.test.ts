import { GeminiSpeechProvider } from '../GeminiSpeechProvider.js';

describe('GeminiSpeechProvider', () => {
  it('throws when the API key is missing', async () => {
    const provider = new GeminiSpeechProvider({ apiKey: '' });

    await expect(
      provider.startStream({ sessionId: 'test', sourceLanguage: 'en', targetLanguage: 'es' })
    ).rejects.toThrow('GEMINI_API_KEY environment variable is missing');
  });

  it('throws when audio is sent before the stream is started', async () => {
    const provider = new GeminiSpeechProvider({ apiKey: 'mock_key' });

    await expect(
      provider.sendAudioChunk('test', {
        data: new Uint8Array(2),
        sampleRate: 16000,
        offsetMs: 0,
        durationMs: 1,
      })
    ).rejects.toThrow('No active Gemini Live session');
  });

  it('ignores stopStream for unknown sessions', async () => {
    const provider = new GeminiSpeechProvider({ apiKey: 'mock_key' });

    await expect(provider.stopStream('unknown')).resolves.toBeUndefined();
  });
});
