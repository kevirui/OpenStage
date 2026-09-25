# OpenStage

Open-source infrastructure for real-time multilingual captions at conferences.

## The problem

A conference runs several stages at the same time. Talks are in English, part of the audience reads Spanish, and human captioning/interpretation for every stage is expensive and hard to schedule. Attendees end up with no captions at all, or with captions on the main stage only.

## The solution

OpenStage treats every stage as an independent session. Its audio is transcribed and translated while the talk happens, and the resulting captions are pushed to any browser watching that session:

```text
Audio
 ↓
Real-time speech processing (Gemini Live)
 ↓
English → Spanish translation
 ↓
CaptionEvent → WebSocket
 ↓
Live audience captions in the browser
```

## Features (implemented today)

- Incremental transcription: audio is streamed to Gemini Live in 200 ms PCM chunks, captions appear while the audio is still playing.
- English → Spanish translation delivered incrementally alongside the original.
- Live browser captions at `/session/<id>`, with original and translation side by side, connection state and session lifecycle.
- WebSocket delivery with per-session subscriptions — a client subscribed to `stage-a` never receives `stage-b` events.
- Two concurrent, fully isolated sessions (own worker, audio source, Gemini connection, lifecycle and caption stream).
- Per-session failure isolation: one session can fail without stopping the other.
- Terminal demo runners for a single session and for two concurrent sessions.
- Deterministic unit tests that never call the Gemini API.
- MIT licensed, no secrets in the repository.

Not implemented (and not claimed): microphone / live conference audio input, more than two concurrent sessions verified end to end, horizontal scaling across backend instances, persistent storage, authentication, SRT/VTT export, OBS/vMix or RTMP/HLS input, speaker identification, glossary injection.

## Architecture

```text
                 OpenStage
                     │
              SessionManager
                /          \
        Session A          Session B
            │                  │
        Audio A             Audio B      (FileAudioChunkSource + ffmpeg → 16 kHz PCM)
            │                  │
         Gemini A           Gemini B     (GeminiSpeechProvider, one Live connection each)
            │                  │
      CaptionEvents      CaptionEvents   (CaptionNormalizer)
            │                  │
       WebSocket A        WebSocket B    (RealtimeServer, subscriptions per sessionId)
            │                  │
        Browser A          Browser B
```

Domain boundaries: `packages/shared` holds framework-independent types (`Session`, `CaptionEvent`, `SpeechProvider`, `AudioChunk`, WebSocket messages). The server depends on those abstractions only — no Gemini type ever crosses into `shared` or reaches the browser, and the frontend receives normalized `CaptionEvent`s and never sees `GEMINI_API_KEY`.

## Running locally

### Prerequisites

- Node.js 20+ and npm 10+
- `ffmpeg` (`apt install ffmpeg` / `brew install ffmpeg`) — Gemini Live only accepts raw PCM, so it decodes the demo recordings. Override its location with `FFMPEG_PATH`.
- A Google AI Studio key with access to the Gemini Live API.

### Setup

```bash
npm install
cp .env.example .env     # then fill in GEMINI_API_KEY
```

Place two local recordings (English speech, any length; nothing is downloaded automatically, and the only audio committed to this repository is a talk included with its speaker's permission):

```bash
demo/audio/stage-a.mp3   # session `stage-a`
demo/audio/stage-b.mp3   # session `stage-b`
```

Two different recordings make the concurrency obvious, but the same file may be copied to both paths.

### Start

```bash
npm run dev              # backend on :4000 + web app on :3000
```

- Sessions: [http://localhost:3000](http://localhost:3000)
- Stage A captions: [http://localhost:3000/session/stage-a](http://localhost:3000/session/stage-a)
- Stage B captions: [http://localhost:3000/session/stage-b](http://localhost:3000/session/stage-b)
- Admin: [http://localhost:3000/admin](http://localhost:3000/admin)

`npm install` + `npm run dev` is the recommended path. Docker Compose is available as an alternative (`docker compose up --build`); it mounts `./demo` read-only so your local recordings are visible to the container and reads `GEMINI_API_KEY` from your environment or root `.env`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | yes (for real captions) | Gemini Live access. Without it the backend still starts and serves **mock** captions, and the admin page says so. |
| `GEMINI_LIVE_MODEL` | no | Live model override. Default `gemini-3.5-live-translate-preview`: its input transcription is the English original, its output transcription the Spanish translation. |
| `FFMPEG_PATH` | no | Path to the ffmpeg binary. |
| `PORT` | no | Backend port (default 4000). |
| `NEXT_PUBLIC_SERVER_URL` / `NEXT_PUBLIC_WS_URL` | no | Where the browser reaches the backend. |

See `.env.example`. `.env` is git-ignored; never commit a key.

## Demo

### Two concurrent sessions (main demo)

1. `npm run dev`
2. Open `/session/stage-a` and `/session/stage-b` in two browser tabs or windows.
3. In a third terminal:
   ```bash
   npm run demo:multi-session
   ```

The runner subscribes to both sessions over WebSocket, starts them without waiting for each other, and labels every caption, so interleaved output proves both pipelines are active:

```text
[STAGE-A] STARTING
[STAGE-B] STARTING
[STAGE-A] [00:03] EN: Welcome everyone to Open Stage.
[STAGE-A] [00:03] ES: Bienvenidos todos a Open Stage.
[STAGE-B] [00:03] EN: Today we are discussing agent architectures.
[STAGE-B] [00:03] ES: Hoy hablamos de arquitecturas de agentes.
[STAGE-A] [00:06] EN: Our goal is to make every talk accessible.
[STAGE-A] [00:06] ES: Nuestro objetivo es que cada charla sea accesible.
```

It exits non-zero if either session ends in `ERROR`. Run a different pair with `npm run demo:multi-session -- stage-a demo-session`.

### Single session

```bash
npm run demo:stream          # one seeded session to the browser (/session/demo-session)
npm run demo:transcribe      # one session straight to the terminal, no server needed
```

### WebSocket protocol

```jsonc
// client → server
{ "type": "subscribe",   "sessionId": "stage-a" }
{ "type": "unsubscribe", "sessionId": "stage-a" }

// server → client
{ "type": "subscribed", "sessionId": "stage-a", "status": "CREATED" }
{ "type": "session",    "sessionId": "stage-a", "status": "LIVE" }
{ "type": "caption",    "event": { "sessionId": "stage-a", "timestamp": 12345,
                                   "original": "...", "translation": "...",
                                   "language": "en", "targetLanguage": "es", "final": false } }
```

Interim captions carry `final: false` and are replaced in place; a finalized segment arrives with `final: true` and is appended to the transcript.

### Session isolation

`SessionManager.startSession(id)` builds a fresh `SessionWorker`, which owns its own `SpeechProvider` (one Gemini Live connection), its own `AudioChunkSource` and its own caption callback. Status is tracked per session id, captions are broadcast only to clients subscribed to that id, and a failing session transitions to `ERROR` on its own while the other keeps streaming. When a session ends, its worker closes the Gemini stream, abandons the audio pump and is removed from the active map.

## Scaling

**Current implementation:** sessions are concurrent async pipelines inside a single Node.js process, with in-memory session state.

```text
1 session  = 1 SessionWorker
2 sessions = 2 SessionWorkers
N sessions = N independent workers (one process, bounded by Gemini quota and CPU)
```

**Future scaling architecture (not implemented):** the same worker model can be distributed — several backend instances behind a load balancer, each running a subset of the workers, with shared coordination (which instance owns which session) and a shared message layer so any instance can serve the WebSocket clients of any session. OpenStage does not implement this today and does not support unlimited sessions.

## Demo Recording

A 60–120 second walkthrough:

- **0:00–0:10** — Home page. "OpenStage is open-source infrastructure for real-time multilingual conference captions."
- **0:10–0:25** — Open Session A, start the demo (`npm run demo:multi-session`), show English and Spanish captions appearing progressively.
- **0:25–0:40** — Switch to Session B, already running at the same time with its own content.
- **0:40–0:55** — Put both windows side by side: each session shows only its own captions.
- **0:55–1:15** — Show the pipeline diagram: audio → SessionWorker → Gemini → CaptionEvent → WebSocket → browser.
- **1:15–1:30** — Show the multi-session diagram (Session A → Worker A, Session B → Worker B) and note that the same worker model can be distributed across backend instances as sessions grow.

Keep source code on screen for a few seconds at most.

## Repository structure

```text
openstage/
├── apps/
│   ├── server/          # Express + WebSocket backend: sessions, audio, ai, captions, realtime
│   └── web/             # Next.js 14 app: / (sessions), /session/[id] (audience), /admin
├── packages/
│   └── shared/          # Framework-independent domain types and interfaces
├── demo/
│   ├── audio/           # Your local recordings (git-ignored): stage-a.mp3, stage-b.mp3
│   └── glossary.json    # Technical glossary (not yet injected into prompts)
├── .agent/rules/        # Project coding & architectural rules
├── docker-compose.yml
├── .env.example
├── PROJECT_CONTEXT.md
└── LICENSE
```

## Quality checks

```bash
npm run typecheck
npm test        # deterministic, no Gemini calls
npm run build
```

`npm run lint` is not usable today: ESLint was never configured for `apps/web` (`next lint` drops into its interactive setup wizard) and `packages/shared` has no `lint` script.

## Known limitations

- Demo audio files instead of a physical conference microphone.
- In-memory session state: restarting the backend resets everything.
- Single backend instance; horizontal scaling is described conceptually only.
- Two concurrent sessions verified end to end; more is untested.
- A session stays in `STOPPING` for up to ~40 s while Gemini flushes trailing captions.
- One language pair (English → Spanish).

## License

Released under the [MIT License](LICENSE).
