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

## Switching to Pusher

Set `REALTIME_PROVIDER=pusher` and remove `REALTIME_HOST/REALTIME_PORT`.
The same code continues to work with the Pusher service.
