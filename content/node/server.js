const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const env = (key, fallback) => (process.env[key] ? process.env[key] : fallback);
const port = Number(env('CONTENT_PORT', '8791'));
const adminToken = String(env('CONTENT_ADMIN_TOKEN', '') || '').trim();
const readToken = String(env('CONTENT_READ_TOKEN', '') || '').trim();
const jwtSecret = String(env('CONTENT_JWT_SECRET', '') || '').trim();
const jwtTtlSeconds = Math.max(300, Number(env('CONTENT_JWT_TTL_SECONDS', '43200')) || 43200);
const lockTtlSeconds = Math.max(60, Number(env('CONTENT_DRAFT_LOCK_TTL_SECONDS', '600')) || 600);
const seedEditorEmail = String(env('CONTENT_EDITOR_SEED_EMAIL', '') || '')
  .trim()
  .toLowerCase();
const seedEditorPassword = String(env('CONTENT_EDITOR_SEED_PASSWORD', '') || '').trim();
const seedEditorName = String(env('CONTENT_EDITOR_SEED_NAME', '') || '').trim() || 'Content Admin';
const seedEditorRole = String(env('CONTENT_EDITOR_SEED_ROLE', '') || '').trim().toLowerCase() || 'admin';
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
const nowEpochSec = () => Math.floor(Date.now() / 1000);

const ROLE_RANK = { editor: 1, publisher: 2, admin: 3 };
const normalizeRole = (role) => {
  const value = String(role || '')
    .trim()
    .toLowerCase();
  return ROLE_RANK[value] ? value : 'editor';
};
const hasRoleAtLeast = (role, minRole) => {
  const roleValue = normalizeRole(role);
  const minValue = normalizeRole(minRole);
  return (ROLE_RANK[roleValue] || 0) >= (ROLE_RANK[minValue] || 0);
};

const editorAuthEnabled = Boolean(jwtSecret);

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

const getBearerToken = (req) => {
  const auth = req.get('authorization');
  if (!auth) return '';
  const m = String(auth).match(/^Bearer\s+(.+)$/i);
  return m ? String(m[1]).trim() : '';
};

const getAdminRequestToken = (req) => {
  const header = req.get('x-content-token');
  if (header) return String(header).trim();
  return getBearerToken(req);
};

const hasValidAdminRequestToken = (req) => {
  if (!adminToken) return false;
  const incoming = getAdminRequestToken(req);
  return Boolean(incoming && incoming === adminToken);
};

const getReadRequestToken = (req) => {
  const byHeader = req.get('x-content-read-token');
  if (byHeader) return String(byHeader).trim();
  const byContentHeader = req.get('x-content-token');
  if (byContentHeader) return String(byContentHeader).trim();
  const rtHeader = req.get('x-rt-token');
  if (rtHeader) return String(rtHeader).trim();
  return getBearerToken(req);
};

const getEditorJwtCandidate = (req) => {
  const bearer = getBearerToken(req);
  if (bearer) return bearer;
  const byHeader = req.get('x-content-jwt');
  if (byHeader) return String(byHeader).trim();
  const byContent = req.get('x-content-token');
  if (byContent) return String(byContent).trim();
  return '';
};

const buildGuestAuth = () => ({
  mode: 'guest',
  authorized: false,
  role: 'guest',
  editorId: null,
  email: '',
  displayName: ''
});

const buildLegacyAdminAuth = () => ({
  mode: 'legacy-admin',
  authorized: true,
  role: 'admin',
  editorId: null,
  email: 'legacy-admin',
  displayName: 'Legacy Admin'
});

const resolveRequestAuth = (req) => {
  if (hasValidAdminRequestToken(req)) return buildLegacyAdminAuth();

  if (!editorAuthEnabled) {
    if (!adminToken) {
      return {
        mode: 'open',
        authorized: true,
        role: 'admin',
        editorId: null,
        email: 'open-mode',
        displayName: 'Open Mode'
      };
    }
    return buildGuestAuth();
  }

  const token = getEditorJwtCandidate(req);
  if (!token) return buildGuestAuth();

  try {
    const decoded = jwt.verify(token, jwtSecret);
    const editorIdRaw = Number(decoded && decoded.sub);
    if (!Number.isFinite(editorIdRaw) || editorIdRaw <= 0) return buildGuestAuth();
    const row = selectEditorById.get(editorIdRaw);
    if (!row || !row.is_active) return buildGuestAuth();
    return {
      mode: 'editor-jwt',
      authorized: true,
      role: normalizeRole(row.role),
      editorId: Number(row.id),
      email: String(row.email || ''),
      displayName: String(row.display_name || '')
    };
  } catch (_err) {
    return buildGuestAuth();
  }
};

const requireRole = (minRole) => (req, res, next) => {
  const auth = resolveRequestAuth(req);
  req.auth = auth;
  if (!auth.authorized) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }
  if (!hasRoleAtLeast(auth.role, minRole)) {
    res.status(403).json({ ok: false, error: 'forbidden' });
    return;
  }
  next();
};

const requireAdmin = requireRole('admin');
const requirePublisher = requireRole('publisher');
const requireEditor = requireRole('editor');

const requireRead = (req, res, next) => {
  const auth = resolveRequestAuth(req);
  req.auth = auth;
  if (auth.authorized) {
    next();
    return;
  }
  if (!readToken) {
    next();
    return;
  }
  const incoming = getReadRequestToken(req);
  if (incoming && incoming === readToken) {
    next();
    return;
  }
  res.status(401).json({ ok: false, error: 'unauthorized_read' });
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

const countEditorsStmt = db.prepare('SELECT COUNT(*) AS n FROM editor_users').pluck();
const selectEditorByEmail = db.prepare(
  'SELECT id, email, display_name, password_hash, role, is_active, created_at, updated_at FROM editor_users WHERE lower(email) = lower(?) LIMIT 1'
);
const selectEditorById = db.prepare(
  'SELECT id, email, display_name, password_hash, role, is_active, created_at, updated_at FROM editor_users WHERE id = ? LIMIT 1'
);
const listEditorsStmt = db.prepare(
  'SELECT id, email, display_name, role, is_active, created_at, updated_at FROM editor_users ORDER BY id ASC'
);
const insertEditorStmt = db.prepare(`
  INSERT INTO editor_users(email, display_name, password_hash, role, is_active, created_at, updated_at)
  VALUES (@email, @display_name, @password_hash, @role, @is_active, @created_at, @updated_at)
`);
const updateEditorRoleStatusStmt = db.prepare(`
  UPDATE editor_users
  SET role = @role, is_active = @is_active, display_name = @display_name, updated_at = @updated_at
  WHERE id = @id
`);
const updateEditorPasswordStmt = db.prepare(`
  UPDATE editor_users
  SET password_hash = @password_hash, updated_at = @updated_at
  WHERE id = @id
`);

const insertAuditLogStmt = db.prepare(`
  INSERT INTO audit_log(actor_id, actor_email, actor_role, action, target, details_json, created_at)
  VALUES (@actor_id, @actor_email, @actor_role, @action, @target, @details_json, @created_at)
`);
const listAuditLogStmt = db.prepare(`
  SELECT id, actor_id, actor_email, actor_role, action, target, details_json, created_at
  FROM audit_log
  ORDER BY id DESC
  LIMIT ?
`);

const getDraftLockStmt = db.prepare(
  'SELECT lock_key, owner_id, owner_email, lock_token, acquired_at, expires_at, updated_at FROM draft_locks WHERE lock_key = ? LIMIT 1'
);
const upsertDraftLockStmt = db.prepare(`
  INSERT INTO draft_locks(lock_key, owner_id, owner_email, lock_token, acquired_at, expires_at, updated_at)
  VALUES (@lock_key, @owner_id, @owner_email, @lock_token, @acquired_at, @expires_at, @updated_at)
  ON CONFLICT(lock_key) DO UPDATE SET
    owner_id = excluded.owner_id,
    owner_email = excluded.owner_email,
    lock_token = excluded.lock_token,
    acquired_at = excluded.acquired_at,
    expires_at = excluded.expires_at,
    updated_at = excluded.updated_at
`);
const deleteDraftLockStmt = db.prepare('DELETE FROM draft_locks WHERE lock_key = ?');

const sanitizeEditorRow = (row) => {
  if (!row) return null;
  return {
    id: Number(row.id),
    email: String(row.email || ''),
    display_name: String(row.display_name || ''),
    role: normalizeRole(row.role),
    is_active: Boolean(row.is_active),
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  };
};

const buildEditorJwt = (editorRow) => {
  const role = normalizeRole(editorRow.role);
  const payload = {
    sub: String(editorRow.id),
    role,
    email: String(editorRow.email || '')
  };
  return jwt.sign(payload, jwtSecret, { expiresIn: jwtTtlSeconds });
};

const createEditorUser = ({ email, displayName, password, role, isActive = true }) => {
  const normalizedEmail = String(email || '')
    .trim()
    .toLowerCase();
  const normalizedName = String(displayName || '').trim();
  const normalizedRole = normalizeRole(role);
  const rawPassword = String(password || '');
  if (!normalizedEmail) throw new Error('editor_email_required');
  if (!rawPassword || rawPassword.length < 8) throw new Error('editor_password_too_short');

  const existing = selectEditorByEmail.get(normalizedEmail);
  if (existing) throw new Error('editor_email_exists');

  const now = nowIso();
  const passwordHash = bcrypt.hashSync(rawPassword, 10);
  const info = insertEditorStmt.run({
    email: normalizedEmail,
    display_name: normalizedName,
    password_hash: passwordHash,
    role: normalizedRole,
    is_active: isActive ? 1 : 0,
    created_at: now,
    updated_at: now
  });
  return sanitizeEditorRow(selectEditorById.get(Number(info.lastInsertRowid)));
};

const parseAuditDetails = (value) => parseJsonSafe(value, {});
const writeAuditLog = (req, action, target = '', details = {}) => {
  try {
    const auth =
      req && req.auth
        ? req.auth
        : req && typeof req.get === 'function'
        ? resolveRequestAuth(req)
        : buildGuestAuth();
    const now = nowIso();
    insertAuditLogStmt.run({
      actor_id:
        auth && auth.editorId !== undefined && auth.editorId !== null ? Number(auth.editorId) : null,
      actor_email: auth && auth.email ? String(auth.email) : '',
      actor_role: auth && auth.role ? String(auth.role) : '',
      action: String(action || ''),
      target: String(target || ''),
      details_json: JSON.stringify(details || {}),
      created_at: now
    });
  } catch (err) {
    console.warn('[content] audit log failed:', err.message);
  }
};

const getLockState = (lockKey = 'draft') => {
  const row = getDraftLockStmt.get(String(lockKey));
  if (!row) return null;
  const expiresAtEpoch = Math.floor(new Date(row.expires_at).getTime() / 1000);
  if (!Number.isFinite(expiresAtEpoch) || expiresAtEpoch <= nowEpochSec()) {
    deleteDraftLockStmt.run(String(lockKey));
    return null;
  }
  return {
    lock_key: String(row.lock_key),
    owner_id: row.owner_id === null || row.owner_id === undefined ? null : Number(row.owner_id),
    owner_email: String(row.owner_email || ''),
    lock_token: String(row.lock_token || ''),
    acquired_at: row.acquired_at || null,
    expires_at: row.expires_at || null,
    updated_at: row.updated_at || null
  };
};

const claimDraftLock = (auth, options = {}) => {
  if (!auth || !auth.authorized) throw new Error('unauthorized');
  const lockKey = String(options.lockKey || 'draft');
  const now = new Date();
  const ttlSec = Math.max(60, Number(options.ttl_seconds) || lockTtlSeconds);
  const expires = new Date(now.getTime() + ttlSec * 1000);
  const nowText = now.toISOString();
  const expiresText = expires.toISOString();
  const token = String(options.lock_token || crypto.randomBytes(16).toString('hex'));
  upsertDraftLockStmt.run({
    lock_key: lockKey,
    owner_id: auth.editorId === null || auth.editorId === undefined ? null : Number(auth.editorId),
    owner_email: String(auth.email || ''),
    lock_token: token,
    acquired_at: nowText,
    expires_at: expiresText,
    updated_at: nowText
  });
  return getLockState(lockKey);
};

const releaseDraftLock = (auth, options = {}) => {
  const lockKey = String(options.lockKey || 'draft');
  const current = getLockState(lockKey);
  if (!current) return { released: false, reason: 'not_found' };
  const isOwner =
    auth &&
    (auth.role === 'admin' ||
      (auth.editorId !== null &&
        auth.editorId !== undefined &&
        Number(current.owner_id) === Number(auth.editorId)));
  if (!isOwner) return { released: false, reason: 'not_owner', lock: current };
  deleteDraftLockStmt.run(lockKey);
  return { released: true };
};

const blockIfDraftLockedByOther = (req, res, next) => {
  const auth = req.auth || resolveRequestAuth(req);
  req.auth = auth;
  if (!auth || !auth.authorized) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }

  const lock = getLockState('draft');
  if (!lock) {
    next();
    return;
  }

  if (auth.role === 'admin') {
    next();
    return;
  }

  const isOwner =
    auth.editorId !== null &&
    auth.editorId !== undefined &&
    Number(lock.owner_id) === Number(auth.editorId);
  if (isOwner) {
    next();
    return;
  }

  res.status(409).json({
    ok: false,
    error: 'draft_locked_by_other',
    lock
  });
};

const seedEditorIfNeeded = () => {
  if (!editorAuthEnabled) return false;
  const count = Number(countEditorsStmt.get() || 0);
  if (count > 0) return false;
  if (!seedEditorEmail || !seedEditorPassword) return false;
  const editor = createEditorUser({
    email: seedEditorEmail,
    displayName: seedEditorName,
    password: seedEditorPassword,
    role: seedEditorRole,
    isActive: true
  });
  console.log(`[content] seeded editor user: ${editor.email} (${editor.role})`);
  return true;
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

seedEditorIfNeeded();

app.get('/content/health', (req, res) => {
  res.json({
    ok: true,
    service: 'speakapp-content-service',
    db_path: dbPath,
    admin_auth_enabled: Boolean(adminToken),
    read_auth_enabled: Boolean(readToken),
    editor_auth_enabled: editorAuthEnabled,
    jwt_ttl_seconds: jwtTtlSeconds,
    draft_lock_ttl_seconds: lockTtlSeconds,
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

app.post('/content/admin/login', (req, res) => {
  if (!editorAuthEnabled) {
    res.status(400).json({ ok: false, error: 'editor_auth_disabled' });
    return;
  }
  const email = String(req.body && req.body.email ? req.body.email : '')
    .trim()
    .toLowerCase();
  const password = String(req.body && req.body.password ? req.body.password : '');
  if (!email || !password) {
    res.status(400).json({ ok: false, error: 'email_password_required' });
    return;
  }
  const row = selectEditorByEmail.get(email);
  if (!row || !row.is_active) {
    res.status(401).json({ ok: false, error: 'invalid_credentials' });
    return;
  }
  const isValid = bcrypt.compareSync(password, String(row.password_hash || ''));
  if (!isValid) {
    res.status(401).json({ ok: false, error: 'invalid_credentials' });
    return;
  }
  const token = buildEditorJwt(row);
  const editor = sanitizeEditorRow(row);
  req.auth = {
    mode: 'editor-jwt',
    authorized: true,
    role: editor.role,
    editorId: editor.id,
    email: editor.email,
    displayName: editor.display_name || ''
  };
  writeAuditLog(req, 'editor.login', `editor:${editor.id}`, { role: editor.role });
  res.json({
    ok: true,
    token,
    token_type: 'Bearer',
    expires_in: jwtTtlSeconds,
    editor
  });
});

app.get('/content/admin/me', requireEditor, (req, res) => {
  if (req.auth && req.auth.mode === 'editor-jwt' && req.auth.editorId) {
    const row = selectEditorById.get(Number(req.auth.editorId));
    if (!row || !row.is_active) {
      res.status(401).json({ ok: false, error: 'unauthorized' });
      return;
    }
    res.json({ ok: true, auth: req.auth, editor: sanitizeEditorRow(row) });
    return;
  }
  res.json({ ok: true, auth: req.auth, editor: null });
});

app.get('/content/admin/editors', requireAdmin, (req, res) => {
  const editors = listEditorsStmt.all().map((row) => sanitizeEditorRow(row));
  res.json({ ok: true, editors });
});

app.post('/content/admin/editors', requireAdmin, (req, res, next) => {
  try {
    const email = String(req.body && req.body.email ? req.body.email : '');
    const password = String(req.body && req.body.password ? req.body.password : '');
    const displayName = String(req.body && req.body.display_name ? req.body.display_name : '');
    const role = String(req.body && req.body.role ? req.body.role : 'editor');
    const isActive = parseBoolean(req.body && req.body.is_active, true);
    const editor = createEditorUser({
      email,
      password,
      displayName,
      role,
      isActive
    });
    writeAuditLog(req, 'editor.create', `editor:${editor.id}`, {
      email: editor.email,
      role: editor.role
    });
    res.json({ ok: true, editor });
  } catch (err) {
    next(err);
  }
});

app.put('/content/admin/editors/:id', requireAdmin, (req, res, next) => {
  try {
    const editorId = Number(req.params.id);
    if (!Number.isFinite(editorId) || editorId <= 0) {
      res.status(400).json({ ok: false, error: 'invalid_editor_id' });
      return;
    }
    const row = selectEditorById.get(editorId);
    if (!row) {
      res.status(404).json({ ok: false, error: 'editor_not_found' });
      return;
    }

    const nextRole = normalizeRole(req.body && req.body.role ? req.body.role : row.role);
    const nextActive = parseBoolean(
      req.body && req.body.is_active !== undefined ? req.body.is_active : row.is_active,
      Boolean(row.is_active)
    );
    const nextName = String(
      req.body && req.body.display_name !== undefined ? req.body.display_name : row.display_name
    ).trim();
    const now = nowIso();

    updateEditorRoleStatusStmt.run({
      id: editorId,
      role: nextRole,
      is_active: nextActive ? 1 : 0,
      display_name: nextName,
      updated_at: now
    });

    const nextPassword = String(req.body && req.body.password ? req.body.password : '');
    if (nextPassword) {
      if (nextPassword.length < 8) {
        res.status(400).json({ ok: false, error: 'editor_password_too_short' });
        return;
      }
      const passwordHash = bcrypt.hashSync(nextPassword, 10);
      updateEditorPasswordStmt.run({
        id: editorId,
        password_hash: passwordHash,
        updated_at: nowIso()
      });
    }

    const updated = sanitizeEditorRow(selectEditorById.get(editorId));
    writeAuditLog(req, 'editor.update', `editor:${editorId}`, {
      role: updated.role,
      is_active: updated.is_active,
      password_changed: Boolean(nextPassword)
    });
    res.json({ ok: true, editor: updated });
  } catch (err) {
    next(err);
  }
});

app.get('/content/admin/audit', requireAdmin, (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const items = listAuditLogStmt.all(limit).map((row) => ({
    id: Number(row.id),
    actor_id: row.actor_id === null || row.actor_id === undefined ? null : Number(row.actor_id),
    actor_email: row.actor_email || '',
    actor_role: row.actor_role || '',
    action: row.action || '',
    target: row.target || '',
    details: parseAuditDetails(row.details_json),
    created_at: row.created_at || null
  }));
  res.json({ ok: true, items });
});

app.get('/content/admin/draft-lock', requireEditor, (req, res) => {
  const lock = getLockState('draft');
  const isOwner =
    lock &&
    req.auth &&
    req.auth.editorId !== null &&
    req.auth.editorId !== undefined &&
    Number(lock.owner_id) === Number(req.auth.editorId);
  res.json({ ok: true, lock, is_owner: Boolean(isOwner) });
});

app.post('/content/admin/draft-lock/claim', requireEditor, (req, res) => {
  const current = getLockState('draft');
  const ownedByOther =
    current &&
    req.auth &&
    req.auth.role !== 'admin' &&
    req.auth.editorId !== null &&
    req.auth.editorId !== undefined &&
    Number(current.owner_id) !== Number(req.auth.editorId);
  if (ownedByOther) {
    res.status(409).json({ ok: false, error: 'draft_locked_by_other', lock: current });
    return;
  }
  const lock = claimDraftLock(req.auth, {
    lockKey: 'draft',
    ttl_seconds: req.body && req.body.ttl_seconds ? Number(req.body.ttl_seconds) : undefined,
    lock_token: current && current.lock_token ? current.lock_token : undefined
  });
  writeAuditLog(req, 'draft_lock.claim', 'draft', { expires_at: lock ? lock.expires_at : null });
  res.json({ ok: true, lock });
});

app.post('/content/admin/draft-lock/release', requireEditor, (req, res) => {
  const result = releaseDraftLock(req.auth, { lockKey: 'draft' });
  if (!result.released) {
    if (result.reason === 'not_owner') {
      res.status(403).json({ ok: false, error: 'draft_lock_not_owner', lock: result.lock || null });
      return;
    }
    res.json({ ok: true, released: false });
    return;
  }
  writeAuditLog(req, 'draft_lock.release', 'draft', {});
  res.json({ ok: true, released: true });
});

app.get('/content/training-data', requireRead, (req, res) => {
  const preview = parseBoolean(req.query.preview, false);
  const auth = req.auth && req.auth.authorized ? req.auth : resolveRequestAuth(req);
  if (preview && !(auth && auth.authorized && hasRoleAtLeast(auth.role, 'editor'))) {
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

app.get('/content/admin/training-data', requireEditor, (req, res) => {
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

app.put('/content/admin/training-data', requireEditor, blockIfDraftLockedByOther, (req, res, next) => {
  try {
    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const normalized = normalizeTrainingPayload(payload);
    importTrainingNormalized(normalized, { replace: true });
    writeAuditLog(req, 'training.save_draft', 'draft', {
      routes: normalized.routes.length,
      modules: normalized.modules.length,
      sessions: normalized.sessions.length
    });
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

app.post(
  '/content/admin/import/training-json',
  requirePublisher,
  blockIfDraftLockedByOther,
  (req, res, next) => {
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
    writeAuditLog(req, 'training.import_json', 'draft', {
      replace,
      publish_now: publishNow,
      release_id: release ? release.id : null,
      routes: normalized.routes.length,
      modules: normalized.modules.length,
      sessions: normalized.sessions.length
    });

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
  }
);

app.post('/content/admin/publish', requirePublisher, blockIfDraftLockedByOther, (req, res, next) => {
  try {
    const name = String((req.body && req.body.name) || '').trim();
    const created = createReleaseFromLive(name || `publish-${nowIso()}`, true);
    writeAuditLog(req, 'training.publish', `release:${created.releaseId}`, {
      name: name || ''
    });
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

app.get('/content/admin/releases', requireEditor, (req, res) => {
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

app.post(
  '/content/admin/releases/:id/publish',
  requirePublisher,
  blockIfDraftLockedByOther,
  (req, res, next) => {
  try {
    const releaseId = Number(req.params.id);
    if (!Number.isFinite(releaseId) || releaseId <= 0) {
      res.status(400).json({ ok: false, error: 'invalid_release_id' });
      return;
    }
    const published = publishReleaseById(releaseId);
    writeAuditLog(req, 'training.publish_release', `release:${releaseId}`, {});
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
  }
);

app.post(
  '/content/admin/releases/:id/restore-draft',
  requirePublisher,
  blockIfDraftLockedByOther,
  (req, res, next) => {
  try {
    const releaseId = Number(req.params.id);
    if (!Number.isFinite(releaseId) || releaseId <= 0) {
      res.status(400).json({ ok: false, error: 'invalid_release_id' });
      return;
    }
    const result = restoreDraftFromRelease(releaseId);
    writeAuditLog(req, 'training.restore_draft', `release:${releaseId}`, {});
    res.json({ ok: true, result });
  } catch (err) {
    next(err);
  }
  }
);

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
  if (editorAuthEnabled) {
    console.log('[content] editor auth: enabled (JWT)');
  } else {
    console.log('[content] editor auth: disabled (set CONTENT_JWT_SECRET)');
  }
});
