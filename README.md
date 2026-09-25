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

## Demo: Real Gemini Transcription (First Vertical Slice)

This initial vertical slice proves that OpenStage can accept a local audio file, process it via Google Gemini (`gemini-2.5-flash`), extract the verbatim original transcription, generate an English → Spanish translation, and emit a normalized `CaptionEvent` to stdout.

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

```json
=== OpenStage Vertical Slice Demo: Gemini Speech & Translation ===

🎙 Processing Audio File: /path/to/openstage/demo/audio/stage-a.mp3
🤖 Sending audio payload to Gemini API (gemini-2.5-flash)...

✨ [CaptionEvent Received]:
{
  "id": "cap_gemini_1732501234567",
  "sessionId": "demo-session-stage-a",
  "timestamp": 1732501234567,
  "original": "Today we are going to discuss building real-time AI architectures for technical conferences.",
  "translation": "Hoy vamos a discutir la construcción de arquitecturas de IA en tiempo real para conferencias técnicas.",
  "language": "en",
  "targetLanguage": "es",
  "final": true
}

✅ Demo vertical slice executed successfully!
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
- [x] Local audio → Gemini integration (`GeminiSpeechProvider` using official `@google/genai` SDK).
- [x] Original transcript extraction and English → Spanish translation.
- [x] `CaptionEvent` normalization & terminal runner (`npm run demo:transcribe`).
- [x] Deterministic unit testing for `GeminiSpeechProvider` parsing and error handling (`npm run test`).
- [x] Backend architecture boundaries (`sessions`, `audio`, `ai`, `captions`, `realtime`, `persistence`, `config`).
- [x] SessionManager & isolated SessionWorkers supporting concurrent session management (`stage-a` and `stage-b`).
- [x] Next.js 14 web client with routes for Session Selection (`/`), Audience Live Caption View (`/session/[id]`), and Admin Control Dashboard (`/admin`).
- [x] Docker Compose configuration & `.env.example`.
- [x] Open-source MIT License.

### Not Yet Implemented (Planned Next Steps)

- [ ] True streaming chunked audio processing.
- [ ] Incremental real-time captions.
- [ ] Live WebSocket delivery from Gemini audio stream to web clients.
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
