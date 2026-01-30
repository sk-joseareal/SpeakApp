
const admin = require('firebase-admin');
const minimist = require('minimist');
const path = require('path');

// Cargar la clave de servicio
//const serviceAccount = require('./curso-ingles-9584cd5de4fd.json');
const serviceAccount = require('./speakapp-4653c-firebase-adminsdk-fbsvc-fbf6617169.json');
// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

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

function bodyConHora(body) {
  const ahora = new Date();
  const horaFormateada = ahora.toLocaleString('es-ES', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  return body + ` (${horaFormateada}) [fcm]`;
}

// Mensaje
const message = {
  token: deviceToken,
  notification: {
    title: args.title,
    body: bodyConHora(args.body)
  },
  data: {
    foo: 'bar',
    extra: new Date().toLocaleString()
  }
};

/* 
Imágen:  En Android funciona en versiones modernas y si el dispositivo está en primer plano o recibe la notificación correctamente configurada. En iOS, necesitas un Notification Service Extension (un paso adicional en Xcode).
notification: {
  title: '¡Mira esto!',
  body: 'Tiene una imagen',
  imageUrl: 'https://example.com/imagen.jpg'
}
Silenciosa: Esto no activa una notificación visible, pero se puede recibir en pushNotificationReceived y actuar desde JS.
data: {
  tipo: 'silenciosa',
  mensaje: 'Esta no se muestra, pero se recibe en JS'
}
*/






// Envío del mensaje
/*
admin.messaging().send(message)
  .then((response) => {
    console.log('✅ Notificación enviada correctamente:', response);
  })
  .catch((error) => {
    console.error('❌ Error al enviar la notificación:', error);
  });
*/  


// Envío del mensaje
async function enviarNotificacion() {
  try {
    const response = await admin.messaging().send(message);
    console.log("✅ Respuesta del push:", JSON.stringify(response, null, 2));
  } catch (err) {
    console.error("❌ Error al enviar la notificación:", err);
  } finally {
//    await apnProvider.shutdown();
//    console.log("🔚 Conexión cerrada.");
//    process.exit(0);
  }
}

// Si hay retardo, esperamos antes de enviar
if (delaySeconds > 0) {
  console.log(`⏱ Esperando ${delaySeconds} segundos antes de enviar...`);
  setTimeout(enviarNotificacion, delaySeconds * 1000);
} else {
  enviarNotificacion();
}
