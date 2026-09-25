# OpenStage

## 1. Project Overview

OpenStage is an open-source real-time multilingual captioning platform designed for conferences such as Nerdearla.

The problem:

Large conferences may have many sessions happening simultaneously, including sessions in English that need to be accessible to Spanish-speaking audiences.

Existing solutions can be expensive, require manual operation, and do not scale easily across many simultaneous stages.

OpenStage aims to provide an open-source infrastructure that allows a conference to:

1. Receive live audio from multiple sessions.
2. Transcribe the original speech in real time.
3. Translate English speech into Spanish in real time.
4. Broadcast caption events to web clients.
5. Allow multiple sessions to run simultaneously.
6. Store the generated captions.
7. Export the final transcript as SRT, VTT, or TXT.
8. Provide a simple production/monitoring dashboard.
9. Be deployable using Docker.
10. Be understandable and reproducible by another open-source conference.

The project is being developed as a hackathon MVP.

The priority is a functional, understandable and demonstrable system rather than a production-scale enterprise platform.

---

# 2. Core Concept

The main abstraction is a `Session`.

A conference can have many sessions:

```text
Conference
│
├── Session A
│   ├── Audio
│   ├── Transcription
│   └── Translation
│
├── Session B
│   ├── Audio
│   ├── Transcription
│   └── Translation
│
└── Session C
    ├── Audio
    ├── Transcription
    └── Translation
```

Each session must be isolated from other sessions.

The system should be designed so that:

```text
1 session = 1 independent processing pipeline
```

Therefore:

```text
N sessions
    ↓
N independent session workers/pipelines
    ↓
N AI/audio connections
```

The initial MVP must demonstrate at least two simultaneous sessions.

---

# 3. High-Level Architecture

The intended architecture is:

```text
                         ┌─────────────────────┐
                         │      Audio Input    │
                         │                     │
                         │ Mic / File / Stream │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │    Audio Worker     │
                         │                     │
                         │ FFmpeg / processing │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │    AI Provider      │
                         │                     │
                         │ Gemini Audio / Live │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   Caption Engine    │
                         │                     │
                         │ original transcript │
                         │ translation         │
                         │ timestamps          │
                         └──────────┬──────────┘
                                    │
                              WebSocket
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
           Audience Web                       Admin Dashboard
```

The system should be designed around events rather than tightly coupled request/response flows.

---

# 4. Main Components

## Frontend

Technology:

* React
* TypeScript
* Next.js
* Tailwind CSS

Responsibilities:

* Display available sessions.
* Allow users to select a session.
* Display original captions.
* Display translated captions.
* Display session status.
* Provide a production/admin dashboard.
* Connect to the backend through WebSocket or SSE.

The frontend must NOT contain AI logic.

The frontend should consume normalized caption events from the backend.

---

# 5. Backend

Preferred technology:

* Node.js
* TypeScript

Responsibilities:

* Manage sessions.
* Create and stop session workers.
* Manage audio sources.
* Communicate with Gemini.
* Normalize AI responses.
* Broadcast caption events.
* Track session status.
* Persist captions.
* Provide APIs required by the frontend.

The backend should be the central orchestrator.

---

# 6. AI Layer

The initial AI provider should be Gemini because the hackathon specifically recommends Gemini audio capabilities.

However, the code should avoid coupling the entire application directly to Gemini.

Create an abstraction such as:

```text
TranscriptionProvider
```

or:

```text
SpeechProvider
```

The first implementation can be:

```text
GeminiProvider
```

Future providers could theoretically include:

```text
WhisperProvider
LocalGemmaProvider
OtherProvider
```

Do NOT implement those alternatives yet.

The goal is to keep the architecture replaceable without creating unnecessary abstraction.

---

# 7. Caption Event

The central data structure of OpenStage is the caption event.

A conceptual event:

```json
{
  "type": "caption",
  "sessionId": "session-a",
  "timestamp": 17321,
  "original": "Today we're going to talk about AI agents.",
  "translation": "Hoy vamos a hablar sobre agentes de IA.",
  "language": "en",
  "targetLanguage": "es",
  "final": true
}
```

The exact schema may evolve during implementation.

Important properties:

* sessionId
* timestamp
* original text
* translated text
* source language
* target language
* whether the segment is final

The frontend should rely on this normalized representation rather than raw Gemini responses.

---

# 8. Session Lifecycle

A session should conceptually move through states:

```text
CREATED
   ↓
STARTING
   ↓
LIVE
   ↓
STOPPING
   ↓
COMPLETED
```

Error state:

```text
ERROR
```

Example:

```text
Session A
    CREATED
       ↓
    STARTING
       ↓
      LIVE
       ↓
   COMPLETED
```

The system should expose enough status information for the admin dashboard.

---

# 9. Audio Sources

The MVP must support at least one simple audio source.

Preferred initial source:

```text
Local audio file
```

For example:

```text
/demo/audio/stage-a.mp3
/demo/audio/stage-b.mp3
```

This makes the project reproducible.

The architecture should leave room for:

```text
Microphone
RTMP stream
HLS stream
Other streaming source
```

but these should NOT be implemented before the MVP works.

---

# 10. Multi-session Architecture

The MVP must demonstrate at least two simultaneous sessions.

Example:

```text
Stage A
audio-a.mp3
    ↓
Session Worker A
    ↓
Gemini
    ↓
Captions A


Stage B
audio-b.mp3
    ↓
Session Worker B
    ↓
Gemini
    ↓
Captions B
```

The sessions must remain logically isolated.

A failure in one session should not crash the entire backend.

---

# 11. WebSocket Communication

The backend should expose a real-time communication mechanism.

Preferred:

```text
WebSocket
```

Conceptually:

```text
Browser
   │
   │ subscribe(sessionId)
   ▼
Backend
   │
   │ caption events
   ▼
Browser
```

Example:

```text
/ws/sessions/session-a
```

or another clean routing mechanism.

The exact implementation can be chosen during development.

---

# 12. Storage

The MVP can initially use:

```text
SQLite
```

or:

```text
PostgreSQL
```

Do not overengineer persistence.

Potential entities:

```text
Session
Caption
```

A session should contain information such as:

```text
id
name
sourceLanguage
targetLanguage
status
createdAt
startedAt
endedAt
```

A caption should contain:

```text
id
sessionId
timestamp
original
translation
final
```

---

# 13. Export

After a session finishes, the system should be able to export:

```text
SRT
VTT
TXT
```

This is an optional feature but desirable because it demonstrates that the generated captions are useful beyond the live experience.

---

# 14. Glossary

A future/optional feature is a technical glossary.

Example:

```text
React
Kubernetes
TypeScript
PostgreSQL
WebAssembly
Nerdearla
Vibeathon
```

The glossary can be provided as contextual information to the AI provider.

The goal is to improve recognition and translation of:

* technical terms
* product names
* project names
* proper nouns
* conference-specific vocabulary

Do not implement a complex glossary management system initially.

A simple JSON configuration is enough for the MVP.

Example:

```json
{
  "terms": [
    "React",
    "Kubernetes",
    "TypeScript",
    "PostgreSQL"
  ]
}
```

---

# 15. Admin Dashboard

The admin dashboard should provide a simple production-oriented view.

Example:

```text
OPENSTAGE CONTROL ROOM

Stage A
🟢 LIVE
EN → ES
Latency: 1.2s
Captions: 1482

Stage B
🟢 LIVE
EN → ES
Latency: 1.4s
Captions: 1291

Stage C
🔴 ERROR
Audio disconnected
```

The dashboard should prioritize operational visibility.

It does not need advanced analytics.

---

# 16. Audience Interface

The audience interface should be extremely simple.

Example:

```text
OPENSTAGE

Choose a session:

[ AI Agents in Production ]
[ React at Scale ]
[ Open Source Communities ]

Language:

🇬🇧 Original
🇪🇸 Español
```

After selecting a session:

```text
AI Agents in Production

ORIGINAL

Today we're going to discuss...

ESPAÑOL

Hoy vamos a hablar sobre...
```

The audience should not need to understand the technical infrastructure.

---

# 17. Deployment

The project should be Docker-friendly.

Expected initial deployment:

```text
Docker Compose
```

Possible architecture:

```text
docker compose up
```

Starting:

```text
web
server
database
```

Do not introduce Kubernetes during the MVP.

The project may later be deployed to AWS EC2.

---

# 18. Repository Structure

Preferred starting structure:

```text
openstage/
│
├── apps/
│   ├── web/
│   └── server/
│
├── packages/
│   └── shared/
│
├── demo/
│   ├── audio/
│   │   ├── stage-a.mp3
│   │   └── stage-b.mp3
│   │
│   └── glossary.json
│
├── docs/
│
├── .agent/
│   └── rules/
│
├── docker-compose.yml
├── LICENSE
├── README.md
├── PROJECT_CONTEXT.md
└── package.json
```

This structure may be adapted if the chosen framework requires it.

---

# 19. Open Source

The project must be released under an OSI-approved license.

Preferred:

```text
MIT
```

The repository must include:

```text
LICENSE
```

and the README must clearly explain:

* what the project does
* requirements
* environment variables
* Gemini credentials
* how to run locally
* how to run demo sessions
* how to run two sessions simultaneously
* how to scale sessions
* architecture
* limitations

---

# 20. Hackathon Constraints

The project is being created specifically for a hackathon.

The solution itself must be developed during the hackathon period.

Existing libraries and models may be used.

The following are acceptable:

* Gemini
* Whisper
* FFmpeg
* React
* Next.js
* Node.js
* Docker
* PostgreSQL
* other open-source libraries

The custom value is in the OpenStage orchestration, architecture, UX and conference workflow.

---

# 21. MVP Requirements

Before adding optional features, the following must work:

### Requirement 1

Receive audio from at least one source.

### Requirement 2

Generate real-time transcription.

### Requirement 3

Generate English → Spanish translation.

### Requirement 4

Display subtitles.

### Requirement 5

Run at least two sessions simultaneously.

### Requirement 6

Explain how more sessions can be added.

### Requirement 7

Provide an open-source license.

### Requirement 8

Provide reproducible documentation.

These requirements have absolute priority.

---

# 22. Optional Features

Only after the MVP works:

1. OBS integration.
2. vMix integration.
3. More languages.
4. Technical glossary.
5. SRT/VTT/TXT export.
6. Production monitoring.
7. Better latency metrics.
8. Speaker identification.
9. RTMP/HLS inputs.

Optional features must never compromise the MVP.

---

# 23. Product Positioning

Do not position OpenStage as:

> "An AI translator."

Position it as:

> "Open-source infrastructure for real-time multilingual captions at conferences."

The key idea is:

```text
ONE SESSION
       ↓
ONE PIPELINE

MANY SESSIONS
       ↓
MANY INDEPENDENT PIPELINES
```

This directly addresses conference-scale operation.

---

# 24. Demo Scenario

The demo should simulate two conference stages.

Stage A:

```text
stage-a.mp3
English
English transcription
Spanish translation
```

Stage B:

```text
stage-b.mp3
English
English transcription
Spanish translation
```

The dashboard should show:

```text
2 SESSIONS ACTIVE

🟢 Stage A
🟢 Stage B
```

A browser can connect to each session and see captions updating in real time.

---

# 25. Development Philosophy

Priorities:

1. Functional MVP.
2. Simple architecture.
3. Clear boundaries.
4. Reproducibility.
5. Good demo.
6. Documentation.
7. Optional features.

Avoid premature optimization.

Avoid unnecessary abstraction.

Avoid unnecessary dependencies.

Avoid microservices unless a real requirement appears.

Avoid implementing future functionality before the core pipeline works.

The guiding question should always be:

> "Does this help us demonstrate reliable real-time multilingual captions across multiple conference sessions?"

If not, postpone it.
