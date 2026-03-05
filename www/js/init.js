const initState = {
  platform: 'browser',
  uuid: null,
  voicesUS: [],
  voicesGB: []
};

window.r34lp0w3r = window.r34lp0w3r || {};
window.r34lp0w3r.__uiSfxPlayers = window.r34lp0w3r.__uiSfxPlayers || {};
window.r34lp0w3r.__uiSfxLastPlayedAt = window.r34lp0w3r.__uiSfxLastPlayedAt || {};

const UI_SFX_SOURCES = {
  green: 'assets/sounds/green.mp3',
  yellow: 'assets/sounds/yellow.mp3',
  red: 'assets/sounds/red.mp3',
  notification: 'assets/sounds/notification.mp3'
};

const normalizeUiSfxKey = (value) => {
  const key = String(value || '')
    .trim()
    .toLowerCase();
  if (Object.prototype.hasOwnProperty.call(UI_SFX_SOURCES, key)) return key;
  if (key === 'good') return 'green';
  if (key === 'okay' || key === 'warn') return 'yellow';
  if (key === 'bad') return 'red';
  return '';
};

window.playSpeakUiSound = async (key, options = {}) => {
  try {
    const normalized = normalizeUiSfxKey(key);
    if (!normalized) return false;
    const src = UI_SFX_SOURCES[normalized];
    if (!src) return false;

    const minGapRaw = Number(options && options.minGapMs);
    const minGapMs = Number.isFinite(minGapRaw) && minGapRaw >= 0 ? minGapRaw : 120;
    const now = Date.now();
    const lastAt = Number(window.r34lp0w3r.__uiSfxLastPlayedAt[normalized] || 0);
    if (now - lastAt < minGapMs) return false;
    window.r34lp0w3r.__uiSfxLastPlayedAt[normalized] = now;

    let player = window.r34lp0w3r.__uiSfxPlayers[normalized];
    if (!player) {
      player = new Audio(src);
      player.preload = 'auto';
      player.playsInline = true;
      window.r34lp0w3r.__uiSfxPlayers[normalized] = player;
    }

    const forceRestart = options && options.forceRestart !== false;
    const volumeRaw = Number(options && options.volume);
    const volume = Number.isFinite(volumeRaw) ? Math.max(0, Math.min(1, volumeRaw)) : 1;
    player.volume = volume;

    if (forceRestart) {
      try {
        player.pause();
      } catch (_err) {
        // no-op
      }
      player.currentTime = 0;
    }

    const playResult = player.play();
    if (playResult && typeof playResult.then === 'function') {
      await playResult;
    }
    return true;
  } catch (_err) {
    return false;
  }
};

const isChromeTtsBrowser = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = String(navigator.userAgent || '');
  const isChromium = /Chrome|CriOS|Chromium/.test(ua);
  const isExcluded = /Edg|OPR|SamsungBrowser|DuckDuckGo/.test(ua);
  return isChromium && !isExcluded;
};

const waitForWebTtsVoices = (timeoutMs = 1400) =>
  new Promise((resolve) => {
    const synth = window.speechSynthesis;
    if (!synth || typeof synth.getVoices !== 'function') {
      resolve([]);
      return;
    }
    const voicesNow = synth.getVoices() || [];
    if (voicesNow.length) {
      resolve(voicesNow);
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (typeof synth.removeEventListener === 'function') {
        synth.removeEventListener('voiceschanged', onVoicesChanged);
      } else {
        synth.onvoiceschanged = null;
      }
      const voices = synth.getVoices ? synth.getVoices() : [];
      resolve(Array.isArray(voices) ? voices : []);
    };
    const onVoicesChanged = () => finish();
    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', onVoicesChanged, { once: true });
    } else {
      synth.onvoiceschanged = onVoicesChanged;
    }
    setTimeout(finish, Math.max(200, timeoutMs));
  });

window.cancelWebSpeech = () => {
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (!synth || typeof synth.cancel !== 'function') return;
  try {
    synth.cancel();
    window.r34lp0w3r.__speechCancelTs = Date.now();
    window.r34lp0w3r.__webTtsReqSeq = Number(window.r34lp0w3r.__webTtsReqSeq || 0) + 1;
  } catch (err) {
    // no-op
  }
};

window.speakWebUtterance = (utter) => {
  if (typeof window === 'undefined') return false;
  const synth = window.speechSynthesis;
  if (!synth || typeof synth.speak !== 'function' || !utter) return false;

  const originalOnStart = typeof utter.onstart === 'function' ? utter.onstart : null;
  const originalOnEnd = typeof utter.onend === 'function' ? utter.onend : null;
  const originalOnError = typeof utter.onerror === 'function' ? utter.onerror : null;
  const myReqSeq = Number(window.r34lp0w3r.__webTtsReqSeq || 0) + 1;
  window.r34lp0w3r.__webTtsReqSeq = myReqSeq;
  let started = false;
  let finished = false;
  let startEventSent = false;
  let startWatchdog = null;
  let pendingWatchdog = null;
  let endWatchdog = null;
  let completionWatchdog = null;
  let startAtTs = 0;
  let idleProbeCount = 0;
  let retriedForVoices = false;
  let retriedForNoStart = false;

  const callHandler = (handler, payload) => {
    if (typeof handler !== 'function') return;
    try {
      handler(payload);
    } catch (err) {
      // no-op
    }
  };

  const clearWatchdogs = () => {
    if (startWatchdog) {
      clearTimeout(startWatchdog);
      startWatchdog = null;
    }
    if (pendingWatchdog) {
      clearTimeout(pendingWatchdog);
      pendingWatchdog = null;
    }
    if (endWatchdog) {
      clearTimeout(endWatchdog);
      endWatchdog = null;
    }
    if (completionWatchdog) {
      clearInterval(completionWatchdog);
      completionWatchdog = null;
    }
  };

  const finishWithEnd = (payload) => {
    if (finished) return;
    finished = true;
    clearWatchdogs();
    callHandler(originalOnEnd, payload);
  };

  const finishWithError = (errorCode = 'speak-failed') => {
    if (finished) return;
    finished = true;
    clearWatchdogs();
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn('[tts-web] speak error', errorCode, {
        lang: utter && utter.lang ? utter.lang : '',
        textLen: utter && utter.text ? String(utter.text).length : 0,
        speaking: Boolean(synth && synth.speaking),
        pending: Boolean(synth && synth.pending)
      });
    }
    callHandler(originalOnError, { error: errorCode });
  };

  const markStart = (eventPayload) => {
    if (finished) return;
    started = true;
    startAtTs = Date.now();
    idleProbeCount = 0;
    if (startEventSent) return;
    startEventSent = true;
    callHandler(originalOnStart, eventPayload);
    if (!completionWatchdog) {
      completionWatchdog = setInterval(() => {
        if (finished || !started) return;
        const speaking = Boolean(synth && synth.speaking);
        const pending = Boolean(synth && synth.pending);
        if (speaking || pending) {
          idleProbeCount = 0;
          return;
        }
        if (Date.now() - startAtTs < 280) return;
        idleProbeCount += 1;
        if (idleProbeCount >= 2) {
          finishWithEnd({ type: 'end', synthetic: true });
        }
      }, 180);
    }
    const textLength = String(utter.text || '').length;
    const estimateMs = Math.max(2600, Math.min(24000, 1900 + textLength * 95));
    endWatchdog = setTimeout(() => {
      if (finished) return;
      if (!synth.speaking && !synth.pending) {
        finishWithEnd({ type: 'end', synthetic: 'idle-timeout' });
        return;
      }
      setTimeout(() => {
        if (finished) return;
        if (!synth.speaking && !synth.pending) {
          finishWithEnd({ type: 'end', synthetic: 'late-idle' });
          return;
        }
        try {
          if (typeof synth.cancel === 'function') {
            synth.cancel();
          }
        } catch (err) {
          // no-op
        }
        finishWithError('speak-end-timeout');
      }, 360);
    }, estimateMs);
  };

  const retrySpeakAfterCancel = () => {
    if (retriedForNoStart) return false;
    retriedForNoStart = true;
    try {
      if (typeof synth.cancel === 'function') {
        synth.cancel();
      }
    } catch (err) {
      // no-op
    }
    setTimeout(() => {
      if (finished) return;
      runSpeak();
    }, 90);
    return true;
  };

  const selectBestVoice = () => {
    if (!utter || utter.voice || typeof synth.getVoices !== 'function') return;
    if (isChromeTtsBrowser()) return;
    const allVoices = synth.getVoices() || [];
    if (!allVoices.length) return;
    const targetLang = String(utter.lang || '').toLowerCase();
    const rankVoice = (voice) => {
      const isLocal = Boolean(voice && voice.localService);
      const isDefault = Boolean(voice && voice.default);
      return (isLocal ? 2 : 0) + (isDefault ? 1 : 0);
    };
    const pickBest = (voices) =>
      voices
        .slice()
        .sort((a, b) => rankVoice(b) - rankVoice(a))[0] || null;

    let voiceMatch = null;
    if (targetLang) {
      const prefix = targetLang.split('-')[0];
      const exact = allVoices.filter(
        (voice) => String(voice.lang || '').toLowerCase() === targetLang
      );
      const starts = allVoices.filter((voice) =>
        String(voice.lang || '').toLowerCase().startsWith(prefix)
      );
      voiceMatch = pickBest(exact) || pickBest(starts);
    }
    if (!voiceMatch) {
      const defaults = allVoices.filter((voice) => Boolean(voice && voice.default));
      const locals = allVoices.filter((voice) => Boolean(voice && voice.localService));
      voiceMatch = pickBest(defaults) || pickBest(locals) || allVoices[0] || null;
    }
    if (voiceMatch) {
      utter.voice = voiceMatch;
    }
  };

  const lastCancel = Number(window.r34lp0w3r.__speechCancelTs || 0);
  const elapsed = Date.now() - lastCancel;
  let delayMs = 0;
  const hasUserActivation = Boolean(
    typeof navigator !== 'undefined' &&
    navigator.userActivation &&
    navigator.userActivation.isActive
  );
  if (isChromeTtsBrowser()) {
    const minGapAfterCancel = 110;
    if (!hasUserActivation && elapsed >= 0 && elapsed < minGapAfterCancel) {
      delayMs = Math.max(delayMs, minGapAfterCancel - elapsed);
    }
  }

  utter.onstart = (event) => markStart(event);
  utter.onend = (event) => finishWithEnd(event);
  utter.onerror = (event) => {
    if (finished) return;
    finished = true;
    clearWatchdogs();
    callHandler(originalOnError, event);
  };

  const runSpeak = () => {
    try {
      if (typeof synth.resume === 'function') {
        synth.resume();
      }
    } catch (err) {
      // no-op
    }
    if (Number(window.r34lp0w3r.__webTtsReqSeq || 0) !== myReqSeq) {
      finishWithError('speak-aborted');
      return;
    }
    utter.rate = typeof utter.rate === 'number' ? utter.rate : 1;
    utter.pitch = typeof utter.pitch === 'number' ? utter.pitch : 1;
    utter.volume = typeof utter.volume === 'number' ? utter.volume : 1;

    // Chrome can get stuck with specific voices (e.g. Samantha on macOS).
    // Default behavior: keep lang, but do not force utter.voice in Chrome.
    if (!isChromeTtsBrowser()) {
      selectBestVoice();
    } else {
      try {
        utter.voice = null;
      } catch (err) {
        // no-op
      }
    }
    try {
      synth.speak(utter);
    } catch (err) {
      finishWithError('speak-exception');
      return;
    }
    const startTimeoutMs = 2400;
    const pendingTimeoutMs = 3400;
    startWatchdog = setTimeout(() => {
      if (finished || started) return;
      const speaking = Boolean(synth.speaking);
      const pending = Boolean(synth.pending);
      if (speaking) {
        if (retrySpeakAfterCancel()) return;
        finishWithError('speak-start-timeout');
        return;
      }
      if (
        !retriedForVoices &&
        typeof synth.getVoices === 'function' &&
        Array.isArray(synth.getVoices()) &&
        synth.getVoices().length === 0
      ) {
        retriedForVoices = true;
        waitForWebTtsVoices(1800).then(() => {
          if (finished || started) return;
          if (Number(window.r34lp0w3r.__webTtsReqSeq || 0) !== myReqSeq) {
            finishWithError('speak-aborted');
            return;
          }
          try {
            if (typeof synth.cancel === 'function') {
              synth.cancel();
            }
          } catch (err) {
            // no-op
          }
          runSpeak();
        });
        return;
      }
      if (pending) {
        pendingWatchdog = setTimeout(() => {
          if (finished || started) return;
          if (synth.speaking) {
            if (retrySpeakAfterCancel()) return;
            finishWithError('speak-pending-timeout');
            return;
          }
          try {
            if (typeof synth.cancel === 'function') {
              synth.cancel();
            }
          } catch (err) {
            // no-op
          }
          finishWithError('speak-pending-timeout');
        }, pendingTimeoutMs);
        return;
      }
      finishWithError('speak-start-timeout');
    }, startTimeoutMs);
  };

  if (delayMs > 0) {
    setTimeout(runSpeak, delayMs);
  } else {
    runSpeak();
  }
  return true;
};

window.r34lp0w3r.speakFeedback = window.r34lp0w3r.speakFeedback || {
  toneScale: [
    { min: 80, tone: 'good' },
    { min: 60, tone: 'okay' },
    { min: 0, tone: 'bad' }
  ],
  labelScaleByLocale: {
    en: [
      { min: 85, label: 'You sound like a native' },
      { min: 70, label: 'Good! Continue practicing' },
      { min: 60, label: 'Almost Correct!' },
      { min: 0, label: 'Keep practicing' }
    ],
    es: [
      { min: 85, label: 'Suena como un nativo' },
      { min: 70, label: 'Bien. Sigue practicando' },
      { min: 60, label: 'Casi correcto' },
      { min: 0, label: 'Sigue practicando' }
    ]
  },
  labelScale: [
    { min: 85, label: 'You sound like a native' },
    { min: 70, label: 'Good! Continue practicing' },
    { min: 60, label: 'Almost Correct!' },
    { min: 0, label: 'Keep practicing' }
  ]
};

window.r34lp0w3r.speakSummaryTitles = window.r34lp0w3r.speakSummaryTitles || {
  en: {
    good: ['Great! You learned {{session}}', 'Excellent! You completed {{session}}'],
    okay: ['Good work! Keep practicing {{session}}', 'You are doing well! Review {{session}}'],
    bad: ['No worries, keep practicing {{session}}', 'Keep trying with {{session}}']
  },
  es: {
    good: ['Muy bien! aprendiste {{session}}', 'Excelente! completaste {{session}}'],
    okay: ['Buen trabajo! sigue practicando {{session}}', 'Vas bien! repasa {{session}}'],
    bad: ['No pasa nada, practica {{session}}', 'Sigue intentandolo con {{session}}']
  }
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
    hasMeaningfulWordScores(words) ||
    hasMeaningfulPhraseScores(phrases) ||
    hasMeaningfulRewards(rewards) ||
    hasMeaningfulBadges(badges);
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

const SPEAK_BADGE_IMAGE_FALLBACK = 'assets/badges/badge1.png';
const BADGE_POPUP_AUDIO_SRC = 'assets/sounds/congrats.wav';
const BADGE_CONFETTI_COLORS = ['#60a5fa', '#34d399', '#f472b6', '#f59e0b', '#818cf8', '#22d3ee'];
let badgePopupChimeCtx = null;
let badgePopupChimeLastAt = 0;
let badgePopupAudioEl = null;

const escapeBadgeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');

const resolveBadgeEntry = (badgeOrId) => {
  if (!badgeOrId) return null;
  const badges =
    window.r34lp0w3r && window.r34lp0w3r.speakBadges && typeof window.r34lp0w3r.speakBadges === 'object'
      ? window.r34lp0w3r.speakBadges
      : {};
  if (typeof badgeOrId === 'string') {
    const key = badgeOrId.trim();
    if (!key) return null;
    const entry = badges[key];
    if (!entry || typeof entry !== 'object') return null;
    return { id: key, ...entry };
  }
  if (badgeOrId && typeof badgeOrId === 'object') {
    const id = badgeOrId.id || badgeOrId.badgeId || badgeOrId.key || '';
    return { id, ...badgeOrId };
  }
  return null;
};

const buildBadgeConfettiHtml = () => {
  const pieces = [];
  const total = 18;
  for (let idx = 0; idx < total; idx += 1) {
    const angleDeg = (360 / total) * idx - 90 + (Math.random() * 26 - 13);
    const angleRad = (angleDeg * Math.PI) / 180;
    const distance = 90 + Math.random() * 110;
    const dx = Math.cos(angleRad) * distance;
    const dy = Math.sin(angleRad) * distance;
    const delay = Math.round(Math.random() * 120);
    const duration = 680 + Math.round(Math.random() * 300);
    const rotate = -170 + Math.round(Math.random() * 340);
    const size = 8 + Math.round(Math.random() * 5);
    const color = BADGE_CONFETTI_COLORS[idx % BADGE_CONFETTI_COLORS.length];
    pieces.push(
      `<span class="speak-badge-confetti-piece" style="--dx:${dx.toFixed(1)}px;--dy:${dy.toFixed(
        1
      )}px;--delay:${delay}ms;--dur:${duration}ms;--rot:${rotate}deg;--size:${size}px;--color:${color};"></span>`
    );
  }
  return pieces.join('');
};

const playBadgePopupChimeWeb = () => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const nowMs = Date.now();
    if (nowMs - badgePopupChimeLastAt < 160) return;
    badgePopupChimeLastAt = nowMs;

    const ctx = badgePopupChimeCtx || (badgePopupChimeCtx = new Ctx());
    const render = () => {
      const now = ctx.currentTime + 0.006;
      const master = ctx.createGain();
      master.connect(ctx.destination);
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.82);

      const playTone = (freq, offset, dur, gain = 1) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + offset);
        g.gain.setValueAtTime(0.0001, now + offset);
        g.gain.exponentialRampToValueAtTime(Math.max(0.001, 0.48 * gain), now + offset + 0.018);
        g.gain.exponentialRampToValueAtTime(0.0001, now + offset + dur);
        osc.connect(g);
        g.connect(master);
        osc.start(now + offset);
        osc.stop(now + offset + dur + 0.02);
      };

      // Mini fanfarria en 3 notas (C6-E6-G6) + remate agudo.
      playTone(1046.5, 0.0, 0.22, 0.92);  // C6
      playTone(1318.5, 0.09, 0.24, 0.95); // E6
      playTone(1568.0, 0.19, 0.32, 1.0);  // G6
      playTone(2093.0, 0.39, 0.22, 0.72); // C7

      // Sparkle brillante muy corto para reforzar el efecto "badge unlock".
      const sparkle = ctx.createOscillator();
      const sparkleGain = ctx.createGain();
      sparkle.type = 'sine';
      sparkle.frequency.setValueAtTime(2800, now + 0.14);
      sparkle.frequency.exponentialRampToValueAtTime(3800, now + 0.28);
      sparkleGain.gain.setValueAtTime(0.0001, now + 0.14);
      sparkleGain.gain.exponentialRampToValueAtTime(0.11, now + 0.165);
      sparkleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      sparkle.connect(sparkleGain);
      sparkleGain.connect(master);
      sparkle.start(now + 0.14);
      sparkle.stop(now + 0.44);
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(render).catch(() => {});
      return;
    }
    render();
  } catch (_err) {
    // no-op
  }
};

const playBadgePopupAudioFile = async () => {
  try {
    const nowMs = Date.now();
    if (nowMs - badgePopupChimeLastAt < 160) return true;
    badgePopupChimeLastAt = nowMs;

    if (!badgePopupAudioEl) {
      const audio = new Audio(BADGE_POPUP_AUDIO_SRC);
      audio.preload = 'auto';
      audio.playsInline = true;
      badgePopupAudioEl = audio;
    }

    const audio = badgePopupAudioEl;
    if (!audio) return false;

    try {
      audio.pause();
    } catch (_err) {
      // no-op
    }
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === 'function') {
      await playPromise;
    }
    return true;
  } catch (_err) {
    return false;
  }
};

const playBadgePopupChime = () => {
  playBadgePopupAudioFile().then((played) => {
    if (played) return;
    try {
      const plugin = window.Capacitor?.Plugins?.P4w4Plugin;
      if (plugin && typeof plugin.playNotificationBell === 'function') {
        plugin
          .playNotificationBell({ durationMs: 320, vibrate: false })
          .then((result) => {
            if (result && result.started === false) {
              playBadgePopupChimeWeb();
            }
          })
          .catch(() => {
            playBadgePopupChimeWeb();
          });
        return;
      }
    } catch (_err) {
      // no-op
    }
    playBadgePopupChimeWeb();
  });
};

window.openSpeakBadgePopup = async (badgeOrId) => {
  const badge = resolveBadgeEntry(badgeOrId);
  if (!badge) return false;
  const image = String(badge.image || '').trim() || SPEAK_BADGE_IMAGE_FALLBACK;
  const routeTitle = String(badge.routeTitle || '').trim();
  const title = routeTitle || String(badge.title || badge.label || '').trim() || 'Ruta completada';
  const subtitle = String(badge.subtitle || '').trim();

  const closeExisting = () => {
    const current = document.querySelector('.speak-badge-overlay');
    if (!current) return;
    const onKey = current.__onKeyDown;
    if (typeof onKey === 'function') {
      document.removeEventListener('keydown', onKey);
    }
    current.remove();
  };

  closeExisting();

  const confettiHtml = buildBadgeConfettiHtml();
  const overlay = document.createElement('div');
  overlay.className = 'speak-badge-overlay';
  overlay.innerHTML = `
    <div class="speak-badge-overlay-backdrop" data-close="1"></div>
    <div class="speak-badge-overlay-confetti" aria-hidden="true">${confettiHtml}</div>
    <div class="speak-badge-overlay-card" role="dialog" aria-modal="true" aria-label="${escapeBadgeHtml(title)}">
      <button class="speak-badge-overlay-close" type="button" aria-label="Cerrar" data-close="1">&times;</button>
      <div class="speak-badge-overlay-media">
        <div class="speak-badge-overlay-halo" aria-hidden="true"></div>
        <img class="speak-badge-overlay-image" src="${escapeBadgeHtml(image)}" alt="${escapeBadgeHtml(title)}">
      </div>
      <div class="speak-badge-overlay-title">${escapeBadgeHtml(title)}</div>
      ${subtitle ? `<div class="speak-badge-overlay-subtitle">${escapeBadgeHtml(subtitle)}</div>` : ''}
    </div>
  `;
  const removeOverlay = () => {
    const onKey = overlay.__onKeyDown;
    if (typeof onKey === 'function') {
      document.removeEventListener('keydown', onKey);
    }
    overlay.classList.remove('is-visible');
    setTimeout(() => {
      if (overlay.isConnected) overlay.remove();
    }, 220);
  };
  overlay.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('[data-close="1"]')) {
      removeOverlay();
    }
  });
  overlay.__onKeyDown = (event) => {
    if (event.key === 'Escape') {
      removeOverlay();
    }
  };
  document.addEventListener('keydown', overlay.__onKeyDown);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    overlay.classList.add('is-visible');
    setTimeout(() => {
      playBadgePopupChime();
    }, 36);
  });
  if (!window.closeSpeakBadgePopup || typeof window.closeSpeakBadgePopup !== 'function') {
    window.closeSpeakBadgePopup = () => {
      closeExisting();
    };
  }
  return true;
};

window.openSpeakBadgeFromNotification = (action = {}) => {
  const payload = action && typeof action === 'object' ? action : {};
  const badgeId = String(
    payload.badgeId || payload.badge_id || payload.id || payload.badge || ''
  ).trim();
  if (!badgeId) return;
  window.openSpeakBadgePopup(badgeId).catch(() => {});
};

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

function hasMeaningfulWordScores(words) {
  if (!words || typeof words !== 'object') return false;
  return Object.values(words).some((session) => {
    if (!session || typeof session !== 'object') return false;
    return Object.values(session).some((entry) => entry && typeof entry.percent === 'number');
  });
}

function hasMeaningfulPhraseScores(phrases) {
  if (!phrases || typeof phrases !== 'object') return false;
  return Object.values(phrases).some((entry) => entry && typeof entry.percent === 'number');
}

function hasMeaningfulRewards(rewards) {
  if (!rewards || typeof rewards !== 'object') return false;
  return Object.values(rewards).some((entry) => entry && typeof entry.rewardQty === 'number');
}

function hasMeaningfulBadges(badges) {
  if (!badges || typeof badges !== 'object') return false;
  return Object.values(badges).some(
    (entry) => entry && typeof entry === 'object' && Object.keys(entry).length
  );
}

function isSpeakSnapshotMeaningful(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const words = snapshot.word_scores || {};
  const phrases = snapshot.phrase_scores || {};
  const rewards = snapshot.session_rewards || {};
  const badges = snapshot.badges || {};
  return (
    hasMeaningfulWordScores(words) ||
    hasMeaningfulPhraseScores(phrases) ||
    hasMeaningfulRewards(rewards) ||
    hasMeaningfulBadges(badges)
  );
}

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
    !hasMeaningfulWordScores(words) &&
    !hasMeaningfulPhraseScores(phrases) &&
    !hasMeaningfulRewards(rewards) &&
    !hasMeaningfulBadges(badges)
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
  const hasSnapshotData = !isSpeakSnapshotEmpty();
  let includeSnapshot =
    forceIncludeSnapshot ||
    opts.includeSnapshot === true ||
    (opts.includeSnapshotOnOwnerChange && ownerChanged) ||
    (opts.includeSnapshotIfEmpty && !hasSnapshotData);
  if (opts.force && hasSnapshotData) {
    includeSnapshot = true;
  }

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
