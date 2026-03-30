const mysql = require('mysql2/promise');

const APP_USERS_EDITABLE_FIELDS = [
  'first_name',
  'last_name',
  'name',
  'is_active',
  'expires_date',
  'locale',
  'lc',
  'birthdate',
  'sex'
];

const APP_USERS_READONLY_FIELDS = [
  'id',
  'email',
  'premium',
  'image',
  'avatar_file_name',
  'section_progress_count',
  'test_progress_count',
  'created_at',
  'updated_at'
];

const APP_USERS_STATUS_CAPABILITIES = {
  data_source: 'mysql_rds_direct',
  delete: false,
  email_editable: false,
  premium_editable: false,
  force_logout: true
};

const APP_USERS_CONTRACT_VERSION = 'app-users-rds-2026-03-30';

const asText = (value) => String(value === undefined || value === null ? '' : value).trim();

const pickFirstNonEmptyText = (...values) => {
  for (const value of values) {
    const text = asText(value);
    if (text) return text;
  }
  return '';
};

const buildRepoError = (statusCode, message, extra = {}) => {
  const err = new Error(String(message || 'app_users_repository_error'));
  err.statusCode = Number(statusCode) || 500;
  err.payload = {
    ok: false,
    error: String(message || 'app_users_repository_error'),
    ...(extra && typeof extra === 'object' ? extra : {})
  };
  return err;
};

const normalizeMysqlDateString = (value, { dateOnly = false } = {}) => {
  const text = asText(value);
  if (!text || text === '0000-00-00' || text === '0000-00-00 00:00:00') return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)) {
    return dateOnly ? text.slice(0, 10) : text;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return '';
  const yyyy = String(parsed.getUTCFullYear()).padStart(4, '0');
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getUTCDate()).padStart(2, '0');
  if (dateOnly) return `${yyyy}-${mm}-${dd}`;
  const hh = String(parsed.getUTCHours()).padStart(2, '0');
  const mi = String(parsed.getUTCMinutes()).padStart(2, '0');
  const ss = String(parsed.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
};

const normalizeBirthdateValue = (value) => {
  const normalized = normalizeMysqlDateString(value, { dateOnly: true });
  return normalized || '1901-01-01';
};

const normalizeExpiresDateValue = (value) => {
  const normalized = normalizeMysqlDateString(value, { dateOnly: true });
  return normalized ? `${normalized} 00:00:00` : null;
};

const normalizeLocaleValue = (value) => {
  const normalized = asText(value).toLowerCase();
  return normalized ? normalized.slice(0, 2) : '';
};

const normalizeLcValue = (value) => {
  const normalized = asText(value).toLowerCase();
  return normalized ? normalized.slice(0, 5) : '';
};

const normalizeSexValue = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : null;
};

const isFutureDate = (value) => {
  const normalized = normalizeMysqlDateString(value);
  if (!normalized) return false;
  const parsed = new Date(normalized.replace(' ', 'T') + 'Z');
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() > Date.now();
};

const getAvatarUrl = (userId, avatarFileName) => {
  const file = asText(avatarFileName);
  if (!file || file === 'no-avatar.gif' || file.split('.').length !== 2) return '';
  if (/^https?:\/\//i.test(file)) return file;
  if (file.startsWith('image.')) {
    return `https://s3.amazonaws.com/sk.audios.dev/avatars/${userId}/original/${file}`;
  }
  return `https://s3.amazonaws.com/sk.assets/avatars/${userId}/${file}`;
};

const normalizeAppUserRow = (row) => {
  if (!row || typeof row !== 'object') return null;
  const id = Number(row.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  const firstName = pickFirstNonEmptyText(row.first_name);
  const lastName = pickFirstNonEmptyText(row.last_name);
  const name = pickFirstNonEmptyText(row.name, [firstName, lastName].filter(Boolean).join(' '));
  const expiresDate = normalizeMysqlDateString(row.expires_date);
  const bannedUntil = normalizeMysqlDateString(row.banneduntil);
  return {
    id,
    email: pickFirstNonEmptyText(row.email),
    first_name: firstName,
    last_name: lastName,
    name,
    is_active: !isFutureDate(bannedUntil),
    premium: isFutureDate(expiresDate),
    expires_date: expiresDate,
    locale: normalizeLocaleValue(row.locale),
    lc: normalizeLcValue(row.lc || row.locale),
    birthdate: normalizeMysqlDateString(row.birthdate, { dateOnly: true }) || '1901-01-01',
    sex: row.sex === undefined || row.sex === null || row.sex === '' ? null : Number(row.sex),
    image: getAvatarUrl(id, row.avatar_file_name),
    avatar_file_name: pickFirstNonEmptyText(row.avatar_file_name),
    section_progress_count: Number(row.section_progress_count) || 0,
    test_progress_count: Number(row.test_progress_count) || 0,
    created_at: normalizeMysqlDateString(row.created_at),
    updated_at: normalizeMysqlDateString(row.updated_at),
    banneduntil: bannedUntil,
    current_course: row.current_course === undefined || row.current_course === null ? null : Number(row.current_course),
    last_sign_in_at: normalizeMysqlDateString(row.last_sign_in_at),
    sign_in_count: Number(row.sign_in_count) || 0
  };
};

const escapeLike = (value) => asText(value).replace(/[\\%_]/g, '\\$&');

class AppUsersRepository {
  constructor(config = {}) {
    this.host = asText(config.host);
    this.port = Number(config.port) || 3306;
    this.user = asText(config.user);
    this.password = String(config.password === undefined || config.password === null ? '' : config.password);
    this.database = asText(config.database);
    this.connectionLimit = Math.min(
      10,
      Math.max(1, Number(config.connectionLimit) || 4)
    );
    this.pool = null;
  }

  isConfigured() {
    return Boolean(this.host && this.user && this.database);
  }

  getStatus() {
    return {
      configured: this.isConfigured(),
      source: 'mysql',
      mysql_host: this.host || '',
      mysql_port: this.port,
      mysql_database: this.database || '',
      editable_fields: APP_USERS_EDITABLE_FIELDS.slice(),
      readonly_fields: APP_USERS_READONLY_FIELDS.slice(),
      capabilities: { ...APP_USERS_STATUS_CAPABILITIES },
      contract_version: APP_USERS_CONTRACT_VERSION
    };
  }

  ensureConfigured() {
    if (this.isConfigured()) return;
    throw buildRepoError(503, 'app_users_mysql_not_configured', {
      status: this.getStatus()
    });
  }

  getPool() {
    this.ensureConfigured();
    if (!this.pool) {
      this.pool = mysql.createPool({
        host: this.host,
        port: this.port,
        user: this.user,
        password: this.password,
        database: this.database,
        waitForConnections: true,
        connectionLimit: this.connectionLimit,
        queueLimit: 0,
        dateStrings: true,
        timezone: 'Z'
      });
    }
    return this.pool;
  }

  normalizeMysqlError(err) {
    const code = err && err.code ? String(err.code) : '';
    if (code === 'ER_ACCESS_DENIED_ERROR') {
      return buildRepoError(502, 'app_users_mysql_access_denied');
    }
    if (
      code === 'ECONNREFUSED' ||
      code === 'ENOTFOUND' ||
      code === 'ETIMEDOUT' ||
      code === 'PROTOCOL_CONNECTION_LOST'
    ) {
      return buildRepoError(502, 'app_users_mysql_connection_error', {
        mysql_code: code
      });
    }
    if (err && err.statusCode) return err;
    return buildRepoError(500, 'app_users_mysql_query_failed', {
      mysql_code: code || undefined
    });
  }

  async execute(sql, values = []) {
    try {
      return await this.getPool().execute(sql, values);
    } catch (err) {
      throw this.normalizeMysqlError(err);
    }
  }

  async getRawUserById(id) {
    const userId = Number(id);
    if (!Number.isFinite(userId) || userId <= 0) return null;
    const [rows] = await this.execute(
      `
        SELECT
          u.id,
          u.email,
          u.first_name,
          u.last_name,
          u.name,
          u.locale,
          u.lc,
          u.birthdate,
          u.sex,
          u.expires_date,
          u.avatar_file_name,
          u.created_at,
          u.updated_at,
          u.banneduntil,
          u.current_course,
          u.last_sign_in_at,
          u.sign_in_count,
          u.token,
          u.token_expiration
        FROM users u
        WHERE u.id = ?
        LIMIT 1
      `,
      [userId]
    );
    return rows[0] || null;
  }

  async listUsers({ query = '', limit = 20 } = {}) {
    const queryText = asText(query);
    const rowLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const clauses = [];
    const values = [];
    if (queryText) {
      const likeValue = `%${escapeLike(queryText)}%`;
      clauses.push(
        `(u.email LIKE ? ESCAPE '\\\\' OR u.name LIKE ? ESCAPE '\\\\' OR u.first_name LIKE ? ESCAPE '\\\\' OR u.last_name LIKE ? ESCAPE '\\\\'`
      );
      values.push(likeValue, likeValue, likeValue, likeValue);
      if (/^\d+$/.test(queryText)) {
        clauses[0] += ' OR CAST(u.id AS CHAR) = ?';
        values.push(queryText);
      }
      clauses[0] += ')';
    }
    const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const [rows] = await this.execute(
      `
        SELECT
          u.id,
          u.email,
          u.first_name,
          u.last_name,
          u.name,
          u.locale,
          u.lc,
          u.birthdate,
          u.sex,
          u.expires_date,
          u.avatar_file_name,
          u.created_at,
          u.updated_at,
          u.banneduntil
        FROM users u
        ${whereSql}
        ORDER BY
          CASE WHEN u.updated_at IS NULL THEN 1 ELSE 0 END,
          u.updated_at DESC,
          u.id DESC
        LIMIT ?
      `,
      [...values, rowLimit]
    );
    const [countRows] = await this.execute(
      `
        SELECT COUNT(*) AS total
        FROM users u
        ${whereSql}
      `,
      values
    );
    return {
      users: rows.map((row) => normalizeAppUserRow(row)).filter(Boolean),
      total: Number(countRows[0] && countRows[0].total) || 0
    };
  }

  async getUserById(id) {
    const userId = Number(id);
    if (!Number.isFinite(userId) || userId <= 0) return null;
    const [rows] = await this.execute(
      `
        SELECT
          u.id,
          u.email,
          u.first_name,
          u.last_name,
          u.name,
          u.locale,
          u.lc,
          u.birthdate,
          u.sex,
          u.expires_date,
          u.avatar_file_name,
          u.created_at,
          u.updated_at,
          u.banneduntil,
          u.current_course,
          u.last_sign_in_at,
          u.sign_in_count,
          (
            SELECT COUNT(*)
            FROM user_actions ua
            WHERE ua.user_id = u.id AND ua.type_action = 'SECTION_DONE'
          ) AS section_progress_count,
          (
            SELECT COUNT(*)
            FROM user_actions ua
            WHERE ua.user_id = u.id AND ua.type_action LIKE 'TEST_DONE_%'
          ) AS test_progress_count
        FROM users u
        WHERE u.id = ?
        LIMIT 1
      `,
      [userId]
    );
    return normalizeAppUserRow(rows[0] || null);
  }

  async updateUserById(id, input = {}) {
    const userId = Number(id);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw buildRepoError(400, 'invalid_app_user_id');
    }
    const current = await this.getRawUserById(userId);
    if (!current) {
      throw buildRepoError(404, 'app_user_not_found');
    }

    const patch = {};

    if (Object.prototype.hasOwnProperty.call(input, 'first_name')) {
      patch.first_name = asText(input.first_name);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'last_name')) {
      patch.last_name = asText(input.last_name);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'locale')) {
      patch.locale = normalizeLocaleValue(input.locale);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'lc')) {
      patch.lc = normalizeLcValue(input.lc);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'birthdate')) {
      patch.birthdate = normalizeBirthdateValue(input.birthdate);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'sex')) {
      patch.sex = normalizeSexValue(input.sex);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'expires_date')) {
      patch.expires_date = normalizeExpiresDateValue(input.expires_date);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'is_active')) {
      const isActive = Boolean(input.is_active);
      patch.banneduntil = isActive ? null : '2099-12-31 23:59:59';
      if (!isActive) {
        patch.token = '';
        patch.token_expiration = null;
      }
    }

    const nextFirstName =
      Object.prototype.hasOwnProperty.call(patch, 'first_name') ? patch.first_name : asText(current.first_name);
    const nextLastName =
      Object.prototype.hasOwnProperty.call(patch, 'last_name') ? patch.last_name : asText(current.last_name);
    if (
      Object.prototype.hasOwnProperty.call(input, 'name') ||
      Object.prototype.hasOwnProperty.call(patch, 'first_name') ||
      Object.prototype.hasOwnProperty.call(patch, 'last_name')
    ) {
      const explicitName = asText(input.name);
      patch.name = explicitName || [nextFirstName, nextLastName].filter(Boolean).join(' ');
    }

    const updateEntries = Object.entries(patch);
    if (!updateEntries.length) {
      return this.getUserById(userId);
    }

    const assignments = updateEntries.map(([field]) => `\`${field}\` = ?`);
    const values = updateEntries.map(([, value]) => value);
    assignments.push('`updated_at` = UTC_TIMESTAMP()');

    await this.execute(`UPDATE users SET ${assignments.join(', ')} WHERE id = ?`, [...values, userId]);
    return this.getUserById(userId);
  }
}

const createAppUsersRepository = (config = {}) => new AppUsersRepository(config);

module.exports = {
  APP_USERS_EDITABLE_FIELDS,
  APP_USERS_READONLY_FIELDS,
  APP_USERS_STATUS_CAPABILITIES,
  APP_USERS_CONTRACT_VERSION,
  createAppUsersRepository
};
