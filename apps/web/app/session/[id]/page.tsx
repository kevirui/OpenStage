'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CaptionEvent, ServerMessage, Session, SessionStatus } from '@openstage/shared';
import { useParams } from 'next/navigation';

type ConnectionState = 'CONNECTING' | 'LIVE' | 'DISCONNECTED' | 'ERROR';

const connectionLabels: Record<ConnectionState, string> = {
  CONNECTING: 'Connecting',
  LIVE: 'Live',
  DISCONNECTED: 'Disconnected',
  ERROR: 'Connection failed',
};

const connectionColors: Record<ConnectionState, string> = {
  CONNECTING: 'text-amber-400',
  LIVE: 'text-emerald-400',
  DISCONNECTED: 'text-slate-400',
  ERROR: 'text-red-400',
};

export default function SessionAudiencePage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [session, setSession] = useState<Session | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [finalized, setFinalized] = useState<CaptionEvent[]>([]);
  const [interim, setInterim] = useState<CaptionEvent | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('CONNECTING');
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';

    fetch(`${serverUrl}/api/sessions/${sessionId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Session | null) => {
        if (data) {
          setSession(data);
          setSessionStatus(data.status);
        }
      })
      .catch(() => undefined);

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnection('LIVE');
      ws.send(JSON.stringify({ type: 'subscribe', sessionId }));
    };

    ws.onmessage = (event) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }

      if (message.type === 'subscribed' && message.status) {
        setSessionStatus(message.status);
        return;
      }

      if (message.type === 'session') {
        setSessionStatus(message.status);
        return;
      }

      if (message.type === 'caption') {
        // Interim captions replace each other; only final ones become history.
        if (message.event.final) {
          setInterim(null);
          setFinalized((prev) => [...prev.slice(-49), message.event]);
        } else {
          setInterim(message.event);
        }
      }
    };

    ws.onerror = () => {
      setConnection('ERROR');
    };

    ws.onclose = () => {
      setConnection((prev) => (prev === 'ERROR' ? prev : 'DISCONNECTED'));
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'unsubscribe', sessionId }));
      }
      ws.close();
    };
  }, [sessionId]);

  const current = useMemo(() => interim ?? finalized[finalized.length - 1] ?? null, [interim, finalized]);
  const history = useMemo(
    () => (interim ? finalized : finalized.slice(0, -1)),
    [interim, finalized]
  );

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [current]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{session?.name || sessionId}</h1>
          <p className="text-sm text-slate-400 font-mono">Session ID: {sessionId}</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={`flex items-center gap-1.5 ${connectionColors[connection]}`}>
            <span aria-hidden>●</span>
            {connectionLabels[connection]}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700 text-slate-300 font-mono">
            {sessionStatus || 'UNKNOWN'}
          </span>
        </div>
      </div>

      {connection === 'ERROR' && (
        <p className="rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          Could not reach the caption server. Start the backend with <code>npm run dev:server</code> and reload.
        </p>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 flex flex-col min-h-[260px]">
          <div className="text-xs font-semibold tracking-wider text-slate-400 uppercase mb-4 flex items-center justify-between">
            <span>Original</span>
            <span className="text-slate-600 font-mono">{(session?.sourceLanguage || 'en').toUpperCase()}</span>
          </div>
          <div className="flex-1 flex items-center justify-center text-center p-4">
            <p className="text-xl md:text-2xl font-medium text-slate-200 leading-relaxed">
              {current ? current.original : 'Waiting for captions...'}
            </p>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-slate-900 border border-sky-900/50 bg-sky-950/10 flex flex-col min-h-[260px]">
          <div className="text-xs font-semibold tracking-wider text-sky-400 uppercase mb-4 flex items-center justify-between">
            <span>Español</span>
            <span className="text-sky-600 font-mono">{(session?.targetLanguage || 'es').toUpperCase()}</span>
          </div>
          <div className="flex-1 flex items-center justify-center text-center p-4">
            <p className="text-xl md:text-2xl font-medium text-sky-300 leading-relaxed">
              {current ? current.translation : 'Esperando subtítulos...'}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Transcript</h2>
        {history.length === 0 ? (
          <p className="text-slate-500 text-sm italic">
            Earlier finalized captions will appear here once the session moves past its first segment.
          </p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
            {history.map((caption, idx) => (
              <div
                key={caption.id || `${caption.timestamp}-${idx}`}
                className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-sm space-y-1"
              >
                <div className="text-slate-300">{caption.original}</div>
                <div className="text-sky-400 font-medium">{caption.translation}</div>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
