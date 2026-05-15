import { translationWorkerClient } from './translation-worker-client.js';

const TRANSLATION_CAPABILITIES_EVENT = 'app:translation-capabilities-change';

const DEFAULT_CAPABILITIES = {
  loading: false,
  checkedAt: 0,
  nativeTranslateEnabled: false,
  chromeTranslatorEnabled: false,
  opusTranslatorEnabled: false,
  native: {
    enabled: false,
    reason: 'unchecked',
    engine: '',
    available: false,
    modelDownloaded: false,
    supportedPair: false
  },
  chrome: {
    enabled: false,
    reason: 'unchecked',
    availability: '',
    apiType: ''
  },
  opus: {
    enabled: false,
    reason: 'unchecked',
    status: 'idle'
  }
};

let refreshPromise = null;

function getGlobalRuntime() {
  window.r34lp0w3r = window.r34lp0w3r || {};
  return window.r34lp0w3r;
}

function cloneCapabilities(value) {
  const caps = value && typeof value === 'object' ? value : DEFAULT_CAPABILITIES;
  return {
    loading: caps.loading === true,
    checkedAt: Number(caps.checkedAt) || 0,
    nativeTranslateEnabled: caps.nativeTranslateEnabled === true,
    chromeTranslatorEnabled: caps.chromeTranslatorEnabled === true,
    opusTranslatorEnabled: caps.opusTranslatorEnabled === true,
    native: { ...(caps.native || DEFAULT_CAPABILITIES.native) },
    chrome: { ...(caps.chrome || DEFAULT_CAPABILITIES.chrome) },
    opus: { ...(caps.opus || DEFAULT_CAPABILITIES.opus) }
  };
}

function commitCapabilities(nextState, dispatch = true) {
  const runtime = getGlobalRuntime();
  const snapshot = cloneCapabilities(nextState);
  runtime.translationCapabilities = snapshot;
  runtime.nativeTranslateEnabled = snapshot.nativeTranslateEnabled;
  runtime.chromeTranslatorEnabled = snapshot.chromeTranslatorEnabled;
  runtime.opusTranslatorEnabled = snapshot.opusTranslatorEnabled;
  if (dispatch) {
    window.dispatchEvent(new CustomEvent(TRANSLATION_CAPABILITIES_EVENT, { detail: cloneCapabilities(snapshot) }));
  }
  return snapshot;
}

function isNativeRuntime() {
  const cap = window.Capacitor;
  if (!cap) return false;
  if (typeof cap.isNativePlatform === 'function') return cap.isNativePlatform();
  const platform = typeof cap.getPlatform === 'function' ? cap.getPlatform() : cap.platform;
  return platform === 'ios' || platform === 'android';
}

export function resolveChromeTranslatorApi() {
  if (isNativeRuntime()) return null;
  const w = typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : {});
  if (w.translation && typeof w.translation.canTranslate === 'function') {
    return {
      type: 'self.translation',
      canTranslate: (o) => w.translation.canTranslate(o),
      createTranslator: (o) => w.translation.createTranslator(o)
    };
  }
  const Cls = w.Translator;
  if (typeof Cls === 'function') {
    const canTranslate = typeof Cls.canTranslate === 'function'
      ? (o) => Cls.canTranslate(o)
      : typeof Cls.availability === 'function'
        ? async (o) => {
            const v = await Cls.availability(o);
            return v === 'available' ? 'readily' : v === 'unavailable' ? 'no' : 'after-download';
          }
        : () => Promise.resolve('readily');
    const createTranslator = typeof Cls.create === 'function'
      ? (o) => Cls.create(o)
      : (o) => Promise.resolve(new Cls(o));
    return { type: 'window.Translator', canTranslate, createTranslator };
  }
  if (w.ai && typeof w.ai.translator?.canTranslate === 'function') {
    return {
      type: 'self.ai.translator',
      canTranslate: (o) => w.ai.translator.canTranslate(o),
      createTranslator: (o) => w.ai.translator.createTranslator(o)
    };
  }
  return null;
}

async function checkNativeTranslationCapability() {
  const plugin = window.Capacitor?.Plugins?.P4w4Plugin;
  if (!plugin || typeof plugin.translateText !== 'function' || typeof plugin.getTranslationStatus !== 'function') {
    return {
      enabled: false,
      reason: 'plugin_missing',
      engine: '',
      available: false,
      modelDownloaded: false,
      supportedPair: false
    };
  }
  try {
    const result = await plugin.getTranslationStatus({
      sourceLanguage: 'es',
      targetLanguage: 'en'
    });
    const available = result && result.available === true;
    const modelDownloaded = result && result.modelDownloaded === true;
    const supportedPair = result && result.supportedPair === true;
    const platform = String(result && result.platform ? result.platform : '').trim().toLowerCase();
    const engine = String(result && result.engine ? result.engine : '').trim();
    const reason = String(result && result.reason ? result.reason : '').trim() || (available ? 'available' : 'not_available');
    const enabled = platform === 'android'
      ? available
      : Boolean(available && (modelDownloaded || supportedPair));
    return {
      enabled,
      reason,
      engine,
      available,
      modelDownloaded,
      supportedPair
    };
  } catch (err) {
    return {
      enabled: false,
      reason: err && err.message ? err.message : 'status_error',
      engine: '',
      available: false,
      modelDownloaded: false,
      supportedPair: false
    };
  }
}

async function checkChromeTranslationCapability() {
  const api = resolveChromeTranslatorApi();
  if (!api) {
    return {
      enabled: false,
      reason: 'api_missing',
      availability: '',
      apiType: ''
    };
  }
  try {
    const availability = await api.canTranslate({ sourceLanguage: 'es', targetLanguage: 'en' });
    return {
      enabled: availability === 'readily',
      reason: String(availability || '').trim() || 'unknown',
      availability: String(availability || '').trim(),
      apiType: api.type || ''
    };
  } catch (err) {
    return {
      enabled: false,
      reason: err && err.message ? err.message : 'can_translate_error',
      availability: '',
      apiType: api.type || ''
    };
  }
}

async function checkOpusTranslationCapability() {
  const status = translationWorkerClient.status;
  if (status === 'ready') {
    return {
      enabled: true,
      reason: 'ready',
      status
    };
  }
  if (status === 'error') {
    return {
      enabled: false,
      reason: 'worker_error',
      status
    };
  }
  return {
    enabled: false,
    reason: status === 'loading' ? 'loading' : 'manual_load_required',
    status
  };
}

export function getTranslationCapabilities() {
  const runtime = getGlobalRuntime();
  return cloneCapabilities(runtime.translationCapabilities);
}

export function markTranslationCapabilityUnavailable(engine, reason = 'runtime_failed') {
  const current = getTranslationCapabilities();
  const normalizedReason = String(reason || '').trim() || 'runtime_failed';
  if (engine === 'native') {
    current.native.enabled = false;
    current.native.reason = normalizedReason;
    current.nativeTranslateEnabled = false;
  } else if (engine === 'chrome') {
    current.chrome.enabled = false;
    current.chrome.reason = normalizedReason;
    current.chromeTranslatorEnabled = false;
  } else if (engine === 'opus') {
    current.opus.enabled = false;
    current.opus.reason = normalizedReason;
    current.opus.status = translationWorkerClient.status;
    current.opusTranslatorEnabled = false;
  } else {
    return current;
  }
  current.checkedAt = Date.now();
  return commitCapabilities(current, true);
}

export function ensureTranslationCapabilitiesReady() {
  const current = getTranslationCapabilities();
  if (refreshPromise) return refreshPromise;
  if (current.checkedAt > 0 && !current.loading) return Promise.resolve(current);
  return refreshTranslationCapabilities();
}

export async function loadOpusTranslationCapability() {
  if (translationWorkerClient.status === 'error') {
    translationWorkerClient.terminate();
  }
  translationWorkerClient.preload();
  try {
    await translationWorkerClient.ensureReady();
  } catch (err) {
    const current = getTranslationCapabilities();
    const next = {
      ...current,
      loading: false,
      checkedAt: Date.now(),
      opus: {
        ...current.opus,
        enabled: false,
        reason: err && err.message ? err.message : 'worker_error',
        status: translationWorkerClient.status
      },
      opusTranslatorEnabled: false
    };
    return commitCapabilities(next, true);
  }

  const current = getTranslationCapabilities();
  const next = {
    ...current,
    loading: false,
    checkedAt: Date.now(),
    opus: {
      ...current.opus,
      enabled: true,
      reason: 'ready',
      status: translationWorkerClient.status
    },
    opusTranslatorEnabled: true
  };
  return commitCapabilities(next, true);
}

export function refreshTranslationCapabilities(options = {}) {
  const force = options && options.force === true;
  if (refreshPromise && !force) return refreshPromise;

  const base = getTranslationCapabilities();
  commitCapabilities({ ...base, loading: true }, true);

  refreshPromise = Promise.all([
    checkNativeTranslationCapability(),
    checkChromeTranslationCapability(),
    checkOpusTranslationCapability()
  ])
    .then(([native, chrome, opus]) => {
      return commitCapabilities({
        loading: false,
        checkedAt: Date.now(),
        nativeTranslateEnabled: native.enabled === true,
        chromeTranslatorEnabled: chrome.enabled === true,
        opusTranslatorEnabled: opus.enabled === true,
        native,
        chrome,
        opus
      }, true);
    })
    .catch((err) => {
      return commitCapabilities({
        ...base,
        loading: false,
        checkedAt: Date.now(),
        native: {
          ...base.native,
          enabled: false,
          reason: `refresh_failed:${err && err.message ? err.message : 'unknown'}`
        },
        chrome: {
          ...base.chrome,
          enabled: false,
          reason: `refresh_failed:${err && err.message ? err.message : 'unknown'}`
        },
        opus: {
          ...base.opus,
          enabled: false,
          reason: `refresh_failed:${err && err.message ? err.message : 'unknown'}`,
          status: translationWorkerClient.status
        }
      }, true);
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

export { TRANSLATION_CAPABILITIES_EVENT };
