#!/bin/bash

set -euo pipefail

SOURCE_IMAGE="${1:-www/assets/mascot/nena_trimmed.png}"

IOS_SPLASH_DIRS=(
  "ios/App/App/Assets.xcassets/Splash.imageset"
  "SpeakApp native/SpeakAppNative/Resources/Assets.xcassets/Splash.imageset"
)

ANDROID_RES_DIR="android/app/src/main/res"

LIGHT_TOP="#A7C6F7"
LIGHT_BOTTOM="#EEF3FF"
DARK_TOP="#8FB4F2"
DARK_BOTTOM="#DCE8FF"

require_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required tool: $1" >&2
    exit 1
  fi
}

require_tool magick

if [[ ! -f "$SOURCE_IMAGE" ]]; then
  echo "Source image not found: $SOURCE_IMAGE" >&2
  exit 1
fi

render_full_splash() {
  local target="$1"
  local width="$2"
  local height="$3"
  local theme="$4"
  local top_color="$LIGHT_TOP"
  local bottom_color="$LIGHT_BOTTOM"
  local max_w max_h geometry gravity

  if [[ "$theme" == "dark" ]]; then
    top_color="$DARK_TOP"
    bottom_color="$DARK_BOTTOM"
  fi

  if (( width == height )); then
    max_w=$(( width * 52 / 100 ))
    max_h=$(( height * 52 / 100 ))
    gravity="center"
    geometry="+0+60"
  elif (( width < height )); then
    max_w=$(( width * 68 / 100 ))
    max_h=$(( height * 54 / 100 ))
    gravity="south"
    geometry="+0+$(( height * 8 / 100 ))"
  else
    max_w=$(( width * 33 / 100 ))
    max_h=$(( height * 76 / 100 ))
    gravity="south"
    geometry="+0+$(( height * 7 / 100 ))"
  fi

  magick \
    -size "${width}x${height}" "gradient:${top_color}-${bottom_color}" \
    \( "$SOURCE_IMAGE" -resize "${max_w}x${max_h}>" \) \
    -gravity "$gravity" -geometry "$geometry" -composite \
    "$target"
}

render_icon() {
  local target="$1"
  local width="$2"
  local height="$3"
  local max_w=$(( width * 78 / 100 ))
  local max_h=$(( height * 78 / 100 ))

  magick \
    -size "${width}x${height}" xc:none \
    \( "$SOURCE_IMAGE" -resize "${max_w}x${max_h}>" \) \
    -gravity center -composite \
    "$target"
}

generate_ios_assets() {
  local dir file width height theme
  for dir in "${IOS_SPLASH_DIRS[@]}"; do
    [[ -d "$dir" ]] || continue
    while IFS= read -r file; do
      width="$(magick identify -format '%w' "$file")"
      height="$(magick identify -format '%h' "$file")"
      theme="light"
      if [[ "$file" == *"-dark.png" ]]; then
        theme="dark"
      fi
      render_full_splash "$file" "$width" "$height" "$theme"
      echo "Updated $file (${width}x${height}, ${theme})"
    done < <(find "$dir" -maxdepth 1 -type f -name '*.png' | sort)
  done
}

generate_android_assets() {
  local file width height theme

  while IFS= read -r file; do
    width="$(magick identify -format '%w' "$file")"
    height="$(magick identify -format '%h' "$file")"
    theme="light"
    if [[ "$file" == *"/drawable-night/"* || "$file" == *"/drawable-port-night-"* || "$file" == *"/drawable-land-night-"* ]]; then
      theme="dark"
    fi
    render_full_splash "$file" "$width" "$height" "$theme"
    echo "Updated $file (${width}x${height}, ${theme})"
  done < <(find "$ANDROID_RES_DIR" -type f -name 'splash.png' | sort)

  while IFS= read -r file; do
    width="$(magick identify -format '%w' "$file")"
    height="$(magick identify -format '%h' "$file")"
    render_icon "$file" "$width" "$height"
    echo "Updated $file (${width}x${height}, icon)"
  done < <(find "$ANDROID_RES_DIR" -type f -name 'splash_icon.png' | sort)
}

generate_ios_assets
generate_android_assets

echo "Splash assets regenerated from $SOURCE_IMAGE"
