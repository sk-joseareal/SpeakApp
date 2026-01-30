# Realtime (Pusher compatible)

Goal: run Soketi now and keep a clean path to switch to Pusher without
rewriting the client. The transport changes, but the channel/event contract
stays the same.

## Quick start (Soketi)

1) Copy the env template:

```bash
cd realtime
cp .env.example .env
```

2) Fill the keys in `.env` and start the stack:

```bash
docker compose up -d
```

Note: for Soketi 1.x, the app manager driver should be `array` and the
`SOKETI_DEFAULT_APP_*` values must be set. Using `local` or `redis` will crash
the server.
This compose file only runs Soketi (no Redis).

3) WebSocket endpoint (local):

```
ws://localhost:6001/app/<PUSHER_APP_KEY>?protocol=7&client=js&version=8.0.0
```

Metrics (optional):
```
http://localhost:9601/metrics
```

## Node backend (Pusher SDK)

There is a minimal Node gateway in `realtime/node/server.js`. It provides:

- `POST /realtime/auth` for private/presence channels
- `POST /realtime/emit` to trigger events
- `GET /realtime/channels` to list active channels (optional; set `REALTIME_MONITOR_TOKEN`)

The same code works with Soketi or Pusher by flipping env vars.

## Client config (Pusher JS)

Soketi (self hosted):

```js
const pusher = new Pusher(PUSHER_KEY, {
  wsHost: 'realtime.example.com',
  wsPort: 6001,
  forceTLS: false,
  enabledTransports: ['ws', 'wss'],
  authEndpoint: `${API_BASE}/realtime/auth`
});
```

Pusher (managed):

```js
const pusher = new Pusher(PUSHER_KEY, {
  cluster: 'mt1',
  forceTLS: true,
  authEndpoint: `${API_BASE}/realtime/auth`
});
```

## Switch to Pusher

- Keep the same channels and events.
- Set `REALTIME_PROVIDER=pusher` in the backend.
- Remove `REALTIME_HOST/REALTIME_PORT` or leave them unset.
- In the client, remove `wsHost/wsPort` and set `cluster`.

## Bot user pattern

Treat the chatbot as a normal user (for example `user_id=9000000`) and publish
`chat_message` events with a consistent payload:

```json
{
  "channel": "private-123_9000000",
  "actor": { "id": 9000000, "name": "Coach", "avatar": "/assets/bot.png" },
  "body": "Great! Try a softer T sound in the middle.",
  "audio_url": "https://cdn.example.com/coach/1234.mp3",
  "created_at": "2025-01-01T10:00:00.000Z"
}
```

The backend decides how to persist messages, run the bot, and publish events.
