---
trigger: always_on
---

# Architecture Rules

OpenStage is organized around independent conference sessions.

The fundamental abstraction is:

```text
Session
```

Each session represents an independent audio → AI → captions pipeline.

## Boundaries

Maintain clear boundaries between:

```text
Audio
AI Provider
Caption Processing
Session Management
Realtime Transport
Persistence
Frontend
```

## AI provider isolation

Do not allow Gemini-specific structures to leak into the frontend or domain layer.

Prefer:

```text
SpeechProvider
    ↓
GeminiProvider
```

Provider-specific responses must be normalized into OpenStage domain events.

## Shared contracts

Shared types used by frontend and backend should live in:

```text
packages/shared
```

Do not duplicate important domain types between applications.

## Session isolation

A failure in one session must not terminate unrelated sessions.

Session-specific state should remain associated with the session.

## Simplicity

Prefer a modular monolith for the MVP.

Do not split the system into microservices unless required.
