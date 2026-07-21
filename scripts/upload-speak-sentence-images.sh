#!/bin/bash

set -euo pipefail

BUCKET="${SPEAK_SENTENCE_IMAGES_BUCKET:-sk.assets}"
PREFIX="${SPEAK_SENTENCE_IMAGES_PREFIX:-speakapp/sentence-images}"
SOURCE_DIR="${SPEAK_SENTENCE_IMAGES_SOURCE_DIR:-sentence-images}"
QUALITY="${SPEAK_SENTENCE_IMAGES_QUALITY:-82}"
CACHE_CONTROL="${SPEAK_SENTENCE_IMAGES_CACHE_CONTROL:-public, max-age=3600, stale-while-revalidate=86400}"

if [[ "$#" -eq 0 ]]; then
  default_sources=()
  for source_path in \
    "$SOURCE_DIR"/[0-9]*.webp \
    "$SOURCE_DIR"/[0-9]*.png \
    "$SOURCE_DIR"/[0-9]*.jpg \
    "$SOURCE_DIR"/[0-9]*.jpeg \
    "$SOURCE_DIR"/session-*.webp \
    "$SOURCE_DIR"/session-*.png \
    "$SOURCE_DIR"/session-*.jpg \
    "$SOURCE_DIR"/session-*.jpeg; do
    if [[ -f "$source_path" ]]; then
      default_sources+=("$source_path")
    fi
  done
  set -- "${default_sources[@]}"
fi

if [[ "$#" -eq 0 ]]; then
  echo "No session images found in $SOURCE_DIR" >&2
  echo "Usage: npm run upload:speak-sentence-images -- [path/to/session-1.png ...]" >&2
  exit 2
fi

for command_name in cwebp aws; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
done

temporary_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$temporary_dir"
}
trap cleanup EXIT

for source_path in "$@"; do
  if [[ ! -f "$source_path" ]]; then
    echo "Image not found: $source_path" >&2
    exit 1
  fi

  file_name="$(basename "$source_path")"
  session_id="${file_name%.*}"
  if [[ "$session_id" =~ ^session-([0-9]+)$ ]]; then
    session_id="${BASH_REMATCH[1]}"
  elif [[ "$session_id" =~ ^[0-9]+$ ]]; then
    session_id="$session_id"
  else
    echo "Invalid image name: $file_name (expected N.png/jpg/webp or session-N.png/jpg/webp)" >&2
    exit 1
  fi

  output_path="$temporary_dir/session-$session_id.webp"
  extension="${file_name##*.}"
  case "$extension" in
    webp|WEBP|WebP)
      cp "$source_path" "$output_path"
      ;;
    *)
      cwebp -quiet -q "$QUALITY" -m 6 -metadata none "$source_path" -o "$output_path"
      ;;
  esac

  object_key="$PREFIX/session-$session_id.webp"
  aws s3 cp "$output_path" "s3://$BUCKET/$object_key" \
    --only-show-errors \
    --content-type "image/webp" \
    --cache-control "$CACHE_CONTROL"

  source_size="$(wc -c < "$source_path" | tr -d ' ')"
  output_size="$(wc -c < "$output_path" | tr -d ' ')"
  echo "session-$session_id: $source_size -> $output_size bytes"
  echo "https://s3.amazonaws.com/$BUCKET/$object_key"
done
