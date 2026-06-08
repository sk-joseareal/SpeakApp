#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const scriptRoot = __dirname;
const speakappRoot = path.resolve(scriptRoot, '..');

const copyPath = path.join(speakappRoot, 'www', 'data', 'app-copy.json');
const manifestPath = path.join(speakappRoot, 'www', 'data', 'app-copy-audio.json');
const audioRoot = path.join(speakappRoot, 'www', 'assets', 'app-copy-audio', 'audio');

const endpoint =
  (process.env.APP_COPY_TTS_ENDPOINT ||
    process.env.TTS_ENDPOINT ||
    process.env.REALTIME_TTS_ENDPOINT ||
    'https://realtime.curso-ingles.com/realtime/tts/aligned').trim();
const token =
  (process.env.APP_COPY_TTS_TOKEN ||
    process.env.RT_TOKEN ||
    process.env.REALTIME_TTS_TOKEN ||
    'ca6c8ad7c431233c1d891f2bd9eebc1dbb0de269c690de994e2313b8c7e7a50').trim();
const force = process.argv.includes('--force');

const NARRATION_FIELDS = [
  { locale: 'es', path: ['home', 'planMessage'] },
  { locale: 'en', path: ['home', 'planMessage'] },
  { locale: 'es', path: ['reference', 'subtitle'] },
  { locale: 'en', path: ['reference', 'subtitle'] },
  { locale: 'es', path: ['reference', 'toolsSubtitle'] },
  { locale: 'en', path: ['reference', 'toolsSubtitle'] },
  { locale: 'es', path: ['freeRide', 'subtitle'] },
  { locale: 'en', path: ['freeRide', 'subtitle'] }
];

const isPlainObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const writeJson = (filePath, payload) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const sha256 = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');

const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const normalizeLookupKey = (value) => normalizeText(value).toLowerCase();

const extractNarrationLines = (value) => {
  const raw = String(value || '');
  if (!raw.trim()) return [];
  const normalized = raw
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n')
    .replace(/<\/li>\s*<li>/gi, '\n');
  const lines = normalized
    .split(/\r?\n+/)
    .map((part) => {
      const html = String(part || '').trim();
      const text = normalizeText(
        html
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/gi, ' ')
      );
      return text ? { text, html } : null;
    })
    .filter(Boolean);
  if (lines.length) return lines;
  const fallback = normalizeText(raw.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' '));
  return fallback ? [{ text: fallback, html: '' }] : [];
};

const getNestedValue = (object, pathParts) =>
  pathParts.reduce(
    (acc, key) => (acc && typeof acc === 'object' && key in acc ? acc[key] : undefined),
    object
  );

const downloadBinary = async (url, destinationPath) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`download_failed_${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.writeFileSync(destinationPath, buffer);
};

const postAlignedTts = async (text, locale) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['x-rt-token'] = token;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      text,
      locale
    })
  });
  const raw = await response.text();
  let payload = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch (err) {
    payload = { ok: false, error: 'invalid_json_response', raw };
  }
  if (!response.ok || !payload || payload.ok !== true) {
    const message =
      payload && (payload.message || payload.error)
        ? String(payload.message || payload.error)
        : `http_${response.status}`;
    const error = new Error(message);
    error.httpStatus = Number(response.status) || 0;
    error.payload = payload;
    throw error;
  }
  if (typeof payload.audio_url !== 'string' || !payload.audio_url.trim()) {
    throw new Error('aligned_tts_missing_audio_url');
  }
  return payload;
};

const loadExistingManifest = () => {
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  try {
    const manifest = readJson(manifestPath);
    return isPlainObject(manifest) ? manifest : null;
  } catch (err) {
    return null;
  }
};

const bundleLooksComplete = (manifest) => {
  if (!manifest || !isPlainObject(manifest.locales)) return false;
  if (!fs.existsSync(audioRoot)) return false;
  const locales = ['es', 'en'];
  for (const locale of locales) {
    const entries = manifest.locales[locale];
    if (!isPlainObject(entries)) return false;
    for (const [key, entry] of Object.entries(entries)) {
      if (key === 'lookup') continue;
      if (!entry || typeof entry !== 'object') return false;
      const audioUrl = String(entry.audio_url || '').trim();
      if (!audioUrl) return false;
      const relative = audioUrl.replace(/^\/+/, '');
      const localPath = path.join(speakappRoot, 'www', relative);
      if (!fs.existsSync(localPath)) return false;
    }
  }
  return true;
};

const build = async () => {
  if (!fs.existsSync(copyPath)) {
    throw new Error(`app-copy not found: ${copyPath}`);
  }

  const rawCopy = fs.readFileSync(copyPath, 'utf8');
  const copyHash = `sha256-${sha256(rawCopy)}`;
  const existingManifest = loadExistingManifest();
  if (!force && existingManifest && existingManifest.source_hash === copyHash && bundleLooksComplete(existingManifest)) {
    console.log(`[app-copy-audio] up to date: ${copyHash}`);
    return;
  }

  const copy = JSON.parse(rawCopy);
  if (!isPlainObject(copy) || !isPlainObject(copy.es) || !isPlainObject(copy.en)) {
    throw new Error('app-copy payload must contain root locales "es" and "en"');
  }

  fs.rmSync(audioRoot, { recursive: true, force: true });

  const manifest = {
    generator: 'realtime',
    source_hash: copyHash,
    generated_at: new Date().toISOString(),
    locales: {
      es: { lookup: {} },
      en: { lookup: {} }
    }
  };

  const seen = {
    es: new Set(),
    en: new Set()
  };
  let generatedCount = 0;

  for (const field of NARRATION_FIELDS) {
    const localeCopy = copy[field.locale];
    const sourceValue = getNestedValue(localeCopy, field.path);
    const lines = extractNarrationLines(sourceValue);
    console.log(`[app-copy-audio] inspect ${field.locale} ${field.path.join('.')} -> ${lines.length} lines`);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const text = normalizeText(line.text);
      if (!text) continue;
      if (seen[field.locale].has(text)) continue;
      seen[field.locale].add(text);
      const ttsLocale = field.locale === 'es' ? 'es-ES' : 'en-US';
      console.log(`[app-copy-audio] ${field.locale} ${field.path.join('.')} -> ${text}`);
      const payload = await postAlignedTts(text, ttsLocale);
      const hash = sha256(`${field.locale}::${text}`).slice(0, 16);
      const filename = `${hash}.mp3`;
      const audioPath = path.join(audioRoot, field.locale, filename);
      await downloadBinary(payload.audio_url, audioPath);

      manifest.locales[field.locale][text] = {
        audio_url: `assets/app-copy-audio/audio/${field.locale}/${filename}`,
        locale: ttsLocale,
        text,
        generated_at: String(payload.generated_at || new Date().toISOString()),
        hash: String(payload.hash || ''),
        duration_ms: Number(payload.duration_ms || 0) || 0,
        voice: String(payload.voice || ''),
        engine: String(payload.engine || ''),
        rate: String(payload.rate || ''),
        pitch: String(payload.pitch || ''),
        voice_profile: String(payload.voice_profile || ''),
        words: Array.isArray(payload.words) ? payload.words : [],
        source_paths: [`${field.path.join('.')}:${index + 1}`]
      };
      manifest.locales[field.locale].lookup[normalizeLookupKey(text)] = text;
      generatedCount += 1;
    }
  }

  if (generatedCount === 0) {
    throw new Error('app-copy-audio bundle generated zero entries; refusing to write empty manifest');
  }

  writeJson(manifestPath, manifest);
  console.log(`[app-copy-audio] wrote manifest: ${manifestPath}`);
};

build().catch((err) => {
  console.error(err && (err.stack || err.message || err));
  process.exit(1);
});
