# Shared Chat Compatibility Spec

## Goal

Make the new SpeakApp chat interoperable with the legacy English Course chat
(`wwwV4`) so that:

1. A logged-in SpeakApp user can chat with a logged-in English Course user.
2. Both app types can participate in the same public channel.
3. Coach/chatbot traffic remains separate from human community chat.

This spec does not change the current coach contract. It adds a shared human chat
contract and a legacy compatibility bridge in the realtime/backend layer.

## Current State

### SpeakApp

SpeakApp chat currently uses coach-oriented private channels:

- `private-coach1-<userId>`
- `private-coach2-<userId>`

Reference:

- `www/js/pages/chat.js:569`
- `www/js/pages/chat.js:576`

The current backend already provides:

- Pusher/Soketi auth
- generic emit endpoint
- chatbot reply pipeline

Reference:

- `realtime/node/server.js:2495`
- `realtime/node/server.js:2523`

### Legacy app (`wwwV4`)

Legacy chat uses:

- public room: `site-wide-chat-channel`
- presence room: `presence-site-wide-chat-channel`
- direct-message control events on the public room:
  - `private_chat`
  - `destroy_private_chat`

References:

- `wwwV4/js/modulos/chatservice.js:74`
- `wwwV4/js/modulos/chatservice.js:102`
- `wwwV4/js/controllers.js:1656`
- `wwwV4/js/controllers.js:1816`

Legacy `chat_message` payload shape expected by `wwwV4`:

```json
{
  "id": "message-id",
  "published": "2026-03-10T12:00:00.000Z",
  "text": "Hello",
  "actor": {
    "id": "100008",
    "displayName": "Jose"
  }
}
```

Legacy private chat control payloads:

```json
{
  "user1": "100008",
  "user2": "100031",
  "private_channel": "private-100008_100031"
}
```

## Product Model

The new app should expose two distinct products in the `Chat` tab:

1. `Coach`
2. `Community`

### Community visual model

Inside `Community`:

1. `Public`
2. `Chats`

Meaning:

- `Public`: single shared room between SpeakApp and English Course
- `Chats`: direct messages between users

The coach timeline must remain isolated from human chat. Human messages and coach
messages must never share the same room or thread.

## Canonical Chat Model

The backend should adopt a canonical room/message model. Legacy compatibility
should be implemented as an adapter on top of this model.

### Room types

- `coach`
- `public`
- `dm`

### Canonical room ids

- Public:
  - `public:site-wide-chat-channel`
- Direct messages:
  - `dm:<minUserId>_<maxUserId>`
- Coach:
  - `coach:1:<userId>`
  - `coach:2:<userId>`

### Canonical message payload

```json
{
  "id": "msg_01JX...",
  "room_type": "public",
  "room_id": "site-wide-chat-channel",
  "text": "Hello everyone",
  "created_at": "2026-03-10T12:00:00.000Z",
  "actor": {
    "id": "100008",
    "name": "Jose",
    "avatar": "https://cdn.example.com/avatar.jpg",
    "app": "speakapp",
    "premium": true
  }
}
```

Notes:

- `actor.app` must be one of:
  - `speakapp`
  - `english-course`
- `premium` is metadata only. Authorization stays server-side.

## Channel Contract

### Coach channels

Keep current SpeakApp coach channels unchanged:

- `private-coach1-<userId>`
- `private-coach2-<userId>`

These are not shared with English Course.

### Public community channels

Shared by both apps:

- room channel: `site-wide-chat-channel`
- presence channel: `presence-site-wide-chat-channel`

Events:

- `chat_message`
- `user_ignore` (legacy only; optional bridge)
- `member_kicked` (legacy only; optional bridge)
- `ping` (legacy only; optional bridge)
- `private_chat`
- `destroy_private_chat`

### Direct-message channels

Shared by both apps:

- `private-<minUserId>_<maxUserId>`

Example:

- `private-100008_100031`

Events:

- `chat_message`

This naming should be preserved because the legacy app already understands it.

## Compatibility Strategy

### Principle

SpeakApp should talk to the canonical API.
Legacy English Course should keep receiving the legacy event contract.
The backend bridge should translate between both.

### Outbound mapping: canonical -> legacy

#### Public message

Canonical:

```json
{
  "room_type": "public",
  "room_id": "site-wide-chat-channel",
  "text": "Hello",
  "created_at": "2026-03-10T12:00:00.000Z",
  "actor": {
    "id": "100008",
    "name": "Jose",
    "avatar": "https://...",
    "app": "speakapp",
    "premium": true
  }
}
```

Legacy event emitted on `site-wide-chat-channel`:

```json
{
  "id": "msg_01JX...",
  "published": "2026-03-10T12:00:00.000Z",
  "text": "Hello",
  "actor": {
    "id": "100008",
    "displayName": "Jose",
    "avatar": "https://...",
    "app": "speakapp",
    "premium": true
  }
}
```

#### DM room creation

When a DM room becomes available, emit on `site-wide-chat-channel`:

```json
{
  "user1": "100008",
  "user2": "100031",
  "private_channel": "private-100008_100031"
}
```

Event name:

- `private_chat`

#### DM room closure

Emit the same payload with event:

- `destroy_private_chat`

### Inbound mapping: legacy -> canonical

Legacy public messages already arrive through `chat_message` on
`site-wide-chat-channel`. The backend should normalize them before persistence.

Minimum fields required:

- `text`
- actor id
- actor display name

Normalized canonical shape:

```json
{
  "room_type": "public",
  "room_id": "site-wide-chat-channel",
  "text": "<legacy text>",
  "created_at": "<server timestamp if missing>",
  "actor": {
    "id": "<legacy actor id>",
    "name": "<legacy actor displayName>",
    "avatar": "<legacy actor avatar or empty>",
    "app": "english-course"
  }
}
```

## Backend Responsibilities

### Source of truth

Realtime must not be the source of truth for community chat history.

The backend must persist:

- rooms
- messages
- room membership / participants
- last-read markers or unread counters

Suggested tables:

- `chat_rooms`
- `chat_room_members`
- `chat_messages`
- `chat_reads`

### Minimal endpoints

These endpoints are for the canonical model. The old app can keep using its
legacy endpoints while the backend internally maps to the same storage.

#### Auth

- `POST /realtime/auth`
- `GET /realtime/auth`

Compatibility alias:

- `POST /chats/auth_v2`

Behavior:

- `site-wide-chat-channel`: public auth if needed by provider setup
- `presence-site-wide-chat-channel`: presence auth
- `private-<a>_<b>`: authorize only if requester is `a` or `b`
- `private-coachX-<userId>`: authorize only for the owner user

#### Room listing

- `GET /chat/rooms`

Query params:

- `scope=public|dm|all`
- `user_id=<id>`

Response:

- public room metadata
- DM room list with last message preview and unread count

#### Room history

- `GET /chat/messages`

Query params:

- `room_type=public|dm`
- `room_id=<id>`
- `limit=<n>`
- `before=<cursor>`

#### Send message

- `POST /chat/messages`

Request:

```json
{
  "room_type": "public",
  "room_id": "site-wide-chat-channel",
  "text": "Hello"
}
```

Server responsibilities:

1. authorize sender
2. persist message
3. emit canonical realtime event
4. emit legacy-compatible event if needed

#### Ensure DM room

- `POST /chat/rooms/dm`

Request:

```json
{
  "user_id": "100008",
  "peer_user_id": "100031"
}
```

Response:

```json
{
  "ok": true,
  "room_type": "dm",
  "room_id": "100008_100031",
  "channel": "private-100008_100031"
}
```

Server may also emit legacy `private_chat` on the public room so the old app
opens the DM subscription automatically.

## Presence model

For `presence-site-wide-chat-channel`, `user_info` should be reduced to fields
that are actually useful:

```json
{
  "id": "100008",
  "name": "Jose",
  "avatar": "https://...",
  "app": "speakapp",
  "premium": true
}
```

Do not forward legacy noise such as device/version/origin unless there is a real
use case.

## Security rules

### Premium

Keep `premium` as metadata in presence and message actor payloads.
Do not rely on it as authorization.

Authorization must happen in backend when:

- subscribing to coach channels
- subscribing to DM channels
- sending messages
- opening community chat if it is premium-only

### Identity

Shared chat only works cleanly if both apps resolve to the same backend user id.

Required:

- shared login backend
- or a stable user mapping layer

Without a unified `user.id`, DMs and unread tracking become unreliable.

## Recommended rollout

### Phase 1

Implement only shared public chat:

- channel: `site-wide-chat-channel`
- presence: `presence-site-wide-chat-channel`
- history endpoint
- send endpoint
- bridge to legacy `chat_message`

### Phase 2

Implement DM rooms:

- canonical `dm`
- legacy `private_chat` / `destroy_private_chat` bridge
- channel auth for `private-<a>_<b>`

### Phase 3

Polish:

- unread counts
- muting
- ignore/block
- moderation
- optional migration of `wwwV4` to canonical endpoints

## What should not be done

1. Do not mix coach and human messages in the same room.
2. Do not use Pusher/Soketi as message storage.
3. Do not let the frontend decide authorization based on `premium`.
4. Do not make SpeakApp depend directly on legacy `private_chat` semantics.
5. Do not keep two separate persistence models for old and new chat.

## Concrete implementation recommendation

1. Keep current coach implementation unchanged.
2. Add a new `Community` mode in SpeakApp.
3. Implement canonical public room + history in backend.
4. Emit legacy-compatible public events for `wwwV4`.
5. Add DM support with `private-<min>_<max>` naming.
6. Expose `/chats/auth_v2` as a compatibility alias to the new auth logic.

That gives one backend, one storage model, one realtime provider, and two client
contracts during the migration window.

## Implementation Checklist

This section turns the spec into an executable rollout plan.

### Phase 0. Preconditions

- [ ] Confirm both apps resolve to the same backend `user.id`.
- [ ] Confirm whether community chat is premium-only or premium-preferred.
- [ ] Decide where chat persistence lives:
  - current realtime node storage
  - dedicated DB tables
  - existing main backend DB
- [ ] Decide whether `wwwV4` can be changed at all or must remain strictly
      untouched.

Completion criteria:

- identity model agreed
- persistence owner agreed
- compatibility scope agreed

### Phase 1. Backend canonical model

#### Data model

- [ ] Create canonical room abstraction:
  - `room_type`
  - `room_id`
  - `participants`
- [ ] Create canonical message abstraction:
  - `id`
  - `room_type`
  - `room_id`
  - `text`
  - `created_at`
  - `actor`
- [ ] Define persistent storage for:
  - `chat_rooms`
  - `chat_messages`
  - optional unread/read state

#### Realtime contract

- [ ] Keep existing coach channels unchanged.
- [ ] Add shared public room support:
  - `site-wide-chat-channel`
  - `presence-site-wide-chat-channel`
- [ ] Add DM room support:
  - `private-<minUserId>_<maxUserId>`
- [ ] Add canonical message emit path for human chat.

#### Auth

- [ ] Extend `/realtime/auth` to authorize:
  - presence public room
  - DM private room
  - coach private room
- [ ] Expose compatibility alias:
  - `POST /chats/auth_v2`
- [ ] Ensure auth accepts both:
  - modern frontend payload
  - legacy auth params expected by `wwwV4`

Completion criteria:

- backend can authorize public presence, DMs and coach rooms
- backend can persist and emit canonical human chat messages
- no legacy client changes required yet

### Phase 2. Backend legacy bridge

#### Public room bridge

- [ ] When canonical public messages are created, also emit legacy-compatible
      `chat_message` on `site-wide-chat-channel`.
- [ ] Map canonical actor fields to legacy actor fields:
  - `name` -> `displayName`
  - `created_at` -> `published`

#### DM bridge

- [ ] Add room-create helper for DMs.
- [ ] Emit `private_chat` on `site-wide-chat-channel` when a DM should open in
      legacy.
- [ ] Emit `destroy_private_chat` when a DM is closed or revoked in legacy.

#### Optional legacy events

- [ ] Decide whether to support or ignore:
  - `user_ignore`
  - `member_kicked`
  - `ping`

Completion criteria:

- a legacy client can receive public messages produced by SpeakApp
- a legacy client can open a DM with a SpeakApp user through backend bridge

### Phase 3. SpeakApp community UI

#### Navigation

- [ ] Add top-level chat mode selector:
  - `Coach`
  - `Community`
- [ ] Keep `Coach` flow exactly as it is now.
- [ ] Add second selector inside `Community`:
  - `Public`
  - `Chats`

#### Public room

- [ ] Add public thread timeline.
- [ ] Load public history from backend.
- [ ] Subscribe to `site-wide-chat-channel`.
- [ ] Subscribe to `presence-site-wide-chat-channel`.
- [ ] Send public messages through canonical backend endpoint.

#### Direct messages

- [ ] Add DM list UI.
- [ ] Add user picker or “start chat” entry point.
- [ ] Create/open DM room through backend.
- [ ] Load DM history from backend.
- [ ] Subscribe to `private-<min>_<max>`.

#### Visual rules

- [ ] Show avatar, display name and timestamp for community messages.
- [ ] Show actor origin if desired:
  - `SpeakApp`
  - `English Course`
- [ ] Do not show TTS/replay controls on human community messages unless
      explicitly added later.
- [ ] Keep coach visuals and community visuals clearly different.

Completion criteria:

- SpeakApp users can read/write the public shared room
- SpeakApp users can open and use DMs
- coach mode remains unaffected

### Phase 4. Legacy app validation (`wwwV4`)

- [ ] Verify legacy public room still receives:
  - `chat_message`
- [ ] Verify legacy presence still works on:
  - `presence-site-wide-chat-channel`
- [ ] Verify legacy private room open event still works:
  - `private_chat`
- [ ] Verify legacy private room close event still works:
  - `destroy_private_chat`
- [ ] Verify no duplicate subscriptions are introduced by the bridge.
- [ ] Verify no duplicate public message delivery occurs.

Completion criteria:

- legacy public chat still works without UI rewrite
- legacy DMs still open against the new backend

### Phase 5. Persistence and unread state

- [ ] Add room list endpoint with unread counts.
- [ ] Add message pagination endpoint.
- [ ] Add last-read marker update endpoint.
- [ ] Add backend unread calculation or cache.
- [ ] Reflect unread counts in SpeakApp community UI.

Completion criteria:

- community chat survives reload/reconnect
- unread counts are correct enough for production use

### Phase 6. Hardening

- [ ] Rate limit message send endpoints.
- [ ] Add moderation hooks for public chat.
- [ ] Add block/ignore behavior in canonical backend model.
- [ ] Ensure premium gating is enforced server-side.
- [ ] Add observability:
  - message volume
  - active public users
  - active DM rooms
  - auth failures
  - delivery errors

Completion criteria:

- backend is safe to expose publicly
- moderation and limits are enforceable

## Execution Order Recommendation

Recommended order:

1. Backend public room + bridge
2. SpeakApp `Community > Public`
3. Backend DMs + bridge
4. SpeakApp `Community > Chats`
5. Unread/persistence hardening

This order minimizes moving parts and gives an early end-to-end result.

## Minimal First Release

If scope needs to stay tight, the minimal production-compatible shared chat is:

- public room only
- shared presence only
- backend persistence for public messages
- SpeakApp community public UI
- legacy bridge for `chat_message`

DM compatibility can then ship in a second increment.
