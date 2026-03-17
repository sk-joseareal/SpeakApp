'use strict';

const fs = require('fs');
const {
  apnsRequest,
  delay,
  parseArgs,
  signJwt
} = require('./shared');

const args = parseArgs(process.argv.slice(2));
const token = String(args.token || '').trim();
const title = String(args.title || 'Nuevo mensaje').trim();
const body = String(args.body || 'Tienes un mensaje nuevo.').trim();
const destination = String(args.destination || 'cursoingles').trim().toLowerCase() || 'cursoingles';
const requestedEnvironment = String(args.environment || '').trim().toLowerCase();
const image = String(args.image || '').trim();
const delaySeconds = Number.isFinite(Number(args.delay)) ? Math.max(0, Math.floor(Number(args.delay))) : 0;
const legacyKeyPath = '/opt/backendV4/send_push/AuthKey_5J64U76FC9.p8';

if (!token) {
  console.error('Missing --token');
  process.exit(1);
}

const apnsKeyPath = String(
  process.env.COMMUNITY_PUSH_APNS_KEY_PATH ||
    (fs.existsSync(legacyKeyPath) ? legacyKeyPath : '')
).trim();
const apnsKeyId = String(process.env.COMMUNITY_PUSH_APNS_KEY_ID || '5J64U76FC9').trim();
const apnsTeamId = String(process.env.COMMUNITY_PUSH_APNS_TEAM_ID || 'T4LYZV6KKS').trim();
const apnsProductionDefault = String(process.env.COMMUNITY_PUSH_APNS_PRODUCTION || 'false').trim() === 'true';
const apnsTopicSpeak = String(process.env.COMMUNITY_PUSH_APNS_TOPIC_SPEAK || 'com.sokinternet.speak').trim();
const apnsTopicCurso = String(
  process.env.COMMUNITY_PUSH_APNS_TOPIC_CURSOINGLES || 'com.sokinternet.cursoingles'
).trim();
const apnsTopic = destination === 'speak' ? apnsTopicSpeak : apnsTopicCurso;

if (!apnsKeyPath || !apnsKeyId || !apnsTeamId || !apnsTopic) {
  console.error('Missing APNS configuration in env');
  process.exit(1);
}
if (!fs.existsSync(apnsKeyPath)) {
  console.error(`APNS key file not found: ${apnsKeyPath}`);
  process.exit(1);
}

const apnsEnvironment =
  requestedEnvironment === 'production' || requestedEnvironment === 'prod'
    ? 'production'
    : requestedEnvironment === 'sandbox' || requestedEnvironment === 'development' || requestedEnvironment === 'dev'
      ? 'sandbox'
      : (apnsProductionDefault ? 'production' : 'sandbox');
const host = apnsEnvironment === 'production'
  ? 'https://api.push.apple.com'
  : 'https://api.sandbox.push.apple.com';
const privateKeyPem = fs.readFileSync(apnsKeyPath, 'utf8');

const buildJwt = () =>
  signJwt({
    header: {
      alg: 'ES256',
      kid: apnsKeyId
    },
    payload: {
      iss: apnsTeamId,
      iat: Math.floor(Date.now() / 1000)
    },
    privateKeyPem,
    algorithm: 'ES256'
  });

const payload = {
  aps: {
    alert: {
      title,
      body
    },
    sound: 'default'
  }
};

if (image) {
  payload.image = image;
  payload.aps['mutable-content'] = 1;
}

(async () => {
  try {
    await delay(delaySeconds);
    const jwt = buildJwt();
    const response = await apnsRequest({
      host,
      token,
      jwt,
      topic: apnsTopic,
      payload
    });
    const ok = response.statusCode >= 200 && response.statusCode < 300;
    if (!ok) {
      console.error(JSON.stringify({
        ok: false,
        statusCode: response.statusCode,
        body: response.body || ''
      }));
      process.exit(1);
    }
    console.log(JSON.stringify({
      ok: true,
      transport: 'apns',
      statusCode: response.statusCode,
      environment: apnsEnvironment
    }));
    process.exit(0);
  } catch (err) {
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(1);
  }
})();
