#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const speakappRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(speakappRoot, 'www', 'data', 'reference-lesson-segments.json');
const endpoint = (
  process.env.REFERENCE_LESSON_AUDIO_ENDPOINT ||
  process.env.TTS_AUDIO_ENDPOINT ||
  'https://api.curso-ingles.com/realtime/tts/audio'
).trim();
const token = (
  process.env.REFERENCE_LESSON_AUDIO_TOKEN ||
  process.env.TTS_AUDIO_TOKEN ||
  process.env.RT_TOKEN ||
  process.env.REALTIME_TTS_TOKEN ||
  ''
).trim();
const voice = (process.env.REFERENCE_LESSON_AUDIO_VOICE || 'Danielle').trim();
const engine = (process.env.REFERENCE_LESSON_AUDIO_ENGINE || 'neural').trim();
const concurrency = Math.max(1, Number(process.env.REFERENCE_LESSON_AUDIO_CONCURRENCY || 4));
const force = process.argv.includes('--force');
const dryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? Math.max(0, Number(limitArg.slice('--limit='.length)) || 0) : 0;

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const sha256 = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');
const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const writeJsonAtomically = (filePath, payload) => {
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryPath, filePath);
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getAudioLocale = (segment) => segment.locale === 'es' ? 'en-US' : 'en-US';
const getAudioKey = (segment) => sha256(JSON.stringify({
  text: normalizeText(segment.text),
  locale: getAudioLocale(segment),
  voice,
  engine,
  rate: '',
  pitch: ''
}));

const postAudioTts = async (text, locale) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['x-rt-token'] = token;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text, locale, voice, engine })
  });
  const raw = await response.text();
  let payload = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch (_err) {
    payload = null;
  }
  if (!response.ok || !payload || payload.ok !== true || !String(payload.audio_url || '').trim()) {
    const message = payload && (payload.message || payload.error)
      ? String(payload.message || payload.error)
      : `http_${response.status}`;
    const error = new Error(message);
    error.httpStatus = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
};

const postAudioTtsWithRetry = async (text, locale) => {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return await postAudioTts(text, locale);
    } catch (error) {
      const message = String(error && error.message ? error.message : '').toLowerCase();
      const retryable = [429, 500, 502, 503, 504].includes(Number(error.httpStatus)) ||
        message.includes('rate exceeded') || message.includes('throttl');
      if (!retryable || attempt === 5) throw error;
      const delayMs = Math.min(30000, 1500 * (2 ** attempt));
      console.warn(`Retrying after ${error.message}; waiting ${delayMs}ms`);
      await wait(delayMs);
    }
  }
  throw new Error('audio_generation_retry_exhausted');
};

const build = async () => {
  if (!fs.existsSync(manifestPath)) throw new Error(`manifest not found: ${manifestPath}`);
  const manifest = readJson(manifestPath);
  if (!Array.isArray(manifest.segments) || !manifest.segments.length) {
    throw new Error('manifest contains no segments');
  }

  const unique = new Map();
  manifest.segments.forEach((segment) => {
    const text = normalizeText(segment.text);
    if (!text) return;
    const key = getAudioKey(segment);
    if (!unique.has(key)) unique.set(key, { key, text, locale: getAudioLocale(segment), segment });
  });

  const targets = Array.from(unique.values());
  const existing = new Map();
  manifest.segments.forEach((segment) => {
    const audio = segment.audio;
    if (audio && audio.key && audio.audio_url) existing.set(audio.key, audio);
  });
  const pending = force ? targets : targets.filter((target) => !existing.has(target.key));
  const requested = limit ? pending.slice(0, limit) : pending;

  console.log(`Manifest segments: ${manifest.segments.length}`);
  console.log(`Unique audios: ${targets.length}`);
  console.log(`Already available: ${pending.length === targets.length ? 0 : targets.length - pending.length}`);
  console.log(`To generate: ${requested.length}`);
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Configuration: ${voice}/${engine}, concurrency ${concurrency}`);
  if (dryRun) return;
  if (!token) throw new Error('missing TTS audio token (set REFERENCE_LESSON_AUDIO_TOKEN or RT_TOKEN)');

  const generated = new Map(existing);
  const writeOutput = () => {
    const enrichedSegments = manifest.segments.map((segment) => {
      const audio = generated.get(getAudioKey(segment));
      if (!audio) return segment;
      return { ...segment, audio };
    });
    writeJsonAtomically(manifestPath, {
      ...manifest,
      audio: {
        generator: 'build-reference-lesson-audio',
        endpoint,
        voice,
        engine,
        deduplicated: true,
        unique_audios: targets.length,
        generated_at: new Date().toISOString()
      },
      segments: enrichedSegments
    });
  };
  let completed = 0;
  let failed = null;
  let cursor = 0;
  const worker = async () => {
    while (!failed) {
      const index = cursor++;
      if (index >= requested.length) return;
      const target = requested[index];
      try {
        const payload = await postAudioTtsWithRetry(target.text, target.locale);
        generated.set(target.key, {
          key: target.key,
          audio_url: String(payload.audio_url),
          hash: String(payload.hash || ''),
          locale: String(payload.locale || target.locale),
          voice: String(payload.voice || voice),
          engine: String(payload.engine || engine),
          rate: String(payload.rate || ''),
          pitch: String(payload.pitch || ''),
          audio_kind: String(payload.audio_kind || 'polly')
        });
        completed += 1;
        if (completed % 25 === 0 || completed === requested.length) {
          console.log(`Generated ${completed}/${requested.length}`);
          writeOutput();
        }
      } catch (error) {
        failed = new Error(`segment ${target.key} (${target.text.slice(0, 80)}): ${error.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, requested.length) }, worker));
  if (failed) throw failed;

  writeOutput();
  console.log(`Updated: ${manifestPath}`);
};

build().catch((error) => {
  console.error(error && (error.stack || error.message || error));
  process.exit(1);
});
