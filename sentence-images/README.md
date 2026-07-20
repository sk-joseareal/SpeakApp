# Session sentence images

Source images for the third screen of Speak sessions.

- Name each file with its session ID: `session-N.webp`, `.png`, `.jpg` or `.jpeg`.
- Run `npm run upload:speak-sentence-images` to upload every image in this directory.
- Pass explicit paths after `--` to upload only selected images.
- The upload command converts non-WebP images and publishes them under
  `s3://sk.assets/speakapp/sentence-images/`.
