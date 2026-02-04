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

window.persistSpeakStores = () => {
  writeSpeakStore(SPEAK_WORDS_KEY, window.r34lp0w3r.speakWordScores || {});
  writeSpeakStore(SPEAK_PHRASE_KEY, window.r34lp0w3r.speakPhraseScores || {});
  writeSpeakStore(SPEAK_REWARDS_KEY, window.r34lp0w3r.speakSessionRewards || {});
};

window.notifySpeakStoresChange = () => {
  window.dispatchEvent(new CustomEvent('app:speak-stores-change'));
};

window.resetSpeakStores = () => {
  window.r34lp0w3r.speakWordScores = {};
  window.r34lp0w3r.speakPhraseScores = {};
  window.r34lp0w3r.speakSessionRewards = {};
  window.persistSpeakStores();
  window.notifySpeakStoresChange();
};

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
