---
trigger: always_on
---

# Reglas de arquitectura

OpenStage se organiza alrededor de sesiones de conferencia independientes.

La abstracción fundamental es:

```text
Session
```

Cada sesión representa un pipeline independiente audio → IA → subtítulos.

## Límites

Mantener límites claros entre:

```text
Audio
Proveedor de IA
Procesamiento de subtítulos
Gestión de sesiones
Transporte en tiempo real
Persistencia
Frontend
```

## Aislamiento del proveedor de IA

No permitir que estructuras específicas de Gemini se filtren al frontend ni a la capa de dominio.

Preferir:

```text
SpeechProvider
    ↓
GeminiProvider
```

Las respuestas específicas del proveedor deben normalizarse a eventos de dominio de OpenStage.

## Contratos compartidos

Los tipos compartidos entre frontend y backend deben vivir en:

```text
packages/shared
```

No duplicar tipos de dominio importantes entre aplicaciones.

## Aislamiento de sesiones

Una falla en una sesión no debe terminar otras sesiones.

El estado propio de una sesión debe quedar asociado a esa sesión.

## Simplicidad

Preferir un monolito modular para el MVP.

No dividir el sistema en microservicios salvo que sea necesario.
