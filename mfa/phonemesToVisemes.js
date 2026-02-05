// phonemesToVisemes.js
const { PHONEME_TO_VISEME, IGNORE_PHONEMES } = require("./phonemeToViseme");

/**
 * Recibe:
 *   [{ start, end, text: "HH" }, ...]
 * Devuelve:
 *   [{ start, end, viseme: "NEUTRAL" }, ...]
 * colapsando intervalos consecutivos con el mismo visema.
 */
function phonemeIntervalsToVisemes(phonemeIntervals) {
  const visemeIntervals = [];

  for (const interval of phonemeIntervals) {
    let phoneme = (interval.text || "").trim();

    if (!phoneme || IGNORE_PHONEMES.has(phoneme)) continue;

    // Quitar dígitos de estrés tipo "AE1", "IY0"
    phoneme = phoneme.replace(/[0-2]$/, "");

    const viseme = PHONEME_TO_VISEME[phoneme];
    if (!viseme) {
      // Si no tienes mapeo, o lo saltas o lo mandas a NEUTRAL.
      // Aquí, por simplicidad, lo saltamos:
      // continue;
      // Si prefieres neutral:
      // viseme = "NEUTRAL";
      continue;
    }

    const last = visemeIntervals[visemeIntervals.length - 1];

    // Colapsar intervalos consecutivos con el mismo viseme
    if (last && last.viseme === viseme && last.end === interval.start) {
      last.end = interval.end;
    } else {
      visemeIntervals.push({
        start: interval.start,
        end: interval.end,
        viseme,
      });
    }
  }

  return visemeIntervals;
}

module.exports = { phonemeIntervalsToVisemes };
