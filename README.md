# OpenStage

OpenStage is an open-source real-time multilingual captioning platform designed for multi-stage technical conferences (such as Nerdearla).

## Project Goal

Conferences often run multiple simultaneous stages with talks in English that need real-time transcription and translation into Spanish. OpenStage provides a scalable, modular architecture where each session operates as an independent pipeline (`1 Session = 1 Pipeline`), broadcasting synchronized live captions over WebSockets to web clients and control dashboards.

---

## Architecture Overview

```text
                           ┌───────────────────────┐
                           │      Audio Source     │
                           │ (File / Stream / Mic) │
                           └───────────┬───────────┘
                                       │
                                       ▼
                           ┌───────────────────────┐
                           │    Session Worker     │
                           └───────────┬───────────┘
                                       │
                                       ▼
                           ┌───────────────────────┐
                           │    SpeechProvider     │
                           │ (GeminiSpeechProvider)│
                           └───────────┬───────────┘
                                       │
                                       ▼
                           ┌───────────────────────┐
                           │ Caption Normalizer    │
                           └───────────┬───────────┘
                                       │
                                   WebSocket / CLI
                                       │
                   ┌───────────────────┴───────────────────┐
                   ▼                                       ▼
        Audience Web Client                       Terminal CLI / Admin
       (/session/[sessionId])                         (/admin)
```

### Session Isolation & Multi-Session Architecture

```text
SessionManager
     │
     ├── Session Worker A (Stage A) ──> SpeechProvider ──> WS Clients
     ├── Session Worker B (Stage B) ──> SpeechProvider ──> WS Clients
     └── Session Worker C (Stage C) ──> SpeechProvider ──> WS Clients
```

---

## Demo: Incremental Gemini Live Captions (Current Vertical Slice)

The demo streams a local audio file to the **Gemini Live API** (bidirectional WebSocket) in 200 ms PCM chunks, paced at the natural speed of the recording. Captions are emitted progressively while the audio is still playing:

```text
demo/audio/stage-a.mp3
        ↓  ffmpeg (decoder only) → 16 kHz mono PCM
FileAudioChunkSource → 200 ms AudioChunk
        ↓
SessionWorker → GeminiSpeechProvider (ai.live.connect)
        ↓  incremental input/output transcription
LiveCaptionAccumulator → CaptionNormalizer → CaptionEvent (final: false → true)
        ↓
Terminal
```

The default model is `gemini-3.5-live-translate-preview` (speech-to-speech translation): its **input transcription** is the English original and its **output transcription** is the Spanish translation, both delivered incrementally. Override it with `GEMINI_LIVE_MODEL`.

### Prerequisite: ffmpeg

Gemini Live only accepts raw PCM, so `ffmpeg` decodes the compressed demo recording. Install it (`apt install ffmpeg` / `brew install ffmpeg`) or point `FFMPEG_PATH` at the binary.

### 1. Configure GEMINI_API_KEY

Create a `.env` file in the root directory (or export in your terminal):

```bash
GEMINI_API_KEY=your_google_gemini_api_key
```

### 2. Place Demo Audio File

Place an MP3 audio file (e.g. `stage-a.mp3`) inside the `demo/audio/` directory:

```bash
demo/audio/stage-a.mp3
```

*(Note: If no audio file or API key is present, the demo runner exits cleanly with an informative error message).*

### 3. Run the Demo

Execute the demo runner command:

```bash
npm run demo:transcribe
```

Or pass a custom audio path (relative paths resolve from the repository root):

```bash
npm run demo:transcribe -- demo/audio/stage-b.mp3
```

### 4. Expected Terminal Output

The interim caption is rewritten in place as new text arrives, so the transcript grows while the audio plays:

```text
OpenStage
─────────
Session: demo-session
Source: demo/audio/stage-a.mp3
Language: EN → ES
Provider: GeminiSpeechProvider (Gemini Live streaming)

[00:03] EN: Welcome everyone to Open
         ES: Bienvenidos todos

[00:07] EN: Welcome everyone to Open Stage. Today we are going to talk about real-time
         ES: Bienvenidos todos a Open Stage. Hoy vamos a hablar de sistemas en tiempo real

[00:15] EN: Welcome everyone to Open Stage. ... Our goal is to make every talk accessible in any language.
         ES: Bienvenidos todos a Open Stage. ... Nuestro objetivo es hacer que cada charla sea accesible en cualquier idioma.

Session completed (28 caption events).
```

Each line corresponds to a `CaptionEvent` (`final: false` while the turn is open, `final: true` when Gemini closes the turn or the stream ends).

---

## Repository Structure

```text
openstage/
├── apps/
│   ├── web/                 # Next.js 14 audience & admin web application
│   └── server/              # Node.js + Express + WebSocket backend orchestrator
│
├── packages/
│   └── shared/              # Framework-independent TypeScript domain models & interfaces
│
├── demo/
│   ├── audio/               # Directory for stage demo audio files (stage-a.mp3, stage-b.mp3)
│   └── glossary.json        # Technical glossary configuration
│
├── docs/                    # Architectural and developer documentation
├── .agent/rules/            # Project coding & architectural rules
├── docker-compose.yml       # Docker Compose setup for local containerized deployment
├── .env.example             # Environment variable template
├── LICENSE                  # MIT License
├── PROJECT_CONTEXT.md       # Primary project specifications
└── package.json             # Root monorepo workspace configuration
```

---

## Current Implementation Status

### Implemented

- [x] Monorepo structure using npm workspaces (`@openstage/shared`, `@openstage/server`, `@openstage/web`).
- [x] Shared TypeScript domain entities (`Session`, `SessionStatus`, `CaptionEvent`, `AudioSource`, `SpeechProvider` interface).
- [x] Local audio source read progressively and chunked into 16 kHz PCM (`FileAudioChunkSource`, `PcmFramer`).
- [x] Gemini Live streaming integration (`GeminiSpeechProvider` using `ai.live.connect` from the official `@google/genai` SDK).
- [x] Incremental transcription and incremental English → Spanish translation.
- [x] Incremental `CaptionEvent` generation (interim vs final) and terminal runner (`npm run demo:transcribe`).
- [x] Deterministic unit tests for chunking, streaming event normalization and error handling (`npm run test`).
- [x] Backend architecture boundaries (`sessions`, `audio`, `ai`, `captions`, `realtime`, `persistence`, `config`).
- [x] SessionManager & isolated SessionWorkers supporting concurrent session management (`stage-a` and `stage-b`).
- [x] Next.js 14 web client with routes for Session Selection (`/`), Audience Live Caption View (`/session/[id]`), and Admin Control Dashboard (`/admin`).
- [x] Docker Compose configuration & `.env.example`.
- [x] Open-source MIT License.

### Not Yet Implemented (Planned Next Steps)

- [ ] WebSocket delivery of live Gemini captions to the audience web client (the web app still renders mock captions).
- [ ] Concurrent live sessions backed by Gemini (only the single-session demo is wired to the Live API).
- [ ] Microphone / live conference audio input.
- [ ] Production deployment.
- [ ] Technical glossary context injection into AI prompts.
- [ ] SRT / VTT subtitle file export after session completion.

### Optional

- [ ] OBS / vMix integration.
- [ ] RTMP / HLS live stream input processing.
- [ ] Advanced latency metrics & speaker identification.

---

## Environment Variables

Copy `.env.example` to `.env`:

```bash
PORT=4000
NODE_ENV=development
NEXT_PUBLIC_SERVER_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
GEMINI_API_KEY=your_gemini_api_key_here
DATABASE_URL=
```

Optional overrides for the streaming demo:

```bash
GEMINI_LIVE_MODEL=gemini-3.5-live-translate-preview  # any Live API model
FFMPEG_PATH=/usr/bin/ffmpeg                          # audio decoder location
```

---

## Development Setup

### Prerequisites

- Node.js 20+
- npm 10+

### Local Installation & Running

1. Install all monorepo dependencies:
   ```bash
   npm install
   ```

2. Run unit tests:
   ```bash
   npm run test
   ```

3. Build all workspaces:
   ```bash
   npm run build
   ```

4. Run the Gemini audio demo slice:
   ```bash
   npm run demo:transcribe
   ```

5. Start backend and web frontend concurrently in development mode:
   ```bash
   npm run dev
   ```

- Web Client: [http://localhost:3000](http://localhost:3000)
- Admin Dashboard: [http://localhost:3000/admin](http://localhost:3000/admin)
- Backend Server: [http://localhost:4000](http://localhost:4000)

### Docker Deployment

To run OpenStage using Docker Compose:

```bash
docker compose up --build
```

---

## License

Released under the [MIT License](LICENSE).
