#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/publish-content.sh [options]

Options:
  --base-url URL         Content service base URL.
                         Default: https://content.speakapp.curso-ingles.com
  --email EMAIL          Editor email (or env CONTENT_EDITOR_EMAIL)
  --password PASS        Editor password (or env CONTENT_EDITOR_PASSWORD)
  --json PATH            training-data.json path
                         Default: www/js/data/training-data.json
  --release-name NAME    Release name for publish
                         Default: release-YYYYMMDD-HHMMSS
  --no-publish           Only save draft, do not publish
  --no-lock              Do not claim draft lock before save
  --help                 Show this help

Environment variables:
  CONTENT_BASE_URL
  CONTENT_EDITOR_EMAIL
  CONTENT_EDITOR_PASSWORD
  CONTENT_JSON_PATH
  CONTENT_RELEASE_NAME
EOF
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

json_stringify_obj() {
  # Args: key1 value1 key2 value2 ...
  node - "$@" <<'NODE'
const args = process.argv.slice(2);
const out = {};
for (let i = 0; i < args.length; i += 2) {
  const key = String(args[i] || '');
  const value = args[i + 1];
  out[key] = value === undefined ? '' : value;
}
process.stdout.write(JSON.stringify(out));
NODE
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

http_status() {
  # Args: method url response_file [auth_token] [body_file] [content_type]
  local method="$1"
  local url="$2"
  local response_file="$3"
  local auth_token="${4:-}"
  local body_file="${5:-}"
  local content_type="${6:-application/json}"

  local -a cmd=(
    curl -sS -o "$response_file" -w "%{http_code}" -X "$method" "$url"
    -H "Accept: application/json"
  )
  if [[ -n "$auth_token" ]]; then
    cmd+=(-H "Authorization: Bearer $auth_token")
  fi
  if [[ -n "$body_file" ]]; then
    cmd+=(-H "Content-Type: $content_type" --data-binary "@$body_file")
  fi
  "${cmd[@]}"
}

BASE_URL="${CONTENT_BASE_URL:-https://content.speakapp.curso-ingles.com}"
EMAIL="${CONTENT_EDITOR_EMAIL:-}"
PASSWORD="${CONTENT_EDITOR_PASSWORD:-}"
JSON_PATH="${CONTENT_JSON_PATH:-www/js/data/training-data.json}"
RELEASE_NAME="${CONTENT_RELEASE_NAME:-release-$(date +%Y%m%d-%H%M%S)}"
DO_PUBLISH=1
DO_LOCK=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url)
      BASE_URL="${2:-}"
      shift 2
      ;;
    --email)
      EMAIL="${2:-}"
      shift 2
      ;;
    --password)
      PASSWORD="${2:-}"
      shift 2
      ;;
    --json)
      JSON_PATH="${2:-}"
      shift 2
      ;;
    --release-name)
      RELEASE_NAME="${2:-}"
      shift 2
      ;;
    --no-publish)
      DO_PUBLISH=0
      shift
      ;;
    --no-lock)
      DO_LOCK=0
      shift
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

if [[ -z "$EMAIL" ]]; then
  echo "Missing editor email. Use --email or CONTENT_EDITOR_EMAIL." >&2
  exit 1
fi
if [[ -z "$PASSWORD" ]]; then
  echo "Missing editor password. Use --password or CONTENT_EDITOR_PASSWORD." >&2
  exit 1
fi
if [[ ! -f "$JSON_PATH" ]]; then
  echo "JSON file not found: $JSON_PATH" >&2
  exit 1
fi

# Validate JSON before sending
node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))" "$JSON_PATH" >/dev/null

BASE_URL="${BASE_URL%/}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

LOGIN_BODY="$TMP_DIR/login.json"
LOGIN_RESP="$TMP_DIR/login-response.json"
LOCK_BODY="$TMP_DIR/lock.json"
LOCK_RESP="$TMP_DIR/lock-response.json"
SAVE_RESP="$TMP_DIR/save-response.json"
PUBLISH_BODY="$TMP_DIR/publish.json"
PUBLISH_RESP="$TMP_DIR/publish-response.json"

json_stringify_obj email "$EMAIL" password "$PASSWORD" >"$LOGIN_BODY"

echo "1/4 Login: $BASE_URL/content/admin/login"
LOGIN_STATUS="$(http_status POST "$BASE_URL/content/admin/login" "$LOGIN_RESP" "" "$LOGIN_BODY")"
if [[ "$LOGIN_STATUS" != "200" ]]; then
  echo "Login failed (HTTP $LOGIN_STATUS)." >&2
  cat "$LOGIN_RESP" >&2 || true
  exit 1
fi

TOKEN="$(json_read_field "$LOGIN_RESP" token || true)"
if [[ -z "$TOKEN" ]]; then
  echo "Login response has no token." >&2
  cat "$LOGIN_RESP" >&2 || true
  exit 1
fi
ROLE="$(json_read_field "$LOGIN_RESP" editor.role || true)"
echo "   Logged as: $EMAIL (role: ${ROLE:-unknown})"

if [[ "$DO_LOCK" -eq 1 ]]; then
  echo "{}" >"$LOCK_BODY"
  echo "2/4 Claim lock: $BASE_URL/content/admin/draft-lock/claim"
  LOCK_STATUS="$(http_status POST "$BASE_URL/content/admin/draft-lock/claim" "$LOCK_RESP" "$TOKEN" "$LOCK_BODY")"
  if [[ "$LOCK_STATUS" != "200" ]]; then
    echo "Lock claim failed (HTTP $LOCK_STATUS)." >&2
    cat "$LOCK_RESP" >&2 || true
    exit 1
  fi
  echo "   Lock claimed."
else
  echo "2/4 Lock skipped (--no-lock)."
fi

echo "3/4 Save draft: $BASE_URL/content/admin/training-data"
SAVE_STATUS="$(http_status PUT "$BASE_URL/content/admin/training-data" "$SAVE_RESP" "$TOKEN" "$JSON_PATH")"
if [[ "$SAVE_STATUS" != "200" ]]; then
  echo "Save draft failed (HTTP $SAVE_STATUS)." >&2
  cat "$SAVE_RESP" >&2 || true
  exit 1
fi
echo "   Draft saved."

if [[ "$DO_PUBLISH" -eq 1 ]]; then
  json_stringify_obj name "$RELEASE_NAME" >"$PUBLISH_BODY"
  echo "4/4 Publish: $BASE_URL/content/admin/publish (name: $RELEASE_NAME)"
  PUBLISH_STATUS="$(http_status POST "$BASE_URL/content/admin/publish" "$PUBLISH_RESP" "$TOKEN" "$PUBLISH_BODY")"
  if [[ "$PUBLISH_STATUS" != "200" ]]; then
    echo "Publish failed (HTTP $PUBLISH_STATUS)." >&2
    cat "$PUBLISH_RESP" >&2 || true
    exit 1
  fi
  RELEASE_ID="$(json_read_field "$PUBLISH_RESP" release.id || true)"
  echo "   Published release id: ${RELEASE_ID:-unknown}"
else
  echo "4/4 Publish skipped (--no-publish)."
fi

echo "Done."
