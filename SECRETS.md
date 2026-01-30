# SECRETS

Este repo no incluye archivos sensibles. Deben colocarse localmente.

## Firebase (Android)
- Archivo: android/app/google-services.json
- Fuente: Firebase Console -> Project settings -> Your apps -> Android

## Firebase (iOS)
- Archivo: ios/App/App/GoogleService-Info.plist
- Fuente: Firebase Console -> Project settings -> Your apps -> iOS

## APNs key (Push iOS)
- Archivo: push/AuthKey_*.p8
- Fuente: Apple Developer -> Keys (APNs Auth Key)

## Firebase Admin SDK (Push server)
- Archivo: push/*firebase-adminsdk*.json
- Fuente: Firebase Console -> Service accounts -> Generate new private key

## Play upload cert (opcional)
- Archivo: android/upload-cert.pem
- Fuente: Play Console -> App integrity -> App signing

## Realtime env
- Archivo: realtime/.env (copiar desde realtime/.env.example)
- Contiene: PUSHER_APP_*, REALTIME_MONITOR_TOKEN, SOKETI_*
