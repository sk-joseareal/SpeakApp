const LOCAL_DATA_URL = new URL('./training-data.json', import.meta.url);
const SELECTION_STORAGE_KEY = 'appv5:training-selection';

let dataCache = null;
let dataPromise = null;
let dataLoadInfo = {
  status: 'idle',
  loadedAt: null,
  requestUrl: '',
  transport: '',
  source: '',
  release: null,
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
  return [...configured, localUrl];
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
      const errors = [];
      dataLoadInfo = {
        status: 'loading',
        loadedAt: null,
        requestUrl: '',
        transport: '',
        source: '',
        release: null,
        triedUrls: urls.slice(),
        errors: []
      };

      for (const url of urls) {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`training data: ${res.status}`);
          const raw = await res.json();
          const parsed = unwrapTrainingPayload(raw);
          dataCache = hydrateData(parsed.payload);
          dataLoadInfo = {
            status: 'ok',
            loadedAt: new Date().toISOString(),
            requestUrl: url,
            transport: url === localUrl ? 'local' : 'remote',
            source: parsed.source || (url === localUrl ? 'local-json' : 'remote'),
            release: parsed.release || null,
            triedUrls: urls.slice(),
            errors: errors.map((entry) => ({
              url: entry.url,
              message: entry.message
            }))
          };
          dataPromise = null;
          return dataCache;
        } catch (err) {
          errors.push({
            url,
            message: err && err.message ? err.message : String(err)
          });
        }
      }

      console.error('[training-data] failed to load from all sources', errors);
      dataCache = { routes: [] };
      dataLoadInfo = {
        status: 'error',
        loadedAt: new Date().toISOString(),
        requestUrl: '',
        transport: '',
        source: '',
        release: null,
        triedUrls: urls.slice(),
        errors: errors.slice()
      };
      dataPromise = null;
      return dataCache;
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
