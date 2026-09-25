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
                           │   (Abstraction Layer) │
                           └───────────┬───────────┘
                                       │
                                       ▼
                           ┌───────────────────────┐
                           │ Caption Normalizer    │
                           └───────────┬───────────┘
                                       │
                                   WebSocket
                                       │
                   ┌───────────────────┴───────────────────┐
                   ▼                                       ▼
        Audience Web Client                       Admin Dashboard
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
- [x] Backend architecture boundaries (`sessions`, `audio`, `ai`, `captions`, `realtime`, `persistence`, `config`).
- [x] SessionManager & isolated SessionWorkers supporting concurrent session management (`stage-a` and `stage-b`).
- [x] `SpeechProvider` abstraction interface and `MockSpeechProvider` for foundation architecture testing without Gemini dependency.
- [x] WebSocket realtime server for broadcasting caption events to clients.
- [x] Next.js 14 web client with routes for Session Selection (`/`), Audience Live Caption View (`/session/[id]`), and Admin Control Dashboard (`/admin`).
- [x] Docker Compose configuration & `.env.example`.
- [x] Open-source MIT License.

### Planned (Next Steps)

- [ ] Gemini API Integration (`GeminiProvider` implementing `SpeechProvider`).
- [ ] Real-time audio streaming from local MP3 files & microphone input into `SessionWorker`.
- [ ] Glossary context injection into AI transcription prompts.
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
GEMINI_API_KEY=
DATABASE_URL=
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

2. Build all workspaces:
   ```bash
   npm run build
   ```

3. Start backend and web frontend concurrently in development mode:
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
