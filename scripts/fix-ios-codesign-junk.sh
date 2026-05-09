#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DERIVED_DATA_ROOT="$APP_ROOT/ios/DerivedData"

find_latest_products_dir() {
  local latest=""
  local latest_mtime=0
  while IFS= read -r -d '' candidate; do
    local mtime
    mtime="$(stat -f '%m' "$candidate")"
    if [ "$mtime" -gt "$latest_mtime" ]; then
      latest="$candidate"
      latest_mtime="$mtime"
    fi
  done < <(find "$DERIVED_DATA_ROOT" -path '*/Build/Products' -type d -print0 2>/dev/null)

  if [ -n "$latest" ]; then
    printf '%s\n' "$latest"
  fi
}

delete_ds_store() {
  local target="$1"
  if [ -d "$target" ]; then
    find "$target" -name '.DS_Store' -delete 2>/dev/null || true
  fi
}

drop_attr_if_present() {
  local attr="$1"
  local target="$2"
  if xattr "$target" 2>/dev/null | grep -Fxq "$attr"; then
    xattr -d "$attr" "$target" 2>/dev/null || true
  fi
}

if [ ! -d "$DERIVED_DATA_ROOT" ]; then
  echo "No existe $DERIVED_DATA_ROOT"
  exit 1
fi

PRODUCTS_DIR="$(find_latest_products_dir)"

if [ -z "$PRODUCTS_DIR" ]; then
  echo "No he encontrado ningun Build/Products en $DERIVED_DATA_ROOT"
  exit 1
fi

delete_ds_store "$APP_ROOT/www"
delete_ds_store "$APP_ROOT/ios/App/App"
delete_ds_store "$PRODUCTS_DIR"

clean_target() {
  local target="$1"
  drop_attr_if_present "com.apple.FinderInfo" "$target"
  drop_attr_if_present "com.apple.fileprovider.fpfs#P" "$target"
  echo "Limpiado: $target"
}

cleaned_any=0
while IFS= read -r -d '' target; do
  clean_target "$target"
  cleaned_any=1
done < <(find "$PRODUCTS_DIR" \( -name 'App.app' -o -name '*.framework' \) -type d -print0 2>/dev/null)

if [ "$cleaned_any" -eq 0 ]; then
  echo "No he encontrado bundles a limpiar en $PRODUCTS_DIR"
  exit 1
fi

echo "Directorio de productos limpiado: $PRODUCTS_DIR"
