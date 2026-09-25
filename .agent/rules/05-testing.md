---
trigger: always_on
---

# Testing Rules

The MVP must prioritize tests around the core domain.

At minimum, test:

* session creation
* session lifecycle
* caption event normalization
* session isolation
* basic provider error handling

Provider integration tests may use mocks.

Do not require real Gemini API calls for the normal test suite.

## Demo testing

The project must eventually support two demo audio sources:

```text
stage-a
stage-b
```

Both should be capable of running simultaneously.

The demo should be reproducible without specialized hardware.
