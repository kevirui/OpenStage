import { Session, SessionStatus } from '@openstage/shared';
import { InMemorySessionRepository } from '../persistence/InMemorySessionRepository.js';
import { SessionWorker } from './SessionWorker.js';
import { SpeechProvider } from '@openstage/shared';
import { CaptionNormalizer } from '../captions/CaptionNormalizer.js';
import { RealtimeServer } from '../realtime/RealtimeServer.js';

export class SessionManager {
  private repository: InMemorySessionRepository;
  private workers: Map<string, SessionWorker> = new Map();
  private speechProvider: SpeechProvider;
  private captionNormalizer: CaptionNormalizer;
  private realtimeServer: RealtimeServer;

  constructor(
    repository: InMemorySessionRepository,
    speechProvider: SpeechProvider,
    captionNormalizer: CaptionNormalizer,
    realtimeServer: RealtimeServer
  ) {
    this.repository = repository;
    this.speechProvider = speechProvider;
    this.captionNormalizer = captionNormalizer;
    this.realtimeServer = realtimeServer;
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

    if (session.status === 'LIVE') {
      return session;
    }

    await this.repository.updateStatus(id, 'STARTING');
    
    try {
      const worker = new SessionWorker(
        session,
        this.speechProvider,
        this.captionNormalizer,
        this.realtimeServer
      );
      
      this.workers.set(id, worker);
      await worker.start();

      const updated = await this.repository.updateStatus(id, 'LIVE');
      return updated;
    } catch (err) {
      await this.repository.updateStatus(id, 'ERROR');
      throw err;
    }
  }

  async stopSession(id: string): Promise<Session | null> {
    const worker = this.workers.get(id);
    if (worker) {
      await worker.stop();
      this.workers.delete(id);
    }

    const updated = await this.repository.updateStatus(id, 'COMPLETED');
    return updated;
  }

  getMetrics(id: string) {
    const worker = this.workers.get(id);
    return worker ? worker.getMetrics() : null;
  }
}
