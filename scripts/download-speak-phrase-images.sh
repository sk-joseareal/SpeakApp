#!/bin/bash

set -euo pipefail

BUCKET="${SPEAK_SENTENCE_IMAGES_BUCKET:-sk.assets}"
PREFIX="${SPEAK_SENTENCE_IMAGES_PREFIX:-speakapp/sentence-images}"
DEST_DIR="${1:-./phrase_images}"

if ! command -v aws >/dev/null 2>&1; then
  echo "Missing required command: aws" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"

aws s3 cp "s3://$BUCKET/$PREFIX/" "$DEST_DIR/" \
  --recursive \
  --exclude "*" \
  --include "session-*.webp" \
  --only-show-errors

downloaded_count="$(find "$DEST_DIR" -maxdepth 1 -type f -name 'session-*.webp' | wc -l | tr -d ' ')"
echo "Downloaded $downloaded_count sentence images to $DEST_DIR"
