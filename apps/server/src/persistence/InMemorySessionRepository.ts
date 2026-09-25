import { Session, SessionStatus } from '@openstage/shared';

export class InMemorySessionRepository {
  private sessions: Map<string, Session> = new Map();

  async create(session: Session): Promise<Session> {
    this.sessions.set(session.id, { ...session });
    return session;
  }

  async findById(id: string): Promise<Session | null> {
    const session = this.sessions.get(id);
    return session ? { ...session } : null;
  }

  /** Synchronous read for callers that cannot await, such as WebSocket handlers. */
  peekStatus(id: string): SessionStatus | undefined {
    return this.sessions.get(id)?.status;
  }

  async findAll(): Promise<Session[]> {
    return Array.from(this.sessions.values()).map((s) => ({ ...s }));
  }

  async updateStatus(id: string, status: SessionStatus): Promise<Session | null> {
    const session = this.sessions.get(id);
    if (!session) return null;

    session.status = status;
    if (status === 'LIVE' && !session.startedAt) {
      session.startedAt = new Date().toISOString();
    }
    if (status === 'COMPLETED' || status === 'ERROR') {
      session.endedAt = new Date().toISOString();
    }

    this.sessions.set(id, session);
    return { ...session };
  }
}
