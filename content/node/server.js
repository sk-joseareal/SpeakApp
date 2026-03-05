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
const ttsAlignedEndpoint = String(
  env('CONTENT_TTS_ALIGNED_ENDPOINT', 'https://realtime.curso-ingles.com/realtime/tts/aligned') || ''
).trim();
const ttsAlignedToken = String(env('CONTENT_TTS_ALIGNED_TOKEN', '') || '').trim();
const ttsAlignedTimeoutMs = Math.max(
  3000,
  Number(env('CONTENT_TTS_ALIGNED_TIMEOUT_MS', '20000')) || 20000
);
const ttsAlignedConcurrency = Math.min(
  8,
  Math.max(1, Number(env('CONTENT_TTS_ALIGNED_CONCURRENCY', '3')) || 3)
);
const ttsAlignedRetryMaxAttempts = Math.min(
  10,
  Math.max(1, Number(env('CONTENT_TTS_ALIGNED_RETRY_MAX_ATTEMPTS', '4')) || 4)
);
const ttsAlignedRetryBaseDelayMs = Math.max(
  100,
  Number(env('CONTENT_TTS_ALIGNED_RETRY_BASE_DELAY_MS', '350')) || 350
);
const ttsAlignedRetryMaxDelayMs = Math.max(
  ttsAlignedRetryBaseDelayMs,
  Number(env('CONTENT_TTS_ALIGNED_RETRY_MAX_DELAY_MS', '6000')) || 6000
);
const ttsAlignedPollyEngine = String(env('CONTENT_TTS_ALIGNED_POLLY_ENGINE', 'neural') || 'neural').trim() || 'neural';
const ttsAlignedVoiceEnUS = String(env('CONTENT_TTS_ALIGNED_VOICE_EN_US', 'Danielle') || 'Danielle').trim() || 'Danielle';
const ttsAlignedVoiceEnGB = String(env('CONTENT_TTS_ALIGNED_VOICE_EN_GB', 'Amy') || 'Amy').trim() || 'Amy';
const ttsAlignedVoiceEsES = String(env('CONTENT_TTS_ALIGNED_VOICE_ES_ES', 'Lucia') || 'Lucia').trim() || 'Lucia';
const ttsVerifyHeadTimeoutMs = Math.max(
  1000,
  Number(env('CONTENT_TTS_VERIFY_HEAD_TIMEOUT_MS', '4000')) || 4000
);

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

const hasTableColumn = (tableName, columnName) => {
  const rows = db.prepare(`PRAGMA table_info('${String(tableName)}')`).all();
  const names = new Set(rows.map((row) => String(row.name || '').trim()));
  return names.has(String(columnName || '').trim());
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

const ensureI18nColumns = () => {
  const mutations = [];
  if (!hasTableColumn('routes', 'title_i18n_json')) {
    mutations.push("ALTER TABLE routes ADD COLUMN title_i18n_json TEXT NOT NULL DEFAULT '{}'");
  }
  if (!hasTableColumn('routes', 'note_i18n_json')) {
    mutations.push("ALTER TABLE routes ADD COLUMN note_i18n_json TEXT NOT NULL DEFAULT '{}'");
  }
  if (!hasTableColumn('modules', 'title_i18n_json')) {
    mutations.push("ALTER TABLE modules ADD COLUMN title_i18n_json TEXT NOT NULL DEFAULT '{}'");
  }
  if (!hasTableColumn('modules', 'subtitle_i18n_json')) {
    mutations.push("ALTER TABLE modules ADD COLUMN subtitle_i18n_json TEXT NOT NULL DEFAULT '{}'");
  }
  if (!hasTableColumn('sessions', 'title_i18n_json')) {
    mutations.push("ALTER TABLE sessions ADD COLUMN title_i18n_json TEXT NOT NULL DEFAULT '{}'");
  }
  if (!mutations.length) return false;
  mutations.forEach((sql) => db.exec(sql));
  return true;
};

const migratedI18nColumns = ensureI18nColumns();
if (migratedI18nColumns) {
  console.log('[content] migrated tables: added i18n json columns');
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

const isPlainObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

const hasOwnKeys = (value) => isPlainObject(value) && Object.keys(value).length > 0;

const normalizeHintLocale = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (normalized === 'en' || normalized === 'en-us' || normalized === 'en_us') return 'en';
  if (normalized === 'es' || normalized === 'es-es' || normalized === 'es_es') return 'es';
  return '';
};

const normalizeAlignedLocale = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (normalized === 'es' || normalized === 'es-es' || normalized === 'es_es') return 'es-ES';
  if (normalized === 'en-gb' || normalized === 'en_gb') return 'en-GB';
  return 'en-US';
};

const selectDefaultTtsVoice = (alignedLocale) => {
  if (alignedLocale === 'es-ES') return ttsAlignedVoiceEsES;
  if (alignedLocale === 'en-GB') return ttsAlignedVoiceEnGB;
  return ttsAlignedVoiceEnUS;
};

const stripSpeechMarkup = (value) =>
  String(value || '')
    .replace(/<\s*br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildTtsCacheHash = ({ text, locale, voice, engine }) =>
  crypto
    .createHash('sha1')
    .update([String(text || ''), String(locale || ''), String(voice || ''), String(engine || ''), 'v1'].join('|'))
    .digest('hex');

const withTimeout = async (task, timeoutMs) => {
  const timeout = Math.max(1000, Number(timeoutMs) || 0);
  if (typeof AbortController !== 'function') {
    return task({});
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await task({ signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const mapWithConcurrency = async (items, limit, worker) => {
  const list = Array.isArray(items) ? items : [];
  const max = Math.max(1, Number(limit) || 1);
  const out = new Array(list.length);
  let cursor = 0;
  const run = async () => {
    while (cursor < list.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await worker(list[index], index);
    }
  };
  const runners = [];
  for (let i = 0; i < Math.min(max, list.length || 1); i += 1) {
    runners.push(run());
  }
  await Promise.all(runners);
  return out;
};

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, Number(ms) || 0));
  });

const isRetriableTtsError = (error) => {
  const message = String(error && error.message ? error.message : '')
    .trim()
    .toLowerCase();
  const status = Number(error && error.httpStatus);
  if (status === 429 || status === 408 || status === 425 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  if (status >= 500 && status < 600) return true;
  if (!message) return false;
  return (
    message.includes('rate exceeded') ||
    message.includes('too many requests') ||
    message.includes('throttl') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('socket hang up') ||
    message.includes('econnreset') ||
    message.includes('http_429') ||
    message.includes('http_502') ||
    message.includes('http_503') ||
    message.includes('http_504')
  );
};

const computeRetryDelayMs = (attempt) => {
  const safeAttempt = Math.max(1, Number(attempt) || 1);
  const exp = Math.min(safeAttempt - 1, 8);
  const raw = Math.min(ttsAlignedRetryMaxDelayMs, ttsAlignedRetryBaseDelayMs * 2 ** exp);
  const jitter = 0.8 + Math.random() * 0.4;
  return Math.round(raw * jitter);
};

const readHintLine = (source, locale, lineNumber) => {
  if (!isPlainObject(source)) return '';
  const safeLocale = normalizeHintLocale(locale) || 'en';
  const line = Number(lineNumber) === 2 ? '2' : '1';
  return firstHintText(
    source[`hint_${safeLocale}_line${line}`],
    source[`hint_${safeLocale}_${line}`],
    source[`hint_${safeLocale}_line_${line}`],
    source[`hint_${safeLocale}_linea_${line}`]
  );
};

const normalizeTtsLineEntry = (value) => {
  if (!isPlainObject(value)) return null;
  const text = String(value.text || '').trim();
  const hash = String(value.hash || '').trim();
  const audioUrl = String(value.audio_url || value.audioUrl || '').trim();
  const wordsUrl = String(value.words_url || value.wordsUrl || '').trim();
  const voice = String(value.voice || '').trim();
  const engine = String(value.engine || '').trim();
  const provider = String(value.provider || '').trim();
  const generatedAt = String(value.generated_at || value.generatedAt || '').trim();
  const durationRaw = Number(value.duration_ms !== undefined ? value.duration_ms : value.durationMs);
  const durationMs = Number.isFinite(durationRaw) && durationRaw > 0 ? Math.round(durationRaw) : 0;
  if (!audioUrl) return null;
  return {
    text,
    hash,
    audio_url: audioUrl,
    words_url: wordsUrl,
    voice,
    engine,
    provider,
    duration_ms: durationMs,
    generated_at: generatedAt
  };
};

const normalizeStepTtsMap = (value) => {
  if (!isPlainObject(value)) return {};
  const out = {};
  const rawByLocale = {};
  Object.keys(value).forEach((key) => {
    const locale = normalizeHintLocale(key);
    if (!locale) return;
    rawByLocale[locale] = value[key];
  });

  ['en', 'es'].forEach((locale) => {
    const localeNode = isPlainObject(rawByLocale[locale]) ? rawByLocale[locale] : null;
    if (!localeNode) return;
    const line1 = normalizeTtsLineEntry(localeNode.line1 || localeNode['1']);
    const line2 = normalizeTtsLineEntry(localeNode.line2 || localeNode['2']);
    if (!line1 && !line2) return;
    out[locale] = {};
    if (line1) out[locale].line1 = line1;
    if (line2) out[locale].line2 = line2;
  });

  return out;
};

const getBearerToken = (req) => {
  const auth = req.get('authorization');
  if (!auth) return '';
  const m = String(auth).match(/^Bearer\s+(.+)$/i);
  return m ? String(m[1]).trim() : '';
};

const getReadRequestToken = (req) => {
  const byHeader = req.get('x-content-read-token');
  if (byHeader) return String(byHeader).trim();
  const rtHeader = req.get('x-rt-token');
  if (rtHeader) return String(rtHeader).trim();
  return getBearerToken(req);
};

const getEditorJwtCandidate = (req) => {
  const bearer = getBearerToken(req);
  if (bearer) return bearer;
  const byHeader = req.get('x-content-jwt');
  if (byHeader) return String(byHeader).trim();
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

const resolveRequestAuth = (req) => {
  if (!editorAuthEnabled) {
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
const deleteEditorByIdStmt = db.prepare('DELETE FROM editor_users WHERE id = ?');
const countActiveAdminsStmt = db.prepare(
  "SELECT COUNT(*) AS n FROM editor_users WHERE role = 'admin' AND is_active = 1"
).pluck();

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
  INSERT INTO routes(id, title, title_i18n_json, note, note_i18n_json, sort_order, is_active, updated_at)
  VALUES (@id, @title, @title_i18n_json, @note, @note_i18n_json, @sort_order, @is_active, @updated_at)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    title_i18n_json = excluded.title_i18n_json,
    note = excluded.note,
    note_i18n_json = excluded.note_i18n_json,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    updated_at = excluded.updated_at
`);

const upsertModule = db.prepare(`
  INSERT INTO modules(id, title, title_i18n_json, subtitle, subtitle_i18n_json, sort_order, is_active, updated_at)
  VALUES (@id, @title, @title_i18n_json, @subtitle, @subtitle_i18n_json, @sort_order, @is_active, @updated_at)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    title_i18n_json = excluded.title_i18n_json,
    subtitle = excluded.subtitle,
    subtitle_i18n_json = excluded.subtitle_i18n_json,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    updated_at = excluded.updated_at
`);

const upsertSession = db.prepare(`
  INSERT INTO sessions(
    id,
    title,
    title_i18n_json,
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
    @title_i18n_json,
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
    title_i18n_json = excluded.title_i18n_json,
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

const splitHintLines = (value) =>
  String(value || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .split(/\r?\n+/)
    .map((line) => String(line || '').trim())
    .filter(Boolean)
    .slice(0, 2);

const firstHintText = (...values) => {
  for (const value of values) {
    const normalized = String(value === undefined || value === null ? '' : value).trim();
    if (normalized) return normalized;
  }
  return '';
};

const normalizeHintI18n = (rawStep) => {
  const step = rawStep && typeof rawStep === 'object' ? rawStep : {};
  const legacyLines = splitHintLines(step.hint);

  let hintEnLine1 = firstHintText(
    step.hint_en_line1,
    step.hint_en_1,
    step.hint_en_line_1,
    step.hint_en_linea_1
  );
  let hintEnLine2 = firstHintText(
    step.hint_en_line2,
    step.hint_en_2,
    step.hint_en_line_2,
    step.hint_en_linea_2
  );
  let hintEsLine1 = firstHintText(
    step.hint_es_line1,
    step.hint_es_1,
    step.hint_es_line_1,
    step.hint_es_linea_1
  );
  let hintEsLine2 = firstHintText(
    step.hint_es_line2,
    step.hint_es_2,
    step.hint_es_line_2,
    step.hint_es_linea_2
  );

  const hasExplicitHints = Boolean(hintEnLine1 || hintEnLine2 || hintEsLine1 || hintEsLine2);
  if (!hasExplicitHints && legacyLines.length) {
    hintEnLine1 = legacyLines[0] || '';
    hintEnLine2 = legacyLines[1] || '';
    hintEsLine1 = legacyLines[0] || '';
    hintEsLine2 = legacyLines[1] || '';
  }

  if ((!hintEnLine1 && !hintEnLine2) && (hintEsLine1 || hintEsLine2)) {
    hintEnLine1 = hintEsLine1;
    hintEnLine2 = hintEsLine2;
  }
  if ((!hintEsLine1 && !hintEsLine2) && (hintEnLine1 || hintEnLine2)) {
    hintEsLine1 = hintEnLine1;
    hintEsLine2 = hintEnLine2;
  }

  return {
    hint_en_line1: hintEnLine1,
    hint_en_line2: hintEnLine2,
    hint_es_line1: hintEsLine1,
    hint_es_line2: hintEsLine2
  };
};

const normalizeTextI18n = (input, fallbackValue = '') => {
  const source = isPlainObject(input) ? input : {};
  const fallback = String(fallbackValue || '').trim();
  let en = firstHintText(source.en, source['en-US'], source.en_us);
  let es = firstHintText(source.es, source['es-ES'], source.es_es);
  if (!en && fallback) en = fallback;
  if (!es && fallback) es = fallback;
  if (!en && es) en = es;
  if (!es && en) es = en;
  return { en, es };
};

const extractTextI18n = (rawEntity, fieldName, fallbackValue = '') => {
  const entity = rawEntity && typeof rawEntity === 'object' ? rawEntity : {};
  const source = {
    en: entity[`${fieldName}_en`],
    es: entity[`${fieldName}_es`]
  };
  return normalizeTextI18n(source, fallbackValue);
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
    const titleI18n = extractTextI18n(route, 'title');
    const title = String(titleI18n.en || titleI18n.es || '').trim();
    if (!title) throw new Error(`route ${id} is missing title`);
    const noteI18n = extractTextI18n(route, 'note');
    const note = String(noteI18n.en || noteI18n.es || '').trim();
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
      title_i18n: titleI18n,
      note,
      note_i18n: noteI18n,
      sortOrder: idx,
      moduleIds
    };
  });

  const modules = modulesIn.map((module, idx) => {
    const id = String(module.id).trim();
    const titleI18n = extractTextI18n(module, 'title');
    const title = String(titleI18n.en || titleI18n.es || '').trim();
    if (!title) throw new Error(`module ${id} is missing title`);
    const subtitleI18n = extractTextI18n(module, 'subtitle');
    const subtitle = String(subtitleI18n.en || subtitleI18n.es || '').trim();
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
      title_i18n: titleI18n,
      subtitle,
      subtitle_i18n: subtitleI18n,
      sortOrder: idx,
      sessionIds
    };
  });

  const sessions = sessionsIn.map((session, idx) => {
    const id = String(session.id).trim();
    const titleI18n = extractTextI18n(session, 'title');
    const title = String(titleI18n.en || titleI18n.es || '').trim();
    if (!title) throw new Error(`session ${id} is missing title`);

    const speak = session.speak && typeof session.speak === 'object' ? session.speak : {};

    const soundRaw = speak.sound && typeof speak.sound === 'object' ? speak.sound : {};
    const spellingRaw = speak.spelling && typeof speak.spelling === 'object' ? speak.spelling : {};
    const sentenceRaw = speak.sentence && typeof speak.sentence === 'object' ? speak.sentence : {};
    const soundHints = normalizeHintI18n(soundRaw);
    const spellingHints = normalizeHintI18n(spellingRaw);
    const sentenceHints = normalizeHintI18n(sentenceRaw);
    const soundTts = normalizeStepTtsMap(soundRaw.tts || soundRaw.audio || {});
    const spellingTts = normalizeStepTtsMap(spellingRaw.tts || spellingRaw.audio || {});
    const sentenceTts = normalizeStepTtsMap(sentenceRaw.tts || sentenceRaw.audio || {});
    const soundTitleI18n = extractTextI18n(soundRaw, 'title');
    const spellingTitleI18n = extractTextI18n(spellingRaw, 'title');
    const sentenceTitleI18n = extractTextI18n(sentenceRaw, 'title');
    const sound = {
      title: String(soundTitleI18n.en || soundTitleI18n.es || '').trim(),
      title_i18n: soundTitleI18n,
      ...soundHints,
      phonetic: String(soundRaw.phonetic || ''),
      expected: String(soundRaw.expected || '')
    };
    const spelling = {
      title: String(spellingTitleI18n.en || spellingTitleI18n.es || '').trim(),
      title_i18n: spellingTitleI18n,
      ...spellingHints,
      words: normalizeStringArray(spellingRaw.words)
    };
    const sentence = {
      title: String(sentenceTitleI18n.en || sentenceTitleI18n.es || '').trim(),
      title_i18n: sentenceTitleI18n,
      ...sentenceHints,
      sentence: String(sentenceRaw.sentence || ''),
      expected: String(sentenceRaw.expected || '')
    };
    if (hasOwnKeys(soundTts)) sound.tts = soundTts;
    if (hasOwnKeys(spellingTts)) spelling.tts = spellingTts;
    if (hasOwnKeys(sentenceTts)) sentence.tts = sentenceTts;

    return {
      id,
      title,
      title_i18n: titleI18n,
      speakFocus: String(speak.focus || ''),
      sound,
      spelling,
      sentence,
      sortOrder: idx
    };
  });

  return { routes, modules, sessions };
};

const withFlatTextFields = (fieldName, i18n, fallbackValue = '') => {
  const normalized = normalizeTextI18n(i18n, fallbackValue);
  return {
    [`${fieldName}_en`]: normalized.en || '',
    [`${fieldName}_es`]: normalized.es || ''
  };
};

const serializeSpeakStepPayload = (step) => {
  const source = step && typeof step === 'object' ? { ...step } : {};
  const titleI18n = normalizeTextI18n(
    {
      en: source.title_en,
      es: source.title_es
    },
    source.title
  );
  const title = String(titleI18n.en || titleI18n.es || '').trim();
  delete source.title;
  delete source.title_i18n;
  delete source.title_en;
  delete source.title_es;
  return {
    ...source,
    ...withFlatTextFields('title', titleI18n, title)
  };
};

const toTrainingPayload = (normalized) => ({
  routes: normalized.routes.map((route) => {
    const titleI18n =
      route.title_i18n && typeof route.title_i18n === 'object'
        ? { ...route.title_i18n }
        : {};
    const noteI18n =
      route.note_i18n && typeof route.note_i18n === 'object'
        ? { ...route.note_i18n }
        : {};
    return {
      id: route.id,
      ...withFlatTextFields('title', titleI18n, route.title),
      ...withFlatTextFields('note', noteI18n, route.note || ''),
      moduleIds: Array.isArray(route.moduleIds) ? route.moduleIds.slice() : []
    };
  }),
  modules: normalized.modules.map((module) => {
    const titleI18n =
      module.title_i18n && typeof module.title_i18n === 'object'
        ? { ...module.title_i18n }
        : {};
    const subtitleI18n =
      module.subtitle_i18n && typeof module.subtitle_i18n === 'object'
        ? { ...module.subtitle_i18n }
        : {};
    return {
      id: module.id,
      ...withFlatTextFields('title', titleI18n, module.title),
      ...withFlatTextFields('subtitle', subtitleI18n, module.subtitle || ''),
      sessionIds: Array.isArray(module.sessionIds) ? module.sessionIds.slice() : []
    };
  }),
  sessions: normalized.sessions.map((session) => {
    const titleI18n =
      session.title_i18n && typeof session.title_i18n === 'object'
        ? { ...session.title_i18n }
        : {};
    return {
      id: session.id,
      ...withFlatTextFields('title', titleI18n, session.title),
      speak: {
        focus: session.speakFocus || '',
        sound: serializeSpeakStepPayload(session.sound),
        spelling: serializeSpeakStepPayload(session.spelling),
        sentence: serializeSpeakStepPayload(session.sentence)
      }
    };
  })
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
        title_i18n_json: JSON.stringify(route.title_i18n || {}),
        note: route.note,
        note_i18n_json: JSON.stringify(route.note_i18n || {}),
        sort_order: route.sortOrder,
        is_active: 1,
        updated_at: runAt
      });
    });

    normalized.modules.forEach((module) => {
      upsertModule.run({
        id: module.id,
        title: module.title,
        title_i18n_json: JSON.stringify(module.title_i18n || {}),
        subtitle: module.subtitle,
        subtitle_i18n_json: JSON.stringify(module.subtitle_i18n || {}),
        sort_order: module.sortOrder,
        is_active: 1,
        updated_at: runAt
      });
    });

    normalized.sessions.forEach((session) => {
      upsertSession.run({
        id: session.id,
        title: session.title,
        title_i18n_json: JSON.stringify(session.title_i18n || {}),
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
  'SELECT id, title, title_i18n_json, note, note_i18n_json, sort_order FROM routes WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
);
const selectModules = db.prepare(
  'SELECT id, title, title_i18n_json, subtitle, subtitle_i18n_json, sort_order FROM modules WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
);
const selectSessions = db.prepare(
  `SELECT
    id,
    title,
    title_i18n_json,
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

  const routes = routesRows.map((row) => {
    const titleI18n = normalizeTextI18n(parseJsonSafe(row.title_i18n_json, {}), row.title || '');
    const noteI18n = normalizeTextI18n(parseJsonSafe(row.note_i18n_json, {}), row.note || '');
    return {
      id: row.id,
      title_en: titleI18n.en || '',
      title_es: titleI18n.es || '',
      note_en: noteI18n.en || '',
      note_es: noteI18n.es || '',
      moduleIds: moduleIdsByRoute.get(row.id) || []
    };
  });

  const modules = modulesRows.map((row) => {
    const titleI18n = normalizeTextI18n(parseJsonSafe(row.title_i18n_json, {}), row.title || '');
    const subtitleI18n = normalizeTextI18n(parseJsonSafe(row.subtitle_i18n_json, {}), row.subtitle || '');
    return {
      id: row.id,
      title_en: titleI18n.en || '',
      title_es: titleI18n.es || '',
      subtitle_en: subtitleI18n.en || '',
      subtitle_es: subtitleI18n.es || '',
      sessionIds: sessionIdsByModule.get(row.id) || []
    };
  });

  const normalizeStepForPayload = (rawStep) => {
    const step = isPlainObject(rawStep) ? { ...rawStep } : {};
    const titleI18n = normalizeTextI18n(
      {
        en: step.title_en,
        es: step.title_es
      },
      step.title || ''
    );
    delete step.title;
    delete step.title_i18n;
    return {
      ...step,
      title_en: titleI18n.en || '',
      title_es: titleI18n.es || ''
    };
  };

  const sessions = sessionsRows.map((row) => {
    const titleI18n = normalizeTextI18n(parseJsonSafe(row.title_i18n_json, {}), row.title || '');
    return {
      id: row.id,
      title_en: titleI18n.en || '',
      title_es: titleI18n.es || '',
      speak: {
        focus: row.speak_focus || '',
        sound: normalizeStepForPayload(parseJsonSafe(row.speak_sound_json, {})),
        spelling: normalizeStepForPayload(parseJsonSafe(row.speak_spelling_json, {})),
        sentence: normalizeStepForPayload(parseJsonSafe(row.speak_sentence_json, {}))
      }
    };
  });

  return sanitizeTrainingPayload({ routes, modules, sessions });
};

const getPublishedReleaseRow = db.prepare(
  'SELECT id, name, snapshot_json, created_at, published_at FROM releases WHERE published = 1 ORDER BY published_at DESC, id DESC LIMIT 1'
);
const listReleasesStmt = db.prepare(
  'SELECT id, name, published, created_at, published_at FROM releases ORDER BY id DESC LIMIT ?'
);
const listReleasesWithSnapshotStmt = db.prepare(
  'SELECT id, name, published, created_at, published_at, snapshot_json FROM releases ORDER BY id DESC LIMIT ?'
);
const getReleaseByIdStmt = db.prepare(
  'SELECT id, name, snapshot_json, created_at, published, published_at FROM releases WHERE id = ?'
);
const unpublishAllStmt = db.prepare('UPDATE releases SET published = 0 WHERE published = 1');
const publishByIdStmt = db.prepare('UPDATE releases SET published = 1, published_at = ? WHERE id = ?');
const deleteReleaseByIdStmt = db.prepare('DELETE FROM releases WHERE id = ?');
const updateReleaseSnapshotByIdStmt = db.prepare('UPDATE releases SET snapshot_json = ? WHERE id = ?');
const createReleaseStmt = db.prepare(
  'INSERT INTO releases(name, snapshot_json, published, created_at, published_at) VALUES (?, ?, ?, ?, ?)'
);
const listAllReleaseSnapshotsStmt = db.prepare('SELECT id, snapshot_json FROM releases ORDER BY id ASC');

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

const regularizeStoredReleaseSnapshots = () => {
  const rows = listAllReleaseSnapshotsStmt.all();
  if (!Array.isArray(rows) || !rows.length) return { scanned: 0, updated: 0, skipped: 0 };

  let updated = 0;
  let skipped = 0;
  const tx = db.transaction(() => {
    rows.forEach((row) => {
      const parsed = parseJsonSafe(row.snapshot_json, null);
      if (!parsed || typeof parsed !== 'object') {
        skipped += 1;
        return;
      }
      let sanitized = null;
      try {
        sanitized = sanitizeTrainingPayload(parsed);
      } catch (_err) {
        skipped += 1;
        return;
      }
      const nextJson = JSON.stringify(sanitized);
      if (nextJson === row.snapshot_json) return;
      updateReleaseSnapshotByIdStmt.run(nextJson, Number(row.id));
      updated += 1;
    });
  });
  tx();
  return { scanned: rows.length, updated, skipped };
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

const parseReleaseSnapshotPayload = (releaseRow) => {
  if (!releaseRow || !releaseRow.snapshot_json) {
    const err = new Error('release_snapshot_invalid');
    err.code = 'release_snapshot_invalid';
    throw err;
  }
  const parsed = parseJsonSafe(releaseRow.snapshot_json, null);
  if (!parsed || typeof parsed !== 'object') {
    const err = new Error('release_snapshot_invalid');
    err.code = 'release_snapshot_invalid';
    throw err;
  }
  return sanitizeTrainingPayload(parsed);
};

const persistReleaseSnapshotPayload = (releaseId, payload) => {
  const safeId = Number(releaseId);
  if (!Number.isFinite(safeId) || safeId <= 0) {
    throw new Error('invalid_release_id');
  }
  const normalized = sanitizeTrainingPayload(payload);
  const now = nowIso();
  const tx = db.transaction(() => {
    updateReleaseSnapshotByIdStmt.run(JSON.stringify(normalized), safeId);
    const row = getReleaseByIdStmt.get(safeId);
    if (row && Boolean(row.published)) {
      setSetting.run({ key: 'published_release_id', value: String(safeId), updated_at: now });
      setSetting.run({ key: 'published_updated_at', value: now, updated_at: now });
    }
  });
  tx();
  return normalized;
};

const parseRequestedHintLocales = (value) => {
  const list = Array.isArray(value)
    ? value
    : typeof value === 'string'
    ? value.split(',')
    : [];
  const out = [];
  const seen = new Set();
  list.forEach((item) => {
    const locale = normalizeHintLocale(item);
    if (!locale || seen.has(locale)) return;
    seen.add(locale);
    out.push(locale);
  });
  if (!out.length) return ['en', 'es'];
  return out;
};

const getStepByKey = (session, stepKey) => {
  if (!isPlainObject(session) || !isPlainObject(session.speak)) return null;
  const step = session.speak[stepKey];
  return isPlainObject(step) ? step : null;
};

const getStepTtsEntry = (step, locale, lineNumber) => {
  if (!isPlainObject(step)) return null;
  const safeLocale = normalizeHintLocale(locale) || 'en';
  const lineKey = Number(lineNumber) === 2 ? 'line2' : 'line1';
  const tts = normalizeStepTtsMap(step.tts || step.audio || {});
  const localeNode = tts[safeLocale];
  if (!isPlainObject(localeNode)) return null;
  return normalizeTtsLineEntry(localeNode[lineKey]);
};

const setStepTtsEntry = (step, locale, lineNumber, value) => {
  if (!isPlainObject(step)) return;
  const safeLocale = normalizeHintLocale(locale) || 'en';
  const lineKey = Number(lineNumber) === 2 ? 'line2' : 'line1';
  const normalized = normalizeTtsLineEntry(value);
  if (!normalized) return;
  if (!isPlainObject(step.tts)) {
    step.tts = {};
  }
  if (!isPlainObject(step.tts[safeLocale])) {
    step.tts[safeLocale] = {};
  }
  step.tts[safeLocale][lineKey] = normalized;
};

const collectReleaseTtsTargets = (payload, options = {}) => {
  const safePayload = payload && typeof payload === 'object' ? payload : { sessions: [] };
  const sessions = Array.isArray(safePayload.sessions) ? safePayload.sessions : [];
  const locales = parseRequestedHintLocales(options.locales);
  const engine = String(options.engine || ttsAlignedPollyEngine || 'neural').trim() || 'neural';
  const targets = [];
  const stepKeys = ['sound', 'spelling', 'sentence'];

  sessions.forEach((session) => {
    const sessionId = String(session && session.id ? session.id : '').trim();
    const sessionTitle = String(
      firstHintText(session && session.title_en, session && session.title_es, session && session.id)
    ).trim();
    stepKeys.forEach((stepKey) => {
      const step = getStepByKey(session, stepKey);
      if (!step) return;
      locales.forEach((locale) => {
        [1, 2].forEach((lineNumber) => {
          const rawText = readHintLine(step, locale, lineNumber);
          const text = stripSpeechMarkup(rawText);
          if (!text) return;
          const alignedLocale = normalizeAlignedLocale(locale);
          const voice = selectDefaultTtsVoice(alignedLocale);
          const hash = buildTtsCacheHash({
            text,
            locale: alignedLocale,
            voice,
            engine
          });
          const existing = getStepTtsEntry(step, locale, lineNumber);
          let status = 'missing';
          if (existing && existing.audio_url && existing.hash) {
            status = existing.hash === hash ? 'ready' : 'outdated';
          }
          targets.push({
            session_id: sessionId,
            session_title: sessionTitle,
            step: stepKey,
            locale,
            aligned_locale: alignedLocale,
            line: lineNumber,
            line_key: lineNumber === 2 ? 'line2' : 'line1',
            text,
            voice,
            engine,
            hash,
            existing,
            status,
            _stepRef: step
          });
        });
      });
    });
  });

  return targets;
};

const checkRemoteAudioUrl = async (url) => {
  const target = String(url || '').trim();
  if (!target) return false;
  if (typeof fetch !== 'function') return false;
  const tryRequest = async (method, extraHeaders = {}) =>
    withTimeout(
      ({ signal }) =>
        fetch(target, {
          method,
          headers: { ...extraHeaders },
          signal
        }),
      ttsVerifyHeadTimeoutMs
    );
  try {
    const head = await tryRequest('HEAD');
    if (head && head.ok) return true;
    if (head && (head.status === 403 || head.status === 405 || head.status === 501)) {
      const probe = await tryRequest('GET', { Range: 'bytes=0-0' });
      return Boolean(probe && (probe.ok || probe.status === 206));
    }
    return false;
  } catch (_err) {
    return false;
  }
};

const requestAlignedTts = async ({ text, locale, voice, engine, force = false }) => {
  if (!ttsAlignedEndpoint) {
    throw new Error('tts_aligned_endpoint_not_configured');
  }
  if (typeof fetch !== 'function') {
    throw new Error('fetch_not_available');
  }
  const body = {
    text: String(text || ''),
    locale: normalizeAlignedLocale(locale),
    voice: String(voice || '').trim() || selectDefaultTtsVoice(normalizeAlignedLocale(locale)),
    engine: String(engine || ttsAlignedPollyEngine || 'neural').trim() || 'neural'
  };
  if (parseBoolean(force, false)) {
    body.force = true;
  }
  const headers = { 'Content-Type': 'application/json' };
  if (ttsAlignedToken) {
    headers['x-rt-token'] = ttsAlignedToken;
  }
  const attempts = ttsAlignedRetryMaxAttempts;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await withTimeout(
        ({ signal }) =>
          fetch(ttsAlignedEndpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal
          }),
        ttsAlignedTimeoutMs
      );
      const raw = await response.text();
      let payload = null;
      try {
        payload = raw ? JSON.parse(raw) : null;
      } catch (_err) {
        payload = { ok: false, error: 'invalid_json_response', raw };
      }
      if (!response.ok || !payload || payload.ok === false) {
        const message =
          payload && (payload.message || payload.error)
            ? String(payload.message || payload.error)
            : `http_${response.status}`;
        const err = new Error(message);
        err.httpStatus = Number(response.status) || 0;
        err.code = payload && payload.error ? String(payload.error) : '';
        throw err;
      }
      return payload;
    } catch (err) {
      const retryable = isRetriableTtsError(err);
      if (!retryable || attempt >= attempts) {
        throw err;
      }
      const waitMs = computeRetryDelayMs(attempt);
      await sleep(waitMs);
    }
  }
  throw new Error('tts_aligned_retry_exhausted');
};

const summarizeTargetStatuses = (targets) => {
  const list = Array.isArray(targets) ? targets : [];
  const summary = {
    total: list.length,
    ready: 0,
    missing: 0,
    outdated: 0,
    remote_missing: 0,
    errors: 0
  };
  list.forEach((item) => {
    const status = String(item && item.status ? item.status : 'missing');
    if (status === 'ready') summary.ready += 1;
    else if (status === 'outdated') summary.outdated += 1;
    else if (status === 'remote_missing') summary.remote_missing += 1;
    else if (status === 'error') summary.errors += 1;
    else summary.missing += 1;
  });
  summary.pending = summary.total - summary.ready;
  return summary;
};

const serializeTtsTarget = (target) => ({
  session_id: target.session_id || '',
  session_title: target.session_title || '',
  step: target.step || '',
  locale: target.locale || '',
  aligned_locale: target.aligned_locale || '',
  line: target.line || 1,
  line_key: target.line_key || 'line1',
  text: target.text || '',
  voice: target.voice || '',
  engine: target.engine || '',
  expected_hash: target.hash || '',
  status: target.status || 'missing',
  current_hash: target.existing && target.existing.hash ? target.existing.hash : '',
  audio_url: target.existing && target.existing.audio_url ? target.existing.audio_url : '',
  words_url: target.existing && target.existing.words_url ? target.existing.words_url : ''
});

const buildReleaseTtsSummary = (releaseRow) => {
  try {
    const payload = parseReleaseSnapshotPayload(releaseRow);
    const targets = collectReleaseTtsTargets(payload, {
      locales: ['en', 'es'],
      engine: ttsAlignedPollyEngine
    });
    const summary = summarizeTargetStatuses(targets);
    const coveragePercent = summary.total > 0 ? Math.round((summary.ready / summary.total) * 100) : 100;
    return {
      ...summary,
      coverage_percent: coveragePercent
    };
  } catch (err) {
    return {
      total: 0,
      ready: 0,
      missing: 0,
      outdated: 0,
      remote_missing: 0,
      errors: 0,
      pending: 0,
      coverage_percent: 0,
      invalid_snapshot: true
    };
  }
};

const verifyReleaseTtsAssets = async (releaseRow, options = {}) => {
  const payload = parseReleaseSnapshotPayload(releaseRow);
  const checkRemote = parseBoolean(options.checkRemote, false);
  const targets = collectReleaseTtsTargets(payload, options);

  if (checkRemote) {
    const readyTargets = targets.filter((target) => target.status === 'ready' && target.existing && target.existing.audio_url);
    await mapWithConcurrency(readyTargets, Math.min(ttsAlignedConcurrency, 4), async (target) => {
      const exists = await checkRemoteAudioUrl(target.existing.audio_url);
      if (!exists) {
        target.status = 'remote_missing';
      }
    });
  }

  return {
    payload,
    targets,
    summary: summarizeTargetStatuses(targets)
  };
};

const generateReleaseTtsAssets = async (releaseRow, options = {}) => {
  const force = parseBoolean(options.force, false);
  const maxItemsRaw = Number(options.maxItems);
  const maxItems = Number.isFinite(maxItemsRaw) && maxItemsRaw > 0 ? Math.min(Math.round(maxItemsRaw), 5000) : 0;

  const verified = await verifyReleaseTtsAssets(releaseRow, {
    locales: options.locales,
    engine: options.engine,
    checkRemote: options.checkRemote
  });

  let candidates = verified.targets.filter((item) => force || item.status !== 'ready');
  if (maxItems > 0) {
    candidates = candidates.slice(0, maxItems);
  }

  const failures = [];
  const groupedCandidates = new Map();
  candidates.forEach((target) => {
    const key =
      String(target && target.hash ? target.hash : '').trim() ||
      buildTtsCacheHash({
        text: target.text,
        locale: target.aligned_locale,
        voice: target.voice,
        engine: target.engine
      });
    if (!groupedCandidates.has(key)) {
      groupedCandidates.set(key, []);
    }
    groupedCandidates.get(key).push(target);
  });
  const uniqueCandidates = Array.from(groupedCandidates.entries()).map(([key, targets]) => ({
    key,
    target: targets[0],
    targets
  }));

  const generated = await mapWithConcurrency(uniqueCandidates, ttsAlignedConcurrency, async (group) => {
    const target = group.target;
    try {
      const out = await requestAlignedTts({
        text: target.text,
        locale: target.aligned_locale,
        voice: target.voice,
        engine: target.engine,
        force
      });
      const entry = normalizeTtsLineEntry({
        text: target.text,
        hash: String(out.hash || target.hash || '').trim(),
        audio_url: String(out.audio_url || '').trim(),
        words_url: String(out.words_url || '').trim(),
        voice: String(out.voice || target.voice || '').trim(),
        engine: String(out.engine || target.engine || '').trim(),
        provider: String(out.provider || 'aws-polly').trim(),
        duration_ms: Number(out.duration_ms || 0) || 0,
        generated_at: nowIso()
      });
      if (!entry) {
        throw new Error('aligned_tts_invalid_response');
      }
      group.targets.forEach((item) => {
        setStepTtsEntry(item._stepRef, item.locale, item.line, entry);
        item.existing = entry;
        item.status = 'ready';
      });
      return {
        ok: true,
        key: group.key,
        cached: Boolean(out.cached),
        affected: group.targets.length
      };
    } catch (err) {
      const reason = err && err.message ? String(err.message) : 'tts_generate_failed';
      group.targets.forEach((item) => {
        item.status = 'error';
        failures.push({
          session_id: item.session_id,
          step: item.step,
          locale: item.locale,
          line: item.line,
          text: item.text,
          error: reason
        });
      });
      return {
        ok: false,
        key: group.key,
        error: reason,
        affected: group.targets.length
      };
    }
  });

  const anySuccess = generated.some((item) => item && item.ok);
  if (anySuccess) {
    persistReleaseSnapshotPayload(releaseRow.id, verified.payload);
  }

  const summary = summarizeTargetStatuses(verified.targets);
  const generatedCount = candidates.filter((item) => item && item.status === 'ready').length;
  const cachedCount = generated.reduce((acc, item) => {
    if (!item || !item.ok || !item.cached) return acc;
    return acc + (Number(item.affected) || 0);
  }, 0);

  return {
    payload: verified.payload,
    targets: verified.targets,
    summary: {
      ...summary,
      requested_generation: candidates.length,
      requested_unique_generation: uniqueCandidates.length,
      generated: generatedCount,
      cached: cachedCount,
      failed: failures.length
    },
    failures
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
const releaseSnapshotRegularization = regularizeStoredReleaseSnapshots();
if (releaseSnapshotRegularization.updated > 0 || releaseSnapshotRegularization.skipped > 0) {
  console.log(
    `[content] release snapshot regularization: scanned=${releaseSnapshotRegularization.scanned} updated=${releaseSnapshotRegularization.updated} skipped=${releaseSnapshotRegularization.skipped}`
  );
}

app.get('/content/health', (req, res) => {
  res.json({
    ok: true,
    service: 'speakapp-content-service',
    db_path: dbPath,
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

app.delete('/content/admin/editors/:id', requireAdmin, (req, res, next) => {
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

    const selfId =
      req.auth && req.auth.editorId !== null && req.auth.editorId !== undefined
        ? Number(req.auth.editorId)
        : null;
    if (selfId !== null && selfId === editorId) {
      res.status(400).json({ ok: false, error: 'editor_delete_self_forbidden' });
      return;
    }

    const role = normalizeRole(row.role);
    const isActive = Boolean(row.is_active);
    if (role === 'admin' && isActive) {
      const activeAdmins = Number(countActiveAdminsStmt.get() || 0);
      if (activeAdmins <= 1) {
        res.status(400).json({ ok: false, error: 'last_active_admin_forbidden' });
        return;
      }
    }

    const lock = getLockState('draft');
    const hadDraftLock =
      lock &&
      lock.owner_id !== null &&
      lock.owner_id !== undefined &&
      Number(lock.owner_id) === editorId;
    if (hadDraftLock) {
      deleteDraftLockStmt.run('draft');
    }

    deleteEditorByIdStmt.run(editorId);
    writeAuditLog(req, 'editor.delete', `editor:${editorId}`, {
      email: String(row.email || ''),
      role,
      is_active: isActive,
      released_draft_lock: Boolean(hadDraftLock)
    });
    res.json({ ok: true, deleted: true, editor_id: editorId, released_draft_lock: Boolean(hadDraftLock) });
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
  const includeTtsSummary = parseBoolean(req.query.include_tts_summary, false);
  const rows = includeTtsSummary ? listReleasesWithSnapshotStmt.all(limit) : listReleasesStmt.all(limit);
  const items = rows.map((row) => {
    const base = {
      id: Number(row.id),
      name: row.name || '',
      published: Boolean(row.published),
      created_at: row.created_at || null,
      published_at: row.published_at || null
    };
    if (includeTtsSummary) {
      base.tts_summary = buildReleaseTtsSummary(row);
    }
    return base;
  });
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

app.post('/content/admin/releases/:id/tts/verify', requirePublisher, async (req, res, next) => {
  try {
    const releaseId = Number(req.params.id);
    if (!Number.isFinite(releaseId) || releaseId <= 0) {
      res.status(400).json({ ok: false, error: 'invalid_release_id' });
      return;
    }
    const release = getReleaseByIdStmt.get(releaseId);
    if (!release) {
      res.status(404).json({ ok: false, error: 'release_not_found' });
      return;
    }
    const locales = parseRequestedHintLocales(req.body && req.body.locales);
    const engine = String((req.body && req.body.engine) || ttsAlignedPollyEngine).trim() || ttsAlignedPollyEngine;
    const checkRemote = parseBoolean(req.body && req.body.checkRemote, false);
    const verified = await verifyReleaseTtsAssets(release, { locales, engine, checkRemote });
    const preview = verified.targets.slice(0, 120).map(serializeTtsTarget);
    writeAuditLog(req, 'release.tts.verify', `release:${releaseId}`, {
      locales,
      check_remote: checkRemote,
      summary: verified.summary
    });
    res.json({
      ok: true,
      release: {
        id: Number(release.id),
        name: release.name || '',
        published: Boolean(release.published),
        created_at: release.created_at || null,
        published_at: release.published_at || null
      },
      summary: verified.summary,
      items_preview: preview,
      items_total: verified.targets.length
    });
  } catch (err) {
    next(err);
  }
});

app.post('/content/admin/releases/:id/tts/generate', requirePublisher, async (req, res, next) => {
  try {
    const releaseId = Number(req.params.id);
    if (!Number.isFinite(releaseId) || releaseId <= 0) {
      res.status(400).json({ ok: false, error: 'invalid_release_id' });
      return;
    }
    const release = getReleaseByIdStmt.get(releaseId);
    if (!release) {
      res.status(404).json({ ok: false, error: 'release_not_found' });
      return;
    }
    if (!Boolean(release.published)) {
      res.status(400).json({ ok: false, error: 'release_not_published' });
      return;
    }
    const locales = parseRequestedHintLocales(req.body && req.body.locales);
    const engine = String((req.body && req.body.engine) || ttsAlignedPollyEngine).trim() || ttsAlignedPollyEngine;
    const force = parseBoolean(req.body && req.body.force, false);
    const checkRemote = parseBoolean(req.body && req.body.checkRemote, true);
    const maxItems = Number(req.body && req.body.maxItems);
    const generated = await generateReleaseTtsAssets(release, {
      locales,
      engine,
      force,
      checkRemote,
      maxItems
    });
    const preview = generated.targets.slice(0, 120).map(serializeTtsTarget);
    writeAuditLog(req, 'release.tts.generate', `release:${releaseId}`, {
      locales,
      force,
      check_remote: checkRemote,
      max_items: Number.isFinite(maxItems) ? maxItems : null,
      summary: generated.summary,
      failures: generated.failures.length
    });
    res.json({
      ok: true,
      release: {
        id: Number(release.id),
        name: release.name || '',
        published: Boolean(release.published),
        created_at: release.created_at || null,
        published_at: release.published_at || null
      },
      summary: generated.summary,
      failures: generated.failures,
      items_preview: preview,
      items_total: generated.targets.length
    });
  } catch (err) {
    next(err);
  }
});

app.delete('/content/admin/releases/:id', requirePublisher, (req, res, next) => {
  try {
    const releaseId = Number(req.params.id);
    if (!Number.isFinite(releaseId) || releaseId <= 0) {
      res.status(400).json({ ok: false, error: 'invalid_release_id' });
      return;
    }
    const row = getReleaseByIdStmt.get(releaseId);
    if (!row) {
      res.status(404).json({ ok: false, error: 'release_not_found' });
      return;
    }
    if (Boolean(row.published)) {
      res.status(400).json({ ok: false, error: 'cannot_delete_published_release' });
      return;
    }

    deleteReleaseByIdStmt.run(releaseId);
    writeAuditLog(req, 'training.delete_release', `release:${releaseId}`, {
      name: row.name || ''
    });
    res.json({ ok: true, deleted: true, release_id: releaseId });
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
  if (ttsAlignedEndpoint) {
    console.log(`[content] tts aligned endpoint: ${ttsAlignedEndpoint}`);
  } else {
    console.log('[content] tts aligned endpoint: disabled');
  }
});
