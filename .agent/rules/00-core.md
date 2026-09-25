---
trigger: always_on
---

# Core Agent Rules

## Project priority

The primary goal is to build a functional hackathon MVP.

Always prioritize:

1. MVP requirements
2. Reliability
3. Simplicity
4. Demoability
5. Documentation
6. Optional features

Do not sacrifice the MVP to implement optional functionality.

## Before coding

Always:

1. Inspect the existing implementation.
2. Understand the relevant architecture.
3. Check existing types/interfaces.
4. Reuse existing abstractions when appropriate.
5. Make the smallest reasonable change.

## Avoid overengineering

Do not introduce:

* unnecessary frameworks
* unnecessary dependencies
* microservices
* Kubernetes
* Redis
* complex dependency injection
* event buses
* CQRS
* elaborate design patterns

unless there is a concrete requirement that justifies them.

## Source of truth

`PROJECT_CONTEXT.md` defines the intended product and architecture.

If implementation details conflict with the project context, preserve the core product requirements and explain the conflict before making major architectural changes.

## Change discipline

Do not rewrite unrelated code.

Do not modify files unrelated to the current task unless necessary.

After implementation:

* run type checking
* run linting
* run tests if available

Report errors instead of hiding them.
