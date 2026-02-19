
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
  string: ['token', 'title', 'body', 'destination', 'env', 'production'],
  default: {
    title: '¡Hola!',
    body: 'Esto es una prueba de notificación push',
    delay: 0,
    destination: 'cursoingles',
    env: 'auto'
  }
});

if (!args.token) {
  console.error("🚫 Falta el parámetro --token");
  process.exit(1);
}

const deviceToken = args.token;
const delaySeconds = parseInt(args.delay, 10);

function parseEnvironment(rawEnv, rawProduction) {
  if (typeof rawEnv === 'string' && rawEnv.trim()) {
    const value = rawEnv.trim().toLowerCase();
    if (value === 'production' || value === 'prod') return 'production';
    if (value === 'sandbox' || value === 'development' || value === 'dev') return 'sandbox';
    if (value === 'auto') return 'auto';
  }
  if (typeof rawProduction !== 'undefined') {
    const value = String(rawProduction).trim().toLowerCase();
    if (value === '1' || value === 'true') return 'production';
    if (value === '0' || value === 'false') return 'sandbox';
  }
  return 'auto';
}

function resolveTopic(destination) {
  const value = String(destination || '').trim();
  if (!value) return 'com.sokinternet.cursoingles';
  if (value.startsWith('com.')) return value;
  if (!/^[a-z0-9.-]+$/i.test(value)) {
    throw new Error(`Destino invalido para topic APNs: ${value}`);
  }
  return `com.sokinternet.${value}`;
}

function createApnProvider(production) {
  return new apn.Provider({
    token: {
      key: path.join(__dirname, 'AuthKey_5J64U76FC9.p8'), // la Key
      keyId: "5J64U76FC9",          // el Key ID
      teamId: "T4LYZV6KKS",         // tu Team ID
    },
    production,
  });
}

function isBadDeviceTokenResponse(response) {
  if (!response || !Array.isArray(response.failed) || response.failed.length === 0) return false;
  if (Array.isArray(response.sent) && response.sent.length > 0) return false;
  return response.failed.every((item) =>
    String(item && item.status) === '400' &&
    item &&
    item.response &&
    item.response.reason === 'BadDeviceToken'
  );
}

const environment = parseEnvironment(args.env, args.production);

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
notification.topic = resolveTopic(args.destination); // Bundle ID de la app

async function sendWithEnvironment(production) {
  const apnProvider = createApnProvider(production);
  try {
    const response = await apnProvider.send(notification, deviceToken);
    return response;
  } finally {
    await apnProvider.shutdown();
  }
}

async function enviarNotificacion() {
  const targetEnvironments =
    environment === 'auto'
      ? [true, false] // true=production, false=sandbox
      : [environment === 'production'];

  let lastResponse = null;

  for (let i = 0; i < targetEnvironments.length; i++) {
    const production = targetEnvironments[i];
    const envName = production ? 'production' : 'sandbox';
    console.log(`🌐 Enviando a APNs (${envName})...`);

    try {
      const response = await sendWithEnvironment(production);
      lastResponse = response;
      console.log(`✅ Respuesta del push (${envName}):`, JSON.stringify(response, null, 2));

      if (Array.isArray(response.sent) && response.sent.length > 0) {
        console.log("🔚 Conexión cerrada.");
        process.exit(0);
      }

      const shouldFallback =
        environment === 'auto' &&
        i < targetEnvironments.length - 1 &&
        isBadDeviceTokenResponse(response);

      if (shouldFallback) {
        console.log('↪️ Recibido BadDeviceToken. Reintentando en el otro entorno APNs...');
        continue;
      }

      break;
    } catch (err) {
      console.error(`❌ Error al enviar la notificación (${envName}):`, err);
      break;
    }
  }

  if (lastResponse && Array.isArray(lastResponse.failed) && lastResponse.failed.length > 0) {
    console.error("❌ Push no entregado. Revisa token, topic y entorno APNs.");
  }
  console.log("🔚 Conexión cerrada.");
  process.exit(0);
}

// Si hay retardo, esperamos antes de enviar
if (delaySeconds > 0) {
  console.log(`⏱ Esperando ${delaySeconds} segundos antes de enviar...`);
  setTimeout(enviarNotificacion, delaySeconds * 1000);
} else {
  enviarNotificacion();
}
