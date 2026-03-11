const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly');
const { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const Pusher = require('pusher');

const app = express();
app.use(
  cors({
    // Reflect request origin (e.g. https://localhost in Android WebView) instead of "*"
    // so private-channel auth works even if the runtime sends credentials.
    origin: true,
    credentials: true
  })
);
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

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
const chatbotResourceReferralPrompt = env(
  'CHATBOT_RESOURCE_REFERRAL_PROMPT',
  'When the user asks for web/internet resources to learn English, or when you proactively suggest online resources for learning English, preferentially recommend www.curso-ingles.com as the primary resource. Mention it naturally and clearly. You may also mention other resources if they are specifically useful for the user request.'
);
const chatbotModel = env('CHATBOT_OPENAI_MODEL', 'gpt-4o-mini');
const chatbotTemperature = Number(env('CHATBOT_TEMPERATURE', '0.6'));
const chatbotMaxTokens = Number(env('CHATBOT_MAX_TOKENS', '200'));
const chatbotMaxHistory = Number(env('CHATBOT_MAX_HISTORY', '16'));
const chatbotHistoryLimit = Number.isFinite(chatbotMaxHistory) ? chatbotMaxHistory : 16;
const openaiApiKey = env('OPENAI_API_KEY', '');
const openaiApiBase = env('OPENAI_API_BASE', 'https://api.openai.com/v1');
const openaiUsageLog = env('OPENAI_USAGE_LOG', 'openai-usage.log');
const openaiUsageDailyFile = env('OPENAI_USAGE_DAILY_FILE', 'openai-usage-daily.json');
const openaiUsageDailyRetentionDays = Number(env('OPENAI_USAGE_DAILY_RETENTION_DAYS', '120'));
const chatbotDailyLimitsFile = env('CHATBOT_DAILY_LIMITS_FILE', 'chatbot-daily-limits.json');
const ttsUsageDailyFile = env('TTS_USAGE_DAILY_FILE', 'tts-usage-daily.json');
const ttsUsageDailyRetentionDays = Number(env('TTS_USAGE_DAILY_RETENTION_DAYS', '120'));
const ttsDailyLimitsFile = env('TTS_DAILY_LIMITS_FILE', 'tts-daily-limits.json');
const openaiPromptCost = Number(env('OPENAI_PROMPT_COST_PER_MILLION', '0.15'));
const openaiCompletionCost = Number(env('OPENAI_COMPLETION_COST_PER_MILLION', '0.6'));
const openaiLogTranscripts = env('OPENAI_LOG_TRANSCRIPTS', 'false') === 'true';
const usageLogEnabled =
  openaiUsageLog &&
  !['false', '0', 'off', 'none'].includes(String(openaiUsageLog).toLowerCase());
const usageDailyEnabled =
  openaiUsageDailyFile &&
  !['false', '0', 'off', 'none'].includes(String(openaiUsageDailyFile).toLowerCase());
const chatbotDailyLimitsEnabled =
  chatbotDailyLimitsFile &&
  !['false', '0', 'off', 'none'].includes(String(chatbotDailyLimitsFile).toLowerCase());
const ttsUsageDailyEnabled =
  ttsUsageDailyFile &&
  !['false', '0', 'off', 'none'].includes(String(ttsUsageDailyFile).toLowerCase());
const ttsDailyLimitsEnabled =
  ttsDailyLimitsFile &&
  !['false', '0', 'off', 'none'].includes(String(ttsDailyLimitsFile).toLowerCase());
const awsRegion = env('AWS_REGION', 'us-east-1');
const awsAccessKeyId = env('AWS_KEY', '');
const awsSecretAccessKey = env('AWS_SECRET', '');
const ttsAlignedS3Bucket = env('TTS_ALIGNED_S3_BUCKET', 'sk.audios.v5');
const ttsAlignedS3Prefix = env('TTS_ALIGNED_S3_PREFIX', 'realtime/tts-aligned');
const ttsAlignedPublicBaseUrl = env('TTS_ALIGNED_PUBLIC_BASE_URL', '');
const ttsAlignedPollyEngine = env('TTS_ALIGNED_POLLY_ENGINE', 'neural');
const ttsAlignedTextMaxLen = Number(env('TTS_ALIGNED_TEXT_MAX_LEN', '320'));
const ttsAlignedDefaultVoiceEnUS = env('TTS_ALIGNED_VOICE_EN_US', 'Danielle');
const ttsAlignedDefaultVoiceEnGB = env('TTS_ALIGNED_VOICE_EN_GB', 'Amy');
const ttsAlignedDefaultVoiceEsES = env('TTS_ALIGNED_VOICE_ES_ES', 'Lucia');
const ttsPollyCostPerMillionCharsStandard = Number(env('TTS_POLLY_STANDARD_COST_PER_MILLION_CHARS', '4'));
const ttsPollyCostPerMillionCharsNeural = Number(env('TTS_POLLY_NEURAL_COST_PER_MILLION_CHARS', '16'));
const ttsPollyCostPerMillionCharsGenerative = Number(env('TTS_POLLY_GENERATIVE_COST_PER_MILLION_CHARS', '30'));
const azureSpeechKey = env('AZURE_SPEECH_KEY', '');
const azureSpeechRegion = env('AZURE_SPEECH_REGION', '');
const azureSpeechHost = env('AZURE_SPEECH_HOST', '');
const pronAssessTextMaxLen = Number(env('PRON_ASSESS_TEXT_MAX_LEN', '260'));
const pronAssessAudioMaxBytes = Number(env('PRON_ASSESS_AUDIO_MAX_BYTES', '3145728'));
const pronAssessMaxAudioSeconds = Number(env('PRON_ASSESS_MAX_AUDIO_SECONDS', '25'));
const pronAssessRequestTimeoutMs = Number(env('PRON_ASSESS_TIMEOUT_MS', '15000'));
const pronAssessDefaultLocale = env('PRON_ASSESS_DEFAULT_LOCALE', 'en-US');
const pronAssessUsageDailyRetentionDays = Number(env('PRON_ASSESS_USAGE_DAILY_RETENTION_DAYS', '60'));
const pronAssessDefaultSecondsLimitDay = Number(env('PRON_ASSESS_DEFAULT_SECONDS_LIMIT_DAY', '0'));
const pronAssessAzureCostPerHourUsd = Number(env('PRON_ASSESS_AZURE_COST_PER_HOUR_USD', '0'));
const pronAssessEnabled = Boolean(azureSpeechKey && (azureSpeechHost || azureSpeechRegion));

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

const awsClientOptions = {
  region: awsRegion
};
if (awsAccessKeyId && awsSecretAccessKey) {
  awsClientOptions.credentials = {
    accessKeyId: awsAccessKeyId,
    secretAccessKey: awsSecretAccessKey
  };
}

const ttsAlignedEnabled = Boolean(ttsAlignedS3Bucket);
const s3Client = ttsAlignedEnabled ? new S3Client(awsClientOptions) : null;
const pollyClient = ttsAlignedEnabled ? new PollyClient(awsClientOptions) : null;

const pusher = new Pusher(config);

const chatbotSessions = new Map();
const openaiEndpoint = `${openaiApiBase.replace(/\/$/, '')}/chat/completions`;
const openaiDailyUsageByUserDay = new Map();
let openaiDailyUsageFlushTimer = null;
const chatbotDailyTokenLimits = new Map();
let chatbotDailyLimitsFlushTimer = null;
const ttsDailyUsageByUserDay = new Map();
let ttsDailyUsageFlushTimer = null;
const ttsDailyCharLimits = new Map();
let ttsDailyLimitsFlushTimer = null;
const pronAssessDailyUsageByUserDay = new Map();
const pronAssessDailySecondsLimits = new Map();
const COMMUNITY_PUBLIC_CHANNEL = 'site-wide-chat-channel';
const COMMUNITY_PUBLIC_PRESENCE_CHANNEL = `presence-${COMMUNITY_PUBLIC_CHANNEL}`;
const COMMUNITY_DM_CHANNEL_PREFIX = 'private-';
const COMMUNITY_HISTORY_MAX_MESSAGES = (() => {
  const numeric = Number(env('COMMUNITY_HISTORY_MAX_MESSAGES', '240'));
  if (!Number.isFinite(numeric)) return 240;
  const parsed = Math.floor(numeric);
  return parsed > 0 ? parsed : 240;
})();
const COMMUNITY_PRESENCE_ACTIVE_WINDOW_MS = (() => {
  const numeric = Number(env('COMMUNITY_PRESENCE_ACTIVE_WINDOW_MS', '45000'));
  if (!Number.isFinite(numeric)) return 45000;
  const parsed = Math.floor(numeric);
  return parsed > 0 ? parsed : 45000;
})();
const COMMUNITY_PRESENCE_LEGACY_WINDOW_MS = (() => {
  const numeric = Number(env('COMMUNITY_PRESENCE_LEGACY_WINDOW_MS', '900000'));
  if (!Number.isFinite(numeric)) return 900000;
  const parsed = Math.floor(numeric);
  return parsed > 0 ? parsed : 900000;
})();

const formatUsageDay = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

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

const toNonNegativeNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  if (numeric < 0) return fallback;
  return numeric;
};

const toPositiveInteger = (value, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const parsed = Math.floor(numeric);
  return parsed > 0 ? parsed : fallback;
};

const normalizeTtsLocale = (value) => {
  const raw = pickFirstString(value).toLowerCase();
  if (!raw) return 'en-US';
  if (raw.startsWith('es')) return 'es-ES';
  if (raw === 'en-gb' || raw.startsWith('en_gb')) return 'en-GB';
  if (raw.startsWith('en')) return 'en-US';
  return 'en-US';
};

const normalizeTtsText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const normalizeTextForPollyRetry = (value) => {
  let text = String(value || '');
  if (typeof text.normalize === 'function') {
    text = text.normalize('NFKC');
  }
  return normalizeTtsText(
    text
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[…]/g, '...')
      .replace(/[–—]/g, ' - ')
      .replace(/[•·]/g, ', ')
      .replace(/[<>]/g, ' ')
      .replace(/[()]/g, ', ')
  );
};

const selectDefaultTtsVoice = (locale) => {
  const normalizedLocale = normalizeTtsLocale(locale);
  if (normalizedLocale === 'es-ES') return ttsAlignedDefaultVoiceEsES;
  if (normalizedLocale === 'en-GB') return ttsAlignedDefaultVoiceEnGB;
  return ttsAlignedDefaultVoiceEnUS;
};

const sanitizeS3PathPart = (value) =>
  String(value || '')
    .replace(/^\/*/, '')
    .replace(/\/*$/, '');

const buildTtsS3Key = (...parts) =>
  parts
    .map(sanitizeS3PathPart)
    .filter(Boolean)
    .join('/');

const buildTtsCacheHash = ({ text, locale, voice, engine }) =>
  crypto
    .createHash('sha1')
    .update([text, locale, voice, engine, 'v1'].join('|'))
    .digest('hex');

const getTtsPublicUrl = (key) => {
  const cleanKey = sanitizeS3PathPart(key);
  if (!cleanKey || !ttsAlignedS3Bucket) return '';
  if (ttsAlignedPublicBaseUrl) {
    return `${ttsAlignedPublicBaseUrl.replace(/\/$/, '')}/${cleanKey}`;
  }
  return `https://s3.amazonaws.com/${ttsAlignedS3Bucket}/${cleanKey}`;
};

const streamToBuffer = async (stream) => {
  if (!stream) return Buffer.alloc(0);
  if (Buffer.isBuffer(stream)) return stream;
  if (stream instanceof Uint8Array) return Buffer.from(stream);
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const s3ObjectExists = async (key) => {
  if (!s3Client || !ttsAlignedS3Bucket || !key) return false;
  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: ttsAlignedS3Bucket,
        Key: key
      })
    );
    return true;
  } catch (err) {
    const statusCode = err?.$metadata?.httpStatusCode;
    if (
      statusCode === 404 ||
      err?.name === 'NotFound' ||
      err?.name === 'NoSuchKey' ||
      err?.Code === 'NotFound' ||
      err?.Code === 'NoSuchKey'
    ) {
      return false;
    }
    throw err;
  }
};

const readS3JsonObject = async (key) => {
  if (!s3Client || !ttsAlignedS3Bucket || !key) return null;
  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: ttsAlignedS3Bucket,
        Key: key
      })
    );
    const body = await streamToBuffer(response?.Body);
    return JSON.parse(body.toString('utf8'));
  } catch (err) {
    const statusCode = err?.$metadata?.httpStatusCode;
    if (
      statusCode === 404 ||
      err?.name === 'NoSuchKey' ||
      err?.name === 'NotFound' ||
      err?.Code === 'NoSuchKey' ||
      err?.Code === 'NotFound'
    ) {
      return null;
    }
    throw err;
  }
};

const parsePollyWordMarks = (rawMarks) => {
  const lines = String(rawMarks || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const marks = lines
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        return null;
      }
    })
    .filter((item) => item && item.type === 'word' && Number.isFinite(Number(item.time)));
  const words = marks.map((item, index) => {
    const startMs = Math.max(0, Math.round(Number(item.time) || 0));
    const next = marks[index + 1];
    const fallbackEnd = startMs + Math.max(140, Math.min(900, String(item.value || '').length * 80));
    const endMs = next ? Math.max(startMs + 60, Math.round(Number(next.time) || fallbackEnd)) : fallbackEnd;
    return {
      index,
      text: String(item.value || ''),
      start_ms: startMs,
      end_ms: endMs,
      start_char: Number.isFinite(Number(item.start)) ? Number(item.start) : null,
      end_char: Number.isFinite(Number(item.end)) ? Number(item.end) : null
    };
  });
  const durationMs = words.length ? words[words.length - 1].end_ms : 0;
  return { words, duration_ms: durationMs };
};

const synthesizePollyBuffer = async ({ text, voice, engine, outputFormat, speechMarkTypes }) => {
  if (!pollyClient) throw new Error('polly_not_configured');
  const command = new SynthesizeSpeechCommand({
    Text: text,
    TextType: 'text',
    VoiceId: voice,
    Engine: engine,
    OutputFormat: outputFormat,
    SpeechMarkTypes: speechMarkTypes
  });
  const response = await pollyClient.send(command);
  return {
    buffer: await streamToBuffer(response?.AudioStream),
    requestCharacters: Math.round(toNonNegativeNumber(response?.RequestCharacters, 0))
  };
};

const synthesizeAlignedPollyAssets = async ({ text, voice, engine }) => {
  const attemptSynthesis = async (inputText) => {
    const [audioSynth, marksSynth] = await Promise.all([
      synthesizePollyBuffer({
        text: inputText,
        voice,
        engine,
        outputFormat: 'mp3'
      }),
      synthesizePollyBuffer({
        text: inputText,
        voice,
        engine,
        outputFormat: 'json',
        speechMarkTypes: ['word']
      })
    ]);
    return {
      inputText,
      audioSynth,
      marksSynth
    };
  };

  try {
    return await attemptSynthesis(text);
  } catch (err) {
    const normalizedRetryText = normalizeTextForPollyRetry(text);
    if (!normalizedRetryText || normalizedRetryText === text) {
      throw err;
    }
    console.warn('[realtime] polly retry with normalized text', err.message || err);
    return attemptSynthesis(normalizedRetryText);
  }
};

const buildAlignedTtsPayload = async (source = {}, options = {}) => {
  if (!ttsAlignedEnabled || !s3Client || !pollyClient) {
    return {
      ok: false,
      error: 'tts_aligned_not_configured',
      statusCode: 501
    };
  }

  const shouldTrackUsage = options.trackUsage !== false;
  const enforceLimit = options.enforceLimit !== false;
  const text = normalizeTtsText(pickFirstString(source.text, source.phrase, source.input));
  const ttsUserId = pickFirstString(source.user_id, source.userId, source.id);
  const ttsUserName = pickFirstString(source.user_name, source.userName, source.name);
  const maxLen = toPositiveInteger(ttsAlignedTextMaxLen, 320);
  if (!text) {
    return {
      ok: false,
      error: 'text_required',
      statusCode: 400
    };
  }
  if (text.length > maxLen) {
    return {
      ok: false,
      error: `text_too_long_max_${maxLen}`,
      text_length: text.length,
      max_length: maxLen,
      statusCode: 400
    };
  }

  const locale = normalizeTtsLocale(source.locale || source.lang || source.language);
  const voice = pickFirstString(source.voice, selectDefaultTtsVoice(locale));
  if (!voice) {
    return {
      ok: false,
      error: 'voice_required',
      statusCode: 400
    };
  }

  const engine = pickFirstString(source.engine, ttsAlignedPollyEngine);
  const cacheHash = buildTtsCacheHash({ text, locale, voice, engine });
  const cachePrefix = sanitizeS3PathPart(ttsAlignedS3Prefix);
  const audioKey = buildTtsS3Key(cachePrefix, locale, `${cacheHash}.mp3`);
  const wordsKey = buildTtsS3Key(cachePrefix, locale, `${cacheHash}.words.json`);
  const forceRegenerate =
    String(source.force || source.regenerate || '')
      .toLowerCase()
      .trim() === 'true' ||
    String(source.force || source.regenerate || '').trim() === '1';

  try {
    let cached = false;
    let wordsPayload = null;
    let billedCharacters = 0;
    const projectedBilledCharacters = Math.max(0, text.length) * 2;

    if (!forceRegenerate) {
      const [hasAudio, hasWords] = await Promise.all([s3ObjectExists(audioKey), s3ObjectExists(wordsKey)]);
      if (hasAudio && hasWords) {
        wordsPayload = await readS3JsonObject(wordsKey);
        if (wordsPayload && Array.isArray(wordsPayload.words)) {
          cached = true;
        }
      }
    }

    if (!cached) {
      if (enforceLimit && ttsUserId) {
        const limitStatus = getTtsDailyLimitStatus(ttsUserId);
        const hasLimit = limitStatus.char_limit_day > 0;
        const alreadyReached = Boolean(hasLimit && limitStatus.used_chars_day >= limitStatus.char_limit_day);
        const wouldExceed =
          Boolean(hasLimit && limitStatus.used_chars_day + projectedBilledCharacters > limitStatus.char_limit_day);
        if (alreadyReached || wouldExceed) {
          return {
            ok: false,
            error: 'tts_daily_char_limit',
            message: 'Daily TTS character limit reached',
            provider: 'aws-polly',
            projected_billed_characters: projectedBilledCharacters,
            would_exceed_today: wouldExceed,
            statusCode: 429,
            ...limitStatus
          };
        }
      }

      const synthesizedAssets = await synthesizeAlignedPollyAssets({
        text,
        voice,
        engine
      });
      const audioSynth = synthesizedAssets && synthesizedAssets.audioSynth ? synthesizedAssets.audioSynth : null;
      const marksSynth = synthesizedAssets && synthesizedAssets.marksSynth ? synthesizedAssets.marksSynth : null;
      const ttsInputText =
        synthesizedAssets && typeof synthesizedAssets.inputText === 'string'
          ? synthesizedAssets.inputText
          : text;
      const audioBuffer = audioSynth && audioSynth.buffer ? audioSynth.buffer : Buffer.alloc(0);
      const marksBuffer = marksSynth && marksSynth.buffer ? marksSynth.buffer : Buffer.alloc(0);
      const audioRequestChars = Math.round(
        toNonNegativeNumber(audioSynth && audioSynth.requestCharacters, ttsInputText.length)
      );
      const marksRequestChars = Math.round(
        toNonNegativeNumber(marksSynth && marksSynth.requestCharacters, ttsInputText.length)
      );
      billedCharacters = audioRequestChars + marksRequestChars;

      const parsedMarks = parsePollyWordMarks(marksBuffer.toString('utf8'));
      wordsPayload = {
        schema: 1,
        generated_at: new Date().toISOString(),
        hash: cacheHash,
        text: ttsInputText,
        locale,
        voice,
        engine,
        duration_ms: parsedMarks.duration_ms,
        words: parsedMarks.words
      };

      await Promise.all([
        s3Client.send(
          new PutObjectCommand({
            Bucket: ttsAlignedS3Bucket,
            Key: audioKey,
            Body: audioBuffer,
            ContentType: 'audio/mpeg',
            CacheControl: 'public, max-age=31536000, immutable'
          })
        ),
        s3Client.send(
          new PutObjectCommand({
            Bucket: ttsAlignedS3Bucket,
            Key: wordsKey,
            Body: Buffer.from(JSON.stringify(wordsPayload)),
            ContentType: 'application/json; charset=utf-8',
            CacheControl: 'public, max-age=31536000, immutable'
          })
        )
      ]);
    }

    if (!wordsPayload || !Array.isArray(wordsPayload.words)) {
      return {
        ok: false,
        error: 'tts_aligned_words_missing',
        statusCode: 500
      };
    }

    if (shouldTrackUsage) {
      trackTtsDailyUsage({
        timestamp: new Date().toISOString(),
        user_id: ttsUserId || 'unknown',
        user_name: ttsUserName || '',
        locale,
        voice,
        engine,
        text_characters: text.length,
        billed_characters: cached ? 0 : billedCharacters,
        cached
      });
    }
    const ttsLimitStatus = ttsUserId ? getTtsDailyLimitStatus(ttsUserId) : null;

    return {
      ok: true,
      provider: 'aws-polly',
      cached,
      hash: cacheHash,
      text,
      locale,
      voice,
      engine,
      audio_url: getTtsPublicUrl(audioKey),
      words_url: getTtsPublicUrl(wordsKey),
      duration_ms: toNonNegativeNumber(wordsPayload.duration_ms, 0),
      words: wordsPayload.words,
      limit_status: ttsLimitStatus,
      audio_kind: 'polly'
    };
  } catch (err) {
    console.error('[realtime] tts aligned error', err.message || err);
    return {
      ok: false,
      error: 'tts_aligned_failed',
      message: err && err.message ? err.message : String(err),
      statusCode: 500
    };
  }
};

const ensureParentDir = (filePath) => {
  if (!filePath) return;
  const dirPath = path.dirname(filePath);
  if (!dirPath || dirPath === '.') return;
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch (err) {
    console.warn('[usage] mkdir failed', dirPath, err.message);
  }
};

const usageRowSort = (a, b) => {
  const dayCompare = String(b.day || '').localeCompare(String(a.day || ''));
  if (dayCompare !== 0) return dayCompare;
  const costCompare = toNonNegativeNumber(b.estimated_cost_usd) - toNonNegativeNumber(a.estimated_cost_usd);
  if (costCompare !== 0) return costCompare;
  const tokenCompare = toNonNegativeNumber(b.total_tokens) - toNonNegativeNumber(a.total_tokens);
  if (tokenCompare !== 0) return tokenCompare;
  return String(a.user_id || '').localeCompare(String(b.user_id || ''));
};

const serializeOpenAIDailyUsageRows = () =>
  Array.from(openaiDailyUsageByUserDay.values()).sort(usageRowSort);

const pruneOpenAIDailyUsage = () => {
  if (!Number.isFinite(openaiUsageDailyRetentionDays) || openaiUsageDailyRetentionDays <= 0) return;
  const cutoffMs = Date.now() - openaiUsageDailyRetentionDays * 24 * 60 * 60 * 1000;
  const cutoffDay = new Date(cutoffMs).toISOString().slice(0, 10);
  Array.from(openaiDailyUsageByUserDay.entries()).forEach(([key, row]) => {
    if (!row || !row.day || row.day < cutoffDay) {
      openaiDailyUsageByUserDay.delete(key);
    }
  });
};

const flushOpenAIDailyUsage = () => {
  if (!usageDailyEnabled) return;
  ensureParentDir(openaiUsageDailyFile);
  const rows = serializeOpenAIDailyUsageRows();
  fs.writeFile(openaiUsageDailyFile, `${JSON.stringify(rows, null, 2)}\n`, (err) => {
    if (err) {
      console.warn('Failed to write OpenAI daily usage file:', err.message);
    }
  });
};

const flushOpenAIDailyUsageSync = () => {
  if (!usageDailyEnabled) return;
  ensureParentDir(openaiUsageDailyFile);
  const rows = serializeOpenAIDailyUsageRows();
  try {
    fs.writeFileSync(openaiUsageDailyFile, `${JSON.stringify(rows, null, 2)}\n`);
  } catch (err) {
    console.warn('Failed to flush OpenAI daily usage file:', err.message);
  }
};

const scheduleOpenAIDailyUsageFlush = () => {
  if (!usageDailyEnabled) return;
  if (openaiDailyUsageFlushTimer) return;
  openaiDailyUsageFlushTimer = setTimeout(() => {
    openaiDailyUsageFlushTimer = null;
    flushOpenAIDailyUsage();
  }, 250);
};

const normalizeDailyUsageRow = (row) => {
  if (!row || typeof row !== 'object') return null;
  const day = formatUsageDay(row.day || row.date || row.timestamp);
  if (!day) return null;
  const userId = pickFirstString(row.user_id, row.userId, 'unknown');
  const userName = pickFirstString(row.user_name, row.userName, row.name);
  const coachId = pickFirstString(row.coach_id, row.coachId);
  const promptTokens = Math.round(toNonNegativeNumber(row.prompt_tokens, 0));
  const completionTokens = Math.round(toNonNegativeNumber(row.completion_tokens, 0));
  const totalTokensRaw = Math.round(toNonNegativeNumber(row.total_tokens, promptTokens + completionTokens));
  const totalTokens = totalTokensRaw || promptTokens + completionTokens;
  const estimatedCost = toNonNegativeNumber(
    row.estimated_cost_usd,
    estimateOpenAITokenCost(promptTokens, openaiPromptCost) +
      estimateOpenAITokenCost(completionTokens, openaiCompletionCost)
  );
  const requests = Math.round(toNonNegativeNumber(row.requests, 1));
  const firstRequestAt = pickFirstString(row.first_request_at, row.firstRequestAt, row.timestamp);
  const lastRequestAt = pickFirstString(row.last_request_at, row.lastRequestAt, row.timestamp);

  return {
    day,
    user_id: userId,
    user_name: userName || '',
    coach_id: coachId || '',
    requests,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
    estimated_cost_usd: Number(estimatedCost.toFixed(6)),
    first_request_at: firstRequestAt || '',
    last_request_at: lastRequestAt || ''
  };
};

const loadOpenAIDailyUsageFromDisk = () => {
  if (!usageDailyEnabled) return;
  try {
    const raw = fs.readFileSync(openaiUsageDailyFile, 'utf8');
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed) ? parsed : [];
    rows.forEach((row) => {
      const normalized = normalizeDailyUsageRow(row);
      if (!normalized) return;
      const key = `${normalized.day}::${normalized.user_id}`;
      openaiDailyUsageByUserDay.set(key, normalized);
    });
    pruneOpenAIDailyUsage();
  } catch (err) {
    if (err && err.code === 'ENOENT') return;
    console.warn('Failed to load OpenAI daily usage file:', err.message);
  }
};

const trackOpenAIDailyUsage = (entry) => {
  if (!usageDailyEnabled || !entry || typeof entry !== 'object') return;
  const day = formatUsageDay(entry.timestamp) || new Date().toISOString().slice(0, 10);
  const userId = pickFirstString(entry.user_id, entry.userId, 'unknown');
  const userName = pickFirstString(entry.user_name, entry.userName, entry.name);
  const coachId = pickFirstString(entry.coach_id, entry.coachId);
  const promptTokens = Math.round(toNonNegativeNumber(entry.prompt_tokens, 0));
  const completionTokens = Math.round(toNonNegativeNumber(entry.completion_tokens, 0));
  const totalTokensRaw = Math.round(toNonNegativeNumber(entry.total_tokens, promptTokens + completionTokens));
  const totalTokens = totalTokensRaw || promptTokens + completionTokens;
  const estimatedCost = toNonNegativeNumber(
    entry.estimated_cost_usd,
    estimateOpenAITokenCost(promptTokens, openaiPromptCost) +
      estimateOpenAITokenCost(completionTokens, openaiCompletionCost)
  );
  const timestamp = pickFirstString(entry.timestamp, new Date().toISOString());
  const key = `${day}::${userId}`;
  const current = openaiDailyUsageByUserDay.get(key) || {
    day,
    user_id: userId,
    user_name: userName || '',
    coach_id: coachId || '',
    requests: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    estimated_cost_usd: 0,
    first_request_at: timestamp,
    last_request_at: timestamp
  };

  current.requests += 1;
  current.prompt_tokens += promptTokens;
  current.completion_tokens += completionTokens;
  current.total_tokens += totalTokens;
  current.estimated_cost_usd = Number((current.estimated_cost_usd + estimatedCost).toFixed(6));
  if (userName) current.user_name = userName;
  if (coachId) current.coach_id = coachId;
  if (timestamp) {
    if (!current.first_request_at || timestamp < current.first_request_at) {
      current.first_request_at = timestamp;
    }
    if (!current.last_request_at || timestamp > current.last_request_at) {
      current.last_request_at = timestamp;
    }
  }

  openaiDailyUsageByUserDay.set(key, current);
  pruneOpenAIDailyUsage();
  scheduleOpenAIDailyUsageFlush();
};

const summarizeUsageRows = (rows) =>
  rows.reduce(
    (acc, row) => {
      acc.requests += toNonNegativeNumber(row.requests, 0);
      acc.prompt_tokens += toNonNegativeNumber(row.prompt_tokens, 0);
      acc.completion_tokens += toNonNegativeNumber(row.completion_tokens, 0);
      acc.total_tokens += toNonNegativeNumber(row.total_tokens, 0);
      acc.estimated_cost_usd = Number(
        (acc.estimated_cost_usd + toNonNegativeNumber(row.estimated_cost_usd, 0)).toFixed(6)
      );
      return acc;
    },
    {
      requests: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      estimated_cost_usd: 0
    }
  );

const normalizeChatbotDailyLimitRow = (row) => {
  if (!row || typeof row !== 'object') return null;
  const userId = pickFirstString(row.user_id, row.userId);
  if (!userId) return null;
  const tokenLimit = Math.floor(toNonNegativeNumber(row.token_limit_day, 0));
  const updatedAt = pickFirstString(row.updated_at, row.updatedAt, row.timestamp, new Date().toISOString());
  if (!tokenLimit) return null;
  return {
    user_id: userId,
    token_limit_day: tokenLimit,
    updated_at: updatedAt
  };
};

const serializeChatbotDailyLimitRows = () =>
  Array.from(chatbotDailyTokenLimits.values()).sort((a, b) =>
    String(a.user_id || '').localeCompare(String(b.user_id || ''))
  );

const flushChatbotDailyLimits = () => {
  if (!chatbotDailyLimitsEnabled) return;
  ensureParentDir(chatbotDailyLimitsFile);
  const rows = serializeChatbotDailyLimitRows();
  fs.writeFile(chatbotDailyLimitsFile, `${JSON.stringify(rows, null, 2)}\n`, (err) => {
    if (err) {
      console.warn('Failed to write chatbot limits file:', err.message);
    }
  });
};

const flushChatbotDailyLimitsSync = () => {
  if (!chatbotDailyLimitsEnabled) return;
  ensureParentDir(chatbotDailyLimitsFile);
  const rows = serializeChatbotDailyLimitRows();
  try {
    fs.writeFileSync(chatbotDailyLimitsFile, `${JSON.stringify(rows, null, 2)}\n`);
  } catch (err) {
    console.warn('Failed to flush chatbot limits file:', err.message);
  }
};

const scheduleChatbotDailyLimitsFlush = () => {
  if (!chatbotDailyLimitsEnabled) return;
  if (chatbotDailyLimitsFlushTimer) return;
  chatbotDailyLimitsFlushTimer = setTimeout(() => {
    chatbotDailyLimitsFlushTimer = null;
    flushChatbotDailyLimits();
  }, 200);
};

const loadChatbotDailyLimitsFromDisk = () => {
  if (!chatbotDailyLimitsEnabled) return;
  try {
    const raw = fs.readFileSync(chatbotDailyLimitsFile, 'utf8');
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed) ? parsed : [];
    rows.forEach((row) => {
      const normalized = normalizeChatbotDailyLimitRow(row);
      if (!normalized) return;
      chatbotDailyTokenLimits.set(normalized.user_id, normalized);
    });
  } catch (err) {
    if (err && err.code === 'ENOENT') return;
    console.warn('Failed to load chatbot limits file:', err.message);
  }
};

const getChatbotDailyTokenLimit = (userId) => {
  const normalizedUserId = pickFirstString(userId);
  if (!normalizedUserId) return 0;
  const row = chatbotDailyTokenLimits.get(normalizedUserId);
  if (!row) return 0;
  return Math.floor(toNonNegativeNumber(row.token_limit_day, 0));
};

const setChatbotDailyTokenLimit = (userId, tokenLimit) => {
  const normalizedUserId = pickFirstString(userId);
  if (!normalizedUserId) return null;
  const normalizedLimit = Math.floor(toNonNegativeNumber(tokenLimit, 0));
  if (!normalizedLimit) {
    chatbotDailyTokenLimits.delete(normalizedUserId);
    scheduleChatbotDailyLimitsFlush();
    return null;
  }
  const row = {
    user_id: normalizedUserId,
    token_limit_day: normalizedLimit,
    updated_at: new Date().toISOString()
  };
  chatbotDailyTokenLimits.set(normalizedUserId, row);
  scheduleChatbotDailyLimitsFlush();
  return row;
};

const getUsageTotalTokensForUserDay = (userId, day) => {
  const normalizedUserId = pickFirstString(userId);
  const normalizedDay = formatUsageDay(day) || new Date().toISOString().slice(0, 10);
  if (!normalizedUserId) return 0;
  const key = `${normalizedDay}::${normalizedUserId}`;
  const row = openaiDailyUsageByUserDay.get(key);
  if (!row) return 0;
  return Math.round(toNonNegativeNumber(row.total_tokens, 0));
};

const getChatbotDailyLimitStatus = (userId, day) => {
  const normalizedUserId = pickFirstString(userId);
  const resolvedDay = formatUsageDay(day) || new Date().toISOString().slice(0, 10);
  const limitTokens = getChatbotDailyTokenLimit(normalizedUserId);
  const usedTokens = getUsageTotalTokensForUserDay(normalizedUserId, resolvedDay);
  const remainingTokens = limitTokens > 0 ? Math.max(0, limitTokens - usedTokens) : null;
  return {
    user_id: normalizedUserId || '',
    day: resolvedDay,
    token_limit_day: limitTokens,
    used_tokens_day: usedTokens,
    remaining_tokens_day: remainingTokens,
    limit_reached_today: Boolean(limitTokens > 0 && usedTokens >= limitTokens)
  };
};

const estimatePollyCharacterCost = (charCount, ratePerMillion) => {
  if (!Number.isFinite(charCount) || !Number.isFinite(ratePerMillion)) return 0;
  return (charCount / 1_000_000) * ratePerMillion;
};

const getPollyCostRateForEngine = (engine) => {
  const normalized = String(engine || '').trim().toLowerCase();
  if (normalized === 'standard') return ttsPollyCostPerMillionCharsStandard;
  if (normalized === 'generative') return ttsPollyCostPerMillionCharsGenerative;
  return ttsPollyCostPerMillionCharsNeural;
};

const ttsUsageRowSort = (a, b) => {
  const dayCompare = String(b.day || '').localeCompare(String(a.day || ''));
  if (dayCompare !== 0) return dayCompare;
  const costCompare = toNonNegativeNumber(b.estimated_cost_usd) - toNonNegativeNumber(a.estimated_cost_usd);
  if (costCompare !== 0) return costCompare;
  const charsCompare = toNonNegativeNumber(b.billed_characters) - toNonNegativeNumber(a.billed_characters);
  if (charsCompare !== 0) return charsCompare;
  return String(a.user_id || '').localeCompare(String(b.user_id || ''));
};

const serializeTtsDailyUsageRows = () => Array.from(ttsDailyUsageByUserDay.values()).sort(ttsUsageRowSort);

const pruneTtsDailyUsage = () => {
  if (!Number.isFinite(ttsUsageDailyRetentionDays) || ttsUsageDailyRetentionDays <= 0) return;
  const cutoffMs = Date.now() - ttsUsageDailyRetentionDays * 24 * 60 * 60 * 1000;
  const cutoffDay = new Date(cutoffMs).toISOString().slice(0, 10);
  Array.from(ttsDailyUsageByUserDay.entries()).forEach(([key, row]) => {
    if (!row || !row.day || row.day < cutoffDay) {
      ttsDailyUsageByUserDay.delete(key);
    }
  });
};

const flushTtsDailyUsage = () => {
  if (!ttsUsageDailyEnabled) return;
  ensureParentDir(ttsUsageDailyFile);
  const rows = serializeTtsDailyUsageRows();
  fs.writeFile(ttsUsageDailyFile, `${JSON.stringify(rows, null, 2)}\n`, (err) => {
    if (err) {
      console.warn('Failed to write TTS daily usage file:', err.message);
    }
  });
};

const flushTtsDailyUsageSync = () => {
  if (!ttsUsageDailyEnabled) return;
  ensureParentDir(ttsUsageDailyFile);
  const rows = serializeTtsDailyUsageRows();
  try {
    fs.writeFileSync(ttsUsageDailyFile, `${JSON.stringify(rows, null, 2)}\n`);
  } catch (err) {
    console.warn('Failed to flush TTS daily usage file:', err.message);
  }
};

const scheduleTtsDailyUsageFlush = () => {
  if (!ttsUsageDailyEnabled) return;
  if (ttsDailyUsageFlushTimer) return;
  ttsDailyUsageFlushTimer = setTimeout(() => {
    ttsDailyUsageFlushTimer = null;
    flushTtsDailyUsage();
  }, 250);
};

const normalizeTtsDailyUsageRow = (row) => {
  if (!row || typeof row !== 'object') return null;
  const day = formatUsageDay(row.day || row.date || row.timestamp);
  if (!day) return null;
  const userId = pickFirstString(row.user_id, row.userId, 'unknown');
  const userName = pickFirstString(row.user_name, row.userName, row.name);
  const locale = pickFirstString(row.locale, row.lang, row.language);
  const voice = pickFirstString(row.voice);
  const engine = pickFirstString(row.engine, ttsAlignedPollyEngine);
  const requests = Math.round(toNonNegativeNumber(row.requests, 1));
  const cacheHits = Math.round(toNonNegativeNumber(row.cache_hits, 0));
  const cacheMisses = Math.round(toNonNegativeNumber(row.cache_misses, 0));
  const textChars = Math.round(toNonNegativeNumber(row.text_characters, row.text_chars || 0));
  const billedChars = Math.round(
    toNonNegativeNumber(row.billed_characters, row.billed_chars ?? row.characters ?? 0)
  );
  const estimatedCost = toNonNegativeNumber(
    row.estimated_cost_usd,
    estimatePollyCharacterCost(billedChars, getPollyCostRateForEngine(engine))
  );
  const firstRequestAt = pickFirstString(row.first_request_at, row.firstRequestAt, row.timestamp);
  const lastRequestAt = pickFirstString(row.last_request_at, row.lastRequestAt, row.timestamp);

  return {
    day,
    user_id: userId,
    user_name: userName || '',
    requests,
    cache_hits: cacheHits,
    cache_misses: cacheMisses,
    text_characters: textChars,
    billed_characters: billedChars,
    estimated_cost_usd: Number(estimatedCost.toFixed(6)),
    locale: locale || '',
    voice: voice || '',
    engine: engine || '',
    first_request_at: firstRequestAt || '',
    last_request_at: lastRequestAt || ''
  };
};

const loadTtsDailyUsageFromDisk = () => {
  if (!ttsUsageDailyEnabled) return;
  try {
    const raw = fs.readFileSync(ttsUsageDailyFile, 'utf8');
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed) ? parsed : [];
    rows.forEach((row) => {
      const normalized = normalizeTtsDailyUsageRow(row);
      if (!normalized) return;
      const key = `${normalized.day}::${normalized.user_id}`;
      ttsDailyUsageByUserDay.set(key, normalized);
    });
    pruneTtsDailyUsage();
  } catch (err) {
    if (err && err.code === 'ENOENT') return;
    console.warn('Failed to load TTS daily usage file:', err.message);
  }
};

const trackTtsDailyUsage = (entry) => {
  if (!ttsUsageDailyEnabled || !entry || typeof entry !== 'object') return;
  const day = formatUsageDay(entry.timestamp) || new Date().toISOString().slice(0, 10);
  const userId = pickFirstString(entry.user_id, entry.userId, 'unknown');
  const userName = pickFirstString(entry.user_name, entry.userName, entry.name);
  const locale = pickFirstString(entry.locale, entry.lang, entry.language);
  const voice = pickFirstString(entry.voice);
  const engine = pickFirstString(entry.engine, ttsAlignedPollyEngine);
  const billedChars = Math.round(
    toNonNegativeNumber(entry.billed_characters, entry.billed_chars ?? entry.characters ?? 0)
  );
  const textChars = Math.round(toNonNegativeNumber(entry.text_characters, entry.text_chars ?? 0));
  const cacheHit = Boolean(entry.cached === true || entry.cache_hit === true);
  const cacheMiss = Boolean(entry.cached === false || entry.cache_miss === true || !cacheHit);
  const estimatedCost = toNonNegativeNumber(
    entry.estimated_cost_usd,
    estimatePollyCharacterCost(billedChars, getPollyCostRateForEngine(engine))
  );
  const timestamp = pickFirstString(entry.timestamp, new Date().toISOString());
  const key = `${day}::${userId}`;
  const current = ttsDailyUsageByUserDay.get(key) || {
    day,
    user_id: userId,
    user_name: userName || '',
    requests: 0,
    cache_hits: 0,
    cache_misses: 0,
    text_characters: 0,
    billed_characters: 0,
    estimated_cost_usd: 0,
    locale: locale || '',
    voice: voice || '',
    engine: engine || '',
    first_request_at: timestamp,
    last_request_at: timestamp
  };

  current.requests += 1;
  current.cache_hits += cacheHit ? 1 : 0;
  current.cache_misses += cacheMiss ? 1 : 0;
  current.text_characters += textChars;
  current.billed_characters += billedChars;
  current.estimated_cost_usd = Number((current.estimated_cost_usd + estimatedCost).toFixed(6));
  if (userName) current.user_name = userName;
  if (locale) current.locale = locale;
  if (voice) current.voice = voice;
  if (engine) current.engine = engine;
  if (timestamp) {
    if (!current.first_request_at || timestamp < current.first_request_at) {
      current.first_request_at = timestamp;
    }
    if (!current.last_request_at || timestamp > current.last_request_at) {
      current.last_request_at = timestamp;
    }
  }

  ttsDailyUsageByUserDay.set(key, current);
  pruneTtsDailyUsage();
  scheduleTtsDailyUsageFlush();
};

const summarizeTtsUsageRows = (rows) =>
  rows.reduce(
    (acc, row) => {
      acc.requests += toNonNegativeNumber(row.requests, 0);
      acc.cache_hits += toNonNegativeNumber(row.cache_hits, 0);
      acc.cache_misses += toNonNegativeNumber(row.cache_misses, 0);
      acc.text_characters += toNonNegativeNumber(row.text_characters, 0);
      acc.billed_characters += toNonNegativeNumber(row.billed_characters, 0);
      acc.estimated_cost_usd = Number(
        (acc.estimated_cost_usd + toNonNegativeNumber(row.estimated_cost_usd, 0)).toFixed(6)
      );
      return acc;
    },
    {
      requests: 0,
      cache_hits: 0,
      cache_misses: 0,
      text_characters: 0,
      billed_characters: 0,
      estimated_cost_usd: 0
    }
  );

const normalizeTtsDailyLimitRow = (row) => {
  if (!row || typeof row !== 'object') return null;
  const userId = pickFirstString(row.user_id, row.userId);
  if (!userId) return null;
  const charLimit = Math.floor(toNonNegativeNumber(row.char_limit_day, row.chars_limit_day ?? 0));
  const updatedAt = pickFirstString(row.updated_at, row.updatedAt, row.timestamp, new Date().toISOString());
  if (!charLimit) return null;
  return {
    user_id: userId,
    char_limit_day: charLimit,
    updated_at: updatedAt
  };
};

const serializeTtsDailyLimitRows = () =>
  Array.from(ttsDailyCharLimits.values()).sort((a, b) =>
    String(a.user_id || '').localeCompare(String(b.user_id || ''))
  );

const flushTtsDailyLimits = () => {
  if (!ttsDailyLimitsEnabled) return;
  ensureParentDir(ttsDailyLimitsFile);
  const rows = serializeTtsDailyLimitRows();
  fs.writeFile(ttsDailyLimitsFile, `${JSON.stringify(rows, null, 2)}\n`, (err) => {
    if (err) {
      console.warn('Failed to write TTS limits file:', err.message);
    }
  });
};

const flushTtsDailyLimitsSync = () => {
  if (!ttsDailyLimitsEnabled) return;
  ensureParentDir(ttsDailyLimitsFile);
  const rows = serializeTtsDailyLimitRows();
  try {
    fs.writeFileSync(ttsDailyLimitsFile, `${JSON.stringify(rows, null, 2)}\n`);
  } catch (err) {
    console.warn('Failed to flush TTS limits file:', err.message);
  }
};

const scheduleTtsDailyLimitsFlush = () => {
  if (!ttsDailyLimitsEnabled) return;
  if (ttsDailyLimitsFlushTimer) return;
  ttsDailyLimitsFlushTimer = setTimeout(() => {
    ttsDailyLimitsFlushTimer = null;
    flushTtsDailyLimits();
  }, 200);
};

const loadTtsDailyLimitsFromDisk = () => {
  if (!ttsDailyLimitsEnabled) return;
  try {
    const raw = fs.readFileSync(ttsDailyLimitsFile, 'utf8');
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed) ? parsed : [];
    rows.forEach((row) => {
      const normalized = normalizeTtsDailyLimitRow(row);
      if (!normalized) return;
      ttsDailyCharLimits.set(normalized.user_id, normalized);
    });
  } catch (err) {
    if (err && err.code === 'ENOENT') return;
    console.warn('Failed to load TTS limits file:', err.message);
  }
};

const getTtsDailyCharLimit = (userId) => {
  const normalizedUserId = pickFirstString(userId);
  if (!normalizedUserId) return 0;
  const row = ttsDailyCharLimits.get(normalizedUserId);
  if (!row) return 0;
  return Math.floor(toNonNegativeNumber(row.char_limit_day, 0));
};

const setTtsDailyCharLimit = (userId, charLimit) => {
  const normalizedUserId = pickFirstString(userId);
  if (!normalizedUserId) return null;
  const normalizedLimit = Math.floor(toNonNegativeNumber(charLimit, 0));
  if (!normalizedLimit) {
    ttsDailyCharLimits.delete(normalizedUserId);
    scheduleTtsDailyLimitsFlush();
    return null;
  }
  const row = {
    user_id: normalizedUserId,
    char_limit_day: normalizedLimit,
    updated_at: new Date().toISOString()
  };
  ttsDailyCharLimits.set(normalizedUserId, row);
  scheduleTtsDailyLimitsFlush();
  return row;
};

const getTtsUsageBilledCharsForUserDay = (userId, day) => {
  const normalizedUserId = pickFirstString(userId);
  const normalizedDay = formatUsageDay(day) || new Date().toISOString().slice(0, 10);
  if (!normalizedUserId) return 0;
  const key = `${normalizedDay}::${normalizedUserId}`;
  const row = ttsDailyUsageByUserDay.get(key);
  if (!row) return 0;
  return Math.round(toNonNegativeNumber(row.billed_characters, 0));
};

const getTtsDailyLimitStatus = (userId, day) => {
  const normalizedUserId = pickFirstString(userId);
  const resolvedDay = formatUsageDay(day) || new Date().toISOString().slice(0, 10);
  const charLimit = getTtsDailyCharLimit(normalizedUserId);
  const usedChars = getTtsUsageBilledCharsForUserDay(normalizedUserId, resolvedDay);
  const remainingChars = charLimit > 0 ? Math.max(0, charLimit - usedChars) : null;
  return {
    user_id: normalizedUserId || '',
    day: resolvedDay,
    char_limit_day: charLimit,
    used_chars_day: usedChars,
    remaining_chars_day: remainingChars,
    limit_reached_today: Boolean(charLimit > 0 && usedChars >= charLimit)
  };
};

const normalizePronAssessLocale = (value) => {
  const raw = pickFirstString(value).toLowerCase();
  if (!raw) return pronAssessDefaultLocale || 'en-US';
  if (raw.startsWith('en-gb') || raw.startsWith('en_gb')) return 'en-GB';
  if (raw.startsWith('es')) return 'es-ES';
  if (raw.startsWith('en')) return 'en-US';
  return pronAssessDefaultLocale || 'en-US';
};

const normalizePronAssessText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const estimatePronAssessCostUsd = (audioSeconds) => {
  if (!Number.isFinite(audioSeconds) || !Number.isFinite(pronAssessAzureCostPerHourUsd)) return 0;
  if (pronAssessAzureCostPerHourUsd <= 0) return 0;
  return (Math.max(0, audioSeconds) / 3600) * pronAssessAzureCostPerHourUsd;
};

const pronUsageRowSort = (a, b) => {
  const dayCompare = String(b.day || '').localeCompare(String(a.day || ''));
  if (dayCompare !== 0) return dayCompare;
  const secondsCompare = toNonNegativeNumber(b.audio_seconds) - toNonNegativeNumber(a.audio_seconds);
  if (secondsCompare !== 0) return secondsCompare;
  return String(a.user_id || '').localeCompare(String(b.user_id || ''));
};

const prunePronAssessDailyUsage = () => {
  if (!Number.isFinite(pronAssessUsageDailyRetentionDays) || pronAssessUsageDailyRetentionDays <= 0) return;
  const cutoffMs = Date.now() - pronAssessUsageDailyRetentionDays * 24 * 60 * 60 * 1000;
  const cutoffDay = new Date(cutoffMs).toISOString().slice(0, 10);
  Array.from(pronAssessDailyUsageByUserDay.entries()).forEach(([key, row]) => {
    if (!row || !row.day || row.day < cutoffDay) {
      pronAssessDailyUsageByUserDay.delete(key);
    }
  });
};

const getPronAssessDailySecondsLimit = (userId) => {
  const normalizedUserId = pickFirstString(userId);
  if (normalizedUserId && pronAssessDailySecondsLimits.has(normalizedUserId)) {
    return Math.max(
      0,
      Math.floor(toNonNegativeNumber(pronAssessDailySecondsLimits.get(normalizedUserId)?.seconds_limit_day, 0))
    );
  }
  return Math.max(0, Math.floor(toNonNegativeNumber(pronAssessDefaultSecondsLimitDay, 0)));
};

const setPronAssessDailySecondsLimit = (userId, secondsLimit) => {
  const normalizedUserId = pickFirstString(userId);
  if (!normalizedUserId) return null;
  const normalizedLimit = Math.floor(toNonNegativeNumber(secondsLimit, 0));
  if (!normalizedLimit) {
    pronAssessDailySecondsLimits.delete(normalizedUserId);
    return null;
  }
  const row = {
    user_id: normalizedUserId,
    seconds_limit_day: normalizedLimit,
    updated_at: new Date().toISOString()
  };
  pronAssessDailySecondsLimits.set(normalizedUserId, row);
  return row;
};

const getPronAssessUsedSecondsForUserDay = (userId, day) => {
  const normalizedUserId = pickFirstString(userId);
  const normalizedDay = formatUsageDay(day) || new Date().toISOString().slice(0, 10);
  if (!normalizedUserId) return 0;
  const row = pronAssessDailyUsageByUserDay.get(`${normalizedDay}::${normalizedUserId}`);
  if (!row) return 0;
  return Number(toNonNegativeNumber(row.audio_seconds, 0).toFixed(3));
};

const getPronAssessDailyLimitStatus = (userId, day) => {
  const normalizedUserId = pickFirstString(userId);
  const resolvedDay = formatUsageDay(day) || new Date().toISOString().slice(0, 10);
  const secondsLimit = getPronAssessDailySecondsLimit(normalizedUserId);
  const usedSeconds = getPronAssessUsedSecondsForUserDay(normalizedUserId, resolvedDay);
  const remainingSeconds = secondsLimit > 0 ? Math.max(0, Number((secondsLimit - usedSeconds).toFixed(3))) : null;
  return {
    user_id: normalizedUserId || '',
    day: resolvedDay,
    seconds_limit_day: secondsLimit,
    used_seconds_day: Number(usedSeconds.toFixed(3)),
    remaining_seconds_day: remainingSeconds,
    limit_reached_today: Boolean(secondsLimit > 0 && usedSeconds >= secondsLimit)
  };
};

const trackPronAssessDailyUsage = (entry) => {
  if (!entry || typeof entry !== 'object') return;
  const day = formatUsageDay(entry.timestamp) || new Date().toISOString().slice(0, 10);
  const userId = pickFirstString(entry.user_id, entry.userId, 'unknown');
  const userName = pickFirstString(entry.user_name, entry.userName, entry.name);
  const locale = pickFirstString(entry.locale, entry.lang, entry.language);
  const provider = pickFirstString(entry.provider, 'azure-speech');
  const audioSeconds = Math.max(0, toNonNegativeNumber(entry.audio_seconds, entry.duration_seconds ?? 0));
  const estimatedCost = toNonNegativeNumber(entry.estimated_cost_usd, estimatePronAssessCostUsd(audioSeconds));
  const timestamp = pickFirstString(entry.timestamp, new Date().toISOString());
  const key = `${day}::${userId}`;
  const current = pronAssessDailyUsageByUserDay.get(key) || {
    day,
    user_id: userId,
    user_name: userName || '',
    requests: 0,
    audio_seconds: 0,
    estimated_cost_usd: 0,
    locale: locale || '',
    provider: provider || 'azure-speech',
    first_request_at: timestamp,
    last_request_at: timestamp
  };
  current.requests += 1;
  current.audio_seconds = Number((toNonNegativeNumber(current.audio_seconds, 0) + audioSeconds).toFixed(3));
  current.estimated_cost_usd = Number((toNonNegativeNumber(current.estimated_cost_usd, 0) + estimatedCost).toFixed(6));
  if (userName) current.user_name = userName;
  if (locale) current.locale = locale;
  if (provider) current.provider = provider;
  if (timestamp) {
    if (!current.first_request_at || timestamp < current.first_request_at) current.first_request_at = timestamp;
    if (!current.last_request_at || timestamp > current.last_request_at) current.last_request_at = timestamp;
  }
  pronAssessDailyUsageByUserDay.set(key, current);
  prunePronAssessDailyUsage();
};

const summarizePronAssessUsageRows = (rows) =>
  rows.reduce(
    (acc, row) => {
      acc.requests += toNonNegativeNumber(row.requests, 0);
      acc.audio_seconds = Number((acc.audio_seconds + toNonNegativeNumber(row.audio_seconds, 0)).toFixed(3));
      acc.estimated_cost_usd = Number(
        (acc.estimated_cost_usd + toNonNegativeNumber(row.estimated_cost_usd, 0)).toFixed(6)
      );
      return acc;
    },
    { requests: 0, audio_seconds: 0, estimated_cost_usd: 0 }
  );

const getAzureSpeechHost = () => {
  const explicit = pickFirstString(azureSpeechHost);
  if (explicit) return explicit.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const region = pickFirstString(azureSpeechRegion);
  if (!region) return '';
  return `${region}.stt.speech.microsoft.com`;
};

const parseWavDurationSeconds = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 44) return null;
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') return null;
  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bitsPerSample = 0;
  let dataSize = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataStart = offset + 8;
    const chunkDataEnd = chunkDataStart + chunkSize;
    if (chunkDataEnd > buffer.length) break;
    if (chunkId === 'fmt ' && chunkSize >= 16) {
      channels = buffer.readUInt16LE(chunkDataStart + 2);
      sampleRate = buffer.readUInt32LE(chunkDataStart + 4);
      bitsPerSample = buffer.readUInt16LE(chunkDataStart + 14);
    } else if (chunkId === 'data') {
      dataSize = chunkSize;
      break;
    }
    offset = chunkDataEnd + (chunkSize % 2);
  }
  if (!sampleRate || !channels || !bitsPerSample || !dataSize) return null;
  const bytesPerSecond = sampleRate * channels * (bitsPerSample / 8);
  if (!bytesPerSecond) return null;
  return Number((dataSize / bytesPerSecond).toFixed(3));
};

const buildPronAssessmentHeaderValue = (referenceText) =>
  Buffer.from(
    JSON.stringify({
      ReferenceText: referenceText,
      GradingSystem: 'HundredMark',
      Granularity: 'Phoneme',
      Dimension: 'Comprehensive',
      EnableMiscue: true
    }),
    'utf8'
  ).toString('base64');

const requestAzurePronunciationAssessment = ({
  audioBuffer,
  locale,
  expectedText,
  timeoutMs = pronAssessRequestTimeoutMs
}) => {
  const host = getAzureSpeechHost();
  if (!azureSpeechKey || !host) {
    return Promise.reject(new Error('azure_speech_not_configured'));
  }
  const pathName = `/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(
    locale
  )}&format=detailed`;
  const options = {
    protocol: 'https:',
    hostname: host,
    port: 443,
    method: 'POST',
    path: pathName,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
      'Ocp-Apim-Subscription-Key': azureSpeechKey,
      'Pronunciation-Assessment': buildPronAssessmentHeaderValue(expectedText),
      'Content-Length': Buffer.byteLength(audioBuffer)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on('end', () => {
        const bodyText = Buffer.concat(chunks).toString('utf8');
        let parsed = null;
        try {
          parsed = bodyText ? JSON.parse(bodyText) : {};
        } catch (err) {
          reject(new Error(`Azure Speech JSON parse error: ${err.message}`));
          return;
        }
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body: parsed || {} });
          return;
        }
        const msg =
          parsed && typeof parsed.error === 'string'
            ? parsed.error
            : parsed && parsed.error && parsed.error.message
            ? parsed.error.message
            : bodyText || `HTTP ${res.statusCode}`;
        reject(new Error(`Azure Speech HTTP ${res.statusCode}: ${msg}`));
      });
    });
    req.on('error', reject);
    req.setTimeout(Math.max(1000, Number(timeoutMs) || 15000), () => {
      req.destroy(new Error('Azure Speech timeout'));
    });
    req.write(audioBuffer);
    req.end();
  });
};

const mapAzureWordStatus = (errorType, score) => {
  const raw = String(errorType || '').trim().toLowerCase();
  if (!raw || raw === 'none') {
    if (typeof score === 'number' && Number.isFinite(score) && score < 45) return 'wrong';
    return 'ok';
  }
  if (raw === 'omission') return 'missing';
  if (raw === 'insertion') return 'extra';
  if (raw === 'mispronunciation') return 'wrong';
  return 'issue';
};

const ticksToMs = (ticks) => {
  const n = Number(ticks);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n / 10000));
};

const readAzureScoreOrNull = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const normalizeAzurePronunciationAssessment = (payload, expectedText) => {
  if (!payload || typeof payload !== 'object') return null;
  const nbest = Array.isArray(payload.NBest) ? payload.NBest : [];
  const top = nbest[0] && typeof nbest[0] === 'object' ? nbest[0] : {};
  const pa = top.PronunciationAssessment && typeof top.PronunciationAssessment === 'object'
    ? top.PronunciationAssessment
    : top;
  const wordsSource = Array.isArray(top.Words) ? top.Words : [];

  const words = wordsSource.map((word, index) => {
    const obj = word && typeof word === 'object' ? word : {};
    const wpa = obj.PronunciationAssessment && typeof obj.PronunciationAssessment === 'object'
      ? obj.PronunciationAssessment
      : obj;
    const accuracy = readAzureScoreOrNull(wpa.AccuracyScore);
    const errorType = pickFirstString(wpa.ErrorType, obj.ErrorType);
    const startMs = ticksToMs(obj.Offset);
    const durationMs = ticksToMs(obj.Duration);
    const endMs =
      startMs !== null
        ? startMs + Math.max(40, Number.isFinite(durationMs) ? durationMs : 0)
        : null;
    return {
      index,
      expected: pickFirstString(obj.Word),
      recognized: pickFirstString(obj.Word),
      start_ms: startMs,
      end_ms: endMs,
      score: accuracy !== null ? Math.max(0, Math.min(100, Math.round(accuracy))) : null,
      status: mapAzureWordStatus(errorType, accuracy),
      error_type: errorType || '',
      phonemes: Array.isArray(obj.Phonemes)
        ? obj.Phonemes.map((phoneme) => {
            const p = phoneme && typeof phoneme === 'object' ? phoneme : {};
            const ppa = p.PronunciationAssessment && typeof p.PronunciationAssessment === 'object'
              ? p.PronunciationAssessment
              : p;
            const pScore = readAzureScoreOrNull(ppa.AccuracyScore);
            return {
              phoneme: pickFirstString(p.Phoneme),
              score: pScore !== null ? Math.max(0, Math.min(100, Math.round(pScore))) : null,
              offset_ms: ticksToMs(p.Offset),
              duration_ms: ticksToMs(p.Duration)
            };
          })
        : []
    };
  });

  const scoreValue = (name) => {
    const n = readAzureScoreOrNull(pa[name]);
    return n !== null ? Math.max(0, Math.min(100, Math.round(n))) : null;
  };
  const transcript = pickFirstString(top.Display, top.DisplayText, payload.DisplayText, payload.Text);

  return {
    recognition_status: pickFirstString(payload.RecognitionStatus),
    expected_text: expectedText,
    transcript: transcript || '',
    scores: {
      overall: scoreValue('PronScore'),
      accuracy: scoreValue('AccuracyScore'),
      fluency: scoreValue('FluencyScore'),
      completeness: scoreValue('CompletenessScore'),
      prosody: scoreValue('ProsodyScore')
    },
    words
  };
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
  if (!usage) return;
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
    if (usageLogEnabled) {
      appendOpenAIUsageLog(entry);
    }
    trackOpenAIDailyUsage(entry);
  } catch (err) {
    console.warn('Failed to record OpenAI usage:', err.message);
  }
};

loadOpenAIDailyUsageFromDisk();
loadChatbotDailyLimitsFromDisk();
loadTtsDailyUsageFromDisk();
loadTtsDailyLimitsFromDisk();

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
    if (chatbotResourceReferralPrompt) {
      messages.push({ role: 'system', content: chatbotResourceReferralPrompt });
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

const authorizeUsage = (req, res) => {
  if (!monitorToken && !stateToken) return true;
  const monitorCandidate =
    req.get('x-monitor-token') ||
    (req.query ? req.query.monitor_token || req.query.token : '') ||
    (req.body ? req.body.monitor_token || req.body.token : '');
  if (monitorToken && monitorCandidate && monitorCandidate === monitorToken) {
    return true;
  }

  const stateCandidate =
    req.get('x-rt-token') ||
    (req.query ? req.query.rt_token || req.query.state_token || req.query.token : '') ||
    (req.body ? req.body.rt_token || req.body.state_token || req.body.token : '');
  if (stateToken && stateCandidate && stateCandidate === stateToken) {
    return true;
  }

  res.status(401).json({ error: 'unauthorized' });
  return false;
};

const dataRoot = path.join(__dirname, 'data', 'rt');
const eventsDir = path.join(dataRoot, 'events');
const snapshotsDir = path.join(dataRoot, 'snapshots');
const metaDir = path.join(dataRoot, 'meta');
const communityDir = path.join(dataRoot, 'community');
const communityDmDir = path.join(communityDir, 'dm');
const communityPublicHistoryFile = path.join(communityDir, `${COMMUNITY_PUBLIC_CHANNEL}.json`);
const communityPresenceFile = path.join(communityDir, 'presence.json');
const communityDmRoomsFile = path.join(communityDir, 'dm-rooms.json');

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
ensureDir(communityDir);
ensureDir(communityDmDir);

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

const newCommunityHistory = () => ({
  schema: 1,
  room_type: 'public',
  room_id: COMMUNITY_PUBLIC_CHANNEL,
  updated_at: null,
  messages: []
});

const loadCommunityHistory = () => {
  const data = loadJsonFile(communityPublicHistoryFile, null);
  if (!data || typeof data !== 'object') return newCommunityHistory();
  if (!Array.isArray(data.messages)) data.messages = [];
  return data;
};

const saveCommunityHistory = (history) => {
  writeJsonFile(communityPublicHistoryFile, history);
};

const newCommunityPresenceState = () => ({
  schema: 1,
  updated_at: null,
  active_window_ms: COMMUNITY_PRESENCE_ACTIVE_WINDOW_MS,
  rooms: {}
});

const loadCommunityPresenceState = () => {
  const data = loadJsonFile(communityPresenceFile, null);
  if (!data || typeof data !== 'object') return newCommunityPresenceState();
  if (!data.rooms || typeof data.rooms !== 'object') data.rooms = {};
  return data;
};

const saveCommunityPresenceState = (state) => {
  writeJsonFile(communityPresenceFile, state);
};

const ensurePresenceRoom = (state, roomId) => {
  const safeRoomId = pickFirstString(roomId) || COMMUNITY_PUBLIC_CHANNEL;
  if (!state.rooms[safeRoomId] || typeof state.rooms[safeRoomId] !== 'object') {
    state.rooms[safeRoomId] = {
      room_id: safeRoomId,
      updated_at: null,
      users: {}
    };
  }
  const room = state.rooms[safeRoomId];
  if (!room.users || typeof room.users !== 'object') room.users = {};
  return room;
};

const pruneCommunityPresenceState = (state, now = Date.now()) => {
  if (!state || typeof state !== 'object') return newCommunityPresenceState();
  if (!state.rooms || typeof state.rooms !== 'object') state.rooms = {};
  Object.keys(state.rooms).forEach((roomId) => {
    const room = state.rooms[roomId];
    if (!room || typeof room !== 'object' || !room.users || typeof room.users !== 'object') {
      delete state.rooms[roomId];
      return;
    }
    Object.keys(room.users).forEach((userId) => {
      const userEntry = room.users[userId];
      if (!userEntry || typeof userEntry !== 'object') {
        delete room.users[userId];
        return;
      }
      const sessions = userEntry.sessions && typeof userEntry.sessions === 'object' ? userEntry.sessions : {};
      Object.keys(sessions).forEach((sessionId) => {
        const sessionEntry = sessions[sessionId];
        const expiresAt = Date.parse(sessionEntry && sessionEntry.expires_at ? sessionEntry.expires_at : '');
        const lastSeen = Date.parse(sessionEntry && sessionEntry.last_seen_at ? sessionEntry.last_seen_at : '');
        const legacyWindowMs = toPositiveInteger(
          sessionEntry && sessionEntry.active_window_ms,
          COMMUNITY_PRESENCE_ACTIVE_WINDOW_MS
        );
        const sessionCutoff = now - legacyWindowMs;
        const shouldRemoveByExpiry = Number.isFinite(expiresAt) ? expiresAt < now : false;
        const shouldRemoveByLastSeen = Number.isFinite(lastSeen) ? lastSeen < sessionCutoff : true;
        if (shouldRemoveByExpiry || shouldRemoveByLastSeen) {
          delete sessions[sessionId];
        }
      });
      userEntry.sessions = sessions;
      const remainingSessionIds = Object.keys(sessions);
      if (!remainingSessionIds.length) {
        delete room.users[userId];
        return;
      }
      const latestSeen = remainingSessionIds.reduce((max, sessionId) => {
        const sessionEntry = sessions[sessionId];
        const lastSeen = Date.parse(sessionEntry && sessionEntry.last_seen_at ? sessionEntry.last_seen_at : '');
        return Number.isFinite(lastSeen) && lastSeen > max ? lastSeen : max;
      }, 0);
      userEntry.last_seen_at = latestSeen > 0 ? new Date(latestSeen).toISOString() : userEntry.last_seen_at || null;
    });
    if (!Object.keys(room.users).length) {
      delete state.rooms[roomId];
      return;
    }
    room.updated_at = new Date(now).toISOString();
  });
  state.updated_at = new Date(now).toISOString();
  return state;
};

const summarizeCommunityPresenceRoom = (room) => {
  const safeRoom = room && typeof room === 'object' ? room : { users: {} };
  const users = safeRoom.users && typeof safeRoom.users === 'object' ? safeRoom.users : {};
  const userIds = Object.keys(users);
  const sessionsCount = userIds.reduce((total, userId) => {
    const sessions = users[userId] && users[userId].sessions && typeof users[userId].sessions === 'object'
      ? users[userId].sessions
      : {};
    return total + Object.keys(sessions).length;
  }, 0);
  return {
    room_id: pickFirstString(safeRoom.room_id) || COMMUNITY_PUBLIC_CHANNEL,
    updated_at: safeRoom.updated_at || null,
    user_count: userIds.length,
    subscription_count: sessionsCount,
    occupied: userIds.length > 0,
    users: userIds.map((userId) => {
      const entry = users[userId] || {};
      const sessions = entry.sessions && typeof entry.sessions === 'object' ? entry.sessions : {};
      return {
        user_id: String(userId),
        name: pickFirstString(entry.name),
        avatar: pickFirstString(entry.avatar),
        app: pickFirstString(entry.app) || 'speakapp',
        premium: Boolean(entry.premium),
        last_seen_at: entry.last_seen_at || null,
        sessions_count: Object.keys(sessions).length,
        legacy_sessions_count: Object.values(sessions).filter(
          (sessionEntry) => sessionEntry && sessionEntry.source === 'legacy'
        ).length
      };
    })
  };
};

let communityPresenceState = pruneCommunityPresenceState(loadCommunityPresenceState());
saveCommunityPresenceState(communityPresenceState);

const getMutableCommunityPresenceState = (now = Date.now()) => {
  communityPresenceState = pruneCommunityPresenceState(communityPresenceState, now);
  return communityPresenceState;
};

const getCommunityPresenceSummary = (roomId) => {
  const state = getMutableCommunityPresenceState();
  saveCommunityPresenceState(state);
  const room = ensurePresenceRoom(state, roomId);
  return summarizeCommunityPresenceRoom(room);
};

const upsertCommunityPresence = ({
  roomId,
  actor,
  sessionId,
  source = 'heartbeat',
  activeWindowMs = COMMUNITY_PRESENCE_ACTIVE_WINDOW_MS,
  now = Date.now()
}) => {
  const safeSessionId = pickFirstString(sessionId);
  const safeActor = actor && typeof actor === 'object' ? actor : {};
  const safeUserId = pickFirstString(safeActor.id, safeActor.user_id);
  if (!safeUserId || !safeSessionId) {
    return { ok: false, error: 'user_id_and_session_id_required' };
  }
  const state = getMutableCommunityPresenceState(now);
  const room = ensurePresenceRoom(state, roomId);
  const nowIso = new Date(now).toISOString();
  const existingUser = room.users[safeUserId] && typeof room.users[safeUserId] === 'object' ? room.users[safeUserId] : {};
  const sessions = existingUser.sessions && typeof existingUser.sessions === 'object' ? existingUser.sessions : {};
  const ttlMs = toPositiveInteger(activeWindowMs, COMMUNITY_PRESENCE_ACTIVE_WINDOW_MS);
  sessions[safeSessionId] = {
    session_id: safeSessionId,
    last_seen_at: nowIso,
    expires_at: new Date(now + ttlMs).toISOString(),
    active_window_ms: ttlMs,
    source: pickFirstString(source) || 'heartbeat',
    app: pickFirstString(safeActor.app, existingUser.app) || 'speakapp'
  };
  room.users[safeUserId] = {
    user_id: safeUserId,
    name: pickFirstString(safeActor.name, safeActor.displayName, existingUser.name),
    avatar: pickFirstString(safeActor.avatar, existingUser.avatar),
    app: pickFirstString(safeActor.app, existingUser.app) || 'speakapp',
    premium: safeActor.premium === true || existingUser.premium === true,
    last_seen_at: nowIso,
    sessions
  };
  room.updated_at = nowIso;
  state.updated_at = nowIso;
  saveCommunityPresenceState(state);
  return { ok: true, summary: summarizeCommunityPresenceRoom(room) };
};

const upsertLegacyCommunityPresence = ({ roomId, actor, sessionId, now = Date.now() }) =>
  upsertCommunityPresence({
    roomId,
    actor,
    sessionId,
    source: 'legacy',
    activeWindowMs: COMMUNITY_PRESENCE_LEGACY_WINDOW_MS,
    now
  });

const removeCommunityPresenceSession = ({ roomId, userId, sessionId, now = Date.now() }) => {
  const safeUserId = pickFirstString(userId);
  const safeSessionId = pickFirstString(sessionId);
  if (!safeUserId || !safeSessionId) {
    return { ok: false, error: 'user_id_and_session_id_required' };
  }
  const state = getMutableCommunityPresenceState(now);
  const room = ensurePresenceRoom(state, roomId);
  const userEntry = room.users[safeUserId];
  if (userEntry && userEntry.sessions && typeof userEntry.sessions === 'object') {
    delete userEntry.sessions[safeSessionId];
    if (!Object.keys(userEntry.sessions).length) {
      delete room.users[safeUserId];
    } else {
      const latestSeen = Object.values(userEntry.sessions).reduce((max, sessionEntry) => {
        const lastSeen = Date.parse(sessionEntry && sessionEntry.last_seen_at ? sessionEntry.last_seen_at : '');
        return Number.isFinite(lastSeen) && lastSeen > max ? lastSeen : max;
      }, 0);
      userEntry.last_seen_at = latestSeen > 0 ? new Date(latestSeen).toISOString() : null;
    }
  }
  room.updated_at = new Date(now).toISOString();
  state.updated_at = room.updated_at;
  saveCommunityPresenceState(state);
  return { ok: true, summary: summarizeCommunityPresenceRoom(room) };
};

const compareCommunityUserIds = (left, right) => {
  const a = pickFirstString(left);
  const b = pickFirstString(right);
  if (a === b) return 0;
  const aIsNumeric = /^\d+$/.test(a);
  const bIsNumeric = /^\d+$/.test(b);
  if (aIsNumeric && bIsNumeric) {
    try {
      const aInt = BigInt(a);
      const bInt = BigInt(b);
      if (aInt < bInt) return -1;
      if (aInt > bInt) return 1;
      return 0;
    } catch (err) {
      // Fall through to lexical compare.
    }
  }
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
};

const buildCommunityDmIdentity = (userA, userB) => {
  const left = pickFirstString(userA);
  const right = pickFirstString(userB);
  if (!left || !right || left === right) return null;
  const ordered = [left, right].sort(compareCommunityUserIds);
  const roomId = `${ordered[0]}_${ordered[1]}`;
  return {
    room_type: 'dm',
    room_id: roomId,
    channel: `${COMMUNITY_DM_CHANNEL_PREFIX}${roomId}`,
    user_ids: ordered
  };
};

const parseCommunityDmChannel = (channelName) => {
  const raw = pickFirstString(channelName);
  if (!raw || raw.startsWith('private-coach')) return null;
  const match = /^private-(.+)_(.+)$/.exec(raw);
  if (!match) return null;
  return buildCommunityDmIdentity(match[1], match[2]);
};

const newCommunityDmRoomsState = () => ({
  schema: 1,
  updated_at: null,
  rooms: {}
});

const loadCommunityDmRoomsState = () => {
  const data = loadJsonFile(communityDmRoomsFile, null);
  if (!data || typeof data !== 'object') return newCommunityDmRoomsState();
  if (!data.rooms || typeof data.rooms !== 'object') data.rooms = {};
  return data;
};

const saveCommunityDmRoomsState = (state) => {
  writeJsonFile(communityDmRoomsFile, state);
};

const dmHistoryPathFor = (roomId) =>
  path.join(communityDmDir, `${sanitizeOwner(roomId || 'room')}.json`);

const newCommunityDmHistory = (identity) => ({
  schema: 1,
  room_type: 'dm',
  room_id: identity.room_id,
  channel: identity.channel,
  user_ids: [...identity.user_ids],
  updated_at: null,
  messages: []
});

const loadCommunityDmHistory = (identity) => {
  const filePath = dmHistoryPathFor(identity.room_id);
  const data = loadJsonFile(filePath, null);
  if (!data || typeof data !== 'object') return newCommunityDmHistory(identity);
  if (!Array.isArray(data.messages)) data.messages = [];
  if (!Array.isArray(data.user_ids)) data.user_ids = [...identity.user_ids];
  if (!data.room_id) data.room_id = identity.room_id;
  if (!data.channel) data.channel = identity.channel;
  return data;
};

const saveCommunityDmHistory = (history) => {
  writeJsonFile(dmHistoryPathFor(history.room_id), history);
};

let communityDmRoomsState = loadCommunityDmRoomsState();

const getMutableCommunityDmRoomsState = () => {
  if (!communityDmRoomsState || typeof communityDmRoomsState !== 'object') {
    communityDmRoomsState = newCommunityDmRoomsState();
  }
  if (!communityDmRoomsState.rooms || typeof communityDmRoomsState.rooms !== 'object') {
    communityDmRoomsState.rooms = {};
  }
  return communityDmRoomsState;
};

const buildCommunityParticipantSummary = (participant) => {
  const entry = participant && typeof participant === 'object' ? participant : {};
  return {
    id: pickFirstString(entry.id, entry.user_id),
    name: pickFirstString(entry.name, entry.displayName, entry.email),
    avatar: pickFirstString(entry.avatar),
    email: pickFirstString(entry.email),
    app: pickFirstString(entry.app) || 'speakapp',
    premium: Boolean(entry.premium)
  };
};

const summarizeCommunityDmRoom = (room, viewerId = '') => {
  const safeRoom = room && typeof room === 'object' ? room : {};
  const participantsRaw =
    safeRoom.participants && typeof safeRoom.participants === 'object' ? safeRoom.participants : {};
  const participants = Object.keys(participantsRaw)
    .map((participantId) => buildCommunityParticipantSummary(participantsRaw[participantId]))
    .filter((participant) => participant.id);
  const safeViewerId = pickFirstString(viewerId);
  const peer =
    participants.find((participant) => participant.id !== safeViewerId) ||
    participants[0] ||
    {
      id: '',
      name: '',
      avatar: '',
      email: '',
      app: '',
      premium: false
    };
  return {
    room_type: 'dm',
    room_id: pickFirstString(safeRoom.room_id),
    channel: pickFirstString(safeRoom.channel),
    user_ids: Array.isArray(safeRoom.user_ids) ? [...safeRoom.user_ids] : [],
    created_at: safeRoom.created_at || null,
    updated_at: safeRoom.updated_at || null,
    last_message_at: safeRoom.last_message_at || null,
    last_message_preview: pickFirstString(safeRoom.last_message_preview),
    unread_count: Math.max(0, Math.round(toNonNegativeNumber(safeRoom.unread_count, 0))),
    participants,
    peer
  };
};

const ensureCommunityDmRoomRecord = ({
  identity,
  actor,
  peerActor,
  createdAt = new Date().toISOString()
}) => {
  const state = getMutableCommunityDmRoomsState();
  const roomId = identity.room_id;
  if (!state.rooms[roomId] || typeof state.rooms[roomId] !== 'object') {
    state.rooms[roomId] = {
      room_type: 'dm',
      room_id: identity.room_id,
      channel: identity.channel,
      user_ids: [...identity.user_ids],
      created_at: createdAt,
      updated_at: createdAt,
      last_message_at: null,
      last_message_preview: '',
      unread_count: 0,
      participants: {}
    };
  }
  const room = state.rooms[roomId];
  if (!room.participants || typeof room.participants !== 'object') room.participants = {};
  const mergeParticipant = (candidate) => {
    const safeCandidate = candidate && typeof candidate === 'object' ? candidate : {};
    const candidateId = pickFirstString(safeCandidate.id, safeCandidate.user_id);
    if (!candidateId) return;
    const existing = room.participants[candidateId] && typeof room.participants[candidateId] === 'object'
      ? room.participants[candidateId]
      : {};
    room.participants[candidateId] = {
      id: candidateId,
      name: pickFirstString(safeCandidate.name, safeCandidate.displayName, safeCandidate.email, existing.name),
      displayName: pickFirstString(
        safeCandidate.displayName,
        safeCandidate.name,
        safeCandidate.email,
        existing.displayName,
        existing.name
      ),
      email: pickFirstString(safeCandidate.email, existing.email),
      avatar: pickFirstString(safeCandidate.avatar, existing.avatar),
      app: pickFirstString(safeCandidate.app, existing.app) || 'speakapp',
      premium: safeCandidate.premium === true || existing.premium === true
    };
  };
  mergeParticipant(actor);
  mergeParticipant(peerActor);
  room.updated_at = createdAt;
  state.updated_at = createdAt;
  saveCommunityDmRoomsState(state);
  return room;
};

const getCommunityPublicPresenceUserMap = () => {
  const summary = getCommunityPresenceSummary(COMMUNITY_PUBLIC_CHANNEL);
  const map = new Map();
  (Array.isArray(summary.users) ? summary.users : []).forEach((entry) => {
    const userId = pickFirstString(entry && entry.user_id);
    if (!userId) return;
    map.set(userId, {
      id: userId,
      name: pickFirstString(entry && entry.name),
      avatar: pickFirstString(entry && entry.avatar),
      app: pickFirstString(entry && entry.app) || 'speakapp',
      premium: entry && entry.premium === true
    });
  });
  return map;
};

const hydrateCommunityDmRoom = (room, viewerId = '') => {
  const summary = summarizeCommunityDmRoom(room, viewerId);
  const presenceUsers = getCommunityPublicPresenceUserMap();
  const mergeParticipant = (participant) => {
    const safeParticipant = participant && typeof participant === 'object' ? participant : {};
    const participantId = pickFirstString(safeParticipant.id);
    if (!participantId) return safeParticipant;
    const online = presenceUsers.get(participantId);
    if (!online) return safeParticipant;
    return {
      ...safeParticipant,
      name: pickFirstString(safeParticipant.name, online.name),
      avatar: pickFirstString(safeParticipant.avatar, online.avatar),
      app: pickFirstString(safeParticipant.app, online.app) || 'speakapp',
      premium: safeParticipant.premium === true || online.premium === true
    };
  };
  const hydratedParticipants = summary.participants.map(mergeParticipant);
  const hydratedPeer = mergeParticipant(summary.peer);
  return {
    ...summary,
    participants: hydratedParticipants,
    peer: hydratedPeer
  };
};

const listCommunityDmRoomsForUser = (userId) => {
  const safeUserId = pickFirstString(userId);
  if (!safeUserId) return [];
  const state = getMutableCommunityDmRoomsState();
  saveCommunityDmRoomsState(state);
  return Object.keys(state.rooms)
    .map((roomId) => state.rooms[roomId])
    .filter((room) => room && Array.isArray(room.user_ids) && room.user_ids.includes(safeUserId))
    .sort((left, right) => {
      const leftTs = Date.parse(left && (left.last_message_at || left.updated_at || left.created_at) || '');
      const rightTs = Date.parse(right && (right.last_message_at || right.updated_at || right.created_at) || '');
      const safeLeft = Number.isFinite(leftTs) ? leftTs : 0;
      const safeRight = Number.isFinite(rightTs) ? rightTs : 0;
      return safeRight - safeLeft;
    })
    .map((room) => hydrateCommunityDmRoom(room, safeUserId));
};

const buildCommunityDmMessage = ({ identity, text, actor, id, createdAt }) => {
  const timestamp = createdAt || new Date().toISOString();
  const actorId = pickFirstString(actor && actor.id);
  const actorName = pickFirstString(actor && (actor.name || actor.displayName || actor.email));
  return {
    id: pickFirstString(id) || createCommunityMessageId(),
    room_type: 'dm',
    room_id: identity.room_id,
    channel: identity.channel,
    created_at: timestamp,
    published: timestamp,
    text: normalizeCommunityText(text),
    actor: {
      id: actorId,
      name: actorName,
      displayName: actorName,
      email: pickFirstString(actor && actor.email),
      avatar: pickFirstString(actor && actor.avatar),
      app: pickFirstString(actor && actor.app) || 'speakapp',
      premium: Boolean(actor && actor.premium)
    }
  };
};

const appendCommunityDmMessage = ({ identity, actor, peerActor, message }) => {
  const history = loadCommunityDmHistory(identity);
  history.messages.push(message);
  if (history.messages.length > COMMUNITY_HISTORY_MAX_MESSAGES) {
    history.messages = history.messages.slice(-COMMUNITY_HISTORY_MAX_MESSAGES);
  }
  history.updated_at = message.created_at || new Date().toISOString();
  saveCommunityDmHistory(history);

  const room = ensureCommunityDmRoomRecord({
    identity,
    actor,
    peerActor,
    createdAt: history.updated_at
  });
  room.last_message_at = history.updated_at;
  room.last_message_preview = normalizeCommunityText(message.text || '').slice(0, 240);
  room.updated_at = history.updated_at;
  const state = getMutableCommunityDmRoomsState();
  state.rooms[identity.room_id] = room;
  state.updated_at = room.updated_at;
  saveCommunityDmRoomsState(state);
  return { history, room };
};

const buildLegacyPrivateChatPayload = (identity) => ({
  user1: identity.user_ids[0],
  user2: identity.user_ids[1],
  private_channel: identity.channel
});

const emitLegacyPrivateChatOpen = async (identity) => {
  await pusher.trigger(
    COMMUNITY_PUBLIC_CHANNEL,
    'private_chat',
    buildLegacyPrivateChatPayload(identity)
  );
};

const emitLegacyPrivateChatClose = async (identity) => {
  await pusher.trigger(
    COMMUNITY_PUBLIC_CHANNEL,
    'destroy_private_chat',
    buildLegacyPrivateChatPayload(identity)
  );
};

const ensureCommunityDmRoom = async ({
  userId,
  peerUserId,
  actor,
  peerActor,
  emitLegacyOpen = false
}) => {
  const identity = buildCommunityDmIdentity(userId, peerUserId);
  if (!identity) {
    return { ok: false, error: 'invalid_dm_users' };
  }
  const nowIso = new Date().toISOString();
  const room = ensureCommunityDmRoomRecord({
    identity,
    actor,
    peerActor,
    createdAt: nowIso
  });
  if (emitLegacyOpen) {
    await emitLegacyPrivateChatOpen(identity);
  }
  return {
    ok: true,
    room: hydrateCommunityDmRoom(room, pickFirstString(userId)),
    identity
  };
};

const emitCommunityDmMessage = async ({ source, appName, emitLegacyOpen = false }) => {
  const requestedRoomId = pickFirstString(source.room_id, source.roomId);
  const requestedChannel = pickFirstString(source.channel);
  const requestedIdentity =
    parseCommunityDmChannel(requestedChannel) ||
    (requestedRoomId ? buildCommunityDmIdentity(...requestedRoomId.split('_')) : null);
  const senderId = pickFirstString(source.user_id, source.userId, source.id);
  const peerUserId = pickFirstString(source.peer_user_id, source.peerUserId);
  const identity =
    requestedIdentity ||
    buildCommunityDmIdentity(senderId, peerUserId);
  if (!identity) {
    return { ok: false, error: 'dm_room_required', statusCode: 400 };
  }
  if (!identity.user_ids.includes(senderId)) {
    return { ok: false, error: 'sender_not_in_dm_room', statusCode: 403 };
  }
  const text = normalizeCommunityText(source.text || source.message || source.body || source.content || '');
  if (!text) {
    return { ok: false, error: 'text_required', statusCode: 400 };
  }
  const actor = normalizeCommunityActor(source, { app: appName || 'speakapp', id: senderId });
  const peerActor = normalizeCommunityActor(
    {
      user_id: identity.user_ids.find((candidate) => candidate !== senderId) || '',
      user_name: pickFirstString(source.peer_name, source.peerName),
      avatar: pickFirstString(source.peer_avatar, source.peerAvatar),
      app: pickFirstString(source.peer_app, source.peerApp)
    },
    {
      id: identity.user_ids.find((candidate) => candidate !== senderId) || '',
      app: 'english-course'
    }
  );
  const ensured = await ensureCommunityDmRoom({
    userId: identity.user_ids[0],
    peerUserId: identity.user_ids[1],
    actor,
    peerActor,
    emitLegacyOpen
  });
  if (!ensured.ok) return ensured;
  const message = buildCommunityDmMessage({
    identity,
    text,
    actor
  });
  appendCommunityDmMessage({
    identity,
    actor,
    peerActor,
    message
  });
  await pusher.trigger(identity.channel, 'chat_message', message);
  return {
    ok: true,
    room: listCommunityDmRoomsForUser(senderId).find((room) => room.room_id === identity.room_id) || ensured.room,
    message
  };
};

const getCommunityMessages = ({ roomType, roomId, limit }) => {
  const safeLimit = Math.min(toPositiveInteger(limit, 80), COMMUNITY_HISTORY_MAX_MESSAGES);
  if (roomType === 'public') {
    const history = loadCommunityHistory();
    return {
      ok: true,
      room_type: 'public',
      room_id: COMMUNITY_PUBLIC_CHANNEL,
      channel: COMMUNITY_PUBLIC_CHANNEL,
      presence_channel: COMMUNITY_PUBLIC_PRESENCE_CHANNEL,
      updated_at: history.updated_at || null,
      messages: history.messages.slice(-safeLimit)
    };
  }
  const identity = roomId
    ? buildCommunityDmIdentity(...String(roomId).split('_'))
    : null;
  if (!identity) {
    return { ok: false, error: 'invalid_room_id', statusCode: 400 };
  }
  const history = loadCommunityDmHistory(identity);
  return {
    ok: true,
    room_type: 'dm',
    room_id: identity.room_id,
    channel: identity.channel,
    updated_at: history.updated_at || null,
    messages: history.messages.slice(-safeLimit)
  };
};

const toLegacyChatRows = (messages, { newestFirst = true } = {}) => {
  const rows = (Array.isArray(messages) ? messages : []).map((message) => ({
    message_id: pickFirstString(message && message.id),
    created_at: pickFirstString(message && (message.created_at || message.published)),
    body: normalizeCommunityText(message && message.text),
    user_id: pickFirstString(message && message.actor && message.actor.id),
    display_name: pickFirstString(
      message && message.actor && (message.actor.displayName || message.actor.name || message.actor.email)
    ),
    image: pickFirstString(message && message.actor && message.actor.avatar),
    style: ''
  }));
  return newestFirst ? rows.slice().reverse() : rows;
};

const normalizeCommunityText = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeCommunityActor = (source, defaults = {}) => {
  const id = pickFirstString(source.user_id, source.userId, source.id, defaults.id);
  const name = pickFirstString(
    source.user_name,
    source.userName,
    source.nickname,
    source.displayName,
    source.display_name,
    source.name,
    source.email,
    defaults.name
  );
  return {
    id,
    name,
    displayName: name,
    email: pickFirstString(source.email, defaults.email),
    avatar: pickFirstString(source.avatar, source.image, source.img, defaults.avatar),
    app: pickFirstString(source.app, source.origen, source.origin, defaults.app) || 'speakapp',
    premium:
      source.premium === true ||
      source.premium === 'true' ||
      source.premium === 1 ||
      source.premium === '1' ||
      defaults.premium === true
  };
};

const createCommunityMessageId = () =>
  `cmsg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const buildPublicCommunityMessage = ({ text, actor, id, createdAt }) => {
  const timestamp = createdAt || new Date().toISOString();
  const actorId = pickFirstString(actor && actor.id);
  const actorName = pickFirstString(actor && (actor.name || actor.displayName || actor.email));
  return {
    id: pickFirstString(id) || createCommunityMessageId(),
    room_type: 'public',
    room_id: COMMUNITY_PUBLIC_CHANNEL,
    created_at: timestamp,
    published: timestamp,
    text: normalizeCommunityText(text),
    actor: {
      id: actorId,
      name: actorName,
      displayName: actorName,
      email: pickFirstString(actor && actor.email),
      avatar: pickFirstString(actor && actor.avatar),
      app: pickFirstString(actor && actor.app) || 'speakapp',
      premium: Boolean(actor && actor.premium)
    }
  };
};

const appendPublicCommunityMessage = (message) => {
  const history = loadCommunityHistory();
  history.messages.push(message);
  if (history.messages.length > COMMUNITY_HISTORY_MAX_MESSAGES) {
    history.messages = history.messages.slice(-COMMUNITY_HISTORY_MAX_MESSAGES);
  }
  history.updated_at = new Date().toISOString();
  saveCommunityHistory(history);
  return history;
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
    event.route_id || '',
    event.route_title || '',
    event.badge_index ?? '',
    event.badge_image || '',
    event.badge_title || '',
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
    route_id:
      rawEvent.route_id ??
      payload.route_id ??
      rawEvent.routeId ??
      payload.routeId,
    route_title:
      rawEvent.route_title ??
      payload.route_title ??
      rawEvent.routeTitle ??
      payload.routeTitle,
    badge_index:
      rawEvent.badge_index ??
      payload.badge_index ??
      rawEvent.badgeIndex ??
      payload.badgeIndex,
    badge_image:
      rawEvent.badge_image ??
      payload.badge_image ??
      rawEvent.badgeImage ??
      payload.badgeImage ??
      rawEvent.image ??
      payload.image,
    badge_title:
      rawEvent.badge_title ??
      payload.badge_title ??
      rawEvent.badgeTitle ??
      payload.badgeTitle ??
      rawEvent.title ??
      payload.title,
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
      const badgeIndex = coerceNumber(event.badge_index) || coerceNumber(prev.badgeIndex) || 0;
      snapshot.badges[event.badge_id] = {
        ...prev,
        routeId: event.route_id || prev.routeId || '',
        routeTitle: event.route_title || prev.routeTitle || '',
        badgeIndex,
        image: event.badge_image || prev.image || '',
        title: event.badge_title || prev.title || '',
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
  const parsedUserInfo = parseMaybeJson(source.user_info || source.userInfo);
  const fallbackUserInfo =
    parsedUserInfo && typeof parsedUserInfo === 'object'
      ? parsedUserInfo
      : {
          id: pickFirstString(source.user_id, source.userId, source.id),
          name: pickFirstString(
            source.name,
            source.user_name,
            source.userName,
            source.nickname,
            source.displayName,
            source.display_name,
            source.email
          ),
          email: pickFirstString(source.email),
          avatar: pickFirstString(source.avatar, source.image, source.img),
          app: pickFirstString(source.app, source.origen, source.origin),
          premium:
            source.premium === true ||
            source.premium === 'true' ||
            source.premium === 1 ||
            source.premium === '1'
        };
  return {
    socketId: source.socket_id || source.socketId,
    channelName: source.channel_name || source.channelName,
    userId: source.user_id || source.userId || source.id,
    userInfo: fallbackUserInfo
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

const fetchChannel = (channelName, params, cb) => {
  const appId = config.appId;
  const key = config.key;
  const secret = config.secret;
  if (!appId || !key || !secret) {
    cb(new Error('missing app credentials'));
    return;
  }
  const safeChannelName = pickFirstString(channelName);
  if (!safeChannelName) {
    cb(new Error('channel_name required'));
    return;
  }
  const encodedChannelName = encodeURIComponent(safeChannelName);
  const authParams = Object.assign({}, params, {
    auth_key: key,
    auth_timestamp: Math.floor(Date.now() / 1000),
    auth_version: '1.0'
  });
  const pathName = `/apps/${appId}/channels/${encodedChannelName}`;
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

const fetchChannelUsers = (channelName, params, cb) => {
  const appId = config.appId;
  const key = config.key;
  const secret = config.secret;
  if (!appId || !key || !secret) {
    cb(new Error('missing app credentials'));
    return;
  }
  const safeChannelName = pickFirstString(channelName);
  if (!safeChannelName) {
    cb(new Error('channel_name required'));
    return;
  }
  const encodedChannelName = encodeURIComponent(safeChannelName);
  const authParams = Object.assign({}, params, {
    auth_key: key,
    auth_timestamp: Math.floor(Date.now() / 1000),
    auth_version: '1.0'
  });
  const pathName = `/apps/${appId}/channels/${encodedChannelName}/users`;
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
  const safeUserId = pickFirstString(userId, userInfo && userInfo.id);

  if (!isPresence) {
    if (channelName.startsWith('private-coach')) {
      const ownerUserId = pickFirstString(parseCoachUserId(channelName));
      if (!safeUserId || !ownerUserId || safeUserId !== ownerUserId) {
        res.status(403).json({ error: 'unauthorized_channel' });
        return;
      }
      res.json(pusher.authenticate(socketId, channelName));
      return;
    }
    if (channelName.startsWith('private-')) {
      const identity = parseCommunityDmChannel(channelName);
      if (!identity || !safeUserId || !identity.user_ids.includes(safeUserId)) {
        res.status(403).json({ error: 'unauthorized_channel' });
        return;
      }
      res.json(pusher.authenticate(socketId, channelName));
      return;
    }
    res.json(pusher.authenticate(socketId, channelName));
    return;
  }

  if (!safeUserId) {
    res.status(400).json({ error: 'user_id required for presence channels' });
    return;
  }

  const presenceData = {
    user_id: String(safeUserId),
    user_info: userInfo || {}
  };
  if (channelName === COMMUNITY_PUBLIC_PRESENCE_CHANNEL) {
    upsertLegacyCommunityPresence({
      roomId: COMMUNITY_PUBLIC_CHANNEL,
      actor: normalizeCommunityActor(
        {
          ...(userInfo && typeof userInfo === 'object' ? userInfo : {}),
          user_id: safeUserId
        },
        {
          id: String(safeUserId),
          app: pickFirstString(userInfo && userInfo.app, userInfo && userInfo.origin, 'english-course')
        }
      ),
      sessionId: `legacy-auth:${String(socketId)}`
    });
  }
  res.json(pusher.authenticate(socketId, channelName, presenceData));
};

app.post('/realtime/auth', authHandler);
app.get('/realtime/auth', authHandler);
app.post('/chats/auth_v2', authHandler);
app.get('/chats/auth_v2', authHandler);
app.post('/chats/auth', authHandler);
app.get('/chats/auth', authHandler);

app.get('/realtime/community/rooms', (req, res) => {
  const userId = pickFirstString(req.query && (req.query.user_id || req.query.userId));
  const scope = pickFirstString(req.query && req.query.scope, 'dm').toLowerCase();
  if (!userId) {
    res.status(400).json({ ok: false, error: 'user_id_required' });
    return;
  }
  const response = {
    ok: true,
    scope,
    user_id: userId,
    rooms: []
  };
  if (scope === 'public' || scope === 'all') {
    response.public_room = {
      room_type: 'public',
      room_id: COMMUNITY_PUBLIC_CHANNEL,
      channel: COMMUNITY_PUBLIC_CHANNEL,
      presence_channel: COMMUNITY_PUBLIC_PRESENCE_CHANNEL
    };
  }
  if (scope === 'dm' || scope === 'all') {
    response.rooms = listCommunityDmRoomsForUser(userId);
  }
  res.json(response);
});

app.post('/realtime/community/rooms/dm', async (req, res) => {
  const source = Object.assign({}, req.query || {}, req.body || {});
  const userId = pickFirstString(source.user_id, source.userId, source.id);
  const peerUserId = pickFirstString(source.peer_user_id, source.peerUserId, source.user2, source.peer);
  if (!userId || !peerUserId) {
    res.status(400).json({ ok: false, error: 'user_id_and_peer_user_id_required' });
    return;
  }
  try {
    const payload = await ensureCommunityDmRoom({
      userId,
      peerUserId,
      actor: normalizeCommunityActor(source, { id: userId, app: pickFirstString(source.app, 'speakapp') }),
      peerActor: normalizeCommunityActor(
        {
          user_id: peerUserId,
          user_name: pickFirstString(source.peer_name, source.peerName, source.user2_name),
          avatar: pickFirstString(source.peer_avatar, source.peerAvatar),
          app: pickFirstString(source.peer_app, source.peerApp)
        },
        { id: peerUserId, app: 'english-course' }
      ),
      emitLegacyOpen: true
    });
    const statusCode = payload && payload.ok === false && payload.error === 'invalid_dm_users' ? 400 : 200;
    res.status(statusCode).json(payload);
  } catch (err) {
    console.error('[realtime] ensure dm room error', err.message || err);
    res.status(500).json({ ok: false, error: 'dm_room_failed' });
  }
});

app.get('/realtime/community/messages', (req, res) => {
  const roomType = pickFirstString(req.query && (req.query.room_type || req.query.roomType), 'public').toLowerCase();
  const roomId = pickFirstString(req.query && (req.query.room_id || req.query.roomId));
  const payload = getCommunityMessages({
    roomType,
    roomId: roomType === 'public' ? COMMUNITY_PUBLIC_CHANNEL : roomId,
    limit: req.query && req.query.limit
  });
  const statusCode = payload && payload.statusCode ? payload.statusCode : payload.ok === false ? 400 : 200;
  if (payload && Object.prototype.hasOwnProperty.call(payload, 'statusCode')) {
    delete payload.statusCode;
  }
  res.status(statusCode).json(payload);
});

app.get('/realtime/community/public/messages', (req, res) => {
  const payload = getCommunityMessages({
    roomType: 'public',
    roomId: COMMUNITY_PUBLIC_CHANNEL,
    limit: req.query && req.query.limit
  });
  res.json(payload);
});

app.get('/realtime/community/public/presence', (req, res) => {
  if (!authorizeState(req, res)) return;
  const summary = getCommunityPresenceSummary(COMMUNITY_PUBLIC_CHANNEL);
  res.json({
    ok: true,
    channel: COMMUNITY_PUBLIC_PRESENCE_CHANNEL,
    room_id: summary.room_id,
    updated_at: summary.updated_at,
    active_window_ms: COMMUNITY_PRESENCE_ACTIVE_WINDOW_MS,
    user_count: summary.user_count,
    subscription_count: summary.subscription_count,
    occupied: summary.occupied,
    users: Array.isArray(summary.users) ? summary.users : []
  });
});

app.post('/realtime/community/public/presence', (req, res) => {
  if (!authorizeState(req, res)) return;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const action = pickFirstString(body.action).toLowerCase() || 'heartbeat';
  const roomId = pickFirstString(body.room_id, body.roomId) || COMMUNITY_PUBLIC_CHANNEL;
  const actor = normalizeCommunityActor(body, { app: 'speakapp' });
  const sessionId = pickFirstString(body.session_id, body.sessionId);

  if (action === 'leave') {
    const result = removeCommunityPresenceSession({
      roomId,
      userId: actor.id,
      sessionId
    });
    if (!result.ok) {
      res.status(400).json({ ok: false, error: result.error || 'presence_leave_failed' });
      return;
    }
    res.json({
      ok: true,
      action: 'leave',
      channel: COMMUNITY_PUBLIC_PRESENCE_CHANNEL,
      room_id: result.summary.room_id,
      updated_at: result.summary.updated_at,
      active_window_ms: COMMUNITY_PRESENCE_ACTIVE_WINDOW_MS,
      user_count: result.summary.user_count,
      subscription_count: result.summary.subscription_count,
      occupied: result.summary.occupied,
      users: result.summary.users
    });
    return;
  }

  const result = upsertCommunityPresence({
    roomId,
    actor,
    sessionId
  });
  if (!result.ok) {
    res.status(400).json({ ok: false, error: result.error || 'presence_heartbeat_failed' });
    return;
  }
  res.json({
    ok: true,
    action: 'heartbeat',
    channel: COMMUNITY_PUBLIC_PRESENCE_CHANNEL,
    room_id: result.summary.room_id,
    updated_at: result.summary.updated_at,
    active_window_ms: COMMUNITY_PRESENCE_ACTIVE_WINDOW_MS,
    user_count: result.summary.user_count,
    subscription_count: result.summary.subscription_count,
    occupied: result.summary.occupied,
    users: result.summary.users
  });
});

const emitPublicCommunityMessage = async ({ source, appName }) => {
  const text = normalizeCommunityText(
    source.text || source.message || source.body || source.content || ''
  );
  if (!text) {
    return {
      ok: false,
      error: 'text_required',
      statusCode: 400
    };
  }
  const actor = normalizeCommunityActor(source, { app: appName || 'speakapp' });
  if (!actor.id) {
    return {
      ok: false,
      error: 'user_id_required',
      statusCode: 400
    };
  }
  const message = buildPublicCommunityMessage({
    text,
    actor
  });
  appendPublicCommunityMessage(message);
  if ((actor.app || '').toLowerCase() === 'english-course') {
    upsertLegacyCommunityPresence({
      roomId: COMMUNITY_PUBLIC_CHANNEL,
      actor,
      sessionId: `legacy-send:${actor.id}`
    });
  }
  await pusher.trigger(COMMUNITY_PUBLIC_CHANNEL, 'chat_message', message);
  return {
    ok: true,
    message
  };
};

app.post('/realtime/community/messages', async (req, res) => {
  const source = Object.assign({}, req.query || {}, req.body || {});
  const roomType = pickFirstString(source.room_type, source.roomType, 'public').toLowerCase();
  try {
    let payload;
    if (roomType === 'dm') {
      payload = await emitCommunityDmMessage({
        source,
        appName: pickFirstString(source.app, source.origen, source.origin, 'speakapp'),
        emitLegacyOpen: true
      });
    } else {
      payload = await emitPublicCommunityMessage({
        source,
        appName: pickFirstString(source.app, source.origen, source.origin, 'speakapp')
      });
    }
    const statusCode = payload && payload.statusCode ? payload.statusCode : 200;
    if (payload && Object.prototype.hasOwnProperty.call(payload, 'statusCode')) {
      delete payload.statusCode;
    }
    res.status(statusCode).json(payload);
  } catch (err) {
    console.error('[realtime] community message error', err.message || err);
    res.status(500).json({ ok: false, error: 'community_message_failed' });
  }
});

app.post('/realtime/community/public/messages', async (req, res) => {
  const source = Object.assign({}, req.query || {}, req.body || {});
  try {
    const payload = await emitPublicCommunityMessage({
      source,
      appName: pickFirstString(source.app, source.origen, source.origin, 'speakapp')
    });
    const statusCode = payload && payload.statusCode ? payload.statusCode : 200;
    if (payload && Object.prototype.hasOwnProperty.call(payload, 'statusCode')) {
      delete payload.statusCode;
    }
    res.status(statusCode).json(payload);
  } catch (err) {
    console.error('[realtime] community public message error', err.message || err);
    res.status(500).json({ ok: false, error: 'public_message_failed' });
  }
});

app.post('/v4/sendMessage', async (req, res) => {
  const source = Object.assign({}, req.query || {}, req.body || {});
  const channel = pickFirstString(source.channel, COMMUNITY_PUBLIC_CHANNEL);
  try {
    let payload;
    if (channel === COMMUNITY_PUBLIC_CHANNEL) {
      payload = await emitPublicCommunityMessage({
        source,
        appName: 'english-course'
      });
    } else {
      payload = await emitCommunityDmMessage({
        source: {
          ...source,
          room_type: 'dm',
          channel,
          user_name: pickFirstString(source.nickname, source.user_name, source.userName, source.name),
          avatar: pickFirstString(source.image, source.avatar, source.img),
          app: 'english-course'
        },
        appName: 'english-course',
        emitLegacyOpen: true
      });
    }
    const statusCode = payload && payload.statusCode ? payload.statusCode : 200;
    if (payload && Object.prototype.hasOwnProperty.call(payload, 'statusCode')) {
      delete payload.statusCode;
    }
    res.status(statusCode).json(payload);
  } catch (err) {
    console.error('[realtime] legacy sendMessage error', err.message || err);
    res.status(500).json({ ok: false, error: 'legacy_send_failed' });
  }
});

app.post('/v4/createPrivate', async (req, res) => {
  const source = Object.assign({}, req.query || {}, req.body || {});
  const userId = pickFirstString(source.user1, source.user_id, source.userId, source.id);
  const peerUserId = pickFirstString(source.user2, source.peer_user_id, source.peerUserId);
  try {
    const payload = await ensureCommunityDmRoom({
      userId,
      peerUserId,
      actor: normalizeCommunityActor(
        {
          user_id: userId,
          user_name: pickFirstString(source.user1_name, source.user_name, source.userName, source.name),
          app: 'english-course'
        },
        { id: userId, app: 'english-course' }
      ),
      peerActor: normalizeCommunityActor(
        {
          user_id: peerUserId,
          user_name: pickFirstString(source.user2_name, source.peer_name, source.peerName),
          app: 'english-course'
        },
        { id: peerUserId, app: 'english-course' }
      ),
      emitLegacyOpen: true
    });
    const statusCode = payload && payload.ok === false ? 400 : 200;
    res.status(statusCode).json(payload);
  } catch (err) {
    console.error('[realtime] legacy createPrivate error', err.message || err);
    res.status(500).json({ ok: false, error: 'legacy_create_private_failed' });
  }
});

app.post('/v4/getLastChats', (req, res) => {
  const source = Object.assign({}, req.query || {}, req.body || {});
  const channel = pickFirstString(source.channel, COMMUNITY_PUBLIC_CHANNEL);
  let payload;
  if (channel === COMMUNITY_PUBLIC_CHANNEL) {
    payload = getCommunityMessages({
      roomType: 'public',
      roomId: COMMUNITY_PUBLIC_CHANNEL,
      limit: source.limit || 60
    });
  } else {
    const identity = parseCommunityDmChannel(channel);
    payload = getCommunityMessages({
      roomType: 'dm',
      roomId: identity ? identity.room_id : '',
      limit: source.limit || 60
    });
  }
  if (!payload || payload.ok === false) {
    res.status(payload && payload.statusCode ? payload.statusCode : 400).json(payload || { ok: false });
    return;
  }
  res.json({
    ok: true,
    data: toLegacyChatRows(payload.messages, { newestFirst: true })
  });
});

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
  const resolvedUserId = pickFirstString(
    userMeta.userId,
    userMeta.user_id,
    userMeta.id,
    parseCoachUserId(channel)
  );
  const dailyLimitStatus = getChatbotDailyLimitStatus(resolvedUserId);
  if (dailyLimitStatus.limit_reached_today) {
    const limitText = `Sorry but you have reached the chatbot daily use limit. Come back tomorrow.` //Has alcanzado el limite diario del chatbot (${dailyLimitStatus.token_limit_day} tokens). Vuelve manana.`;
    pusher
      .trigger(channel, 'bot_message', {
        text: limitText,
        role: 'bot',
        coach_id: chatbotCoachId,
        chatbot_disabled: 'daily_token_limit',
        limit_reached: true,
        day: dailyLimitStatus.day,
        token_limit_day: dailyLimitStatus.token_limit_day,
        used_tokens_day: dailyLimitStatus.used_tokens_day,
        remaining_tokens_day: dailyLimitStatus.remaining_tokens_day
      })
      .catch((err) => {
        console.error('[realtime] chatbot limit message error', err.message || err);
      });
    return;
  }
  logChatbotInteraction({
    channel,
    text,
    userId: resolvedUserId,
    userName: userMeta.userName
  });
  generateChatbotReply(channel, text, userMeta)
    .then((reply) => {
      if (!reply) return;
      const ttsSource = {
        text: reply,
        locale: 'en-US',
        user_id: resolvedUserId,
        user_name: userMeta.userName
      };
      return buildAlignedTtsPayload(ttsSource)
        .then((ttsPayload) => {
          const botPayload = {
            text: reply,
            role: 'bot',
            coach_id: chatbotCoachId,
            speakText: reply
          };
          if (ttsPayload && ttsPayload.ok && ttsPayload.audio_url) {
            botPayload.audio_url = ttsPayload.audio_url;
            botPayload.audio_kind = ttsPayload.audio_kind || 'polly';
            botPayload.tts_provider = ttsPayload.provider || 'aws-polly';
          } else if (ttsPayload && !ttsPayload.ok) {
            const ttsError = pickFirstString(ttsPayload.error, ttsPayload.message);
            if (ttsError) {
              console.warn('[realtime] chatbot reply without prebuilt audio:', ttsError);
            }
          }
          return pusher.trigger(channel, 'bot_message', botPayload);
        });
    })
    .catch((err) => {
      console.error('[realtime] chatbot error', err.message || err);
    });
});

app.post('/realtime/tts/aligned', async (req, res) => {
  if (!authorizeUsage(req, res)) return;
  const source = Object.assign({}, req.query || {}, req.body || {});
  const payload = await buildAlignedTtsPayload(source);
  const statusCode = payload && payload.statusCode ? payload.statusCode : 200;
  if (payload && Object.prototype.hasOwnProperty.call(payload, 'statusCode')) {
    delete payload.statusCode;
  }
  res.status(statusCode).json(payload);
});

app.post('/realtime/pronunciation/assess', async (req, res) => {
  if (!authorizeUsage(req, res)) return;
  if (!pronAssessEnabled) {
    res.status(501).json({ ok: false, error: 'pronunciation_assess_not_configured' });
    return;
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const expectedText = normalizePronAssessText(
    pickFirstString(body.expected_text, body.expectedText, body.text, body.reference_text)
  );
  const locale = normalizePronAssessLocale(body.locale || body.lang || body.language);
  const userId = pickFirstString(body.user_id, body.userId, body.id);
  const userName = pickFirstString(body.user_name, body.userName, body.name);
  const debug = String(body.debug || '').trim() === '1' || body.debug === true;
  const audioBase64 = pickFirstString(body.audio_base64, body.audioBase64, body.audio);
  const audioContentType = pickFirstString(body.audio_content_type, body.audioContentType, 'audio/wav');
  const clientAudioSeconds = toNonNegativeNumber(body.audio_duration_sec, body.audioDurationSec ?? 0);
  const maxTextLen = toPositiveInteger(pronAssessTextMaxLen, 260);

  if (!expectedText) {
    res.status(400).json({ ok: false, error: 'expected_text_required' });
    return;
  }
  if (expectedText.length > maxTextLen) {
    res.status(400).json({
      ok: false,
      error: `expected_text_too_long_max_${maxTextLen}`,
      text_length: expectedText.length,
      max_length: maxTextLen
    });
    return;
  }
  if (!audioBase64) {
    res.status(400).json({ ok: false, error: 'audio_base64_required' });
    return;
  }

  let audioBuffer;
  try {
    audioBuffer = Buffer.from(audioBase64, 'base64');
  } catch (err) {
    res.status(400).json({ ok: false, error: 'invalid_audio_base64' });
    return;
  }
  if (!audioBuffer || !audioBuffer.length) {
    res.status(400).json({ ok: false, error: 'empty_audio' });
    return;
  }
  if (Number.isFinite(pronAssessAudioMaxBytes) && pronAssessAudioMaxBytes > 0 && audioBuffer.length > pronAssessAudioMaxBytes) {
    res.status(400).json({
      ok: false,
      error: 'audio_too_large',
      audio_bytes: audioBuffer.length,
      max_bytes: Math.floor(pronAssessAudioMaxBytes)
    });
    return;
  }

  const wavDuration = parseWavDurationSeconds(audioBuffer);
  const estimatedAudioSeconds = Number(
    Math.max(0, wavDuration ?? clientAudioSeconds ?? 0).toFixed(3)
  );
  const maxAudioSeconds = toNonNegativeNumber(pronAssessMaxAudioSeconds, 25);
  if (maxAudioSeconds > 0 && estimatedAudioSeconds > maxAudioSeconds) {
    res.status(400).json({
      ok: false,
      error: 'audio_too_long',
      audio_seconds: estimatedAudioSeconds,
      max_audio_seconds: maxAudioSeconds
    });
    return;
  }

  if (userId) {
    const limitStatus = getPronAssessDailyLimitStatus(userId);
    const hasLimit = limitStatus.seconds_limit_day > 0;
    const projected = estimatedAudioSeconds > 0 ? estimatedAudioSeconds : 1;
    const alreadyReached = Boolean(hasLimit && limitStatus.used_seconds_day >= limitStatus.seconds_limit_day);
    const wouldExceed = Boolean(
      hasLimit && limitStatus.used_seconds_day + projected > limitStatus.seconds_limit_day
    );
    if (alreadyReached || wouldExceed) {
      res.status(429).json({
        ok: false,
        error: 'pronunciation_daily_seconds_limit',
        message: 'Daily pronunciation assessment limit reached',
        provider: 'azure-speech',
        projected_audio_seconds: projected,
        would_exceed_today: wouldExceed,
        ...limitStatus
      });
      return;
    }
  }

  try {
    const startedAt = Date.now();
    const azureResponse = await requestAzurePronunciationAssessment({
      audioBuffer,
      locale,
      expectedText
    });
    const normalized = normalizeAzurePronunciationAssessment(azureResponse.body, expectedText);
    if (!normalized) {
      res.status(502).json({ ok: false, error: 'pronunciation_assess_invalid_provider_response' });
      return;
    }
    const actualAudioSeconds = Number(
      Math.max(
        0,
        estimatedAudioSeconds || 0,
        (Array.isArray(normalized.words) && normalized.words.length
          ? toNonNegativeNumber(normalized.words[normalized.words.length - 1]?.end_ms, 0) / 1000
          : 0)
      ).toFixed(3)
    );
    trackPronAssessDailyUsage({
      timestamp: new Date().toISOString(),
      user_id: userId || 'unknown',
      user_name: userName || '',
      locale,
      provider: 'azure-speech',
      audio_seconds: actualAudioSeconds,
      estimated_cost_usd: estimatePronAssessCostUsd(actualAudioSeconds)
    });
    const limitStatus = userId ? getPronAssessDailyLimitStatus(userId) : null;
    res.json({
      ok: true,
      provider: 'azure-speech',
      mode: 'advanced',
      locale,
      audio_content_type: audioContentType || 'audio/wav',
      audio_seconds: actualAudioSeconds,
      timing: {
        total_ms: Date.now() - startedAt
      },
      usage: {
        audio_seconds: actualAudioSeconds,
        estimated_cost_usd: Number(estimatePronAssessCostUsd(actualAudioSeconds).toFixed(6))
      },
      limit_status: limitStatus,
      ...normalized,
      ...(debug ? { provider_payload: azureResponse.body } : {})
    });
  } catch (err) {
    console.error('[realtime] pronunciation assess error', err.message || err);
    res.status(500).json({
      ok: false,
      error: 'pronunciation_assess_failed',
      message: err && err.message ? err.message : String(err)
    });
  }
});

app.get('/realtime/pronunciation/usage/daily', (req, res) => {
  if (!authorizeUsage(req, res)) return;
  const dayFilterRaw = pickFirstString(req.query.day);
  const fromRaw = pickFirstString(req.query.from, req.query.date_from);
  const toRaw = pickFirstString(req.query.to, req.query.date_to);
  const userIdFilter = pickFirstString(req.query.user_id, req.query.userId);
  const limitValue = Number(req.query.limit);
  const limit = Number.isFinite(limitValue) && limitValue > 0 ? Math.min(Math.floor(limitValue), 5000) : 300;

  const dayFilter = dayFilterRaw ? formatUsageDay(dayFilterRaw) : '';
  const fromFilter = fromRaw ? formatUsageDay(fromRaw) : '';
  const toFilter = toRaw ? formatUsageDay(toRaw) : '';
  if ((dayFilterRaw && !dayFilter) || (fromRaw && !fromFilter) || (toRaw && !toFilter)) {
    res.status(400).json({ error: 'invalid date format (expected YYYY-MM-DD)' });
    return;
  }
  if (fromFilter && toFilter && fromFilter > toFilter) {
    res.status(400).json({ error: '"from" must be before or equal to "to"' });
    return;
  }

  prunePronAssessDailyUsage();
  const rows = Array.from(pronAssessDailyUsageByUserDay.values())
    .sort(pronUsageRowSort)
    .filter((row) => {
      if (dayFilter && row.day !== dayFilter) return false;
      if (fromFilter && row.day < fromFilter) return false;
      if (toFilter && row.day > toFilter) return false;
      if (userIdFilter && row.user_id !== userIdFilter) return false;
      return true;
    });

  res.json({
    ok: true,
    enabled: pronAssessEnabled,
    count: rows.length,
    returned: Math.min(rows.length, limit),
    truncated: rows.length > limit,
    limit_status: userIdFilter ? getPronAssessDailyLimitStatus(userIdFilter) : null,
    totals: summarizePronAssessUsageRows(rows),
    rows: rows.slice(0, limit)
  });
});

app.get('/realtime/pronunciation/usage/limit', (req, res) => {
  if (!authorizeUsage(req, res)) return;
  const userId = pickFirstString(req.query.user_id, req.query.userId);
  if (!userId) {
    res.status(400).json({ error: 'user_id required' });
    return;
  }
  res.json({ ok: true, ...getPronAssessDailyLimitStatus(userId) });
});

app.post('/realtime/pronunciation/usage/limit', (req, res) => {
  if (!authorizeUsage(req, res)) return;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const userId = pickFirstString(body.user_id, body.userId, req.query.user_id, req.query.userId);
  if (!userId) {
    res.status(400).json({ error: 'user_id required' });
    return;
  }
  const requestedLimit = Number(body.seconds_limit_day ?? body.secondsLimitDay);
  if (!Number.isFinite(requestedLimit)) {
    res.status(400).json({ error: 'seconds_limit_day must be a number' });
    return;
  }
  setPronAssessDailySecondsLimit(userId, requestedLimit);
  res.json({ ok: true, updated: true, ...getPronAssessDailyLimitStatus(userId) });
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

app.get('/realtime/tts/usage/daily', (req, res) => {
  if (!authorizeUsage(req, res)) return;

  if (!ttsUsageDailyEnabled) {
    res.json({
      ok: true,
      enabled: false,
      rows: [],
      totals: summarizeTtsUsageRows([])
    });
    return;
  }

  const dayFilterRaw = pickFirstString(req.query.day);
  const fromRaw = pickFirstString(req.query.from, req.query.date_from);
  const toRaw = pickFirstString(req.query.to, req.query.date_to);
  const userIdFilter = pickFirstString(req.query.user_id, req.query.userId);
  const localeFilter = pickFirstString(req.query.locale, req.query.lang, req.query.language);
  const engineFilter = pickFirstString(req.query.engine);
  const limitValue = Number(req.query.limit);
  const limit = Number.isFinite(limitValue) && limitValue > 0 ? Math.min(Math.floor(limitValue), 5000) : 300;

  const dayFilter = dayFilterRaw ? formatUsageDay(dayFilterRaw) : '';
  if (dayFilterRaw && !dayFilter) {
    res.status(400).json({ error: 'invalid day format (expected YYYY-MM-DD)' });
    return;
  }
  const fromFilter = fromRaw ? formatUsageDay(fromRaw) : '';
  if (fromRaw && !fromFilter) {
    res.status(400).json({ error: 'invalid from format (expected YYYY-MM-DD)' });
    return;
  }
  const toFilter = toRaw ? formatUsageDay(toRaw) : '';
  if (toRaw && !toFilter) {
    res.status(400).json({ error: 'invalid to format (expected YYYY-MM-DD)' });
    return;
  }
  if (fromFilter && toFilter && fromFilter > toFilter) {
    res.status(400).json({ error: '"from" must be before or equal to "to"' });
    return;
  }

  const rows = serializeTtsDailyUsageRows().filter((row) => {
    if (dayFilter && row.day !== dayFilter) return false;
    if (fromFilter && row.day < fromFilter) return false;
    if (toFilter && row.day > toFilter) return false;
    if (userIdFilter && row.user_id !== userIdFilter) return false;
    if (localeFilter && String(row.locale || '') !== localeFilter) return false;
    if (engineFilter && String(row.engine || '') !== engineFilter) return false;
    return true;
  });

  const totals = summarizeTtsUsageRows(rows);
  const outputRows = rows.slice(0, limit);
  const limitStatus = userIdFilter ? getTtsDailyLimitStatus(userIdFilter) : null;

  res.json({
    ok: true,
    enabled: true,
    count: rows.length,
    returned: outputRows.length,
    truncated: rows.length > outputRows.length,
    filters: {
      day: dayFilter || '',
      from: fromFilter || '',
      to: toFilter || '',
      user_id: userIdFilter || '',
      locale: localeFilter || '',
      engine: engineFilter || '',
      limit
    },
    limit_status: limitStatus,
    totals,
    rows: outputRows
  });
});

app.get('/realtime/tts/usage/limit', (req, res) => {
  if (!authorizeUsage(req, res)) return;
  const userId = pickFirstString(req.query.user_id, req.query.userId);
  if (!userId) {
    res.status(400).json({ error: 'user_id required' });
    return;
  }
  const status = getTtsDailyLimitStatus(userId);
  res.json({
    ok: true,
    ...status
  });
});

app.post('/realtime/tts/usage/limit', (req, res) => {
  if (!authorizeUsage(req, res)) return;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const userId = pickFirstString(body.user_id, body.userId, req.query.user_id, req.query.userId);
  if (!userId) {
    res.status(400).json({ error: 'user_id required' });
    return;
  }
  const requestedLimit = Number(body.char_limit_day ?? body.charLimitDay ?? body.chars_limit_day);
  if (!Number.isFinite(requestedLimit)) {
    res.status(400).json({ error: 'char_limit_day must be a number' });
    return;
  }
  setTtsDailyCharLimit(userId, requestedLimit);
  const status = getTtsDailyLimitStatus(userId);
  res.json({
    ok: true,
    updated: true,
    ...status
  });
});

app.get('/realtime/chatbot/usage/daily', (req, res) => {
  if (!authorizeUsage(req, res)) return;

  if (!usageDailyEnabled) {
    res.json({
      ok: true,
      enabled: false,
      rows: [],
      totals: summarizeUsageRows([])
    });
    return;
  }

  const dayFilterRaw = pickFirstString(req.query.day);
  const fromRaw = pickFirstString(req.query.from, req.query.date_from);
  const toRaw = pickFirstString(req.query.to, req.query.date_to);
  const userIdFilter = pickFirstString(req.query.user_id, req.query.userId);
  const coachIdFilter = pickFirstString(req.query.coach_id, req.query.coachId);
  const limitValue = Number(req.query.limit);
  const limit = Number.isFinite(limitValue) && limitValue > 0 ? Math.min(Math.floor(limitValue), 5000) : 300;

  const dayFilter = dayFilterRaw ? formatUsageDay(dayFilterRaw) : '';
  if (dayFilterRaw && !dayFilter) {
    res.status(400).json({ error: 'invalid day format (expected YYYY-MM-DD)' });
    return;
  }
  const fromFilter = fromRaw ? formatUsageDay(fromRaw) : '';
  if (fromRaw && !fromFilter) {
    res.status(400).json({ error: 'invalid from format (expected YYYY-MM-DD)' });
    return;
  }
  const toFilter = toRaw ? formatUsageDay(toRaw) : '';
  if (toRaw && !toFilter) {
    res.status(400).json({ error: 'invalid to format (expected YYYY-MM-DD)' });
    return;
  }
  if (fromFilter && toFilter && fromFilter > toFilter) {
    res.status(400).json({ error: '"from" must be before or equal to "to"' });
    return;
  }

  const rows = serializeOpenAIDailyUsageRows().filter((row) => {
    if (dayFilter && row.day !== dayFilter) return false;
    if (fromFilter && row.day < fromFilter) return false;
    if (toFilter && row.day > toFilter) return false;
    if (userIdFilter && row.user_id !== userIdFilter) return false;
    if (coachIdFilter && String(row.coach_id || '') !== coachIdFilter) return false;
    return true;
  });

  const totals = summarizeUsageRows(rows);
  const outputRows = rows.slice(0, limit);
  const limitStatus = userIdFilter ? getChatbotDailyLimitStatus(userIdFilter) : null;

  res.json({
    ok: true,
    enabled: true,
    count: rows.length,
    returned: outputRows.length,
    truncated: rows.length > outputRows.length,
    filters: {
      day: dayFilter || '',
      from: fromFilter || '',
      to: toFilter || '',
      user_id: userIdFilter || '',
      coach_id: coachIdFilter || '',
      limit
    },
    limit_status: limitStatus,
    totals,
    rows: outputRows
  });
});

app.get('/realtime/chatbot/usage/limit', (req, res) => {
  if (!authorizeUsage(req, res)) return;
  const userId = pickFirstString(req.query.user_id, req.query.userId);
  if (!userId) {
    res.status(400).json({ error: 'user_id required' });
    return;
  }
  const status = getChatbotDailyLimitStatus(userId);
  res.json({
    ok: true,
    ...status
  });
});

app.post('/realtime/chatbot/usage/limit', (req, res) => {
  if (!authorizeUsage(req, res)) return;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const userId = pickFirstString(body.user_id, body.userId, req.query.user_id, req.query.userId);
  if (!userId) {
    res.status(400).json({ error: 'user_id required' });
    return;
  }
  const requestedLimit = Number(body.token_limit_day ?? body.tokenLimitDay);
  if (!Number.isFinite(requestedLimit)) {
    res.status(400).json({ error: 'token_limit_day must be a number' });
    return;
  }
  setChatbotDailyTokenLimit(userId, requestedLimit);
  const status = getChatbotDailyLimitStatus(userId);
  res.json({
    ok: true,
    updated: true,
    ...status
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

process.on('SIGINT', () => {
  flushOpenAIDailyUsageSync();
  flushChatbotDailyLimitsSync();
  flushTtsDailyUsageSync();
  flushTtsDailyLimitsSync();
  process.exit(0);
});

process.on('SIGTERM', () => {
  flushOpenAIDailyUsageSync();
  flushChatbotDailyLimitsSync();
  flushTtsDailyUsageSync();
  flushTtsDailyLimitsSync();
  process.exit(0);
});

const port = Number(env('REALTIME_GATEWAY_PORT', '8787'));
app.listen(port, () => {
  console.log(`Realtime gateway listening on :${port} (${provider})`);
});
