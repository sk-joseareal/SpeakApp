#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/sync-training-data-from-content.sh [options]

Options:
  --base-url URL         Content service base URL.
                         Default: https://content.curso-ingles.com
  --token TOKEN          Read token for /content/training-data
                         Default: CONTENT_READ_TOKEN, CONTENT_TRAINING_DATA_TOKEN or token from www/index.html
  --json PATH            Local training-data.json path
                         Default: www/js/data/training-data.json
  --meta PATH            Local training-data.meta.js path
                         Default: www/js/data/training-data.meta.js
  --help                 Show this help

Environment variables:
  CONTENT_BASE_URL
  CONTENT_READ_TOKEN
  CONTENT_TRAINING_DATA_TOKEN
  CONTENT_JSON_PATH
  CONTENT_META_PATH
EOF
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

json_read_field() {
  # Args: file path.dot.notation
  node - "$1" "$2" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const pathExpr = process.argv[3];
const raw = fs.readFileSync(file, 'utf8');
let data;
try {
  data = JSON.parse(raw);
} catch (err) {
  process.exit(2);
}
const parts = String(pathExpr || '').split('.').filter(Boolean);
let cur = data;
for (const p of parts) {
  if (cur === null || cur === undefined || typeof cur !== 'object' || !(p in cur)) {
    process.exit(3);
  }
  cur = cur[p];
}
if (cur === null || cur === undefined) process.exit(4);
if (typeof cur === 'object') {
  process.stdout.write(JSON.stringify(cur));
} else {
  process.stdout.write(String(cur));
}
NODE
}

extract_token_from_index() {
  local index_html="$1"
  if [[ ! -f "$index_html" ]]; then
    return 0
  fi
  node - "$index_html" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const raw = fs.readFileSync(file, 'utf8');
const match = String(raw || '').match(/window\.CONTENT_TRAINING_DATA_TOKEN\s*=\s*['"]([^'"]+)['"]/);
if (match && match[1]) {
  process.stdout.write(match[1]);
}
NODE
}

extract_version_from_meta() {
  local meta_file="$1"
  if [[ ! -f "$meta_file" ]]; then
    return 0
  fi
  node - "$meta_file" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const raw = fs.readFileSync(file, 'utf8');
const match = String(raw || '').match(/BUNDLE_TRAINING_DATA_VERSION\s*=\s*["'`](sha256-[^"'`]+)["'`]/);
if (match && match[1]) {
  process.stdout.write(match[1]);
}
NODE
}

http_get() {
  # Args: url response_file [token]
  local url="$1"
  local response_file="$2"
  local token="${3:-}"

  local -a cmd=(
    curl -sS -o "$response_file" -w "%{http_code}" -X GET "$url"
    -H "Accept: application/json"
  )
  if [[ -n "$token" ]]; then
    cmd+=(-H "x-content-read-token: $token")
  fi
  "${cmd[@]}"
}

BASE_URL="${CONTENT_BASE_URL:-https://content.curso-ingles.com}"
READ_TOKEN="${CONTENT_READ_TOKEN:-${CONTENT_TRAINING_DATA_TOKEN:-}}"
JSON_PATH="${CONTENT_JSON_PATH:-www/js/data/training-data.json}"
META_PATH="${CONTENT_META_PATH:-www/js/data/training-data.meta.js}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url)
      BASE_URL="${2:-}"
      shift 2
      ;;
    --token)
      READ_TOKEN="${2:-}"
      shift 2
      ;;
    --json)
      JSON_PATH="${2:-}"
      shift 2
      ;;
    --meta)
      META_PATH="${2:-}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

need_cmd curl
need_cmd node

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
INDEX_HTML="$REPO_ROOT/www/index.html"
LOCAL_JSON="$REPO_ROOT/$JSON_PATH"
LOCAL_META="$REPO_ROOT/$META_PATH"

if [[ -z "$READ_TOKEN" ]]; then
  READ_TOKEN="$(extract_token_from_index "$INDEX_HTML")"
fi

if [[ ! -f "$LOCAL_JSON" ]]; then
  echo "Local JSON file not found: $LOCAL_JSON" >&2
  exit 1
fi

BASE_URL="${BASE_URL%/}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

LOCAL_VERSION=""
if [[ -f "$LOCAL_META" ]]; then
  LOCAL_VERSION="$(extract_version_from_meta "$LOCAL_META" || true)"
fi

META_RESP="$TMP_DIR/meta.json"
DATA_RESP="$TMP_DIR/data.json"
LOCAL_TMP="$TMP_DIR/training-data.json"

echo "1/2 Check version: $BASE_URL/content/training-data/meta"
META_STATUS="$(http_get "$BASE_URL/content/training-data/meta" "$META_RESP" "$READ_TOKEN")"
if [[ "$META_STATUS" != "200" ]]; then
  echo "Version check failed (HTTP $META_STATUS)." >&2
  cat "$META_RESP" >&2 || true
  exit 1
fi

REMOTE_VERSION="$(json_read_field "$META_RESP" version || true)"
if [[ -z "$REMOTE_VERSION" ]]; then
  echo "Remote version is missing." >&2
  cat "$META_RESP" >&2 || true
  exit 1
fi

REMOTE_RELEASE_ID="$(json_read_field "$META_RESP" release.id || true)"
REMOTE_RELEASE_NAME="$(json_read_field "$META_RESP" release.name || true)"
REMOTE_RELEASE_SOURCE="$(json_read_field "$META_RESP" release.source || true)"

echo "   Remote version: $REMOTE_VERSION"
if [[ -n "$REMOTE_RELEASE_ID" || -n "$REMOTE_RELEASE_NAME" || -n "$REMOTE_RELEASE_SOURCE" ]]; then
  echo "   Remote release: id=${REMOTE_RELEASE_ID:-n/a} name=${REMOTE_RELEASE_NAME:-n/a} source=${REMOTE_RELEASE_SOURCE:-n/a}"
fi
echo "   Local bundle version: ${LOCAL_VERSION:-n/a}"

NEED_JSON_DOWNLOAD=1
if [[ -n "$LOCAL_VERSION" && "$LOCAL_VERSION" == "$REMOTE_VERSION" ]]; then
  NEED_JSON_DOWNLOAD=0
  echo "   JSON already up to date: $REMOTE_VERSION"
fi

if [[ "$NEED_JSON_DOWNLOAD" == "1" ]]; then
  echo "2/2 Download published content: $BASE_URL/content/training-data"
  DATA_STATUS="$(http_get "$BASE_URL/content/training-data" "$DATA_RESP" "$READ_TOKEN")"
  if [[ "$DATA_STATUS" != "200" ]]; then
    echo "Download failed (HTTP $DATA_STATUS)." >&2
    cat "$DATA_RESP" >&2 || true
    exit 1
  fi

  node - "$DATA_RESP" "$LOCAL_TMP" <<'NODE'
const fs = require('fs');
const responseFile = process.argv[2];
const outputFile = process.argv[3];
const raw = fs.readFileSync(responseFile, 'utf8');
const parsed = JSON.parse(raw);
if (!parsed || typeof parsed !== 'object' || !parsed.data || typeof parsed.data !== 'object') {
  throw new Error('training data payload is invalid');
}
fs.writeFileSync(outputFile, JSON.stringify(parsed.data, null, 2) + '\n', 'utf8');
NODE

  mv "$LOCAL_TMP" "$LOCAL_JSON"
  (
    cd "$REPO_ROOT"
    npm run sync:training-data-meta
  )
  LOCAL_VERSION="$(extract_version_from_meta "$LOCAL_META" || true)"
fi

echo "3/5 Build app-copy narration audio bundle"
(
  cd "$REPO_ROOT"
  npm run sync:app-copy-audio
)

echo "4/5 Build speak session audio bundle"
(
  cd "$REPO_ROOT"
  npm run sync:speak-session-audio
)

echo "5/5 Build speak video bundle"
(
  cd "$REPO_ROOT"
  npm run sync:speak-videos
)

if [[ "$NEED_JSON_DOWNLOAD" == "0" ]]; then
  echo "   Already up to date: $REMOTE_VERSION"
else
  echo "   Synced: $REMOTE_VERSION"
  echo "   Local bundle version after sync: ${LOCAL_VERSION:-n/a}"
  if [[ -n "$LOCAL_VERSION" && "$LOCAL_VERSION" != "$REMOTE_VERSION" ]]; then
    echo "   WARNING: local bundle version does not match remote version" >&2
  fi
fi
