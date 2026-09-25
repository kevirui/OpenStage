import { CaptionEvent } from '@openstage/shared';

/**
 * Structural subset of the Gemini Live server payloads we rely on.
 * Declared locally so no provider SDK type leaks into the domain layer.
 */
export interface LiveTranscriptionLike {
  text?: string;
  finished?: boolean;
}

export interface LiveServerContentLike {
  inputTranscription?: LiveTranscriptionLike;
  interimInputTranscription?: LiveTranscriptionLike;
  outputTranscription?: LiveTranscriptionLike;
  turnComplete?: boolean;
  generationComplete?: boolean;
}

export interface LiveMessageLike {
  serverContent?: LiveServerContentLike;
}

/**
 * Turns the incremental transcription fragments of a Live session into caption
 * events: partial fragments produce interim captions, a completed turn produces
 * a final caption and resets the buffers.
 */
export class LiveCaptionAccumulator {
  private original = '';
  private translation = '';

  constructor(
    private readonly sessionId: string,
    private readonly sourceLanguage: string,
    private readonly targetLanguage: string
  ) {}

  accept(message: unknown, timestampMs: number): CaptionEvent | null {
    const content = readServerContent(message);
    if (!content) {
      return null;
    }

    const final = content.turnComplete === true;
    if (!hasNewText(content) && !final) {
      return null;
    }

    this.original += fragmentText(content.interimInputTranscription) + fragmentText(content.inputTranscription);
    this.translation += fragmentText(content.outputTranscription);

    if (this.original === '' && this.translation === '') {
      return null;
    }

    const event: CaptionEvent = {
      sessionId: this.sessionId,
      timestamp: timestampMs,
      original: this.original,
      translation: this.translation,
      language: this.sourceLanguage,
      targetLanguage: this.targetLanguage,
      final,
    };

    if (final) {
      this.original = '';
      this.translation = '';
    }

    return event;
  }

  /** Emits whatever is buffered when the stream ends without a completed turn. */
  flush(timestampMs: number): CaptionEvent | null {
    if (this.original === '' && this.translation === '') {
      return null;
    }
    const event: CaptionEvent = {
      sessionId: this.sessionId,
      timestamp: timestampMs,
      original: this.original,
      translation: this.translation,
      language: this.sourceLanguage,
      targetLanguage: this.targetLanguage,
      final: true,
    };
    this.original = '';
    this.translation = '';
    return event;
  }
}

function readServerContent(message: unknown): LiveServerContentLike | null {
  if (typeof message !== 'object' || message === null) {
    return null;
  }
  const content = (message as LiveMessageLike).serverContent;
  if (typeof content !== 'object' || content === null) {
    return null;
  }
  return content;
}

function fragmentText(fragment: LiveTranscriptionLike | undefined): string {
  return typeof fragment?.text === 'string' ? fragment.text : '';
}

function hasNewText(content: LiveServerContentLike): boolean {
  return (
    fragmentText(content.interimInputTranscription) !== '' ||
    fragmentText(content.inputTranscription) !== '' ||
    fragmentText(content.outputTranscription) !== ''
  );
}
