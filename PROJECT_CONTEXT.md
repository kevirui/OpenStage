# OpenStage

## 1. Resumen del proyecto

OpenStage es una plataforma open source de subtitulado multilingüe en tiempo real, pensada para conferencias como Nerdearla.

El problema:

Las conferencias grandes pueden tener muchas sesiones en simultáneo, incluidas sesiones en inglés que necesitan ser accesibles para un público hispanohablante.

Las soluciones existentes suelen ser caras, requieren operación manual y no escalan fácilmente a muchos escenarios simultáneos.

OpenStage busca ofrecer una infraestructura open source que le permita a una conferencia:

1. Recibir audio en vivo de varias sesiones.
2. Transcribir el discurso original en tiempo real.
3. Traducir del inglés al español en tiempo real.
4. Emitir eventos de subtítulos a clientes web.
5. Permitir que varias sesiones corran en simultáneo.
6. Almacenar los subtítulos generados.
7. Exportar la transcripción final como SRT, VTT o TXT.
8. Ofrecer un panel simple de producción/monitoreo.
9. Poder desplegarse con Docker.
10. Ser comprensible y reproducible por otra conferencia open source.

El proyecto se desarrolla como un MVP de hackatón.

La prioridad es un sistema funcional, comprensible y demostrable, antes que una plataforma empresarial a escala productiva.

---

# 2. Concepto central

La abstracción principal es una `Session` (sesión).

Una conferencia puede tener muchas sesiones:

```text
Conferencia
│
├── Sesión A
│   ├── Audio
│   ├── Transcripción
│   └── Traducción
│
├── Sesión B
│   ├── Audio
│   ├── Transcripción
│   └── Traducción
│
└── Sesión C
    ├── Audio
    ├── Transcripción
    └── Traducción
```

Cada sesión debe estar aislada de las demás.

El sistema debe diseñarse de manera que:

```text
1 sesión = 1 pipeline de procesamiento independiente
```

Por lo tanto:

```text
N sesiones
    ↓
N workers/pipelines de sesión independientes
    ↓
N conexiones de IA/audio
```

El MVP inicial debe demostrar al menos dos sesiones simultáneas.

---

# 3. Arquitectura general

La arquitectura prevista es:

```text
                         ┌─────────────────────┐
                         │   Entrada de audio  │
                         │                     │
                         │ Mic / Archivo /     │
                         │ Stream              │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   Worker de audio   │
                         │                     │
                         │ FFmpeg / proceso    │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   Proveedor de IA   │
                         │                     │
                         │ Gemini Audio / Live │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ Motor de subtítulos │
                         │                     │
                         │ transcripción orig. │
                         │ traducción          │
                         │ timestamps          │
                         └──────────┬──────────┘
                                    │
                              WebSocket
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
              Web del público                Panel de admin
```

El sistema debe diseñarse alrededor de eventos, y no de flujos request/response fuertemente acoplados.

---

# 4. Componentes principales

## Frontend

Tecnología:

* React
* TypeScript
* Next.js
* Tailwind CSS

Responsabilidades:

* Mostrar las sesiones disponibles.
* Permitir elegir una sesión.
* Mostrar los subtítulos originales.
* Mostrar los subtítulos traducidos.
* Mostrar el estado de la sesión.
* Ofrecer un panel de producción/admin.
* Conectarse al backend por WebSocket o SSE.

El frontend NO debe contener lógica de IA.

El frontend debe consumir eventos de subtítulos ya normalizados por el backend.

---

# 5. Backend

Tecnología preferida:

* Node.js
* TypeScript

Responsabilidades:

* Gestionar las sesiones.
* Crear y detener los workers de sesión.
* Gestionar las fuentes de audio.
* Comunicarse con Gemini.
* Normalizar las respuestas de la IA.
* Emitir los eventos de subtítulos.
* Seguir el estado de cada sesión.
* Persistir los subtítulos.
* Exponer las APIs que necesita el frontend.

El backend debe ser el orquestador central.

---

# 6. Capa de IA

El proveedor de IA inicial debe ser Gemini, porque el hackatón recomienda específicamente sus capacidades de audio.

Aun así, el código debe evitar acoplar toda la aplicación directamente a Gemini.

Hay que crear una abstracción como:

```text
TranscriptionProvider
```

o:

```text
SpeechProvider
```

La primera implementación puede ser:

```text
GeminiProvider
```

Proveedores futuros podrían ser, en teoría:

```text
WhisperProvider
LocalGemmaProvider
OtherProvider
```

NO implementar esas alternativas todavía.

El objetivo es mantener la arquitectura reemplazable sin crear abstracciones innecesarias.

---

# 7. Evento de subtítulo

La estructura de datos central de OpenStage es el evento de subtítulo.

Un evento conceptual:

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

El esquema exacto puede evolucionar durante la implementación.

Propiedades importantes:

* sessionId
* timestamp
* texto original
* texto traducido
* idioma de origen
* idioma de destino
* si el segmento es final

El frontend debe apoyarse en esta representación normalizada y no en las respuestas crudas de Gemini.

---

# 8. Ciclo de vida de una sesión

Conceptualmente, una sesión debería pasar por estos estados:

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

Estado de error:

```text
ERROR
```

Ejemplo:

```text
Sesión A
    CREATED
       ↓
    STARTING
       ↓
      LIVE
       ↓
   COMPLETED
```

El sistema debe exponer suficiente información de estado para el panel de admin.

---

# 9. Fuentes de audio

El MVP debe soportar al menos una fuente de audio simple.

Fuente inicial preferida:

```text
Archivo de audio local
```

Por ejemplo:

```text
/demo/audio/stage-a.mp3
/demo/audio/stage-b.mp3
```

Esto hace que el proyecto sea reproducible.

La arquitectura debe dejar lugar para:

```text
Micrófono
Stream RTMP
Stream HLS
Otras fuentes de streaming
```

pero NO deben implementarse antes de que el MVP funcione.

---

# 10. Arquitectura multi-sesión

El MVP debe demostrar al menos dos sesiones simultáneas.

Ejemplo:

```text
Stage A
audio-a.mp3
    ↓
Session Worker A
    ↓
Gemini
    ↓
Subtítulos A


Stage B
audio-b.mp3
    ↓
Session Worker B
    ↓
Gemini
    ↓
Subtítulos B
```

Las sesiones deben permanecer lógicamente aisladas.

Una falla en una sesión no debe tirar abajo todo el backend.

---

# 11. Comunicación por WebSocket

El backend debe exponer un mecanismo de comunicación en tiempo real.

Preferido:

```text
WebSocket
```

Conceptualmente:

```text
Navegador
   │
   │ subscribe(sessionId)
   ▼
Backend
   │
   │ eventos de subtítulos
   ▼
Navegador
```

Ejemplo:

```text
/ws/sessions/session-a
```

u otro mecanismo de ruteo prolijo.

La implementación exacta se puede elegir durante el desarrollo.

---

# 12. Almacenamiento

Inicialmente el MVP puede usar:

```text
SQLite
```

o:

```text
PostgreSQL
```

No sobredimensionar la persistencia.

Entidades posibles:

```text
Session
Caption
```

Una sesión debería contener información como:

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

Un subtítulo debería contener:

```text
id
sessionId
timestamp
original
translation
final
```

---

# 13. Exportación

Cuando una sesión termina, el sistema debería poder exportar:

```text
SRT
VTT
TXT
```

Es una funcionalidad opcional pero deseable, porque demuestra que los subtítulos generados sirven más allá de la experiencia en vivo.

---

# 14. Glosario

Una funcionalidad futura/opcional es un glosario técnico.

Ejemplo:

```text
React
Kubernetes
TypeScript
PostgreSQL
WebAssembly
Nerdearla
Vibeathon
```

El glosario se puede pasar como información de contexto al proveedor de IA.

El objetivo es mejorar el reconocimiento y la traducción de:

* términos técnicos
* nombres de productos
* nombres de proyectos
* nombres propios
* vocabulario específico de la conferencia

No implementar inicialmente un sistema complejo de gestión de glosarios.

Para el MVP alcanza con una configuración JSON simple.

Ejemplo:

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

# 15. Panel de administración

El panel de admin debe ofrecer una vista simple, orientada a producción.

Ejemplo:

```text
OPENSTAGE CONTROL ROOM

Stage A
🟢 LIVE
EN → ES
Latencia: 1.2s
Subtítulos: 1482

Stage B
🟢 LIVE
EN → ES
Latencia: 1.4s
Subtítulos: 1291

Stage C
🔴 ERROR
Audio desconectado
```

El panel debe priorizar la visibilidad operativa.

No necesita analítica avanzada.

---

# 16. Interfaz del público

La interfaz del público debe ser extremadamente simple.

Ejemplo:

```text
OPENSTAGE

Elegí una sesión:

[ AI Agents in Production ]
[ React at Scale ]
[ Open Source Communities ]

Idioma:

🇬🇧 Original
🇪🇸 Español
```

Después de elegir una sesión:

```text
AI Agents in Production

ORIGINAL

Today we're going to discuss...

ESPAÑOL

Hoy vamos a hablar sobre...
```

El público no debería necesitar entender la infraestructura técnica.

---

# 17. Despliegue

El proyecto debe ser amigable con Docker.

Despliegue inicial esperado:

```text
Docker Compose
```

Arquitectura posible:

```text
docker compose up
```

Levantando:

```text
web
server
base de datos
```

No introducir Kubernetes durante el MVP.

Más adelante el proyecto podría desplegarse en AWS EC2.

---

# 18. Estructura del repositorio

Estructura inicial preferida:

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

Esta estructura puede adaptarse si el framework elegido lo requiere.

---

# 19. Open source

El proyecto debe publicarse bajo una licencia aprobada por la OSI.

Preferida:

```text
MIT
```

El repositorio debe incluir:

```text
LICENSE
```

y el README debe explicar claramente:

* qué hace el proyecto
* requisitos
* variables de entorno
* credenciales de Gemini
* cómo correrlo localmente
* cómo correr las sesiones de demo
* cómo correr dos sesiones en simultáneo
* cómo escalar las sesiones
* arquitectura
* limitaciones

---

# 20. Restricciones del hackatón

El proyecto se crea específicamente para un hackatón.

La solución en sí debe desarrollarse durante el período del hackatón.

Se pueden usar librerías y modelos existentes.

Es aceptable usar:

* Gemini
* Whisper
* FFmpeg
* React
* Next.js
* Node.js
* Docker
* PostgreSQL
* otras librerías open source

El valor propio está en la orquestación, la arquitectura, la UX y el flujo de trabajo de conferencia de OpenStage.

---

# 21. Requisitos del MVP

Antes de agregar funcionalidades opcionales, tiene que funcionar lo siguiente:

### Requisito 1

Recibir audio de al menos una fuente.

### Requisito 2

Generar transcripción en tiempo real.

### Requisito 3

Generar traducción inglés → español.

### Requisito 4

Mostrar los subtítulos.

### Requisito 5

Correr al menos dos sesiones en simultáneo.

### Requisito 6

Explicar cómo agregar más sesiones.

### Requisito 7

Publicar una licencia open source.

### Requisito 8

Ofrecer documentación reproducible.

Estos requisitos tienen prioridad absoluta.

---

# 22. Funcionalidades opcionales

Sólo después de que el MVP funcione:

1. Integración con OBS.
2. Integración con vMix.
3. Más idiomas.
4. Glosario técnico.
5. Exportación SRT/VTT/TXT.
6. Monitoreo de producción.
7. Mejores métricas de latencia.
8. Identificación de oradores.
9. Entradas RTMP/HLS.

Las funcionalidades opcionales nunca deben comprometer el MVP.

---

# 23. Posicionamiento del producto

No posicionar a OpenStage como:

> "Un traductor con IA."

Posicionarlo como:

> "Infraestructura open source para subtítulos multilingües en tiempo real en conferencias."

La idea clave es:

```text
UNA SESIÓN
       ↓
UN PIPELINE

MUCHAS SESIONES
       ↓
MUCHOS PIPELINES INDEPENDIENTES
```

Esto responde directamente a la operación a escala de conferencia.

---

# 24. Escenario del demo

El demo debe simular dos escenarios de conferencia.

Stage A:

```text
stage-a.mp3
Inglés
Transcripción en inglés
Traducción al español
```

Stage B:

```text
stage-b.mp3
Inglés
Transcripción en inglés
Traducción al español
```

El panel debería mostrar:

```text
2 SESIONES ACTIVAS

🟢 Stage A
🟢 Stage B
```

Un navegador puede conectarse a cada sesión y ver los subtítulos actualizándose en tiempo real.

---

# 25. Filosofía de desarrollo

Prioridades:

1. MVP funcional.
2. Arquitectura simple.
3. Límites claros.
4. Reproducibilidad.
5. Buen demo.
6. Documentación.
7. Funcionalidades opcionales.

Evitar la optimización prematura.

Evitar abstracciones innecesarias.

Evitar dependencias innecesarias.

Evitar microservicios salvo que aparezca un requisito real.

Evitar implementar funcionalidad futura antes de que funcione el pipeline central.

La pregunta guía siempre debería ser:

> "¿Esto nos ayuda a demostrar subtítulos multilingües en tiempo real, confiables, a través de varias sesiones de conferencia?"

Si no, posponerlo.
