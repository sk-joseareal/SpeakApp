const SUPPORTED_LOCALES = new Set(['es', 'en']);
const APP_COPY_URL = new URL('../../data/app-copy.json', import.meta.url).href;
const APP_COPY_AUDIO_URL = new URL('../../data/app-copy-audio.json', import.meta.url).href;
const EMPTY_APP_COPY = { es: {}, en: {} };
const EMPTY_APP_COPY_AUDIO = { locales: { es: {}, en: {} } };

export const LOCALE_META = {
  es: {
    code: 'es',
    label: 'Spanish',
    flag: 'assets/flags/spain.png',
    alt: 'Spanish',
    ttsLang: 'es-ES'
  },
  en: {
    code: 'en',
    label: 'English',
    flag: 'assets/flags/eeuu.png',
    alt: 'English',
    ttsLang: 'en-US'
  }
};

const isPlainObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

const loadAppCopyPayload = () => {
  if (typeof window === 'undefined' || typeof XMLHttpRequest === 'undefined') {
    return EMPTY_APP_COPY;
  }

  try {
    const xhr = new XMLHttpRequest();
    const cacheBustedUrl = `${APP_COPY_URL}${APP_COPY_URL.includes('?') ? '&' : '?'}_ts=${Date.now()}`;
    xhr.open('GET', cacheBustedUrl, false);
    xhr.setRequestHeader('Cache-Control', 'no-cache');
    xhr.setRequestHeader('Pragma', 'no-cache');
    xhr.send(null);

    if (xhr.status && xhr.status !== 0 && (xhr.status < 200 || xhr.status >= 300)) {
      throw new Error(`HTTP ${xhr.status}`);
    }

    const payload = JSON.parse(xhr.responseText || '{}');
    if (!isPlainObject(payload) || !isPlainObject(payload.es) || !isPlainObject(payload.en)) {
      throw new Error('payload must contain root locales "es" and "en"');
    }
    return payload;
  } catch (error) {
    console.error('[copy] unable to load app copy payload from data/app-copy.json', error);
    return EMPTY_APP_COPY;
  }
};

const loadAppCopyAudioPayload = () => {
  if (typeof window === 'undefined' || typeof XMLHttpRequest === 'undefined') {
    return EMPTY_APP_COPY_AUDIO;
  }

  try {
    const xhr = new XMLHttpRequest();
    const cacheBustedUrl = `${APP_COPY_AUDIO_URL}${APP_COPY_AUDIO_URL.includes('?') ? '&' : '?'}_ts=${Date.now()}`;
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
    if (!isPlainObject(payload.locales.es) || !isPlainObject(payload.locales.en)) {
      throw new Error('payload must contain root locales "es" and "en"');
    }
    return payload;
  } catch (error) {
    console.error('[copy] unable to load app copy audio payload from data/app-copy-audio.json', error);
    return EMPTY_APP_COPY_AUDIO;
  }
};

const APP_COPY = loadAppCopyPayload();
const APP_COPY_AUDIO = loadAppCopyAudioPayload();

const resolveNarrationLocale = (locale) => {
  const normalized = String(locale || '').trim().toLowerCase();
  if (normalized.startsWith('es')) return 'es';
  if (normalized.startsWith('en')) return 'en';
  return resolveLocale(locale);
};

export const normalizeLocale = (locale) => {
  const normalized = String(locale || '').trim().toLowerCase();
  return SUPPORTED_LOCALES.has(normalized) ? normalized : '';
};

export const resolveLocale = (locale, fallback = 'en') => {
  const normalized = normalizeLocale(locale);
  if (normalized) return normalized;
  const fallbackLocale = normalizeLocale(fallback);
  return fallbackLocale || 'en';
};

export const getLocaleMeta = (locale) => {
  const resolved = resolveLocale(locale);
  return LOCALE_META[resolved] || LOCALE_META.en;
};

export const getNextLocaleCode = (locale) => {
  const resolved = resolveLocale(locale);
  return resolved === 'en' ? 'es' : 'en';
};

export const getCopyBundle = (locale) => {
  const resolved = resolveLocale(locale);
  return APP_COPY[resolved] || APP_COPY.en || EMPTY_APP_COPY.en;
};

export const getOnboardingCopy = (locale) => getCopyBundle(locale).onboarding;
export const getHomeCopy = (locale) => getCopyBundle(locale).home;
export const getFreeRideCopy = (locale) => getCopyBundle(locale).freeRide;
export const getSpeakCopy = (locale) => getCopyBundle(locale).speak;

const normalizeNarrationText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const normalizeNarrationLookupKey = (value) => normalizeNarrationText(value).toLowerCase();

export const getAppCopyNarrationPayload = (locale, text) => {
  const resolved = resolveNarrationLocale(locale);
  const localePayload =
    APP_COPY_AUDIO && APP_COPY_AUDIO.locales && isPlainObject(APP_COPY_AUDIO.locales[resolved])
      ? APP_COPY_AUDIO.locales[resolved]
      : {};
  const key = normalizeNarrationText(text);
  if (!key) return null;
  const lookupKey = normalizeNarrationLookupKey(key);
  const direct = localePayload[key];
  const lookup =
    localePayload.lookup && typeof localePayload.lookup === 'object'
      ? localePayload.lookup[lookupKey]
      : '';
  let payload = direct || (lookup ? localePayload[lookup] : null);
  if (!payload) {
    payload = Object.entries(localePayload).find(([entryKey, entryValue]) => {
      if (entryKey === 'lookup') return false;
      if (!entryValue || typeof entryValue !== 'object') return false;
      const candidate = normalizeNarrationLookupKey(entryValue.text || entryKey);
      return candidate === lookupKey;
    })?.[1] || null;
  }
  if (!payload || typeof payload !== 'object') return null;
  return {
    ok: true,
    source: 'app-copy-audio',
    ...payload,
    words: Array.isArray(payload.words) ? payload.words.map((item) => ({ ...item })) : []
  };
};

const normalizeCopyList = (value) =>
  Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : [];

const cloneToneMap = (source, tones = ['good', 'okay', 'bad', 'neutral']) => {
  const safeSource = source && typeof source === 'object' ? source : {};
  const output = {};
  tones.forEach((tone) => {
    output[tone] = normalizeCopyList(safeSource[tone]);
  });
  return output;
};

export const getSpeakFeedbackPhrases = (locale) => {
  const resolved = resolveLocale(locale);
  const speakCopy = getSpeakCopy(resolved) || {};
  const summaryPhrases =
    speakCopy.summaryPhrases && typeof speakCopy.summaryPhrases === 'object' ? speakCopy.summaryPhrases : {};
  const fallbackGood = [
    speakCopy.feedbackNative || (resolved === 'es' ? 'Suena como un nativo' : 'You sound like a native'),
    resolved === 'es' ? 'Gran trabajo' : 'Great job!'
  ];
  const fallbackOkay = [
    speakCopy.feedbackGood || (resolved === 'es' ? 'Bien. Sigue practicando' : 'Good! Continue practicing'),
    speakCopy.feedbackAlmost || (resolved === 'es' ? 'Casi correcto' : 'Almost Correct!')
  ];
  const fallbackBad = [
    speakCopy.feedbackKeep || (resolved === 'es' ? 'Sigue practicando' : 'Keep practicing'),
    resolved === 'es' ? 'Inténtalo de nuevo' : 'Try again'
  ];
  const fallbackNeutral = [resolved === 'es' ? 'Aún no iniciada' : 'Not started yet'];
  return {
    good: normalizeCopyList(summaryPhrases.good).length ? normalizeCopyList(summaryPhrases.good) : fallbackGood,
    okay: normalizeCopyList(summaryPhrases.okay).length ? normalizeCopyList(summaryPhrases.okay) : fallbackOkay,
    bad: normalizeCopyList(summaryPhrases.bad).length ? normalizeCopyList(summaryPhrases.bad) : fallbackBad,
    neutral: normalizeCopyList(summaryPhrases.neutral).length
      ? normalizeCopyList(summaryPhrases.neutral)
      : fallbackNeutral
  };
};

export const getSpeakFeedbackLabelScale = (locale) => {
  const resolved = resolveLocale(locale);
  const speakCopy = getSpeakCopy(resolved) || {};
  return [
    {
      min: 85,
      label:
        speakCopy.feedbackNative || (resolved === 'es' ? 'Suena como un nativo' : 'You sound like a native')
    },
    {
      min: 70,
      label:
        speakCopy.feedbackGood || (resolved === 'es' ? 'Bien. Sigue practicando' : 'Good! Continue practicing')
    },
    {
      min: 60,
      label: speakCopy.feedbackAlmost || (resolved === 'es' ? 'Casi correcto' : 'Almost Correct!')
    },
    {
      min: 0,
      label: speakCopy.feedbackKeep || (resolved === 'es' ? 'Sigue practicando' : 'Keep practicing')
    }
  ];
};

export const getSpeakSummaryTitleTemplates = (locale) => {
  const resolved = resolveLocale(locale);
  const speakCopy = getSpeakCopy(resolved) || {};
  const source =
    speakCopy.summaryTitleTemplates && typeof speakCopy.summaryTitleTemplates === 'object'
      ? speakCopy.summaryTitleTemplates
      : {};
  const defaults =
    resolved === 'es'
      ? {
          good: ['Muy bien! aprendiste {{session}}', 'Excelente! completaste {{session}}'],
          okay: ['Buen trabajo! sigue practicando {{session}}', 'Vas bien! repasa {{session}}'],
          bad: ['No pasa nada, practica {{session}}', 'Sigue intentandolo con {{session}}']
        }
      : {
          good: ['Great! You learned {{session}}', 'Excellent! You completed {{session}}'],
          okay: ['Good work! Keep practicing {{session}}', 'You are doing well! Review {{session}}'],
          bad: ['No worries, keep practicing {{session}}', 'Keep trying with {{session}}']
        };
  return {
    good: normalizeCopyList(source.good).length ? normalizeCopyList(source.good) : defaults.good,
    okay: normalizeCopyList(source.okay).length ? normalizeCopyList(source.okay) : defaults.okay,
    bad: normalizeCopyList(source.bad).length ? normalizeCopyList(source.bad) : defaults.bad
  };
};

export const getSpeakSummaryLabelPrefix = (locale) => {
  const resolved = resolveLocale(locale);
  const speakCopy = getSpeakCopy(resolved) || {};
  const value = String(speakCopy.summaryLabelPrefix || '').trim();
  if (value) return value;
  return resolved === 'es' ? 'GANAS' : 'YOU WIN';
};

export const ensureLegacySpeakCopyGlobals = () => {
  if (typeof window === 'undefined') return null;

  const tonePhrasesByLocale = {};
  const labelScaleByLocale = {};
  const summaryTitlesByLocale = {};
  const labelPrefixByLocale = {};

  Array.from(SUPPORTED_LOCALES).forEach((locale) => {
    tonePhrasesByLocale[locale] = cloneToneMap(getSpeakFeedbackPhrases(locale));
    labelScaleByLocale[locale] = getSpeakFeedbackLabelScale(locale).map((item) => ({ ...item }));
    summaryTitlesByLocale[locale] = cloneToneMap(getSpeakSummaryTitleTemplates(locale), ['good', 'okay', 'bad']);
    labelPrefixByLocale[locale] = getSpeakSummaryLabelPrefix(locale);
  });

  window.r34lp0w3r = window.r34lp0w3r || {};
  window.r34lp0w3r.speakFeedback = window.r34lp0w3r.speakFeedback || {};
  window.speakSummaryConfig = window.speakSummaryConfig || {};

  if (
    !window.r34lp0w3r.speakFeedback.tonePhrasesByLocale ||
    typeof window.r34lp0w3r.speakFeedback.tonePhrasesByLocale !== 'object'
  ) {
    window.r34lp0w3r.speakFeedback.tonePhrasesByLocale = tonePhrasesByLocale;
  }
  if (
    !window.r34lp0w3r.speakFeedback.labelScaleByLocale ||
    typeof window.r34lp0w3r.speakFeedback.labelScaleByLocale !== 'object'
  ) {
    window.r34lp0w3r.speakFeedback.labelScaleByLocale = labelScaleByLocale;
  }
  if (!Array.isArray(window.r34lp0w3r.speakFeedback.labelScale)) {
    window.r34lp0w3r.speakFeedback.labelScale = labelScaleByLocale.en.map((item) => ({ ...item }));
  }
  if (!window.r34lp0w3r.speakSummaryTitles || typeof window.r34lp0w3r.speakSummaryTitles !== 'object') {
    window.r34lp0w3r.speakSummaryTitles = summaryTitlesByLocale;
  }
  if (!window.speakSummaryConfig.phrases || typeof window.speakSummaryConfig.phrases !== 'object') {
    window.speakSummaryConfig.phrases = tonePhrasesByLocale;
  }
  if (!window.speakSummaryConfig.labelPrefix || typeof window.speakSummaryConfig.labelPrefix !== 'object') {
    window.speakSummaryConfig.labelPrefix = { ...labelPrefixByLocale };
  }

  return {
    tonePhrasesByLocale,
    labelScaleByLocale,
    summaryTitlesByLocale,
    labelPrefixByLocale
  };
};

const formatCopyTemplate = (template, params = {}) =>
  String(template || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) =>
    params[key] === undefined || params[key] === null ? '' : String(params[key])
  );

const withComputedChatCopy = (chatCopy) => {
  const source = chatCopy && typeof chatCopy === 'object' ? chatCopy : {};
  const out = { ...source };
  const dailyTemplate = String(source.hintDailyLimitWithCount || '');
  const listeningTemplate = String(source.hintListening || '');
  const presenceTemplate = String(source.communityPresenceTemplate || '');
  out.hintDailyLimitWithCount =
    typeof source.hintDailyLimitWithCount === 'function'
      ? source.hintDailyLimitWithCount
      : (used, limit) =>
          formatCopyTemplate(dailyTemplate, {
            used,
            limit
          });
  out.hintListening =
    typeof source.hintListening === 'function'
      ? source.hintListening
      : (preview) =>
          formatCopyTemplate(listeningTemplate, {
            preview
          });
  out.communityPresenceCount =
    typeof source.communityPresenceCount === 'function'
      ? source.communityPresenceCount
      : (n) =>
          formatCopyTemplate(presenceTemplate, {
            n
          });
  return out;
};

export const getChatCopy = (locale) => withComputedChatCopy(getCopyBundle(locale).chat);
export const getProfileCopy = (locale) => getCopyBundle(locale).profile;
export const getTabsCopy = (locale) => getCopyBundle(locale).tabs;
export const getNotificationsCopy = (locale) => getCopyBundle(locale).notifications;
export const getLoginCopy = (locale) => getCopyBundle(locale).login;
export const getReferenceCopy = (locale) => getCopyBundle(locale).reference;
