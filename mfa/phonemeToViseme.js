// phonemeToViseme.js

// Ajusta estos grupos como quieras para tu avatar
const PHONEME_TO_VISEME = {
  // Vocales abiertas
  AA: "A",
  AE: "A",
  AH: "A",
  AO: "O",
  AW: "O",
  AY: "A",

  // Vocales medias / cerradas
  EH: "E",
  EY: "E",
  IH: "I",
  IY: "I",
  OW: "O",
  UH: "U",
  UW: "U",

  // Bilabiales (labios juntos)
  P: "M",
  B: "M",
  M: "M",

  // Labiodentales
  F: "F",
  V: "F",

  // Dentales (TH)
  TH: "TH",
  DH: "TH",

  // Resto (boca neutral)
  T: "NEUTRAL",
  D: "NEUTRAL",
  S: "NEUTRAL",
  Z: "NEUTRAL",
  N: "NEUTRAL",
  L: "NEUTRAL",
  R: "NEUTRAL",
  K: "NEUTRAL",
  G: "NEUTRAL",
  CH: "NEUTRAL",
  JH: "NEUTRAL",
  SH: "NEUTRAL",
  ZH: "NEUTRAL",
  HH: "NEUTRAL",
};

const IGNORE_PHONEMES = new Set(["", "sp", "sil", "SIL", "pau"]);

module.exports = { PHONEME_TO_VISEME, IGNORE_PHONEMES };
