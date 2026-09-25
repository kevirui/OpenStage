# OpenStage

Infraestructura open source para subtítulos multilingües en tiempo real en conferencias.

## El problema

Una conferencia tiene varios escenarios en simultáneo. Las charlas son en inglés, parte del público lee en español, y subtitular o interpretar cada escenario con personas es caro y difícil de coordinar. El resultado habitual es que el público se queda sin subtítulos, o que sólo el escenario principal los tiene.

## La solución

OpenStage trata cada escenario como una sesión independiente. Su audio se transcribe y se traduce mientras la charla sucede, y los subtítulos resultantes se envían a cualquier navegador que esté siguiendo esa sesión:

```text
Audio
 ↓
Procesamiento de voz en tiempo real (Gemini Live)
 ↓
Traducción inglés → español
 ↓
CaptionEvent → WebSocket
 ↓
Subtítulos en vivo en el navegador del público
```

## Funcionalidades (implementadas hoy)

- Transcripción incremental: el audio se envía a Gemini Live en chunks PCM de 200 ms y los subtítulos aparecen mientras el audio sigue sonando.
- Traducción inglés → español entregada de forma incremental junto al original.
- Subtítulos en vivo en el navegador en `/session/<id>`, con original y traducción lado a lado, estado de conexión y ciclo de vida de la sesión.
- Entrega por WebSocket con suscripciones por sesión: un cliente suscripto a `stage-a` nunca recibe eventos de `stage-b`.
- Dos sesiones concurrentes completamente aisladas (worker, fuente de audio, conexión a Gemini, ciclo de vida y stream de subtítulos propios).
- Aislamiento de fallos por sesión: una sesión puede fallar sin detener a la otra.
- Demos por terminal para una sesión y para dos sesiones concurrentes.
- Tests unitarios deterministas que nunca llaman a la API de Gemini.
- Licencia MIT, sin secretos en el repositorio.

No implementado (y no lo afirmamos): entrada por micrófono / audio de conferencia en vivo, más de dos sesiones concurrentes verificadas end to end, escalado horizontal entre instancias del backend, almacenamiento persistente, autenticación, exportación SRT/VTT, entrada OBS/vMix o RTMP/HLS, identificación de oradores, inyección de glosario.

## Arquitectura

```text
                 OpenStage
                     │
              SessionManager
                /          \
        Sesión A           Sesión B
            │                  │
        Audio A             Audio B      (FileAudioChunkSource + ffmpeg → PCM 16 kHz)
            │                  │
         Gemini A           Gemini B     (GeminiSpeechProvider, una conexión Live cada una)
            │                  │
      CaptionEvents      CaptionEvents   (CaptionNormalizer)
            │                  │
       WebSocket A        WebSocket B    (RealtimeServer, suscripciones por sessionId)
            │                  │
      Navegador A        Navegador B
```

Límites de dominio: `packages/shared` contiene los tipos independientes del framework (`Session`, `CaptionEvent`, `SpeechProvider`, `AudioChunk`, mensajes de WebSocket). El servidor depende sólo de esas abstracciones: ningún tipo de Gemini cruza hacia `shared` ni llega al navegador, y el frontend recibe `CaptionEvent` normalizados y nunca ve la `GEMINI_API_KEY`.

## Ejecución local

### Requisitos previos

- Node.js 20+ y npm 10+
- `ffmpeg` (`apt install ffmpeg` / `brew install ffmpeg`): Gemini Live sólo acepta PCM crudo, así que ffmpeg decodifica las grabaciones de demo. Podés indicar otra ubicación con `FFMPEG_PATH`.
- Una API key de Google AI Studio con acceso a la Gemini Live API.

### Instalación

```bash
npm install
cp .env.example .env     # después completá GEMINI_API_KEY
```

Colocá dos grabaciones locales (voz en inglés, de cualquier duración; no se descarga nada automáticamente, y el único audio commiteado en este repositorio es una charla incluida con permiso de su oradora):

```bash
demo/audio/stage-a.mp3   # sesión `stage-a`
demo/audio/stage-b.mp3   # sesión `stage-b`
```

Usar dos grabaciones distintas hace evidente la concurrencia, pero se puede copiar el mismo archivo en ambas rutas.

### Arranque

```bash
npm run dev              # backend en :4000 + aplicación web en :3000
```

- Sesiones: [http://localhost:3000](http://localhost:3000)
- Subtítulos de Stage A: [http://localhost:3000/session/stage-a](http://localhost:3000/session/stage-a)
- Subtítulos de Stage B: [http://localhost:3000/session/stage-b](http://localhost:3000/session/stage-b)
- Admin: [http://localhost:3000/admin](http://localhost:3000/admin)

`npm install` + `npm run dev` es el camino recomendado. Docker Compose está disponible como alternativa (`docker compose up --build`): monta `./demo` en sólo lectura para que el contenedor vea tus grabaciones locales y toma `GEMINI_API_KEY` de tu entorno o del `.env` de la raíz.

## Variables de entorno

| Variable | Requerida | Para qué sirve |
| --- | --- | --- |
| `GEMINI_API_KEY` | sí (para subtítulos reales) | Acceso a Gemini Live. Sin ella el backend igual arranca y sirve subtítulos **mock**, y la página de admin lo aclara. |
| `GEMINI_LIVE_MODEL` | no | Modelo Live alternativo. Por defecto `gemini-3.5-live-translate-preview`: su transcripción de entrada es el original en inglés y la de salida, la traducción al español. |
| `FFMPEG_PATH` | no | Ruta al binario de ffmpeg. |
| `PORT` | no | Puerto del backend (4000 por defecto). |
| `NEXT_PUBLIC_SERVER_URL` / `NEXT_PUBLIC_WS_URL` | no | Dónde encuentra el navegador al backend. |

Ver `.env.example`. `.env` está ignorado por git; nunca commitees una key.

## Demo

### Dos sesiones concurrentes (demo principal)

1. `npm run dev`
2. Abrí `/session/stage-a` y `/session/stage-b` en dos pestañas o ventanas del navegador.
3. En una tercera terminal:
   ```bash
   npm run demo:multi-session
   ```

El runner se suscribe a ambas sesiones por WebSocket, las inicia sin que una espere a la otra y etiqueta cada subtítulo, así la salida intercalada demuestra que ambos pipelines están activos:

```text
[STAGE-A] STARTING
[STAGE-B] STARTING
[STAGE-A] [00:03] EN: Welcome everyone to Open Stage.
[STAGE-A] [00:03] ES: Bienvenidos todos a Open Stage.
[STAGE-B] [00:03] EN: Today we are discussing agent architectures.
[STAGE-B] [00:03] ES: Hoy hablamos de arquitecturas de agentes.
[STAGE-A] [00:06] EN: Our goal is to make every talk accessible.
[STAGE-A] [00:06] ES: Nuestro objetivo es que cada charla sea accesible.
```

Termina con código distinto de cero si alguna sesión finaliza en `ERROR`. Para correr otro par: `npm run demo:multi-session -- stage-a demo-session`.

### Una sola sesión

```bash
npm run demo:stream          # una sesión precargada hacia el navegador (/session/demo-session)
npm run demo:transcribe      # una sesión directo a la terminal, sin servidor
```

### Protocolo WebSocket

```jsonc
// cliente → servidor
{ "type": "subscribe",   "sessionId": "stage-a" }
{ "type": "unsubscribe", "sessionId": "stage-a" }

// servidor → cliente
{ "type": "subscribed", "sessionId": "stage-a", "status": "CREATED" }
{ "type": "session",    "sessionId": "stage-a", "status": "LIVE" }
{ "type": "caption",    "event": { "sessionId": "stage-a", "timestamp": 12345,
                                   "original": "...", "translation": "...",
                                   "language": "en", "targetLanguage": "es", "final": false } }
```

Los subtítulos parciales llegan con `final: false` y se reemplazan en el lugar; un segmento finalizado llega con `final: true` y se agrega a la transcripción.

### Aislamiento de sesiones

`SessionManager.startSession(id)` construye un `SessionWorker` nuevo, dueño de su propio `SpeechProvider` (una conexión a Gemini Live), su propio `AudioChunkSource` y su propio callback de subtítulos. El estado se sigue por id de sesión, los subtítulos se emiten sólo a los clientes suscriptos a ese id, y una sesión que falla pasa a `ERROR` por su cuenta mientras la otra sigue transmitiendo. Cuando una sesión termina, su worker cierra el stream de Gemini, abandona el bombeo de audio y se elimina del mapa de workers activos.

## Escalado

**Implementación actual:** las sesiones son pipelines asíncronos concurrentes dentro de un único proceso Node.js, con estado de sesión en memoria.

```text
1 sesión  = 1 SessionWorker
2 sesiones = 2 SessionWorkers
N sesiones = N workers independientes (un proceso, limitado por la cuota de Gemini y la CPU)
```

**Arquitectura de escalado futura (no implementada):** el mismo modelo de workers se puede distribuir — varias instancias del backend detrás de un balanceador de carga, cada una corriendo un subconjunto de los workers, con una coordinación compartida (qué instancia es dueña de qué sesión) y una capa de mensajería compartida para que cualquier instancia pueda atender a los clientes WebSocket de cualquier sesión. OpenStage no implementa esto hoy y no soporta sesiones ilimitadas.

## Grabación del demo

Un recorrido de 60 a 120 segundos:

- **0:00–0:10** — Página de inicio. "OpenStage es infraestructura open source para subtítulos multilingües de conferencias en tiempo real."
- **0:10–0:25** — Abrir la Sesión A, iniciar el demo (`npm run demo:multi-session`) y mostrar los subtítulos en inglés y español apareciendo progresivamente.
- **0:25–0:40** — Pasar a la Sesión B, que ya está corriendo al mismo tiempo con su propio contenido.
- **0:40–0:55** — Poner ambas ventanas lado a lado: cada sesión muestra solamente sus propios subtítulos.
- **0:55–1:15** — Mostrar el diagrama del pipeline: audio → SessionWorker → Gemini → CaptionEvent → WebSocket → navegador.
- **1:15–1:30** — Mostrar el diagrama multi-sesión (Sesión A → Worker A, Sesión B → Worker B) y comentar que el mismo modelo de workers se puede distribuir entre instancias del backend a medida que crecen las sesiones.

Mostrá código fuente en pantalla unos pocos segundos como mucho.

## Estructura del repositorio

```text
openstage/
├── apps/
│   ├── server/          # Backend Express + WebSocket: sessions, audio, ai, captions, realtime
│   └── web/             # App Next.js 14: / (sesiones), /session/[id] (público), /admin
├── packages/
│   └── shared/          # Tipos e interfaces de dominio, independientes del framework
├── demo/
│   ├── audio/           # Tus grabaciones locales (ignoradas por git): stage-a.mp3, stage-b.mp3
│   └── glossary.json    # Glosario técnico (todavía no se inyecta en los prompts)
├── .agent/rules/        # Reglas de código y arquitectura del proyecto
├── docker-compose.yml
├── .env.example
├── PROJECT_CONTEXT.md
└── LICENSE
```

## Chequeos de calidad

```bash
npm run typecheck
npm test        # deterministas, sin llamadas a Gemini
npm run build
```

`npm run lint` no es usable hoy: nunca se configuró ESLint para `apps/web` (`next lint` abre su asistente interactivo de configuración) y `packages/shared` no tiene script `lint`.

## Limitaciones conocidas

- Archivos de audio de demo en lugar de un micrófono físico de conferencia.
- Estado de sesión en memoria: reiniciar el backend borra todo.
- Una sola instancia del backend; el escalado horizontal está descripto sólo conceptualmente.
- Dos sesiones concurrentes verificadas end to end; más de dos no está probado.
- Una sesión queda en `STOPPING` hasta ~40 s mientras Gemini vacía los subtítulos finales.
- La completitud de los subtítulos depende de la Gemini Live API: con una key de nivel gratuito,
  correr dos sesiones a la vez a veces devuelve una transcripción truncada (o ninguna) para una
  de ellas, mientras que el mismo audio procesado solo se transcribe completo.
- Un único par de idiomas (inglés → español).

## Licencia

Publicado bajo la [licencia MIT](LICENSE).
