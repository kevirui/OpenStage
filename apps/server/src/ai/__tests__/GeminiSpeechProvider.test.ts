import { GeminiSpeechProvider } from '../GeminiSpeechProvider.js';

describe('GeminiSpeechProvider Unit Tests', () => {
  it('should parse valid JSON Gemini response correctly', () => {
    const provider = new GeminiSpeechProvider({ apiKey: 'mock_key' });
    const rawResponse = JSON.stringify({
      original: "Welcome to Nerdearla conference.",
      translation: "Bienvenidos a la conferencia Nerdearla."
    });

    const result = provider.parseResponse(rawResponse);
    expect(result.original).toBe("Welcome to Nerdearla conference.");
    expect(result.translation).toBe("Bienvenidos a la conferencia Nerdearla.");
  });

  it('should handle markdown fenced JSON Gemini response', () => {
    const provider = new GeminiSpeechProvider({ apiKey: 'mock_key' });
    const rawResponse = '```json\n{\n  "original": "Building scalable web apps.",\n  "translation": "Construyendo aplicaciones web escalables."\n}\n```';

    const result = provider.parseResponse(rawResponse);
    expect(result.original).toBe("Building scalable web apps.");
    expect(result.translation).toBe("Construyendo aplicaciones web escalables.");
  });

  it('should return fallback structure if response is invalid JSON', () => {
    const provider = new GeminiSpeechProvider({ apiKey: 'mock_key' });
    const rawResponse = "Plain text response without JSON wrapper";

    const result = provider.parseResponse(rawResponse);
    expect(result.original).toBe("Plain text response without JSON wrapper");
    expect(result.translation).toBe("[Translation parse error]");
  });

  it('should throw error when GEMINI_API_KEY is missing', async () => {
    const provider = new GeminiSpeechProvider({ apiKey: '' });
    await expect(
      provider.startStream({
        sessionId: 'test',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        audioSource: { type: 'file', path: 'demo/audio/stage-a.mp3' },
      })
    ).rejects.toThrow('GEMINI_API_KEY environment variable is missing');
  });

  it('should throw error when audio file does not exist', async () => {
    const provider = new GeminiSpeechProvider({ apiKey: 'mock_key' });
    await expect(
      provider.startStream({
        sessionId: 'test',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        audioSource: { type: 'file', path: 'demo/audio/non_existent_file.mp3' },
      })
    ).rejects.toThrow('Demo audio file not found at path');
  });
});
