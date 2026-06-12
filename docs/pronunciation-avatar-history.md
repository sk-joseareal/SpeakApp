# Pronunciation avatar history

This note records the pronunciation-avatar variants that used to exist before the
app was simplified to the current `Video` mode.

## Removed modes

The Diagnostics screen used to expose a local setting stored under
`appv5:speak-pronunciation-avatar-mode` with these values:

- `video`
- `set2`
- `new`
- `old`
- `visemes-real`
- `visemes-v2`
- `visemes-v1`

Each option selected a different visual treatment for the `sound` step in `Speak`.

## What each mode did

- `video`: played the session MP4 and poster frame.
- `old`: rendered the original avatar with simple mouth PNGs.
- `new`: rendered the newer face asset with viseme overlays.
- `set2`: rendered the alternate face/mouth set.
- `visemes-real`: rendered the real-photo viseme set.
- `visemes-v2`: rendered the second PNG viseme set.
- `visemes-v1`: rendered the first PNG viseme set.

## Asset families that were associated with the old modes

- `www/assets/speak/avatar`
- `www/assets/speak/avatar-chica`
- `www/assets/speak/set-bocas-2`
- `www/assets/speak/visemes-real`
- `www/assets/speak/visemes-v1`
- `www/assets/speak/visemes-v2`
- `www/assets/speak/mfa/visemes`

## Important distinction

The removed avatar modes were only the visual layer. At the time, the `MFA` bundle
was a separate asset family used by the training playback flow for aligned audio,
word timings and syllables. That bundle was not the same thing as the avatar-mode
selector.

## If this ever needs to come back

A reimplementation would need:

1. the Diagnostics selector again;
2. the persisted mode key and change event;
3. the branching logic in `speakapp/www/js/pages/speak.js`;
4. the corresponding asset sets above;
5. the viseme-generation step in the bundle pipeline if visemes are part of the chosen mode.

At the moment, only `Video` is supported.
