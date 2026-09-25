---
trigger: always_on
---

# Documentation Rules

Documentation is part of the product.

README.md must remain synchronized with the implementation.

Never claim a feature is implemented if it is not working.

Use explicit sections:

```text
Implemented
Planned
Optional
```

The README should explain:

* what OpenStage is
* why it exists
* architecture
* setup
* environment variables
* local development
* demo
* multi-session architecture
* scaling approach
* limitations

Prefer diagrams and examples when they make the architecture easier to understand.

When changing architecture, update the relevant documentation.
