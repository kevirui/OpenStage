const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  pt: 'Portuguese',
};

export function languageName(code: string): string {
  return LANGUAGE_NAMES[code.toLowerCase()] ?? code;
}

/**
 * System instruction for the Live session: the model acts as a simultaneous
 * interpreter, so its spoken output transcription is the translation while the
 * input transcription is the original speech.
 */
export function buildInterpreterInstruction(
  sourceLanguage: string,
  targetLanguage: string,
  glossary?: string[]
): string {
  const source = languageName(sourceLanguage);
  const target = languageName(targetLanguage);
  const glossaryLine =
    glossary && glossary.length > 0
      ? `\nKeep these terms unchanged: ${glossary.join(', ')}.`
      : '';

  return `You are a simultaneous interpreter for a technical conference talk.
Listen to the speaker in ${source} and immediately say the same content in ${target}.
Translate only: never answer, comment, greet or add information of your own.
If the speaker pauses, stay silent until they speak again.${glossaryLine}`;
}
