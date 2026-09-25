'use client';

import React, { useEffect, useState } from 'react';
import { Session } from '@openstage/shared';

export default function AdminDashboardPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${serverUrl}/api/sessions`);
      const data = await res.json();
      setSessions(data);
    } catch (err) {
      console.error('Failed to fetch sessions', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch(`${serverUrl}/api/sessions/${id}/start`, { method: 'POST' });
      await fetchSessions();
    } catch (err) {
      console.error('Failed to start session', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch(`${serverUrl}/api/sessions/${id}/stop`, { method: 'POST' });
      await fetchSessions();
    } catch (err) {
      console.error('Failed to stop session', err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">OpenStage Control Room</h1>
        <p className="text-slate-400">Manage and monitor conference live caption streams.</p>
      </div>

      {loading ? (
        <div className="text-slate-400">Loading control dashboard...</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm px-2.5 py-1 bg-slate-800 text-sky-400 rounded">
                  {session.id}
                </span>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                    session.status === 'LIVE'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800 animate-pulse'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  ● {session.status}
                </span>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-white">{session.name}</h2>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  {session.sourceLanguage.toUpperCase()} &rarr; {session.targetLanguage.toUpperCase()}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 py-2 border-y border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 block">Audio Source</span>
                  <span className="text-slate-300 font-mono">{session.audioSource?.type || 'file'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">AI Provider</span>
                  <span className="text-slate-300 font-mono">MockProvider</span>
                </div>
              </div>

              <div className="flex space-x-3 pt-2">
                {session.status !== 'LIVE' ? (
                  <button
                    onClick={() => handleStart(session.id)}
                    disabled={actionLoading === session.id}
                    className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm rounded-lg transition-colors"
                  >
                    Start Session Stream
                  </button>
                ) : (
                  <button
                    onClick={() => handleStop(session.id)}
                    disabled={actionLoading === session.id}
                    className="flex-1 py-2 px-4 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-medium text-sm rounded-lg transition-colors"
                  >
                    Stop Session Stream
                  </button>
                )}
                <a
                  href={`/session/${session.id}`}
                  className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm rounded-lg transition-colors flex items-center justify-center"
                >
                  View Client
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
