#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execFileSync } = require('child_process');

const speakappRoot = path.resolve(__dirname, '..');
const defaultInputPath = path.join(speakappRoot, 'www', 'js', 'data', 'training-data.json');
const defaultMetaScript = path.join(speakappRoot, 'scripts', 'generate-training-data-meta.js');
const defaultModel = process.env.OPENAI_TRANSLATE_MODEL || 'gpt-4.1-mini';
const defaultBaseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com';
const defaultBatchSize = 40;

const usage = () => {
  console.log(`Usage:
  node ./scripts/fill-training-data-es.js [options]

Options:
  --input PATH            Input training-data.json
                          Default: www/js/data/training-data.json
  --output PATH           Output JSON path
                          Default: same as --input
  --model MODEL           OpenAI model name
                          Default: ${defaultModel}
  --batch-size N          Number of unique texts per API call
                          Default: ${defaultBatchSize}
  --limit N               Process only first N pending texts
  --api-key KEY           OpenAI API key
                          Default: OPENAI_API_KEY
  --base-url URL          OpenAI API base URL
                          Default: ${defaultBaseUrl}
  --overwrite-filled      Re-translate fields that already have _es
  --dry-run               Do not call API or write files
  --no-backup             Do not create backup when writing in place
  --help                  Show this help

Examples:
  OPENAI_API_KEY=... node ./scripts/fill-training-data-es.js --dry-run
  OPENAI_API_KEY=... node ./scripts/fill-training-data-es.js
  OPENAI_API_KEY=... node ./scripts/fill-training-data-es.js --limit 25 --batch-size 10
`);
};

const asText = (value) => String(value === undefined || value === null ? '' : value).trim();
const normalizeLookupText = (value) => asText(value).replace(/\s+/g, ' ');

const parseArgs = (argv) => {
  const options = {
    inputPath: defaultInputPath,
    outputPath: defaultInputPath,
    model: defaultModel,
    batchSize: defaultBatchSize,
    limit: 0,
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: defaultBaseUrl,
    overwriteFilled: false,
    dryRun: false,
    backup: true
  };

  for (let idx = 0; idx < argv.length; idx += 1) {
    const arg = argv[idx];
    switch (arg) {
      case '--input':
        options.inputPath = path.resolve(argv[idx + 1] || '');
        idx += 1;
        break;
      case '--output':
        options.outputPath = path.resolve(argv[idx + 1] || '');
        idx += 1;
        break;
      case '--model':
        options.model = asText(argv[idx + 1] || '') || defaultModel;
        idx += 1;
        break;
      case '--batch-size':
        options.batchSize = Math.max(1, Number.parseInt(argv[idx + 1] || '', 10) || defaultBatchSize);
        idx += 1;
        break;
      case '--limit':
        options.limit = Math.max(0, Number.parseInt(argv[idx + 1] || '', 10) || 0);
        idx += 1;
        break;
      case '--api-key':
        options.apiKey = asText(argv[idx + 1] || '');
        idx += 1;
        break;
      case '--base-url':
        options.baseUrl = asText(argv[idx + 1] || '') || defaultBaseUrl;
        idx += 1;
        break;
      case '--overwrite-filled':
        options.overwriteFilled = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--no-backup':
        options.backup = false;
        break;
      case '--help':
      case '-h':
        usage();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const writeJson = (filePath, payload) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const makeBackupPath = (filePath) => {
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const name = path.basename(filePath, ext);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
  return path.join(dir, `${name}.backup-${stamp}${ext || '.json'}`);
};

const alignParallelWords = (sourceWords, translatedWords) => {
  const words = Array.isArray(sourceWords) ? sourceWords.map((item) => asText(item)).filter(Boolean) : [];
  const translated = Array.isArray(translatedWords) ? translatedWords.map((item) => asText(item)) : [];
  const out = translated.slice(0, words.length);
  while (out.length < words.length) out.push('');
  return { words, translated: out };
};

const ensureSessionTranslationFields = (session) => {
  session.speak = session.speak && typeof session.speak === 'object' ? session.speak : {};
  session.speak.sound = session.speak.sound && typeof session.speak.sound === 'object' ? session.speak.sound : {};
  session.speak.spelling = session.speak.spelling && typeof session.speak.spelling === 'object' ? session.speak.spelling : {};
  session.speak.sentence = session.speak.sentence && typeof session.speak.sentence === 'object' ? session.speak.sentence : {};

  session.speak.sound.expected = asText(session.speak.sound.expected);
  session.speak.sound.expected_es = asText(session.speak.sound.expected_es);
  session.speak.sentence.sentence = asText(session.speak.sentence.sentence);
  session.speak.sentence.sentence_es = asText(session.speak.sentence.sentence_es);

  const aligned = alignParallelWords(session.speak.spelling.words, session.speak.spelling.words_es);
  session.speak.spelling.words = aligned.words;
  session.speak.spelling.words_es = aligned.translated;
};

const collectJobs = (payload, options) => {
  const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
  const jobsByKey = new Map();
  let rawTargetCount = 0;

  const pushTarget = (kind, sourceText, targetText, pathLabel, applyTranslation) => {
    const normalizedSource = normalizeLookupText(sourceText);
    if (!normalizedSource) return;
    if (!options.overwriteFilled && asText(targetText)) return;
    rawTargetCount += 1;
    const dedupeKey = `${kind}::${normalizedSource.toLowerCase()}`;
    if (!jobsByKey.has(dedupeKey)) {
      jobsByKey.set(dedupeKey, {
        id: `job-${jobsByKey.size + 1}`,
        kind,
        sourceText: normalizedSource,
        targets: [],
        samplePaths: []
      });
    }
    const job = jobsByKey.get(dedupeKey);
    job.targets.push(applyTranslation);
    if (job.samplePaths.length < 3) job.samplePaths.push(pathLabel);
  };

  sessions.forEach((session) => {
    ensureSessionTranslationFields(session);
    const sessionId = asText(session && session.id ? session.id : '') || 'session';
    const sound = session.speak.sound;
    const spelling = session.speak.spelling;
    const sentence = session.speak.sentence;

    pushTarget(
      'sound',
      sound.expected,
      sound.expected_es,
      `${sessionId}.speak.sound.expected_es`,
      (translated) => {
        sound.expected_es = translated;
      }
    );

    spelling.words.forEach((word, index) => {
      pushTarget(
        'word',
        word,
        spelling.words_es[index],
        `${sessionId}.speak.spelling.words_es.${index}`,
        (translated) => {
          spelling.words_es[index] = translated;
        }
      );
    });

    pushTarget(
      'sentence',
      sentence.sentence,
      sentence.sentence_es,
      `${sessionId}.speak.sentence.sentence_es`,
      (translated) => {
        sentence.sentence_es = translated;
      }
    );
  });

  let jobs = Array.from(jobsByKey.values());
  if (options.limit > 0) jobs = jobs.slice(0, options.limit);
  return { jobs, rawTargetCount };
};

const postJson = (urlString, apiKey, payload) =>
  new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const url = new URL(urlString);
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          const statusCode = Number(res.statusCode || 0);
          if (statusCode < 200 || statusCode >= 300) {
            const error = new Error(`OpenAI request failed with HTTP ${statusCode}`);
            error.statusCode = statusCode;
            error.payload = raw;
            reject(error);
            return;
          }
          try {
            resolve(JSON.parse(raw));
          } catch (err) {
            const error = new Error('OpenAI response is not valid JSON');
            error.payload = raw;
            reject(error);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });

const buildTranslationPrompt = (batch) => ({
  model: batch.model,
  temperature: 0,
  response_format: { type: 'json_object' },
  messages: [
    {
      role: 'system',
      content:
        'You translate English learning content into Spanish (es-ES). Return only valid JSON. ' +
        'Do not explain anything. Preserve punctuation, apostrophes, placeholders in square brackets, and proper names. ' +
        'For kind=word and kind=sound, return one short, neutral, learner-friendly Spanish equivalent suitable for a vocabulary UI. ' +
        'Prefer the most common everyday meaning. Avoid infinitive verb forms unless the source is very clearly a verb. ' +
        'For isolated uppercase words, prefer the most likely classroom/vocabulary meaning rather than a grammatical analysis. ' +
        'If a word can be adjective or verb, prefer the adjective/adverb/noun sense when that is more natural for a flashcard-style item. ' +
        'Examples: OPEN -> abierto, HAPPY -> feliz, ABOUT -> acerca de, BROWN -> marron. ' +
        'For kind=sentence, return a natural Spanish translation. ' +
        'If the source is already Spanish or should stay unchanged, return it unchanged.'
    },
    {
      role: 'user',
      content: JSON.stringify({
        task: 'Translate each item to Spanish and return {"translations":[{"id":"...","translated_text":"..."}]}',
        items: batch.items.map((item) => ({
          id: item.id,
          kind: item.kind,
          source_text: item.sourceText
        }))
      })
    }
  ]
});

const parseTranslationsResponse = (response) => {
  const content =
    response &&
    Array.isArray(response.choices) &&
    response.choices[0] &&
    response.choices[0].message
      ? response.choices[0].message.content
      : '';
  if (!content) throw new Error('OpenAI response missing content');
  let parsed = null;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new Error(`OpenAI response content is not valid JSON: ${content.slice(0, 200)}`);
  }
  if (!parsed || !Array.isArray(parsed.translations)) {
    throw new Error('OpenAI response JSON missing translations array');
  }
  return parsed.translations;
};

const translateBatch = async (jobs, options) => {
  const payload = buildTranslationPrompt({ model: options.model, items: jobs });
  const url = `${options.baseUrl.replace(/\/+$/, '')}/v1/chat/completions`;
  const response = await postJson(url, options.apiKey, payload);
  const translations = parseTranslationsResponse(response);
  const byId = new Map();
  translations.forEach((item) => {
    const id = asText(item && item.id ? item.id : '');
    if (!id) return;
    byId.set(id, normalizeLookupText(item && item.translated_text ? item.translated_text : ''));
  });
  jobs.forEach((job) => {
    const translated = byId.get(job.id);
    if (!translated) {
      throw new Error(`Missing translation for ${job.id} (${job.kind}: ${job.sourceText})`);
    }
    job.targets.forEach((applyTranslation) => applyTranslation(translated));
  });
};

const updateMeta = (outputPath) => {
  if (path.resolve(outputPath) !== path.resolve(defaultInputPath)) return;
  if (!fs.existsSync(defaultMetaScript)) return;
  execFileSync('node', [defaultMetaScript], { cwd: speakappRoot, stdio: 'inherit' });
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(options.inputPath)) {
    throw new Error(`Input file not found: ${options.inputPath}`);
  }

  const payload = readJson(options.inputPath);
  const { jobs, rawTargetCount } = collectJobs(payload, options);

  console.log(`[translate-training-data-es] sessions: ${Array.isArray(payload.sessions) ? payload.sessions.length : 0}`);
  console.log(`[translate-training-data-es] pending fields: ${rawTargetCount}`);
  console.log(`[translate-training-data-es] unique texts to translate: ${jobs.length}`);

  if (!jobs.length) {
    if (!options.dryRun && options.outputPath !== options.inputPath) {
      writeJson(options.outputPath, payload);
      updateMeta(options.outputPath);
    }
    console.log('[translate-training-data-es] nothing to do');
    return;
  }

  jobs.slice(0, Math.min(10, jobs.length)).forEach((job) => {
    console.log(`- ${job.kind}: ${job.sourceText} -> ${job.samplePaths.join(', ')}`);
  });

  if (options.dryRun) {
    console.log('[translate-training-data-es] dry-run only, no API calls made');
    return;
  }

  if (!options.apiKey) {
    throw new Error('OPENAI_API_KEY is required unless --api-key is provided');
  }

  for (let start = 0; start < jobs.length; start += options.batchSize) {
    const batch = jobs.slice(start, start + options.batchSize);
    const batchIndex = Math.floor(start / options.batchSize) + 1;
    const batchCount = Math.ceil(jobs.length / options.batchSize);
    console.log(`[translate-training-data-es] translating batch ${batchIndex}/${batchCount} (${batch.length} texts)`);
    await translateBatch(batch, options);
  }

  if (path.resolve(options.outputPath) === path.resolve(options.inputPath) && options.backup) {
    const backupPath = makeBackupPath(options.outputPath);
    fs.copyFileSync(options.outputPath, backupPath);
    console.log(`[translate-training-data-es] backup: ${backupPath}`);
  }

  writeJson(options.outputPath, payload);
  updateMeta(options.outputPath);
  console.log(`[translate-training-data-es] wrote: ${options.outputPath}`);
};

main().catch((err) => {
  const message = err && err.message ? err.message : String(err);
  console.error(`[translate-training-data-es] ${message}`);
  if (err && err.payload) {
    console.error(err.payload);
  }
  process.exit(1);
});
