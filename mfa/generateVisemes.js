// generateVisemes.js
const fs = require("fs");
const path = require("path");
const { parseTextGrid } = require("./parseTextGrid");
const { phonemeIntervalsToVisemes } = require("./phonemesToVisemes");

// Directorios por defecto (ajusta si quieres)
const defaultInputDir = path.resolve(__dirname, "output", "aligned");
const defaultOutputDir = path.resolve(__dirname, "output", "visemes");
const inputDir = process.argv[2] || defaultInputDir;
const outputDir = process.argv[3] || defaultOutputDir;

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function isTextGrid(file) {
  return file.toLowerCase().endsWith(".textgrid");
}

function processFile(filePath) {
  const baseName = path.basename(filePath, path.extname(filePath));
  const outPath  = path.join(outputDir, `${baseName}.visemes.json`);

  console.log(`Procesando visemas de ${baseName}...`);

  const { phones } = parseTextGrid(filePath);
  const phonemeIntervals = phones;

  const visemeIntervals = phonemeIntervalsToVisemes(phonemeIntervals);

  fs.writeFileSync(outPath, JSON.stringify(visemeIntervals, null, 2), "utf8");
}

function main() {
  const files = fs
    .readdirSync(inputDir)
    .filter(isTextGrid)
    .map((f) => path.join(inputDir, f));

  console.log(`Encontrados ${files.length} TextGrid en ${inputDir}`);

  for (const file of files) {
    try {
      processFile(file);
    } catch (err) {
      console.error(`Error procesando ${file}:`, err);
    }
  }

  console.log("Listo visemes.");
}

main();
