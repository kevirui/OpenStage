---
trigger: always_on
---

# Backend Rules

The backend is the central orchestrator.

It is responsible for:

* session lifecycle
* audio processing
* AI provider communication
* caption normalization
* realtime broadcasting
* persistence

## API design

Use explicit APIs.

Do not expose provider-specific AI responses.

The frontend consumes OpenStage domain objects/events.

## Session lifecycle

Sessions should support states such as:

```text
CREATED
STARTING
LIVE
STOPPING
COMPLETED
ERROR
```

Do not create unnecessary state transitions.

## Realtime

Prefer WebSocket for live caption delivery.

Caption events should be normalized before broadcasting.

## Errors

Errors should be:

* explicit
* observable
* associated with the relevant session when possible

One failed session should not crash the entire backend.

## Configuration

Secrets must come from environment variables.

Never hardcode API keys or credentials.

Never commit `.env` files containing secrets.
