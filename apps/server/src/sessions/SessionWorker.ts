import { AudioChunkSource, CaptionSink, Session, SpeechProvider } from '@openstage/shared';
import { CaptionNormalizer } from '../captions/CaptionNormalizer.js';

export class SessionWorker {
  public readonly session: Session;
  private provider: SpeechProvider;
  private normalizer: CaptionNormalizer;
  private captionSink: CaptionSink;
  private audioChunkSource?: AudioChunkSource;
  private captionCount = 0;
  private stopping = false;
  private pump?: Promise<void>;

  constructor(
    session: Session,
    provider: SpeechProvider,
    normalizer: CaptionNormalizer,
    captionSink: CaptionSink,
    audioChunkSource?: AudioChunkSource
  ) {
    this.session = session;
    this.provider = provider;
    this.normalizer = normalizer;
    this.captionSink = captionSink;
    this.audioChunkSource = audioChunkSource;

    this.provider.onCaption((rawEvent) => {
      if (rawEvent.sessionId === this.session.id) {
        const normalized = this.normalizer.normalize(rawEvent);
        this.captionCount++;
        this.captionSink.publish(normalized);
      }
    });
  }

  async start(): Promise<void> {
    await this.provider.startStream({
      sessionId: this.session.id,
      sourceLanguage: this.session.sourceLanguage,
      targetLanguage: this.session.targetLanguage,
      audioSource: this.session.audioSource,
    });

    const source = this.audioChunkSource;
    if (source) {
      this.pump = this.pumpAudio(source);
    }
  }

  /** Resolves once the audio source has been fully streamed to the provider. */
  async waitForAudioEnd(): Promise<void> {
    await this.pump;
  }

  async stop(): Promise<void> {
    this.stopping = true;
    await this.pump?.catch(() => undefined);
    await this.provider.stopStream(this.session.id);
  }

  getMetrics() {
    return {
      sessionId: this.session.id,
      status: this.session.status,
      captionCount: this.captionCount,
    };
  }

  private async pumpAudio(source: AudioChunkSource): Promise<void> {
    for await (const chunk of source.chunks()) {
      if (this.stopping) {
        break;
      }
      await this.provider.sendAudioChunk(this.session.id, chunk);
    }
  }
}
