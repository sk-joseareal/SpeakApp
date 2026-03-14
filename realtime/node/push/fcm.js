'use strict';

const fs = require('fs');
const admin = require('firebase-admin');
const { delay, loadJsonFile, parseArgs } = require('./shared');

const args = parseArgs(process.argv.slice(2));
const token = String(args.token || '').trim();
const title = String(args.title || 'Nuevo mensaje').trim();
const body = String(args.body || 'Tienes un mensaje nuevo.').trim();
const destination = String(args.destination || 'cursoingles').trim().toLowerCase() || 'cursoingles';
const image = String(args.image || '').trim();
const delaySeconds = Number.isFinite(Number(args.delay)) ? Math.max(0, Math.floor(Number(args.delay))) : 0;
const legacySpeakServiceAccountPath =
  '/opt/backendV4/send_push/speakapp-4653c-firebase-adminsdk-fbsvc-fbf6617169.json';
const legacyCursoServiceAccountPath =
  '/opt/backendV4/send_push/curso-ingles-9584cd5de4fd.json';

if (!token) {
  console.error('Missing --token');
  process.exit(1);
}

const serviceAccountPath = String(
  destination === 'speak'
    ? process.env.COMMUNITY_PUSH_FCM_SERVICE_ACCOUNT_SPEAK_PATH ||
        (fs.existsSync(legacySpeakServiceAccountPath) ? legacySpeakServiceAccountPath : '')
    : process.env.COMMUNITY_PUSH_FCM_SERVICE_ACCOUNT_CURSOINGLES_PATH ||
        (fs.existsSync(legacyCursoServiceAccountPath) ? legacyCursoServiceAccountPath : '')
).trim();

if (!serviceAccountPath) {
  console.error(`Missing FCM service account path for destination: ${destination}`);
  process.exit(1);
}
if (!fs.existsSync(serviceAccountPath)) {
  console.error(`FCM service account file not found: ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = loadJsonFile(serviceAccountPath);
const projectId = String(serviceAccount.project_id || '').trim();
if (!projectId) {
  console.error('Invalid FCM service account file');
  process.exit(1);
}

const appName = `community-push-${projectId}`;
const app =
  admin.apps.find((candidate) => candidate && candidate.name === appName) ||
  admin.initializeApp(
    {
      credential: admin.credential.cert(serviceAccount),
      projectId
    },
    appName
  );

const message = {
  token,
  notification: {
    title,
    body
  },
  android: {
    priority: 'high',
    notification: {
      sound: 'default'
    }
  },
  apns: {
    payload: {
      aps: {
        sound: 'default'
      }
    }
  }
};

if (image) {
  message.notification.imageUrl = image;
  message.android.notification.imageUrl = image;
  message.apns.fcm_options = {
    image
  };
}

(async () => {
  try {
    await delay(delaySeconds);
    const response = await admin.messaging(app).send(message);
    console.log(
      JSON.stringify({
        ok: true,
        transport: 'fcm',
        name: response || ''
      })
    );
    await app.delete().catch(() => {});
    process.exit(0);
  } catch (err) {
    console.error(err && err.stack ? err.stack : String(err));
    await app.delete().catch(() => {});
    process.exit(1);
  }
})();
