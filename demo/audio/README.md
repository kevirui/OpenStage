# Demo Audio Files

Audio files in this directory are git-ignored by default: OpenStage does not
redistribute conference recordings it has no rights to, and nothing is
downloaded automatically. The one committed recording
(`Del código a la narrativa... - Abigail Carmio.mp3`) is included with the
speaker's permission.

Provide your own English-speech recordings before running the demos:

- `stage-a.mp3` — session `stage-a` (also used by `demo-session`)
- `stage-b.mp3` — session `stage-b`

`ffmpeg` decodes them into the 16 kHz mono PCM that the Gemini Live API expects,
so any format ffmpeg can read works if you point the session at it.
