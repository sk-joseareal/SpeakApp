// generateSentenceList.js
const fs = require("fs");
const path = require("path");

// Uso:
//   node generateSentenceList.js [VISEMES_DIR] [OUTPUT_DIR]
//
// Por defecto usa:
//   SpeakApp/mfa/output/visemes -> SpeakApp/mfa/output/sentences.json

const defaultVisemesDir = path.resolve(__dirname, "output", "visemes");
const defaultOutputDir = path.resolve(__dirname, "output");

const VISEMES_DIR = process.argv[2] || defaultVisemesDir;
const OUTPUT_DIR = process.argv[3] || defaultOutputDir;

const OUTPUT = path.join(OUTPUT_DIR, "sentences.json");

function main() {
  // Comprobar carpeta de visemas
  if (!fs.existsSync(VISEMES_DIR)) {
    console.error("No existe la carpeta de visemas:", VISEMES_DIR);
    process.exit(1);
  }

  // Crear carpeta output si no existe
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log("Carpeta creada:", OUTPUT_DIR);
  }

  const files = fs.readdirSync(VISEMES_DIR);

  const ids = files
    .filter(f => f.endsWith(".visemes.json"))
    .map(f => f.replace(".visemes.json", ""));

  fs.writeFileSync(OUTPUT, JSON.stringify(ids, null, 2));

  console.log("sentences.json generado con:", ids.length, "frases");
  console.log("Archivo:", OUTPUT);
}

main();
