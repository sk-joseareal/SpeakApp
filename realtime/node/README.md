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
- `GET /realtime/health`
- `GET /realtime/state/summary` (snapshot metadata)
- `GET /realtime/state` (full snapshot)
- `POST /realtime/state/sync` (append events + merge snapshot)

## State sync notes

- Storage is file-based for MVP: `realtime/node/data/rt/`.
- Use `owner`, `user_id`, or `device_id` to scope data (owner wins).
- Optional guard: set `REALTIME_STATE_TOKEN` and send it as `x-rt-token` or `token`.

## Switching to Pusher

Set `REALTIME_PROVIDER=pusher` and remove `REALTIME_HOST/REALTIME_PORT`.
The same code continues to work with the Pusher service.
