import { CaptionEvent } from '@openstage/shared';

export class CaptionNormalizer {
  normalize(rawEvent: Partial<CaptionEvent>): CaptionEvent {
    return {
      id: rawEvent.id || `cap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sessionId: rawEvent.sessionId || 'unknown',
      timestamp: rawEvent.timestamp ?? Date.now(),
      original: (rawEvent.original || '').trim(),
      translation: (rawEvent.translation || '').trim(),
      language: rawEvent.language || 'en',
      targetLanguage: rawEvent.targetLanguage || 'es',
      final: rawEvent.final ?? true,
    };
  }
}
