'use strict';

const fs = require('fs');
const {
  delay,
  loadJsonFile,
  parseArgs,
  postForm,
  postJson,
  signJwt
} = require('./shared');

const args = parseArgs(process.argv.slice(2));
const token = String(args.token || '').trim();
const title = String(args.title || 'Nuevo mensaje').trim();
const body = String(args.body || 'Tienes un mensaje nuevo.').trim();
const destination = String(args.destination || 'cursoingles').trim().toLowerCase() || 'cursoingles';
const image = String(args.image || '').trim();
const delaySeconds = Number.isFinite(Number(args.delay)) ? Math.max(0, Math.floor(Number(args.delay))) : 0;

if (!token) {
  console.error('Missing --token');
  process.exit(1);
}

const serviceAccountPath = String(
  destination === 'speak'
    ? process.env.COMMUNITY_PUSH_FCM_SERVICE_ACCOUNT_SPEAK_PATH || ''
    : process.env.COMMUNITY_PUSH_FCM_SERVICE_ACCOUNT_CURSOINGLES_PATH || ''
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
const clientEmail = String(serviceAccount.client_email || '').trim();
const privateKey = String(serviceAccount.private_key || '').trim();
const projectId = String(serviceAccount.project_id || '').trim();

if (!clientEmail || !privateKey || !projectId) {
  console.error('Invalid FCM service account file');
  process.exit(1);
}

const buildAccessToken = async () => {
  const assertion = signJwt({
    header: {
      alg: 'RS256',
      typ: 'JWT'
    },
    payload: {
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    },
    privateKeyPem: privateKey,
    algorithm: 'RS256'
  });

  const response = await postForm('https://oauth2.googleapis.com/token', {
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`OAuth token request failed: HTTP ${response.statusCode} ${response.body || ''}`);
  }

  const parsed = JSON.parse(response.body || '{}');
  const accessToken = String(parsed.access_token || '').trim();
  if (!accessToken) {
    throw new Error('OAuth token response missing access_token');
  }
  return accessToken;
};

const buildMessage = () => {
  const notification = {
    title,
    body
  };
  if (image) {
    notification.image = image;
  }

  const message = {
    token,
    notification,
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
    message.android.notification.imageUrl = image;
    message.apns.fcm_options = {
      image
    };
  }

  return { message };
};

(async () => {
  try {
    await delay(delaySeconds);
    const accessToken = await buildAccessToken();
    const response = await postJson(
      `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`,
      buildMessage(),
      {
        Authorization: `Bearer ${accessToken}`
      }
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`FCM send failed: HTTP ${response.statusCode} ${response.body || ''}`);
    }

    const parsed = JSON.parse(response.body || '{}');
    console.log(JSON.stringify({
      ok: true,
      transport: 'fcm',
      name: parsed.name || ''
    }));
    process.exit(0);
  } catch (err) {
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(1);
  }
})();
