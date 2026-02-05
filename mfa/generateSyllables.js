// generateSyllables.js
// Usage:
//   node generateSyllables.js /path/to/words_output /path/to/syllables_output

const fs = require("fs");
const path = require("path");

const defaultInputDir = path.resolve(__dirname, "output", "words");
const defaultOutputDir = path.resolve(__dirname, "output", "syllables");
const inputDir = process.argv[2] || defaultInputDir;
const outputDir = process.argv[3] || defaultOutputDir;

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function isTextFile(file) {
  return file.toLowerCase().endsWith(".words.json");
}

function splitSyllables(word) {
  const clean = (word || "").toLowerCase().replace(/[^a-z]/g, "");
  if (!clean) return [];

  const vowels = "aeiouy";
  const chunks = clean.match(/[aeiouy]+|[^aeiouy]+/g) || [clean];
  const syllables = [];
  let current = "";
  let haveVowel = false;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const isVowel = vowels.includes(chunk[0]);
    if (isVowel) {
      haveVowel = true;
      current += chunk;
      continue;
    }

    if (haveVowel) {
      const nextHasVowel = chunks.slice(i + 1).some((c) => vowels.includes(c[0]));
      if (nextHasVowel && chunk.length > 1) {
        const splitAt = chunk.length - 1;
        current += chunk.slice(0, splitAt);
        syllables.push(current);
        current = chunk.slice(splitAt);
        haveVowel = false;
      } else if (nextHasVowel) {
        syllables.push(current);
        current = chunk;
        haveVowel = false;
      } else {
        current += chunk;
      }
    } else {
      current += chunk;
    }
  }

  if (current) syllables.push(current);
  return syllables.length ? syllables : [clean];
}

function buildSyllables(words) {
  return words.map((entry) => {
    const segments = splitSyllables(entry.word);
    const start = entry.start;
    const end = entry.end;
    const duration = Math.max(0, end - start);

    if (!segments.length || duration === 0) {
      return {
        word: entry.word,
        start,
        end,
        syllables: []
      };
    }

    const totalChars = segments.reduce((sum, seg) => sum + seg.length, 0) || segments.length;
    let cursor = start;
    const syllables = segments.map((seg, idx) => {
      const weight = totalChars ? seg.length / totalChars : 1 / segments.length;
      const segDuration = idx === segments.length - 1 ? end - cursor : duration * weight;
      const segStart = cursor;
      const segEnd = idx === segments.length - 1 ? end : cursor + segDuration;
      cursor = segEnd;
      return {
        text: seg,
        start: Number(segStart.toFixed(3)),
        end: Number(segEnd.toFixed(3)),
        index: idx
      };
    });

    return {
      word: entry.word,
      start,
      end,
      syllables
    };
  });
}

function processFile(filePath) {
  const baseName = path.basename(filePath).replace(/\.words\.json$/i, "");
  const outPath = path.join(outputDir, `${baseName}.syllables.json`);

  const words = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const output = buildSyllables(words || []);

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
}

function main() {
  const files = fs
    .readdirSync(inputDir)
    .filter(isTextFile)
    .map((f) => path.join(inputDir, f));

  console.log(`Found ${files.length} words files in ${inputDir}`);
  for (const file of files) {
    processFile(file);
  }

  console.log("Syllables output ready.");
}

main();
