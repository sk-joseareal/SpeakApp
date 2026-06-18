const SUPPORTED_LOCALES = new Set(['en']);
const SPEAK_AUDIO_URL = new URL('../../data/speak-audio.json', import.meta.url).href;
const EMPTY_SPEAK_AUDIO = { locales: { en: { lookup: {} } } };

const isPlainObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

const normalizeLocale = (locale) => {
  const normalized = String(locale || '').trim().toLowerCase();
  if (normalized.startsWith('en')) return 'en';
  return '';
};

const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const normalizeLookupKey = (value) => normalizeText(value).toLowerCase();

const loadSpeakAudioPayload = () => {
  if (typeof window === 'undefined' || typeof XMLHttpRequest === 'undefined') {
    return EMPTY_SPEAK_AUDIO;
  }

  try {
    const xhr = new XMLHttpRequest();
    const cacheBustedUrl = `${SPEAK_AUDIO_URL}${SPEAK_AUDIO_URL.includes('?') ? '&' : '?'}_ts=${Date.now()}`;
    xhr.open('GET', cacheBustedUrl, false);
    xhr.setRequestHeader('Cache-Control', 'no-cache');
    xhr.setRequestHeader('Pragma', 'no-cache');
    xhr.send(null);

    if (xhr.status && xhr.status !== 0 && (xhr.status < 200 || xhr.status >= 300)) {
      throw new Error(`HTTP ${xhr.status}`);
    }

    const payload = JSON.parse(xhr.responseText || '{}');
    if (!isPlainObject(payload) || !isPlainObject(payload.locales)) {
      throw new Error('payload must contain root locales map');
    }
    if (!isPlainObject(payload.locales.en)) {
      throw new Error('payload must contain root locale "en"');
    }
    if (!isPlainObject(payload.locales.en.lookup)) {
      payload.locales.en.lookup = {};
    }
    return payload;
  } catch (error) {
    console.error('[speak-audio] unable to load speak audio payload from data/speak-audio.json', error);
    return EMPTY_SPEAK_AUDIO;
  }
};

const SPEAK_AUDIO = loadSpeakAudioPayload();

export const getSpeakSessionAudioPayload = (locale, text) => {
  const resolved = normalizeLocale(locale) || 'en';
  const localePayload =
    SPEAK_AUDIO && SPEAK_AUDIO.locales && isPlainObject(SPEAK_AUDIO.locales[resolved])
      ? SPEAK_AUDIO.locales[resolved]
      : {};
  const key = normalizeText(text);
  if (!key) return null;
  const lookupKey = normalizeLookupKey(key);
  const direct = localePayload[key];
  const lookup =
    localePayload.lookup && typeof localePayload.lookup === 'object'
      ? localePayload.lookup[lookupKey]
      : '';
  let payload = direct || (lookup ? localePayload[lookup] : null);
  if (!payload) {
    payload =
      Object.entries(localePayload).find(([entryKey, entryValue]) => {
        if (entryKey === 'lookup') return false;
        if (!entryValue || typeof entryValue !== 'object') return false;
        const candidate = normalizeLookupKey(entryValue.text || entryKey);
        return candidate === lookupKey;
      })?.[1] || null;
  }
  if (!payload || typeof payload !== 'object') return null;
  return {
    ok: true,
    source: 'speak-audio',
    ...payload
  };
};

export const getSpeakSessionAudioUrl = (locale, text) => {
  const payload = getSpeakSessionAudioPayload(locale, text);
  return payload && typeof payload.audio_url === 'string' ? payload.audio_url.trim() : '';
};

