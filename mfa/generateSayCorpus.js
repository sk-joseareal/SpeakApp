// generateSayCorpus.js
// Usage:
//   node generateSayCorpus.js /path/to/items.json /path/to/output [--force]
//
// Environment:
//   SAY_VOICE=Samantha
//   SAY_RATE=180

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const itemsPath = process.argv[2];
const outputDir = process.argv[3];
const force = process.argv.includes("--force");

if (!itemsPath || !outputDir) {
  console.error("Usage: node generateSayCorpus.js ITEMS.json OUTPUT_DIR [--force]");
  process.exit(1);
}

const voice = process.env.SAY_VOICE || "Samantha";
const rate = process.env.SAY_RATE;

const itemsData = JSON.parse(fs.readFileSync(itemsPath, "utf8"));
const items = itemsData.items || [];

const corpusDir = path.join(outputDir, "corpus");
const audioDir = path.join(outputDir, "audio");

fs.mkdirSync(corpusDir, { recursive: true });
fs.mkdirSync(audioDir, { recursive: true });

function runSayToWav(text, wavPath) {
  const aiffPath = wavPath.replace(/\.wav$/, ".aiff");
  const sayArgs = ["-v", voice, "-o", aiffPath];
  if (rate) {
    sayArgs.push("-r", String(rate));
  }
  sayArgs.push(text);

  execFileSync("say", sayArgs, { stdio: "ignore" });
  execFileSync(
    "afconvert",
    ["-f", "WAVE", "-d", "LEI16@16000", "-c", "1", aiffPath, wavPath],
    { stdio: "ignore" }
  );
  fs.unlinkSync(aiffPath);
}

let generated = 0;

for (const item of items) {
  const id = item.id;
  const text = item.tts || item.text;
  const alignText = item.align || item.tts || item.text;

  if (!id || !text) continue;

  const wavPath = path.join(corpusDir, `${id}.wav`);
  const txtPath = path.join(corpusDir, `${id}.txt`);
  const audioPath = path.join(audioDir, `${id}.wav`);

  fs.writeFileSync(txtPath, alignText, "utf8");

  if (force || !fs.existsSync(wavPath)) {
    console.log(`Generating: ${id}`);
    runSayToWav(text, wavPath);
    generated += 1;
  }

  fs.copyFileSync(wavPath, audioPath);
}

console.log(`Done. Generated ${generated} audio files.`);
console.log(`Corpus: ${corpusDir}`);
console.log(`Audio:  ${audioDir}`);
