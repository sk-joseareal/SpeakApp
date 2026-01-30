#!/bin/bash

# Ruta absoluta al directorio donde está este script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd $SCRIPT_DIR

node "apns.js" \
  --token b245635321b17b50d5e87261623cf21f1462220f42b4cddda1445fbaab6d8875 \
  --title "Test automático" \
  --body "Esta notificación se ha enviado desde el backend" \
  --delay 5

# APNs id de curso-ingles
#  --token e9aa7dbd501e0bd7d90389ee6584d1a704516cbb5e2879928d935aac495be0f9 \
 