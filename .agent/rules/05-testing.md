---
trigger: always_on
---

# Reglas de testing

El MVP debe priorizar los tests alrededor del dominio central.

Como mínimo, testear:

* la creación de sesiones
* el ciclo de vida de las sesiones
* la normalización de eventos de subtítulos
* el aislamiento entre sesiones
* el manejo básico de errores del proveedor

Los tests de integración con el proveedor pueden usar mocks.

La suite de tests habitual no debe requerir llamadas reales a la API de Gemini.

## Testing del demo

El proyecto debe poder usar dos fuentes de audio de demo:

```text
stage-a
stage-b
```

Ambas deben poder correr en simultáneo.

El demo debe ser reproducible sin hardware especializado.
