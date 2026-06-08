const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repoRoot = path.resolve(__dirname, '..');
const dataPath = path.join(repoRoot, 'www', 'js', 'data', 'training-data.json');
const outputPath = path.join(repoRoot, 'www', 'js', 'data', 'training-data.meta.js');

const stableJsonStringify = (value) => {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJsonStringify(item)).join(',')}]`;
  }
  switch (typeof value) {
    case 'number':
      return Number.isFinite(value) ? JSON.stringify(value) : 'null';
    case 'boolean':
      return value ? 'true' : 'false';
    case 'string':
      return JSON.stringify(value);
    case 'object': {
      const keys = Object.keys(value).sort();
      const items = [];
      keys.forEach((key) => {
        if (value[key] === undefined) return;
        items.push(`${JSON.stringify(key)}:${stableJsonStringify(value[key])}`);
      });
      return `{${items.join(',')}}`;
    }
    default:
      return 'null';
  }
};

const main = () => {
  const raw = fs.readFileSync(dataPath, 'utf8');
  const parsed = JSON.parse(raw);
  const version = `sha256-${crypto.createHash('sha256').update(stableJsonStringify(parsed)).digest('hex')}`;
  const output = `export const BUNDLE_TRAINING_DATA_VERSION = ${JSON.stringify(version)};\nexport default BUNDLE_TRAINING_DATA_VERSION;\n`;
  fs.writeFileSync(outputPath, output, 'utf8');
  console.log(version);
};

main();
