import { Session, CaptionEvent, SpeechProvider } from '@openstage/shared';
import { CaptionNormalizer } from '../captions/CaptionNormalizer.js';
import { RealtimeServer } from '../realtime/RealtimeServer.js';

export class SessionWorker {
  public readonly session: Session;
  private provider: SpeechProvider;
  private normalizer: CaptionNormalizer;
  private realtimeServer: RealtimeServer;
  private captionCount = 0;

  constructor(
    session: Session,
    provider: SpeechProvider,
    normalizer: CaptionNormalizer,
    realtimeServer: RealtimeServer
  ) {
    this.session = session;
    this.provider = provider;
    this.normalizer = normalizer;
    this.realtimeServer = realtimeServer;

    this.provider.onCaption((rawEvent) => {
      if (rawEvent.sessionId === this.session.id) {
        const normalized = this.normalizer.normalize(rawEvent);
        this.captionCount++;
        this.realtimeServer.broadcastCaption(normalized);
      }
    });
  }

  async start(): Promise<void> {
    await this.provider.startStream({
      sessionId: this.session.id,
      sourceLanguage: this.session.sourceLanguage,
      targetLanguage: this.session.targetLanguage,
    });
  }

  async stop(): Promise<void> {
    await this.provider.stopStream(this.session.id);
  }

  getMetrics() {
    return {
      sessionId: this.session.id,
      status: this.session.status,
      captionCount: this.captionCount,
    };
  }
}
