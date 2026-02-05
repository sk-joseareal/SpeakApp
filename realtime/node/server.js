const path = require('path');
const crypto = require('crypto');
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
  'You are an English tutor. Keep replies short and ask a follow-up.'
);
const chatbotModel = env('CHATBOT_OPENAI_MODEL', 'gpt-4o-mini');
const chatbotTemperature = Number(env('CHATBOT_TEMPERATURE', '0.6'));
const chatbotMaxTokens = Number(env('CHATBOT_MAX_TOKENS', '200'));
const chatbotMaxHistory = Number(env('CHATBOT_MAX_HISTORY', '16'));
const chatbotHistoryLimit = Number.isFinite(chatbotMaxHistory) ? chatbotMaxHistory : 16;
const openaiApiKey = env('OPENAI_API_KEY', '');
const openaiApiBase = env('OPENAI_API_BASE', 'https://api.openai.com/v1');

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
    chatbotSessions.set(channel, messages);
  }
  return chatbotSessions.get(channel);
};

const trimChatHistory = (messages) => {
  if (!Array.isArray(messages)) return [];
  const systemMessage =
    messages.length && messages[0] && messages[0].role === 'system' ? messages[0] : null;
  const history = systemMessage ? messages.slice(1) : messages.slice();
  if (history.length <= chatbotHistoryLimit) return messages;
  const trimmed = history.slice(-chatbotHistoryLimit);
  return systemMessage ? [systemMessage, ...trimmed] : trimmed;
};

const extractOpenAIReply = (payload) => {
  if (!payload || typeof payload !== 'object') return '';
  const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
  if (!choice) return '';
  const content = choice.message?.content ?? choice.delta?.content ?? '';
  return typeof content === 'string' ? content.trim() : '';
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

const generateChatbotReply = async (channel, text) => {
  if (!text) return '';
  const session = getChatSession(channel);
  session.push({ role: 'user', content: text });
  const trimmed = trimChatHistory(session);
  if (trimmed !== session) {
    chatbotSessions.set(channel, trimmed);
  }
  const response = await requestOpenAI(trimmed);
  const reply = extractOpenAIReply(response);
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
  generateChatbotReply(channel, text)
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

const port = Number(env('REALTIME_GATEWAY_PORT', '8787'));
app.listen(port, () => {
  console.log(`Realtime gateway listening on :${port} (${provider})`);
});
