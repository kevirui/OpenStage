---
trigger: always_on
---

# Frontend Rules

The frontend is responsible for presentation and user interaction.

It must not contain:

* Gemini API calls
* provider-specific AI logic
* audio processing business logic
* server credentials

## Audience UI

Prioritize readability.

The audience should immediately understand:

* which session they are watching
* which language they are viewing
* what the latest caption is
* whether the connection is active

## Admin UI

Prioritize operational visibility.

Show:

* session
* status
* language
* connection state
* latency when available
* caption count when available

## Styling

Keep the visual system simple.

Do not spend significant development time on visual polish before the MVP pipeline works.

Accessibility and readability are more important than decorative UI.
