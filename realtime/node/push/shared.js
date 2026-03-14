'use strict';

const fs = require('fs');
const https = require('https');
const http2 = require('http2');
const crypto = require('crypto');

const base64Url = (value) => {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
};

const parseArgs = (argv) => {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '');
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !String(next).startsWith('--')) {
      result[key] = String(next);
      i += 1;
    } else {
      result[key] = '1';
    }
  }
  return result;
};

const delay = async (seconds) => {
  const numeric = Number(seconds);
  const safeSeconds = Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
  if (!safeSeconds) return;
  await new Promise((resolve) => setTimeout(resolve, safeSeconds * 1000));
};

const loadJsonFile = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const readDerLength = (buffer, startOffset) => {
  const first = buffer[startOffset];
  if ((first & 0x80) === 0) {
    return { length: first, offset: startOffset + 1 };
  }
  const byteCount = first & 0x7f;
  let value = 0;
  for (let i = 0; i < byteCount; i += 1) {
    value = (value << 8) | buffer[startOffset + 1 + i];
  }
  return { length: value, offset: startOffset + 1 + byteCount };
};

const derToJose = (signature, outputSize) => {
  let offset = 0;
  if (signature[offset++] !== 0x30) {
    throw new Error('Invalid DER signature sequence');
  }
  const sequenceLength = readDerLength(signature, offset);
  offset = sequenceLength.offset;
  if (signature[offset++] !== 0x02) {
    throw new Error('Invalid DER signature r marker');
  }
  const rLength = readDerLength(signature, offset);
  offset = rLength.offset;
  let r = signature.slice(offset, offset + rLength.length);
  offset += rLength.length;
  if (signature[offset++] !== 0x02) {
    throw new Error('Invalid DER signature s marker');
  }
  const sLength = readDerLength(signature, offset);
  offset = sLength.offset;
  let s = signature.slice(offset, offset + sLength.length);

  const componentSize = Math.floor(outputSize / 2);
  while (r.length > 0 && r[0] === 0x00) r = r.slice(1);
  while (s.length > 0 && s[0] === 0x00) s = s.slice(1);

  if (r.length > componentSize || s.length > componentSize) {
    throw new Error('Invalid DER signature component size');
  }

  const rOut = Buffer.concat([Buffer.alloc(componentSize - r.length, 0), r]);
  const sOut = Buffer.concat([Buffer.alloc(componentSize - s.length, 0), s]);
  return Buffer.concat([rOut, sOut]);
};

const signJwt = ({ header, payload, privateKeyPem, algorithm }) => {
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const input = `${encodedHeader}.${encodedPayload}`;
  let signature;
  if (algorithm === 'ES256') {
    const derSignature = crypto.sign('sha256', Buffer.from(input), {
      key: privateKeyPem,
      dsaEncoding: 'der'
    });
    signature = derToJose(derSignature, 64);
  } else if (algorithm === 'RS256') {
    signature = crypto.sign('RSA-SHA256', Buffer.from(input), privateKeyPem);
  } else {
    throw new Error(`Unsupported JWT algorithm: ${algorithm}`);
  }
  return `${input}.${base64Url(signature)}`;
};

const httpsRequest = ({ url, method = 'GET', headers = {}, body = '' }) =>
  new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = https.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        path: `${target.pathname}${target.search}`,
        method,
        headers
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          const rawBody = Buffer.concat(chunks).toString('utf8');
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers || {},
            body: rawBody
          });
        });
      }
    );
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });

const postJson = async (url, payload, headers = {}) => {
  const body = JSON.stringify(payload || {});
  return httpsRequest({
    url,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      ...headers
    },
    body
  });
};

const postForm = async (url, params, headers = {}) => {
  const body = new URLSearchParams(params || {}).toString();
  return httpsRequest({
    url,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
      ...headers
    },
    body
  });
};

const apnsRequest = ({ host, token, jwt, topic, payload }) =>
  new Promise((resolve, reject) => {
    const client = http2.connect(host);
    let finished = false;

    const cleanup = () => {
      if (!finished) return;
      client.close();
    };

    client.on('error', (err) => {
      if (finished) return;
      finished = true;
      reject(err);
      cleanup();
    });

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${token}`,
      authorization: `bearer ${jwt}`,
      'content-type': 'application/json',
      'apns-topic': topic,
      'apns-push-type': 'alert',
      'apns-priority': '10'
    });

    let statusCode = 0;
    const chunks = [];

    req.on('response', (headers) => {
      statusCode = Number(headers[':status'] || 0);
    });
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      if (finished) return;
      finished = true;
      resolve({
        statusCode,
        body: Buffer.concat(chunks).toString('utf8')
      });
      cleanup();
    });
    req.on('error', (err) => {
      if (finished) return;
      finished = true;
      reject(err);
      cleanup();
    });
    req.end(JSON.stringify(payload || {}));
  });

module.exports = {
  apnsRequest,
  base64Url,
  delay,
  loadJsonFile,
  parseArgs,
  postForm,
  postJson,
  signJwt
};
