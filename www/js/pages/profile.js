import { getAppLocale, setAppLocale, getActiveLocale, getLocaleOverride, setLocaleOverride, clearLocaleOverride, onboardingDone, setLoginTabsLock } from '../state.js';
import {
  isAppNotificationsEnabled,
  isAppTitlebarEnabled,
  renderAppHeader
} from '../components/app-header.js';
import { ensureTrainingData, getRoutes, setSelection } from '../data/training-data.js';
import { ensureReferenceData, getLocalizedMapField, getReferenceCourses } from '../data/reference-data.js';
import {
  ensureReferenceTestsData,
  getLocalizedReferenceTestValue,
  getReferenceTestCourses
} from '../data/reference-tests.js';
import { getNextLocaleCode, getProfileCopy, getTabsCopy, resolveLocale } from '../content/copy.js';
import { goToSpeak } from '../nav.js';
import {
  HERO_MASCOT_FRAMES as PROFILE_AUTH_MASCOT_FRAMES,
  HERO_MASCOT_FRAME_INTERVAL_MS as PROFILE_AUTH_MASCOT_FRAME_INTERVAL_MS,
  HERO_MASCOT_REST_FRAME as PROFILE_AUTH_MASCOT_REST_FRAME,
  HERO_MASCOT_TALK_FRAME_SEQUENCE as PROFILE_AUTH_MASCOT_TALK_FRAME_SEQUENCE,
  preloadHeroMascotFrames
} from '../mascot-frames.js';
import { createSheetController } from '../sheet-controller.js';

const REFERENCE_TESTS_PROGRESS_STORAGE_PREFIX = 'appv5:reference-tests-progress';
const FREE_RIDE_HEADER_COLOR_KEY = 'appv5:free-ride-header-color';
const FREE_RIDE_CARD_PADDED_KEY = 'appv5:free-ride-card-padded';
const FREE_RIDE_HEADER_COLOR_VALUES = ['white', 'dark', 'blue'];
const PROFILE_SHEET_EXPANDED_KEY = 'appv5:profile-sheet-expanded';
const PROFILE_SHEET_OFFSET_KEY = 'appv5:profile-sheet-expanded-offset';
const PROFILE_AUTH_ALIGNED_CACHE_MAX_ITEMS = 12;
const TTS_LANG_BY_LOCALE = {
  es: 'es-ES',
  en: 'en-US'
};

const getResolvedUserName = (user) => {
  if (!user || typeof user !== 'object') return '';
  const derived = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return derived || String(user.name || user.email || user.social_id || '').trim();
};

const getStoredHeaderColor = () => {
  try {
    const raw = String(localStorage.getItem(FREE_RIDE_HEADER_COLOR_KEY) || '').trim().toLowerCase();
    return FREE_RIDE_HEADER_COLOR_VALUES.includes(raw) ? raw : 'blue';
  } catch (_err) {
    return 'blue';
  }
};

const isFreeRideCardPadded = () => {
  const cached = window.r34lp0w3r && window.r34lp0w3r.freeRideCardPadded;
  if (typeof cached === 'boolean') return cached;
  try {
    const raw = localStorage.getItem(FREE_RIDE_CARD_PADDED_KEY);
    if (raw === null || raw === undefined || raw === '') return true;
    const normalized = String(raw).trim().toLowerCase();
    return ['1', 'true', 'on', 'yes'].includes(normalized);
  } catch (_err) {
    return true;
  }
};

const escHtml = (v) =>
  String(v || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

class PageProfile extends HTMLElement {
  constructor() {
    super();
    this.authNarrationToken = 0;
    this.authNarrationAudio = null;
    this.authAlignedTtsCache = new Map();
    this.authNarrationPromise = null;
    this.state = {
      localeOverride: ''
    };
    this._authEntrySettleRaf = 0;
    this._lastRenderedLoggedIn = null;
  }

  settleLoggedOutEntryFrame() {
    if (this._authEntrySettleRaf) {
      cancelAnimationFrame(this._authEntrySettleRaf);
      this._authEntrySettleRaf = 0;
    }
    this.classList.add('profile-auth-entering');
    this._authEntrySettleRaf = requestAnimationFrame(() => {
      this._authEntrySettleRaf = requestAnimationFrame(() => {
        this.classList.remove('profile-auth-entering');
        this._authEntrySettleRaf = 0;
      });
    });
  }

  normalizeAuthMascotFrameIndex(frameIndex) {
    const value = Number(frameIndex);
    if (!Number.isFinite(value)) return PROFILE_AUTH_MASCOT_REST_FRAME;
    const rounded = Math.round(value);
    return Math.min(Math.max(rounded, 0), PROFILE_AUTH_MASCOT_FRAMES.length - 1);
  }

  getAuthMascotFramePath(frameIndex = PROFILE_AUTH_MASCOT_REST_FRAME) {
    const normalized = this.normalizeAuthMascotFrameIndex(frameIndex);
    return PROFILE_AUTH_MASCOT_FRAMES[normalized] || PROFILE_AUTH_MASCOT_FRAMES[PROFILE_AUTH_MASCOT_REST_FRAME];
  }

  getAuthMascotImageEl() {
    return this.querySelector('#profile-auth-hero-mascot');
  }

  renderAuthMascotFrame(frameIndex) {
    const normalized = this.normalizeAuthMascotFrameIndex(frameIndex);
    this.authMascotFrameIndex = normalized;
    const imageEl = this.getAuthMascotImageEl();
    if (!imageEl) return;
    const nextSrc = this.getAuthMascotFramePath(normalized);
    if (imageEl.getAttribute('src') !== nextSrc) {
      imageEl.setAttribute('src', nextSrc);
    }
  }

  startAuthMascotTalk() {
    if (this.authMascotIsTalking) return;
    this.authMascotIsTalking = true;
    if (this.authMascotFrameTimer) {
      clearInterval(this.authMascotFrameTimer);
      this.authMascotFrameTimer = null;
    }
    if (!Array.isArray(PROFILE_AUTH_MASCOT_TALK_FRAME_SEQUENCE) || !PROFILE_AUTH_MASCOT_TALK_FRAME_SEQUENCE.length) {
      this.renderAuthMascotFrame(PROFILE_AUTH_MASCOT_REST_FRAME);
      return;
    }
    let sequenceIndex = 0;
    this.renderAuthMascotFrame(PROFILE_AUTH_MASCOT_TALK_FRAME_SEQUENCE[sequenceIndex]);
    this.authMascotFrameTimer = setInterval(() => {
      if (!this.authMascotIsTalking) return;
      sequenceIndex = (sequenceIndex + 1) % PROFILE_AUTH_MASCOT_TALK_FRAME_SEQUENCE.length;
      this.renderAuthMascotFrame(PROFILE_AUTH_MASCOT_TALK_FRAME_SEQUENCE[sequenceIndex]);
    }, PROFILE_AUTH_MASCOT_FRAME_INTERVAL_MS);
  }

  stopAuthMascotTalk({ settle = true } = {}) {
    this.authMascotIsTalking = false;
    if (this.authMascotFrameTimer) {
      clearInterval(this.authMascotFrameTimer);
      this.authMascotFrameTimer = null;
    }
    if (settle) {
      this.renderAuthMascotFrame(PROFILE_AUTH_MASCOT_REST_FRAME);
    }
  }

  getNativeTtsPlugin() {
    if (!this.isNativeRuntime()) return null;
    if (typeof window === 'undefined') return null;
    const plugins =
      window && window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins : null;
    if (!plugins) return null;
    return plugins.TextToSpeech || null;
  }

  isNativeRuntime() {
    if (typeof window === 'undefined') return false;
    const capacitor = window.Capacitor;
    if (!capacitor) return false;
    if (typeof capacitor.isNativePlatform === 'function') {
      return Boolean(capacitor.isNativePlatform());
    }
    return capacitor.platform === 'ios' || capacitor.platform === 'android';
  }

  canWebSpeak() {
    return (
      typeof window !== 'undefined' &&
      typeof window.speechSynthesis !== 'undefined' &&
      typeof window.SpeechSynthesisUtterance !== 'undefined'
    );
  }

  waitForWebVoices(timeoutMs = 1200) {
    if (!this.canWebSpeak()) return Promise.resolve([]);
    const synth = window.speechSynthesis;
    const voicesNow = typeof synth.getVoices === 'function' ? synth.getVoices() : [];
    if (voicesNow.length) return Promise.resolve(voicesNow);
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        if (typeof synth.removeEventListener === 'function') {
          synth.removeEventListener('voiceschanged', onVoicesChanged);
        } else {
          synth.onvoiceschanged = null;
        }
        const voices = typeof synth.getVoices === 'function' ? synth.getVoices() : [];
        resolve(voices);
      };
      const onVoicesChanged = () => {
        finish();
      };
      if (typeof synth.addEventListener === 'function') {
        synth.addEventListener('voiceschanged', onVoicesChanged, { once: true });
      } else {
        synth.onvoiceschanged = onVoicesChanged;
      }
      setTimeout(finish, Math.max(0, timeoutMs));
    });
  }

  waitForDocumentVisible(timeoutMs = 1600) {
    if (typeof document === 'undefined') return Promise.resolve();
    if (document.visibilityState === 'visible') return Promise.resolve();
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        document.removeEventListener('visibilitychange', onChange);
        resolve();
      };
      const onChange = () => {
        if (document.visibilityState === 'visible') finish();
      };
      document.addEventListener('visibilitychange', onChange);
      setTimeout(finish, Math.max(0, timeoutMs));
    });
  }

  extractSpeechText(value) {
    const container = document.createElement('div');
    container.innerHTML = String(value || '');
    return String(container.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  extractNarrationLines(value) {
    const raw = String(value || '');
    if (!raw.trim()) return [];
    const normalized = raw
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\/p>\s*<p>/gi, '\n')
      .replace(/<\/li>\s*<li>/gi, '\n');
    const lines = normalized
      .split(/\r?\n+/)
      .map((part) => {
        const html = String(part || '').trim();
        const text = this.extractSpeechText(html);
        if (!text) return null;
        return { text, html };
      })
      .filter(Boolean);
    if (lines.length) return lines;
    const fallback = this.extractSpeechText(raw);
    return fallback ? [{ text: fallback, html: '' }] : [];
  }

  resolveAlignedTtsEndpoint() {
    const cfg = window.realtimeConfig || {};
    const direct = cfg.ttsAlignedEndpoint || window.REALTIME_TTS_ALIGNED_ENDPOINT;
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    const emitEndpoint = cfg.emitEndpoint;
    if (typeof emitEndpoint === 'string' && emitEndpoint.trim()) {
      const trimmed = emitEndpoint.trim().replace(/\/+$/, '');
      if (trimmed.endsWith('/emit')) return `${trimmed.slice(0, -5)}/tts/aligned`;
    }
    return 'https://realtime.curso-ingles.com/realtime/tts/aligned';
  }

  buildAlignedTtsHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const cfg = window.realtimeConfig || {};
    const token = typeof cfg.authToken === 'string' ? cfg.authToken.trim() : '';
    if (token) headers['x-rt-token'] = token;
    return headers;
  }

  normalizeAlignedTtsRequestOptions(options = {}) {
    const source = options && typeof options === 'object' ? options : {};
    const voiceProfile = String(source.voiceProfile || source.voice_profile || '').trim().toLowerCase();
    const voice = String(source.voice || '').trim();
    const engine = String(source.engine || '').trim().toLowerCase();
    const rate = String(source.rate || '').trim();
    const pitch = String(source.pitch || '').trim();
    return { voiceProfile, voice, engine, rate, pitch };
  }

  getAuthNarrationTtsOptions() {
    return {};
  }

  getAuthAlignedTtsCacheKey(text, lang, options = {}) {
    const normalized = this.normalizeAlignedTtsRequestOptions(options);
    return [
      String(lang || '').trim().toLowerCase(),
      String(text || '').trim(),
      normalized.voiceProfile,
      normalized.voice,
      normalized.engine,
      normalized.rate,
      normalized.pitch
    ].join('::');
  }

  getAuthAlignedTtsFromCache(text, lang, options = {}) {
    const key = this.getAuthAlignedTtsCacheKey(text, lang, options);
    if (!key || !this.authAlignedTtsCache.has(key)) return null;
    const cached = this.authAlignedTtsCache.get(key);
    this.authAlignedTtsCache.delete(key);
    this.authAlignedTtsCache.set(key, cached);
    return cached;
  }

  storeAuthAlignedTtsInCache(text, lang, payload, options = {}) {
    const key = this.getAuthAlignedTtsCacheKey(text, lang, options);
    if (!key || !payload) return;
    this.authAlignedTtsCache.set(key, payload);
    while (this.authAlignedTtsCache.size > PROFILE_AUTH_ALIGNED_CACHE_MAX_ITEMS) {
      const oldest = this.authAlignedTtsCache.keys().next();
      if (oldest && !oldest.done) this.authAlignedTtsCache.delete(oldest.value);
      else break;
    }
  }

  async fetchAuthAlignedTts(text, lang, options = {}) {
    const expected = String(text || '').trim();
    const locale = String(lang || '').trim() || 'en-US';
    if (!expected) return null;
    const normalizedOptions = this.normalizeAlignedTtsRequestOptions(options);
    const cached = this.getAuthAlignedTtsFromCache(expected, locale, normalizedOptions);
    if (cached) return cached;
    const endpoint = this.resolveAlignedTtsEndpoint();
    if (!endpoint) return null;
    const body = { text: expected, locale };
    if (normalizedOptions.voiceProfile) body.voice_profile = normalizedOptions.voiceProfile;
    if (normalizedOptions.voice) body.voice = normalizedOptions.voice;
    if (normalizedOptions.engine) body.engine = normalizedOptions.engine;
    if (normalizedOptions.rate) body.rate = normalizedOptions.rate;
    if (normalizedOptions.pitch) body.pitch = normalizedOptions.pitch;
    const user = window.user;
    if (user && user.id !== undefined && user.id !== null && String(user.id).trim()) {
      body.user_id = String(user.id).trim();
    }
    const userName = getResolvedUserName(user);
    if (userName) body.user_name = userName;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.buildAlignedTtsHeaders(),
      body: JSON.stringify(body)
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || data.ok !== true) return null;
    if (typeof data.audio_url !== 'string' || !data.audio_url.trim()) return null;
    this.storeAuthAlignedTtsInCache(expected, locale, data, normalizedOptions);
    return data;
  }

  setAuthBubbleSpeaking(isSpeaking) {
    const bubbleEl = this.querySelector('#profile-auth-hero-bubble');
    if (!bubbleEl) return;
    bubbleEl.classList.toggle('is-speaking', Boolean(isSpeaking));
  }

  async stopAuthNarrationPlayback() {
    if (this.authNarrationAudio) {
      try {
        this.authNarrationAudio.pause();
        this.authNarrationAudio.currentTime = 0;
      } catch (_err) {
        // no-op
      }
      this.authNarrationAudio.onplaying = null;
      this.authNarrationAudio.onended = null;
      this.authNarrationAudio.onerror = null;
      this.authNarrationAudio = null;
    }
    const plugin = this.getNativeTtsPlugin();
    if (plugin && typeof plugin.stop === 'function') {
      try {
        await plugin.stop();
      } catch (_err) {
        // no-op
      }
    }
    if (this.canWebSpeak() && typeof window.speechSynthesis.cancel === 'function') {
      if (typeof window.cancelWebSpeech === 'function') window.cancelWebSpeech();
      else window.speechSynthesis.cancel();
    }
    this.stopAuthMascotTalk({ settle: true });
    this.setAuthBubbleSpeaking(false);
  }

  async stopAuthHeroSpeech() {
    this.authNarrationToken += 1;
    await this.stopAuthNarrationPlayback();
  }

  async speakAuthNarrationWeb(text, lang, token, voiceWaitMs = 1200, hooks = {}) {
    if (!this.canWebSpeak()) return false;
    await this.waitForDocumentVisible(1800);
    if (token !== this.authNarrationToken) return true;
    await this.waitForWebVoices(voiceWaitMs);
    if (token !== this.authNarrationToken) return true;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    return new Promise((resolve) => {
      let settled = false;
      let playbackEnded = false;
      const notifyPlaybackStart = () => {
        if (typeof hooks.onPlaybackStart === 'function') hooks.onPlaybackStart();
      };
      const notifyPlaybackEnd = () => {
        if (playbackEnded) return;
        playbackEnded = true;
        if (typeof hooks.onPlaybackEnd === 'function') hooks.onPlaybackEnd();
      };
      const settle = (started) => {
        if (settled) return;
        settled = true;
        clearTimeout(startTimeout);
        resolve(started);
      };
      const startTimeout = setTimeout(() => settle(false), 1800);
      utter.onstart = () => {
        notifyPlaybackStart();
        settle(true);
      };
      utter.onend = () => {
        notifyPlaybackEnd();
      };
      utter.onerror = () => {
        notifyPlaybackEnd();
        settle(false);
      };
      try {
        const started =
          typeof window.speakWebUtterance === 'function'
            ? window.speakWebUtterance(utter)
            : (() => {
                window.speechSynthesis.speak(utter);
                return true;
              })();
        if (!started) {
          notifyPlaybackEnd();
          settle(false);
        }
      } catch (_err) {
        notifyPlaybackEnd();
        settle(false);
      }
    });
  }

  async playAuthNarrationAligned(text, lang, token, hooks = {}, ttsOptions = {}) {
    const lineText = String(text || '').trim();
    if (!lineText || token !== this.authNarrationToken) return false;
    let payload = null;
    try {
      payload = await this.fetchAuthAlignedTts(lineText, lang, ttsOptions);
    } catch (_err) {
      payload = null;
    }
    if (!payload && ttsOptions && Object.keys(ttsOptions).length) {
      try {
        payload = await this.fetchAuthAlignedTts(lineText, lang);
      } catch (_err) {
        payload = null;
      }
    }
    if (!payload || token !== this.authNarrationToken) return false;
    const audioUrl = String(payload.audio_url || '').trim();
    if (!audioUrl) return false;
    const onPlaybackStart =
      hooks && typeof hooks.onPlaybackStart === 'function' ? hooks.onPlaybackStart : null;
    const onPlaybackEnd =
      hooks && typeof hooks.onPlaybackEnd === 'function' ? hooks.onPlaybackEnd : null;
    const audio = new Audio(audioUrl);
    audio.preload = 'auto';
    return new Promise((resolve) => {
      let started = false;
      let settled = false;
      let cancelTimer = null;
      let startTimeout = null;
      let maxTimeout = null;
      const notifyStart = () => {
        if (started) return;
        started = true;
        if (onPlaybackStart) onPlaybackStart();
      };
      const cleanup = () => {
        if (cancelTimer) clearInterval(cancelTimer);
        if (startTimeout) clearTimeout(startTimeout);
        if (maxTimeout) clearTimeout(maxTimeout);
        cancelTimer = null;
        startTimeout = null;
        maxTimeout = null;
        audio.onplaying = null;
        audio.onended = null;
        audio.onerror = null;
        if (this.authNarrationAudio === audio) this.authNarrationAudio = null;
      };
      const settle = () => {
        if (settled) return;
        settled = true;
        cleanup();
        if (onPlaybackEnd) onPlaybackEnd();
        resolve(started);
      };
      cancelTimer = setInterval(() => {
        if (settled) return;
        if (token !== this.authNarrationToken) {
          try {
            audio.pause();
            audio.currentTime = 0;
          } catch (_err) {
            // no-op
          }
          settle();
        }
      }, 80);
      startTimeout = setTimeout(() => settle(), 1800);
      const payloadDurationMs = Number(payload && (payload.duration_ms || payload.durationMs || 0)) || 0;
      const estimatedMs = Math.min(
        18000,
        Math.max(1600, payloadDurationMs > 0 ? payloadDurationMs + 1800 : Math.round(lineText.length * 80) + 3200)
      );
      maxTimeout = setTimeout(() => settle(), estimatedMs);
      audio.onplaying = () => notifyStart();
      audio.onended = () => settle();
      audio.onerror = () => settle();
      this.authNarrationAudio = audio;
      audio
        .play()
        .then(() => {
          if (token !== this.authNarrationToken) {
            try {
              audio.pause();
              audio.currentTime = 0;
            } catch (_err) {
              // no-op
            }
            settle();
            return;
          }
          notifyStart();
        })
        .catch(() => settle());
    });
  }

  async speakAuthNarration(linesOrText, locale, options = {}) {
    const lines = Array.isArray(linesOrText)
      ? linesOrText.filter((line) => line && typeof line.text === 'string' && line.text.trim())
      : this.extractNarrationLines(linesOrText);
    if (!lines.length) return false;
    const normalizedLocale = String(locale || 'en').trim().toLowerCase().split('-')[0];
    const lang = TTS_LANG_BY_LOCALE[normalizedLocale] || 'en-US';
    const token = ++this.authNarrationToken;
    const bubbleEl = options && options.bubbleEl ? options.bubbleEl : this.querySelector('#profile-auth-hero-bubble');
    const allowWebFallback = options && options.allowWebFallback !== false;
    const alignedTtsOptions =
      options && options.alignedTtsOptions ? options.alignedTtsOptions : {};
    const hasMultipleLines = lines.length > 1;
    const originalBubbleHtml = bubbleEl ? bubbleEl.innerHTML : '';
    const originalBubbleMinHeight = bubbleEl ? bubbleEl.style.minHeight : '';
    const restLine = lines[0] || null;
    await this.stopAuthNarrationPlayback();
    if (token !== this.authNarrationToken) return false;
    if (bubbleEl) bubbleEl.dataset.narrationToken = String(token);
    const applyLine = (line) => {
      if (!bubbleEl || bubbleEl.dataset.narrationToken !== String(token)) return;
      const lineHtml = line && typeof line.html === 'string' ? line.html.trim() : '';
      if (lineHtml) bubbleEl.innerHTML = lineHtml;
      else bubbleEl.textContent = line && line.text ? line.text : '';
    };
    const measureMaxLineHeight = () => {
      if (!bubbleEl || !hasMultipleLines) return 0;
      const width =
        Math.ceil(
          bubbleEl.getBoundingClientRect().width || bubbleEl.clientWidth || bubbleEl.offsetWidth || 0
        ) || 0;
      if (!width) return 0;
      const probe = document.createElement('div');
      probe.className = bubbleEl.className;
      probe.setAttribute('aria-hidden', 'true');
      probe.style.position = 'absolute';
      probe.style.visibility = 'hidden';
      probe.style.pointerEvents = 'none';
      probe.style.left = '-99999px';
      probe.style.top = '0';
      probe.style.width = `${width}px`;
      probe.style.minHeight = '0';
      probe.style.height = 'auto';
      const parent = bubbleEl.parentElement || this;
      parent.appendChild(probe);
      let maxHeight = 0;
      lines.forEach((line) => {
        const html = line && typeof line.html === 'string' ? line.html.trim() : '';
        if (html) probe.innerHTML = html;
        else probe.textContent = line && line.text ? line.text : '';
        const nextHeight = Math.ceil(
          Math.max(probe.scrollHeight || 0, probe.getBoundingClientRect().height || 0)
        );
        if (nextHeight > maxHeight) maxHeight = nextHeight;
      });
      probe.remove();
      return maxHeight;
    };
    if (bubbleEl) {
      if (hasMultipleLines && restLine) applyLine(restLine);
      if (hasMultipleLines) {
        const maxHeight = measureMaxLineHeight();
        if (maxHeight > 0) bubbleEl.style.minHeight = `${maxHeight}px`;
      } else {
        bubbleEl.style.minHeight = originalBubbleMinHeight;
      }
    }
    const restoreBubble = () => {
      if (!bubbleEl || bubbleEl.dataset.narrationToken !== String(token)) return;
      if (originalBubbleHtml) bubbleEl.innerHTML = originalBubbleHtml;
      else if (restLine) applyLine(restLine);
      else bubbleEl.innerHTML = originalBubbleHtml;
      bubbleEl.style.minHeight = originalBubbleMinHeight;
      delete bubbleEl.dataset.narrationToken;
    };
    const waitMs = (ms) =>
      new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
    const estimateLinePlaybackMs = (lineText) => {
      const chars = String(lineText || '').trim().length;
      return Math.min(9500, Math.max(900, Math.round(chars * 72)));
    };
    const waitWebSpeechIdle = async (maxMs = 7000) => {
      if (!this.canWebSpeak() || typeof window === 'undefined' || !window.speechSynthesis) return;
      const synth = window.speechSynthesis;
      const startedAt = Date.now();
      while (token === this.authNarrationToken && Date.now() - startedAt < maxMs) {
        if (!synth.speaking && !synth.pending && !synth.paused) return;
        await waitMs(60);
      }
    };
    const plugin = this.getNativeTtsPlugin();
    const speakLineWithPlugin = async (lineText) => {
      if (!plugin || typeof plugin.speak !== 'function') return false;
      this.startAuthMascotTalk();
      this.setAuthBubbleSpeaking(true);
      const startedAt = Date.now();
      try {
        await plugin.speak({
          text: lineText,
          lang,
          rate: 1.0,
          pitch: 1.0,
          volume: 1.0,
          category: 'ambient',
          queueStrategy: 1
        });
        const minMs = estimateLinePlaybackMs(lineText);
        const elapsed = Date.now() - startedAt;
        if (elapsed < minMs && token === this.authNarrationToken) await waitMs(minMs - elapsed);
        return true;
      } catch (_err) {
        return false;
      } finally {
        if (token === this.authNarrationToken) {
          this.stopAuthMascotTalk({ settle: true });
          this.setAuthBubbleSpeaking(false);
        }
      }
    };
    const speakLineWebWithRetry = async (lineText) => {
      const hooks = {
        onPlaybackStart: () => {
          if (token !== this.authNarrationToken) return;
          this.startAuthMascotTalk();
          this.setAuthBubbleSpeaking(true);
        },
        onPlaybackEnd: () => {
          if (token !== this.authNarrationToken) return;
          this.stopAuthMascotTalk({ settle: true });
          this.setAuthBubbleSpeaking(false);
        }
      };
      let started = await this.speakAuthNarrationWeb(lineText, lang, token, 1500, hooks);
      if (started && token === this.authNarrationToken) {
        const maxWait = Math.min(11000, estimateLinePlaybackMs(lineText) + 2400);
        await waitWebSpeechIdle(maxWait);
      }
      if (started || token !== this.authNarrationToken) return started;
      await waitMs(450);
      if (token !== this.authNarrationToken) return false;
      await this.stopAuthNarrationPlayback();
      if (token !== this.authNarrationToken) return false;
      started = await this.speakAuthNarrationWeb(lineText, lang, token, 3200, hooks);
      if (started && token === this.authNarrationToken) {
        const maxWait = Math.min(12000, estimateLinePlaybackMs(lineText) + 3000);
        await waitWebSpeechIdle(maxWait);
      }
      return started;
    };
    let startedAny = false;
    try {
      for (let index = 0; index < lines.length; index += 1) {
        if (token !== this.authNarrationToken) return startedAny;
        const line = lines[index];
        const lineText = String(line.text || '').trim();
        if (!lineText) continue;
        if (hasMultipleLines) applyLine(line);
        const hooks = {
          onPlaybackStart: () => {
            if (token !== this.authNarrationToken) return;
            this.startAuthMascotTalk();
            this.setAuthBubbleSpeaking(true);
          },
          onPlaybackEnd: () => {
            if (token !== this.authNarrationToken) return;
            this.stopAuthMascotTalk({ settle: true });
            this.setAuthBubbleSpeaking(false);
          }
        };
        let started = await this.playAuthNarrationAligned(lineText, lang, token, hooks, alignedTtsOptions);
        if (!started && token === this.authNarrationToken) started = await speakLineWithPlugin(lineText);
        if (!started && allowWebFallback && token === this.authNarrationToken) {
          started = await speakLineWebWithRetry(lineText);
        }
        startedAny = startedAny || started;
        if (index < lines.length - 1 && token === this.authNarrationToken) await waitMs(130);
      }
      return startedAny;
    } finally {
      if (token === this.authNarrationToken) {
        this.stopAuthMascotTalk({ settle: true });
        this.setAuthBubbleSpeaking(false);
      }
      restoreBubble();
    }
  }

  playAuthHeroBubble() {
    if (this.authNarrationPromise) return this.authNarrationPromise;
    const bubbleEl = this.querySelector('#profile-auth-hero-bubble');
    const lines = this.extractNarrationLines(bubbleEl ? bubbleEl.innerHTML : '');
    if (!lines.length) {
      this.stopAuthHeroSpeech().catch(() => {});
      return Promise.resolve(false);
    }
    const locale = String(getActiveLocale() || (window.varGlobal && window.varGlobal.locale) || 'en')
      .trim()
      .toLowerCase()
      .split('-')[0];
    const alignedTtsOptions = this.getAuthNarrationTtsOptions(locale);
    const runPromise = this.speakAuthNarration(lines, locale, {
      bubbleEl,
      allowWebFallback: true,
      alignedTtsOptions
    })
      .catch((_err) => false)
      .finally(() => {
        if (this.authNarrationPromise === runPromise) this.authNarrationPromise = null;
      });
    this.authNarrationPromise = runPromise;
    return runPromise;
  }

  applyHeaderColor(color) {
    const normalized = FREE_RIDE_HEADER_COLOR_VALUES.includes(color) ? color : 'white';
    FREE_RIDE_HEADER_COLOR_VALUES.forEach((value) => this.classList.remove(`header-color-${value}`));
    this.classList.add(`header-color-${normalized}`);
  }

  scheduleReviewCollapseRefresh(resetExpanded = false) {
    if (this._reviewCollapseRaf) {
      cancelAnimationFrame(this._reviewCollapseRaf);
      this._reviewCollapseRaf = 0;
    }

    const run = () => {
      this._reviewCollapseRaf = 0;
      if (!this.isConnected) return;
      const isVisible = this.offsetParent !== null && !this.hidden;
      if (!isVisible) return;

      const reviewCollapseBlocks = Array.from(this.querySelectorAll('[data-review-collapse]'));
      reviewCollapseBlocks.forEach((contentEl) => {
        const container = contentEl.closest('.profile-review-block');
        const toggleBtn = container ? container.querySelector('.profile-review-more') : null;
        if (!container || !toggleBtn) return;
        if (resetExpanded) {
          container.classList.remove('is-expanded');
        }
        const collapsedHeight = Math.max(0, Number(contentEl.dataset.collapsedHeight) || 0);
        const shouldCollapse = collapsedHeight > 0 && contentEl.scrollHeight > collapsedHeight + 60;
        container.classList.toggle('is-collapsible', shouldCollapse);
        if (!shouldCollapse) {
          container.classList.remove('is-expanded');
        }
        toggleBtn.textContent = container.classList.contains('is-expanded') ? '−' : '+';
      });
    };

    this._reviewCollapseRaf = requestAnimationFrame(() => {
      this._reviewCollapseRaf = requestAnimationFrame(run);
    });
  }

  getProfileShellEl() {
    return this.querySelector('.profile-shell.free-ride-shell');
  }

  getProfileSheetEl() {
    return this.querySelector('.free-ride-card.profile-content-card');
  }

  getProfileSheetHandleEl() {
    return this.querySelector('.profile-content-card .journey-sheet-handle');
  }

  getProfileSheetTopInset() {
    if (document.body.classList.contains('app-titlebar-enabled')) return 0;
    const shellEl = this.getProfileShellEl();
    if (!shellEl) return 0;
    const paddingTop = Number.parseFloat(window.getComputedStyle(shellEl).paddingTop || '0');
    return Number.isFinite(paddingTop) ? Math.max(0, Math.round(paddingTop)) : 0;
  }

  measureProfileSheetExpandedOffset() {
    const offset = this.profileSheetController.measureOffset();
    this.profileSheetExpandedOffset = this.profileSheetController.state.offset;
    this.profileSheetTranslateY = this.profileSheetController.state.translateY;
    return offset;
  }

  applyProfileSheetState(options = {}) {
    this.profileSheetController.state.expanded = this.profileSheetExpanded;
    this.profileSheetController.state.offset = this.profileSheetExpandedOffset;
    this.profileSheetController.state.translateY = this.profileSheetTranslateY;
    this.profileSheetController.state.dragging = this.profileSheetDragging;
    this.profileSheetController.applyState(options);
    this.profileSheetExpanded = this.profileSheetController.state.expanded;
    this.profileSheetExpandedOffset = this.profileSheetController.state.offset;
    this.profileSheetTranslateY = this.profileSheetController.state.translateY;
    this.profileSheetDragging = this.profileSheetController.state.dragging;
  }

  setProfileSheetExpanded(nextExpanded, options = {}) {
    this.profileSheetController.state.expanded = this.profileSheetExpanded;
    this.profileSheetController.state.offset = this.profileSheetExpandedOffset;
    this.profileSheetController.setExpanded(nextExpanded, options);
    this.profileSheetExpanded = this.profileSheetController.state.expanded;
    this.profileSheetExpandedOffset = this.profileSheetController.state.offset;
    this.profileSheetTranslateY = this.profileSheetController.state.translateY;
    this.profileSheetDragging = this.profileSheetController.state.dragging;
  }

  toggleProfileSheet(options = {}) {
    this.setProfileSheetExpanded(!this.profileSheetExpanded, options);
  }

  startProfileSheetDrag(event) {
    this.profileSheetController.state.expanded = this.profileSheetExpanded;
    this.profileSheetController.state.offset = this.profileSheetExpandedOffset;
    this.profileSheetController.startDrag(event);
    this.profileSheetExpanded = this.profileSheetController.state.expanded;
    this.profileSheetExpandedOffset = this.profileSheetController.state.offset;
    this.profileSheetTranslateY = this.profileSheetController.state.translateY;
    this.profileSheetDragging = this.profileSheetController.state.dragging;
  }

  moveProfileSheetDrag(event) {
    this.profileSheetController.moveDrag(event);
    this.profileSheetTranslateY = this.profileSheetController.state.translateY;
    this.profileSheetDragging = this.profileSheetController.state.dragging;
  }

  finishProfileSheetDrag(event) {
    this.profileSheetController.finishDrag(event);
    this.profileSheetExpanded = this.profileSheetController.state.expanded;
    this.profileSheetExpandedOffset = this.profileSheetController.state.offset;
    this.profileSheetTranslateY = this.profileSheetController.state.translateY;
    this.profileSheetDragging = this.profileSheetController.state.dragging;
    this.profileSheetLastPointerUpTs = this.profileSheetController.state.lastPointerUpTs;
  }

  cancelProfileSheetDrag() {
    this.profileSheetController.cancelDrag();
    this.profileSheetExpanded = this.profileSheetController.state.expanded;
    this.profileSheetExpandedOffset = this.profileSheetController.state.offset;
    this.profileSheetTranslateY = this.profileSheetController.state.translateY;
    this.profileSheetDragging = this.profileSheetController.state.dragging;
  }

  bindProfileSheetInteractions() {
    const handleEl = this.getProfileSheetHandleEl();
    if (!handleEl) return;
    handleEl.addEventListener('pointerdown', (e) => {
      this.startProfileSheetDrag(e);
    });
    handleEl.addEventListener('pointermove', (e) => {
      this.moveProfileSheetDrag(e);
    });
    handleEl.addEventListener('pointerup', (e) => {
      this.finishProfileSheetDrag(e);
    });
    handleEl.addEventListener('pointercancel', () => {
      this.cancelProfileSheetDrag();
    });
    handleEl.addEventListener('lostpointercapture', () => {
      this.cancelProfileSheetDrag();
    });
    handleEl.addEventListener('click', (e) => {
      e.preventDefault();
    });
    handleEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      this.toggleProfileSheet({ animate: true });
    });
    this.profileSheetExpandedOffset = this.measureProfileSheetExpandedOffset();
    this.applyProfileSheetState({ animate: false, force: true });
  }

  syncProfileLayout() {
    if (!this.isConnected) return;
    const shellEl = this.getProfileShellEl();
    if (!shellEl) return;
    const loggedInCardEl = this.querySelector('#profile-card-section');
    if (!loggedInCardEl || loggedInCardEl.hidden) {
      shellEl.style.removeProperty('--free-ride-shell-height');
      return;
    }
    const viewport = window.visualViewport;
    const shellRect = shellEl.getBoundingClientRect();
    const visualViewportBottom = viewport ? (viewport.offsetTop + viewport.height) : window.innerHeight;
    const tabBar = document.querySelector('ion-tab-bar.app-tab-bar');
    const tabBarTop = tabBar ? tabBar.getBoundingClientRect().top : visualViewportBottom;
    const bottomLimit = Math.min(visualViewportBottom, tabBarTop);
    const usableHeight = bottomLimit - shellRect.top - 8;
    if (!Number.isFinite(usableHeight) || usableHeight <= 80) {
      shellEl.style.removeProperty('--free-ride-shell-height');
      return;
    }
    shellEl.style.setProperty('--free-ride-shell-height', `${Math.max(200, Math.floor(usableHeight))}px`);
    this.profileSheetExpandedOffset = this.measureProfileSheetExpandedOffset();
    this.applyProfileSheetState({ animate: false, force: true });
  }

  scheduleProfileLayout(delayMs = 0) {
    if (!this.isConnected) return;
    if (document.body?.classList?.contains('app-android-legacy-webview')) return;
    const run = () => {
      if (this._profileLayoutRaf) cancelAnimationFrame(this._profileLayoutRaf);
      this._profileLayoutRaf = requestAnimationFrame(() => {
        this._profileLayoutRaf = null;
        this.syncProfileLayout();
      });
    };
    if (delayMs > 0) {
      if (this._profileLayoutTimer) clearTimeout(this._profileLayoutTimer);
      this._profileLayoutTimer = setTimeout(() => {
        this._profileLayoutTimer = null;
        run();
      }, delayMs);
    } else {
      run();
    }
  }

  notifyChromeState() {
    const user = window.user;
    const loggedIn = Boolean(user && user.id !== undefined && user.id !== null);
    // Don't hide the tab bar while the onboarding overlay is active — it covers
    // everything anyway, and hiding it would affect all other tabs too since
    // profile is mounted at app start (not just when the user visits the tab).
    const hideTabBar = !loggedIn;
    const tabsPage = document.querySelector('tabs-page');
    if (tabsPage && tabsPage.classList) {
      tabsPage.classList.toggle('profile-auth-tabs-hidden', hideTabBar);
    }
    if (this._lastProfileAuthHideTabBar === hideTabBar) return;
    this._lastProfileAuthHideTabBar = hideTabBar;
    window.dispatchEvent(
      new CustomEvent('app:profile-auth-view-change', {
        detail: { hideTabBar }
      })
    );
  }

  connectedCallback() {
    this.classList.add('ion-page');
    this.applyHeaderColor(getStoredHeaderColor());
    this.classList.toggle('is-card-padded', isFreeRideCardPadded());
    preloadHeroMascotFrames();
    this.profileSheetController = createSheetController({
      expandedKey: PROFILE_SHEET_EXPANDED_KEY,
      offsetKey: PROFILE_SHEET_OFFSET_KEY,
      getSheetEl: () => this.getProfileSheetEl(),
      getHandleEl: () => this.getProfileSheetHandleEl(),
      getShellEl: () => this.getProfileShellEl(),
      getTopInset: () => this.getProfileSheetTopInset(),
      getExpandedLabel: () => 'Collapse profile card',
      getCollapsedLabel: () => 'Expand profile card'
    });
    this.profileSheetExpanded = this.profileSheetController.state.expanded;
    this.profileSheetExpandedOffset = this.profileSheetController.state.offset;
    this.profileSheetTranslateY = 0;
    this.profileSheetDragging = false;
    this.profileSheetPointerId = null;
    this.profileSheetDragStartY = 0;
    this.profileSheetDragStartTranslateY = 0;
    this.profileSheetDragMoved = false;
    this.profileSheetLastPointerUpTs = 0;
    this._lastProfileAuthHideTabBar = null;
    this._lastAuthUserId = (() => {
      const currentUser = window.user;
      if (currentUser && currentUser.id !== undefined && currentUser.id !== null) {
        return String(currentUser.id);
      }
      return '';
    })();
    this.authMascotFrameIndex = PROFILE_AUTH_MASCOT_REST_FRAME;
    this.authMascotFrameTimer = null;
    this.authMascotIsTalking = false;
    if (!this.activeTab) {
      this.activeTab = 'progress';
    }
    if (!this.reviewTone) {
      const storedTone = window.r34lp0w3r && window.r34lp0w3r.profileReviewTone;
      this.reviewTone = storedTone === 'okay' ? 'okay' : 'bad';
    }
    this.render();
    this.notifyChromeState();
    this._localeButtonClickHandler = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const buttonEl = target ? target.closest('.app-locale-btn') : null;
      if (!buttonEl || !this.contains(buttonEl)) return;
      const nextLocale = getNextLocaleCode(getActiveLocale() || 'en');
      setLocaleOverride(nextLocale);
      if (window.varGlobal && typeof window.varGlobal === 'object') {
        window.varGlobal.locale = nextLocale;
      }
      window.dispatchEvent(new CustomEvent('app:locale-change', { detail: { locale: nextLocale } }));
    };
    this.addEventListener('click', this._localeButtonClickHandler);
    this._userHandler = (e) => {
      const u = e && e.detail && typeof e.detail === 'object' ? e.detail : null;
      const sourceUser = u || (window.user && typeof window.user === 'object' ? window.user : null);
      const nextUserId =
        sourceUser && sourceUser.id !== undefined && sourceUser.id !== null ? String(sourceUser.id) : '';
      const prevUserId = String(this._lastAuthUserId || '');
      if (u && u.locale && !getLocaleOverride()) {
        setAppLocale(u.locale);
        if (window.varGlobal && typeof window.varGlobal === 'object') {
          window.varGlobal.locale = u.locale;
        }
      }
      if (!nextUserId && !prevUserId) {
        this.notifyChromeState();
        return;
      }
      this._lastAuthUserId = nextUserId;
      this.render();
      this.notifyChromeState();
    };
    this._storesHandler = () => {
      const currentUser = window.user;
      const loggedIn = Boolean(currentUser && currentUser.id !== undefined && currentUser.id !== null);
      if (!loggedIn) return;
      this.render();
    };
    this._localeHandler = () => {
      if (!this.isConnected) return;
      if (!isCurrentProfileLoggedIn() && this.querySelector('#profile-auth-hero-section')) {
        const rawLocale = resolveLocale(
          getActiveLocale() || (window.varGlobal && window.varGlobal.locale) || 'es', 'es'
        );
        const copy = getProfileCopy(rawLocale);
        const label = String(rawLocale || '').trim().toUpperCase() || 'EN';
        this.querySelectorAll('.app-locale-label').forEach(el => { el.textContent = label; });
        this.querySelectorAll('.app-locale-btn').forEach(el => { el.setAttribute('aria-label', label); });
        const bubbleEl = this.querySelector('#profile-auth-hero-bubble');
        if (bubbleEl) {
          bubbleEl.setAttribute('aria-label', rawLocale === 'es' ? 'Reproducir mensaje' : 'Play message');
          const textEl = bubbleEl.querySelector('.journey-plan-bubble-text');
          if (textEl) textEl.innerHTML = `<span class="free-ride-hero-bubble-icon" aria-hidden="true"><ion-icon name="volume-high-outline"></ion-icon></span>${escHtml(copy.loginSubtitle || '')}`;
        }
        const titleEl = this.querySelector('.profile-login-title');
        if (titleEl) titleEl.textContent = copy.loginTitle || 'Inicia sesión';
        const contactBtn = this.querySelector('[data-action="contact"]');
        if (contactBtn) contactBtn.textContent = copy.contact || 'Contact';
        const legalBtn = this.querySelector('[data-action="legal"]');
        if (legalBtn) legalBtn.textContent = copy.legal || 'Legal';
      } else {
        this.render();
        this.scheduleProfileLayout(0);
      }
    };
    const isCurrentProfileLoggedIn = () => {
      const currentUser = window.user;
      return Boolean(currentUser && currentUser.id !== undefined && currentUser.id !== null);
    };
    this._focusHandler = () => {};
    this._visibilityHandler = () => {};
    this._tabsEl = document.querySelector('ion-tabs');
    this._tabsDidChangeHandler = (event) => {
      const tab = String(event && event.detail ? event.detail.tab || '' : '').trim().toLowerCase();
      if (tab === 'tu') {
        this.profileSheetExpandedOffset = this.measureProfileSheetExpandedOffset();
        this.applyProfileSheetState({ animate: false, force: true });
        this.scheduleProfileLayout(0);
      }
    };
    this._tabsEl?.addEventListener('ionTabsDidChange', this._tabsDidChangeHandler);
    this._routerEl = document.querySelector('ion-router');
    this._routeDidChangeHandler = (event) => {
      const to = String(event && event.detail ? event.detail.to || '' : '').trim();
      if (to === '/tabs') return;
    };
    this._routerEl?.addEventListener('ionRouteDidChange', this._routeDidChangeHandler);
    this._reviewReturnHandler = () => {};
    this._headerColorHandler = (event) => {
      if (!this.isConnected) return;
      const color = event && event.detail ? event.detail.color : '';
      this.applyHeaderColor(color || getStoredHeaderColor());
    };
    this._titlebarToggleHandler = () => {
      if (!this.isConnected) return;
      this.render();
      this.scheduleProfileLayout(0);
    };
    this._cardPaddedHandler = (event) => {
      if (!this.isConnected) return;
      const detail = event && event.detail ? event.detail : {};
      const enabled = typeof detail.enabled === 'boolean' ? detail.enabled : isFreeRideCardPadded();
      this.classList.toggle('is-card-padded', enabled);
      this.profileSheetExpandedOffset = this.measureProfileSheetExpandedOffset();
      this.applyProfileSheetState({ animate: false, force: true });
      this.scheduleProfileLayout(0);
    };
    this._onboardingFinishHandler = () => this._runOnboardingTransition();
    window.addEventListener('app:onboarding-finish', this._onboardingFinishHandler);
    this._repeatOnboardingHandler = () => { this.render(); this.notifyChromeState(); };
    window.addEventListener('app:repeat-onboarding', this._repeatOnboardingHandler);
    window.addEventListener('app:user-change', this._userHandler);
    window.addEventListener('app:speak-stores-change', this._storesHandler);
    window.addEventListener('app:locale-change', this._localeHandler);
    window.addEventListener('app:profile-review-return', this._reviewReturnHandler);
    window.addEventListener('app:free-ride-header-color-change', this._headerColorHandler);
    window.addEventListener('app:titlebar-enabled-change', this._titlebarToggleHandler);
    window.addEventListener('app:free-ride-card-padded-change', this._cardPaddedHandler);
    window.addEventListener('focus', this._focusHandler);
    document.addEventListener('visibilitychange', this._visibilityHandler);
    this._reviewResizeObserver =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => this.scheduleReviewCollapseRefresh())
        : null;
    this._profileResizeHandler = () => {
      const legacyAndroid =
        document.body && document.body.classList.contains('app-android-legacy-webview');
      if (legacyAndroid) return;
      this.scheduleProfileLayout(0);
    };
    window.addEventListener('resize', this._profileResizeHandler);
    if (window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
      window.visualViewport.addEventListener('resize', this._profileResizeHandler);
      window.visualViewport.addEventListener('scroll', this._profileResizeHandler);
    }
  }

  _runOnboardingTransition() {
    setLoginTabsLock();

    const DURATION = 900;
    const isIos = document.body?.classList?.contains('app-platform-ios') === true;

    // Measure onboarding mascot BEFORE removing overlay
    const overlay = this.querySelector('#profile-onboarding-overlay');
    const srcMascot = overlay?.querySelector('.onboarding-v5-test-block-image, .onboarding-v5-mascot');
    const srcRect = srcMascot ? srcMascot.getBoundingClientRect() : null;

    // Cover at body level — immune to profile re-renders
    const cover = document.createElement('div');
    cover.setAttribute('aria-hidden', 'true');
    cover.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;background:var(--free-ride-view-bg,#a7c6f7)';
    document.body.appendChild(cover);

    if (overlay) overlay.remove();
    this.classList.remove('profile-onboarding-active');

    // Measure auth mascot using getBoundingClientRect directly — includes transform
    const authHeroSection = this.querySelector('#profile-auth-hero-section');
    const authMascot = authHeroSection?.querySelector('#profile-auth-hero-mascot');
    const dstRect = authMascot ? authMascot.getBoundingClientRect() : null;
    const authMascotPrevOpacity = authMascot?.style?.opacity || '';
    if (authMascot && dstRect && dstRect.height > 0) {
      authMascot.style.opacity = '0';
    }

    // Fade cover out — auth content (incl. mascot) revealed naturally beneath it
    const coverAnimation = cover.animate(
      [
        { opacity: 1, offset: 0 },
        { opacity: 1, offset: isIos ? 0.18 : 0.1 },
        { opacity: 0, offset: 1 }
      ],
      { duration: DURATION, easing: 'ease-in', fill: 'forwards' }
    );
    coverAnimation.finished.then(() => {
      cover.remove();
      if (authMascot) {
        authMascot.style.opacity = authMascotPrevOpacity;
        authMascot.style.transition = '';
      }
      this.notifyChromeState(); // overlay is gone — now hide tab bar for login view
    });

    // Mascot FLIP — clone flies from onboarding position to auth hero position
    // z-index 10000 keeps it above the cover (9999)
    // Auth mascot is NOT hidden — it fades in naturally as the cover fades,
    // so there's no opacity jump when the clone disappears
    if (srcRect && dstRect && srcRect.height > 0 && dstRect.height > 0) {
      const srcCx = srcRect.left + srcRect.width / 2;
      const srcCy = srcRect.top + srcRect.height / 2;
      const dstCx = dstRect.left + dstRect.width / 2;
      const dstCy = dstRect.top + dstRect.height / 2;
      const scale = dstRect.height > 0 ? srcRect.height / dstRect.height : 1;
      const tx = srcCx - dstCx;
      const ty = srcCy - dstCy;
      const rectAspect = dstRect.width > 0 && dstRect.height > 0 ? dstRect.width / dstRect.height : 1;
      const srcNaturalWidth = Number(srcMascot?.naturalWidth) || srcRect.width || 1;
      const srcNaturalHeight = Number(srcMascot?.naturalHeight) || srcRect.height || 1;
      const dstNaturalWidth = Number(authMascot?.naturalWidth) || dstRect.width || 1;
      const dstNaturalHeight = Number(authMascot?.naturalHeight) || dstRect.height || 1;
      const getContainedSize = (naturalWidth, naturalHeight, rectWidth, rectHeight, rectRatio) => {
        const safeWidth = Math.max(1, Number(naturalWidth) || 1);
        const safeHeight = Math.max(1, Number(naturalHeight) || 1);
        const imageRatio = safeWidth / safeHeight;
        if (imageRatio > rectRatio) {
          return {
            width: rectWidth,
            height: rectWidth / imageRatio
          };
        }
        return {
          width: rectHeight * imageRatio,
          height: rectHeight
        };
      };
      const srcContained = getContainedSize(
        srcNaturalWidth,
        srcNaturalHeight,
        dstRect.width,
        dstRect.height,
        rectAspect
      );
      const dstContained = getContainedSize(
        dstNaturalWidth,
        dstNaturalHeight,
        dstRect.width,
        dstRect.height,
        rectAspect
      );
      const visibleScaleAdjustment = Math.max(
        0.58,
        Math.min(
          1,
          Math.min(
            dstContained.width / Math.max(1, srcContained.width),
            dstContained.height / Math.max(1, srcContained.height)
          )
        )
      );

      const clone = document.createElement('img');
      clone.src = srcMascot.src;
      clone.setAttribute('aria-hidden', 'true');
      const dstClone = document.createElement('img');
      dstClone.src = authMascot?.src || srcMascot.src;
      dstClone.setAttribute('aria-hidden', 'true');
      Object.assign(clone.style, {
        position: 'fixed',
        left: `${dstRect.left}px`,
        top: `${dstRect.top}px`,
        width: `${dstRect.width}px`,
        height: `${dstRect.height}px`,
        transformOrigin: 'center center',
        zIndex: '10000',
        objectFit: 'contain',
        objectPosition: 'center',
        pointerEvents: 'none',
        willChange: 'transform, opacity',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
      });
      Object.assign(dstClone.style, {
        position: 'fixed',
        left: `${dstRect.left}px`,
        top: `${dstRect.top}px`,
        width: `${dstRect.width}px`,
        height: `${dstRect.height}px`,
        transformOrigin: 'center center',
        zIndex: '10001',
        objectFit: 'contain',
        objectPosition: 'center',
        pointerEvents: 'none',
        willChange: 'opacity',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        opacity: '0',
      });
      document.body.appendChild(clone);
      document.body.appendChild(dstClone);

      if (authMascot) {
        authMascot.style.transition = 'opacity 180ms ease-out';
      }

      const cloneAnimation = clone.animate(
        [
          { transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`, opacity: 1, offset: 0 },
          { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1, offset: isIos ? 0.66 : 0.64 },
          {
            transform: `translate3d(0, 0, 0) scale(${visibleScaleAdjustment})`,
            opacity: 0.3,
            offset: isIos ? 0.9 : 0.88
          },
          {
            transform: `translate3d(0, 0, 0) scale(${visibleScaleAdjustment})`,
            opacity: 0,
            offset: 1
          }
        ],
        { duration: DURATION, easing: 'cubic-bezier(0,0,0.2,1)', fill: 'forwards' }
      );
      const dstCloneAnimation = dstClone.animate(
        [
          { opacity: 0, offset: 0 },
          { opacity: 0, offset: isIos ? 0.7 : 0.68 },
          { opacity: 1, offset: isIos ? 0.92 : 0.9 },
          { opacity: 1, offset: 1 }
        ],
        { duration: DURATION, easing: 'ease-out', fill: 'forwards' }
      );

      window.setTimeout(() => {
        if (authMascot) authMascot.style.opacity = authMascotPrevOpacity || '1';
      }, Math.round(DURATION * (isIos ? 0.9 : 0.88)));

      Promise.allSettled([cloneAnimation.finished, dstCloneAnimation.finished]).then(() => {
        clone.remove();
        dstClone.remove();
      });
    } else if (authMascot) {
      authMascot.style.opacity = authMascotPrevOpacity;
    }

  }

  disconnectedCallback() {
    if (this._localeButtonClickHandler) {
      this.removeEventListener('click', this._localeButtonClickHandler);
    }
    if (this._onboardingFinishHandler) {
      window.removeEventListener('app:onboarding-finish', this._onboardingFinishHandler);
    }
    if (this._repeatOnboardingHandler) {
      window.removeEventListener('app:repeat-onboarding', this._repeatOnboardingHandler);
    }
    this.stopAuthHeroSpeech();
    const tabsPage = document.querySelector('tabs-page');
    if (tabsPage && tabsPage.classList) {
      tabsPage.classList.remove('profile-auth-tabs-hidden');
    }
    window.dispatchEvent(
      new CustomEvent('app:profile-auth-view-change', {
        detail: { hideTabBar: false }
      })
    );
    if (this._userHandler) {
      window.removeEventListener('app:user-change', this._userHandler);
    }
    if (this._storesHandler) {
      window.removeEventListener('app:speak-stores-change', this._storesHandler);
    }
    if (this._localeHandler) {
      window.removeEventListener('app:locale-change', this._localeHandler);
    }
    if (this._reviewReturnHandler) {
      window.removeEventListener('app:profile-review-return', this._reviewReturnHandler);
    }
    if (this._headerColorHandler) {
      window.removeEventListener('app:free-ride-header-color-change', this._headerColorHandler);
    }
    if (this._titlebarToggleHandler) {
      window.removeEventListener('app:titlebar-enabled-change', this._titlebarToggleHandler);
    }
    if (this._cardPaddedHandler) {
      window.removeEventListener('app:free-ride-card-padded-change', this._cardPaddedHandler);
      this._cardPaddedHandler = null;
    }
    if (this._focusHandler) {
      window.removeEventListener('focus', this._focusHandler);
    }
    if (this._visibilityHandler) {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
    }
    if (this._tabsDidChangeHandler) {
      this._tabsEl?.removeEventListener('ionTabsDidChange', this._tabsDidChangeHandler);
      this._tabsDidChangeHandler = null;
      this._tabsEl = null;
    }
    if (this._routeDidChangeHandler) {
      this._routerEl?.removeEventListener('ionRouteDidChange', this._routeDidChangeHandler);
      this._routeDidChangeHandler = null;
      this._routerEl = null;
    }
    if (this._metaHandler) {
      window.removeEventListener('app:meta-change', this._metaHandler);
    }
    if (this._reviewCollapseRaf) {
      cancelAnimationFrame(this._reviewCollapseRaf);
      this._reviewCollapseRaf = 0;
    }
    if (this._reviewResizeObserver) {
      this._reviewResizeObserver.disconnect();
      this._reviewResizeObserver = null;
    }
    if (this._profileResizeHandler) {
      window.removeEventListener('resize', this._profileResizeHandler);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', this._profileResizeHandler);
        window.visualViewport.removeEventListener('scroll', this._profileResizeHandler);
      }
      this._profileResizeHandler = null;
    }
    if (this._profileLayoutTimer) { clearTimeout(this._profileLayoutTimer); this._profileLayoutTimer = null; }
    if (this._profileLayoutRaf) { cancelAnimationFrame(this._profileLayoutRaf); this._profileLayoutRaf = null; }
    if (this._authEntrySettleRaf) { cancelAnimationFrame(this._authEntrySettleRaf); this._authEntrySettleRaf = 0; }
    this.classList.remove('profile-auth-entering');
  }

  render() {
    this.stopAuthHeroSpeech();
    const platform =
      window.r34lp0w3r && typeof window.r34lp0w3r.platform === 'string'
        ? String(window.r34lp0w3r.platform).trim().toLowerCase()
        : '';
    const persistProfileTab = (tab) => {
      if (!tab) return;
      if (!window.r34lp0w3r) window.r34lp0w3r = {};
      window.r34lp0w3r.profileActiveTab = tab;
      try {
        localStorage.setItem('appv5:profile-tab', tab);
      } catch (err) {
        // no-op
      }
    };
    if (window.r34lp0w3r && window.r34lp0w3r.profileForceTab) {
      this.activeTab = window.r34lp0w3r.profileForceTab;
      persistProfileTab(this.activeTab);
      window.r34lp0w3r.profileForceTab = null;
    }
    if (this.activeTab === 'prefs') {
      this.activeTab = 'progress';
    }
    if (this.activeTab !== 'review' && this.activeTab !== 'progress') {
      this.activeTab = 'progress';
    }
    const storedReviewTone = window.r34lp0w3r && window.r34lp0w3r.profileReviewTone;
    if (storedReviewTone === 'okay' || storedReviewTone === 'bad') {
      this.reviewTone = storedReviewTone;
    }
    const titlebarEnabled = isAppTitlebarEnabled();
    const bootUser = window.user;
    const bootLoggedIn = Boolean(bootUser && bootUser.id !== undefined && bootUser.id !== null);
    const onboardingOverlayEnabled = !bootLoggedIn && !onboardingDone();
    this.classList.toggle('profile-onboarding-active', onboardingOverlayEnabled);

    const routes = getRoutes();
    if (bootLoggedIn && !routes.length && !this._loadingData && !this._trainingDataLoadAttempted) {
      this._loadingData = true;
      this._trainingDataLoadAttempted = true;
      ensureTrainingData()
        .catch((err) => {
          console.warn('[profile] training data load failed', err);
        })
        .finally(() => {
          this._loadingData = false;
          if (this.isConnected) this.render();
        });
    }

    const referenceCourses = getReferenceCourses();
    const referenceTestCourses = getReferenceTestCourses();
    if (
      bootLoggedIn &&
      (!referenceCourses.length || !referenceTestCourses.length) &&
      !this._loadingReferenceData &&
      !this._referenceDataLoadAttempted
    ) {
      this._loadingReferenceData = true;
      this._referenceDataLoadAttempted = true;
      Promise.all([
        ensureReferenceData().catch((err) => {
          console.warn('[profile] reference data load failed', err);
        }),
        ensureReferenceTestsData().catch((err) => {
          console.warn('[profile] reference tests load failed', err);
        })
      ]).finally(() => {
        this._loadingReferenceData = false;
        if (this.isConnected) this.render();
      });
    }

    const getUserDisplayName = (user) => {
      if (!user) return '';
      const derivedName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
      return derivedName || user.name || user.email || user.social_id || '';
    };

    const isPremiumUser = (candidate) => {
      if (!candidate || typeof candidate !== 'object') return false;
      const expiresRaw = candidate.expires_date || candidate.expiresDate || '';
      if (!expiresRaw) return false;
      const expires = new Date(expiresRaw);
      if (Number.isNaN(expires.getTime())) return false;
      return expires.getTime() > Date.now();
    };

    const getUserAvatar = (user) => {
      if (!user) return '';
      return user.image_local || user.image || '';
    };

    const getFeedbackConfig = () => {
      const config = window.r34lp0w3r && window.r34lp0w3r.speakFeedback;
      return {
        toneScale: config && Array.isArray(config.toneScale) ? config.toneScale : []
      };
    };

    const normalizeScale = (scale, key) => {
      const list = (scale || []).filter(
        (item) => item && typeof item.min === 'number' && typeof item[key] === 'string' && item[key]
      );
      if (!list.length) return [];
      return list.slice().sort((a, b) => b.min - a.min);
    };

    const resolveFromScale = (scale, value, key, fallback) => {
      const match = scale.find((item) => value >= item.min);
      if (match && match[key]) return match[key];
      return fallback;
    };

    const getScoreTone = (percent) => {
      const value = typeof percent === 'number' ? percent : 0;
      const { toneScale } = getFeedbackConfig();
      const normalized = normalizeScale(toneScale, 'tone');
      return resolveFromScale(normalized, value, 'tone', 'bad');
    };

    const isReviewableTone = (tone) => tone === 'bad' || tone === 'okay';

    const escapeHtml = (value) =>
      String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const wordScoresStore =
      window.r34lp0w3r && window.r34lp0w3r.speakWordScores ? window.r34lp0w3r.speakWordScores : {};
    const phraseScoresStore =
      window.r34lp0w3r && window.r34lp0w3r.speakPhraseScores ? window.r34lp0w3r.speakPhraseScores : {};
    const user = window.user;
    const showReferenceProgress = isPremiumUser(user);
    const rawLocaleSetting = resolveLocale(
      getActiveLocale() || (window.varGlobal && window.varGlobal.locale) || 'es',
      'es'
    );
    const tabsCopy = getTabsCopy(rawLocaleSetting);
    const profileCopy = getProfileCopy(rawLocaleSetting);

    const reviewTone = this.reviewTone === 'okay' ? 'okay' : 'bad';
    const reviewToneLabel =
      reviewTone === 'okay'
        ? profileCopy.reviewToneYellowLabel || 'yellow'
        : profileCopy.reviewToneRedLabel || 'red';

    const sessionLookup = new Map();
    routes.forEach((routeItem) => {
      const modules = routeItem && Array.isArray(routeItem.modules) ? routeItem.modules : [];
      modules.forEach((moduleItem) => {
        const sessions = moduleItem && Array.isArray(moduleItem.sessions) ? moduleItem.sessions : [];
        sessions.forEach((sessionItem) => {
          sessionLookup.set(sessionItem.id, {
            routeId: routeItem.id,
            moduleId: moduleItem.id,
            session: sessionItem
          });
        });
      });
    });

    const hasSessionAttempts = (session) => {
      const wordScores = wordScoresStore[session.id] || {};
      const hasWord = Object.values(wordScores).some(
        (entry) => entry && typeof entry.percent === 'number'
      );
      const phrase = phraseScoresStore[session.id];
      const hasPhrase = phrase && typeof phrase.percent === 'number';
      return hasWord || hasPhrase;
    };

    const getWordsPercent = (session) => {
      const words =
        session && session.speak && session.speak.spelling && Array.isArray(session.speak.spelling.words)
          ? session.speak.spelling.words
          : [];
      if (!words.length) return 0;
      const sessionScores = wordScoresStore[session.id] || {};
      const total = words.reduce((sum, word) => {
        const stored = sessionScores[word];
        const value = stored && typeof stored.percent === 'number' ? stored.percent : 0;
        return sum + value;
      }, 0);
      return Math.round(total / words.length);
    };

    const getPhrasePercent = (session) => {
      const stored = phraseScoresStore[session.id];
      if (stored && typeof stored.percent === 'number') return stored.percent;
      return 0;
    };

    const getSessionPercent = (session) => {
      const wordsPercent = getWordsPercent(session);
      const phrasePercent = getPhrasePercent(session);
      return Math.round((wordsPercent + phrasePercent) / 2);
    };

    const getModulePercent = (module) => {
      const sessions = module && Array.isArray(module.sessions) ? module.sessions : [];
      if (!sessions.length) return { started: false, percent: null, tone: 'neutral' };
      const started = sessions.some((session) => hasSessionAttempts(session));
      if (!started) return { started: false, percent: null, tone: 'neutral' };
      const total = sessions.reduce((sum, session) => sum + getSessionPercent(session), 0);
      const percent = Math.round(total / sessions.length);
      return { started: true, percent, tone: getScoreTone(percent) };
    };

    const getRoutePercent = (route) => {
      const modules = route && Array.isArray(route.modules) ? route.modules : [];
      if (!modules.length) return { started: false, percent: null, tone: 'neutral' };
      const moduleProgress = modules.map((module) => getModulePercent(module));
      const started = moduleProgress.some((entry) => entry.started);
      if (!started) return { started: false, percent: null, tone: 'neutral' };
      const total = moduleProgress.reduce(
        (sum, entry) => sum + (entry.started ? entry.percent : 0),
        0
      );
      const percent = Math.round(total / modules.length);
      return { started: true, percent, tone: getScoreTone(percent) };
    };

    const routeProgressList = routes.map((route) => getRoutePercent(route));
    const hasAnyRoute = routeProgressList.some((entry) => entry.started);
    const globalPercent = hasAnyRoute
      ? Math.round(
          routeProgressList.reduce((sum, entry) => sum + (entry.started ? entry.percent : 0), 0) /
            (routes.length || 1)
        )
      : 0;
    const globalTone = hasAnyRoute ? getScoreTone(globalPercent) : 'neutral';

    const getProgressMapValue = (progressMap, code) => {
      const key = String(code === undefined || code === null ? '' : code).trim();
      if (!key || !progressMap || typeof progressMap !== 'object') return null;
      if (progressMap[key] !== undefined && progressMap[key] !== null) return progressMap[key];
      const numericKey = Number(key);
      if (
        Number.isFinite(numericKey) &&
        progressMap[numericKey] !== undefined &&
        progressMap[numericKey] !== null
      ) {
        return progressMap[numericKey];
      }
      return null;
    };

    const referenceSectionProgress =
      user && user.section_progress && typeof user.section_progress === 'object' ? user.section_progress : {};
    const referenceTestProgress =
      user && user.test_progress && typeof user.test_progress === 'object' ? user.test_progress : {};

    const hasReferenceLessonCompletion = (lessonCode) => {
      const value = getProgressMapValue(referenceSectionProgress, lessonCode);
      if (value === true) return true;
      const numericValue = Number(value);
      return Number.isFinite(numericValue) && numericValue > 0;
    };

    const getImportedReferenceTestStatus = (testCode) => {
      const numericValue = Number(getProgressMapValue(referenceTestProgress, testCode) || 0);
      if (!Number.isFinite(numericValue)) return 0;
      if (numericValue === 1) return 1;
      if (numericValue === 2) return 2;
      return 0;
    };

    const isReferenceTestPassingScore = (percent) => {
      const value = Number(percent);
      return Number.isFinite(value) && value > 80;
    };

    const getReferenceScoreTone = (percent) => {
      const value = Number.isFinite(Number(percent)) ? Number(percent) : 0;
      if (isReferenceTestPassingScore(value)) return 'good';
      if (value >= 60) return 'okay';
      return 'bad';
    };

    const getReferenceTestsStorageUserKey = (currentUser = user) => {
      if (currentUser && currentUser.id !== undefined && currentUser.id !== null) {
        const value = String(currentUser.id).trim();
        if (value) return value;
      }
      return 'anon';
    };

    const getReferenceTestsStorageKey = (currentUser = user) =>
      `${REFERENCE_TESTS_PROGRESS_STORAGE_PREFIX}:${getReferenceTestsStorageUserKey(currentUser)}`;

    const sanitizeStoredReferenceTestResponses = (responses) => {
      const source = responses && typeof responses === 'object' ? responses : {};
      const output = {};
      Object.entries(source).forEach(([questionCode, rawValue]) => {
        const key = String(questionCode || '').trim();
        if (!key) return;
        if (Array.isArray(rawValue)) {
          const values = rawValue.map((item) => String(item || ''));
          while (values.length && !String(values[values.length - 1] || '').trim()) values.pop();
          if (values.some((item) => String(item || '').trim())) {
            output[key] = values;
          }
          return;
        }
        const value = String(rawValue || '');
        if (value.trim()) {
          output[key] = value;
        }
      });
      return output;
    };

    const loadStoredReferenceTestStates = () => {
      try {
        const raw = localStorage.getItem(getReferenceTestsStorageKey(user));
        if (!raw) return {};
        const payload = JSON.parse(raw);
        const statesSource = payload && payload.states && typeof payload.states === 'object' ? payload.states : {};
        const states = {};
        Object.entries(statesSource).forEach(([testKey, rawState]) => {
          const key = String(testKey || '').trim();
          if (!key || !rawState || typeof rawState !== 'object') return;
          const responses = sanitizeStoredReferenceTestResponses(rawState.responses);
          const checked = Boolean(rawState.checked);
          const lastCheckedAt = Number.isFinite(Number(rawState.lastCheckedAt))
            ? Number(rawState.lastCheckedAt)
            : 0;
          if (!Object.keys(responses).length && !checked && !lastCheckedAt) return;
          states[key] = {
            responses,
            checked,
            lastCheckedAt
          };
        });
        return states;
      } catch (_err) {
        return {};
      }
    };

    const referenceStoredTestStates = loadStoredReferenceTestStates();

    const getReferenceTestKey = (scope, test) => {
      const normalizedScope = scope === 'unit' ? 'unit' : 'lesson';
      const code = test && test.code !== undefined && test.code !== null ? String(test.code).trim() : '';
      return code ? `${normalizedScope}:${code}` : '';
    };

    const getStoredReferenceTestState = (testKey) => {
      const key = String(testKey || '').trim();
      if (!key || !referenceStoredTestStates[key]) {
        return {
          responses: {},
          checked: false,
          lastCheckedAt: 0
        };
      }
      return referenceStoredTestStates[key];
    };

    const getReferenceQuestionSlotCount = (question) => {
      const acceptedPlaceholders =
        question &&
        question.answer &&
        Array.isArray(question.answer.accepted_placeholders)
          ? question.answer.accepted_placeholders
          : [];
      const fromAccepted = acceptedPlaceholders.reduce(
        (max, entry) => Math.max(max, Array.isArray(entry) ? entry.length : 0),
        0
      );
      if (fromAccepted > 0) return fromAccepted;
      const matches = String(question && question.text ? question.text : '').match(/_{3,}/g);
      const fromText = Array.isArray(matches) ? matches.length : 0;
      return Math.max(1, fromText);
    };

    const normalizeReferenceAnswerValue = (value) =>
      String(value || '')
        .normalize('NFKC')
        .replace(/[\u2018\u2019\u0060\u00b4]/g, "'")
        .replace(/[\u201c\u201d]/g, '"')
        .replace(/[¿¡]/g, '')
        .replace(/[.,!?;:()"[\]{}]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    const getReferenceQuestionAcceptedAnswers = (question) => {
      const answer = question && question.answer ? question.answer : {};
      const accepted = Array.isArray(answer.accepted) ? answer.accepted.filter(Boolean) : [];
      if (accepted.length) return accepted;
      const raw = String(answer.raw || '').trim();
      return raw ? [raw] : [];
    };

    const evaluateReferenceQuestion = (question, response) => {
      const interaction = String(question && question.interaction ? question.interaction : '')
        .trim()
        .toLowerCase();
      const acceptedAnswers = getReferenceQuestionAcceptedAnswers(question);
      const acceptedPlaceholders =
        question &&
        question.answer &&
        Array.isArray(question.answer.accepted_placeholders)
          ? question.answer.accepted_placeholders
          : [];

      if (interaction === 'multiple_choice') {
        const selectedCode = String(response || '').trim();
        const correctOption = Array.isArray(question.options)
          ? question.options.find((option) => option.correct)
          : null;
        return Boolean(correctOption && selectedCode && String(correctOption.code) === selectedCode);
      }

      if (interaction === 'reorder_words') {
        const answerTokens = Array.isArray(response) ? response : [];
        const userNormalized = normalizeReferenceAnswerValue(answerTokens.join(' ').trim());
        const acceptedNormalized = acceptedAnswers.map((item) => normalizeReferenceAnswerValue(item));
        return Boolean(userNormalized) && acceptedNormalized.includes(userNormalized);
      }

      const slotCount = getReferenceQuestionSlotCount(question);
      const rawParts = Array.isArray(response)
        ? response.slice(0, slotCount).map((item) => String(item || ''))
        : [String(response || '')];
      const filledParts = Array.from({ length: slotCount }, (_unused, index) => rawParts[index] || '');
      const userDisplay =
        slotCount > 1
          ? filledParts.map((part) => part.trim()).filter(Boolean).join(' · ')
          : filledParts[0].trim();

      if (acceptedPlaceholders.length) {
        const normalizedParts = filledParts.map((part) => normalizeReferenceAnswerValue(part));
        return acceptedPlaceholders.some((entry) => {
          if (!Array.isArray(entry) || entry.length !== slotCount) return false;
          return entry.every(
            (part, index) => normalizeReferenceAnswerValue(part) === (normalizedParts[index] || '')
          );
        });
      }

      const userNormalized = normalizeReferenceAnswerValue(userDisplay);
      const acceptedNormalized = acceptedAnswers.map((item) => normalizeReferenceAnswerValue(item));
      return Boolean(userNormalized) && acceptedNormalized.includes(userNormalized);
    };

    const hasReferenceQuestionResponse = (question, response) => {
      const interaction = String(question && question.interaction ? question.interaction : '')
        .trim()
        .toLowerCase();
      if (interaction === 'multiple_choice') {
        return Boolean(String(response || '').trim());
      }
      if (interaction === 'reorder_words') {
        return Array.isArray(response) && response.some((item) => String(item || '').trim());
      }
      const slotCount = getReferenceQuestionSlotCount(question);
      const values = Array.isArray(response)
        ? response.slice(0, slotCount).map((item) => String(item || ''))
        : [String(response || '')];
      while (values.length < slotCount) values.push('');
      return values.every((item) => String(item || '').trim());
    };

    const getLocalizedReferenceTitle = (entry, field, fallback) =>
      getLocalizedMapField(entry, field, rawLocaleSetting) || fallback || '';

    const getReferenceTestReviewState = (test, testKey) => {
      const importedStatus = getImportedReferenceTestStatus(test && test.code);
      if (importedStatus === 1) return null;

      const state = getStoredReferenceTestState(testKey);
      const questions = Array.isArray(test && test.questions) ? test.questions : [];
      const total = questions.length;
      const answeredCount = questions.reduce((count, question) => {
        const questionCode = String(question && question.code ? question.code : '');
        return count + (hasReferenceQuestionResponse(question, state.responses[questionCode]) ? 1 : 0);
      }, 0);

      if (state.checked && total > 0) {
        const correctCount = questions.reduce((count, question) => {
          const questionCode = String(question && question.code ? question.code : '');
          return count + (evaluateReferenceQuestion(question, state.responses[questionCode]) ? 1 : 0);
        }, 0);
        const scorePercent = Math.max(0, Math.min(100, Math.round((correctCount / total) * 100)));
        if (isReferenceTestPassingScore(scorePercent)) return null;
        return {
          tone: getReferenceScoreTone(scorePercent),
          percent: scorePercent,
          source: 'local-checked'
        };
      }

      if (answeredCount > 0) {
        const progressPercent = total > 0 ? Math.round((answeredCount / total) * 100) : 0;
        return {
          tone: 'okay',
          percent: progressPercent,
          source: 'local-progress'
        };
      }

      if (importedStatus === 2) {
        return {
          tone: 'bad',
          percent: 50,
          source: 'remote-failed'
        };
      }

      return null;
    };

    const testCourseMap = new Map(
      (Array.isArray(referenceTestCourses) ? referenceTestCourses : []).map((course) => [String(course.code), course])
    );

    const getReferenceCoursePercent = (course) => {
      const courseCode = String(course && course.code ? course.code : '').trim();
      if (!courseCode) return { started: false, percent: 0, tone: 'neutral' };
      const testCourse = testCourseMap.get(courseCode) || null;
      const testUnitMap = new Map(
        (testCourse && Array.isArray(testCourse.unidades) ? testCourse.unidades : []).map((unit) => [
          String(unit.code),
          unit
        ])
      );

      let completedCount = 0;
      let totalCount = 0;
      let started = false;

      (Array.isArray(course && course.unidades) ? course.unidades : []).forEach((unit) => {
        const unitCode = String(unit && unit.code ? unit.code : '').trim();
        const testUnit = testUnitMap.get(unitCode) || null;
        const testLessonMap = new Map(
          (testUnit && Array.isArray(testUnit.lecciones) ? testUnit.lecciones : []).map((lesson) => [
            String(lesson.code),
            lesson
          ])
        );

        (Array.isArray(unit && unit.lecciones) ? unit.lecciones : []).forEach((lesson) => {
          const lessonCode = String(lesson && lesson.code ? lesson.code : '').trim();
          const lessonCompleted = hasReferenceLessonCompletion(lessonCode);
          const testLesson = testLessonMap.get(lessonCode) || null;
          const lessonTests =
            testLesson && Array.isArray(testLesson.tests) ? testLesson.tests : [];

          totalCount += 1 + lessonTests.length;
          if (lessonCompleted) {
            completedCount += 1;
            started = true;
          }

          lessonTests.forEach((test) => {
            const importedStatus = getImportedReferenceTestStatus(test && test.code);
            if (importedStatus > 0) started = true;
            if (importedStatus === 1) completedCount += 1;
          });
        });

        const unitTests = testUnit && Array.isArray(testUnit.tests_unidad) ? testUnit.tests_unidad : [];
        totalCount += unitTests.length;
        unitTests.forEach((test) => {
          const importedStatus = getImportedReferenceTestStatus(test && test.code);
          if (importedStatus > 0) started = true;
          if (importedStatus === 1) completedCount += 1;
        });
      });

      const percent = totalCount > 0 ? Math.round((completedCount * 100) / totalCount) : 0;
      return {
        started,
        percent,
        tone: started ? getScoreTone(percent) : 'neutral'
      };
    };

    const referenceCourseProgressList = referenceCourses.map((course) => getReferenceCoursePercent(course));
    const hasAnyReferenceProgress = referenceCourseProgressList.some((entry) => entry.started);
    const referenceGlobalPercent =
      hasAnyReferenceProgress && referenceCourses.length
        ? Math.round(
            referenceCourseProgressList.reduce(
              (sum, entry) => sum + (entry.started ? entry.percent : 0),
              0
            ) / referenceCourses.length
          )
        : 0;
    const referenceGlobalTone = hasAnyReferenceProgress ? getScoreTone(referenceGlobalPercent) : 'neutral';

    const reviewTestEntries = [];
    if (showReferenceProgress) {
      (Array.isArray(referenceTestCourses) ? referenceTestCourses : []).forEach((course) => {
        const courseCode = String(course && course.code ? course.code : '').trim();
        const courseTitle =
          getLocalizedReferenceTitle(course, 'display', course && course.title ? String(course.title) : '') ||
          `Course ${courseCode}`;
        (Array.isArray(course && course.unidades) ? course.unidades : []).forEach((unit) => {
          const unitCode = String(unit && unit.code ? unit.code : '').trim();
          const unitTitle =
            getLocalizedReferenceTitle(unit, 'display', unit && unit.title ? String(unit.title) : '') ||
            `Unit ${unitCode}`;
          const lessons = Array.isArray(unit && unit.lecciones) ? unit.lecciones : [];
          const firstLessonCode =
            lessons[0] && lessons[0].code !== undefined && lessons[0].code !== null
              ? String(lessons[0].code).trim()
              : '';

          lessons.forEach((lesson) => {
            const lessonCode = String(lesson && lesson.code ? lesson.code : '').trim();
            const lessonTitle =
              getLocalizedReferenceTitle(lesson, 'display', lesson && lesson.title ? String(lesson.title) : '') ||
              `Lesson ${lessonCode}`;
            (Array.isArray(lesson && lesson.tests) ? lesson.tests : []).forEach((test) => {
              const testKey = getReferenceTestKey('lesson', test);
              const reviewState = getReferenceTestReviewState(test, testKey);
              if (!reviewState) return;
              if (!isReviewableTone(reviewState.tone)) return;
              reviewTestEntries.push({
                type: 'reference-test',
                tone: reviewState.tone,
                courseCode,
                unitCode,
                lessonCode,
                testKey,
                title:
                  getLocalizedReferenceTestValue(test && test.display ? test.display : '', rawLocaleSetting) ||
                  `Test ${String(test && test.code ? test.code : '').trim()}`,
                eyebrow: profileCopy.reviewLessonTestLabel || 'Lesson test',
                meta: `${courseTitle} · ${unitTitle} · ${lessonTitle}`
              });
            });
          });

          (Array.isArray(unit && unit.tests_unidad) ? unit.tests_unidad : []).forEach((test) => {
            if (!firstLessonCode) return;
            const testKey = getReferenceTestKey('unit', test);
            const reviewState = getReferenceTestReviewState(test, testKey);
            if (!reviewState) return;
            if (!isReviewableTone(reviewState.tone)) return;
            reviewTestEntries.push({
              type: 'reference-test',
              tone: reviewState.tone,
              courseCode,
              unitCode,
              lessonCode: firstLessonCode,
              testKey,
              title:
                getLocalizedReferenceTestValue(test && test.display ? test.display : '', rawLocaleSetting) ||
                `Test ${String(test && test.code ? test.code : '').trim()}`,
              eyebrow: profileCopy.reviewUnitTestLabel || 'Unit test',
              meta: `${courseTitle} · ${unitTitle}`
            });
          });
        });
      });
    }

    const validReviewWordsBySession = new Map();
    sessionLookup.forEach((sessionInfo, sessionId) => {
      const session = sessionInfo && sessionInfo.session ? sessionInfo.session : null;
      const speak = session && session.speak ? session.speak : null;
      if (!speak) return;
      const allowed = new Set();
      const addWord = (value) => {
        const normalized = String(value || '').trim();
        if (!normalized) return;
        allowed.add(normalized.toLowerCase());
      };
      addWord(speak.focus);
      addWord(speak.sound && speak.sound.expected);
      const spellingWords =
        speak.spelling && Array.isArray(speak.spelling.words) ? speak.spelling.words : [];
      spellingWords.forEach(addWord);
      addWord(speak.spelling && speak.spelling.expected);
      validReviewWordsBySession.set(sessionId, allowed);
    });

    const reviewWordsMap = new Map();
    Object.entries(wordScoresStore).forEach(([sessionId, sessionScores]) => {
      if (!sessionScores || typeof sessionScores !== 'object') return;
      const allowedWords = validReviewWordsBySession.get(sessionId);
      if (!allowedWords || !allowedWords.size) return;
      Object.entries(sessionScores).forEach(([word, entry]) => {
        const percent = entry && typeof entry.percent === 'number' ? entry.percent : null;
        if (percent === null) return;
        const normalizedWord = String(word || '').trim().toLowerCase();
        if (!normalizedWord || !allowedWords.has(normalizedWord)) return;
        const tone = getScoreTone(percent);
        if (!isReviewableTone(tone)) return;
        const key = normalizedWord;
        const existing = reviewWordsMap.get(key);
        if (!existing || percent < existing.percent) {
          reviewWordsMap.set(key, { word, percent, tone, sessionId });
        }
      });
    });
    const reviewWordEntries = Array.from(reviewWordsMap.values()).sort((a, b) =>
      a.word.localeCompare(b.word)
    );

    const reviewPhraseEntries = [];
    Object.entries(phraseScoresStore).forEach(([sessionId, entry]) => {
      const percent = entry && typeof entry.percent === 'number' ? entry.percent : null;
      if (percent === null) return;
      const tone = getScoreTone(percent);
      if (!isReviewableTone(tone)) return;
      const sessionInfo = sessionLookup.get(sessionId);
      const phrase =
        sessionInfo &&
        sessionInfo.session &&
        sessionInfo.session.speak &&
        sessionInfo.session.speak.sentence
          ? (sessionInfo.session.speak.sentence.expected || sessionInfo.session.speak.sentence.sentence || '')
          : '';
      if (!phrase) return;
      reviewPhraseEntries.push({ phrase, percent, tone, sessionId });
    });
    reviewPhraseEntries.sort((a, b) => a.phrase.localeCompare(b.phrase));

    const userId = user && user.id !== undefined && user.id !== null ? String(user.id) : '';
    const loggedIn = Boolean(userId);
    const becameLoggedOut = !loggedIn && this._lastRenderedLoggedIn !== false;
    const progressActive = this.activeTab === 'progress';
    const reviewActive = this.activeTab === 'review';
    const settingsOpen = loggedIn && this.settingsOpen === true;
    const showFooterLinks = loggedIn && settingsOpen;
    const showAppMeta = loggedIn && settingsOpen;
    const formatExpiry = (value) => {
      if (!value) return profileCopy.expiryNA || 'n/a';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      const lang = String(rawLocaleSetting || 'es').toLowerCase();
      const fmtLocale = lang.startsWith('en')
        ? 'en-US'
        : lang.startsWith('br') || lang.startsWith('pt')
          ? 'pt-BR'
          : 'es-ES';
      try {
        return new Intl.DateTimeFormat(fmtLocale, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).format(date);
      } catch (err) {
        return typeof date.toLocaleString === 'function'
          ? date.toLocaleString()
          : date.toISOString();
      }
    };
    const formatAppMeta = (meta) => {
      const info = meta && typeof meta === 'object' ? meta : {};
      const version =
        info.version || info.appVersion || info.versionName || info.versionString || '';
      const build = info.build || info.appBuild || info.buildNumber || info.versionCode || '';
      if (version && build) return `v${version} (${build})`;
      if (version) return `v${version}`;
      if (build) return `build ${build}`;
      return profileCopy.appMetaNA || 'v n/d';
    };
    const resetProfileState = (nextUser) => {
      if (!nextUser || nextUser.id === undefined || nextUser.id === null) {
        this.profileFormState = null;
        this.profileFormSeed = null;
        this._profileSeedId = null;
        this.profileSaveMessage = '';
        this.profileSaveError = false;
        return null;
      }
      let firstName = nextUser.first_name || '';
      let lastName = nextUser.last_name || '';
      if (!firstName && !lastName && nextUser.name) {
        const parts = String(nextUser.name).trim().split(/\s+/);
        firstName = parts.shift() || '';
        lastName = parts.join(' ');
      }
      const seed = {
        first_name: firstName,
        last_name: lastName,
        email: nextUser.email || '',
        expires_date: nextUser.expires_date || '',
        birthdate: nextUser.birthdate || '1901-01-01',
        lc: nextUser.lc || nextUser.locale || 'en-gb',
        sex: typeof nextUser.sex === 'number' ? nextUser.sex : 1
      };
      this.profileFormSeed = seed;
      this.profileFormState = {
        ...seed,
        password: '',
        passwordConfirm: ''
      };
      this._profileSeedId = String(nextUser.id);
      this.profileSaveMessage = '';
      this.profileSaveError = false;
      return this.profileFormState;
    };
    if (!loggedIn) {
      resetProfileState(null);
    } else if (!this.profileFormState || this._profileSeedId !== userId) {
      resetProfileState(user);
    } else if (this.profileFormState && this.profileFormSeed) {
      const nextExpiresDate = user.expires_date || '';
      this.profileFormState.expires_date = nextExpiresDate;
      this.profileFormSeed.expires_date = nextExpiresDate;
      this.profileFormState.email = user.email || '';
      this.profileFormSeed.email = user.email || '';
    }
    const profileSeed = this.profileFormSeed || {
      first_name: '',
      last_name: '',
      email: '',
      expires_date: '',
      birthdate: '1901-01-01',
      lc: 'en-gb',
      sex: 1
    };
    const profileState = this.profileFormState || {
      ...profileSeed,
      password: '',
      passwordConfirm: ''
    };
    const hasProfileChanges = () => {
      if (!loggedIn) return false;
      const first = String(profileState.first_name || '').trim();
      const last = String(profileState.last_name || '').trim();
      const baseFirst = String(profileSeed.first_name || '').trim();
      const baseLast = String(profileSeed.last_name || '').trim();
      if (first !== baseFirst || last !== baseLast) return true;
      if (profileState.password || profileState.passwordConfirm) return true;
      return false;
    };
    const getPasswordError = () => {
      const pass = String(profileState.password || '');
      const confirm = String(profileState.passwordConfirm || '');
      if (!pass && !confirm) return '';
      if (!pass || !confirm) {
        return profileCopy.passwordBothRequired || 'Please complete both password fields.';
      }
      if (pass !== confirm) return profileCopy.passwordMismatch || 'Passwords do not match.';
      return '';
    };
    const profileNote = this.profileSaveMessage || '';
    const profileNoteError = this.profileSaveError === true;
    const appMetaLabel = formatAppMeta(window.appMeta);
    const getStoredReviewSelection = () =>
      window.r34lp0w3r && window.r34lp0w3r.profileReviewSelected
        ? window.r34lp0w3r.profileReviewSelected
        : null;
    const isSelectedReviewEntry = (type, sessionId = '', extra = {}) => {
      const selected = getStoredReviewSelection();
      if (!selected || selected.type !== type) return false;
      if (String(selected.sessionId || '') !== String(sessionId || '')) return false;
      return Object.entries(extra).every(
        ([key, value]) => String(selected[key] || '') === String(value || '')
      );
    };

    const reviewWordsMarkup = reviewWordEntries.length
      ? `<div class="review-words">${reviewWordEntries
          .map(
            (entry) =>
              `<button class="review-word review-entry ${escapeHtml(entry.tone)} ${isSelectedReviewEntry('word', entry.sessionId, {
                word: entry.word
              })
                ? 'is-selected'
                : ''}" type="button" data-type="word" data-word="${escapeHtml(entry.word)}" data-session-id="${escapeHtml(entry.sessionId)}">${escapeHtml(entry.word)}</button>`
          )
          .join('')}</div>`
      : `<div class="review-empty">${escapeHtml(profileCopy.reviewWordsEmpty || 'No words to review.')}</div>`;

    const reviewPhrasesMarkup = reviewPhraseEntries.length
      ? `<div class="review-phrases">${reviewPhraseEntries
          .map(
            (entry) =>
              `<button class="review-word review-phrase review-entry ${escapeHtml(entry.tone)} ${isSelectedReviewEntry('phrase', entry.sessionId)
                ? 'is-selected'
                : ''}" type="button" data-type="phrase" data-session-id="${escapeHtml(entry.sessionId)}">${escapeHtml(entry.phrase)}</button>`
          )
          .join('')}</div>`
      : `<div class="review-empty">${escapeHtml(profileCopy.reviewPhrasesEmpty || 'No phrases to review.')}</div>`;

    const reviewTestsMarkup = reviewTestEntries.length
      ? `<div class="review-tests">${reviewTestEntries
          .map(
            (entry) => `
              <button
                class="review-word review-test review-entry ${escapeHtml(entry.tone)} ${isSelectedReviewEntry(
                  'reference-test',
                  '',
                  {
                    courseCode: entry.courseCode,
                    unitCode: entry.unitCode,
                    lessonCode: entry.lessonCode,
                    testKey: entry.testKey
                  }
                )
                  ? 'is-selected'
                  : ''}"
                type="button"
                data-type="reference-test"
                data-course-code="${escapeHtml(entry.courseCode)}"
                data-unit-code="${escapeHtml(entry.unitCode)}"
                data-lesson-code="${escapeHtml(entry.lessonCode)}"
                data-test-key="${escapeHtml(entry.testKey)}"
              >
                <span class="review-test-eyebrow">${escapeHtml(entry.eyebrow)}</span>
                <span class="review-test-meta">${escapeHtml(entry.meta)}</span>
              </button>
            `
          )
          .join('')}</div>`
      : `<div class="review-empty">${escapeHtml(profileCopy.reviewTestsEmpty || 'No tests to review.')}</div>`;

    const badgeStore =
      window.r34lp0w3r && window.r34lp0w3r.speakBadges && typeof window.r34lp0w3r.speakBadges === 'object'
        ? window.r34lp0w3r.speakBadges
        : {};
    const routeTitleById = new Map(
      routes.map((route) => {
        const routeId = route && route.id ? String(route.id).trim() : '';
        const routeTitle =
          String(
            (route &&
              (route.display && typeof route.display === 'object'
                ? route.display[rawLocaleSetting] || route.display.es || route.display.en
                : route.display)) ||
              route?.title ||
              route?.name ||
              ''
          ).trim();
        return [routeId, routeTitle];
      })
    );
    const routeBadgeOrder = new Map(
      routes.map((route, idx) => [route && route.id ? route.id : '', idx + 1])
    );
    const resolveBadgeView = (badgeId, entry) => {
      if (!badgeId || !entry || typeof entry !== 'object') return null;
      const routeId = String(entry.routeId || '').trim();
      const routeTitle =
        String(entry.routeTitle || '').trim() || (routeId ? String(routeTitleById.get(routeId) || '').trim() : '');
      let badgeIndex = Number(entry.badgeIndex);
      if (!Number.isFinite(badgeIndex) || badgeIndex <= 0) {
        badgeIndex = routeId && routeBadgeOrder.has(routeId) ? routeBadgeOrder.get(routeId) : NaN;
      }
      if (!Number.isFinite(badgeIndex) || badgeIndex <= 0) {
        return null;
      }
      const image = String(entry.image || '').trim() || `assets/badges/badge${badgeIndex}.png`;
      const title = routeTitle || String(entry.title || entry.label || '').trim() || `Badge ${badgeIndex}`;
      return {
        id: badgeId,
        badgeIndex,
        image,
        title,
        routeTitle
      };
    };
    const earnedBadges = Object.entries(badgeStore)
      .map(([badgeId, entry]) => resolveBadgeView(badgeId, entry))
      .filter(Boolean)
      .sort((a, b) => a.badgeIndex - b.badgeIndex);
    const earnedBadgesMarkup = earnedBadges.length
      ? earnedBadges
          .map(
            (badge) => `
              <button class="profile-earned-badge-card" type="button" data-badge-id="${escapeHtml(badge.id)}">
                <img class="profile-earned-badge-img" src="${escapeHtml(badge.image)}" alt="${escapeHtml(
              badge.title
            )}">
                <span class="profile-earned-badge-title">${escapeHtml(badge.title)}</span>
              </button>
            `
          )
          .join('')
      : `<div class="profile-earned-badges-empty">${escapeHtml(
          profileCopy.badgesEmpty || 'You have not unlocked badges yet.'
        )}</div>`;
    const sessionRewardsStore =
      window.r34lp0w3r && window.r34lp0w3r.speakSessionRewards
        ? window.r34lp0w3r.speakSessionRewards
        : {};
    const sessionRewardEntries = Object.values(sessionRewardsStore).filter(
      (entry) => entry && typeof entry.rewardQty === 'number' && entry.rewardQty > 0
    );
    const trainingTrophyQty = sessionRewardEntries.reduce((sum, entry) => {
      const icon = String(entry.rewardIcon || '').trim().toLowerCase();
      return icon === 'trophy' ? sum + Number(entry.rewardQty || 0) : sum;
    }, 0);
    const referenceMedalQty = sessionRewardEntries.reduce((sum, entry) => {
      const icon = String(entry.rewardIcon || '').trim().toLowerCase();
      const kind = String(entry.rewardGroup || '').trim().toLowerCase();
      return icon === 'ribbon' || icon === 'medal' || kind === 'reference-unit-ribbon'
        ? sum + Number(entry.rewardQty || 0)
        : sum;
    }, 0);
    const reviewItemsCount =
      reviewWordEntries.length + reviewPhraseEntries.length + reviewTestEntries.length;
    const avatarSrc = escapeHtml(
      getUserAvatar(user) || 'https://s3.amazonaws.com/sk.CursoIngles/no-avatar.gif'
    );
    const userDisplayName = escapeHtml(
      getUserDisplayName(user) || profileCopy.userFallbackName || 'Usuario'
    );
    const premiumBadgeMarkup = showReferenceProgress ? '<div class="profile-hero-premium">Premium</div>' : '';
    const authMascotSrc = this.getAuthMascotFramePath(this.authMascotFrameIndex);
    const authBubbleText = escapeHtml(
      profileCopy.loginSubtitle || 'Debes iniciar sesión para ver tu perfil.'
    );
    const localeLabel = String(rawLocaleSetting || '').trim().toUpperCase() || 'EN';
    const loggedOutHeaderHtml = titlebarEnabled
      ? `
      <ion-header class="app-header-shell">
        <ion-toolbar class="secret-title-area toolbar-title-default">
          <ion-title></ion-title>
          <div class="app-header-actions profile-auth-header-actions" slot="end">
            <button class="app-locale-btn" type="button" aria-label="${escapeHtml(localeLabel)}">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
                <path d="M2 12h20"></path>
              </svg>
              <span class="app-locale-label">${escapeHtml(localeLabel)}</span>
            </button>
          </div>
        </ion-toolbar>
      </ion-header>`
      : '';
    const authInlineLocaleHtml = !titlebarEnabled
      ? `
      <div class="profile-hero-actions-left profile-auth-actions-left">
        <button class="app-locale-btn" type="button" aria-label="${escapeHtml(localeLabel)}">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
          <span class="app-locale-label">${escapeHtml(localeLabel)}</span>
        </button>
      </div>`
      : '';
    const authShellHtml = !loggedIn
      ? `
          ${authInlineLocaleHtml}
          <section class="free-ride-hero-card journey-plan-card onboarding-intro-card profile-auth-hero" id="profile-auth-hero-section">
            <div class="free-ride-hero-stage journey-plan-stage">
              <span class="journey-plan-mascot-wrap free-ride-mascot-wrap" aria-hidden="true">
                <img id="profile-auth-hero-mascot" class="onboarding-intro-cat free-ride-mascot" src="${authMascotSrc}" alt="">
              </span>
              <div class="journey-plan-body">
                <p
                  id="profile-auth-hero-bubble"
                  class="onboarding-intro-bubble free-ride-hero-bubble journey-plan-bubble hero-playable-bubble"
                  role="button"
                  tabindex="0"
                  aria-label="${escapeHtml((rawLocaleSetting || 'es') === 'es' ? 'Reproducir mensaje' : 'Play message')}"
                >
                  <span class="journey-plan-bubble-text"><span class="free-ride-hero-bubble-icon" aria-hidden="true"><ion-icon name="volume-high-outline"></ion-icon></span>${authBubbleText}</span>
                </p>
              </div>
            </div>
          </section>
          <section class="free-ride-card profile-auth-card" id="profile-auth-card-section">
            <div class="free-ride-card-main">
              <div id="profile-login-panel">
                <div class="profile-login-hero">
                  <h1 class="profile-login-title">${escapeHtml(profileCopy.loginTitle || 'Inicia sesión')}</h1>
                </div>
                <page-login embedded flat></page-login>
                <div class="profile-auth-footer">
                  <div class="profile-links profile-links--centered" id="profile-links-login">
                    <button class="profile-link-btn" type="button" data-action="contact">${escapeHtml(
                      profileCopy.contact || 'Contact'
                    )}</button>
                    <button class="profile-link-btn" type="button" data-action="legal">${escapeHtml(
                      profileCopy.legal || 'Legal'
                    )}</button>
                  </div>
                  <div class="profile-app-meta profile-app-meta--auth">${escapeHtml(appMetaLabel)}</div>
                </div>
              </div>
            </div>
          </section>
          ${onboardingOverlayEnabled ? '<div class="profile-onboarding-overlay" id="profile-onboarding-overlay"><page-onboarding embedded></page-onboarding></div>' : ''}`
      : '';
    const progressCardsMarkup = [
      {
        label: tabsCopy.training || 'Training',
        value: `${globalPercent}%`,
        tone: globalTone,
        iconSrc: 'assets/profile/training.png',
        iconAlt: tabsCopy.training || 'Training'
      },
      ...(showReferenceProgress
        ? [
            {
              label: tabsCopy.reference || 'Reference',
              value: `${referenceGlobalPercent}%`,
              tone: referenceGlobalTone,
              iconSrc: 'assets/profile/reference.png',
              iconAlt: tabsCopy.reference || 'Reference'
            }
          ]
        : [])
    ]
      .map(
        (item) => `
          <div class="profile-stat-card profile-stat-card--reward">
            <div class="profile-stat-copy">
              <div class="profile-stat-value profile-stat-value--${escapeHtml(item.tone)}">${escapeHtml(
                item.value
              )}</div>
              <div class="profile-stat-label">${escapeHtml(item.label)}</div>
            </div>
            <div class="profile-stat-media">
              <img class="profile-stat-icon" src="${escapeHtml(item.iconSrc)}" alt="${escapeHtml(
                item.iconAlt
              )}">
            </div>
          </div>
        `
      )
      .join('');
    const rewardCardsMarkup = [
      {
        label: profileCopy.trainingTrophies || 'Copas training',
        value: String(trainingTrophyQty),
        tone: 'neutral',
        iconSrc: 'assets/profile/copa.png',
        iconAlt: profileCopy.trainingTrophies || 'Copas training'
      },
      ...(showReferenceProgress
        ? [
            {
              label: profileCopy.referenceMedals || 'Medallas reference',
              value: String(referenceMedalQty),
              tone: 'neutral',
              iconSrc: 'assets/profile/medalla.png',
              iconAlt: profileCopy.referenceMedals || 'Medallas reference'
            }
          ]
        : [])
    ]
      .map(
        (item) => `
          <div class="profile-stat-card profile-stat-card--reward">
            <div class="profile-stat-copy">
              <div class="profile-stat-value profile-stat-value--${escapeHtml(item.tone)}">${escapeHtml(
                item.value
              )}</div>
              <div class="profile-stat-label">${escapeHtml(item.label)}</div>
            </div>
            <div class="profile-stat-media">
              <img class="profile-stat-icon" src="${escapeHtml(item.iconSrc)}" alt="${escapeHtml(
                item.iconAlt
              )}">
            </div>
          </div>
        `
      )
      .join('');

    const loggedOutShellClass = loggedIn
      ? ''
      : [
          'profile-shell--logged-out',
          platform === 'android' ? 'profile-shell--logged-out-android' : '',
          titlebarEnabled ? 'profile-shell--logged-out-titlebar' : ''
        ]
          .filter(Boolean)
          .join(' ');

    this.innerHTML = `
      ${loggedIn ? renderAppHeader({ title: tabsCopy.you, rewardBadgesId: 'profile-reward-badges' }) : loggedOutHeaderHtml}
      <ion-content fullscreen class="home-journey free-ride-content secret-content profile-content ${loggedIn ? '' : 'profile-content--logged-out'}">
        <div class="speak-shell free-ride-shell profile-shell ${loggedOutShellClass}">
          ${authShellHtml}
          <section class="profile-hero-section" id="profile-hero-section" ${loggedIn ? '' : 'hidden'}>
            ${titlebarEnabled ? '' : `
            <div class="profile-hero-actions-left">
              ${isAppNotificationsEnabled() ? `
              <ion-button fill="clear" size="small" class="app-notify-btn">
                <ion-icon slot="icon-only" name="notifications-outline"></ion-icon>
              </ion-button>
              ` : ''}
              <button class="app-locale-btn">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                <span class="app-locale-label">${String(rawLocaleSetting || '').trim().toUpperCase()}</span>
              </button>
            </div>
            `}
            <button class="profile-settings-toggle" type="button" id="profile-settings-toggle" aria-label="${escapeHtml(
              profileCopy.tabPrefs || 'Profile'
            )}">
              <ion-icon name="${settingsOpen ? 'arrow-back' : 'settings-outline'}"></ion-icon>
            </button>
            <div class="profile-hero-avatar-wrap">
              <img class="profile-hero-avatar" src="${avatarSrc}" alt="">
            </div>
            <div class="profile-hero-name">${userDisplayName}</div>
            ${premiumBadgeMarkup}
          </section>
          <section class="free-ride-card journey-sheet profile-content-card" id="profile-card-section" ${loggedIn ? '' : 'hidden'} data-sheet-state="${this.profileSheetExpanded ? 'expanded' : 'collapsed'}">
            <button class="free-ride-card-handle journey-sheet-handle" type="button" aria-label="${this.profileSheetExpanded ? 'Collapse profile card' : 'Expand profile card'}" aria-expanded="${this.profileSheetExpanded ? 'true' : 'false'}">
              <span class="free-ride-card-handle-pill journey-sheet-handle-pill" aria-hidden="true"></span>
            </button>
            <div class="free-ride-card-main journey-sheet-main">
              <div class="profile-segmented-tabs" role="tablist">
                <button class="profile-segmented-btn ${progressActive ? 'active' : ''}" type="button" data-tab="progress" role="tab">
                  <span>${escapeHtml(profileCopy.progressLabel || 'Progreso')}</span>
                </button>
                <button class="profile-segmented-btn ${reviewActive ? 'active' : ''}" type="button" data-tab="review" role="tab">
                  <span>${escapeHtml(profileCopy.tabReview || 'Review')}</span>
                </button>
              </div>
            <div class="profile-tab-panel" ${progressActive ? '' : 'hidden'}>
              <div class="profile-stats-grid">
                ${progressCardsMarkup}
                ${rewardCardsMarkup}
              </div>
              <div class="profile-earned-badges-section">
                <div class="profile-earned-badges" id="profile-earned-badges">
                  ${earnedBadgesMarkup}
                </div>
              </div>
            </div>
            <div class="profile-tab-panel" ${reviewActive ? '' : 'hidden'}>
              <div class="profile-review-section">
                <div class="card card--plain profile-review-block">
                  <h3 class="profile-section-title profile-section-title--with-icon">
                    <span class="profile-section-icon profile-section-icon--red"><ion-icon name="volume-high-outline"></ion-icon></span>
                    ${escapeHtml(profileCopy.reviewWordsTitle || 'Words to review')}
                  </h3>
                  <div class="profile-review-content" data-review-collapse data-collapsed-height="82">
                    ${reviewWordsMarkup}
                  </div>
                  <button class="profile-review-more" type="button">+</button>
                </div>
              </div>
              <div class="profile-review-section">
                <div class="card card--plain profile-review-block">
                  <h3 class="profile-section-title profile-section-title--with-icon">
                    <span class="profile-section-icon profile-section-icon--blue">"</span>
                    ${escapeHtml(profileCopy.reviewPhrasesTitle || 'Phrases to review')}
                  </h3>
                  <div class="profile-review-content" data-review-collapse data-collapsed-height="82">
                    ${reviewPhrasesMarkup}
                  </div>
                  <button class="profile-review-more" type="button">+</button>
                </div>
              </div>
              ${showReferenceProgress
                ? `
              <div class="profile-review-section">
                <div class="card card--plain profile-review-block">
                  <h3 class="profile-section-title profile-section-title--with-icon">
                    <span class="profile-section-icon profile-section-icon--green"><ion-icon name="document-text-outline"></ion-icon></span>
                    ${escapeHtml(profileCopy.reviewTestsTitle || 'Tests to review')}
                  </h3>
                  <div class="profile-review-content" data-review-collapse data-collapsed-height="150">
                    ${reviewTestsMarkup}
                  </div>
                  <button class="profile-review-more" type="button">+</button>
                </div>
              </div>`
                : ''}
            </div>
            </div>
          </section>
          ${settingsOpen && loggedIn ? `
          <div class="profile-settings-overlay" id="profile-settings-overlay">
            <div class="card card--plain profile-settings">
              <div class="profile-settings-header">
                <button class="profile-settings-back" type="button" id="profile-settings-back">${escapeHtml(
                  profileCopy.close || (rawLocaleSetting === 'es' ? 'Cerrar' : 'Close')
                )}</button>
              </div>
              <div class="profile-avatar-block">
                <div class="profile-avatar-wrap">
                  <img
                    class="profile-avatar-large"
                    id="profile-avatar-img"
                    src="${avatarSrc}"
                    alt="${escapeHtml(profileCopy.profileAvatarAlt || 'Profile avatar')}"
                  >
                </div>
                <div class="profile-avatar-actions">
                  <ion-button shape="round" id="profile-avatar-upload" style="text-transform:none">${escapeHtml(
                    profileCopy.changePhoto || 'Change photo'
                  )}</ion-button>
                  <ion-button shape="round" color="danger" id="profile-avatar-delete" fill="solid" style="text-transform:none">${escapeHtml(
                    profileCopy.deletePhoto || 'Delete'
                  )}</ion-button>
                </div>
                <input type="file" accept="image/jpeg,image/png,image/gif" id="profile-avatar-input" hidden>
              </div>
              <div class="profile-form">
                <div class="profile-form-row">
                  <label class="profile-input-shell" for="profile-first-name">
                    <span class="profile-input-icon" aria-hidden="true"><ion-icon name="person-outline"></ion-icon></span>
                    <input class="profile-input profile-input--shell" type="text" id="profile-first-name"
                      value="${escapeHtml(profileState.first_name || '')}"
                      placeholder="${escapeHtml(profileCopy.firstName || 'First name')}"
                      aria-label="${escapeHtml(profileCopy.firstName || 'First name')}">
                  </label>
                  <label class="profile-input-shell" for="profile-last-name">
                    <span class="profile-input-icon" aria-hidden="true"><ion-icon name="people-outline"></ion-icon></span>
                    <input class="profile-input profile-input--shell" type="text" id="profile-last-name"
                      value="${escapeHtml(profileState.last_name || '')}"
                      placeholder="${escapeHtml(profileCopy.lastName || 'Last name')}"
                      aria-label="${escapeHtml(profileCopy.lastName || 'Last name')}">
                  </label>
                </div>
                <div class="profile-form-row">
                  <label class="profile-input-shell" for="profile-password">
                    <span class="profile-input-icon" aria-hidden="true"><ion-icon name="lock-closed-outline"></ion-icon></span>
                    <input class="profile-input profile-input--shell" type="password" id="profile-password"
                      autocomplete="new-password"
                      placeholder="${escapeHtml(profileCopy.passwordNewPlaceholder || 'New password')}"
                      aria-label="${escapeHtml(profileCopy.password || 'Password')}">
                    <button class="profile-input-toggle" type="button" id="profile-password-toggle" aria-label="${escapeHtml(profileCopy.password || 'Password')}">
                      <ion-icon name="eye-outline"></ion-icon>
                    </button>
                  </label>
                  <label class="profile-input-shell" for="profile-password-confirm">
                    <span class="profile-input-icon" aria-hidden="true"><ion-icon name="lock-closed-outline"></ion-icon></span>
                    <input class="profile-input profile-input--shell" type="password" id="profile-password-confirm"
                      autocomplete="new-password"
                      placeholder="${escapeHtml(profileCopy.passwordRepeatPlaceholder || 'Repeat password')}"
                      aria-label="${escapeHtml(profileCopy.passwordRepeat || 'Repeat password')}">
                    <button class="profile-input-toggle" type="button" id="profile-password-confirm-toggle" aria-label="${escapeHtml(profileCopy.passwordRepeat || 'Repeat password')}">
                      <ion-icon name="eye-outline"></ion-icon>
                    </button>
                  </label>
                </div>
                <div class="profile-form-row">
                  <label class="profile-input-shell profile-input-shell--select" for="profile-locale">
                    <span class="profile-input-icon" aria-hidden="true"><ion-icon name="globe-outline"></ion-icon></span>
                    <select class="profile-input profile-input--shell" id="profile-locale" aria-label="${escapeHtml(profileCopy.interfaceLanguage || 'Interface language')}">
                      <option value="es"${(user && user.locale || rawLocaleSetting) === 'es' ? ' selected' : ''}>ES</option>
                      <option value="en"${(user && user.locale || rawLocaleSetting) === 'en' ? ' selected' : ''}>EN</option>
                    </select>
                  </label>
                </div>
                <div class="profile-form-row">
                  <label class="profile-input-shell" for="profile-email">
                    <span class="profile-input-icon" aria-hidden="true"><ion-icon name="mail-outline"></ion-icon></span>
                    <input class="profile-input profile-input--shell" type="email" id="profile-email"
                      value="${escapeHtml(profileState.email || '')}" readonly
                      aria-label="${escapeHtml(profileCopy.email || 'Email')}">
                  </label>
                  <label class="profile-input-shell" for="profile-expiry">
                    <span class="profile-input-icon" aria-hidden="true"><ion-icon name="calendar-outline"></ion-icon></span>
                    <input class="profile-input profile-input--shell" type="text" id="profile-expiry"
                      value="${escapeHtml(formatExpiry(profileState.expires_date))}" readonly
                      aria-label="${escapeHtml(profileCopy.subscriptionUntil || 'Subscription until')}">
                  </label>
                </div>
              </div>
              <div class="profile-save-row">
                <ion-button expand="block" shape="round" id="profile-save-btn">${escapeHtml(profileCopy.saveChanges || 'Save changes')}</ion-button>
                <p class="profile-save-note ${profileNoteError ? 'error' : ''}" id="profile-save-note">${profileNote ? escapeHtml(profileNote) : ''}</p>
              </div>
              <div class="profile-logout-row">
                <ion-button expand="block" shape="round" fill="outline" class="profile-logout-btn" id="profile-logout-btn">
                  <ion-icon slot="start" name="log-out-outline"></ion-icon>
                  ${escapeHtml(profileCopy.logout || 'Log out')}
                </ion-button>
              </div>
              <div class="profile-restore-row">
                <ion-button expand="block" shape="round" fill="outline" class="profile-restore-btn" id="profile-restore-purchases-btn">
                  <ion-icon slot="start" name="refresh-outline"></ion-icon>
                  ${escapeHtml(profileCopy.restorePurchases || 'Restore purchases')}
                </ion-button>
              </div>
              <div class="profile-delete-account-row">
                <ion-button expand="block" shape="round" color="danger" class="profile-delete-account-btn" id="profile-delete-account-btn">
                  <ion-icon slot="start" name="trash-outline"></ion-icon>
                  ${escapeHtml(profileCopy.deleteAccount || 'Delete account')}
                </ion-button>
                <p class="profile-delete-account-note">${escapeHtml(profileCopy.deleteAccountHint || 'Your account will be removed and you will be signed out.')}</p>
              </div>
              <div class="profile-links profile-links--footer" id="profile-links-footer">
                <button class="profile-link-btn" type="button" data-action="contact">${escapeHtml(profileCopy.contact || 'Contact')}</button>
                <button class="profile-link-btn" type="button" data-action="iap-support">${escapeHtml(
                  profileCopy.subscriptionSupportMail || 'Send subscription support email'
                )}</button>
                <button class="profile-link-btn" type="button" data-action="legal">${escapeHtml(profileCopy.legal || 'Legal')}</button>
              </div>
              <div class="profile-app-meta" id="profile-app-meta">${escapeHtml(appMetaLabel)}</div>
            </div>
          </div>
          ` : ''}
        </div>
      </ion-content>
    `;

    if (loggedIn) {
      this.bindProfileSheetInteractions();
      this.scheduleProfileLayout(0);
    } else {
      const authHeroEl = this.querySelector('#profile-auth-hero-section');
      const handleAuthHeroActivate = (event) => {
        const target = event && event.target instanceof Element ? event.target : null;
        if (!target) return;
        const inBubble = target.closest('#profile-auth-hero-bubble, .hero-playable-bubble, .journey-plan-bubble');
        if (!inBubble) return;
        if (event.type === 'keydown') {
          const key = event && event.key ? event.key : '';
          if (key !== 'Enter' && key !== ' ') return;
        }
        event.preventDefault();
        this.playAuthHeroBubble().catch(() => {});
      };
      authHeroEl?.addEventListener('click', handleAuthHeroActivate);
      authHeroEl?.addEventListener('keydown', handleAuthHeroActivate);
    }
    if (becameLoggedOut) {
      this.settleLoggedOutEntryFrame();
    } else if (loggedIn) {
      this.classList.remove('profile-auth-entering');
    }
    this._lastRenderedLoggedIn = loggedIn;

    const linksLogin = this.querySelector('#profile-links-login');
    const linksFooter = this.querySelector('#profile-links-footer');
    const appMetaEl = this.querySelector('#profile-app-meta');
    const avatarInput = this.querySelector('#profile-avatar-input');
    const avatarUploadBtn = this.querySelector('#profile-avatar-upload');
    const avatarDeleteBtn = this.querySelector('#profile-avatar-delete');
    const profileFirstName = this.querySelector('#profile-first-name');
    const profileLastName = this.querySelector('#profile-last-name');
    const profilePassword = this.querySelector('#profile-password');
    const profilePasswordConfirm = this.querySelector('#profile-password-confirm');
    const profileSaveBtn = this.querySelector('#profile-save-btn');
    const profileLogoutBtn = this.querySelector('#profile-logout-btn');
    const profileRestorePurchasesBtn = this.querySelector('#profile-restore-purchases-btn');
    const profileDeleteAccountBtn = this.querySelector('#profile-delete-account-btn');
    const profileSaveNote = this.querySelector('#profile-save-note');
    const profileEarnedBadgesEl = this.querySelector('#profile-earned-badges');
    const profileSettingsBackBtn = this.querySelector('#profile-settings-back');

    const updateProfileState = (nextUser) => {
      const nextUserId =
        nextUser && nextUser.id !== undefined && nextUser.id !== null ? String(nextUser.id) : '';
      const isLoggedIn = Boolean(nextUserId);
      const loginPanel = this.querySelector('#profile-login-panel');
      const authHeroSection = this.querySelector('#profile-auth-hero-section');
      const authCardSection = this.querySelector('#profile-auth-card-section');
      const heroSection = this.querySelector('#profile-hero-section');
      const cardSection = this.querySelector('#profile-card-section');
      if (loginPanel) loginPanel.hidden = isLoggedIn;
      if (authHeroSection) authHeroSection.hidden = isLoggedIn;
      if (authCardSection) authCardSection.hidden = isLoggedIn;
      if (heroSection) heroSection.hidden = !isLoggedIn;
      if (cardSection) cardSection.hidden = !isLoggedIn;
      if (linksLogin) linksLogin.hidden = isLoggedIn;
      const shouldShowFooterLinks = isLoggedIn && this.settingsOpen === true;
      const shouldShowAppMeta = isLoggedIn && this.settingsOpen === true;
      if (linksFooter) linksFooter.hidden = !shouldShowFooterLinks;
      if (appMetaEl) appMetaEl.hidden = !shouldShowAppMeta;
    };

    const openLoginModal = async () => {
      if (typeof window.openLoginModal === 'function') {
        await window.openLoginModal({ locked: false });
        return;
      }
      let modal = document.querySelector('ion-modal.login-modal');
      if (!modal) {
        modal = document.createElement('ion-modal');
        modal.classList.add('login-modal');
        modal.component = 'page-login';
        modal.backdropDismiss = true;
        modal.keepContentsMounted = true;
        const presentingEl = document.querySelector('ion-router-outlet');
        if (presentingEl) {
          modal.presentingElement = presentingEl;
        }
        document.body.appendChild(modal);
      }

      if (modal.presented || modal.isOpen) {
        return;
      }
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
      await modal.present();
    };

    const hasIonAlert = () =>
      Boolean(
        window.customElements &&
          typeof window.customElements.get === 'function' &&
          window.customElements.get('ion-alert')
      );

    const replaceCopyToken = (template, token, value) =>
      String(template || '').split(token).join(value);

    const presentProfileAlert = async (header, message) => {
      const title = String(header || '').trim();
      const body = String(message || '').trim();
      if (!hasIonAlert()) {
        window.alert(body ? `${title}\n\n${body}` : title);
        return;
      }
      const alert = document.createElement('ion-alert');
      alert.header = title;
      alert.message = body;
      alert.buttons = ['OK'];
      document.body.appendChild(alert);
      await alert.present();
      await alert.onDidDismiss();
      alert.remove();
    };

    const getDeleteAccountConfirmationConfig = (accountUser) => {
      const email =
        accountUser && typeof accountUser.email === 'string' ? String(accountUser.email).trim() : '';
      if (email) {
        return {
          kind: 'email',
          value: email,
          label: replaceCopyToken(
            profileCopy.deleteAccountConfirmEmailLabel || 'Type this email to confirm: {value}',
            '{value}',
            email
          ),
          placeholder:
            profileCopy.deleteAccountConfirmPlaceholderEmail || 'you@email.com',
          inputType: 'email'
        };
      }
      return {
        kind: 'keyword',
        value: 'DELETE',
        label:
          profileCopy.deleteAccountConfirmKeywordLabel || 'Type DELETE to confirm.',
        placeholder:
          profileCopy.deleteAccountConfirmPlaceholderKeyword || 'DELETE',
        inputType: 'text'
      };
    };

    const normalizeDeleteConfirmationValue = (value) =>
      String(value || '').trim().toLowerCase();

    const promptDeleteAccountConfirmation = async (accountUser) => {
      const confirmation = getDeleteAccountConfirmationConfig(accountUser);
      const title = profileCopy.deleteAccountConfirmTitle || 'Delete account';
      const messageText = profileCopy.deleteAccountConfirmMessage || 'This action is permanent.';
      if (!hasIonAlert()) {
        const promptMessage = `${title}\n\n${messageText}\n\n${confirmation.label}`;
        return window.prompt(promptMessage, '');
      }
      const alert = document.createElement('ion-alert');
      alert.header = title;
      alert.subHeader = confirmation.label;
      alert.message = messageText;
      alert.inputs = [
        {
          name: 'confirmationValue',
          type: confirmation.inputType,
          placeholder: confirmation.placeholder,
          attributes: {
            autocapitalize: 'off',
            autocorrect: 'off',
            spellcheck: 'false'
          }
        }
      ];
      alert.buttons = [
        {
          text: profileCopy.deleteAccountConfirmCancel || 'Cancel',
          role: 'cancel'
        },
        {
          text: profileCopy.deleteAccountConfirmAccept || 'Delete',
          role: 'confirm'
        }
      ];
      document.body.appendChild(alert);
      await alert.present();
      const result = await alert.onDidDismiss();
      alert.remove();
      if (!result || result.role !== 'confirm') return null;
      const values = result.data && result.data.values ? result.data.values : {};
      return values && typeof values.confirmationValue === 'string'
        ? values.confirmationValue
        : '';
    };
    profileEarnedBadgesEl?.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target ? target.closest('[data-badge-id]') : null;
      if (!button) return;
      const badgeId = String(button.dataset.badgeId || '').trim();
      if (!badgeId) return;
      if (typeof window.openSpeakBadgePopup === 'function') {
        window.openSpeakBadgePopup(badgeId).catch(() => {});
      }
    });

    const updateProfileNote = () => {
      if (!profileSaveNote) return;
      const passwordError = getPasswordError();
      if (this.profileSaveMessage) {
        profileSaveNote.textContent = this.profileSaveMessage;
        profileSaveNote.classList.toggle('error', this.profileSaveError === true);
        return;
      }
      if (passwordError) {
        profileSaveNote.textContent = passwordError;
        profileSaveNote.classList.add('error');
        return;
      }
      profileSaveNote.textContent = '';
      profileSaveNote.classList.remove('error');
    };

    const updateSaveState = () => {
      const passwordError = getPasswordError();
      const dirty = hasProfileChanges();
      const pending = this.profileSavePending === true;
      if (profileSaveBtn) {
        profileSaveBtn.disabled = !dirty || !!passwordError || pending;
      }
      if (profileLogoutBtn) profileLogoutBtn.disabled = pending;
      if (profileRestorePurchasesBtn) profileRestorePurchasesBtn.disabled = pending;
      if (profileDeleteAccountBtn) profileDeleteAccountBtn.disabled = pending;
      if (avatarUploadBtn) avatarUploadBtn.disabled = pending;
      if (avatarDeleteBtn) avatarDeleteBtn.disabled = pending;
      if (avatarInput) avatarInput.disabled = pending;
      updateProfileNote();
    };

    const markProfileDirty = () => {
      this.profileSaveMessage = '';
      this.profileSaveError = false;
      updateSaveState();
    };

    const setProfileMessage = (message, isError) => {
      this.profileSaveMessage = message;
      this.profileSaveError = !!isError;
      updateSaveState();
    };

    const avatarConfig = {
      maxBytes: 500000,
      types: {
        'image/jpeg': 'jpeg',
        'image/png': 'png',
        'image/gif': 'gif'
      },
      exts: ['jpg', 'jpeg', 'png', 'gif']
    };

    const getAvatarExt = (file) => {
      if (file && file.type && avatarConfig.types[file.type]) {
        return avatarConfig.types[file.type];
      }
      if (file && file.name && file.name.includes('.')) {
        return file.name.split('.').pop().toLowerCase();
      }
      return 'jpeg';
    };

    const validateAvatarFile = (file) => {
      if (!file) {
        return { ok: false, message: profileCopy.fileReadError || 'Could not read the file.' };
      }
      if (file.type) {
        if (!avatarConfig.types[file.type]) {
          return { ok: false, message: profileCopy.fileFormatError || 'Unsupported format. Use JPG, PNG or GIF.' };
        }
      } else {
        const ext = getAvatarExt(file);
        if (!avatarConfig.exts.includes(ext)) {
          return { ok: false, message: profileCopy.fileFormatError || 'Unsupported format. Use JPG, PNG or GIF.' };
        }
      }
      if (file.size && file.size > avatarConfig.maxBytes) {
        return { ok: false, message: profileCopy.fileTooLarge || 'File too large. Max 500 KB.' };
      }
      return { ok: true, message: '' };
    };

    const applyProfileField = (field, value) => {
      if (!this.profileFormState) return;
      this.profileFormState[field] = value;
      markProfileDirty();
    };

    profileFirstName?.addEventListener('input', (event) => {
      applyProfileField('first_name', event.target.value);
    });
    profileLastName?.addEventListener('input', (event) => {
      applyProfileField('last_name', event.target.value);
    });
    profilePassword?.addEventListener('input', (event) => {
      applyProfileField('password', event.target.value);
    });
    profilePasswordConfirm?.addEventListener('input', (event) => {
      applyProfileField('passwordConfirm', event.target.value);
    });
    this.querySelector('#profile-password-toggle')?.addEventListener('click', () => {
      const passEl = this.querySelector('#profile-password');
      const iconEl = this.querySelector('#profile-password-toggle ion-icon');
      if (!passEl) return;
      const showing = passEl.getAttribute('type') === 'text';
      passEl.setAttribute('type', showing ? 'password' : 'text');
      if (iconEl) {
        iconEl.setAttribute('name', showing ? 'eye-outline' : 'eye-off-outline');
      }
    });
    this.querySelector('#profile-password-confirm-toggle')?.addEventListener('click', () => {
      const passEl = this.querySelector('#profile-password-confirm');
      const iconEl = this.querySelector('#profile-password-confirm-toggle ion-icon');
      if (!passEl) return;
      const showing = passEl.getAttribute('type') === 'text';
      passEl.setAttribute('type', showing ? 'password' : 'text');
      if (iconEl) {
        iconEl.setAttribute('name', showing ? 'eye-outline' : 'eye-off-outline');
      }
    });

    const clearLocalAvatar = async (targetUser) => {
      const fs = window.Capacitor?.Plugins?.Filesystem;
      if (!fs || !targetUser || targetUser.id === undefined || targetUser.id === null) return;
      const path = targetUser.image_path || `avatars/${targetUser.id}.jpg`;
      try {
        await fs.deleteFile({ path, directory: 'DATA' });
      } catch (err) {
        // no-op
      }
    };

    const updateLocalUser = (nextUser) => {
      if (typeof window.setUser === 'function') {
        window.setUser(nextUser);
      } else {
        window.user = nextUser;
        try {
          localStorage.setItem('appv5:user', JSON.stringify(nextUser));
        } catch (err) {
          console.error('[profile] error guardando usuario', err);
        }
        window.dispatchEvent(new CustomEvent('app:user-change', { detail: nextUser }));
      }
      return nextUser;
    };

    const submitProfileUpdate = async () => {
      if (!user || !profileSaveBtn) return;
      const passwordError = getPasswordError();
      if (passwordError) {
        setProfileMessage(passwordError, true);
        return;
      }
      if (!hasProfileChanges()) {
        setProfileMessage('', false);
        return;
      }
      this.profileSavePending = true;
      updateSaveState();
      const firstName = String(profileState.first_name || '').trim();
      const lastName = String(profileState.last_name || '').trim();
      const profileLocaleEl = this.querySelector('#profile-locale');
      const chosenLocale = profileLocaleEl ? profileLocaleEl.value : (rawLocaleSetting || 'es');
      const payload = {
        first_name: firstName,
        last_name: lastName,
        birthdate: profileSeed.birthdate || '1901-01-01',
        sex: profileSeed.sex,
        lc: profileSeed.lc,
        locale: chosenLocale
      };
      if (profileState.password) {
        payload.password = String(profileState.password);
      }
      const result = await doPost('/v3/usr/updateprofile', user, payload);
      this.profileSavePending = false;
      if (!result.ok) {
        const message =
          (result && result.data && result.data.error) ||
          (result && result.error) ||
          profileCopy.profileUpdateFailed ||
          'Could not update profile.';
        setProfileMessage(message, true);
        updateSaveState();
        return;
      }
      setAppLocale(chosenLocale);
      clearLocaleOverride();
      if (window.varGlobal && typeof window.varGlobal === 'object') {
        window.varGlobal.locale = chosenLocale;
      }
      const nextUser = {
        ...user,
        first_name: firstName,
        last_name: lastName,
        name: `${firstName} ${lastName}`.trim(),
        lc: profileSeed.lc,
        locale: chosenLocale
      };
      resetProfileState(nextUser);
      setProfileMessage(profileCopy.profileUpdated || 'Profile updated.', false);
      updateLocalUser(nextUser);
      updateSaveState();
    };

    profileSaveBtn?.addEventListener('click', () => {
      submitProfileUpdate().catch((err) => {
        console.error('[profile] error guardando perfil', err);
        setProfileMessage(profileCopy.profileUpdateFailed || 'Could not update profile.', true);
      });
    });

    this.querySelector('#profile-logout-btn')?.addEventListener('click', () => {
      if (typeof window.setUser === 'function') {
        window.setUser(null);
      }
    });

    profileRestorePurchasesBtn?.addEventListener('click', () => {
      try {
        if (typeof window.IAPrestorePurchases === 'function') {
          window.IAPrestorePurchases();
          if (typeof window.presentAppToast === 'function') {
            window.presentAppToast(
              rawLocaleSetting === 'es' ? 'Recuperación de compras lanzada.' : 'Restore purchases started.'
            );
          }
        } else if (typeof window.presentAppToast === 'function') {
          window.presentAppToast(
            rawLocaleSetting === 'es'
              ? 'Recuperar compras no está disponible.'
              : 'Restore purchases is not available.'
          );
        }
      } catch (err) {
        if (typeof window.presentAppToast === 'function') {
          const baseMessage = rawLocaleSetting === 'es'
            ? 'Error al recuperar compras'
            : 'Error restoring purchases';
          window.presentAppToast(`${baseMessage}: ${err && err.message ? err.message : String(err)}`);
        }
      }
    });

    const deleteAccount = async () => {
      if (!user) return;
      const confirmation = getDeleteAccountConfirmationConfig(user);
      const typedValue = await promptDeleteAccountConfirmation(user);
      if (typedValue === null) return;
      if (
        normalizeDeleteConfirmationValue(typedValue) !==
        normalizeDeleteConfirmationValue(confirmation.value)
      ) {
        setProfileMessage(
          profileCopy.deleteAccountConfirmMismatch || 'The confirmation does not match.',
          true
        );
        return;
      }
      this.profileSavePending = true;
      updateSaveState();
      try {
        const result = await doPost('/v3/usr/deleteaccount', user, {
          confirmation_type: confirmation.kind,
          confirmation_value: String(typedValue || '').trim(),
          locale: rawLocaleSetting || 'es',
          source: 'profile'
        });
        if (!result.ok) {
          const message =
            (result &&
              result.data &&
              typeof result.data === 'object' &&
              result.data.error) ||
            (result && result.error) ||
            profileCopy.deleteAccountFailed ||
            'Could not delete the account.';
          setProfileMessage(message, true);
          return;
        }
        await clearLocalAvatar(user);
        if (typeof window.setUser === 'function') {
          window.setUser(null);
        }
        await presentProfileAlert(
          profileCopy.deleteAccountDeletedTitle || 'Account deleted',
          profileCopy.deleteAccountDeletedMessage ||
            'Your account has been deleted and you have been signed out.'
        );
      } catch (err) {
        console.error('[profile] error eliminando cuenta', err);
        setProfileMessage(
          profileCopy.deleteAccountFailed || 'Could not delete the account.',
          true
        );
      } finally {
        this.profileSavePending = false;
        updateSaveState();
      }
    };

    profileDeleteAccountBtn?.addEventListener('click', () => {
      deleteAccount();
    });

    const uploadAvatar = async (file) => {
      if (!user || !file) return;
      const validation = validateAvatarFile(file);
      if (!validation.ok) {
        setProfileMessage(validation.message, true);
        return;
      }
      this.profileSavePending = true;
      updateSaveState();
      const apiURL =
        (window.varGlobal && window.varGlobal.apiURL) ||
        (window.env === 'PRO' ? window.apiPRO : window.apiDEV) ||
        '';
      const timestamp = Math.round(Date.now() / 1000);
      const query = new URLSearchParams({
        timestamp: String(timestamp),
        user_id: String(user.id),
        token: String(user.token || '')
      }).toString();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('user_id', user.id);
      formData.append('token', user.token || '');
      formData.append('timestamp', timestamp);
      try {
        const response = await fetch(`${apiURL}/v3/fileupload?${query}`, {
          method: 'POST',
          headers: {
            Authorization: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            'X-Platform': deviceId()
          },
          body: formData
        });
        const text = await response.text();
        let payload = null;
        if (text) {
          try {
            payload = JSON.parse(text);
          } catch (err) {
            payload = null;
          }
        }
        if (!response.ok || (payload && payload.error)) {
          const message =
            (payload && payload.error) ||
            profileCopy.avatarUploadFailed ||
            'Could not upload avatar.';
          setProfileMessage(message, true);
          this.profileSavePending = false;
          updateSaveState();
          return;
        }
        const imageUrl = payload && payload.image_url ? String(payload.image_url) : '';
        const avatarFileName =
          payload && payload.avatar_file_name ? String(payload.avatar_file_name) : '';
        const ext = getAvatarExt(file);
        const baseAvatar =
          imageUrl ||
          `https://s3.amazonaws.com/sk.assets/avatars/${user.id}/avatarv4.${ext}`;
        const cacheBust = baseAvatar.includes('?') ? '&ts=' : '?ts=';
        const nextAvatar = `${baseAvatar}${cacheBust}${Date.now()}`;
        const resolvedAvatarFileName = avatarFileName || nextAvatar.split('/').pop().split('?')[0];
        const nextUser = {
          ...user,
          image: nextAvatar,
          avatar_file_name: resolvedAvatarFileName,
          image_local: '',
          image_path: ''
        };
        await clearLocalAvatar(user);
        if (typeof refreshUserAvatarLocal === 'function') {
          refreshUserAvatarLocal(nextUser, { force: true });
        }
        this.profileSavePending = false;
        resetProfileState(nextUser);
        setProfileMessage(profileCopy.avatarUpdated || 'Avatar updated.', false);
        updateLocalUser(nextUser);
      } catch (err) {
        console.error('[profile] error subiendo avatar', err);
        this.profileSavePending = false;
        setProfileMessage(profileCopy.avatarUploadFailed || 'Could not upload avatar.', true);
      }
    };

    const deleteAvatar = async () => {
      if (!user) return;
      this.profileSavePending = true;
      updateSaveState();
      const apiURL =
        (window.varGlobal && window.varGlobal.apiURL) ||
        (window.env === 'PRO' ? window.apiPRO : window.apiDEV) ||
        '';
      const timestamp = Math.round(Date.now() / 1000);
      const query = new URLSearchParams({
        timestamp: String(timestamp),
        user_id: String(user.id),
        token: String(user.token || '')
      }).toString();
      const payload = {
        user_id: user.id,
        token: user.token || '',
        timestamp
      };
      try {
        const response = await fetch(`${apiURL}/v3/deleteUserImage?${query}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            'X-Platform': deviceId()
          },
          body: JSON.stringify(payload)
        });
        const text = await response.text();
        let resPayload = null;
        if (text) {
          try {
            resPayload = JSON.parse(text);
          } catch (err) {
            resPayload = null;
          }
        }
        if (!response.ok || (resPayload && resPayload.error)) {
          const message =
            (resPayload && resPayload.error) ||
            profileCopy.avatarDeleteFailed ||
            'Could not delete avatar.';
          setProfileMessage(message, true);
          this.profileSavePending = false;
          updateSaveState();
          return;
        }
        const baseAvatar =
          (resPayload && resPayload.image_url ? String(resPayload.image_url) : '') ||
          'https://s3.amazonaws.com/sk.CursoIngles/no-avatar.gif';
        const nextAvatar = `${baseAvatar}${baseAvatar.includes('?') ? '&ts=' : '?ts='}${Date.now()}`;
        const nextAvatarFileName =
          resPayload && resPayload.avatar_file_name ? String(resPayload.avatar_file_name) : '';
        const nextUser = {
          ...user,
          avatar_file_name: nextAvatarFileName,
          image: nextAvatar,
          image_local: '',
          image_path: ''
        };
        await clearLocalAvatar(nextUser);
        this.profileSavePending = false;
        resetProfileState(nextUser);
        setProfileMessage(profileCopy.avatarDeleted || 'Avatar deleted.', false);
        updateLocalUser(nextUser);
      } catch (err) {
        console.error('[profile] error eliminando avatar', err);
        this.profileSavePending = false;
        setProfileMessage(profileCopy.avatarDeleteFailed || 'Could not delete avatar.', true);
      }
    };

    avatarUploadBtn?.addEventListener('click', () => {
      if (avatarInput) avatarInput.click();
    });

    avatarInput?.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
      if (!file) return;
      const validation = validateAvatarFile(file);
      if (!validation.ok) {
        setProfileMessage(validation.message, true);
        event.target.value = '';
        return;
      }
      uploadAvatar(file);
      event.target.value = '';
    });

    avatarDeleteBtn?.addEventListener('click', () => {
      deleteAvatar();
    });

    const linkButtons = Array.from(this.querySelectorAll('.profile-link-btn'));
    linkButtons.forEach((button) => {
      const action = button.dataset.action;
      const fnName =
        action === 'contact'
          ? 'sendMail'
          : action === 'iap-support'
          ? 'openIapSupportMail'
          : action === 'legal'
          ? 'goWebLegal'
          : '';
      const fn = fnName ? window[fnName] : null;
      if (typeof fn !== 'function') {
        button.disabled = true;
        return;
      }
      button.addEventListener('click', () => {
        try {
          fn();
        } catch (err) {
          console.error('[profile] error ejecutando accion', err);
        }
      });
    });

    const tabButtons = Array.from(this.querySelectorAll('.profile-segmented-btn'));
    tabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const tab = button.dataset.tab;
        if (!tab || tab === this.activeTab) return;
        this.activeTab = tab;
        this.settingsOpen = false;
        persistProfileTab(tab);
        this.render();
      });
    });
    this.querySelector('#profile-settings-toggle')?.addEventListener('click', () => {
      this.settingsOpen = !(this.settingsOpen === true);
      this.render();
    });
    profileSettingsBackBtn?.addEventListener('click', () => {
      this.settingsOpen = false;
      this.render();
    });

    updateSaveState();


    const reviewCollapseBlocks = Array.from(this.querySelectorAll('[data-review-collapse]'));
    if (this._reviewResizeObserver) {
      this._reviewResizeObserver.disconnect();
    }
    reviewCollapseBlocks.forEach((contentEl) => {
      const container = contentEl.closest('.profile-review-block');
      const toggleBtn = container ? container.querySelector('.profile-review-more') : null;
      if (!container || !toggleBtn) return;
      toggleBtn.addEventListener('click', () => {
        container.classList.toggle('is-expanded');
        toggleBtn.textContent = container.classList.contains('is-expanded') ? '−' : '+';
      });
      if (this._reviewResizeObserver) {
        this._reviewResizeObserver.observe(contentEl);
      }
    });
    this.scheduleReviewCollapseRefresh();

    const findSessionLocation = (sessionId) => {
      if (!sessionId) return null;
      const entry = sessionLookup.get(sessionId);
      return entry ? { routeId: entry.routeId, moduleId: entry.moduleId, sessionId } : null;
    };

    const reviewButtons = Array.from(this.querySelectorAll('.review-entry'));
    reviewButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const type = button.dataset.type;
        if (type === 'reference-test') {
          const courseCode = String(button.dataset.courseCode || '').trim();
          const unitCode = String(button.dataset.unitCode || '').trim();
          const lessonCode = String(button.dataset.lessonCode || '').trim();
          const testKey = String(button.dataset.testKey || '').trim();
          if (!courseCode || !unitCode || !lessonCode || !testKey) return;
          if (!window.r34lp0w3r) window.r34lp0w3r = {};
          window.r34lp0w3r.profileReviewSelected = {
            type: 'reference-test',
            courseCode,
            unitCode,
            lessonCode,
            testKey
          };
          window.r34lp0w3r.profileForceTab = 'review';
          window.r34lp0w3r.profileReviewTone = this.reviewTone;
          window.r34lp0w3r.referenceDeepLink = {
            courseCode,
            unitCode,
            lessonCode,
            testKey,
            tab: 'tests'
          };
          const referencePage = document.querySelector('page-reference');
          if (referencePage && typeof referencePage.render === 'function') {
            try {
              referencePage.render();
            } catch (err) {
              console.error('[profile] error abriendo test de reference', err);
            }
          }
          const tabs = document.querySelector('ion-tabs');
          if (tabs && typeof tabs.select === 'function') {
            tabs.select('reference').catch(() => {});
          }
          return;
        }
        const sessionId = button.dataset.sessionId;
        const location = findSessionLocation(sessionId);
        if (!location) return;
        if (!window.r34lp0w3r) window.r34lp0w3r = {};
        if (type === 'phrase') {
          window.r34lp0w3r.profileReviewSelected = {
            type: 'phrase',
            sessionId
          };
          window.r34lp0w3r.speakStartStep = 'sentence';
          window.r34lp0w3r.speakStartWord = null;
        } else {
          const word = button.dataset.word;
          if (!word) return;
          window.r34lp0w3r.profileReviewSelected = {
            type: 'word',
            sessionId,
            word
          };
          window.r34lp0w3r.speakStartStep = 'spelling';
          window.r34lp0w3r.speakStartWord = word;
        }
        window.r34lp0w3r.speakReturnToReview = true;
        window.r34lp0w3r.speakReturnSessionId = sessionId;
        window.r34lp0w3r.profileForceTab = 'review';
        window.r34lp0w3r.profileReviewTone = this.reviewTone;
        setSelection(location);
        goToSpeak('forward');
      });
    });

    updateProfileState(user);

    const applyAppMeta = (meta) => {
      if (!appMetaEl) return;
      appMetaEl.textContent = formatAppMeta(meta);
    };
    applyAppMeta(window.appMeta);
    const appPlugin = window.Capacitor?.Plugins?.App;
    if (appPlugin && typeof appPlugin.getInfo === 'function') {
      appPlugin
        .getInfo()
        .then((info) => {
          if (!info || typeof info !== 'object') return;
          window.appMeta = { ...(window.appMeta || {}), ...info };
          applyAppMeta(window.appMeta);
        })
        .catch(() => {});
    }
    if (this._metaHandler) {
      window.removeEventListener('app:meta-change', this._metaHandler);
    }
    this._metaHandler = (event) => {
      const meta = event && event.detail ? event.detail : window.appMeta;
      applyAppMeta(meta);
    };
    window.addEventListener('app:meta-change', this._metaHandler);
  }
}

customElements.define('page-profile', PageProfile);
