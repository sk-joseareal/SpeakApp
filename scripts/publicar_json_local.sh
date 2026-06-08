#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$SCRIPT_DIR/sync-training-data-from-content.sh" \
  --base-url "https://content.curso-ingles.com" \
  --json "www/js/data/training-data.json" \
  --meta "www/js/data/training-data.meta.js"
