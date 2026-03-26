# Node realtime gateway

Minimal Node gateway for Pusher compatible auth and triggers.

## Setup

```bash
cd realtime/node
npm install
```

Use the shared env file:

```bash
cp ../.env.example ../.env
```

Edit `../.env`, then run:

```bash
npm start
```

## Endpoints

- `POST /realtime/auth` (private and presence auth)
- `POST /realtime/emit` (trigger events)
- `POST /realtime/tts/aligned` (AWS Polly audio + word timings)
- `GET /realtime/health`
- `GET /realtime/state/summary` (snapshot metadata)
- `GET /realtime/state` (full snapshot)
- `POST /realtime/state/sync` (append events + merge snapshot)

## Community push

DM push delivery can run locally from `realtime/node/push/` without depending on
`backendV4`. Configure the APNs / FCM credential paths in `../.env`.

## State sync notes

- Storage is file-based for MVP: `realtime/node/data/rt/`.
- Use `owner`, `user_id`, or `device_id` to scope data (owner wins).
- Optional guard: set `REALTIME_STATE_TOKEN` and send it as `x-rt-token` or `token`.

## Switching to Pusher

Set `REALTIME_PROVIDER=pusher` and remove `REALTIME_HOST/REALTIME_PORT`.
The same code continues to work with the Pusher service.

## TTS aligned quick test

Configure `TTS_ALIGNED_S3_BUCKET` plus AWS creds in `../.env`, then:

```bash
curl -X POST http://localhost:8787/realtime/tts/aligned \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "This is a Free ride test sentence.",
    "locale": "en-US",
    "voice_profile": "child"
  }'
```

Response includes:

- `audio_url`: playable mp3 in S3
- `words[]`: `{ text, start_ms, end_ms }` for live highlight
- optional response metadata: `voice`, `engine`, `rate`, `pitch`, `voice_profile`

Supported request overrides:

- `voice`: explicit Polly voice id
- `engine`: `standard`, `neural`, `generative`
- `rate`: Polly prosody rate, for example `105%`
- `pitch`: Polly prosody pitch, for example `+3%`
- `voice_profile`: preset bundle. `child` currently resolves to `Lucia` for `es-ES`, `Ivy` for `en-US`, and `Amy` for `en-GB`, with `neural`, `rate=105%`, `pitch=+3%`

Note:

- Polly `neural` does not accept every SSML feature. In this server, `pitch` is only applied when the engine is `standard`; for `neural`, `long-form`, and `generative` it is ignored automatically to avoid `Unsupported Neural feature`.
