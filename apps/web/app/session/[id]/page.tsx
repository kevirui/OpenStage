'use client';

import React, { useEffect, useState } from 'react';
import { CaptionEvent, Session } from '@openstage/shared';
import { useParams } from 'next/navigation';

export default function SessionAudiencePage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [session, setSession] = useState<Session | null>(null);
  const [captions, setCaptions] = useState<CaptionEvent[]>([]);
  const [status, setStatus] = useState<string>('CONNECTING');

  useEffect(() => {
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';

    fetch(`${serverUrl}/api/sessions/${sessionId}`)
      .then((res) => res.json())
      .then((data) => setSession(data))
      .catch(() => {
        setSession({
          id: sessionId,
          name: `Session ${sessionId}`,
          sourceLanguage: 'en',
          targetLanguage: 'es',
          status: 'LIVE',
          createdAt: new Date().toISOString(),
        });
      });

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setStatus('CONNECTED');
      ws.send(
        JSON.stringify({
          type: 'subscribe',
          sessionId,
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'caption' && payload.event) {
          setCaptions((prev) => [payload.event, ...prev.slice(0, 49)]);
        }
      } catch (e) {
        // handle message parse error
      }
    };

    ws.onerror = () => {
      setStatus('ERROR');
    };

    ws.onclose = () => {
      setStatus('DISCONNECTED');
    };

    return () => {
      ws.close();
    };
  }, [sessionId]);

  const latestCaption = captions[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{session?.name || sessionId}</h1>
          <p className="text-sm text-slate-400 font-mono">Session ID: {sessionId}</p>
        </div>
        <div className="flex items-center space-x-3 text-xs">
          <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700 text-slate-300">
            WS: {status}
          </span>
        </div>
      </div>

      {/* Main Subtitle Display Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 flex flex-col min-h-[260px]">
          <div className="text-xs font-semibold tracking-wider text-slate-400 uppercase mb-4 flex items-center justify-between">
            <span>Original (English)</span>
            <span className="text-slate-600 font-mono">EN</span>
          </div>
          <div className="flex-1 flex items-center justify-center text-center p-4">
            <p className="text-xl md:text-2xl font-medium text-slate-200 leading-relaxed">
              {latestCaption ? latestCaption.original : 'Waiting for captions...'}
            </p>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-slate-900 border border-sky-900/50 bg-sky-950/10 flex flex-col min-h-[260px]">
          <div className="text-xs font-semibold tracking-wider text-sky-400 uppercase mb-4 flex items-center justify-between">
            <span>Translation (Español)</span>
            <span className="text-sky-600 font-mono">ES</span>
          </div>
          <div className="flex-1 flex items-center justify-center text-center p-4">
            <p className="text-xl md:text-2xl font-medium text-sky-300 leading-relaxed">
              {latestCaption ? latestCaption.translation : 'Esperando subtítulos...'}
            </p>
          </div>
        </div>
      </div>

      {/* Caption History Log */}
      <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Recent Caption History</h2>
        {captions.length === 0 ? (
          <p className="text-slate-500 text-sm italic">No captions received yet in this session.</p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
            {captions.map((cap, idx) => (
              <div key={cap.id || idx} className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-sm space-y-1">
                <div className="text-slate-300">{cap.original}</div>
                <div className="text-sky-400 font-medium">{cap.translation}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
