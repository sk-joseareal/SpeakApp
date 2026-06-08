#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const scriptRoot = __dirname;
const speakappRoot = path.resolve(scriptRoot, '..');

const sourceRoot = path.join(speakappRoot, 'videos');
const trainingDataPath = path.join(speakappRoot, 'www', 'js', 'data', 'training-data.json');
const outputRoot = path.join(speakappRoot, 'www', 'assets', 'speak', 'videos');
const manifestPath = path.join(speakappRoot, 'www', 'data', 'speak-videos.json');

const ffmpegBin = process.env.FFMPEG_BIN || 'ffmpeg';
const force = process.argv.includes('--force');

const isPlainObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

const normalizeName = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/\.mp4$/i, '')
    .replace(/\s*\(\d+\)\s*$/g, '')
    .replace(/_/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const sha256 = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');

const statFingerprint = (filePath) => {
  const stat = fs.statSync(filePath);
  return `${path.basename(filePath)}:${stat.size}:${stat.mtimeMs}`;
};

const computeSourceHash = (files) => {
  const digest = crypto.createHash('sha256');
  files.forEach((file) => digest.update(statFingerprint(file)));
  return `sha256-${digest.digest('hex')}`;
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const loadExistingManifest = () => {
  if (!fs.existsSync(manifestPath)) return null;
  try {
    const manifest = readJson(manifestPath);
    return isPlainObject(manifest) ? manifest : null;
  } catch (err) {
    return null;
  }
};

const bundleLooksComplete = (manifest, expectedSessions) => {
  if (!manifest || !isPlainObject(manifest.sessions)) return false;
  if (!fs.existsSync(outputRoot)) return false;
  for (const session of expectedSessions) {
    const entry = manifest.sessions[session.id];
    if (!entry || typeof entry !== 'object') return false;
    const mp4Path = path.join(outputRoot, `${session.id}.mp4`);
    const jpgPath = path.join(outputRoot, `${session.id}.jpg`);
    if (!fs.existsSync(mp4Path) || !fs.existsSync(jpgPath)) return false;
    if (String(entry.video || '') !== `assets/speak/videos/${session.id}.mp4`) return false;
    if (String(entry.poster || '') !== `assets/speak/videos/${session.id}.jpg`) return false;
  }
  return true;
};

const convertVideo = (inputPath, outputPath) => {
  execFileSync(
    ffmpegBin,
    [
      '-y',
      '-i',
      inputPath,
      '-c:v',
      'libx264',
      '-profile:v',
      'baseline',
      '-level',
      '3.1',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      outputPath
    ],
    { stdio: 'ignore' }
  );
};

const buildPoster = (inputPath, outputPath) => {
  execFileSync(
    ffmpegBin,
    ['-y', '-i', inputPath, '-frames:v', '1', '-q:v', '2', outputPath],
    { stdio: 'ignore' }
  );
};

const main = () => {
  if (!fs.existsSync(sourceRoot)) {
    throw new Error(`source videos folder not found: ${sourceRoot}`);
  }
  if (!fs.existsSync(trainingDataPath)) {
    throw new Error(`training-data not found: ${trainingDataPath}`);
  }
  if (!fs.existsSync(ffmpegBin) && ffmpegBin === path.resolve(ffmpegBin)) {
    throw new Error(`ffmpeg not found at ${ffmpegBin}`);
  }

  const trainingData = readJson(trainingDataPath);
  const sessions = Array.isArray(trainingData.sessions) ? trainingData.sessions : [];
  if (!sessions.length) {
    throw new Error('training-data contains no sessions');
  }

  const sourceFiles = fs
    .readdirSync(sourceRoot)
    .filter((file) => /\.mp4$/i.test(file))
    .map((file) => path.join(sourceRoot, file));

  if (!sourceFiles.length) {
    throw new Error(`no mp4 files found in ${sourceRoot}`);
  }

  const sourceHash = computeSourceHash(sourceFiles);
  const existingManifest = loadExistingManifest();
  if (
    !force &&
    existingManifest &&
    existingManifest.source_hash === sourceHash &&
    bundleLooksComplete(existingManifest, sessions)
  ) {
    console.log(`[speak-videos] up to date: ${sourceHash}`);
    return;
  }

  const sourcesByKey = new Map();
  for (const filePath of sourceFiles) {
    const base = path.basename(filePath, '.mp4');
    const key = normalizeName(base);
    if (!key) continue;
    if (!sourcesByKey.has(key)) {
      sourcesByKey.set(key, filePath);
    }
  }

  fs.rmSync(outputRoot, { recursive: true, force: true });
  fs.mkdirSync(outputRoot, { recursive: true });

  const manifest = {
    generator: 'ffmpeg',
    source_hash: sourceHash,
    generated_at: new Date().toISOString(),
    sessions: {}
  };

  let generated = 0;
  let skipped = 0;

  for (const session of sessions) {
    const sessionId = String(session && session.id ? session.id : '').trim();
    if (!sessionId) continue;

    const expected = String(
      session?.speak?.sound?.expected ||
        session?.sound ||
        session?.title_en ||
        session?.title_es ||
        ''
    )
      .trim()
      .toLowerCase();
    const sourcePath =
      sourcesByKey.get(normalizeName(sessionId)) ||
      sourcesByKey.get(normalizeName(expected)) ||
      null;

    const mp4Out = path.join(outputRoot, `${sessionId}.mp4`);
    const jpgOut = path.join(outputRoot, `${sessionId}.jpg`);

    if (!sourcePath) {
      skipped += 1;
      console.warn(`[speak-videos] missing source for ${sessionId} (${expected || 'n/a'})`);
      continue;
    }

    console.log(`[speak-videos] ${sessionId} <- ${path.basename(sourcePath)}`);
    convertVideo(sourcePath, mp4Out);
    buildPoster(sourcePath, jpgOut);

    manifest.sessions[sessionId] = {
      source: path.basename(sourcePath),
      video: `assets/speak/videos/${sessionId}.mp4`,
      poster: `assets/speak/videos/${sessionId}.jpg`,
      expected: expected || ''
    };
    generated += 1;
  }

  if (!generated) {
    throw new Error('speak videos bundle generated zero entries');
  }

  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`[speak-videos] wrote manifest: ${manifestPath}`);
  console.log(`[speak-videos] generated ${generated}, skipped ${skipped}`);
};

main();
