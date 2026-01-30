#!/bin/bash

# Ruta absoluta al directorio donde está este script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd $SCRIPT_DIR

node "fcm.js" \
  --token dh2II-CKs02TmSC0K8okXv:APA91bGkJOOhrMTP1C9c5naUbmbMJELsdy5wUTfmiHxuxkcorW6u1a7hlGZgEs09qCh28tBtO6APt-XbQQUstVpxleSJruQS824QQ5uqZGFh4AV6tawA5M0 \
  --title "Test automático" \
  --body "Esta notificación se ha enviado desde el backend" \
  --delay 5

# SpeakApp Android
#  --token cRIyIeQzRxurSLQ-v6K3hn:APA91bF6JE23WXW2avIQIIUS_VfX8foBrlHnAdossBpOj6QSUleYbWGl5l12cqdg8usU4qif_DN5KlxYfq4XUaznVUpJ6wU5faCCMbhNKUSvLpD89226sUE \
# SpeakApp iOS
#  --token dh2II-CKs02TmSC0K8okXv:APA91bGkJOOhrMTP1C9c5naUbmbMJELsdy5wUTfmiHxuxkcorW6u1a7hlGZgEs09qCh28tBtO6APt-XbQQUstVpxleSJruQS824QQ5uqZGFh4AV6tawA5M0 \


# curso-ingles.com
#  --token deWo3jp4FUEroieeHO6AO9:APA91bFd2Y5Im8qtYR39TOlmMScy0XfMDjeYcVVi7jrpdkc6lc5hrMSUJ8yl9ERWdTP5ZjLTwYNpw3n8l0b_iwzU8GjTGo_nxBuWlCdLLybrfW3-bwSOs6E \
 