# Realtime Monitor Guide

This page is the internal console for realtime supervision and community moderation.

Primary UI:

- `www/realtime/index.html`

Primary backend endpoints:

- `realtime/node/server.js`

## Access

Open the monitor page and use a valid `monitor token`.

The token is sent as:

- `x-monitor-token`

Without that token, the supervision and moderation endpoints return `403`.

## Main areas

The page is split into these blocks:

1. `Connection`
2. `Send / Subscribe`
3. `Channels`
4. `Community Monitor`
5. `Community Presence`
6. `Push Devices`
7. `Community Messages`
8. `Moderation`
9. `User Inspector`
10. `Community Audit`
11. `Log`

## Connection

Use this block to connect manually to the realtime transport.

Useful fields:

- `App key`
- `WS host`
- `WSS port`
- `Force TLS`
- `Auth endpoint`
- `User id`
- `User name`

Typical use:

1. Fill the websocket settings.
2. If you want to subscribe to a private or presence channel, also fill `User id`.
3. Click `Connect`.

This section is for transport testing. It is not the main moderation tool.

## Send / Subscribe

Use this section to subscribe manually to a channel and inspect live events.

Typical uses:

1. Subscribe to `site-wide-chat-channel` and watch `chat_message`.
2. Subscribe to `private-<a>_<b>` if you need to inspect a DM.
3. Subscribe to `private-community-user-<userId>` to inspect DM inbox notifications.

## Channels

This reads `/realtime/channels` and lists active realtime channels.

Useful for:

- checking that expected channels exist
- seeing whether DMs are active
- verifying that presence/private channels are being created

## Community Monitor

This is the main filter bar for community supervision.

Available filters:

- `User id`
- `UUID`
- `Room id`
- `Room type`
- `Text`
- `Audit type`
- `Limit`

Buttons:

- `Presence`
- `Push devices`
- `Messages`
- `Audit`
- `Inspect user`
- `Refresh all`

Typical use:

1. Set `User id`.
2. Click `Inspect user`.
3. Optionally refine with `Room id`, `Text`, or `UUID`.

## Community Presence

Shows active users from the community presence store.

Typical fields:

- `user_id`
- `name`
- `sessions`
- `active room`
- `UUID`
- `IP`

Use it to answer:

- Who is online right now?
- From how many devices?
- In which room are they active?

## Push Devices

Shows registered push destinations by user/device.

Typical fields:

- `user_id`
- `uuid`
- `platform`
- `token_type`
- `destination`
- `last_ip`
- `updated_at`

Use it to answer:

- Does this user have a valid push registration?
- Is the user on iOS, Android, or both?
- How many devices are registered?

## Community Messages

Lists stored community messages from:

- `public`
- `dm`

Typical fields:

- timestamp
- room type
- room id
- actor
- text
- delivered timestamp for DMs
- UUID
- IP

Actions:

- `Delete`

Delete is a soft delete:

- the message is not physically removed from storage
- text is replaced with `Message removed by moderator.`
- moderation metadata is stored

Use this for:

- removing abusive content
- checking who sent a message
- tracing a message to a user/device/IP

## Moderation

This block manages per-user moderation rules.

Statuses:

1. `active`
2. `muted`
3. `suspended`

Semantics:

- `active`
  - no moderation rule
- `muted`
  - user can still access community
  - user cannot send messages
- `suspended`
  - user is blocked from community access paths
  - user is removed from stored presence

Fields:

- `User id`
- `Status`
- `Until`
- `Reason`
- `Note`
- `Updated by`

Buttons:

- `Load`
- `Save`
- `Clear`

Quick actions:

- `Mute 1h`
- `Mute 24h`
- `Suspend 1h`
- `Suspend 24h`
- `Clear`

Typical moderation flow:

1. Set `User id`.
2. Choose `muted` or `suspended`.
3. Set `Until` if needed.
4. Add `Reason`.
5. Click `Save`.

## User Inspector

This is the fastest way to inspect a single user operationally.

It aggregates:

- current moderation status
- sessions
- push devices
- IPs
- recent rooms
- recent messages
- recent audit events

It also exposes quick moderation actions directly in the inspector.

Recommended use:

1. Set `User id` in `Community Monitor`.
2. Click `Inspect user`.
3. Review sessions, IPs, and devices.
4. Apply a quick action if moderation is needed.

## Community Audit

Shows recent audit events from `audit.jsonl`.

Typical event types:

- `auth`
- `push_register`
- `presence_heartbeat`
- `presence_leave`
- `message_public`
- `message_dm`
- `message_dm_delivered`
- `message_blocked`
- `community_access_blocked`
- `moderation_update`
- `message_deleted`

Use this to reconstruct:

- when a user connected
- from which IP/device
- what action was blocked
- who changed moderation

## Common workflows

### Inspect a suspicious user

1. Set `User id`.
2. Click `Inspect user`.
3. Review:
   - sessions
   - push devices
   - IPs
   - recent messages
   - audit trail

### Mute a spammer

1. Inspect the user.
2. Click `Mute 1h` or `Mute 24h`.
3. Check `Community Audit` for `moderation_update`.

### Suspend a user

1. Inspect the user.
2. Click `Suspend 1h` or `Suspend 24h`.
3. Verify:
   - the rule appears in `Moderation`
   - the user disappears from `Community Presence`
   - audit shows `moderation_update`

### Remove an abusive message

1. Filter `Community Messages` by `User id`, `Room id`, or `Text`.
2. Click `Delete`.
3. Confirm the message now appears as deleted.
4. Check `Community Audit` for `message_deleted`.

## Limitations

These are intentional or structural:

1. `Delete` is soft delete only.
2. `muted` blocks send, not read.
3. `suspended` blocks the app through backend APIs and auth paths, but the public room transport is still structurally a public realtime channel.
4. To make suspension absolutely strict at the transport layer, the public community channel would need to become authenticated/private.

## Data sources

Current monitor data is backed by files under:

- `realtime/node/data/rt/community/presence.json`
- `realtime/node/data/rt/community/push-tokens.json`
- `realtime/node/data/rt/community/audit.jsonl`
- `realtime/node/data/rt/community/moderation.json`

Those files are runtime state. Do not edit them manually unless you know exactly why.
