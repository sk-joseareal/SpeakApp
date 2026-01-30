const initState = {
  platform: 'browser',
  uuid: null,
  voicesUS: [],
  voicesGB: []
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
