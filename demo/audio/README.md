# Archivos de audio para el demo

Los archivos de audio de este directorio están ignorados por git por defecto:
OpenStage no redistribuye grabaciones de conferencias sobre las que no tiene
derechos, y no descarga nada automáticamente. La única grabación commiteada
(`Del código a la narrativa... - Abigail Carmio.mp3`) se incluye con permiso
de su oradora.

Poné tus propias grabaciones con voz en inglés antes de correr los demos:

- `stage-a.mp3` — sesión `stage-a` (también la usa `demo-session`)
- `stage-b.mp3` — sesión `stage-b`

`ffmpeg` las decodifica al PCM mono de 16 kHz que espera la Gemini Live API,
así que sirve cualquier formato que ffmpeg pueda leer mientras apuntes la
sesión a ese archivo.
