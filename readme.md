
r34lp0w3r@m1MBP appV5 % rm ./ios/App/Podfile.lock
r34lp0w3r@m1MBP appV5 % rm -rf ./ios/App/Pods
r34lp0w3r@m1MBP appV5 % cd ./ios/App/
r34lp0w3r@m1MBP App % pod repo update
...
Updating spec repo `trunk`
...
r34lp0w3r@m1MBP App % pod install
...
Downloading dependencies
Installing Capacitor (7.4.4)
Installing CapacitorApp (7.1.1)
Installing CapacitorBrowser (7.0.3)
Installing CapacitorCommunityAdmob (7.2.0)
Installing CapacitorCommunityTextToSpeech (6.1.0)
Installing CapacitorCordova (7.4.4)
Installing CapacitorFilesystem (7.1.6)
Installing CapacitorKeyboard (7.0.4)
Installing CapacitorPushNotifications (7.0.4)
Installing CapacitorSplashScreen (7.0.4)
Installing CapacitorStatusBar (7.0.4)
Installing CordovaPlugins (7.4.4)
Installing Firebase (11.15.0)
Installing FirebaseCore (11.15.0)
Installing FirebaseCoreInternal (11.15.0)
Installing FirebaseInstallations (11.15.0)
Installing FirebaseMessaging (11.15.0)
Installing Google-Mobile-Ads-SDK (12.12.0)
Installing GoogleDataTransport (10.1.0)
Installing GoogleUserMessagingPlatform (3.0.0)
Installing GoogleUtilities (8.1.0)
Installing IONFilesystemLib (1.0.1)
Installing PromisesObjC (2.4.0)
Installing SokinternetP4w4 (0.0.1)
Installing nanopb (3.30910.0)
Generating Pods project
Integrating client project
Pod installation complete! There are 14 dependencies from the Podfile and 25 total pods installed.
...


--------------------------------------------------






--------------------------------------------------
- Color de la barra y del fondo.
android/app/src/main/java/com/sokinternet/cursoingles/MainActivity.java

styles.xml:
<resources>
  <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
    <item name="windowActionBar">false</item>
    <item name="windowNoTitle">true</item>
    <item name="android:background">@null</item>
    <item name="android:windowLightStatusBar">true</item>
  </style>

  <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
    <item name="windowSplashScreenBackground">#00619f</item>
    <item name="windowSplashScreenAnimatedIcon">@mipmap/ic_launcher</item>
    <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    <item name="android:windowLightStatusBar">true</item>
  </style>
</resources>
mkdir -p android/app/src/main/res/values-v23
mv ./styles.xml android/app/src/main/res/values-v23/styles.xml

android/app/src/main/res/values/styles.xml
android/app/src/main/res/values-v23/styles.xml


ios/App/App/AppDelegate.swift



- StatusBar Android:
android/app/src/main/res/values/colors.xml



- Reconstruir icono / splash, a partir de assets/icon.png (1024x1024)
npx capacitor-assets generate --ios --android \
  --splashBackgroundColor "#f4f6fb" \
  --splashBackgroundColorDark "#f4f6fb" \
  --logoSplashScale 1


- Nombre app:
capacitor.config.json
www/index.html
www/js/_r34lp0w3r_.js <- Purchases

android/app/build.gradle

  Renombrar el paquete Java/Kotlin y su carpeta: android/app/src/main/java/com/sokinternet/cursoingles/ → .../com/sokinternet/speak/ y

  android/app/src/main/java/com/speak/cursoingles/MainActivity.java

  android/app/src/main/AndroidManifest.xml

  android/app/src/main/res/values/strings.xml

  android/app/google-services.json (firebase) uno nuevo con el nuevo packageName

---

  ios/App/App.xcodeproj/project.pbxproj

  ios/App/App/Info.plist

  os/App/App/GoogleService-Info.plist (APNs, Firebase) uno nuevo con el nuevo bundle id

  En Firebase Console → Configuración del proyecto → Cloud Messaging: sube tu clave APNs (.p8) o los certs (.p12) de la app con el nuevo bundle id.
  En Xcode, en el target, activa las capacidades “Push Notifications” y “Background Modes” (Remote notifications) para ese bundle.

-----


Android

Proyecto nativo
En build.gradle asegúrate de applicationId "com.sokinternet.speak".
Si usas Firebase/FCM: descarga un google-services.json para ese package y ponlo en android/app/.
Si renombraste el paquete Java/Kotlin, ya debería estar en android/app/src/main/java/com/sokinternet/speak/ con package com.sokinternet.speak;.

Genera el AAB
Desde raíz: npx cap sync android.
Luego: cd android && ./gradlew bundleRelease (o bundleDebug para pruebas). Obtendrás app-release.aab.

Play Console (lo más cómodo para testers)
Crea la app nueva con el package com.sokinternet.speak.
Configura firma (lo habitual: “Play App Signing”).
Crea una versión en la pista “Pruebas internas” o “Pruebas cerradas”.

keytool -genkeypair -v -keystore upload-2025.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
Enter keystore password:M0n1c4abc
[Storing upload-2025.jks]
keytool -export -rfc -alias upload -file upload-cert.pem -keystore upload-2025.jks
Enter keystore password:M0n1c4abc
Certificate stored in file <upload-cert.pem>
mv ./upload-2025.jks /Users/r34lp0w3r/Dev/AndroidKeyStore/

Sube el AAB, rellena notas y guarda/envía.
Añade testers (emails o grupos). Ellos recibirán enlace para instalar desde Play.
-----
-----

iOS

App Store Connect
Entra en App Store Connect → Mis apps → “+” → App iOS. ID de bundle: com.sokinternet.speak. Crea la app.

En Xcode, en el target App, pestaña General: pon Bundle Identifier com.sokinternet.speak, selecciona tu Team, activa “Automatically manage signing”.

Asegúrate de que GoogleService-Info.plist es el descargado de Firebase para este bundle.

Capabilities: activa Push Notifications y Background Modes > Remote notifications (si usas push).

APNs
En Apple Developer, crea una clave APNs (.p8) o sube un cert.
En Firebase (si usas FCM), en Cloud Messaging, sube esa clave para el bundle com.sokinternet.speak.

Firmas y perfiles

Con “Automatically manage signing” Xcode te crea el provisioning adecuado (Development o Distribution) para tu Team.
Comprueba que el Signing Certificate sea “Apple Development” para debug y “Apple Distribution” al archivar.

Generar el build
En Xcode: Product → Archive (target Release). Espera a que se genere el .xcarchive y se abra Organizer.
En Organizer: “Distribute App” → App Store Connect → TestFlight. Usa firma automática.

TestFlight
Tras subir, en App Store Connect → TestFlight:
Testers internos (hasta 25 miembros del equipo): habilítalos y ya pueden instalar.
Testers externos: crea un grupo, añade correos, rellena la info de revisión y envía a revisión beta (suele tardar poco). Cuando Apple apruebe, los testers reciben invitación.

Instalación por testers
Cada tester instala TestFlight, acepta la invitación y descarga “Speak App”.
Cada build nuevo
Incrementa versión/build en Xcode, Archive de nuevo y sube. TestFlight gestionará las actualizaciones.



-----


./gradlew assembleRelease
app/build/outputs/bundle/release/app-release.aab
app/build/outputs/apk/release/app-release.apk



adb logcat -v color --pid "$(adb shell pidof -s com.sokinternet.speak)" '*:I'

adb logcat -v color --pid "$(adb shell pidof -s com.sokinternet.speak)"


----------

Android
01-13 10:00:37.183 27396 27396 I Capacitor/Console: File: https://localhost/js/_r34lp0w3r_.js - Line 618 - Msg:  >#C04#> PushNotifications: registration. token: (tipo object):
01-13 10:00:37.183 27396 27396 I Capacitor/Console: File: https://localhost/js/_r34lp0w3r_.js - Line 626 - Msg:  >#C04#> PushNotifications: registration. token:.value: cRIyIeQzRxurSLQ-v6K3hn:APA91bF6JE23WXW2avIQIIUS_VfX8foBrlHnAdossBpOj6QSUleYbWGl5l12cqdg8usU4qif_DN5KlxYfq4XUaznVUpJ6wU5faCCMbhNKUSvLpD89226sUE


iOS
⚡️  [log] - >#C04#> fcmToken: 📲 Token fcm obtenido desde nativo: dh2II-CKs02TmSC0K8okXv:APA91bGkJOOhrMTP1C9c5naUbmbMJELsdy5wUTfmiHxuxkcorW6u1a7hlGZgEs09qCh28tBtO6APt-XbQQUstVpxleSJruQS824QQ5uqZGFh4AV6tawA5M0
⚡️  [log] - >#C04#> apnsToken: 📲 Token APNs obtenido desde nativo: b245635321b17b50d5e87261623cf21f1462220f42b4cddda1445fbaab6d8875

Firebase Console → Configuración del proyecto → Cuentas de servicio → Generar clave privada
-> speakapp-4653c-firebase-adminsdk-fbsvc-fbf6617169.json
Para Android con esto es suficiente.
para iOS: 
en ios/App/App/ ya tendriamos que tener
GoogleService-Info.plist de antes.
Y además necesitamos vincular el p8 de push de APNs
developer.apple.com → Account → Certificates, Identifiers & Profiles → Keys (NO Certificates)
Pulsar '+', name: 'Push SpeakApp', Seleccionar 'Apple Push Notifications service (APNs)', 'Configure', 'Sandbox % Production', 'Save', 'Continue', 'Register'
OJO -> Hay un limite, pero se puede usar uno que ya existia, sirve para todas las apps del equipo.
Por tanto se puede usar la de curso-ingles:
scp 'adm.00.ext:/opt/backendV4/send_push/*.p8' .
-> AuthKey_5J64U76FC9.p8

En Firebase del proyecto nuevo (speakapp-4653c), en Cloud Messaging > 'Configuración de la app para Apple', sube el mismo .p8 y pon el Key ID y tu Team ID; bundle com.sokinternet.speak.
id de clave: '5J64U76FC9' (Está en el nombre del p8)
id de equipo: 'T4LYZV6KKS' (Lo pone en developer.apple.com A la derecha arriba)
(Se hace para desarrollo y producción)
----------
