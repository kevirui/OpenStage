---
trigger: always_on
---

# Reglas del backend

El backend es el orquestador central.

Es responsable de:

* el ciclo de vida de las sesiones
* el procesamiento de audio
* la comunicación con el proveedor de IA
* la normalización de subtítulos
* la emisión en tiempo real
* la persistencia

## Diseño de la API

Usar APIs explícitas.

No exponer respuestas de IA específicas del proveedor.

El frontend consume objetos/eventos de dominio de OpenStage.

## Ciclo de vida de la sesión

Las sesiones deben soportar estados como:

```text
CREATED
STARTING
LIVE
STOPPING
COMPLETED
ERROR
```

No crear transiciones de estado innecesarias.

## Tiempo real

Preferir WebSocket para la entrega de subtítulos en vivo.

Los eventos de subtítulos deben normalizarse antes de emitirse.

## Errores

Los errores deben ser:

* explícitos
* observables
* asociados a la sesión correspondiente cuando sea posible

Una sesión que falla no debe tirar abajo todo el backend.

## Configuración

Los secretos deben venir de variables de entorno.

Nunca hardcodear API keys ni credenciales.

Nunca commitear archivos `.env` con secretos.
