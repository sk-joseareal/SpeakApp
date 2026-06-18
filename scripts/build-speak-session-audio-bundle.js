#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const scriptRoot = __dirname;
const speakappRoot = path.resolve(scriptRoot, '..');

const trainingDataPath = path.join(speakappRoot, 'www', 'js', 'data', 'training-data.json');
const sourceMetaRoot = path.join(speakappRoot, 'mfa', 'output', 'realtime');
const sourceAudioRoot = path.join(speakappRoot, 'mfa', 'output', 'audio');
const outputRoot = path.join(speakappRoot, 'www', 'assets', 'speak', 'audio', 'en');
const manifestPath = path.join(speakappRoot, 'www', 'data', 'speak-audio.json');

const endpoint =
  (process.env.SPEAK_SESSION_TTS_ENDPOINT ||
    process.env.REALTIME_TTS_ENDPOINT ||
    'https://api.curso-ingles.com/realtime/tts/aligned').trim();
const token =
  (process.env.SPEAK_SESSION_TTS_TOKEN ||
    process.env.RT_TOKEN ||
    process.env.REALTIME_TTS_TOKEN ||
    'ca6c8ad7c431233c1d891f2bd9eebc1dbb0de269c690de994e2313b8c7e7a50').trim();
const ffmpegBin = process.env.FFMPEG_BIN || 'ffmpeg';
const force = process.argv.includes('--force');

const isPlainObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

const sha256 = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');

const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const normalizeLookupKey = (value) => normalizeText(value).toLowerCase();

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const writeJson = (filePath, payload) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const downloadBinary = async (url, destinationPath) => {
  const response = execFileSync(
    'curl',
    ['-sS', '-L', '--fail', '--retry', '2', '--retry-delay', '1', '--output', '-', url],
    { encoding: 'buffer', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const buffer = Buffer.isBuffer(response) ? response : Buffer.from(response || '');
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.writeFileSync(destinationPath, buffer);
};

const convertWavToMp3 = (inputPath, outputPath) => {
  execFileSync(
    ffmpegBin,
    [
      '-y',
      '-i',
      inputPath,
      '-vn',
      '-codec:a',
      'libmp3lame',
      '-q:a',
      '4',
      outputPath
    ],
    { stdio: 'ignore' }
  );
};

const postAlignedTts = async (text) => {
  const args = ['-sS', '-L', '--fail'];
  if (token) {
    args.push('-H', `x-rt-token: ${token}`);
  }
  args.push('-H', 'Content-Type: application/json');
  args.push('-X', 'POST');
  args.push('--data', JSON.stringify({ text, locale: 'en-US' }));
  args.push(endpoint);

  let raw = '';
  try {
    raw = execFileSync('curl', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    const stderr = String((err && err.stderr) || err.message || '').trim();
    const error = new Error(stderr || 'curl_failed');
    error.payload = null;
    throw error;
  }

  let payload = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch (err) {
    payload = { ok: false, error: 'invalid_json_response', raw };
  }
  if (!payload || payload.ok !== true) {
    const message =
      payload && (payload.message || payload.error)
        ? String(payload.message || payload.error)
        : 'curl_failed';
    const error = new Error(message);
    error.httpStatus = 200;
    error.payload = payload;
    throw error;
  }
  if (typeof payload.audio_url !== 'string' || !payload.audio_url.trim()) {
    throw new Error('aligned_tts_missing_audio_url');
  }
  return payload;
};

const loadExistingManifest = () => {
  if (!fs.existsSync(manifestPath)) return null;
  try {
    const manifest = readJson(manifestPath);
    return isPlainObject(manifest) ? manifest : null;
  } catch (err) {
    return null;
  }
};

const bundleLooksComplete = (manifest, expectedEntries) => {
  if (!manifest || !isPlainObject(manifest.locales)) return false;
  if (!isPlainObject(manifest.locales.en)) return false;
  if (!fs.existsSync(outputRoot)) return false;
  for (const entry of expectedEntries) {
    const canonical = entry.canonicalText;
    const payload = manifest.locales.en[canonical];
    if (!payload || typeof payload !== 'object') return false;
    const audioUrl = String(payload.audio_url || '').trim();
    if (!audioUrl) return false;
    const localPath = path.join(speakappRoot, 'www', audioUrl.replace(/^\/+/, ''));
    if (!fs.existsSync(localPath)) return false;
  }
  return true;
};

const buildTargets = (trainingData) => {
  const sessions = Array.isArray(trainingData.sessions) ? trainingData.sessions : [];
  const targetsByLookup = new Map();

  const addTarget = (text, sourcePath) => {
    const canonicalText = normalizeText(text);
    if (!canonicalText) return;
    const lookupKey = normalizeLookupKey(canonicalText);
    if (!lookupKey) return;
    if (!targetsByLookup.has(lookupKey)) {
      targetsByLookup.set(lookupKey, {
        canonicalText,
        lookupKey,
        sourcePaths: []
      });
    }
    const entry = targetsByLookup.get(lookupKey);
    if (sourcePath && !entry.sourcePaths.includes(sourcePath)) {
      entry.sourcePaths.push(sourcePath);
    }
  };

  for (const session of sessions) {
    const sessionId = String(session && session.id ? session.id : '').trim();
    const soundExpected = session?.speak?.sound?.expected;
    if (soundExpected) addTarget(soundExpected, `${sessionId}.speak.sound.expected`);
    const words = Array.isArray(session?.speak?.spelling?.words) ? session.speak.spelling.words : [];
    words.forEach((word, index) => addTarget(word, `${sessionId}.speak.spelling.words.${index}`));
    const sentence = session?.speak?.sentence?.sentence;
    if (sentence) addTarget(sentence, `${sessionId}.speak.sentence.sentence`);
  }

  return Array.from(targetsByLookup.values());
};

const loadLocalSourceMap = () => {
  const source = new Map();
  if (!fs.existsSync(sourceMetaRoot)) return source;
  const files = fs.readdirSync(sourceMetaRoot).filter((file) => file.endsWith('.json'));
  for (const file of files) {
    const filePath = path.join(sourceMetaRoot, file);
    try {
      const payload = readJson(filePath);
      const text = normalizeText(payload && payload.text ? payload.text : '');
      const lookupKey = normalizeLookupKey(text);
      if (!lookupKey || source.has(lookupKey)) continue;
      source.set(lookupKey, {
        id: path.basename(file, '.json'),
        jsonPath: filePath,
        payload
      });
    } catch (err) {
      // skip invalid cache entry
    }
  }
  return source;
};

const build = async () => {
  if (!fs.existsSync(trainingDataPath)) {
    throw new Error(`training-data not found: ${trainingDataPath}`);
  }

  const rawTrainingData = fs.readFileSync(trainingDataPath, 'utf8');
  const trainingData = JSON.parse(rawTrainingData);
  const targets = buildTargets(trainingData);
  if (!targets.length) {
    throw new Error('training-data contains no session audio targets');
  }

  const sourceMap = loadLocalSourceMap();
  const existingManifest = loadExistingManifest();
  const sourceHash = `sha256-${sha256(rawTrainingData)}`;
  if (!force && existingManifest && existingManifest.source_hash === sourceHash && bundleLooksComplete(existingManifest, targets)) {
    console.log(`[speak-session-audio] up to date: ${sourceHash}`);
    return;
  }

  fs.rmSync(outputRoot, { recursive: true, force: true });
  fs.mkdirSync(outputRoot, { recursive: true });

  const manifest = {
    generator: 'session-audio-bundle',
    source_hash: sourceHash,
    generated_at: new Date().toISOString(),
    locales: {
      en: {
        lookup: {}
      }
    }
  };

  let generated = 0;
  let reused = 0;
  let remoteGenerated = 0;

  for (const target of targets) {
    const canonicalText = target.canonicalText;
    const lookupKey = target.lookupKey;
    const hash = sha256(`en::${lookupKey}`).slice(0, 16);
    const filename = `${hash}.mp3`;
    const relativeAudioUrl = `assets/speak/audio/en/${filename}`;
    const outputPath = path.join(outputRoot, filename);

    const sourceEntry = sourceMap.get(lookupKey) || null;
    let resolvedPayload = sourceEntry ? { ...sourceEntry.payload } : null;
    const sourceText =
      resolvedPayload && typeof resolvedPayload.text === 'string'
        ? normalizeText(resolvedPayload.text)
        : canonicalText;

    if (fs.existsSync(outputPath)) {
      reused += 1;
    } else if (sourceEntry) {
      const wavPath = path.join(sourceAudioRoot, `${sourceEntry.id}.wav`);
      if (fs.existsSync(wavPath)) {
        convertWavToMp3(wavPath, outputPath);
        reused += 1;
      } else if (resolvedPayload && typeof resolvedPayload.audio_url === 'string' && resolvedPayload.audio_url.trim()) {
        await downloadBinary(resolvedPayload.audio_url, outputPath);
        reused += 1;
      }
    }

    if (!fs.existsSync(outputPath)) {
      const remotePayload = await postAlignedTts(sourceText || canonicalText);
      await downloadBinary(remotePayload.audio_url, outputPath);
      resolvedPayload = remotePayload;
      remoteGenerated += 1;
    }

    if (!fs.existsSync(outputPath)) {
      throw new Error(`failed to build session audio for ${canonicalText}`);
    }

    const finalPayload = resolvedPayload && typeof resolvedPayload === 'object' ? { ...resolvedPayload } : {};
    manifest.locales.en[canonicalText] = {
      ok: true,
      source: sourceEntry ? 'local-mfa' : 'realtime',
      source_text: sourceText,
      text: canonicalText,
      locale: 'en-US',
      audio_url: relativeAudioUrl,
      source_audio_url: String(finalPayload.audio_url || '').trim(),
      words_url: String(finalPayload.words_url || '').trim(),
      duration_ms: Number(finalPayload.duration_ms || 0) || 0,
      hash: String(finalPayload.hash || '').trim(),
      voice: String(finalPayload.voice || '').trim(),
      engine: String(finalPayload.engine || '').trim(),
      rate: String(finalPayload.rate || '').trim(),
      pitch: String(finalPayload.pitch || '').trim(),
      voice_profile: String(finalPayload.voice_profile || '').trim(),
      words: Array.isArray(finalPayload.words) ? finalPayload.words : [],
      source_paths: Array.isArray(target.sourcePaths) ? target.sourcePaths : []
    };
    manifest.locales.en.lookup[lookupKey] = canonicalText;
    generated += 1;
  }

  writeJson(manifestPath, manifest);
  console.log(`[speak-session-audio] wrote manifest: ${manifestPath}`);
  console.log(`[speak-session-audio] generated ${generated}, reused ${reused}, remote ${remoteGenerated}`);
};

build().catch((err) => {
  console.error(err && (err.stack || err.message || err));
  process.exit(1);
});
