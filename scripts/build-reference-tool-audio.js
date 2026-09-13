#!/usr/bin/env node

/*
 * Plans and optionally generates the non-aligned audio used by Learn tools.
 * Generation is opt-in: without --execute this script never calls the API.
 */

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_ENDPOINT = 'https://api.curso-ingles.com/realtime/tts/audio';
const DEFAULT_DATA_DIR = path.resolve(__dirname, '../www/data/tools');
const DEFAULT_OUTPUT = path.resolve(__dirname, '../www/data/tools-audio.json');
const COST_PER_MILLION = {
  standard: 4,
  neural: 16,
  generative: 30,
};

const TOOL_FILES = [
  'expressions',
  'proverbs',
  'regverbs',
  'irregverbs',
  'quotes',
  'phrasalverbs',
  'vocabs',
  'conjugations',
];

function parseArgs(argv) {
  const options = {
    endpoint: DEFAULT_ENDPOINT,
    dataDir: DEFAULT_DATA_DIR,
    output: DEFAULT_OUTPUT,
    locale: 'en-US',
    engine: 'neural',
    max: null,
    execute: false,
    writePlan: null,
    // Do not force a profile: preserve the backend's configured default voice.
    voiceProfile: null,
    includeConjugations: false,
    concurrency: 3,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--execute') options.execute = true;
    else if (arg === '--include-conjugations') options.includeConjugations = true;
    else if (arg === '--endpoint') options.endpoint = argv[++i];
    else if (arg === '--data-dir') options.dataDir = path.resolve(argv[++i]);
    else if (arg === '--output') options.output = path.resolve(argv[++i]);
    else if (arg === '--locale') options.locale = argv[++i];
    else if (arg === '--engine') options.engine = argv[++i];
    else if (arg === '--voice-profile') options.voiceProfile = argv[++i];
    else if (arg === '--max') options.max = Number(argv[++i]);
    else if (arg === '--concurrency') options.concurrency = Number(argv[++i]);
    else if (arg === '--write-plan') options.writePlan = path.resolve(argv[++i]);
    else if (arg === '--help' || arg === '-h') printHelp(0);
    else fail(`Unknown option: ${arg}`);
  }

  if (!COST_PER_MILLION[options.engine]) {
    fail(`Unsupported engine "${options.engine}". Use standard, neural or generative.`);
  }
  if (!options.locale) fail('--locale cannot be empty');
  if (options.max !== null && (!Number.isInteger(options.max) || options.max < 1)) {
    fail('--max must be a positive integer');
  }
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1) {
    fail('--concurrency must be a positive integer');
  }
  return options;
}

function printHelp(exitCode) {
  console.log(`Usage: node scripts/build-reference-tool-audio.js [options]

Plans by default. Add --execute only after reviewing the estimate.

Options:
  --write-plan FILE       Save the dry-run plan as JSON
  --execute               Call the non-aligned TTS endpoint and write a manifest
  --output FILE           Manifest path (default: www/data/tools-audio.json)
  --data-dir DIR          Tool JSON directory
  --locale LOCALE         Locale sent to the endpoint (default: en-US)
  --engine ENGINE         standard, neural or generative (default: neural)
  --voice-profile NAME    Optional backend voice profile
  --include-conjugations  Include the dynamically generated conjugation sentences
  --endpoint URL          TTS endpoint
  --max N                 Limit generation/planning to the first N unique texts
  --concurrency N         Maximum simultaneous TTS requests (default: 3)
`);
  process.exit(exitCode);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function addText(items, text, source) {
  if (typeof text !== 'string') return;
  const value = text.replace(/\s+/g, ' ').trim();
  if (!value) return;
  const existing = items.get(value);
  if (existing) existing.sources.push(source);
  else items.set(value, { text: value, sources: [source] });
}

function walkConjugationTenses(value, source, items) {
  if (typeof value === 'string') {
    addText(items, value, source);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    walkConjugationTenses(child, `${source}.${key}`, items);
  }
}

function collectToolTexts(dataDir, includeConjugations = false) {
  const items = new Map();
  const read = (name) => JSON.parse(fs.readFileSync(path.join(dataDir, `${name}.json`), 'utf8'));

  for (const name of ['expressions', 'proverbs', 'regverbs', 'irregverbs']) {
    const root = read(name)[name];
    for (const section of ['featured', 'data']) {
      const entries = Array.isArray(root?.[section]) ? root[section] : [];
      entries.forEach((item, index) => {
        addText(items, item.name, `${name}.${section}[${index}].name`);
        if (name === 'expressions') addText(items, item.example, `${name}.${section}[${index}].example`);
        if (name === 'regverbs' || name === 'irregverbs') {
          for (const field of ['present', 'past_simple', 'past_participle', 'gerund']) {
            addText(items, item[field], `${name}.${section}[${index}].${field}`);
          }
        }
      });
    }
  }

  const quotes = read('quotes').quotes;
  for (const [category, entries] of Object.entries(quotes || {})) {
    (Array.isArray(entries) ? entries : []).forEach((item, index) => {
      addText(items, item.text, `quotes.${category}[${index}].text`);
    });
  }

  const phrasalRoot = read('phrasalverbs').phrasverbs || {};
  for (const section of ['featured', 'data']) {
    const entries = Array.isArray(phrasalRoot[section]) ? phrasalRoot[section] : [];
    entries.forEach((item, index) => {
      addText(items, item.name, `phrasalverbs.${section}[${index}].name`);
      (item.examples || []).forEach((example, exampleIndex) => {
        addText(items, example.example, `phrasalverbs.${section}[${index}].examples[${exampleIndex}]`);
      });
    });
  }

  const vocabs = read('vocabs').vocabs || [];
  vocabs.forEach((group, groupIndex) => {
    (group.vocabularies || []).forEach((vocabulary, vocabularyIndex) => {
      (vocabulary.words || []).forEach((word, wordIndex) => {
        addText(items, word.name, `vocabs[${groupIndex}].vocabularies[${vocabularyIndex}].words[${wordIndex}].name`);
      });
    });
  });

  if (includeConjugations) {
    const conjugations = read('conjugations').conjugations || {};
    for (const [verb, data] of Object.entries(conjugations.data || {})) {
      addText(items, data.infinitive || data.verb || verb, `conjugations.data.${verb}.infinitive`);
      walkConjugationTenses(data.tenses, `conjugations.data.${verb}.tenses`, items);
    }
  }

  return [...items.values()];
}

function createPlan(options, items) {
  const selected = options.max ? items.slice(0, options.max) : items;
  const characters = selected.reduce((sum, item) => sum + item.text.length, 0);
  const rate = COST_PER_MILLION[options.engine];
  return {
    generatedAt: new Date().toISOString(),
    endpoint: options.endpoint,
    locale: options.locale,
    engine: options.engine,
    voiceProfile: options.voiceProfile,
    uniqueTexts: selected.length,
    characters,
    estimatedUsd: Number(((characters / 1_000_000) * rate).toFixed(6)),
    estimateNote: 'Upper bound assuming every text is synthesized; cached endpoint responses do not incur new synthesis cost.',
    items: selected,
  };
}

function printPlan(plan, options) {
  console.log(`TTS tool audio plan (${options.locale}, ${options.engine})`);
  console.log(`Unique texts: ${plan.uniqueTexts}`);
  console.log(`Characters:   ${plan.characters}`);
  console.log(`Estimated:    $${plan.estimatedUsd.toFixed(6)} USD`);
  console.log('');
  console.log('Sources:');
  const counts = new Map();
  for (const item of plan.items) {
    const key = item.sources[0].split('.')[0];
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  for (const [source, count] of counts) console.log(`  ${source}: ${count}`);
  console.log('');
  console.log(options.execute ? `Generating into ${options.output}` : 'Dry run only. No TTS request was made.');
}

async function generate(options, plan) {
  const token = process.env.RT_TOKEN || process.env.TTS_RT_TOKEN;
  if (!token) fail('Set RT_TOKEN or TTS_RT_TOKEN before using --execute.');

  const results = new Array(plan.items.length);
  let nextIndex = 0;
  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= plan.items.length) return;
      const item = plan.items[index];
      const body = { text: item.text, locale: options.locale, engine: options.engine };
      if (options.voiceProfile) body.voice_profile = options.voiceProfile;
      let response;
      let payload;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        response = await fetch(options.endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-rt-token': token },
          body: JSON.stringify(body),
        });
        payload = await response.json().catch(() => ({}));
        const retryable = response.status === 429 || response.status >= 500 || payload.message === 'Rate exceeded';
        if ((response.ok && payload.ok !== false) || !retryable || attempt === 4) break;
        await new Promise((resolve) => setTimeout(resolve, 1000 * (2 ** attempt)));
      }
      if (!response.ok || payload.ok === false) {
        fail(`TTS failed for item ${index + 1}/${plan.items.length}: ${response.status} ${JSON.stringify(payload)}`);
      }
      results[index] = { ...item, audio: payload };
      console.log(`[${index + 1}/${plan.items.length}] ${payload.cached ? 'cached' : 'generated'} ${item.text}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(options.concurrency, plan.items.length) }, worker));

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    endpoint: options.endpoint,
    locale: options.locale,
    engine: options.engine,
    voiceProfile: options.voiceProfile || null,
    items: results,
  };
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Manifest written to ${options.output}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const items = collectToolTexts(options.dataDir, options.includeConjugations);
  const plan = createPlan(options, items);
  printPlan(plan, options);
  if (options.writePlan) {
    fs.mkdirSync(path.dirname(options.writePlan), { recursive: true });
    fs.writeFileSync(options.writePlan, `${JSON.stringify(plan, null, 2)}\n`);
    console.log(`Plan written to ${options.writePlan}`);
  }
  if (options.execute) await generate(options, plan);
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
