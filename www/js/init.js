const initState = {
  platform: 'browser',
  uuid: null,
  voicesUS: [],
  voicesGB: []
};

window.r34lp0w3r = window.r34lp0w3r || {};
window.r34lp0w3r.speakFeedback = window.r34lp0w3r.speakFeedback || {
  toneScale: [
    { min: 80, tone: 'good' },
    { min: 60, tone: 'okay' },
    { min: 0, tone: 'bad' }
  ],
  labelScale: [
    { min: 85, label: 'You sound like a native' },
    { min: 70, label: 'Good! Continue practicing' },
    { min: 60, label: 'Almost Correct!' },
    { min: 0, label: 'Keep practicing' }
  ]
};

window.r34lp0w3r.speakSummaryTitles = window.r34lp0w3r.speakSummaryTitles || {
  good: ['Muy bien! aprendiste {{session}}', 'Excelente! completaste {{session}}'],
  okay: ['Buen trabajo! sigue practicando {{session}}', 'Vas bien! repasa {{session}}'],
  bad: ['No pasa nada, practica {{session}}', 'Sigue intentandolo con {{session}}']
};

const SPEAK_WORDS_KEY = 'appv5:speak-word-scores';
const SPEAK_PHRASE_KEY = 'appv5:speak-phrase-scores';
const SPEAK_REWARDS_KEY = 'appv5:speak-session-rewards';
const SPEAK_BADGES_KEY = 'appv5:speak-badges';
const SPEAK_EVENTS_KEY = 'appv5:speak-events';
const SPEAK_SYNC_OWNER_KEY = 'appv5:speak-sync-owner';
const SPEAK_SYNC_TS_KEY = 'appv5:speak-sync-ts';
const SPEAK_SYNC_CONFLICT_KEY = 'appv5:speak-sync-conflict';
const SPEAK_LOCAL_OWNER_KEY = 'appv5:speak-local-owner';
const SPEAK_USER_STORAGE_KEY = 'appv5:user';
const SPEAK_MAX_EVENTS = 500;
const SPEAK_SYNC_BATCH = 200;
const SPEAK_SYNC_DEBOUNCE_MS = 4000;

const readSpeakLocalOwner = () => {
  try {
    return localStorage.getItem(SPEAK_LOCAL_OWNER_KEY) || '';
  } catch (err) {
    return '';
  }
};

const writeSpeakLocalOwner = (owner) => {
  try {
    if (owner) {
      localStorage.setItem(SPEAK_LOCAL_OWNER_KEY, owner);
    } else {
      localStorage.removeItem(SPEAK_LOCAL_OWNER_KEY);
    }
  } catch (err) {
    // no-op
  }
};

const resolveSpeakLocalOwner = () => {
  try {
    const rawUser = localStorage.getItem(SPEAK_USER_STORAGE_KEY);
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      if (parsed && parsed.id !== undefined && parsed.id !== null) {
        return `user:${parsed.id}`;
      }
    }
  } catch (err) {
    // no-op
  }
  const uuid = window.uuid || localStorage.getItem('uuid') || '';
  if (uuid) return `device:${uuid}`;
  return '';
};

const updateSpeakLocalOwner = () => {
  const words = window.r34lp0w3r.speakWordScores || {};
  const phrases = window.r34lp0w3r.speakPhraseScores || {};
  const rewards = window.r34lp0w3r.speakSessionRewards || {};
  const badges = window.r34lp0w3r.speakBadges || {};
  const hasData =
    Object.keys(words).length ||
    Object.keys(phrases).length ||
    Object.keys(rewards).length ||
    Object.keys(badges).length;
  if (!hasData) {
    writeSpeakLocalOwner('');
    return;
  }
  const owner = resolveSpeakLocalOwner();
  if (owner) {
    writeSpeakLocalOwner(owner);
  }
};

const resolveSpeakLocalOwnerHint = () => {
  const localOwner = readSpeakLocalOwner();
  if (localOwner) return localOwner;
  try {
    return localStorage.getItem(SPEAK_SYNC_OWNER_KEY) || '';
  } catch (err) {
    return '';
  }
};

const readSpeakStore = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.error('[speak] error leyendo store', key, err);
    return {};
  }
};

const writeSpeakStore = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value || {}));
  } catch (err) {
    console.error('[speak] error guardando store', key, err);
  }
};

const loadSpeakStore = (key, fallback) => {
  const stored = readSpeakStore(key);
  if (stored && Object.keys(stored).length) return stored;
  return fallback || {};
};

window.r34lp0w3r.speakWordScores = loadSpeakStore(
  SPEAK_WORDS_KEY,
  window.r34lp0w3r.speakWordScores || {}
);
window.r34lp0w3r.speakPhraseScores = loadSpeakStore(
  SPEAK_PHRASE_KEY,
  window.r34lp0w3r.speakPhraseScores || {}
);
window.r34lp0w3r.speakSessionRewards = loadSpeakStore(
  SPEAK_REWARDS_KEY,
  window.r34lp0w3r.speakSessionRewards || {}
);
window.r34lp0w3r.speakBadges = loadSpeakStore(
  SPEAK_BADGES_KEY,
  window.r34lp0w3r.speakBadges || {}
);

updateSpeakLocalOwner();

window.persistSpeakStores = () => {
  writeSpeakStore(SPEAK_WORDS_KEY, window.r34lp0w3r.speakWordScores || {});
  writeSpeakStore(SPEAK_PHRASE_KEY, window.r34lp0w3r.speakPhraseScores || {});
  writeSpeakStore(SPEAK_REWARDS_KEY, window.r34lp0w3r.speakSessionRewards || {});
  writeSpeakStore(SPEAK_BADGES_KEY, window.r34lp0w3r.speakBadges || {});
  updateSpeakLocalOwner();
};

window.notifySpeakStoresChange = () => {
  window.dispatchEvent(new CustomEvent('app:speak-stores-change'));
};

window.resetSpeakStores = () => {
  window.r34lp0w3r.speakWordScores = {};
  window.r34lp0w3r.speakPhraseScores = {};
  window.r34lp0w3r.speakSessionRewards = {};
  window.r34lp0w3r.speakBadges = {};
  window.persistSpeakStores();
  writeSpeakLocalOwner('');
  window.notifySpeakStoresChange();
};

const resetSpeakSyncState = () => {
  try {
    localStorage.removeItem(SPEAK_EVENTS_KEY);
    localStorage.removeItem(SPEAK_SYNC_OWNER_KEY);
    localStorage.removeItem(SPEAK_SYNC_TS_KEY);
    localStorage.removeItem(SPEAK_SYNC_CONFLICT_KEY);
  } catch (err) {
    // no-op
  }
};

window.resetSpeakProgress = () => {
  if (typeof window.resetSpeakStores === 'function') {
    window.resetSpeakStores();
  }
  resetSpeakSyncState();
};

const readSpeakArray = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[speak] error leyendo array', key, err);
    return [];
  }
};

const writeSpeakArray = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(Array.isArray(value) ? value : []));
  } catch (err) {
    console.error('[speak] error guardando array', key, err);
  }
};

const createSpeakEventId = () => {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const readStoredUserForSync = () => {
  try {
    const raw = localStorage.getItem(SPEAK_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (err) {
    return null;
  }
};

const resolveSpeakUserId = () => {
  const user = window.user || null;
  if (user && user.id !== undefined && user.id !== null) {
    return user.id;
  }
  const stored = readStoredUserForSync();
  if (stored && stored.id !== undefined && stored.id !== null) {
    return stored.id;
  }
  return null;
};

const readUserIdFromDetail = (detail) => {
  if (!detail || typeof detail !== 'object') return null;
  if (detail.id !== undefined && detail.id !== null) return detail.id;
  return null;
};

const isValidSpeakUserId = (value) => value !== null && value !== undefined && String(value) !== '';

let speakLastUserId = resolveSpeakUserId();

const getSpeakDeviceOwner = () => {
  const uuid = window.uuid || localStorage.getItem('uuid') || '';
  if (!uuid) return '';
  return `device:${uuid}`;
};

const resolveSpeakStateEndpoints = () => {
  const endpoint = window.realtimeConfig && window.realtimeConfig.stateEndpoint;
  if (!endpoint || typeof endpoint !== 'string') return null;
  const trimmed = endpoint.replace(/\/+$/, '');
  if (trimmed.endsWith('/sync')) {
    return {
      syncEndpoint: endpoint,
      stateEndpoint: trimmed.slice(0, -5)
    };
  }
  return {
    syncEndpoint: `${trimmed}/sync`,
    stateEndpoint: trimmed
  };
};

const buildSpeakStateHeaders = () => {
  const headers = {};
  const token = window.realtimeConfig && window.realtimeConfig.stateToken;
  if (token) headers['x-rt-token'] = token;
  return headers;
};

const isSpeakSnapshotMeaningful = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const words = snapshot.word_scores || {};
  const phrases = snapshot.phrase_scores || {};
  const rewards = snapshot.session_rewards || {};
  const badges = snapshot.badges || {};
  return (
    Object.keys(words).length ||
    Object.keys(phrases).length ||
    Object.keys(rewards).length ||
    Object.keys(badges).length
  );
};

const fetchSpeakSnapshotForOwner = async (owner) => {
  const endpoints = resolveSpeakStateEndpoints();
  if (!endpoints || !owner) return null;
  if (window.navigator && window.navigator.onLine === false) return null;
  const url = `${endpoints.stateEndpoint}?owner=${encodeURIComponent(owner)}`;
  const headers = buildSpeakStateHeaders();
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== 'object') return null;
    const snapshot = data.snapshot && typeof data.snapshot === 'object' ? data.snapshot : null;
    if (!snapshot || !isSpeakSnapshotMeaningful(snapshot)) return null;
    return snapshot;
  } catch (err) {
    console.warn('[speak] error cargando snapshot remoto', err);
    return null;
  }
};

const readSpeakSyncConflict = () => {
  try {
    const raw = localStorage.getItem(SPEAK_SYNC_CONFLICT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (err) {
    return null;
  }
};

const writeSpeakSyncConflict = (userId) => {
  try {
    if (!isValidSpeakUserId(userId)) return;
    localStorage.setItem(
      SPEAK_SYNC_CONFLICT_KEY,
      JSON.stringify({
        userId: String(userId),
        ts: Date.now()
      })
    );
  } catch (err) {
    // no-op
  }
};

const clearSpeakSyncConflict = () => {
  try {
    localStorage.removeItem(SPEAK_SYNC_CONFLICT_KEY);
  } catch (err) {
    // no-op
  }
};

const promptSpeakSyncConflict = async () => {
  const message =
    'Ya hay progreso guardado en el servidor. Quieres sustituirlo por el de este dispositivo?';
  if (!window.customElements || typeof window.customElements.get !== 'function') {
    return window.confirm(message);
  }
  const hasIonAlert = window.customElements.get('ion-alert');
  if (!hasIonAlert) {
    return window.confirm(message);
  }
  const alert = document.createElement('ion-alert');
  alert.header = 'Sincronizar progreso';
  alert.message = message;
  alert.buttons = [
    { text: 'Usar servidor', role: 'cancel' },
    { text: 'Sustituir', role: 'confirm' }
  ];
  document.body.appendChild(alert);
  await alert.present();
  const result = await alert.onDidDismiss();
  alert.remove();
  return result && result.role === 'confirm';
};

let speakConflictPromise = null;

const resolveSpeakSyncConflict = async (userId) => {
  if (!isValidSpeakUserId(userId)) {
    clearSpeakSyncConflict();
    return { action: 'none' };
  }
  if (!isSpeakSnapshotEmpty()) {
    const userOwner = `user:${userId}`;
    const userSnapshot = await fetchSpeakSnapshotForOwner(userOwner);
    if (!userSnapshot) {
      clearSpeakSyncConflict();
      return { action: 'no-remote' };
    }
    const useLocal = await promptSpeakSyncConflict();
    if (useLocal) {
      clearSpeakSyncConflict();
      return { action: 'use-local' };
    }
    applySpeakSnapshot(userSnapshot, { replace: true });
    resetSpeakSyncState();
    return { action: 'use-server' };
  }
  clearSpeakSyncConflict();
  return { action: 'empty-local' };
};

const resolveSpeakSyncConflictIfNeeded = async (owner, opts = {}) => {
  if (opts.skipConflictCheck) return null;
  const conflict = readSpeakSyncConflict();
  if (!conflict || !conflict.userId) return null;
  if (owner !== `user:${conflict.userId}`) return null;
  if (speakConflictPromise) return speakConflictPromise;
  speakConflictPromise = resolveSpeakSyncConflict(conflict.userId)
    .catch((err) => {
      console.warn('[speak] error resolviendo conflicto', err);
      return null;
    })
    .finally(() => {
      speakConflictPromise = null;
    });
  return speakConflictPromise;
};

const maybeRestoreSpeakProgressOnLogin = async (userId) => {
  if (!isValidSpeakUserId(userId)) return false;
  if (!isSpeakSnapshotEmpty()) return false;
  const userOwner = `user:${userId}`;
  const userSnapshot = await fetchSpeakSnapshotForOwner(userOwner);
  if (userSnapshot) {
    applySpeakSnapshot(userSnapshot, { replace: true });
    return true;
  }
  const deviceOwner = getSpeakDeviceOwner();
  if (!deviceOwner) return false;
  const deviceSnapshot = await fetchSpeakSnapshotForOwner(deviceOwner);
  if (deviceSnapshot) {
    applySpeakSnapshot(deviceSnapshot, { replace: true });
    return true;
  }
  return false;
};

const getSpeakSyncOwner = () => {
  const userId = resolveSpeakUserId();
  if (userId !== undefined && userId !== null && String(userId) !== '') {
    return `user:${userId}`;
  }
  const uuid = window.uuid || localStorage.getItem('uuid') || '';
  if (uuid) return `device:${uuid}`;
  return '';
};

const isSpeakSnapshotEmpty = () => {
  const words = window.r34lp0w3r.speakWordScores || {};
  const phrases = window.r34lp0w3r.speakPhraseScores || {};
  const rewards = window.r34lp0w3r.speakSessionRewards || {};
  const badges = window.r34lp0w3r.speakBadges || {};
  return (
    !Object.keys(words).length &&
    !Object.keys(phrases).length &&
    !Object.keys(rewards).length &&
    !Object.keys(badges).length
  );
};

const buildSpeakSnapshot = () => ({
  word_scores: window.r34lp0w3r.speakWordScores || {},
  phrase_scores: window.r34lp0w3r.speakPhraseScores || {},
  session_rewards: window.r34lp0w3r.speakSessionRewards || {},
  badges: window.r34lp0w3r.speakBadges || {}
});

const mergeSpeakSessionMap = (target, source) => {
  Object.entries(source || {}).forEach(([sessionId, value]) => {
    if (!sessionId || !value || typeof value !== 'object') return;
    const incomingTs = typeof value.ts === 'number' ? value.ts : 0;
    const prev = target[sessionId];
    const prevTs = prev && typeof prev.ts === 'number' ? prev.ts : 0;
    if (!prev || prevTs <= incomingTs) {
      target[sessionId] = { ...value, ts: incomingTs || Date.now() };
    }
  });
};

const applySpeakSnapshot = (snapshot, opts = {}) => {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const replace = opts.replace === true;
  const incoming = snapshot;
  const words = replace ? {} : window.r34lp0w3r.speakWordScores || {};
  const phrases = replace ? {} : window.r34lp0w3r.speakPhraseScores || {};
  const rewards = replace ? {} : window.r34lp0w3r.speakSessionRewards || {};
  const badges = replace ? {} : window.r34lp0w3r.speakBadges || {};

  Object.entries(incoming.word_scores || {}).forEach(([sessionId, session]) => {
    if (!sessionId || !session || typeof session !== 'object') return;
    if (!words[sessionId]) words[sessionId] = {};
    Object.entries(session).forEach(([word, value]) => {
      if (!word || !value || typeof value !== 'object') return;
      const incomingTs = typeof value.ts === 'number' ? value.ts : 0;
      const prev = words[sessionId][word];
      const prevTs = prev && typeof prev.ts === 'number' ? prev.ts : 0;
      if (!prev || prevTs <= incomingTs) {
        words[sessionId][word] = { ...value, ts: incomingTs || Date.now() };
      }
    });
  });

  mergeSpeakSessionMap(phrases, incoming.phrase_scores || {});
  mergeSpeakSessionMap(rewards, incoming.session_rewards || {});

  Object.entries(incoming.badges || {}).forEach(([badgeId, value]) => {
    if (!badgeId || !value || typeof value !== 'object') return;
    badges[badgeId] = { ...value };
  });

  window.r34lp0w3r.speakWordScores = words;
  window.r34lp0w3r.speakPhraseScores = phrases;
  window.r34lp0w3r.speakSessionRewards = rewards;
  window.r34lp0w3r.speakBadges = badges;
  window.persistSpeakStores();
  window.notifySpeakStoresChange();
  return true;
};

let speakSyncTimer = null;
let speakSyncInFlight = false;

const scheduleSpeakSync = (opts = {}) => {
  if (speakSyncTimer) return;
  speakSyncTimer = setTimeout(() => {
    speakSyncTimer = null;
    window.syncSpeakProgress({ reason: 'debounce', ...opts });
  }, SPEAK_SYNC_DEBOUNCE_MS);
};

window.queueSpeakEvent = (event) => {
  if (!event || typeof event !== 'object') return null;
  const next = { ...event };
  if (!next.id) next.id = createSpeakEventId();
  if (!next.ts) next.ts = Date.now();
  const events = readSpeakArray(SPEAK_EVENTS_KEY);
  events.push(next);
  if (events.length > SPEAK_MAX_EVENTS) {
    events.splice(0, events.length - SPEAK_MAX_EVENTS);
  }
  writeSpeakArray(SPEAK_EVENTS_KEY, events);
  scheduleSpeakSync();
  return next;
};

window.syncSpeakProgress = async (opts = {}) => {
  if (speakSyncInFlight && !opts.force) return { ok: false, skipped: 'in-flight' };
  const owner = getSpeakSyncOwner();
  if (!owner) return { ok: false, skipped: 'no-owner' };

  const endpoint = window.realtimeConfig && window.realtimeConfig.stateEndpoint;
  if (!endpoint) return { ok: false, skipped: 'no-endpoint' };
  if (window.navigator && window.navigator.onLine === false) {
    return { ok: false, skipped: 'offline' };
  }

  const conflictDecision = await resolveSpeakSyncConflictIfNeeded(owner, opts);
  if (conflictDecision && conflictDecision.action === 'use-server') {
    return { ok: false, skipped: 'conflict-server' };
  }
  let strategy = opts.strategy || 'merge';
  let forceIncludeSnapshot = false;
  if (conflictDecision && conflictDecision.action === 'use-local') {
    strategy = 'replace';
    forceIncludeSnapshot = true;
  }

  const events = readSpeakArray(SPEAK_EVENTS_KEY);
  const batch = events.slice(0, SPEAK_SYNC_BATCH);
  const lastOwner = localStorage.getItem(SPEAK_SYNC_OWNER_KEY) || '';
  const ownerChanged = lastOwner && lastOwner !== owner;
  const includeSnapshot =
    forceIncludeSnapshot ||
    opts.includeSnapshot === true ||
    (opts.includeSnapshotOnOwnerChange && ownerChanged) ||
    (opts.includeSnapshotIfEmpty && isSpeakSnapshotEmpty());

  if (!batch.length && !includeSnapshot) return { ok: false, skipped: 'empty' };

  const payload = {
    owner,
    events: batch,
    strategy
  };
  const uuid = window.uuid || localStorage.getItem('uuid') || '';
  if (uuid) payload.device_id = uuid;
  const userId = resolveSpeakUserId();
  if (userId !== undefined && userId !== null && String(userId) !== '') {
    payload.user_id = userId;
  }
  if (includeSnapshot) payload.snapshot = buildSpeakSnapshot();

  const headers = { 'Content-Type': 'application/json' };
  const token = window.realtimeConfig && window.realtimeConfig.stateToken;
  if (token) {
    headers['x-rt-token'] = token;
    payload.token = token;
  }

  speakSyncInFlight = true;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      speakSyncInFlight = false;
      return { ok: false, status: res.status };
    }
    const data = await res.json();
    const acked = Array.isArray(data.acked_ids) ? new Set(data.acked_ids) : null;
    if (acked && acked.size) {
      const remaining = events.filter((evt) => !acked.has(evt.id));
      writeSpeakArray(SPEAK_EVENTS_KEY, remaining);
    }
    if (data.snapshot) {
      const applySnapshot =
        opts.applySnapshot === true ||
        (opts.applySnapshotIfEmpty && isSpeakSnapshotEmpty()) ||
        (opts.applySnapshotOnOwnerChange && ownerChanged);
      if (applySnapshot) {
        applySpeakSnapshot(data.snapshot, { replace: opts.replaceSnapshot === true });
      }
    }
    localStorage.setItem(SPEAK_SYNC_OWNER_KEY, owner);
    localStorage.setItem(SPEAK_SYNC_TS_KEY, new Date().toISOString());
    speakSyncInFlight = false;
    return { ok: true, data };
  } catch (err) {
    speakSyncInFlight = false;
    console.error('[speak] sync error', err);
    return { ok: false, error: err.message || String(err) };
  }
};

window.addEventListener('online', () => {
  window.syncSpeakProgress({ reason: 'online', includeSnapshotIfEmpty: true });
});

window.addEventListener('app:user-change', (event) => {
  const nextId = readUserIdFromDetail(event && event.detail ? event.detail : null);
  const prevId = speakLastUserId;
  speakLastUserId = nextId;
  if (isValidSpeakUserId(prevId) && !isValidSpeakUserId(nextId)) {
    window.resetSpeakProgress();
    return;
  }
  const isLogin = !isValidSpeakUserId(prevId) && isValidSpeakUserId(nextId);
  if (isLogin) {
    (async () => {
      const localHasData = !isSpeakSnapshotEmpty();
      const expectedOwner = `user:${nextId}`;
      const localOwnerHint = resolveSpeakLocalOwnerHint();
      const localMatchesUser = localOwnerHint === expectedOwner;
      if (localHasData && !localMatchesUser) {
        writeSpeakSyncConflict(nextId);
      } else {
        clearSpeakSyncConflict();
      }
      const restored = await maybeRestoreSpeakProgressOnLogin(nextId);
      const includeSnapshot = !isSpeakSnapshotEmpty() || restored;
      window.syncSpeakProgress({
        reason: 'user-change',
        includeSnapshot,
        includeSnapshotOnOwnerChange: true,
        applySnapshotIfEmpty: true
      });
    })();
    return;
  }
  window.syncSpeakProgress({
    reason: 'user-change',
    includeSnapshotOnOwnerChange: true,
    applySnapshotIfEmpty: true
  });
});

const SPEAK_DEBUG_KEY = 'appv5:speak-debug';

const readSpeakDebug = () => {
  try {
    return localStorage.getItem(SPEAK_DEBUG_KEY) === '1';
  } catch (err) {
    return false;
  }
};

const writeSpeakDebug = (enabled) => {
  try {
    if (enabled) {
      localStorage.setItem(SPEAK_DEBUG_KEY, '1');
    } else {
      localStorage.removeItem(SPEAK_DEBUG_KEY);
    }
  } catch (err) {
    // no-op
  }
};

window.r34lp0w3r.speakDebug = readSpeakDebug();
window.setSpeakDebug = (enabled) => {
  const next = !!enabled;
  window.r34lp0w3r.speakDebug = next;
  writeSpeakDebug(next);
  window.dispatchEvent(new CustomEvent('app:speak-debug', { detail: next }));
};

// Debug: surface JSON.parse failures to identify endpoints that return HTML
(() => {
  const origJson = Response.prototype.json;
  Response.prototype.json = function () {
    const clone = this.clone();
    return origJson.call(this).catch(async (err) => {
      const body = await clone.text().catch(() => '');
      console.error('[json-fail]', this.url || '(no url)', body.slice(0, 120));
      throw err;
    });
  };
})();

// Catch unhandled promise rejections to see stack/urls in logcat
window.addEventListener('unhandledrejection', (ev) => {
  console.error('[unhandled]', ev.reason);
});

const ensurePlatform = () => {
  console.log("# 003 # js/init.js: ensurePlatform() #");
  if (window.Capacitor && typeof window.Capacitor.getPlatform === 'function') {
    initState.platform = window.Capacitor.getPlatform();
  } else {
    initState.platform = 'browser';
  }
  window.r34lp0w3r = window.r34lp0w3r || {};
  window.r34lp0w3r.platform = initState.platform;
};

const ensureUUID = () => {
  console.log("# 004 # js/init.js: ensureUUID() #");
  let uuid = localStorage.getItem('uuid');
  if (!uuid) {
    const pfx = initState.platform === 'android' ? 'PGA' : initState.platform === 'ios' ? 'PGI' : 'BRW';
    uuid = `${pfx}-xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    localStorage.setItem('uuid', uuid);
  }
  initState.uuid = uuid;
  window.uuid = uuid;
};

const loadVoices = () => {
  console.log("# 005 # js/init.js: loadVoices() #");
  if (!('speechSynthesis' in window)) return;
  const voices = window.speechSynthesis.getVoices();
  initState.voicesUS = [];
  initState.voicesGB = [];
  voices.forEach((voice, idx) => {
    if (voice.lang === 'en-US') initState.voicesUS.push([idx, voice.name]);
    if (voice.lang === 'en-GB') initState.voicesGB.push([idx, voice.name]);
  });
  window.r34lp0w3r.voices_US = initState.voicesUS;
  window.r34lp0w3r.voices_GB = initState.voicesGB;
};

const initVoicesIfBrowser = () => {
  if (initState.platform !== 'browser') return;
  // 1) intento inmediato
  loadVoices();
  // 2) si aún no estuvieran cargadas
  window.speechSynthesis.onvoiceschanged = loadVoices;
};

const onReady = () => {
  console.log("# 002 # js/init.js: onReady() #");
  ensurePlatform();
  ensureUUID();
  initVoicesIfBrowser();
};

// Compatibilidad con deviceready (cordova/capacitor bridge) y fallback a DOMContentLoaded
console.log("# 001 # js/init.js: bind deviceready to onReady() #");
if (window.Capacitor || window.cordova) {
  document.addEventListener('deviceready', onReady, false);
} else {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    onReady();
  } else {
    document.addEventListener('DOMContentLoaded', onReady);
  }
}
