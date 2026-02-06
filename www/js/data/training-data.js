const DATA_URL = new URL('./training-data.json', import.meta.url);
const SELECTION_STORAGE_KEY = 'appv5:training-selection';

let dataCache = null;
let dataPromise = null;

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
    dataPromise = fetch(DATA_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`training data: ${res.status}`);
        return res.json();
      })
      .then((raw) => {
        dataCache = hydrateData(raw);
        dataPromise = null;
        return dataCache;
      })
      .catch((err) => {
        console.error('[training-data] failed to load', err);
        dataCache = { routes: [] };
        dataPromise = null;
        return dataCache;
      });
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

export { ensureTrainingData, getRoutes, getSelection, resolveSelection, setSelection };
