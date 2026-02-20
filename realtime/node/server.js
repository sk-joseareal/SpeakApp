const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const Pusher = require('pusher');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const env = (key, fallback) => (process.env[key] ? process.env[key] : fallback);
const provider = env('REALTIME_PROVIDER', 'soketi');
const useTLS = env('REALTIME_USE_TLS', provider === 'pusher' ? 'true' : 'false') === 'true';
const monitorToken = env('REALTIME_MONITOR_TOKEN', '');
const stateToken = env('REALTIME_STATE_TOKEN', '');

const config = {
  appId: env('PUSHER_APP_ID'),
  key: env('PUSHER_APP_KEY'),
  secret: env('PUSHER_APP_SECRET'),
  cluster: env('PUSHER_APP_CLUSTER', 'mt1'),
  useTLS
};

const chatbotEnabled = env('CHATBOT_ENABLED', 'false') === 'true';
const chatbotCoachId = env('CHATBOT_COACH_ID', '2');
const chatbotSystemPrompt = env(
  'CHATBOT_SYSTEM_PROMPT',
  'You are an English tutor. Keep replies short, ask one follow-up question, and use plain text only.'
);
const chatbotPlainTextGuard = env(
  'CHATBOT_PLAINTEXT_GUARD',
  'Reply in plain text only. Do not use markdown, asterisks, code blocks, or list formatting.'
);
const chatbotModel = env('CHATBOT_OPENAI_MODEL', 'gpt-4o-mini');
const chatbotTemperature = Number(env('CHATBOT_TEMPERATURE', '0.6'));
const chatbotMaxTokens = Number(env('CHATBOT_MAX_TOKENS', '200'));
const chatbotMaxHistory = Number(env('CHATBOT_MAX_HISTORY', '16'));
const chatbotHistoryLimit = Number.isFinite(chatbotMaxHistory) ? chatbotMaxHistory : 16;
const openaiApiKey = env('OPENAI_API_KEY', '');
const openaiApiBase = env('OPENAI_API_BASE', 'https://api.openai.com/v1');
const openaiUsageLog = env('OPENAI_USAGE_LOG', 'openai-usage.log');
const openaiPromptCost = Number(env('OPENAI_PROMPT_COST_PER_MILLION', '0.15'));
const openaiCompletionCost = Number(env('OPENAI_COMPLETION_COST_PER_MILLION', '0.6'));
const openaiLogTranscripts = env('OPENAI_LOG_TRANSCRIPTS', 'false') === 'true';
const usageLogEnabled =
  openaiUsageLog &&
  !['false', '0', 'off', 'none'].includes(String(openaiUsageLog).toLowerCase());

if (provider !== 'pusher') {
  config.host = env('REALTIME_HOST', '127.0.0.1');
  config.port = Number(env('REALTIME_PORT', '6001'));
}

const missing = ['PUSHER_APP_ID', 'PUSHER_APP_KEY', 'PUSHER_APP_SECRET'].filter(
  (key) => !process.env[key]
);
if (missing.length) {
  console.error(`Missing env: ${missing.join(', ')}`);
  process.exit(1);
}

const pusher = new Pusher(config);

const chatbotSessions = new Map();
const openaiEndpoint = `${openaiApiBase.replace(/\/$/, '')}/chat/completions`;

const parseCoachId = (channel) => {
  if (typeof channel !== 'string') return null;
  const match = /^private-coach(\d+)-/.exec(channel);
  return match ? match[1] : null;
};

const parseCoachUserId = (channel) => {
  if (typeof channel !== 'string') return null;
  const match = /^private-coach\d+-(.+)$/.exec(channel);
  return match ? match[1] : null;
};

const pickFirstString = (...values) => {
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
};

const extractChatUserMeta = (data, channel) => {
  const source = data && typeof data === 'object' ? data : {};
  const userId = pickFirstString(source.user_id, source.userId, source.id, parseCoachUserId(channel));
  const userName = pickFirstString(source.user_name, source.userName, source.name);
  return { userId, userName };
};

const logChatbotInteraction = ({ channel, text, userId, userName }) => {
  const payload = {
    timestamp: new Date().toISOString(),
    channel: channel || '',
    coach_id: chatbotCoachId,
    user_id: userId || '',
    user_name: userName || '',
    text: text || ''
  };
  console.log('[chatbot] interaction', JSON.stringify(payload));
};

const estimateOpenAITokenCost = (tokenCount, ratePerMillion) => {
  if (!Number.isFinite(tokenCount) || !Number.isFinite(ratePerMillion)) return 0;
  return (tokenCount / 1_000_000) * ratePerMillion;
};

const appendOpenAIUsageLog = (entry) => {
  if (!usageLogEnabled) return;
  const line = `${JSON.stringify(entry)}\n`;
  fs.appendFile(openaiUsageLog, line, (err) => {
    if (err) {
      console.warn('Failed to write OpenAI usage log:', err.message);
    }
  });
};

const logOpenAIUsage = (usage, descriptor, extra = {}) => {
  if (!usage || !usageLogEnabled) return;
  try {
    const promptTokens = Number(usage.prompt_tokens) || 0;
    const completionTokens = Number(usage.completion_tokens) || 0;
    const totalTokens = Number(usage.total_tokens) || promptTokens + completionTokens;
    const pricing = descriptor && descriptor.pricing ? descriptor.pricing : {};
    const promptRate =
      typeof pricing.promptUsdPerMTokens === 'number' ? pricing.promptUsdPerMTokens : openaiPromptCost;
    const completionRate =
      typeof pricing.completionUsdPerMTokens === 'number'
        ? pricing.completionUsdPerMTokens
        : openaiCompletionCost;
    const estimatedCost =
      estimateOpenAITokenCost(promptTokens, promptRate) +
      estimateOpenAITokenCost(completionTokens, completionRate);
    const entry = {
      timestamp: new Date().toISOString(),
      model: (descriptor && descriptor.openaiModel) || chatbotModel,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      ...extra
    };
    if (Number.isFinite(estimatedCost)) {
      entry.estimated_cost_usd = Number(estimatedCost.toFixed(6));
    }
    appendOpenAIUsageLog(entry);
  } catch (err) {
    console.warn('Failed to record OpenAI usage:', err.message);
  }
};

const formatRoleLabel = (role) => {
  if (role === 'system') return 'System';
  if (role === 'assistant') return 'Assistant';
  return 'User';
};

const buildTranscript = (messages) => {
  if (!Array.isArray(messages)) return '';
  const lines = messages.map((msg) => `${formatRoleLabel(msg.role)}: ${msg.content}`);
  lines.push('Assistant:');
  return lines.join('\n');
};

const shouldHandleChatbot = (channel, event) => {
  if (!chatbotEnabled) return false;
  if (!openaiApiKey) return false;
  if (event !== 'user_message') return false;
  const coachId = parseCoachId(channel);
  return coachId && coachId === chatbotCoachId;
};

const getChatSession = (channel) => {
  if (!chatbotSessions.has(channel)) {
    const messages = [];
    if (chatbotSystemPrompt) {
      messages.push({ role: 'system', content: chatbotSystemPrompt });
    }
    if (chatbotPlainTextGuard) {
      messages.push({ role: 'system', content: chatbotPlainTextGuard });
    }
    chatbotSessions.set(channel, messages);
  }
  return chatbotSessions.get(channel);
};

const trimChatHistory = (messages) => {
  if (!Array.isArray(messages)) return [];
  const firstNonSystemIndex = messages.findIndex((msg) => !msg || msg.role !== 'system');
  const hasOnlySystemMessages = firstNonSystemIndex === -1;
  if (hasOnlySystemMessages) return messages;
  const systemMessages =
    firstNonSystemIndex > 0 ? messages.slice(0, firstNonSystemIndex) : [];
  const history = messages.slice(firstNonSystemIndex);
  if (history.length <= chatbotHistoryLimit) return messages;
  const trimmed = history.slice(-chatbotHistoryLimit);
  return [...systemMessages, ...trimmed];
};

const stripMarkdownSyntax = (value) => {
  if (typeof value !== 'string') return '';
  let text = value.replace(/\r/g, '').trim();
  if (!text) return '';

  text = text
    .replace(/```[\s\S]*?```/g, (block) =>
      block.replace(/^```[^\n]*\n?/, '').replace(/```$/, '').trim()
    )
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s).,!?;:])/g, '$1$2')
    .replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s).,!?;:])/g, '$1$2')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n');

  return text.trim();
};

const extractOpenAIReply = (payload) => {
  if (!payload || typeof payload !== 'object') return '';
  const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
  if (!choice) return '';
  const content = choice.message?.content ?? choice.delta?.content ?? '';
  if (typeof content === 'string') return stripMarkdownSyntax(content);
  if (Array.isArray(content)) {
    const merged = content
      .map((part) => (part && typeof part.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join('\n');
    return stripMarkdownSyntax(merged);
  }
  return '';
};

const requestOpenAI = (messages) => {
  const url = new URL(openaiEndpoint);
  const payload = JSON.stringify({
    model: chatbotModel,
    messages,
    temperature: Number.isFinite(chatbotTemperature) ? chatbotTemperature : 0.6,
    max_tokens: Number.isFinite(chatbotMaxTokens) ? chatbotMaxTokens : 200
  });

  const options = {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    method: 'POST',
    path: `${url.pathname}${url.search}`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiApiKey}`,
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const client = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(body || '{}');
            resolve(parsed);
          } catch (err) {
            reject(new Error(`OpenAI JSON parse error: ${err.message}`));
          }
        } else {
          reject(new Error(`OpenAI HTTP ${res.statusCode}: ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
};

const generateChatbotReply = async (channel, text, userMeta = {}) => {
  if (!text) return '';
  const session = getChatSession(channel);
  session.push({ role: 'user', content: text });
  const trimmed = trimChatHistory(session);
  if (trimmed !== session) {
    chatbotSessions.set(channel, trimmed);
  }
  const response = await requestOpenAI(trimmed);
  const reply = extractOpenAIReply(response);
  const resolvedUserId = pickFirstString(
    userMeta.userId,
    userMeta.user_id,
    userMeta.id,
    parseCoachUserId(channel)
  );
  const resolvedUserName = pickFirstString(
    userMeta.userName,
    userMeta.user_name,
    userMeta.name
  );
  const extra = {
    channel,
    coach_id: chatbotCoachId,
    user_id: resolvedUserId || null,
    user_name: resolvedUserName || null
  };
  if (openaiLogTranscripts) {
    extra.transcript = buildTranscript(trimmed);
    extra.prompt_messages = trimmed;
    extra.response = reply;
    extra.raw_response = response;
  }
  logOpenAIUsage(
    response && response.usage ? response.usage : null,
    {
      openaiModel: response && response.model ? response.model : chatbotModel,
      pricing: {
        promptUsdPerMTokens: openaiPromptCost,
        completionUsdPerMTokens: openaiCompletionCost
      }
    },
    extra
  );
  if (!reply) return '';
  const updated = chatbotSessions.get(channel) || trimmed;
  updated.push({ role: 'assistant', content: reply });
  chatbotSessions.set(channel, updated);
  return reply;
};

const apiHost =
  provider === 'pusher'
    ? config.cluster
      ? `api-${config.cluster}.pusher.com`
      : 'api.pusherapp.com'
    : config.host || '127.0.0.1';
const apiPort = provider === 'pusher' ? 443 : Number(config.port || 6001);
const apiClient = useTLS || provider === 'pusher' ? https : http;

const authorizeMonitor = (req, res) => {
  if (!monitorToken) return true;
  const token =
    req.get('x-monitor-token') ||
    (req.query ? req.query.token : '') ||
    (req.body ? req.body.token : '');
  if (!token || token !== monitorToken) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
};

const authorizeState = (req, res) => {
  if (!stateToken) return true;
  const token =
    req.get('x-rt-token') ||
    (req.query ? req.query.token : '') ||
    (req.body ? req.body.token : '');
  if (!token || token !== stateToken) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
};

const dataRoot = path.join(__dirname, 'data', 'rt');
const eventsDir = path.join(dataRoot, 'events');
const snapshotsDir = path.join(dataRoot, 'snapshots');
const metaDir = path.join(dataRoot, 'meta');

const ensureDir = (dirPath) => {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch (err) {
    console.warn('[state] mkdir failed', dirPath, err.message);
  }
};

ensureDir(eventsDir);
ensureDir(snapshotsDir);
ensureDir(metaDir);

const sanitizeOwner = (value) => {
  if (!value) return '';
  return String(value)
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 160);
};

const resolveOwner = (req) => {
  const source = Object.assign({}, req.query || {}, req.body || {});
  const owner =
    source.owner ||
    source.owner_id ||
    source.ownerId ||
    req.get('x-rt-owner') ||
    '';
  if (owner) return String(owner);
  const userId =
    source.user_id ||
    source.userId ||
    req.get('x-user-id') ||
    '';
  if (userId) return `user:${userId}`;
  const deviceId =
    source.device_id ||
    source.deviceId ||
    req.get('x-device-id') ||
    '';
  if (deviceId) return `device:${deviceId}`;
  return '';
};

const snapshotPathFor = (ownerKey) => path.join(snapshotsDir, `${ownerKey}.json`);
const eventsPathFor = (ownerKey) => path.join(eventsDir, `${ownerKey}.jsonl`);
const metaPathFor = (ownerKey) => path.join(metaDir, `${ownerKey}.json`);

const newSnapshot = () => ({
  schema: 1,
  version: 0,
  updated_at: null,
  word_scores: {},
  phrase_scores: {},
  session_rewards: {},
  badges: {},
  session_meta: {},
  events_count: 0
});

const newMeta = () => ({
  schema: 1,
  updated_at: null,
  events_count: 0,
  processed: {}
});

const loadJsonFile = (filePath, fallback) => {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[state] read failed', filePath, err.message);
    return fallback;
  }
};

const writeJsonFile = (filePath, data) => {
  try {
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    console.warn('[state] write failed', filePath, err.message);
  }
};

const loadSnapshot = (ownerKey) => {
  const filePath = snapshotPathFor(ownerKey);
  if (!fs.existsSync(filePath)) return { snapshot: newSnapshot(), exists: false };
  const data = loadJsonFile(filePath, null);
  return { snapshot: data && typeof data === 'object' ? data : newSnapshot(), exists: true };
};

const saveSnapshot = (ownerKey, snapshot) => {
  writeJsonFile(snapshotPathFor(ownerKey), snapshot);
};

const loadMeta = (ownerKey) => {
  const filePath = metaPathFor(ownerKey);
  if (!fs.existsSync(filePath)) return newMeta();
  const data = loadJsonFile(filePath, null);
  return data && typeof data === 'object' ? data : newMeta();
};

const saveMeta = (ownerKey, meta) => {
  writeJsonFile(metaPathFor(ownerKey), meta);
};

const appendEvents = (ownerKey, events) => {
  if (!events.length) return;
  const filePath = eventsPathFor(ownerKey);
  const lines = events.map((event) => `${JSON.stringify(event)}\n`).join('');
  try {
    fs.appendFileSync(filePath, lines, 'utf8');
  } catch (err) {
    console.warn('[state] append events failed', filePath, err.message);
  }
};

const clampPercent = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.min(100, num));
};

const coerceNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const hashEvent = (event) => {
  const base = [
    event.type || '',
    event.session_id || '',
    event.word || '',
    event.percent ?? '',
    event.transcript || '',
    event.rewardQty ?? '',
    event.rewardLabel || '',
    event.rewardIcon || '',
    event.badge_id || '',
    event.badge_label || '',
    event.badge_icon || '',
    event.ts || ''
  ].join('|');
  return crypto.createHash('sha1').update(base).digest('hex');
};

const normalizeEvent = (rawEvent) => {
  if (!rawEvent || typeof rawEvent !== 'object') return { error: 'invalid_event' };
  const payload =
    rawEvent.payload && typeof rawEvent.payload === 'object' ? rawEvent.payload : {};
  const event = {
    id: rawEvent.id || payload.id || '',
    ts: coerceNumber(rawEvent.ts || payload.ts) || Date.now(),
    type: rawEvent.type || payload.type || rawEvent.event || payload.event || '',
    session_id:
      rawEvent.session_id ||
      rawEvent.sessionId ||
      payload.session_id ||
      payload.sessionId ||
      '',
    word: rawEvent.word || payload.word || '',
    percent: rawEvent.percent ?? payload.percent,
    transcript: rawEvent.transcript ?? payload.transcript,
    rewardQty:
      rawEvent.rewardQty ??
      payload.rewardQty ??
      rawEvent.reward_qty ??
      payload.reward_qty,
    rewardLabel:
      rawEvent.rewardLabel ??
      payload.rewardLabel ??
      rawEvent.reward_label ??
      payload.reward_label,
    rewardIcon:
      rawEvent.rewardIcon ??
      payload.rewardIcon ??
      rawEvent.reward_icon ??
      payload.reward_icon,
    badge_id:
      rawEvent.badge_id ??
      payload.badge_id ??
      rawEvent.badgeId ??
      payload.badgeId,
    badge_label:
      rawEvent.badge_label ??
      payload.badge_label ??
      rawEvent.badgeLabel ??
      payload.badgeLabel,
    badge_icon:
      rawEvent.badge_icon ??
      payload.badge_icon ??
      rawEvent.badgeIcon ??
      payload.badgeIcon,
    context:
      rawEvent.context ||
      payload.context ||
      rawEvent.meta ||
      payload.meta ||
      null
  };

  if (!event.type) {
    if (event.session_id && event.word) {
      event.type = 'word_score';
    } else if (event.session_id && (event.rewardQty !== undefined || event.rewardLabel || event.rewardIcon)) {
      event.type = 'session_reward';
    } else if (event.session_id && event.percent !== undefined) {
      event.type = 'phrase_score';
    } else if (event.badge_id) {
      event.type = 'badge_awarded';
    }
  }

  if (!event.type) return { error: 'missing_type' };
  if (!event.id) {
    event.id = hashEvent(event);
    event.generated_id = true;
  }

  const percent = clampPercent(event.percent);
  if (percent !== null) {
    event.percent = percent;
  }

  const rewardQty = coerceNumber(event.rewardQty);
  if (rewardQty !== null) {
    event.rewardQty = rewardQty;
  }

  return event;
};

const ensureSessionMeta = (snapshot, sessionId, context, ts) => {
  if (!sessionId || !context || typeof context !== 'object') return;
  if (!snapshot.session_meta) snapshot.session_meta = {};
  const prev = snapshot.session_meta[sessionId] || {};
  snapshot.session_meta[sessionId] = {
    ...prev,
    ...context,
    updated_at: ts || Date.now()
  };
};

const applyEventToSnapshot = (snapshot, event) => {
  if (!snapshot || !event) return false;
  let applied = false;
  const ts = Number(event.ts) || Date.now();

  switch (event.type) {
    case 'word_score': {
      if (!event.session_id || !event.word) return false;
      if (!snapshot.word_scores) snapshot.word_scores = {};
      if (!snapshot.word_scores[event.session_id]) {
        snapshot.word_scores[event.session_id] = {};
      }
      const session = snapshot.word_scores[event.session_id];
      const prev = session[event.word];
      if (!prev || (prev.ts || 0) <= ts) {
        session[event.word] = {
          percent: event.percent ?? null,
          transcript: event.transcript || '',
          ts
        };
        applied = true;
      }
      ensureSessionMeta(snapshot, event.session_id, event.context, ts);
      break;
    }
    case 'phrase_score': {
      if (!event.session_id) return false;
      if (!snapshot.phrase_scores) snapshot.phrase_scores = {};
      const prev = snapshot.phrase_scores[event.session_id];
      if (!prev || (prev.ts || 0) <= ts) {
        snapshot.phrase_scores[event.session_id] = {
          percent: event.percent ?? null,
          transcript: event.transcript || '',
          ts
        };
        applied = true;
      }
      ensureSessionMeta(snapshot, event.session_id, event.context, ts);
      break;
    }
    case 'session_reward': {
      if (!event.session_id) return false;
      if (!snapshot.session_rewards) snapshot.session_rewards = {};
      const prev = snapshot.session_rewards[event.session_id];
      if (!prev || (prev.ts || 0) <= ts) {
        snapshot.session_rewards[event.session_id] = {
          rewardQty: event.rewardQty ?? null,
          rewardLabel: event.rewardLabel || '',
          rewardIcon: event.rewardIcon || '',
          ts
        };
        applied = true;
      }
      ensureSessionMeta(snapshot, event.session_id, event.context, ts);
      break;
    }
    case 'badge_awarded': {
      if (!event.badge_id) return false;
      if (!snapshot.badges) snapshot.badges = {};
      const prev = snapshot.badges[event.badge_id] || { count: 0 };
      const count = coerceNumber(prev.count) || 0;
      snapshot.badges[event.badge_id] = {
        count: count + 1,
        label: event.badge_label || prev.label || '',
        icon: event.badge_icon || prev.icon || '',
        ts
      };
      applied = true;
      break;
    }
    default:
      return false;
  }

  return applied;
};

const isSnapshotEmpty = (snapshot) => {
  if (!snapshot) return true;
  const hasWords = snapshot.word_scores && Object.keys(snapshot.word_scores).length;
  const hasPhrases = snapshot.phrase_scores && Object.keys(snapshot.phrase_scores).length;
  const hasRewards = snapshot.session_rewards && Object.keys(snapshot.session_rewards).length;
  const hasBadges = snapshot.badges && Object.keys(snapshot.badges).length;
  return !(hasWords || hasPhrases || hasRewards || hasBadges);
};

const extractSnapshotParts = (input) => {
  if (!input || typeof input !== 'object') {
    return {
      word_scores: {},
      phrase_scores: {},
      session_rewards: {},
      badges: {},
      session_meta: {}
    };
  }
  return {
    word_scores: input.word_scores || input.wordScores || input.speakWordScores || {},
    phrase_scores: input.phrase_scores || input.phraseScores || input.speakPhraseScores || {},
    session_rewards: input.session_rewards || input.sessionRewards || input.speakSessionRewards || {},
    badges: input.badges || input.badgesMap || {},
    session_meta: input.session_meta || input.sessionMeta || {}
  };
};

const mergeSnapshot = (target, incoming) => {
  if (!target || !incoming) return false;
  let changed = false;
  const parts = extractSnapshotParts(incoming);
  const now = Date.now();

  const mergeSessionMap = (dest, src, opts = {}) => {
    Object.entries(src || {}).forEach(([sessionId, value]) => {
      if (!sessionId || !value || typeof value !== 'object') return;
      const current = dest[sessionId];
      const ts = coerceNumber(value.ts) || now;
      if (!current || (current.ts || 0) <= ts) {
        dest[sessionId] = { ...value, ts };
        changed = true;
      }
      if (opts.context && value.context) {
        ensureSessionMeta(target, sessionId, value.context, ts);
      }
    });
  };

  if (!target.word_scores) target.word_scores = {};
  if (!target.phrase_scores) target.phrase_scores = {};
  if (!target.session_rewards) target.session_rewards = {};
  if (!target.badges) target.badges = {};
  if (!target.session_meta) target.session_meta = {};

  Object.entries(parts.word_scores || {}).forEach(([sessionId, words]) => {
    if (!sessionId || !words || typeof words !== 'object') return;
    if (!target.word_scores[sessionId]) target.word_scores[sessionId] = {};
    Object.entries(words).forEach(([word, value]) => {
      if (!word || !value || typeof value !== 'object') return;
      const prev = target.word_scores[sessionId][word];
      const ts = coerceNumber(value.ts) || now;
      if (!prev || (prev.ts || 0) <= ts) {
        target.word_scores[sessionId][word] = { ...value, ts };
        changed = true;
      }
    });
  });

  mergeSessionMap(target.phrase_scores, parts.phrase_scores);
  mergeSessionMap(target.session_rewards, parts.session_rewards);

  Object.entries(parts.badges || {}).forEach(([badgeId, value]) => {
    if (!badgeId || !value || typeof value !== 'object') return;
    const prev = target.badges[badgeId] || { count: 0 };
    const count = coerceNumber(value.count) || coerceNumber(prev.count) || 0;
    target.badges[badgeId] = {
      ...prev,
      ...value,
      count
    };
    changed = true;
  });

  Object.entries(parts.session_meta || {}).forEach(([sessionId, meta]) => {
    if (!sessionId || !meta || typeof meta !== 'object') return;
    const prev = target.session_meta[sessionId] || {};
    target.session_meta[sessionId] = { ...prev, ...meta };
    changed = true;
  });

  return changed;
};

const buildSummary = (snapshot) => {
  const wordSessions = snapshot.word_scores ? Object.keys(snapshot.word_scores).length : 0;
  const phraseSessions = snapshot.phrase_scores ? Object.keys(snapshot.phrase_scores).length : 0;
  const rewardSessions = snapshot.session_rewards ? Object.keys(snapshot.session_rewards).length : 0;
  const badgeCount = snapshot.badges ? Object.keys(snapshot.badges).length : 0;
  let wordEntries = 0;
  if (snapshot.word_scores) {
    Object.values(snapshot.word_scores).forEach((session) => {
      if (session && typeof session === 'object') wordEntries += Object.keys(session).length;
    });
  }
  return {
    version: snapshot.version || 0,
    updated_at: snapshot.updated_at || null,
    word_sessions: wordSessions,
    phrase_sessions: phraseSessions,
    reward_sessions: rewardSessions,
    badges: badgeCount,
    word_entries: wordEntries,
    events_count: snapshot.events_count || 0
  };
};

const parseMaybeJson = (value) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (err) {
    return value;
  }
};

const getAuthPayload = (req) => {
  const source = Object.assign({}, req.query || {}, req.body || {});
  return {
    socketId: source.socket_id || source.socketId,
    channelName: source.channel_name || source.channelName,
    userId: source.user_id || source.userId,
    userInfo: parseMaybeJson(source.user_info || source.userInfo)
  };
};

const signedQuery = (method, pathName, params) => {
  const pairs = Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`);
  const query = pairs.join('&');
  const signature = crypto
    .createHmac('sha256', config.secret)
    .update([method.toUpperCase(), pathName, query].join('\n'))
    .digest('hex');
  return `${query}&auth_signature=${signature}`;
};

const fetchChannels = (params, cb) => {
  const appId = config.appId;
  const key = config.key;
  const secret = config.secret;
  if (!appId || !key || !secret) {
    cb(new Error('missing app credentials'));
    return;
  }
  const authParams = Object.assign({}, params, {
    auth_key: key,
    auth_timestamp: Math.floor(Date.now() / 1000),
    auth_version: '1.0'
  });
  const pathName = `/apps/${appId}/channels`;
  const query = signedQuery('GET', pathName, authParams);
  const req = apiClient.request(
    {
      host: apiHost,
      port: apiPort,
      path: `${pathName}?${query}`,
      method: 'GET',
      timeout: 5000
    },
    (resp) => {
      let body = '';
      resp.on('data', (chunk) => {
        body += chunk;
      });
      resp.on('end', () => {
        cb(null, { statusCode: resp.statusCode || 200, body });
      });
    }
  );
  req.on('timeout', () => {
    req.destroy(new Error('timeout'));
  });
  req.on('error', (err) => cb(err));
  req.end();
};

app.get('/realtime/health', (req, res) => {
  res.json({ ok: true, provider, useTLS });
});

const authHandler = (req, res) => {
  const { socketId, channelName, userId, userInfo } = getAuthPayload(req);
  if (!socketId || !channelName) {
    res.status(400).json({ error: 'socket_id and channel_name required' });
    return;
  }

  const isPresence = channelName.startsWith('presence-');
  if (!isPresence) {
    res.json(pusher.authenticate(socketId, channelName));
    return;
  }

  if (!userId) {
    res.status(400).json({ error: 'user_id required for presence channels' });
    return;
  }

  const presenceData = {
    user_id: String(userId),
    user_info: userInfo || {}
  };
  res.json(pusher.authenticate(socketId, channelName, presenceData));
};

app.post('/realtime/auth', authHandler);
app.get('/realtime/auth', authHandler);

app.post('/realtime/emit', async (req, res) => {
  const { channel, event, data } = req.body || {};
  if (!channel) {
    res.status(400).json({ error: 'channel required' });
    return;
  }
  const eventName = event || 'chat_message';
  try {
    await pusher.trigger(channel, eventName, data || {});
    res.json({ ok: true });
  } catch (err) {
    console.error('[realtime] trigger error', err);
    res.status(500).json({ error: 'trigger failed' });
    return;
  }

  if (!shouldHandleChatbot(channel, eventName)) return;
  const text = data && typeof data.text === 'string' ? data.text.trim() : '';
  if (!text) return;
  const userMeta = extractChatUserMeta(data, channel);
  logChatbotInteraction({
    channel,
    text,
    userId: userMeta.userId,
    userName: userMeta.userName
  });
  generateChatbotReply(channel, text, userMeta)
    .then((reply) => {
      if (!reply) return;
      return pusher.trigger(channel, 'bot_message', {
        text: reply,
        role: 'bot',
        coach_id: chatbotCoachId
      });
    })
    .catch((err) => {
      console.error('[realtime] chatbot error', err.message || err);
    });
});

app.get('/realtime/channels', (req, res) => {
  if (!authorizeMonitor(req, res)) return;
  const params = {};
  const prefix = req.query.filter_by_prefix || req.query.prefix;
  if (prefix) params.filter_by_prefix = prefix;
  if (req.query.info) params.info = req.query.info;
  if (req.query.limit) params.limit = req.query.limit;
  if (req.query.cursor) params.cursor = req.query.cursor;

  fetchChannels(params, (err, result) => {
    if (err) {
      console.error('[realtime] channels error', err);
      const status = err.message === 'timeout' ? 504 : 500;
      res.status(status).json({ error: err.message || 'channels failed' });
      return;
    }
    const statusCode = result && result.statusCode ? result.statusCode : 200;
    let body = result && result.body !== undefined ? result.body : result;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (parseErr) {
        body = { raw: body };
      }
    }
    res.status(statusCode).json(body || {});
  });
});

app.get('/realtime/state/summary', (req, res) => {
  if (!authorizeState(req, res)) return;
  const owner = resolveOwner(req);
  if (!owner) {
    res.status(400).json({ error: 'owner required' });
    return;
  }
  const ownerKey = sanitizeOwner(owner);
  if (!ownerKey) {
    res.status(400).json({ error: 'owner invalid' });
    return;
  }
  const { snapshot, exists } = loadSnapshot(ownerKey);
  res.json({
    owner,
    exists,
    summary: buildSummary(snapshot)
  });
});

app.get('/realtime/state', (req, res) => {
  if (!authorizeState(req, res)) return;
  const owner = resolveOwner(req);
  if (!owner) {
    res.status(400).json({ error: 'owner required' });
    return;
  }
  const ownerKey = sanitizeOwner(owner);
  if (!ownerKey) {
    res.status(400).json({ error: 'owner invalid' });
    return;
  }
  const { snapshot, exists } = loadSnapshot(ownerKey);
  res.json({
    owner,
    exists,
    snapshot
  });
});

app.post('/realtime/state/sync', (req, res) => {
  if (!authorizeState(req, res)) return;
  const owner = resolveOwner(req);
  if (!owner) {
    res.status(400).json({ error: 'owner required' });
    return;
  }
  const ownerKey = sanitizeOwner(owner);
  if (!ownerKey) {
    res.status(400).json({ error: 'owner invalid' });
    return;
  }
  const strategy = (req.body && req.body.strategy) || 'merge';
  const incomingEvents = Array.isArray(req.body?.events) ? req.body.events : [];
  const incomingSnapshot = req.body?.snapshot && typeof req.body.snapshot === 'object' ? req.body.snapshot : null;

  const { snapshot, exists } = loadSnapshot(ownerKey);
  const meta = loadMeta(ownerKey);
  if (!meta.processed || typeof meta.processed !== 'object') meta.processed = {};

  const appliedIds = [];
  const ackedIds = [];
  const invalidEvents = [];
  const newEvents = [];
  let changed = false;

  incomingEvents.forEach((rawEvent) => {
    const normalized = normalizeEvent(rawEvent);
    if (normalized.error) {
      invalidEvents.push({ error: normalized.error, raw: rawEvent });
      return;
    }
    const id = normalized.id;
    if (!id) {
      invalidEvents.push({ error: 'missing_id', raw: rawEvent });
      return;
    }
    if (meta.processed[id]) {
      ackedIds.push(id);
      return;
    }
    meta.processed[id] = 1;
    ackedIds.push(id);
    newEvents.push(normalized);
    const applied = applyEventToSnapshot(snapshot, normalized);
    if (applied) {
      appliedIds.push(id);
      snapshot.events_count = (snapshot.events_count || 0) + 1;
      changed = true;
    }
  });

  if (incomingSnapshot && (strategy === 'merge' || strategy === 'replace')) {
    if (strategy === 'replace') {
      const base = newSnapshot();
      mergeSnapshot(base, incomingSnapshot);
      base.version = snapshot.version || 0;
      base.events_count = snapshot.events_count || 0;
      Object.assign(snapshot, base);
      changed = true;
    } else if (strategy === 'merge') {
      const merged = mergeSnapshot(snapshot, incomingSnapshot);
      if (merged) changed = true;
    }
  } else if (incomingSnapshot && !exists && isSnapshotEmpty(snapshot)) {
    const merged = mergeSnapshot(snapshot, incomingSnapshot);
    if (merged) changed = true;
  }

  if (newEvents.length) {
    appendEvents(ownerKey, newEvents);
    meta.events_count = (meta.events_count || 0) + newEvents.length;
  }

  if (changed) {
    snapshot.updated_at = new Date().toISOString();
    snapshot.version = (snapshot.version || 0) + 1;
    saveSnapshot(ownerKey, snapshot);
  }

  meta.updated_at = new Date().toISOString();
  saveMeta(ownerKey, meta);

  res.json({
    owner,
    acked_ids: ackedIds,
    applied_ids: appliedIds,
    invalid_events: invalidEvents.length,
    snapshot,
    summary: buildSummary(snapshot)
  });
});

const port = Number(env('REALTIME_GATEWAY_PORT', '8787'));
app.listen(port, () => {
  console.log(`Realtime gateway listening on :${port} (${provider})`);
});
