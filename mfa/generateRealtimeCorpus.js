// generateRealtimeCorpus.js
// Usage:
//   node generateRealtimeCorpus.js /path/to/items.json /path/to/output [--force]
//
// Environment:
//   RT_TOKEN / REALTIME_TTS_TOKEN
//   TTS_ENDPOINT / REALTIME_TTS_ENDPOINT

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const inputPath = process.argv[2];
const outputPath = process.argv[3];
const force = process.argv.includes('--force');

const DEFAULT_TTS_ENDPOINT = 'https://api.curso-ingles.com/realtime/tts/aligned';
const DEFAULT_TTS_TOKEN = 'ca6c8ad7c431233c1d891f2bd9eebc1dbb0de269c690de994e2313b8c7e7a50';

if (!inputPath || !outputPath) {
  console.error('Usage: node generateRealtimeCorpus.js ITEMS.json OUTPUT_DIR [--force]');
  process.exit(1);
}

if (typeof fetch !== 'function') {
  console.error('Global fetch is not available in this Node runtime.');
  process.exit(1);
}

const endpoint =
  (process.env.TTS_ENDPOINT || process.env.REALTIME_TTS_ENDPOINT || DEFAULT_TTS_ENDPOINT).trim();
const token =
  (process.env.RT_TOKEN || process.env.REALTIME_TTS_TOKEN || DEFAULT_TTS_TOKEN).trim();
const locale = 'en-US';

const itemsData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const items = Array.isArray(itemsData.items) ? itemsData.items : [];

const corpusDir = path.join(outputPath, 'corpus');
const audioDir = path.join(outputPath, 'audio');
const realtimeDir = path.join(outputPath, 'realtime');
const realtimeWordsDir = path.join(outputPath, 'realtime-words');

fs.mkdirSync(corpusDir, { recursive: true });
fs.mkdirSync(audioDir, { recursive: true });
fs.mkdirSync(realtimeDir, { recursive: true });
fs.mkdirSync(realtimeWordsDir, { recursive: true });

const hashText = (value) =>
  crypto.createHash('sha1').update(String(value || '')).digest('hex').slice(0, 8);

const downloadBinary = async (url, destinationPath) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`download_failed_${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destinationPath, buffer);
};

const postAlignedTts = async (text) => {
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['x-rt-token'] = token;
  }

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

const convertToWav = (inputPath, outputPath) => {
  execFileSync(
    'afconvert',
    ['-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', inputPath, outputPath],
    { stdio: 'ignore' }
  );
};

const normalizeWordsPayload = (payload, fallbackText) => ({
  schema: 1,
  generated_at: String(payload.generated_at || new Date().toISOString()),
  hash: String(payload.hash || '').trim(),
  text: String(payload.text || fallbackText || ''),
  locale: String(payload.locale || locale),
  voice: String(payload.voice || ''),
  engine: String(payload.engine || ''),
  rate: String(payload.rate || ''),
  pitch: String(payload.pitch || ''),
  voice_profile: String(payload.voice_profile || ''),
  duration_ms: Number(payload.duration_ms || 0) || 0,
  words: Array.isArray(payload.words) ? payload.words : []
});

const main = async () => {
  let generated = 0;
  let reused = 0;

  for (const item of items) {
    const id = String(item && item.id ? item.id : '').trim();
    const text = String(item && (item.tts || item.text) ? item.tts || item.text : '').trim();
    const alignText = String(
      item && (item.align || item.tts || item.text) ? item.align || item.tts || item.text : ''
    ).trim();
    if (!id || !text) continue;

    const wavPath = path.join(corpusDir, `${id}.wav`);
    const txtPath = path.join(corpusDir, `${id}.txt`);
    const audioPath = path.join(audioDir, `${id}.wav`);
    const metaPath = path.join(realtimeDir, `${id}.json`);
    const wordsPath = path.join(realtimeWordsDir, `${id}.words.json`);
    const tempAudioPath = path.join(outputPath, `.${id}.${hashText(text)}.mp3`);
    const tempWavPath = path.join(outputPath, `.${id}.${hashText(text)}.wav`);

    fs.writeFileSync(txtPath, alignText, 'utf8');

    if (!force && fs.existsSync(wavPath) && fs.existsSync(audioPath) && fs.existsSync(metaPath)) {
      reused += 1;
      continue;
    }

    console.log(`Generating: ${id}`);
    const payload = await postAlignedTts(text);
    fs.writeFileSync(metaPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');

    if (Array.isArray(payload.words)) {
      fs.writeFileSync(
        wordsPath,
        JSON.stringify(normalizeWordsPayload(payload, text), null, 2) + '\n',
        'utf8'
      );
    }

    await downloadBinary(payload.audio_url, tempAudioPath);
    convertToWav(tempAudioPath, tempWavPath);
    fs.copyFileSync(tempWavPath, wavPath);
    fs.copyFileSync(tempWavPath, audioPath);
    fs.unlinkSync(tempAudioPath);
    fs.unlinkSync(tempWavPath);
    generated += 1;
  }

  console.log(`Done. Generated ${generated} audio files. Reused ${reused}.`);
  console.log(`Corpus: ${corpusDir}`);
  console.log(`Audio:  ${audioDir}`);
  console.log(`Realtime meta: ${realtimeDir}`);
  console.log(`Realtime words: ${realtimeWordsDir}`);
};

main().catch((err) => {
  console.error(err && (err.stack || err.message || err));
  process.exit(1);
});
