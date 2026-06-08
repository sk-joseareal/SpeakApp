import { BUNDLE_TRAINING_DATA_VERSION } from './training-data.meta.js';

const LOCAL_DATA_URL = new URL('./training-data.json', import.meta.url);
const TRAINING_DATA_CACHE_KEY = 'appv5:training-data-cache';
const SELECTION_STORAGE_KEY = 'appv5:training-selection';
const DEFAULT_REMOTE_FETCH_TIMEOUT_MS = 7000;

let dataCache = null;
let dataPromise = null;
let dataLoadInfo = {
  status: 'idle',
  loadedAt: null,
  requestUrl: '',
  manifestUrl: '',
  transport: '',
  source: '',
  release: null,
  version: '',
  bundleVersion: BUNDLE_TRAINING_DATA_VERSION,
  cacheHit: false,
  triedUrls: [],
  errors: []
};

const uniqStrings = (items) => {
  const seen = new Set();
  const out = [];
  items.forEach((item) => {
    const value = typeof item === 'string' ? item.trim() : '';
    if (!value || seen.has(value)) return;
    seen.add(value);
    out.push(value);
  });
  return out;
};

const normalizeContentLocale = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (normalized === 'es' || normalized === 'es-es' || normalized === 'es_es') return 'es';
  if (normalized === 'en' || normalized === 'en-us' || normalized === 'en_us') return 'en';
  return '';
};

const asTrimmedText = (value) => String(value === undefined || value === null ? '' : value).trim();

const readI18nFieldObject = (source, fieldName) => {
  if (!source || typeof source !== 'object') return null;
  const hasFlatEn = Object.prototype.hasOwnProperty.call(source, `${fieldName}_en`);
  const hasFlatEs = Object.prototype.hasOwnProperty.call(source, `${fieldName}_es`);
  const flatEn = asTrimmedText(source[`${fieldName}_en`]);
  const flatEs = asTrimmedText(source[`${fieldName}_es`]);
  const en = hasFlatEn ? flatEn : '';
  const es = hasFlatEs ? flatEs : '';
  if (!en && !es) return null;
  return { en, es };
};

export const getLocalizedContentField = (source, fieldName, locale = 'en') => {
  if (!source || typeof source !== 'object') return '';
  const localeCode = normalizeContentLocale(locale) || 'en';
  const i18n = readI18nFieldObject(source, fieldName);
  if (!i18n) return '';

  const en = asTrimmedText(i18n.en || i18n['en-US'] || i18n.en_us);
  const es = asTrimmedText(i18n.es || i18n['es-ES'] || i18n.es_es);
  if (localeCode === 'es') return es || en || '';
  return en || es || '';
};

const parseBooleanLoose = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
};

const normalizeTrainingEndpoint = (raw) => {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return '';
  try {
    const base = typeof window !== 'undefined' && window.location ? window.location.href : undefined;
    const parsed = base ? new URL(value, base) : new URL(value);
    const pathname = parsed.pathname || '';
    if (pathname.endsWith('/content/training-data')) {
      return parsed.toString();
    }
    parsed.pathname = pathname.replace(/\/+$/, '') + '/content/training-data';
    return parsed.toString();
  } catch (err) {
    return '';
  }
};

const normalizeTrainingVersion = (value) => String(value === undefined || value === null ? '' : value).trim();

const getConfiguredTrainingDataUrls = () => {
  const localUrl = LOCAL_DATA_URL.toString();
  if (typeof window === 'undefined') return [localUrl];

  const globals = [
    window.SPEAK_CONTENT_URL,
    window.CONTENT_URL,
    window.CONTENT_TRAINING_DATA_URL,
    window.CONTENT_TRAINING_DATA_ENDPOINT,
    window.contentConfig && window.contentConfig.trainingDataEndpoint,
    window.contentConfig && window.contentConfig.baseUrl
  ];

  const configured = uniqStrings(globals.map((item) => normalizeTrainingEndpoint(item)));
  const hasConfiguredRemote = configured.some((url) => url !== localUrl);

  const host = window.location && window.location.hostname ? String(window.location.hostname) : '';
  const isLocalHost =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.local');
  const allowLocalFallbackConfig =
    window.contentConfig && window.contentConfig.allowLocalFallback !== undefined
      ? window.contentConfig.allowLocalFallback
      : undefined;
  const allowLocalFallback = parseBooleanLoose(
    allowLocalFallbackConfig !== undefined ? allowLocalFallbackConfig : isLocalHost,
    isLocalHost
  );

  if (hasConfiguredRemote && !allowLocalFallback) return configured;
  return [...configured, localUrl];
};

const getConfiguredRemoteTrainingDataUrl = () => {
  const urls = getConfiguredTrainingDataUrls();
  const localUrl = LOCAL_DATA_URL.toString();
  return urls.find((url) => url && url !== localUrl) || '';
};

const getTrainingDataManifestUrl = (trainingDataUrl) => {
  const value = typeof trainingDataUrl === 'string' ? trainingDataUrl.trim() : '';
  if (!value) return '';
  try {
    const parsed = new URL(value, typeof window !== 'undefined' && window.location ? window.location.href : undefined);
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') + '/meta';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch (err) {
    return '';
  }
};

const getTrainingDataToken = () => {
  if (typeof window === 'undefined') return '';
  const fromContentConfig =
    window.contentConfig && typeof window.contentConfig.trainingDataToken === 'string'
      ? window.contentConfig.trainingDataToken.trim()
      : '';
  if (fromContentConfig) return fromContentConfig;
  const fromGlobal =
    typeof window.CONTENT_TRAINING_DATA_TOKEN === 'string'
      ? window.CONTENT_TRAINING_DATA_TOKEN.trim()
      : '';
  if (fromGlobal) return fromGlobal;
  return '';
};

const buildTrainingDataRequestHeaders = () => {
  const token = getTrainingDataToken();
  if (!token) return {};
  return { 'x-content-read-token': token };
};

const readTrainingDataCache = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(TRAINING_DATA_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const version = normalizeTrainingVersion(parsed.version);
    const payload = parsed.payload && typeof parsed.payload === 'object' ? parsed.payload : null;
    if (!version || !payload) return null;
    return {
      version,
      payload,
      source: typeof parsed.source === 'string' ? parsed.source : '',
      release: parsed.release && typeof parsed.release === 'object' ? parsed.release : null,
      storedAt: typeof parsed.storedAt === 'string' ? parsed.storedAt : ''
    };
  } catch (err) {
    return null;
  }
};

const writeTrainingDataCache = (entry) => {
  if (typeof window === 'undefined') return;
  try {
    if (!entry || typeof entry !== 'object') return;
    const version = normalizeTrainingVersion(entry.version);
    const payload = entry.payload && typeof entry.payload === 'object' ? entry.payload : null;
    if (!version || !payload) return;
    localStorage.setItem(
      TRAINING_DATA_CACHE_KEY,
      JSON.stringify({
        version,
        payload,
        source: typeof entry.source === 'string' ? entry.source : '',
        release: entry.release && typeof entry.release === 'object' ? entry.release : null,
        storedAt: new Date().toISOString()
      })
    );
  } catch (err) {
    // no-op
  }
};

const getTrainingDataFetchTimeoutMs = () => {
  if (typeof window === 'undefined') return DEFAULT_REMOTE_FETCH_TIMEOUT_MS;
  const configured =
    window.contentConfig && window.contentConfig.trainingDataTimeoutMs !== undefined
      ? Number(window.contentConfig.trainingDataTimeoutMs)
      : Number(window.CONTENT_TRAINING_DATA_TIMEOUT_MS);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_REMOTE_FETCH_TIMEOUT_MS;
  return Math.max(1000, Math.round(configured));
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = DEFAULT_REMOTE_FETCH_TIMEOUT_MS) => {
  if (typeof AbortController !== 'function') {
    return fetch(url, options);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || 0));
  try {
    const merged = { ...options, signal: controller.signal };
    return await fetch(url, merged);
  } finally {
    clearTimeout(timer);
  }
};

const loadTrainingDataPayloadFromUrl = async (url, timeoutMs = DEFAULT_REMOTE_FETCH_TIMEOUT_MS) => {
  const headers = buildTrainingDataRequestHeaders();
  const fetchOpts = Object.keys(headers).length ? { headers } : undefined;
  const isLocalUrl = url === LOCAL_DATA_URL.toString();
  const effectiveTimeoutMs = isLocalUrl ? 0 : timeoutMs;
  const res =
    effectiveTimeoutMs > 0
      ? await fetchWithTimeout(url, fetchOpts, effectiveTimeoutMs)
      : await fetch(url, fetchOpts);
  if (!res.ok) throw new Error(`training data: ${res.status}`);
  const raw = await res.json();
  return unwrapTrainingPayload(raw);
};

const loadTrainingDataMeta = async (url) => {
  const headers = buildTrainingDataRequestHeaders();
  const fetchOpts = Object.keys(headers).length ? { headers } : undefined;
  const timeoutMs = getTrainingDataFetchTimeoutMs();
  const res = await fetchWithTimeout(url, fetchOpts, timeoutMs);
  if (!res.ok) throw new Error(`training data meta: ${res.status}`);
  return res.json();
};

const unwrapTrainingPayload = (raw) => {
  if (!raw || typeof raw !== 'object') {
    return { payload: {}, source: '', release: null };
  }
  if (raw.data && typeof raw.data === 'object') {
    return {
      payload: raw.data,
      source: typeof raw.source === 'string' ? raw.source : '',
      release: raw.release && typeof raw.release === 'object' ? raw.release : null
    };
  }
  return { payload: raw, source: 'plain', release: null };
};

const readStoredSelection = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SELECTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      routeId: typeof parsed.routeId === 'string' ? parsed.routeId : '',
      moduleId: typeof parsed.moduleId === 'string' ? parsed.moduleId : '',
      sessionId: typeof parsed.sessionId === 'string' ? parsed.sessionId : ''
    };
  } catch (err) {
    return null;
  }
};

const writeStoredSelection = (value) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(value));
  } catch (err) {
    // no-op
  }
};

let selection = readStoredSelection() || { routeId: '', moduleId: '', sessionId: '' };

const hydrateData = (raw) => {
  const sessions = Array.isArray(raw.sessions) ? raw.sessions : [];
  const modules = Array.isArray(raw.modules) ? raw.modules : [];
  const routes = Array.isArray(raw.routes) ? raw.routes : [];

  const sessionMap = new Map(
    sessions
      .filter((session) => session && session.id)
      .map((session) => [session.id, { ...session }])
  );

  const moduleMap = new Map(
    modules
      .filter((module) => module && module.id)
      .map((module) => {
        const sessionsForModule = Array.isArray(module.sessionIds)
          ? module.sessionIds.map((id) => sessionMap.get(id)).filter(Boolean)
          : [];
        return [
          module.id,
          {
            ...module,
            sessions: sessionsForModule
          }
        ];
      })
  );

  const hydratedRoutes = routes
    .filter((route) => route && route.id)
    .map((route) => {
      const modulesForRoute = Array.isArray(route.moduleIds)
        ? route.moduleIds.map((id) => moduleMap.get(id)).filter(Boolean)
        : [];
      return {
        ...route,
        modules: modulesForRoute
      };
    });

  return { routes: hydratedRoutes };
};

const loadTrainingData = async () => {
  if (dataCache) return dataCache;
  if (!dataPromise) {
    dataPromise = (async () => {
      const urls = getConfiguredTrainingDataUrls();
      const localUrl = LOCAL_DATA_URL.toString();
      const remoteUrl = getConfiguredRemoteTrainingDataUrl();
      const manifestUrl = remoteUrl ? getTrainingDataManifestUrl(remoteUrl) : '';
      const allowLocalFallback = urls.includes(localUrl);
      const cached = allowLocalFallback ? readTrainingDataCache() : null;
      const errors = [];
      dataLoadInfo = {
        status: 'loading',
        loadedAt: null,
        requestUrl: '',
        manifestUrl,
        transport: '',
        source: '',
        release: null,
        version: '',
        bundleVersion: BUNDLE_TRAINING_DATA_VERSION,
        cacheHit: false,
        triedUrls: urls.slice(),
        errors: []
      };

      if (!allowLocalFallback) {
        for (const url of urls) {
          try {
            const parsed = await loadTrainingDataPayloadFromUrl(url, getTrainingDataFetchTimeoutMs());
            dataCache = hydrateData(parsed.payload);
            dataLoadInfo = {
              status: 'ok',
              loadedAt: new Date().toISOString(),
              requestUrl: url,
              manifestUrl,
              transport: url === localUrl ? 'local' : 'remote',
              source: parsed.source || (url === localUrl ? 'local-json' : 'remote'),
              release: parsed.release || null,
              version: '',
              bundleVersion: BUNDLE_TRAINING_DATA_VERSION,
              cacheHit: false,
              triedUrls: urls.slice(),
              errors: errors.map((entry) => ({
                url: entry.url,
                message: entry.message
              }))
            };
            dataPromise = null;
            return dataCache;
          } catch (err) {
            const errorMessage =
              err && err.name === 'AbortError'
                ? `training data timeout after ${getTrainingDataFetchTimeoutMs()}ms`
                : err && err.message
                ? err.message
                : String(err);
            errors.push({
              url,
              message: errorMessage
            });
          }
        }

        console.error('[training-data] failed to load from all sources', errors);
        dataCache = { routes: [] };
        dataLoadInfo = {
          status: 'error',
          loadedAt: new Date().toISOString(),
          requestUrl: '',
          manifestUrl,
          transport: '',
          source: '',
          release: null,
          version: '',
          bundleVersion: BUNDLE_TRAINING_DATA_VERSION,
          cacheHit: false,
          triedUrls: urls.slice(),
          errors: errors.slice()
        };
        dataPromise = null;
        return dataCache;
      }

      try {
        const remoteMeta = remoteUrl ? await loadTrainingDataMeta(manifestUrl) : null;
        const remoteVersion = normalizeTrainingVersion(
          remoteMeta && typeof remoteMeta.version === 'string' ? remoteMeta.version : ''
        );
        const cacheVersion = cached ? normalizeTrainingVersion(cached.version) : '';

        if (remoteVersion && remoteVersion === BUNDLE_TRAINING_DATA_VERSION) {
          const parsed = await loadTrainingDataPayloadFromUrl(localUrl, 0);
          dataCache = hydrateData(parsed.payload);
          dataLoadInfo = {
            status: 'ok',
            loadedAt: new Date().toISOString(),
            requestUrl: localUrl,
            manifestUrl,
            transport: 'local',
            source: parsed.source || 'local-json',
            release: parsed.release || null,
            version: remoteVersion,
            bundleVersion: BUNDLE_TRAINING_DATA_VERSION,
            cacheHit: false,
            triedUrls: [manifestUrl, localUrl].filter(Boolean),
            errors: []
          };
          dataPromise = null;
          return dataCache;
        }

        if (remoteVersion && cached && cacheVersion === remoteVersion) {
          dataCache = hydrateData(cached.payload);
          dataLoadInfo = {
            status: 'ok',
            loadedAt: new Date().toISOString(),
            requestUrl: `cache:${cacheVersion}`,
            manifestUrl,
            transport: 'cache',
            source: cached.source || 'remote-cache',
            release: cached.release || null,
            version: cacheVersion,
            bundleVersion: BUNDLE_TRAINING_DATA_VERSION,
            cacheHit: true,
            triedUrls: [manifestUrl],
            errors: []
          };
          dataPromise = null;
          return dataCache;
        }

        if (remoteVersion && remoteUrl) {
          const parsed = await loadTrainingDataPayloadFromUrl(remoteUrl, getTrainingDataFetchTimeoutMs());
          dataCache = hydrateData(parsed.payload);
          writeTrainingDataCache({
            version: remoteVersion,
            payload: parsed.payload,
            source: parsed.source || 'remote',
            release: parsed.release || null
          });
          dataLoadInfo = {
            status: 'ok',
            loadedAt: new Date().toISOString(),
            requestUrl: remoteUrl,
            manifestUrl,
            transport: 'remote',
            source: parsed.source || 'remote',
            release: parsed.release || null,
            version: remoteVersion,
            bundleVersion: BUNDLE_TRAINING_DATA_VERSION,
            cacheHit: false,
            triedUrls: [manifestUrl, remoteUrl].filter(Boolean),
            errors: []
          };
          dataPromise = null;
          return dataCache;
        }

        if (cached) {
          dataCache = hydrateData(cached.payload);
          dataLoadInfo = {
            status: 'ok',
            loadedAt: new Date().toISOString(),
            requestUrl: `cache:${cacheVersion || 'unknown'}`,
            manifestUrl,
            transport: 'cache',
            source: cached.source || 'remote-cache',
            release: cached.release || null,
            version: cacheVersion,
            bundleVersion: BUNDLE_TRAINING_DATA_VERSION,
            cacheHit: true,
            triedUrls: [manifestUrl].filter(Boolean),
            errors: []
          };
          dataPromise = null;
          return dataCache;
        }

        const parsed = await loadTrainingDataPayloadFromUrl(localUrl, 0);
        dataCache = hydrateData(parsed.payload);
        dataLoadInfo = {
          status: 'ok',
          loadedAt: new Date().toISOString(),
          requestUrl: localUrl,
          manifestUrl,
          transport: 'local',
          source: parsed.source || 'local-json',
          release: parsed.release || null,
          version: BUNDLE_TRAINING_DATA_VERSION,
          bundleVersion: BUNDLE_TRAINING_DATA_VERSION,
          cacheHit: false,
          triedUrls: [manifestUrl, localUrl].filter(Boolean),
          errors: []
        };
        dataPromise = null;
        return dataCache;
      } catch (err) {
        const errorMessage =
          err && err.name === 'AbortError'
            ? `training data timeout after ${getTrainingDataFetchTimeoutMs()}ms`
            : err && err.message
            ? err.message
            : String(err);
        errors.push({
          url: manifestUrl || remoteUrl || localUrl,
          message: errorMessage
        });
        if (cached) {
          dataCache = hydrateData(cached.payload);
          dataLoadInfo = {
            status: 'ok',
            loadedAt: new Date().toISOString(),
            requestUrl: `cache:${normalizeTrainingVersion(cached.version) || 'unknown'}`,
            manifestUrl,
            transport: 'cache',
            source: cached.source || 'remote-cache',
            release: cached.release || null,
            version: normalizeTrainingVersion(cached.version),
            bundleVersion: BUNDLE_TRAINING_DATA_VERSION,
            cacheHit: true,
            triedUrls: [manifestUrl, localUrl].filter(Boolean),
            errors: errors.map((entry) => ({
              url: entry.url,
              message: entry.message
            }))
          };
          dataPromise = null;
          return dataCache;
        }

        console.error('[training-data] failed to load from all sources', errors);
        dataCache = { routes: [] };
        dataLoadInfo = {
          status: 'error',
          loadedAt: new Date().toISOString(),
          requestUrl: '',
          manifestUrl,
          transport: '',
          source: '',
          release: null,
          version: '',
          bundleVersion: BUNDLE_TRAINING_DATA_VERSION,
          cacheHit: false,
          triedUrls: [manifestUrl, localUrl].filter(Boolean),
          errors: errors.slice()
        };
        dataPromise = null;
        return dataCache;
      }
    })();
  }
  return dataPromise;
};

const getRoutes = () => (dataCache && Array.isArray(dataCache.routes) ? dataCache.routes : []);

const resolveSelection = (nextSelection = selection) => {
  const routes = getRoutes();
  if (!routes.length) {
    return {
      selection: { routeId: '', moduleId: '', sessionId: '' },
      route: null,
      module: null,
      session: null
    };
  }

  const route = routes.find((item) => item.id === nextSelection.routeId) || routes[0];
  const modules = route && Array.isArray(route.modules) ? route.modules : [];
  const module = modules.find((item) => item.id === nextSelection.moduleId) || modules[0];
  const sessions = module && Array.isArray(module.sessions) ? module.sessions : [];
  const session = sessions.find((item) => item.id === nextSelection.sessionId) || sessions[0];

  return {
    selection: {
      routeId: route ? route.id : '',
      moduleId: module ? module.id : '',
      sessionId: session ? session.id : ''
    },
    route,
    module,
    session
  };
};

const ensureTrainingData = async () => {
  await loadTrainingData();
  const resolved = resolveSelection(selection);
  selection = resolved.selection;
  writeStoredSelection(selection);
  return resolved;
};

const notifySelection = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('training:selection-change', { detail: selection }));
};

const setSelection = (next) => {
  selection = { ...selection, ...next };
  if (dataCache) {
    const resolved = resolveSelection(selection);
    selection = resolved.selection;
  }
  writeStoredSelection(selection);
  notifySelection();
  return selection;
};

const getSelection = () => ({ ...selection });

const getTrainingDataLoadInfo = () => ({
  ...dataLoadInfo,
  release: dataLoadInfo.release ? { ...dataLoadInfo.release } : null,
  triedUrls: Array.isArray(dataLoadInfo.triedUrls) ? dataLoadInfo.triedUrls.slice() : [],
  errors: Array.isArray(dataLoadInfo.errors)
    ? dataLoadInfo.errors.map((item) => ({ ...item }))
    : []
});

export {
  ensureTrainingData,
  getRoutes,
  getSelection,
  getTrainingDataLoadInfo,
  resolveSelection,
  setSelection
};
