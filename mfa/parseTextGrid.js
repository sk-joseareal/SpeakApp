// parseTextGrid.js
const fs = require("fs");

/**
 * Parsea un TextGrid de MFA y devuelve:
 * {
 *   phones: [{ start, end, text }],
 *   words:  [{ start, end, text }]
 * }
 *
 * Asume que los tiers se llaman algo tipo "phones" y "words"
 * (lo típico de MFA). Si en tu caso cambian, ajusta los includes().
 */
function parseTextGrid(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  const phones = [];
  const words = [];

  let currentTier = null;        // "phones" | "words" | null
  let currentInterval = null;
  let tierName = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Inicio de nuevo tier
    if (line.startsWith("item [")) {
      // cerrar posible intervalo "colgado"
      if (currentInterval && currentTier) {
        pushInterval(currentTier, currentInterval, phones, words);
      }
      currentTier = null;
      currentInterval = null;
      tierName = null;
      continue;
    }

    // Nombre del tier
    if (line.startsWith("name =")) {
      const m = line.match(/name\s*=\s*\"(.*)\"/);
      tierName = m ? m[1] : null;

      if (tierName) {
        const lname = tierName.toLowerCase();
        if (lname.includes("phone")) {
          currentTier = "phones";
        } else if (lname.includes("word")) {
          currentTier = "words";
        } else {
          currentTier = null;
        }
      }
      continue;
    }

    // Solo nos interesan intervals dentro de tiers de phones o words
    if (!currentTier) continue;

    if (line.startsWith("intervals [")) {
      // cerrar intervalo anterior
      if (currentInterval) {
        pushInterval(currentTier, currentInterval, phones, words);
      }
      currentInterval = { start: null, end: null, text: "" };
    } else if (line.startsWith("xmin =")) {
      const value = parseFloat(line.split("=")[1].trim());
      if (currentInterval) currentInterval.start = value;
    } else if (line.startsWith("xmax =")) {
      const value = parseFloat(line.split("=")[1].trim());
      if (currentInterval) currentInterval.end = value;
    } else if (line.startsWith("text =")) {
      const match = line.match(/text\s*=\s*\"(.*)\"/);
      const value = match ? match[1] : "";
      if (currentInterval) currentInterval.text = value;
    }
  }

  // último intervalo
  if (currentInterval && currentTier) {
    pushInterval(currentTier, currentInterval, phones, words);
  }

  return { phones, words };
}

function pushInterval(tier, interval, phones, words) {
  if (interval.start == null || interval.end == null) return;
  const text = (interval.text || "").trim();
  const out = { start: interval.start, end: interval.end, text };

  if (tier === "phones") {
    phones.push(out);
  } else if (tier === "words") {
    words.push(out);
  }
}

module.exports = { parseTextGrid };
