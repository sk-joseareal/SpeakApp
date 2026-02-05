// generateWords.js
const fs = require("fs");
const path = require("path");
const { parseTextGrid } = require("./parseTextGrid");

// Directorios por defecto
const defaultInputDir = path.resolve(__dirname, "output", "aligned");
const defaultOutputDir = path.resolve(__dirname, "output", "words");
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
  const outPath  = path.join(outputDir, `${baseName}.words.json`);

  console.log(`Procesando palabras de ${baseName}...`);

  const { words } = parseTextGrid(filePath);

  // Limpiamos silencios / vacíos
  const cleaned = words
    .map(w => ({
      start: w.start,
      end:   w.end,
      word:  (w.text || "").trim()
    }))
    .filter(w => w.word.length > 0);

  fs.writeFileSync(outPath, JSON.stringify(cleaned, null, 2), "utf8");
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

  console.log("Listo words.");
}

main();
