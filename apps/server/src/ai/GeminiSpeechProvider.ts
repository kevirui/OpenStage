import { SpeechProvider, ProviderOptions, CaptionEvent } from '@openstage/shared';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

export interface GeminiSpeechProviderConfig {
  apiKey?: string;
  modelName?: string;
}

export class GeminiSpeechProvider implements SpeechProvider {
  readonly providerName = 'GeminiSpeechProvider';
  private apiKey: string;
  private modelName: string;
  private callbacks: ((event: CaptionEvent) => void)[] = [];

  constructor(config: GeminiSpeechProviderConfig = {}) {
    this.apiKey = config.apiKey || process.env.GEMINI_API_KEY || '';
    this.modelName = config.modelName || 'gemini-2.5-flash';
  }

  async startStream(options: ProviderOptions): Promise<void> {
    if (!this.apiKey) {
      throw new Error(
        'GEMINI_API_KEY environment variable is missing. Please set GEMINI_API_KEY in your .env file or environment.'
      );
    }

    const filePath = options.audioSource?.path;
    if (!filePath) {
      throw new Error(
        `Audio source path is missing for session '${options.sessionId}'. Provide a valid audio file path.`
      );
    }

    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(
        `Demo audio file not found at path: ${resolvedPath}. Please place a valid audio file (e.g., stage-a.mp3) in the demo/audio/ directory.`
      );
    }

    const mimeType = this.getMimeType(resolvedPath);
    const audioBuffer = fs.readFileSync(resolvedPath);
    const base64Audio = audioBuffer.toString('base64');

    const ai = new GoogleGenAI({ apiKey: this.apiKey });

    const prompt = `You are a live speech transcriber and translator for technical conference presentations.
Analyze the provided audio file.
1. Extract the complete verbatim speech transcript in its original language (${options.sourceLanguage}).
2. Provide an accurate, fluent translation into ${options.targetLanguage}.
Respond ONLY with a valid JSON object matching this structure:
{
  "original": "Text in original language",
  "translation": "Translated text in target language"
}`;

    try {
      const response = await ai.models.generateContent({
        model: this.modelName,
        contents: [
          {
            inlineData: {
              mimeType,
              data: base64Audio,
            },
          },
          prompt,
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      const textResult = response.text || '';
      const parsed = this.parseResponse(textResult);

      const event: CaptionEvent = {
        id: `cap_gemini_${Date.now()}`,
        sessionId: options.sessionId,
        timestamp: Date.now(),
        original: parsed.original,
        translation: parsed.translation,
        language: options.sourceLanguage,
        targetLanguage: options.targetLanguage,
        final: true,
      };

      this.callbacks.forEach((cb) => cb(event));
    } catch (err: any) {
      if (err.message && err.message.includes('GEMINI_API_KEY')) {
        throw err;
      }
      throw new Error(`Gemini API processing failed: ${err.message || String(err)}`);
    }
  }

  async stopStream(sessionId: string): Promise<void> {
    // For single audio file processing, stream stops automatically upon completion
  }

  onCaption(callback: (event: CaptionEvent) => void): void {
    this.callbacks.push(callback);
  }

  public parseResponse(text: string): { original: string; translation: string } {
    try {
      const cleaned = text.trim().replace(/^```json\s*/, '').replace(/```$/, '');
      const parsed = JSON.parse(cleaned);
      return {
        original: parsed.original || '[No transcription returned]',
        translation: parsed.translation || '[No translation returned]',
      };
    } catch (e) {
      return {
        original: text.trim() || '[Unparseable transcription]',
        translation: '[Translation parse error]',
      };
    }
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.mp3':
        return 'audio/mp3';
      case '.wav':
        return 'audio/wav';
      case '.m4a':
      case '.aac':
        return 'audio/aac';
      case '.ogg':
        return 'audio/ogg';
      case '.flac':
        return 'audio/flac';
      default:
        return 'audio/mp3';
    }
  }
}
