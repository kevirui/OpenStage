'use client';

import React, { useEffect, useState } from 'react';
import { Session } from '@openstage/shared';
import Link from 'next/link';

export default function HomePage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';
    let cancelled = false;

    const load = () =>
      fetch(`${serverUrl}/api/sessions`)
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          setSessions(data);
          setLoading(false);
        });

    // Polled so concurrently running sessions show their live status side by side.
    const interval = setInterval(() => {
      load().catch(() => undefined);
    }, 3000);

    load().catch(() => {
      // Fallback default demo sessions if backend isn't reachble yet
      setSessions([
        {
          id: 'stage-a',
          name: 'Stage A: Keynote & Core Track',
          sourceLanguage: 'en',
          targetLanguage: 'es',
          status: 'CREATED',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'stage-b',
          name: 'Stage B: Architecture & AI Track',
          sourceLanguage: 'en',
          targetLanguage: 'es',
          status: 'CREATED',
          createdAt: new Date().toISOString(),
        },
      ]);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Available Sessions</h1>
        <p className="text-slate-400">Select a session to view real-time captions and translations.</p>
      </div>

      {loading ? (
        <div className="text-slate-400">Loading sessions...</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {sessions.map((session) => (
            <Link
              key={session.id}
              href={`/session/${session.id}`}
              className="block group p-6 rounded-xl bg-slate-900 border border-slate-800 hover:border-sky-500 transition-all shadow-lg"
            >
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-mono px-2 py-1 bg-slate-800 text-sky-400 rounded">
                  {session.id}
                </span>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                    session.status === 'LIVE'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {session.status}
                </span>
              </div>
              <h2 className="text-xl font-semibold group-hover:text-sky-400 transition-colors mb-2">
                {session.name}
              </h2>
              <p className="text-sm text-slate-400">
                Language: <span className="text-slate-200 uppercase font-mono">{session.sourceLanguage}</span> &rarr;{' '}
                <span className="text-slate-200 uppercase font-mono">{session.targetLanguage}</span>
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
