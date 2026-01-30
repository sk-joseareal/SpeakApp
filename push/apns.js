
/*
Team ID: T4LYZV6KKS
Name:KeyPushTesting
Key ID:5J64U76FC9
Services:Apple Push Notifications service (APNs)
r34lp0w3r@m1MBP push-test % cat /Users/r34lp0w3r/Desktop/Certificados\ Capacitor/iOS/com.sokinternet.testing/Push/AuthKey_5J64U76FC9.p8
-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQgVwgaLBnVAkXKRi3W
Aor1ZGW8ikcLfBTRW3TJTH1lmkagCgYIKoZIzj0DAQehRANCAAR0pB5EehVz7eul
CywzgKbofOz1x4Nx2jw8tktLBISnQaSIU+V1i6MLsg6HUHacNLsEoeKm/4L1QqF/
+1YPyvOi
-----END PRIVATE KEY-----%
*/

const apn = require('apn');
const minimist = require('minimist');
const path = require('path');

// Parsear argumentos de línea de comandos
const args = minimist(process.argv.slice(2), {
  string: ['token', 'title', 'body'],
  default: {
    title: '¡Hola!',
    body: 'Esto es una prueba de notificación push',
    delay: 0
  }
});

if (!args.token) {
  console.error("🚫 Falta el parámetro --token");
  process.exit(1);
}

const deviceToken = args.token;
const delaySeconds = parseInt(args.delay, 10);

let apnProvider = new apn.Provider({
  token: {
    key: path.join(__dirname, 'AuthKey_5J64U76FC9.p8'), // la Key
    keyId: "5J64U76FC9",          // el Key ID
    teamId: "T4LYZV6KKS",         // tu Team ID
  },
  production: false,
});

const notification = new apn.Notification();

function bodyConHora(body) {
  const ahora = new Date();
  const horaFormateada = ahora.toLocaleString('es-ES', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  return body + ` (${horaFormateada}) [apns]`;
}

notification.alert = {
  title: args.title,
  body: bodyConHora(args.body),
};

notification.badge = 1;                             // Muestra el número en el icono de la app
notification.sound = "default";                     // Sonido por defecto
//notification.topic = "com.sokinternet.cursoingles"; // Bundle ID de la app
notification.topic = "com.sokinternet.speak"; // Bundle ID de la app

async function enviarNotificacion() {
  try {
    const response = await apnProvider.send(notification, deviceToken);
    console.log("✅ Respuesta del push:", JSON.stringify(response, null, 2));
  } catch (err) {
    console.error("❌ Error al enviar la notificación:", err);
  } finally {
    await apnProvider.shutdown();
    console.log("🔚 Conexión cerrada.");
    process.exit(0);
  }
}

// Si hay retardo, esperamos antes de enviar
if (delaySeconds > 0) {
  console.log(`⏱ Esperando ${delaySeconds} segundos antes de enviar...`);
  setTimeout(enviarNotificacion, delaySeconds * 1000);
} else {
  enviarNotificacion();
}

