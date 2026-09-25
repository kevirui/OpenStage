import './globals.css';
import React from 'react';

export const metadata = {
  title: 'OpenStage - Realtime Multilingual Captions',
  description: 'Open-source infrastructure for live conference captioning and translation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen flex flex-col">
        <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center space-x-2">
            <span className="font-extrabold text-xl tracking-wider text-sky-400">OPENSTAGE</span>
            <span className="text-xs px-2 py-0.5 rounded bg-sky-950 text-sky-300 font-mono border border-sky-800">MVP</span>
          </a>
          <nav className="flex space-x-6 text-sm font-medium">
            <a href="/" className="hover:text-sky-400 transition-colors">Sessions</a>
            <a href="/admin" className="hover:text-sky-400 transition-colors">Admin Dashboard</a>
          </nav>
        </header>
        <main className="flex-1 max-w-6xl w-full mx-auto p-6">
          {children}
        </main>
        <footer className="border-t border-slate-800 p-4 text-center text-xs text-slate-500">
          OpenStage Multilingual Live Subtitle Infrastructure
        </footer>
      </body>
    </html>
  );
}
