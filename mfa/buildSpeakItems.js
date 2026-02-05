// buildSpeakItems.js
// Generates a stable items table from SpeakApp training data.
// Usage:
//   node buildSpeakItems.js /path/to/training-data.json /path/to/output/items.json

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  console.error("Usage: node buildSpeakItems.js TRAINING_DATA.json OUTPUT_ITEMS.json");
  process.exit(1);
}

const training = JSON.parse(fs.readFileSync(inputPath, "utf8"));

const CONTRACTIONS = {
  "i'm": "i am",
  "i'd": "i would",
  "i'll": "i will",
  "i've": "i have",
  "you're": "you are",
  "you'd": "you would",
  "you'll": "you will",
  "you've": "you have",
  "we're": "we are",
  "we'd": "we would",
  "we'll": "we will",
  "we've": "we have",
  "they're": "they are",
  "they'd": "they would",
  "they'll": "they will",
  "they've": "they have",
  "it's": "it is",
  "that's": "that is",
  "can't": "cannot",
  "won't": "will not",
  "don't": "do not",
  "isn't": "is not",
  "aren't": "are not",
  "wasn't": "was not",
  "weren't": "were not"
};

function normalizeKey(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 50);
}

function hashText(text) {
  return crypto.createHash("sha1").update(text).digest("hex").slice(0, 8);
}

function isAllCaps(text) {
  const letters = (text || "").replace(/[^A-Za-z]/g, "");
  return letters.length > 0 && letters === letters.toUpperCase();
}

function makeTtsText(text) {
  const trimmed = (text || "").trim();
  return isAllCaps(trimmed) ? trimmed.toLowerCase() : trimmed;
}

function makeAlignText(text) {
  let t = (text || "").toLowerCase().replace(/[’‘]/g, "'");
  for (const [key, value] of Object.entries(CONTRACTIONS)) {
    t = t.replace(new RegExp(`\\b${escapeRegExp(key)}\\b`, "g"), value);
  }
  t = t.replace(/[^a-z0-9'\s]/g, " ");
  t = t.replace(/'/g, "");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const itemsByKey = new Map();

function addItem(text, source) {
  const trimmed = (text || "").trim();
  if (!trimmed) return;

  const key = normalizeKey(trimmed).replace(/[.,!?]+$/g, "").trim();
  if (!key) return;

  if (!itemsByKey.has(key)) {
    const idBase = slugify(key) || "item";
    const id = `${idBase}-${hashText(key)}`;
    const tts = makeTtsText(trimmed);
    const align = makeAlignText(tts);

    itemsByKey.set(key, {
      id,
      text: trimmed,
      normalized: key,
      tts,
      align,
      sources: []
    });
  }

  const item = itemsByKey.get(key);
  if (source) item.sources.push(source);
}

const sessions = training.sessions || [];

for (const session of sessions) {
  const base = session.id || "session";
  const speak = session.speak || {};

  addItem(speak.sound && speak.sound.expected, `${base}.sound.expected`);

  const spelling = speak.spelling || {};
  if (Array.isArray(spelling.words)) {
    spelling.words.forEach((word) => addItem(word, `${base}.spelling.words`));
  }
  addItem(spelling.expected, `${base}.spelling.expected`);

  const sentence = speak.sentence || {};
  addItem(sentence.sentence, `${base}.sentence.sentence`);
  addItem(sentence.expected, `${base}.sentence.expected`);
}

const items = Array.from(itemsByKey.values()).sort((a, b) =>
  a.id.localeCompare(b.id)
);

const lookup = {};
for (const item of items) {
  lookup[item.normalized] = item.id;
}

const output = {
  generatedAt: new Date().toISOString(),
  items,
  lookup
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");

console.log(`Items generated: ${items.length}`);
console.log(`Output: ${outputPath}`);
