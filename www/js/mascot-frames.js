export const HERO_MASCOT_FRAMES = [
  'assets/mascot/nena/mascota_18.png',
  'assets/mascot/nena/mascota_2.png',
  'assets/mascot/nena/mascota_3.png',
  'assets/mascot/nena/mascota_4.png',
  'assets/mascot/nena/mascota_6.png',
  'assets/mascot/nena/mascota_7.png',
  'assets/mascot/nena/mascota_8.png',
  'assets/mascot/nena/mascota_9.png',
  'assets/mascot/nena/mascota_10.png',
  'assets/mascot/nena/mascota_14.png',
  'assets/mascot/nena/mascota_16.png',
  'assets/mascot/nena/mascota_17.png'
];

export const HERO_MASCOT_REST_FRAME = 0;
export const HERO_MASCOT_FRAME_COUNT = HERO_MASCOT_FRAMES.length;
export const HERO_MASCOT_TALK_FRAME_SEQUENCE = HERO_MASCOT_FRAMES
  .map((_src, index) => index)
  .filter((index) => index !== HERO_MASCOT_REST_FRAME);
export const HERO_MASCOT_FRAME_INTERVAL_MS = 150;

export function normalizeHeroMascotFrameIndex(frameIndex) {
  const value = Number(frameIndex);
  if (!Number.isFinite(value)) return HERO_MASCOT_REST_FRAME;
  const rounded = Math.round(value);
  return Math.min(Math.max(rounded, 0), HERO_MASCOT_FRAME_COUNT - 1);
}

export function getHeroMascotFramePath(frameIndex = HERO_MASCOT_REST_FRAME) {
  const normalized = normalizeHeroMascotFrameIndex(frameIndex);
  return HERO_MASCOT_FRAMES[normalized] || HERO_MASCOT_FRAMES[HERO_MASCOT_REST_FRAME];
}

export function preloadHeroMascotFrames() {
  HERO_MASCOT_FRAMES.forEach((src) => {
    new Image().src = src;
  });
}
