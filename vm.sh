#!/bin/bash

set -u

REMOTE_USER="r34lp0w3r"
REMOTE_HOST="tmbp.local"
REMOTE_PASS='m4r4n3ll0'
APK_LOCAL="android/app/build/outputs/apk/debug/app-debug.apk"
APK_REMOTE="~/app-debug.apk"
PACKAGE_NAME="com.sokinternet.cursoingles"
SSH_OPTS="-o PubkeyAuthentication=no -o PreferredAuthentications=password"

run_step() {
  STEP_NAME="$1"
  shift

  echo ""
  echo "➡️  $STEP_NAME"

  "$@"
  EXIT_CODE=$?

  if [ $EXIT_CODE -ne 0 ]; then
    echo "❌ ERROR en: $STEP_NAME (código $EXIT_CODE)"
    exit $EXIT_CODE
  fi

  echo "✅ OK: $STEP_NAME"
  
  # read -p "Esperando pulsación para continuar." -n1 -s
}

run_step "Capacitor sync" npx cap sync

run_step "Gradle assembleDebug" bash -c "
  cd android && ./gradlew :app:assembleDebug
"

run_step "Copiar APK al Mac" sshpass -p "$REMOTE_PASS" \
  scp "$APK_LOCAL" "$REMOTE_USER@$REMOTE_HOST:$APK_REMOTE"
  
run_step "Eliminar app anterior" sshpass -p "$REMOTE_PASS" \
  ssh $SSH_OPTS "$REMOTE_USER@$REMOTE_HOST" \
  "~/Library/Android/sdk/platform-tools/adb uninstall $PACKAGE_NAME || true"

run_step "Instalar APK por ADB remoto" sshpass -p "$REMOTE_PASS" \
  ssh "$REMOTE_USER@$REMOTE_HOST" \
  "~/Library/Android/sdk/platform-tools/adb install -r $APK_REMOTE"

run_step "Ejecutar app" sshpass -p "$REMOTE_PASS" \
  ssh $SSH_OPTS "$REMOTE_USER@$REMOTE_HOST" \
  "~/Library/Android/sdk/platform-tools/adb shell monkey -p $PACKAGE_NAME -c android.intent.category.LAUNCHER 1"  

echo ""
echo "🎉 Deploy completado correctamente"


