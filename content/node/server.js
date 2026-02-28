const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

const env = (key, fallback) => (process.env[key] ? process.env[key] : fallback);
const port = Number(env('CONTENT_PORT', '8791'));
const adminToken = String(env('CONTENT_ADMIN_TOKEN', '') || '').trim();
const readToken = String(env('CONTENT_READ_TOKEN', '') || '').trim();
const contentRoot = path.join(__dirname, '..');
const dbPathInput = String(env('CONTENT_DB_PATH', './node/data/content.db'));
const dbPath = path.isAbsolute(dbPathInput)
  ? dbPathInput
  : path.resolve(contentRoot, dbPathInput);

const ensureDir = (filepath) => {
  const dir = path.dirname(filepath);
  fs.mkdirSync(dir, { recursive: true });
};

ensureDir(dbPath);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');

const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schemaSql);

const hasSessionLegacyColumns = () => {
  const rows = db.prepare(`PRAGMA table_info('sessions')`).all();
  const names = new Set(rows.map((row) => String(row.name || '').trim()));
  return (
    names.has('progress_done') ||
    names.has('progress_total') ||
    names.has('status_score') ||
    names.has('status_label') ||
    names.has('status_tone')
  );
};

const migrateSessionsTableIfNeeded = () => {
  if (!hasSessionLegacyColumns()) return false;

  const tx = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions_new (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        speak_focus TEXT DEFAULT '',
        speak_sound_json TEXT NOT NULL DEFAULT '{}',
        speak_spelling_json TEXT NOT NULL DEFAULT '{}',
        speak_sentence_json TEXT NOT NULL DEFAULT '{}',
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      )
    `);

    db.exec(`
      INSERT INTO sessions_new(
        id, title, speak_focus, speak_sound_json, speak_spelling_json, speak_sentence_json, sort_order, is_active, updated_at
      )
      SELECT
        id,
        title,
        COALESCE(speak_focus, ''),
        COALESCE(speak_sound_json, '{}'),
        COALESCE(speak_spelling_json, '{}'),
        COALESCE(speak_sentence_json, '{}'),
        COALESCE(sort_order, 0),
        COALESCE(is_active, 1),
        COALESCE(updated_at, '')
      FROM sessions
    `);

    db.exec('DROP TABLE sessions');
    db.exec('ALTER TABLE sessions_new RENAME TO sessions');
  });

  db.pragma('foreign_keys = OFF');
  try {
    tx();
  } finally {
    db.pragma('foreign_keys = ON');
  }
  return true;
};

const migratedSessionsTable = migrateSessionsTableIfNeeded();
if (migratedSessionsTable) {
  console.log('[content] migrated sessions table: removed legacy progress/status columns');
}

const app = express();
app.use(
  cors({
    origin: true,
    credentials: true
  })
);
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
const dashboardDir = path.join(__dirname, 'public');
if (fs.existsSync(dashboardDir)) {
  app.use('/dashboard', express.static(dashboardDir, { redirect: false }));
  app.get('/styles.css', (req, res) => {
    res.sendFile(path.join(dashboardDir, 'styles.css'));
  });
  app.get('/app.js', (req, res) => {
    res.sendFile(path.join(dashboardDir, 'app.js'));
  });
  app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(dashboardDir, 'index.html'));
  });
  app.get('/', (req, res) => {
    res.sendFile(path.join(dashboardDir, 'index.html'));
  });
}

const nowIso = () => new Date().toISOString();

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
};

const normalizeStringArray = (value) => {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  value.forEach((item) => {
    const text = String(item === undefined || item === null ? '' : item).trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    out.push(text);
  });
  return out;
};

const parseJsonSafe = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch (err) {
    return fallback;
  }
};

const getAdminRequestToken = (req) => {
  const header = req.get('x-content-token');
  if (header) return String(header).trim();
  const auth = req.get('authorization');
  if (!auth) return '';
  const m = String(auth).match(/^Bearer\s+(.+)$/i);
  return m ? String(m[1]).trim() : '';
};

const hasValidAdminRequestToken = (req) => {
  if (!adminToken) return false;
  const incoming = getAdminRequestToken(req);
  return Boolean(incoming && incoming === adminToken);
};

const isAdminAuthorized = (req) => {
  if (!adminToken) return true;
  return hasValidAdminRequestToken(req);
};

const getReadRequestToken = (req) => {
  const byHeader = req.get('x-content-read-token');
  if (byHeader) return String(byHeader).trim();
  const byContentHeader = req.get('x-content-token');
  if (byContentHeader) return String(byContentHeader).trim();
  const rtHeader = req.get('x-rt-token');
  if (rtHeader) return String(rtHeader).trim();
  const auth = req.get('authorization');
  if (!auth) return '';
  const m = String(auth).match(/^Bearer\s+(.+)$/i);
  return m ? String(m[1]).trim() : '';
};

const isReadAuthorized = (req) => {
  if (hasValidAdminRequestToken(req)) return true;
  if (!readToken) return true;
  const incoming = getReadRequestToken(req);
  return Boolean(incoming && incoming === readToken);
};

const requireAdmin = (req, res, next) => {
  if (!isAdminAuthorized(req)) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }
  next();
};

const requireRead = (req, res, next) => {
  if (!isReadAuthorized(req)) {
    res.status(401).json({ ok: false, error: 'unauthorized_read' });
    return;
  }
  next();
};

const setSetting = db.prepare(`
  INSERT INTO settings(key, value, updated_at)
  VALUES (@key, @value, @updated_at)
  ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = excluded.updated_at
`);

const getSettingStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
const getSetting = (key) => {
  const row = getSettingStmt.get(String(key));
  return row ? row.value : null;
};

const upsertRoute = db.prepare(`
  INSERT INTO routes(id, title, note, sort_order, is_active, updated_at)
  VALUES (@id, @title, @note, @sort_order, @is_active, @updated_at)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    note = excluded.note,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    updated_at = excluded.updated_at
`);

const upsertModule = db.prepare(`
  INSERT INTO modules(id, title, subtitle, sort_order, is_active, updated_at)
  VALUES (@id, @title, @subtitle, @sort_order, @is_active, @updated_at)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    subtitle = excluded.subtitle,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    updated_at = excluded.updated_at
`);

const upsertSession = db.prepare(`
  INSERT INTO sessions(
    id,
    title,
    speak_focus,
    speak_sound_json,
    speak_spelling_json,
    speak_sentence_json,
    sort_order,
    is_active,
    updated_at
  )
  VALUES (
    @id,
    @title,
    @speak_focus,
    @speak_sound_json,
    @speak_spelling_json,
    @speak_sentence_json,
    @sort_order,
    @is_active,
    @updated_at
  )
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    speak_focus = excluded.speak_focus,
    speak_sound_json = excluded.speak_sound_json,
    speak_spelling_json = excluded.speak_spelling_json,
    speak_sentence_json = excluded.speak_sentence_json,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    updated_at = excluded.updated_at
`);

const insertRouteModule = db.prepare(`
  INSERT INTO route_modules(route_id, module_id, sort_order)
  VALUES (?, ?, ?)
  ON CONFLICT(route_id, module_id) DO UPDATE SET
    sort_order = excluded.sort_order
`);

const insertModuleSession = db.prepare(`
  INSERT INTO module_sessions(module_id, session_id, sort_order)
  VALUES (?, ?, ?)
  ON CONFLICT(module_id, session_id) DO UPDATE SET
    sort_order = excluded.sort_order
`);

const deleteAllRouteModules = db.prepare('DELETE FROM route_modules');
const deleteAllModuleSessions = db.prepare('DELETE FROM module_sessions');
const deleteAllRoutes = db.prepare('DELETE FROM routes');
const deleteAllModules = db.prepare('DELETE FROM modules');
const deleteAllSessions = db.prepare('DELETE FROM sessions');

const countByTable = {
  routes: db.prepare('SELECT COUNT(*) AS n FROM routes').pluck(),
  modules: db.prepare('SELECT COUNT(*) AS n FROM modules').pluck(),
  sessions: db.prepare('SELECT COUNT(*) AS n FROM sessions').pluck(),
  releases: db.prepare('SELECT COUNT(*) AS n FROM releases').pluck()
};

const validateArrayOfObjects = (arr, name) => {
  if (!Array.isArray(arr)) {
    throw new Error(`${name} must be an array`);
  }
  arr.forEach((entry, idx) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`${name}[${idx}] must be an object`);
    }
  });
};

const ensureUniqueIds = (items, fieldName, collectionName) => {
  const seen = new Set();
  items.forEach((item, idx) => {
    const id = String(item[fieldName] || '').trim();
    if (!id) throw new Error(`${collectionName}[${idx}] id is required`);
    if (seen.has(id)) throw new Error(`duplicate ${collectionName} id: ${id}`);
    seen.add(id);
  });
};

const normalizeTrainingPayload = (rawPayload) => {
  if (!rawPayload || typeof rawPayload !== 'object') {
    throw new Error('payload must be an object');
  }

  const routesIn = rawPayload.routes || [];
  const modulesIn = rawPayload.modules || [];
  const sessionsIn = rawPayload.sessions || [];

  validateArrayOfObjects(routesIn, 'routes');
  validateArrayOfObjects(modulesIn, 'modules');
  validateArrayOfObjects(sessionsIn, 'sessions');

  ensureUniqueIds(routesIn, 'id', 'route');
  ensureUniqueIds(modulesIn, 'id', 'module');
  ensureUniqueIds(sessionsIn, 'id', 'session');

  const moduleIdSet = new Set(modulesIn.map((m) => String(m.id).trim()));
  const sessionIdSet = new Set(sessionsIn.map((s) => String(s.id).trim()));

  const routes = routesIn.map((route, idx) => {
    const id = String(route.id).trim();
    const title = String(route.title || '').trim();
    if (!title) throw new Error(`route ${id} is missing title`);
    const moduleIds = Array.isArray(route.moduleIds)
      ? route.moduleIds.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
    moduleIds.forEach((moduleId) => {
      if (!moduleIdSet.has(moduleId)) {
        throw new Error(`route ${id} references missing module ${moduleId}`);
      }
    });
    return {
      id,
      title,
      note: String(route.note || ''),
      sortOrder: idx,
      moduleIds
    };
  });

  const modules = modulesIn.map((module, idx) => {
    const id = String(module.id).trim();
    const title = String(module.title || '').trim();
    if (!title) throw new Error(`module ${id} is missing title`);
    const sessionIds = Array.isArray(module.sessionIds)
      ? module.sessionIds.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
    sessionIds.forEach((sessionId) => {
      if (!sessionIdSet.has(sessionId)) {
        throw new Error(`module ${id} references missing session ${sessionId}`);
      }
    });
    return {
      id,
      title,
      subtitle: String(module.subtitle || ''),
      sortOrder: idx,
      sessionIds
    };
  });

  const sessions = sessionsIn.map((session, idx) => {
    const id = String(session.id).trim();
    const title = String(session.title || '').trim();
    if (!title) throw new Error(`session ${id} is missing title`);

    const speak = session.speak && typeof session.speak === 'object' ? session.speak : {};

    const soundRaw = speak.sound && typeof speak.sound === 'object' ? speak.sound : {};
    const spellingRaw = speak.spelling && typeof speak.spelling === 'object' ? speak.spelling : {};
    const sentenceRaw = speak.sentence && typeof speak.sentence === 'object' ? speak.sentence : {};
    const sound = {
      title: String(soundRaw.title || ''),
      hint: String(soundRaw.hint || ''),
      phonetic: String(soundRaw.phonetic || ''),
      expected: String(soundRaw.expected || '')
    };
    const spelling = {
      title: String(spellingRaw.title || ''),
      hint: String(spellingRaw.hint || ''),
      words: normalizeStringArray(spellingRaw.words)
    };
    const sentence = {
      title: String(sentenceRaw.title || ''),
      hint: String(sentenceRaw.hint || ''),
      sentence: String(sentenceRaw.sentence || ''),
      expected: String(sentenceRaw.expected || '')
    };

    return {
      id,
      title,
      speakFocus: String(speak.focus || ''),
      sound,
      spelling,
      sentence,
      sortOrder: idx
    };
  });

  return { routes, modules, sessions };
};

const toTrainingPayload = (normalized) => ({
  routes: normalized.routes.map((route) => ({
    id: route.id,
    title: route.title,
    note: route.note || '',
    moduleIds: Array.isArray(route.moduleIds) ? route.moduleIds.slice() : []
  })),
  modules: normalized.modules.map((module) => ({
    id: module.id,
    title: module.title,
    subtitle: module.subtitle || '',
    sessionIds: Array.isArray(module.sessionIds) ? module.sessionIds.slice() : []
  })),
  sessions: normalized.sessions.map((session) => ({
    id: session.id,
    title: session.title,
    speak: {
      focus: session.speakFocus || '',
      sound: session.sound || {},
      spelling: session.spelling || {},
      sentence: session.sentence || {}
    }
  }))
});

const sanitizeTrainingPayload = (payload) => toTrainingPayload(normalizeTrainingPayload(payload));

const importTrainingNormalized = (normalized, options = {}) => {
  const replace = options.replace !== false;
  const runAt = nowIso();

  const transaction = db.transaction(() => {
    if (replace) {
      deleteAllRouteModules.run();
      deleteAllModuleSessions.run();
      deleteAllRoutes.run();
      deleteAllModules.run();
      deleteAllSessions.run();
    }

    normalized.routes.forEach((route) => {
      upsertRoute.run({
        id: route.id,
        title: route.title,
        note: route.note,
        sort_order: route.sortOrder,
        is_active: 1,
        updated_at: runAt
      });
    });

    normalized.modules.forEach((module) => {
      upsertModule.run({
        id: module.id,
        title: module.title,
        subtitle: module.subtitle,
        sort_order: module.sortOrder,
        is_active: 1,
        updated_at: runAt
      });
    });

    normalized.sessions.forEach((session) => {
      upsertSession.run({
        id: session.id,
        title: session.title,
        speak_focus: session.speakFocus,
        speak_sound_json: JSON.stringify(session.sound || {}),
        speak_spelling_json: JSON.stringify(session.spelling || {}),
        speak_sentence_json: JSON.stringify(session.sentence || {}),
        sort_order: session.sortOrder,
        is_active: 1,
        updated_at: runAt
      });
    });

    deleteAllRouteModules.run();
    deleteAllModuleSessions.run();

    normalized.routes.forEach((route) => {
      route.moduleIds.forEach((moduleId, idx) => {
        insertRouteModule.run(route.id, moduleId, idx);
      });
    });

    normalized.modules.forEach((module) => {
      module.sessionIds.forEach((sessionId, idx) => {
        insertModuleSession.run(module.id, sessionId, idx);
      });
    });

    setSetting.run({
      key: 'draft_updated_at',
      value: runAt,
      updated_at: runAt
    });
  });

  transaction();
};

const selectRoutes = db.prepare(
  'SELECT id, title, note, sort_order FROM routes WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
);
const selectModules = db.prepare(
  'SELECT id, title, subtitle, sort_order FROM modules WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
);
const selectSessions = db.prepare(
  `SELECT
    id,
    title,
    speak_focus,
    speak_sound_json,
    speak_spelling_json,
    speak_sentence_json,
    sort_order
   FROM sessions
   WHERE is_active = 1
   ORDER BY sort_order ASC, id ASC`
);

const selectRouteModules = db.prepare(
  'SELECT route_id, module_id, sort_order FROM route_modules ORDER BY route_id ASC, sort_order ASC, module_id ASC'
);

const selectModuleSessions = db.prepare(
  'SELECT module_id, session_id, sort_order FROM module_sessions ORDER BY module_id ASC, sort_order ASC, session_id ASC'
);

const buildTrainingDataFromLive = () => {
  const routesRows = selectRoutes.all();
  const modulesRows = selectModules.all();
  const sessionsRows = selectSessions.all();

  const modulesById = new Map(modulesRows.map((row) => [row.id, row]));
  const sessionsById = new Map(sessionsRows.map((row) => [row.id, row]));

  const moduleIdsByRoute = new Map();
  selectRouteModules.all().forEach((row) => {
    if (!modulesById.has(row.module_id)) return;
    const list = moduleIdsByRoute.get(row.route_id) || [];
    list.push(String(row.module_id));
    moduleIdsByRoute.set(row.route_id, list);
  });

  const sessionIdsByModule = new Map();
  selectModuleSessions.all().forEach((row) => {
    if (!sessionsById.has(row.session_id)) return;
    const list = sessionIdsByModule.get(row.module_id) || [];
    list.push(String(row.session_id));
    sessionIdsByModule.set(row.module_id, list);
  });

  const routes = routesRows.map((row) => ({
    id: row.id,
    title: row.title,
    note: row.note || '',
    moduleIds: moduleIdsByRoute.get(row.id) || []
  }));

  const modules = modulesRows.map((row) => ({
    id: row.id,
    title: row.title,
    subtitle: row.subtitle || '',
    sessionIds: sessionIdsByModule.get(row.id) || []
  }));

  const sessions = sessionsRows.map((row) => ({
    id: row.id,
    title: row.title,
    speak: {
      focus: row.speak_focus || '',
      sound: parseJsonSafe(row.speak_sound_json, {}),
      spelling: parseJsonSafe(row.speak_spelling_json, {}),
      sentence: parseJsonSafe(row.speak_sentence_json, {})
    }
  }));

  return sanitizeTrainingPayload({ routes, modules, sessions });
};

const getPublishedReleaseRow = db.prepare(
  'SELECT id, name, snapshot_json, created_at, published_at FROM releases WHERE published = 1 ORDER BY published_at DESC, id DESC LIMIT 1'
);
const listReleasesStmt = db.prepare(
  'SELECT id, name, published, created_at, published_at FROM releases ORDER BY id DESC LIMIT ?'
);
const getReleaseByIdStmt = db.prepare(
  'SELECT id, name, snapshot_json, created_at, published, published_at FROM releases WHERE id = ?'
);
const unpublishAllStmt = db.prepare('UPDATE releases SET published = 0 WHERE published = 1');
const publishByIdStmt = db.prepare('UPDATE releases SET published = 1, published_at = ? WHERE id = ?');
const createReleaseStmt = db.prepare(
  'INSERT INTO releases(name, snapshot_json, published, created_at, published_at) VALUES (?, ?, ?, ?, ?)'
);

const createReleaseFromLive = (name, publish) => {
  const snapshot = buildTrainingDataFromLive();
  const now = nowIso();
  const tx = db.transaction(() => {
    if (publish) {
      unpublishAllStmt.run();
    }
    const info = createReleaseStmt.run(name || `release-${now}`, JSON.stringify(snapshot), publish ? 1 : 0, now, publish ? now : null);
    const releaseId = Number(info.lastInsertRowid);
    if (publish) {
      setSetting.run({ key: 'published_release_id', value: String(releaseId), updated_at: now });
      setSetting.run({ key: 'published_updated_at', value: now, updated_at: now });
    }
    return { releaseId, snapshot };
  });
  return tx();
};

const publishReleaseById = (releaseId) => {
  const row = getReleaseByIdStmt.get(Number(releaseId));
  if (!row) {
    const err = new Error('release_not_found');
    err.code = 'release_not_found';
    throw err;
  }
  const now = nowIso();
  const tx = db.transaction(() => {
    unpublishAllStmt.run();
    publishByIdStmt.run(now, Number(releaseId));
    setSetting.run({ key: 'published_release_id', value: String(releaseId), updated_at: now });
    setSetting.run({ key: 'published_updated_at', value: now, updated_at: now });
  });
  tx();
  return getReleaseByIdStmt.get(Number(releaseId));
};

const restoreDraftFromRelease = (releaseId) => {
  const row = getReleaseByIdStmt.get(Number(releaseId));
  if (!row) {
    const err = new Error('release_not_found');
    err.code = 'release_not_found';
    throw err;
  }
  const payload = parseJsonSafe(row.snapshot_json, null);
  if (!payload || typeof payload !== 'object') {
    const err = new Error('release_snapshot_invalid');
    err.code = 'release_snapshot_invalid';
    throw err;
  }
  const normalized = normalizeTrainingPayload(payload);
  importTrainingNormalized(normalized, { replace: true });
  return {
    releaseId: Number(releaseId),
    name: row.name || '',
    restoredAt: nowIso()
  };
};

const resolvePayloadFromRequest = (reqBody = {}) => {
  if (reqBody && reqBody.payload && typeof reqBody.payload === 'object') {
    return reqBody.payload;
  }

  const filePath = String(reqBody.filePath || reqBody.file_path || '').trim();
  const defaultPath = path.resolve(__dirname, '..', '..', 'www', 'js', 'data', 'training-data.json');
  const resolved = filePath ? path.resolve(filePath) : defaultPath;
  if (!fs.existsSync(resolved)) {
    throw new Error(`training file not found: ${resolved}`);
  }
  const raw = fs.readFileSync(resolved, 'utf8');
  const parsed = JSON.parse(raw);
  return parsed;
};

app.get('/content/health', (req, res) => {
  res.json({
    ok: true,
    service: 'speakapp-content-service',
    db_path: dbPath,
    admin_auth_enabled: Boolean(adminToken),
    read_auth_enabled: Boolean(readToken),
    counts: {
      routes: Number(countByTable.routes.get() || 0),
      modules: Number(countByTable.modules.get() || 0),
      sessions: Number(countByTable.sessions.get() || 0),
      releases: Number(countByTable.releases.get() || 0)
    },
    draft_updated_at: getSetting('draft_updated_at'),
    published_release_id: getSetting('published_release_id'),
    published_updated_at: getSetting('published_updated_at')
  });
});

app.get('/content/training-data', requireRead, (req, res) => {
  const preview = parseBoolean(req.query.preview, false);
  if (preview && !isAdminAuthorized(req)) {
    res.status(401).json({ ok: false, error: 'unauthorized_preview' });
    return;
  }

  if (preview) {
    const live = buildTrainingDataFromLive();
    res.json({ ok: true, source: 'live-preview', data: live });
    return;
  }

  const published = getPublishedReleaseRow.get();
  if (published && published.snapshot_json) {
    const payload = parseJsonSafe(published.snapshot_json, null);
    if (payload && typeof payload === 'object') {
      let sanitized = null;
      try {
        sanitized = sanitizeTrainingPayload(payload);
      } catch (err) {
        console.warn('[content] ignoring invalid published snapshot, falling back to live:', err.message);
      }
      if (sanitized) {
        res.json({
          ok: true,
          source: 'published',
          release: {
            id: Number(published.id),
            name: published.name || '',
            published_at: published.published_at || null
          },
          data: sanitized
        });
        return;
      }
    }
  }

  const live = buildTrainingDataFromLive();
  res.json({ ok: true, source: 'live-unpublished', data: live });
});

app.get('/content/admin/training-data', requireAdmin, (req, res) => {
  const live = buildTrainingDataFromLive();
  const published = getPublishedReleaseRow.get();
  const publishedRaw = published && published.snapshot_json ? parseJsonSafe(published.snapshot_json, null) : null;
  let publishedData = null;
  if (publishedRaw && typeof publishedRaw === 'object') {
    try {
      publishedData = sanitizeTrainingPayload(publishedRaw);
    } catch (err) {
      console.warn('[content] invalid published snapshot in admin view:', err.message);
    }
  }

  res.json({
    ok: true,
    live,
    published: published
      ? {
          id: Number(published.id),
          name: published.name || '',
          created_at: published.created_at || null,
          published_at: published.published_at || null,
          data: publishedData
        }
      : null
  });
});

app.put('/content/admin/training-data', requireAdmin, (req, res, next) => {
  try {
    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const normalized = normalizeTrainingPayload(payload);
    importTrainingNormalized(normalized, { replace: true });
    res.json({
      ok: true,
      counts: {
        routes: normalized.routes.length,
        modules: normalized.modules.length,
        sessions: normalized.sessions.length
      }
    });
  } catch (err) {
    next(err);
  }
});

app.post('/content/admin/import/training-json', requireAdmin, (req, res, next) => {
  try {
    const payload = resolvePayloadFromRequest(req.body || {});
    const normalized = normalizeTrainingPayload(payload);
    const replace = parseBoolean(req.body && req.body.replace, true);
    importTrainingNormalized(normalized, { replace });

    const releaseName = String((req.body && req.body.releaseName) || '').trim();
    const publishNow = parseBoolean(req.body && req.body.publish, false);

    let release = null;
    if (publishNow) {
      const created = createReleaseFromLive(releaseName || `import-${nowIso()}`, true);
      release = { id: created.releaseId, published: true };
    }

    res.json({
      ok: true,
      replace,
      counts: {
        routes: normalized.routes.length,
        modules: normalized.modules.length,
        sessions: normalized.sessions.length
      },
      release
    });
  } catch (err) {
    next(err);
  }
});

app.post('/content/admin/publish', requireAdmin, (req, res, next) => {
  try {
    const name = String((req.body && req.body.name) || '').trim();
    const created = createReleaseFromLive(name || `publish-${nowIso()}`, true);
    res.json({
      ok: true,
      release: {
        id: created.releaseId,
        name: name || '',
        published: true,
        created_at: nowIso()
      }
    });
  } catch (err) {
    next(err);
  }
});

app.get('/content/admin/releases', requireAdmin, (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 200);
  const items = listReleasesStmt.all(limit).map((row) => ({
    id: Number(row.id),
    name: row.name || '',
    published: Boolean(row.published),
    created_at: row.created_at || null,
    published_at: row.published_at || null
  }));
  res.json({ ok: true, releases: items });
});

app.post('/content/admin/releases/:id/publish', requireAdmin, (req, res, next) => {
  try {
    const releaseId = Number(req.params.id);
    if (!Number.isFinite(releaseId) || releaseId <= 0) {
      res.status(400).json({ ok: false, error: 'invalid_release_id' });
      return;
    }
    const published = publishReleaseById(releaseId);
    res.json({
      ok: true,
      release: {
        id: Number(published.id),
        name: published.name || '',
        published: Boolean(published.published),
        created_at: published.created_at || null,
        published_at: published.published_at || null
      }
    });
  } catch (err) {
    next(err);
  }
});

app.post('/content/admin/releases/:id/restore-draft', requireAdmin, (req, res, next) => {
  try {
    const releaseId = Number(req.params.id);
    if (!Number.isFinite(releaseId) || releaseId <= 0) {
      res.status(400).json({ ok: false, error: 'invalid_release_id' });
      return;
    }
    const result = restoreDraftFromRelease(releaseId);
    res.json({ ok: true, result });
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, _next) => {
  const message = err && err.message ? String(err.message) : 'internal_error';
  const status =
    message === 'release_not_found'
      ? 404
      : message === 'release_snapshot_invalid'
      ? 500
      : 400;
  if (status >= 500) {
    console.error('[content] error:', err);
  }
  res.status(status).json({ ok: false, error: message });
});

app.listen(port, () => {
  console.log(`[content] listening on :${port}`);
  console.log(`[content] db: ${dbPath}`);
  if (adminToken) {
    console.log('[content] admin auth: enabled');
  } else {
    console.log('[content] admin auth: disabled (set CONTENT_ADMIN_TOKEN)');
  }
  if (readToken) {
    console.log('[content] read auth: enabled');
  } else {
    console.log('[content] read auth: disabled (set CONTENT_READ_TOKEN)');
  }
});
