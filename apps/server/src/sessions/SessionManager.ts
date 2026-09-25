import { AudioChunkSource, Session, SpeechProvider } from '@openstage/shared';
import { InMemorySessionRepository } from '../persistence/InMemorySessionRepository.js';
import { SessionWorker } from './SessionWorker.js';
import { CaptionNormalizer } from '../captions/CaptionNormalizer.js';
import { RealtimeServer } from '../realtime/RealtimeServer.js';

/** One provider per session keeps the `1 session = 1 pipeline` boundary. */
export type SpeechProviderFactory = (session: Session) => SpeechProvider;
export type AudioChunkSourceFactory = (session: Session) => AudioChunkSource | undefined;

export class SessionManager {
  private repository: InMemorySessionRepository;
  private workers: Map<string, SessionWorker> = new Map();
  private createSpeechProvider: SpeechProviderFactory;
  private createAudioChunkSource: AudioChunkSourceFactory;
  private captionNormalizer: CaptionNormalizer;
  private realtimeServer: RealtimeServer;

  constructor(
    repository: InMemorySessionRepository,
    createSpeechProvider: SpeechProviderFactory,
    captionNormalizer: CaptionNormalizer,
    realtimeServer: RealtimeServer,
    createAudioChunkSource: AudioChunkSourceFactory = () => undefined
  ) {
    this.repository = repository;
    this.createSpeechProvider = createSpeechProvider;
    this.captionNormalizer = captionNormalizer;
    this.realtimeServer = realtimeServer;
    this.createAudioChunkSource = createAudioChunkSource;
  }

  async createSession(data: Omit<Session, 'id' | 'status' | 'createdAt'> & { id?: string }): Promise<Session> {
    const id = data.id || `session-${Date.now()}`;
    const session: Session = {
      ...data,
      id,
      status: 'CREATED',
      createdAt: new Date().toISOString(),
    };

    const saved = await this.repository.create(session);
    return saved;
  }

  async getSession(id: string): Promise<Session | null> {
    return this.repository.findById(id);
  }

  async listSessions(): Promise<Session[]> {
    return this.repository.findAll();
  }

  async startSession(id: string): Promise<Session | null> {
    const session = await this.repository.findById(id);
    if (!session) return null;

    if (session.status === 'LIVE' || session.status === 'STARTING') {
      return session;
    }

    await this.updateStatus(id, 'STARTING');

    try {
      const worker = new SessionWorker(
        session,
        this.createSpeechProvider(session),
        this.captionNormalizer,
        this.realtimeServer,
        this.createAudioChunkSource(session)
      );

      this.workers.set(id, worker);
      await worker.start();

      const updated = await this.updateStatus(id, 'LIVE');
      void this.completeWhenAudioEnds(id, worker);
      return updated;
    } catch (err) {
      this.workers.delete(id);
      await this.updateStatus(id, 'ERROR', err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  async stopSession(id: string): Promise<Session | null> {
    const worker = this.workers.get(id);
    if (worker) {
      this.workers.delete(id);
      await this.updateStatus(id, 'STOPPING');
      await worker.stop();
    }

    return this.updateStatus(id, 'COMPLETED');
  }

  getMetrics(id: string) {
    const worker = this.workers.get(id);
    return worker ? worker.getMetrics() : null;
  }

  /** A file-backed session ends on its own once the recording has been streamed. */
  private async completeWhenAudioEnds(id: string, worker: SessionWorker): Promise<void> {
    try {
      await worker.waitForAudioEnd();
    } catch (err) {
      if (this.workers.get(id) === worker) {
        this.workers.delete(id);
        await worker.stop().catch(() => undefined);
        await this.updateStatus(id, 'ERROR', err instanceof Error ? err.message : String(err));
      }
      return;
    }

    if (this.workers.get(id) !== worker) {
      return;
    }

    await this.stopSession(id).catch(() => undefined);
  }

  private async updateStatus(id: string, status: Session['status'], error?: string) {
    const updated = await this.repository.updateStatus(id, status);
    if (updated) {
      this.realtimeServer.broadcastSessionStatus(id, status, error);
    }
    return updated;
  }
}
