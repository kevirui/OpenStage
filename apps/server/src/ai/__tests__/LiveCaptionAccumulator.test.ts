import { LiveCaptionAccumulator } from '../LiveCaptionAccumulator.js';

function accumulator() {
  return new LiveCaptionAccumulator('demo-session', 'en', 'es');
}

describe('LiveCaptionAccumulator', () => {
  it('accumulates interim transcription and translation fragments', () => {
    const acc = accumulator();

    const first = acc.accept(
      { serverContent: { inputTranscription: { text: 'Today we' } } },
      1000
    );
    const second = acc.accept(
      {
        serverContent: {
          inputTranscription: { text: ' are going to talk' },
          outputTranscription: { text: 'Hoy vamos a hablar' },
        },
      },
      3000
    );

    expect(first).toMatchObject({
      sessionId: 'demo-session',
      timestamp: 1000,
      original: 'Today we',
      translation: '',
      language: 'en',
      targetLanguage: 'es',
      final: false,
    });
    expect(second).toMatchObject({
      timestamp: 3000,
      original: 'Today we are going to talk',
      translation: 'Hoy vamos a hablar',
      final: false,
    });
  });

  it('marks a completed turn as final and starts a new segment afterwards', () => {
    const acc = accumulator();
    acc.accept({ serverContent: { inputTranscription: { text: 'Hello' } } }, 500);

    const final = acc.accept(
      { serverContent: { outputTranscription: { text: 'Hola' }, turnComplete: true } },
      900
    );
    const next = acc.accept({ serverContent: { inputTranscription: { text: 'Next' } } }, 1200);

    expect(final).toMatchObject({ original: 'Hello', translation: 'Hola', final: true });
    expect(next).toMatchObject({ original: 'Next', translation: '', final: false });
  });

  it('treats interim input transcription as part of the original text', () => {
    const acc = accumulator();

    const event = acc.accept(
      { serverContent: { interimInputTranscription: { text: 'partial words' } } },
      200
    );

    expect(event).toMatchObject({ original: 'partial words', final: false });
  });

  it('ignores messages without usable content', () => {
    const acc = accumulator();

    expect(acc.accept(undefined, 0)).toBeNull();
    expect(acc.accept({}, 0)).toBeNull();
    expect(acc.accept({ serverContent: null }, 0)).toBeNull();
    expect(acc.accept({ serverContent: { modelTurn: { parts: [] } } }, 0)).toBeNull();
    expect(acc.accept({ serverContent: { inputTranscription: { text: 42 } } }, 0)).toBeNull();
    expect(acc.accept({ serverContent: { turnComplete: true } }, 0)).toBeNull();
  });

  it('flushes buffered text when the stream ends without a completed turn', () => {
    const acc = accumulator();
    acc.accept({ serverContent: { inputTranscription: { text: 'trailing' } } }, 100);

    expect(acc.flush(2000)).toMatchObject({ original: 'trailing', final: true, timestamp: 2000 });
    expect(acc.flush(2000)).toBeNull();
  });
});
