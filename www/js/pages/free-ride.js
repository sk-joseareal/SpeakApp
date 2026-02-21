import { getAppLocale } from '../state.js';
import {
  getFreeRideCopy,
  getLocaleMeta,
  getNextLocaleCode,
  normalizeLocale as normalizeCopyLocale
} from '../content/copy.js';

const FREE_RIDE_LOCALE_OVERRIDE_KEY = 'appv5:free-ride-locale-override';
const FREE_RIDE_TEXT_PREFIX = 'appv5:free-ride:text:';
const RECORDING_TIMESLICE = 500;
const VOSK_SAMPLE_RATE_DEFAULT = 16000;
const TTS_LANG_BY_LOCALE = {
  es: 'es-ES',
  en: 'en-US'
};
const HERO_MASCOT_FRAME_COUNT = 9;
const HERO_MASCOT_REST_FRAME = HERO_MASCOT_FRAME_COUNT - 1;
const HERO_MASCOT_FRAME_INTERVAL_MS = 150;
const FREE_RIDE_DEBUG_PANEL_OPEN_KEY = 'appv5:free-ride-debug-panel-open';
const SPEAK_REWARDS_STORAGE_KEY = 'appv5:speak-session-rewards';
const FREE_RIDE_REWARD_SESSION_PREFIX = 'free-ride';
const DEFAULT_SUMMARY_REWARD = { icon: 'diamond', label: 'diamonds', min: 1, max: 1 };

const DEFAULT_TONE_SCALE = [
  { min: 80, tone: 'good' },
  { min: 60, tone: 'okay' },
  { min: 0, tone: 'bad' }
];

class PageFreeRide extends HTMLElement {
  constructor() {
    super();
    this.state = {
      localeOverride: this.readLocaleOverride(),
      expectedText: '',
      transcript: '',
      percent: null,
      recentReward: null,
      recordingUrl: '',
      isRecording: false,
      isTranscribing: false
    };

    this.currentUiLocale = 'en';
    this.currentCopy = getFreeRideCopy('en');
    this.mediaRecorder = null;
    this.recordingStream = null;
    this.recordedChunks = [];
    this.speechRecognizer = null;
    this.speechTranscript = '';
    this.speechInterim = '';
    this.speechFailed = false;
    this.nativeSpeechActive = false;
    this.nativeSpeechListeners = [];
    this.activeAudio = null;
    this.activePlayButton = null;
    this.narrationToken = 0;
    this.narrationTimer = null;
    this.initialHeroNarrationStarted = this.hasAutoHeroNarrationPlayed();
    this.heroMascotFrameIndex = HERO_MASCOT_REST_FRAME;
    this.heroMascotFrameTimer = null;
    this.heroMascotIsTalking = false;
    this.debugPanelOpen = this.readPersistedDebugPanelOpen();
    this.layoutSyncTimer = null;
    this.layoutSyncRaf = null;
    this.layoutSyncVersion = 0;
    this.keyboardResizePrevMode = '';
    this.keyboardResizeApplied = false;
    this.keyboardResizeRequestId = 0;
  }

  connectedCallback() {
    this.classList.add('ion-page');
    this.refreshPhraseForCurrentLocale();
    this.render();

    this._localeHandler = () => {
      if (!this.isConnected) return;
      if (this.normalizeLocale(this.state.localeOverride)) return;
      this.stopActiveCapture();
      this.stopPlayback();
      this.refreshPhraseForCurrentLocale();
      this.clearPracticeResult({
        skipRender: false,
        clearRecording: true,
        forceNarration: this.isTabActive('freeride')
      });
    };
    window.addEventListener('app:locale-change', this._localeHandler);

    this._userHandler = (event) => {
      this.updateHeaderUser(event && event.detail ? event.detail : null);
    };
    window.addEventListener('app:user-change', this._userHandler);

    this._rewardsHandler = () => {
      this.updateHeaderRewards();
    };
    window.addEventListener('app:speak-stores-change', this._rewardsHandler);

    this._debugHandler = () => {
      if (!this.isConnected) return;
      this.render();
    };
    window.addEventListener('app:speak-debug', this._debugHandler);

    this._tabsDidChangeHandler = (event) => {
      const tab = event && event.detail ? event.detail.tab : '';
      if (tab !== 'freeride') {
        this.classList.remove('free-ride-keyboard-open');
        this.restoreIOSKeyboardResizeMode();
        return;
      }
      this.applyIOSKeyboardOverlayMode();
      const delayMs = this.isNativeRuntime() ? 160 : 80;
      this.scheduleLayoutSync(0);
      this.scheduleLayoutSync(delayMs + 140);
      this.scheduleHeroNarration(delayMs, false);
    };
    this._tabsEl = this.getTabsEl();
    this._tabsEl?.addEventListener('ionTabsDidChange', this._tabsDidChangeHandler);

    this._layoutViewportHandler = () => {
      if (!this.isConnected) return;
      this.scheduleLayoutSync(0);
    };
    window.addEventListener('resize', this._layoutViewportHandler);
    if (window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
      window.visualViewport.addEventListener('resize', this._layoutViewportHandler);
      window.visualViewport.addEventListener('scroll', this._layoutViewportHandler);
    }

    if (this.isTabActive('freeride')) {
      this.applyIOSKeyboardOverlayMode();
      const initialDelayMs = this.isNativeRuntime() ? 280 : 820;
      this.scheduleLayoutSync(0);
      this.scheduleLayoutSync(140);
      this.scheduleHeroNarration(initialDelayMs, false);
    }

    this.updateHeaderUser(window.user || null);
    this.updateHeaderRewards();
  }

  disconnectedCallback() {
    this.stopActiveCapture();
    this.stopPlayback();
    this.stopHeroMascotTalk({ settle: true });
    this.clearNarrationTimer();
    this.stopNarration().catch(() => {});
    this.clearRecordingUrl();

    if (this._localeHandler) {
      window.removeEventListener('app:locale-change', this._localeHandler);
      this._localeHandler = null;
    }

    if (this._userHandler) {
      window.removeEventListener('app:user-change', this._userHandler);
      this._userHandler = null;
    }

    if (this._rewardsHandler) {
      window.removeEventListener('app:speak-stores-change', this._rewardsHandler);
      this._rewardsHandler = null;
    }

    if (this._debugHandler) {
      window.removeEventListener('app:speak-debug', this._debugHandler);
      this._debugHandler = null;
    }

    if (this._tabsDidChangeHandler) {
      if (this._tabsEl) {
        this._tabsEl.removeEventListener('ionTabsDidChange', this._tabsDidChangeHandler);
      }
      this._tabsEl = null;
      this._tabsDidChangeHandler = null;
    }

    if (this._layoutViewportHandler) {
      window.removeEventListener('resize', this._layoutViewportHandler);
      if (window.visualViewport && typeof window.visualViewport.removeEventListener === 'function') {
        window.visualViewport.removeEventListener('resize', this._layoutViewportHandler);
        window.visualViewport.removeEventListener('scroll', this._layoutViewportHandler);
      }
      this._layoutViewportHandler = null;
    }

    this.restoreIOSKeyboardResizeMode();
    this.classList.remove('free-ride-keyboard-open');
    this.clearLayoutSync();
  }

  normalizeLocale(locale) {
    return normalizeCopyLocale(locale);
  }

  getBaseLocale() {
    const fromState = getAppLocale() || (window.varGlobal && window.varGlobal.locale) || 'en';
    return this.normalizeLocale(fromState) || 'en';
  }

  getUiLocale(baseLocale = this.getBaseLocale()) {
    const override = this.normalizeLocale(this.state.localeOverride);
    return override || this.normalizeLocale(baseLocale) || 'en';
  }

  getFlagSpeechLocale(locale = this.getUiLocale()) {
    const normalized = this.normalizeLocale(locale) || 'en';
    const mapped = TTS_LANG_BY_LOCALE[normalized];
    if (mapped) return mapped;
    const meta = getLocaleMeta(normalized);
    if (meta && meta.ttsLang) return meta.ttsLang;
    return normalized === 'es' ? 'es-ES' : 'en-US';
  }

  getPracticeSpeechLocale() {
    return 'en-US';
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

  isNativeIOS() {
    if (!this.isNativeRuntime()) return false;
    const capacitor = window.Capacitor;
    if (!capacitor) return false;
    if (typeof capacitor.getPlatform === 'function') {
      return capacitor.getPlatform() === 'ios';
    }
    return capacitor.platform === 'ios';
  }

  getKeyboardPlugin() {
    if (typeof window === 'undefined') return null;
    const plugins =
      window && window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins : null;
    if (!plugins) return null;
    return plugins.Keyboard || null;
  }

  async applyIOSKeyboardOverlayMode() {
    if (!this.isNativeIOS()) return;
    const plugin = this.getKeyboardPlugin();
    if (!plugin || typeof plugin.setResizeMode !== 'function') return;

    const requestId = (this.keyboardResizeRequestId += 1);
    try {
      if (!this.keyboardResizeApplied) {
        let currentMode = '';
        if (typeof plugin.getResizeMode === 'function') {
          const modeResult = await plugin.getResizeMode();
          currentMode =
            modeResult && typeof modeResult.mode === 'string'
              ? String(modeResult.mode).toLowerCase()
              : '';
        }
        if (requestId !== this.keyboardResizeRequestId) return;
        this.keyboardResizePrevMode = currentMode || 'native';
      }
      await plugin.setResizeMode({ mode: 'none' });
      if (requestId !== this.keyboardResizeRequestId) return;
      this.keyboardResizeApplied = true;
    } catch (err) {
      // no-op
    }
  }

  async restoreIOSKeyboardResizeMode() {
    if (!this.isNativeIOS()) return;
    const plugin = this.getKeyboardPlugin();
    if (!plugin || typeof plugin.setResizeMode !== 'function') return;
    if (!this.keyboardResizeApplied && !this.keyboardResizePrevMode) return;

    const requestId = (this.keyboardResizeRequestId += 1);
    const mode = this.keyboardResizePrevMode || 'native';
    try {
      await plugin.setResizeMode({ mode });
      if (requestId !== this.keyboardResizeRequestId) return;
    } catch (err) {
      // no-op
    } finally {
      if (requestId === this.keyboardResizeRequestId) {
        this.keyboardResizeApplied = false;
        this.keyboardResizePrevMode = '';
      }
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

  getTabsEl() {
    return this.closest('ion-tabs') || document.querySelector('tabs-page ion-tabs');
  }

  isTabActive(tabName = 'freeride') {
    const tabHost = this.closest('ion-tab');
    if (tabHost) {
      const hostTab = String(tabHost.getAttribute('tab') || '');
      if (tabName && hostTab && hostTab !== tabName) return false;
      if (tabHost.getAttribute('aria-hidden') === 'true') return false;
      if (tabHost.classList.contains('tab-hidden')) return false;
      const styles = window.getComputedStyle ? window.getComputedStyle(tabHost) : null;
      if (styles && styles.display === 'none') return false;
    }
    const tabsEl = this.getTabsEl();
    if (tabsEl && tabName) {
      const selectedFromAttr = String(tabsEl.getAttribute('selected-tab') || '');
      const selectedFromProp =
        typeof tabsEl.selectedTab === 'string' ? String(tabsEl.selectedTab) : '';
      const selected = selectedFromAttr || selectedFromProp;
      if (selected && selected !== tabName) return false;
    }
    return true;
  }

  getContentEl() {
    return this.querySelector('ion-content.free-ride-content');
  }

  getShellEl() {
    return this.querySelector('.free-ride-shell');
  }

  clearLayoutSync() {
    if (this.layoutSyncTimer) {
      clearTimeout(this.layoutSyncTimer);
      this.layoutSyncTimer = null;
    }
    if (this.layoutSyncRaf) {
      cancelAnimationFrame(this.layoutSyncRaf);
      this.layoutSyncRaf = null;
    }
    this.layoutSyncVersion += 1;
  }

  scheduleLayoutSync(delayMs = 0) {
    if (!this.isConnected) return;
    if (this.layoutSyncTimer) {
      clearTimeout(this.layoutSyncTimer);
      this.layoutSyncTimer = null;
    }

    const runSync = () => {
      if (!this.isConnected) return;
      if (this.layoutSyncRaf) {
        cancelAnimationFrame(this.layoutSyncRaf);
      }
      this.layoutSyncRaf = requestAnimationFrame(() => {
        this.layoutSyncRaf = null;
        this.syncLayoutToViewport().catch(() => {});
      });
    };

    if (delayMs > 0) {
      this.layoutSyncTimer = setTimeout(() => {
        this.layoutSyncTimer = null;
        runSync();
      }, delayMs);
      return;
    }

    runSync();
  }

  async syncLayoutToViewport() {
    if (!this.isConnected) return;
    const shellEl = this.getShellEl();
    if (!shellEl) return;
    if (!this.isTabActive('freeride')) return;

    const callVersion = this.layoutSyncVersion;
    if (!this.isConnected || callVersion !== this.layoutSyncVersion || !shellEl.isConnected) return;

    const shellRect = shellEl.getBoundingClientRect();
    const viewport = window.visualViewport;
    const layoutViewportBottom =
      window.innerHeight || document.documentElement.clientHeight || 0;
    const visualViewportBottom = viewport
      ? viewport.height + viewport.offsetTop
      : layoutViewportBottom;

    const tabBarEl = document.querySelector('tabs-page ion-tab-bar');
    const tabBarTop = tabBarEl ? tabBarEl.getBoundingClientRect().top : layoutViewportBottom;
    const nativeIOS = this.isNativeIOS();
    const bottomLimit = nativeIOS ? tabBarTop : Math.min(visualViewportBottom, tabBarTop);
    const usableHeight = bottomLimit - shellRect.top - 8;

    const keyboardOffset = Math.max(0, layoutViewportBottom - visualViewportBottom);
    const inputEl = this.querySelector('#free-ride-input');
    const inputFocused = Boolean(inputEl && document.activeElement === inputEl);
    const keyboardOpen = nativeIOS && inputFocused && keyboardOffset > 80;
    this.classList.toggle('free-ride-keyboard-open', keyboardOpen);

    if (!Number.isFinite(usableHeight) || usableHeight <= 40) {
      shellEl.style.removeProperty('--free-ride-shell-height');
      return;
    }

    const nextHeight = Math.max(120, Math.floor(usableHeight));
    shellEl.style.setProperty('--free-ride-shell-height', `${nextHeight}px`);
  }

  readLocaleOverride() {
    try {
      return this.normalizeLocale(localStorage.getItem(FREE_RIDE_LOCALE_OVERRIDE_KEY));
    } catch (err) {
      return '';
    }
  }

  persistLocaleOverride(value) {
    const normalized = this.normalizeLocale(value);
    try {
      if (normalized) {
        localStorage.setItem(FREE_RIDE_LOCALE_OVERRIDE_KEY, normalized);
      } else {
        localStorage.removeItem(FREE_RIDE_LOCALE_OVERRIDE_KEY);
      }
    } catch (err) {
      // no-op
    }
  }

  getTextStorageKey(locale = this.getUiLocale()) {
    const normalized = this.normalizeLocale(locale) || 'en';
    return `${FREE_RIDE_TEXT_PREFIX}${normalized}`;
  }

  readStoredPhrase(locale = this.getUiLocale()) {
    try {
      return localStorage.getItem(this.getTextStorageKey(locale)) || '';
    } catch (err) {
      return '';
    }
  }

  persistPhrase(text, locale = this.getUiLocale()) {
    try {
      localStorage.setItem(this.getTextStorageKey(locale), String(text || ''));
    } catch (err) {
      // no-op
    }
  }

  normalizeHeroMascotFrameIndex(frameIndex) {
    const value = Number(frameIndex);
    if (!Number.isFinite(value)) return HERO_MASCOT_REST_FRAME;
    const rounded = Math.round(value);
    return Math.min(Math.max(rounded, 0), HERO_MASCOT_FRAME_COUNT - 1);
  }

  getHeroMascotFramePath(frameIndex = HERO_MASCOT_REST_FRAME) {
    const normalized = this.normalizeHeroMascotFrameIndex(frameIndex);
    const padded = String(normalized).padStart(2, '0');
    return `assets/mascot/mascota-boca-${padded}.png`;
  }

  getHeroMascotImageEl() {
    return this.querySelector('#free-ride-hero-mascot');
  }

  getHeroBubbleEl() {
    return this.querySelector('.free-ride-hero-bubble');
  }

  setHeroBubbleSpeaking(isSpeaking) {
    const bubbleEl = this.getHeroBubbleEl();
    if (!bubbleEl) return;
    bubbleEl.classList.toggle('is-speaking', Boolean(isSpeaking));
  }

  renderHeroMascotFrame(frameIndex) {
    const normalized = this.normalizeHeroMascotFrameIndex(frameIndex);
    this.heroMascotFrameIndex = normalized;
    const imgEl = this.getHeroMascotImageEl();
    if (!imgEl) return;
    const nextSrc = this.getHeroMascotFramePath(normalized);
    if (imgEl.getAttribute('src') !== nextSrc) {
      imgEl.setAttribute('src', nextSrc);
    }
  }

  startHeroMascotTalk() {
    if (this.heroMascotIsTalking) return;
    this.heroMascotIsTalking = true;
    this.setHeroBubbleSpeaking(true);
    if (this.heroMascotFrameTimer) {
      clearInterval(this.heroMascotFrameTimer);
      this.heroMascotFrameTimer = null;
    }
    let frame = 0;
    this.renderHeroMascotFrame(frame);
    this.heroMascotFrameTimer = setInterval(() => {
      if (!this.heroMascotIsTalking) return;
      frame = (frame + 1) % (HERO_MASCOT_FRAME_COUNT - 1);
      this.renderHeroMascotFrame(frame);
    }, HERO_MASCOT_FRAME_INTERVAL_MS);
  }

  stopHeroMascotTalk(options = {}) {
    const settle = options.settle !== false;
    this.heroMascotIsTalking = false;
    this.setHeroBubbleSpeaking(false);
    if (this.heroMascotFrameTimer) {
      clearInterval(this.heroMascotFrameTimer);
      this.heroMascotFrameTimer = null;
    }
    if (settle) {
      this.renderHeroMascotFrame(HERO_MASCOT_REST_FRAME);
    }
  }

  isSpeakDebugEnabled() {
    if (window.r34lp0w3r && typeof window.r34lp0w3r.speakDebug === 'boolean') {
      return window.r34lp0w3r.speakDebug;
    }
    try {
      return localStorage.getItem('appv5:speak-debug') === '1';
    } catch (err) {
      return false;
    }
  }

  readPersistedDebugPanelOpen() {
    try {
      return localStorage.getItem(FREE_RIDE_DEBUG_PANEL_OPEN_KEY) === '1';
    } catch (err) {
      return false;
    }
  }

  persistDebugPanelOpen(value) {
    try {
      localStorage.setItem(FREE_RIDE_DEBUG_PANEL_OPEN_KEY, value ? '1' : '0');
    } catch (err) {
      // no-op
    }
  }

  refreshPhraseForCurrentLocale() {
    const locale = this.getUiLocale();
    this.currentUiLocale = locale;
    this.currentCopy = getFreeRideCopy(locale);
    this.state.expectedText = this.readStoredPhrase(locale);
  }

  getExpectedText() {
    return String(this.state.expectedText || '');
  }

  getExpectedTextTrimmed() {
    return this.getExpectedText().trim();
  }

  hasExpectedText() {
    return Boolean(this.getExpectedTextTrimmed());
  }

  escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  getToneScale() {
    const config = window.r34lp0w3r && window.r34lp0w3r.speakFeedback;
    const scale = config && Array.isArray(config.toneScale) ? config.toneScale : DEFAULT_TONE_SCALE;
    const list = (scale || []).filter(
      (item) => item && typeof item.min === 'number' && typeof item.tone === 'string' && item.tone
    );
    if (!list.length) return DEFAULT_TONE_SCALE.slice();
    return list.slice().sort((a, b) => b.min - a.min);
  }

  getToneMaxValues() {
    const scale = this.getToneScale();
    if (!scale.length) {
      return { good: 100, okay: 79, bad: 59 };
    }
    const maxByTone = {};
    scale.forEach((entry, idx) => {
      const prev = scale[idx - 1];
      let max = idx === 0 ? 100 : prev.min - 1;
      if (!Number.isFinite(max)) max = entry.min;
      max = Math.max(entry.min, max);
      maxByTone[entry.tone] = Math.max(0, Math.min(100, Math.round(max)));
    });
    if (maxByTone.good === undefined) maxByTone.good = 100;
    if (maxByTone.okay === undefined) maxByTone.okay = Math.max(0, maxByTone.good - 1);
    if (maxByTone.bad === undefined) maxByTone.bad = Math.max(0, maxByTone.okay - 1);
    return maxByTone;
  }

  getScoreTone(percent) {
    const value = typeof percent === 'number' ? percent : 0;
    const scale = this.getToneScale();
    const match = scale.find((item) => value >= item.min);
    return match && match.tone ? match.tone : 'bad';
  }

  getSpeakRewardsStore() {
    if (!window.r34lp0w3r || typeof window.r34lp0w3r !== 'object') {
      window.r34lp0w3r = {};
    }
    if (
      !window.r34lp0w3r.speakSessionRewards ||
      typeof window.r34lp0w3r.speakSessionRewards !== 'object'
    ) {
      window.r34lp0w3r.speakSessionRewards = {};
    }
    return window.r34lp0w3r.speakSessionRewards;
  }

  persistSpeakRewardsStore() {
    if (typeof window.persistSpeakStores === 'function') {
      window.persistSpeakStores();
      return;
    }
    try {
      localStorage.setItem(
        SPEAK_REWARDS_STORAGE_KEY,
        JSON.stringify(this.getSpeakRewardsStore())
      );
    } catch (err) {
      // no-op
    }
  }

  notifySpeakRewardsChange() {
    if (typeof window.notifySpeakStoresChange === 'function') {
      window.notifySpeakStoresChange();
      return;
    }
    window.dispatchEvent(new CustomEvent('app:speak-stores-change'));
  }

  pickRandom(items) {
    if (!Array.isArray(items) || !items.length) return null;
    const idx = Math.floor(Math.random() * items.length);
    return items[idx];
  }

  getRandomInt(min, max) {
    const low = Math.ceil(min);
    const high = Math.floor(max);
    if (!Number.isFinite(low) || !Number.isFinite(high)) return 1;
    if (high <= low) return low;
    return Math.floor(Math.random() * (high - low + 1)) + low;
  }

  buildRandomReward() {
    const config = window.speakSummaryConfig || {};
    const rewards = Array.isArray(config.rewards) ? config.rewards : [];
    const reward = this.pickRandom(rewards) || DEFAULT_SUMMARY_REWARD;

    const rewardMinRaw = Number(reward && reward.min);
    const rewardMaxRaw = Number(reward && reward.max);
    const rewardMin = Number.isFinite(rewardMinRaw) ? rewardMinRaw : 1;
    const rewardMax = Number.isFinite(rewardMaxRaw) ? rewardMaxRaw : rewardMin;
    const qty = this.getRandomInt(Math.min(rewardMin, rewardMax), Math.max(rewardMin, rewardMax));
    const rewardQty = Math.max(1, Math.round(Number.isFinite(qty) ? qty : 1));
    const rewardLabel =
      reward && typeof reward.label === 'string' && reward.label.trim()
        ? reward.label.trim()
        : DEFAULT_SUMMARY_REWARD.label;
    const rewardIcon =
      reward && typeof reward.icon === 'string' && reward.icon.trim()
        ? reward.icon.trim()
        : DEFAULT_SUMMARY_REWARD.icon;

    return { rewardQty, rewardLabel, rewardIcon };
  }

  awardRewardForGoodResult() {
    const { rewardQty, rewardLabel, rewardIcon } = this.buildRandomReward();
    const icon = rewardIcon || DEFAULT_SUMMARY_REWARD.icon;
    const rewardStore = this.getSpeakRewardsStore();
    const entryId = `${FREE_RIDE_REWARD_SESSION_PREFIX}:${icon}`;
    const now = Date.now();

    const prevEntry = rewardStore[entryId];
    const prevQty =
      prevEntry && typeof prevEntry.rewardQty === 'number' ? Math.max(0, prevEntry.rewardQty) : 0;
    const nextQty = prevQty + rewardQty;

    rewardStore[entryId] = {
      rewardQty: nextQty,
      rewardLabel,
      rewardIcon: icon,
      ts: now
    };

    this.persistSpeakRewardsStore();
    if (typeof window.queueSpeakEvent === 'function') {
      window.queueSpeakEvent({
        type: 'session_reward',
        session_id: entryId,
        rewardQty: nextQty,
        rewardLabel,
        rewardIcon: icon,
        ts: now
      });
    }
    this.notifySpeakRewardsChange();
    return {
      rewardQty,
      rewardLabel,
      rewardIcon: icon
    };
  }

  applyPracticeScore(percent, options = {}) {
    const hasValue = typeof percent === 'number' && Number.isFinite(percent);
    const normalized = hasValue ? Math.max(0, Math.min(100, Math.round(percent))) : null;
    this.state.percent = normalized;
    this.state.recentReward = null;
    if (normalized !== null) {
      const tone = this.getScoreTone(normalized);
      if (tone === 'good') {
        this.state.recentReward = this.awardRewardForGoodResult();
      }
    }
    if (!options.skipRender) {
      this.render();
    }
  }

  applyDebugTone(tone) {
    if (this.state.isRecording || this.state.isTranscribing) return;
    const normalizedTone = String(tone || '').toLowerCase().trim();
    if (normalizedTone === 'reset') {
      this.applyPracticeScore(null);
      return;
    }
    const toneMax = this.getToneMaxValues();
    const byTone = {
      bad: toneMax.bad,
      okay: toneMax.okay,
      good: toneMax.good
    };
    if (!Object.prototype.hasOwnProperty.call(byTone, normalizedTone)) return;
    this.applyPracticeScore(byTone[normalizedTone]);
  }

  getFeedbackLabel(percent, copy) {
    const value = typeof percent === 'number' ? percent : 0;
    if (value >= 85) return copy.feedbackNative || 'You sound like a native';
    if (value >= 70) return copy.feedbackGood || 'Good! Continue practicing';
    if (value >= 60) return copy.feedbackAlmost || 'Almost Correct!';
    return copy.feedbackKeep || 'Keep practicing';
  }

  getFeedbackState(copy = this.currentCopy) {
    if (this.state.isTranscribing) {
      return { tone: 'hint', label: copy.transcribing || 'Transcribing...', hasScore: false };
    }
    if (typeof this.state.percent !== 'number') {
      return { tone: 'hint', label: copy.feedbackHint || 'Practice the phrase', hasScore: false };
    }
    const percent = Math.max(0, Math.min(100, Math.round(this.state.percent)));
    const tone = this.getScoreTone(percent);
    const label = this.getFeedbackLabel(percent, copy);
    return { tone, label, percent, hasScore: true };
  }

  normalizeText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\u00c0-\u024f\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  levenshtein(a, b) {
    const alen = a.length;
    const blen = b.length;
    if (!alen) return blen;
    if (!blen) return alen;
    const matrix = Array.from({ length: alen + 1 }, () => new Array(blen + 1).fill(0));
    for (let i = 0; i <= alen; i += 1) matrix[i][0] = i;
    for (let j = 0; j <= blen; j += 1) matrix[0][j] = j;
    for (let i = 1; i <= alen; i += 1) {
      for (let j = 1; j <= blen; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[alen][blen];
  }

  scoreSimilarity(expected, actual) {
    const normalizedExpected = this.normalizeText(expected);
    const normalizedActual = this.normalizeText(actual);
    if (!normalizedExpected || !normalizedActual) return 0;
    const distance = this.levenshtein(normalizedExpected, normalizedActual);
    const maxLen = Math.max(normalizedExpected.length, normalizedActual.length);
    const ratio = maxLen === 0 ? 1 : 1 - distance / maxLen;
    return Math.max(0, Math.min(100, Math.round(ratio * 100)));
  }

  canRecord() {
    return (
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      typeof MediaRecorder !== 'undefined'
    );
  }

  canSpeak() {
    return (
      typeof window !== 'undefined' &&
      typeof window.speechSynthesis !== 'undefined' &&
      typeof window.SpeechSynthesisUtterance !== 'undefined'
    );
  }

  getSpeechRecognition() {
    return window.SpeechRecognition || window.webkitSpeechRecognition;
  }

  getNativeSpeechPlugin() {
    return window.Capacitor && window.Capacitor.Plugins
      ? window.Capacitor.Plugins.SpeechRecognition
      : null;
  }

  getNativeTranscribePlugin() {
    return window.Capacitor && window.Capacitor.Plugins
      ? window.Capacitor.Plugins.P4w4Plugin
      : null;
  }

  getFilesystemPlugin() {
    return window.Capacitor && window.Capacitor.Plugins
      ? window.Capacitor.Plugins.Filesystem
      : null;
  }

  getVoskSampleRate() {
    const config = window.r34lp0w3r && window.r34lp0w3r.voskSampleRate;
    const rate = Number(config);
    if (Number.isFinite(rate) && rate >= 8000 && rate <= 48000) {
      return Math.round(rate);
    }
    return VOSK_SAMPLE_RATE_DEFAULT;
  }

  getVoskModelPath() {
    const config = window.r34lp0w3r && window.r34lp0w3r.voskModelPath;
    if (typeof config === 'string') {
      const trimmed = config.trim();
      if (trimmed) return trimmed;
    }
    return '';
  }

  isIOSPlatform() {
    const cap = window.Capacitor;
    if (!cap) return false;
    if (typeof cap.getPlatform === 'function') {
      return cap.getPlatform() === 'ios';
    }
    return false;
  }

  isAndroidPlatform() {
    const cap = window.Capacitor;
    if (!cap) return false;
    if (typeof cap.getPlatform === 'function') {
      return cap.getPlatform() === 'android';
    }
    return false;
  }

  isNativeSpeechSupported() {
    const cap = window.Capacitor;
    return Boolean(
      cap &&
        typeof cap.isNativePlatform === 'function' &&
        cap.isNativePlatform() &&
        this.getNativeSpeechPlugin()
    );
  }

  canNativeFileTranscribe() {
    const plugin = this.getNativeTranscribePlugin();
    if (!plugin || typeof plugin.transcribeAudio !== 'function') return false;
    return this.isIOSPlatform() || this.isAndroidPlatform();
  }

  getRecordMimeCandidates() {
    if (this.isIOSPlatform()) {
      return [
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
        'audio/aac',
        'audio/webm;codecs=opus',
        'audio/webm'
      ];
    }
    return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'];
  }

  extractNativeMatches(payload) {
    if (!payload) return [];
    if (Array.isArray(payload.matches)) return payload.matches;
    if (Array.isArray(payload.results)) return payload.results;
    if (Array.isArray(payload.value)) return payload.value;
    if (typeof payload === 'string') return [payload];
    return [];
  }

  handleNativeSpeechResults(payload, isFinal) {
    const matches = this.extractNativeMatches(payload);
    if (!matches.length) return;
    const text = String(matches[0] || '').trim();
    if (!text) return;
    if (isFinal) {
      this.speechTranscript = text;
      this.speechInterim = '';
    } else {
      this.speechInterim = text;
    }
  }

  clearNativeSpeechListeners() {
    this.nativeSpeechListeners.forEach((listener) => {
      try {
        if (listener && typeof listener.remove === 'function') {
          listener.remove();
        }
      } catch (err) {
        // no-op
      }
    });
    this.nativeSpeechListeners = [];
  }

  isSpeechPermissionGranted(status) {
    if (!status) return false;
    if (typeof status === 'boolean') return status;
    if (typeof status.granted === 'boolean') return status.granted;
    if (typeof status.speechRecognition === 'string') return status.speechRecognition === 'granted';
    if (typeof status.speechRecognition === 'boolean') return status.speechRecognition;
    if (typeof status.speech === 'string') return status.speech === 'granted';
    if (typeof status.speech === 'boolean') return status.speech;
    if (typeof status.microphone === 'string') return status.microphone === 'granted';
    if (typeof status.microphone === 'boolean') return status.microphone;
    if (typeof status.audio === 'string') return status.audio === 'granted';
    if (typeof status.audio === 'boolean') return status.audio;
    if (typeof status.permission === 'string') return status.permission === 'granted';
    if (typeof status.state === 'string') return status.state === 'granted';
    const values = Object.values(status);
    if (values.some((value) => value === true)) return true;
    if (values.some((value) => value === 'granted')) return true;
    return false;
  }

  async ensureNativeSpeechPermission(plugin) {
    if (!plugin) return false;
    try {
      if (typeof plugin.checkPermissions === 'function') {
        const status = await plugin.checkPermissions();
        if (this.isSpeechPermissionGranted(status)) return true;
      } else if (typeof plugin.hasPermission === 'function') {
        const status = await plugin.hasPermission();
        if (this.isSpeechPermissionGranted(status)) return true;
      }
    } catch (err) {
      // no-op
    }
    try {
      if (typeof plugin.requestPermissions === 'function') {
        const status = await plugin.requestPermissions();
        return this.isSpeechPermissionGranted(status);
      }
      if (typeof plugin.requestPermission === 'function') {
        const status = await plugin.requestPermission();
        return this.isSpeechPermissionGranted(status);
      }
    } catch (err) {
      // no-op
    }
    return false;
  }

  async startNativeSpeechRecognition() {
    const plugin = this.getNativeSpeechPlugin();
    if (!plugin) return false;
    this.resetSpeechState();
    this.nativeSpeechActive = true;

    const allowed = await this.ensureNativeSpeechPermission(plugin);
    if (!allowed) {
      this.speechFailed = true;
      this.nativeSpeechActive = false;
      return false;
    }

    if (typeof plugin.available === 'function') {
      const availability = await plugin.available();
      if (!availability || availability.available === false) {
        this.speechFailed = true;
        this.nativeSpeechActive = false;
        return false;
      }
    }

    this.clearNativeSpeechListeners();
    if (typeof plugin.addListener === 'function') {
      const add = (event, handler) => {
        try {
          this.nativeSpeechListeners.push(plugin.addListener(event, handler));
        } catch (err) {
          // no-op
        }
      };
      add('partialResults', (data) => this.handleNativeSpeechResults(data, false));
      add('partialResult', (data) => this.handleNativeSpeechResults(data, false));
      add('result', (data) => this.handleNativeSpeechResults(data, true));
      add('results', (data) => this.handleNativeSpeechResults(data, true));
      add('speechResults', (data) => this.handleNativeSpeechResults(data, true));
      add('error', () => {
        this.speechFailed = true;
      });
    }

    if (typeof plugin.start === 'function') {
      await plugin.start({
        language: this.getPracticeSpeechLocale(),
        maxResults: 1,
        partialResults: true,
        popup: false
      });
    }
    return true;
  }

  async stopNativeSpeechRecognition() {
    const plugin = this.getNativeSpeechPlugin();
    if (!plugin || !this.nativeSpeechActive) return;
    try {
      if (typeof plugin.stop === 'function') {
        const result = await plugin.stop();
        this.handleNativeSpeechResults(result, true);
      }
    } catch (err) {
      this.speechFailed = true;
    }
    this.clearNativeSpeechListeners();
    this.nativeSpeechActive = false;
  }

  startSpeechRecognition() {
    if (this.canNativeFileTranscribe()) {
      return false;
    }

    if (this.isNativeSpeechSupported()) {
      this.startNativeSpeechRecognition().catch(() => {
        this.speechFailed = true;
        this.nativeSpeechActive = false;
      });
      return true;
    }

    const SpeechRecognition = this.getSpeechRecognition();
    if (!SpeechRecognition) return false;
    this.resetSpeechState();
    const recognition = new SpeechRecognition();
    this.speechRecognizer = recognition;
    recognition.lang = this.getPracticeSpeechLocale();
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result && result[0] && result[0].transcript ? result[0].transcript : '';
        if (result.isFinal) {
          finalText += text;
        } else {
          interimText += text;
        }
      }
      this.speechTranscript = finalText.trim();
      this.speechInterim = interimText.trim();
    };
    recognition.onerror = () => {
      this.speechFailed = true;
    };
    recognition.onend = () => {
      this.speechRecognizer = null;
    };
    try {
      recognition.start();
      return true;
    } catch (err) {
      this.speechFailed = true;
      this.speechRecognizer = null;
      return false;
    }
  }

  stopSpeechRecognition() {
    if (this.nativeSpeechActive) {
      this.stopNativeSpeechRecognition().catch(() => {
        // no-op
      });
      return;
    }
    if (!this.speechRecognizer) return;
    try {
      this.speechRecognizer.stop();
    } catch (err) {
      // no-op
    }
  }

  resetSpeechState() {
    this.speechTranscript = '';
    this.speechInterim = '';
    this.speechFailed = false;
  }

  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result !== 'string') {
          reject(new Error('reader result not string'));
          return;
        }
        const base64 = result.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('reader error'));
      reader.readAsDataURL(blob);
    });
  }

  async decodeAudioBlob(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error('AudioContext not available');
    const audioContext = new AudioContext();
    try {
      return await audioContext.decodeAudioData(arrayBuffer.slice(0));
    } finally {
      if (typeof audioContext.close === 'function') {
        await audioContext.close().catch(() => {});
      }
    }
  }

  async resampleAudioBuffer(audioBuffer, targetRate) {
    if (!audioBuffer || !targetRate) return audioBuffer;
    if (audioBuffer.sampleRate === targetRate) return audioBuffer;
    const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OfflineContext) return audioBuffer;
    const duration = audioBuffer.duration || audioBuffer.length / audioBuffer.sampleRate;
    const targetLength = Math.max(1, Math.ceil(duration * targetRate));
    const offline = new OfflineContext(1, targetLength, targetRate);
    const source = offline.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offline.destination);
    source.start(0);
    return offline.startRendering();
  }

  writeWavString(view, offset, value) {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  }

  audioBufferToWav(audioBuffer, sampleRate) {
    const numChannels = 1;
    const channelData = audioBuffer.getChannelData(0);
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const dataSize = channelData.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    this.writeWavString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    this.writeWavString(view, 8, 'WAVE');
    this.writeWavString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    this.writeWavString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    let offset = 44;
    for (let i = 0; i < channelData.length; i += 1) {
      let sample = channelData[i];
      sample = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
    return new Blob([view], { type: 'audio/wav' });
  }

  async prepareTranscriptionBlob(blob, targetRate) {
    if (!this.isAndroidPlatform()) return blob;
    const decoded = await this.decodeAudioBlob(blob);
    const rate = targetRate || this.getVoskSampleRate();
    const resampled = await this.resampleAudioBuffer(decoded, rate);
    const buffer = resampled || decoded;
    if (!buffer || buffer.sampleRate !== rate) {
      throw new Error(`No se pudo remuestrear audio a ${rate} Hz`);
    }
    return this.audioBufferToWav(buffer, rate);
  }

  getAudioExtension(mimeType) {
    const type = String(mimeType || '').toLowerCase();
    if (type.includes('mp4') || type.includes('aac') || type.includes('m4a')) return 'm4a';
    if (type.includes('wav')) return 'wav';
    if (type.includes('ogg')) return 'ogg';
    if (type.includes('webm')) return 'webm';
    return 'm4a';
  }

  async writeBlobForTranscription(blob, prefix) {
    const fs = this.getFilesystemPlugin();
    if (!fs) return null;
    const ext = this.getAudioExtension(blob.type);
    const dir = 'CACHE';
    const folder = 'speech';
    const filename = `${prefix}-${Date.now()}.${ext}`;
    try {
      await fs.mkdir({ path: folder, directory: dir, recursive: true });
    } catch (err) {
      // ignore
    }
    const data = await this.blobToBase64(blob);
    const path = `${folder}/${filename}`;
    const result = await fs.writeFile({ path, data, directory: dir });
    return { uri: result && result.uri ? result.uri : '', path, directory: dir };
  }

  async transcribeNativeAudioBlob(blob) {
    const plugin = this.getNativeTranscribePlugin();
    if (!plugin || !this.canNativeFileTranscribe()) return '';
    const sampleRate = this.getVoskSampleRate();
    let stored = null;
    try {
      const prepared = await this.prepareTranscriptionBlob(blob, sampleRate);
      stored = await this.writeBlobForTranscription(prepared, 'free-ride');
      if (!stored || !stored.uri) {
        this.speechFailed = true;
        return '';
      }
      const modelPath = this.getVoskModelPath();
      const payload = {
        path: stored.uri,
        language: this.getPracticeSpeechLocale(),
        sampleRate
      };
      if (modelPath) payload.modelPath = modelPath;
      const result = await plugin.transcribeAudio(payload);
      return result && typeof result.text === 'string' ? result.text : '';
    } catch (err) {
      this.speechFailed = true;
      return '';
    } finally {
      try {
        const fs = this.getFilesystemPlugin();
        if (fs && stored && stored.path) {
          await fs.deleteFile({ path: stored.path, directory: stored.directory });
        }
      } catch (err) {
        // no-op
      }
    }
  }

  hasAutoHeroNarrationPlayed() {
    if (typeof window === 'undefined') return false;
    const appState = window.r34lp0w3r;
    return Boolean(appState && appState.freeRideHeroAutoNarrationPlayed);
  }

  markAutoHeroNarrationPlayed() {
    if (typeof window === 'undefined') return;
    if (!window.r34lp0w3r) window.r34lp0w3r = {};
    window.r34lp0w3r.freeRideHeroAutoNarrationPlayed = true;
  }

  extractSpeechText(value) {
    const container = document.createElement('div');
    container.innerHTML = String(value || '');
    return String(container.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  waitForWebVoices(timeoutMs = 1200) {
    if (!this.canSpeak()) return Promise.resolve([]);
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
        if (document.visibilityState === 'visible') {
          finish();
        }
      };
      document.addEventListener('visibilitychange', onChange);
      setTimeout(finish, Math.max(0, timeoutMs));
    });
  }

  clearNarrationTimer() {
    if (!this.narrationTimer) return;
    clearTimeout(this.narrationTimer);
    this.narrationTimer = null;
  }

  async stopNarrationPlayback() {
    const plugin = this.getNativeTtsPlugin();
    if (plugin && typeof plugin.stop === 'function') {
      try {
        await plugin.stop();
      } catch (err) {
        // no-op
      }
    }
    if (this.canSpeak() && typeof window.speechSynthesis.cancel === 'function') {
      if (typeof window.cancelWebSpeech === 'function') {
        window.cancelWebSpeech();
      } else {
        window.speechSynthesis.cancel();
      }
    }
    this.stopHeroMascotTalk({ settle: true });
  }

  async stopNarration() {
    this.clearNarrationTimer();
    this.narrationToken += 1;
    await this.stopNarrationPlayback();
  }

  scheduleHeroNarration(delayMs = 90, forceNarration = false) {
    this.clearNarrationTimer();
    if (!forceNarration && this.initialHeroNarrationStarted) return;
    if (!forceNarration && !this.isTabActive('freeride')) return;
    const waitMs = Number.isFinite(delayMs) ? Math.max(0, delayMs) : 90;
    this.narrationTimer = setTimeout(() => {
      this.narrationTimer = null;
      if (!this.isConnected) return;
      if (!forceNarration && !this.isTabActive('freeride')) return;
      this.playHeroNarration();
    }, waitMs);
  }

  playHeroNarration() {
    if (!this.isTabActive('freeride')) {
      return Promise.resolve(false);
    }
    const text = this.extractSpeechText(this.currentCopy && this.currentCopy.subtitle);
    if (!text) {
      this.stopNarration().catch(() => {});
      return Promise.resolve(false);
    }
    const locale = this.getUiLocale(this.currentUiLocale);
    return this.speakNarration(text, locale)
      .then((started) => {
        if (started && !this.initialHeroNarrationStarted) {
          this.initialHeroNarrationStarted = true;
          this.markAutoHeroNarrationPlayed();
        }
        return started;
      })
      .catch(() => false);
  }

  async speakNarrationWeb(text, lang, token, voiceWaitMs = 1200, hooks = {}) {
    if (!this.canSpeak()) return false;
    await this.waitForDocumentVisible(1800);
    if (token !== this.narrationToken) return true;
    await this.waitForWebVoices(voiceWaitMs);
    if (token !== this.narrationToken) return true;

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;

    return new Promise((resolve) => {
      let settled = false;
      let playbackEnded = false;
      const notifyPlaybackStart = () => {
        if (typeof hooks.onPlaybackStart === 'function') {
          hooks.onPlaybackStart();
        }
      };
      const notifyPlaybackEnd = () => {
        if (playbackEnded) return;
        playbackEnded = true;
        if (typeof hooks.onPlaybackEnd === 'function') {
          hooks.onPlaybackEnd();
        }
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
      } catch (err) {
        notifyPlaybackEnd();
        settle(false);
      }
    });
  }

  async speakNarration(text, locale) {
    const normalizedLocale = this.normalizeLocale(locale) || 'en';
    const lang = this.getFlagSpeechLocale(normalizedLocale);
    const token = ++this.narrationToken;

    await this.stopNarrationPlayback();
    if (token !== this.narrationToken) return false;

    const plugin = this.getNativeTtsPlugin();
    if (plugin && typeof plugin.speak === 'function') {
      this.startHeroMascotTalk();
      try {
        await plugin.speak({
          text,
          lang,
          rate: 1.0,
          pitch: 1.0,
          volume: 1.0,
          category: 'ambient',
          queueStrategy: 1
        });
        return true;
      } catch (err) {
        // fallback below
      } finally {
        if (token === this.narrationToken) {
          this.stopHeroMascotTalk({ settle: true });
        }
      }
    }

    const hooks = {
      onPlaybackStart: () => {
        if (token !== this.narrationToken) return;
        this.startHeroMascotTalk();
      },
      onPlaybackEnd: () => {
        if (token !== this.narrationToken) return;
        this.stopHeroMascotTalk({ settle: true });
      }
    };

    const started = await this.speakNarrationWeb(text, lang, token, 1500, hooks);
    if (started || token !== this.narrationToken) return started;

    await new Promise((resolve) => setTimeout(resolve, 450));
    if (token !== this.narrationToken) return false;
    await this.stopNarrationPlayback();
    if (token !== this.narrationToken) return false;
    return this.speakNarrationWeb(text, lang, token, 3200, hooks);
  }

  clearRecordingUrl() {
    if (!this.state.recordingUrl) return;
    URL.revokeObjectURL(this.state.recordingUrl);
    this.state.recordingUrl = '';
  }

  clearPracticeResult(options = {}) {
    const { skipRender = false, clearRecording = true, forceNarration = false } = options;
    if (clearRecording) {
      this.clearRecordingUrl();
    }
    this.state.transcript = '';
    this.state.percent = null;
    this.state.recentReward = null;
    this.state.isTranscribing = false;

    if (skipRender) {
      this.updatePhrasePreview(this.currentCopy);
      return;
    }
    this.render({
      forceNarration,
      narrationDelayMs: forceNarration ? 80 : undefined
    });
  }

  stopActiveCapture() {
    this.stopSpeechRecognition();
    this.clearNativeSpeechListeners();
    this.nativeSpeechActive = false;

    if (this.mediaRecorder) {
      try {
        this.mediaRecorder.ondataavailable = null;
        this.mediaRecorder.onstop = null;
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
      } catch (err) {
        // no-op
      }
      this.mediaRecorder = null;
    }

    if (this.recordingStream) {
      this.recordingStream.getTracks().forEach((track) => track.stop());
      this.recordingStream = null;
    }
    this.recordedChunks = [];
    this.state.isRecording = false;
    this.state.isTranscribing = false;
  }

  stopPlayback() {
    const plugin = this.getNativeTtsPlugin();
    if (plugin && typeof plugin.stop === 'function') {
      try {
        Promise.resolve(plugin.stop()).catch(() => {});
      } catch (err) {
        // no-op
      }
    }
    if (this.activeAudio) {
      this.activeAudio.pause();
      this.activeAudio.currentTime = 0;
      this.activeAudio = null;
    }
    if (this.canSpeak()) {
      if (typeof window.cancelWebSpeech === 'function') {
        window.cancelWebSpeech();
      } else {
        window.speechSynthesis.cancel();
      }
    }
    if (this.activePlayButton) {
      this.activePlayButton.classList.remove('is-playing');
      this.activePlayButton = null;
    }
  }

  setActivePlayButton(buttonEl) {
    if (this.activePlayButton && this.activePlayButton !== buttonEl) {
      this.activePlayButton.classList.remove('is-playing');
    }
    this.activePlayButton = buttonEl || null;
    if (this.activePlayButton) {
      this.activePlayButton.classList.add('is-playing');
    }
  }

  clearActivePlayButton() {
    if (!this.activePlayButton) return;
    this.activePlayButton.classList.remove('is-playing');
    this.activePlayButton = null;
  }

  playPhraseWeb(text, lang) {
    if (!text || !this.canSpeak()) return false;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang || this.getPracticeSpeechLocale();
    utter.onend = () => this.clearActivePlayButton();
    utter.onerror = () => this.clearActivePlayButton();
    try {
      const started =
        typeof window.speakWebUtterance === 'function'
          ? window.speakWebUtterance(utter)
          : (() => {
              window.speechSynthesis.speak(utter);
              return true;
            })();
      if (!started) {
        this.clearActivePlayButton();
        return false;
      }
      return true;
    } catch (err) {
      this.clearActivePlayButton();
      return false;
    }
  }

  playPhrase(triggerBtn) {
    const text = this.getExpectedTextTrimmed();
    if (!text) return;
    // Prevent overlap with hero narration timers/playback that can hijack Web Speech on Chrome.
    this.stopNarration().catch(() => {});
    if (triggerBtn && this.activePlayButton === triggerBtn) {
      this.stopPlayback();
      return;
    }
    this.stopPlayback();
    this.setActivePlayButton(triggerBtn || null);
    const lang = this.getPracticeSpeechLocale();
    const plugin = this.getNativeTtsPlugin();
    if (plugin && typeof plugin.speak === 'function') {
      Promise.resolve(
        plugin.speak({
          text,
          lang,
          rate: 1.0,
          pitch: 1.0,
          volume: 1.0,
          category: 'ambient',
          queueStrategy: 1
        })
      )
        .then(() => {
          this.clearActivePlayButton();
        })
        .catch(() => {
          const started = this.playPhraseWeb(text, lang);
          if (!started) {
            this.clearActivePlayButton();
          }
        });
      return;
    }
    const started = this.playPhraseWeb(text, lang);
    if (!started) {
      this.clearActivePlayButton();
    }
  }

  playRecording(triggerBtn) {
    if (!this.state.recordingUrl) return;
    this.stopPlayback();
    this.setActivePlayButton(triggerBtn || null);
    const audio = new Audio(this.state.recordingUrl);
    this.activeAudio = audio;
    audio.play().catch(() => {
      this.clearActivePlayButton();
    });
    audio.onended = () => {
      if (this.activeAudio === audio) {
        this.activeAudio = null;
      }
      this.clearActivePlayButton();
    };
    audio.onerror = () => {
      if (this.activeAudio === audio) {
        this.activeAudio = null;
      }
      this.clearActivePlayButton();
    };
  }

  async startRecording() {
    if (this.state.isRecording || this.state.isTranscribing) return;
    if (!this.hasExpectedText()) return;
    if (!this.canRecord()) return;

    this.stopPlayback();
    this.resetSpeechState();
    this.recordedChunks = [];

    try {
      this.recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      return;
    }

    let options;
    if (typeof MediaRecorder.isTypeSupported === 'function') {
      const supported = this.getRecordMimeCandidates().find((type) =>
        MediaRecorder.isTypeSupported(type)
      );
      if (supported) {
        options = { mimeType: supported };
      }
    }

    try {
      this.mediaRecorder = options
        ? new MediaRecorder(this.recordingStream, options)
        : new MediaRecorder(this.recordingStream);
    } catch (err) {
      if (this.recordingStream) {
        this.recordingStream.getTracks().forEach((track) => track.stop());
        this.recordingStream = null;
      }
      return;
    }

    const startedSpeechRecognition = this.startSpeechRecognition();

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      this.state.isRecording = false;

      const blob = new Blob(this.recordedChunks, {
        type: (this.mediaRecorder && this.mediaRecorder.mimeType) || 'audio/webm'
      });
      const url = URL.createObjectURL(blob);

      this.mediaRecorder = null;
      if (this.recordingStream) {
        this.recordingStream.getTracks().forEach((track) => track.stop());
        this.recordingStream = null;
      }

      if (this.canNativeFileTranscribe()) {
        this.state.isTranscribing = true;
        this.render();
        this.transcribeNativeAudioBlob(blob)
          .then((text) => {
            this.finalizeRecording(url, text);
          })
          .catch(() => {
            this.finalizeRecording(url, '');
          });
        return;
      }

      const finish = () => {
        const transcript = this.speechTranscript || this.speechInterim || '';
        this.finalizeRecording(url, transcript);
      };

      if (startedSpeechRecognition) {
        setTimeout(finish, 240);
      } else {
        finish();
      }
    };

    this.mediaRecorder.start(RECORDING_TIMESLICE);
    this.state.isRecording = true;
    this.render();
  }

  stopRecording() {
    if (!this.mediaRecorder) {
      this.state.isRecording = false;
      this.render();
      return;
    }
    if (this.mediaRecorder.state !== 'inactive') {
      if (typeof this.mediaRecorder.requestData === 'function') {
        try {
          this.mediaRecorder.requestData();
        } catch (err) {
          // no-op
        }
      }
      this.mediaRecorder.stop();
    }
    this.stopSpeechRecognition();
    this.state.isRecording = false;
    this.render();
  }

  finalizeRecording(audioUrl, forcedTranscript) {
    const transcript =
      typeof forcedTranscript === 'string'
        ? forcedTranscript.trim()
        : (this.speechTranscript || this.speechInterim || '').trim();
    const expected = this.getExpectedTextTrimmed();
    const percent = expected ? this.scoreSimilarity(expected, transcript) : null;

    this.clearRecordingUrl();
    this.state.recordingUrl = audioUrl || '';
    this.state.transcript = transcript;
    this.state.isTranscribing = false;
    this.state.isRecording = false;
    this.applyPracticeScore(percent, { skipRender: true });
    this.render();
  }

  toggleLocaleFromFlag() {
    if (this.state.isRecording || this.state.isTranscribing) return;
    const baseLocale = this.getBaseLocale();
    const current = this.getUiLocale(baseLocale);
    const next = getNextLocaleCode(current);
    this.state.localeOverride = next === baseLocale ? '' : next;
    this.persistLocaleOverride(this.state.localeOverride);
    this.stopPlayback();
    this.refreshPhraseForCurrentLocale();
    this.clearPracticeResult({ skipRender: false, clearRecording: true, forceNarration: true });
  }

  onInputText(text) {
    this.stopPlayback();
    this.state.expectedText = String(text || '');
    this.persistPhrase(this.state.expectedText, this.currentUiLocale);
    this.clearPracticeResult({ skipRender: true, clearRecording: true });
  }

  renderDebugPanel() {
    const expected = this.escapeHtml(this.getExpectedTextTrimmed() || 'n/d');
    const transcript = this.escapeHtml((this.state.transcript || '').trim() || 'n/d');
    const toneMax = this.getToneMaxValues();
    const controlsDisabled = this.state.isRecording || this.state.isTranscribing;
    const controlsDisabledAttr = controlsDisabled ? 'disabled' : '';
    const percentText =
      typeof this.state.percent === 'number' ? `${Math.max(0, Math.min(100, Math.round(this.state.percent)))}%` : 'n/d';
    const recordingText = this.state.isRecording ? 'on' : 'off';
    const transcribingText = this.state.isTranscribing ? 'on' : 'off';

    return `
      <div class="speak-voice-nav speak-voice-nav-debug">
        <div class="speak-debug speak-debug-inline free-ride-debug-inline">
          <div class="speak-debug-row">
            <span class="speak-debug-label">Esperado</span>
            <span class="speak-debug-value">${expected}</span>
          </div>
          <div class="speak-debug-row">
            <span class="speak-debug-label">Transcrito</span>
            <span class="speak-debug-value">${transcript}</span>
          </div>
          <div class="speak-debug-row">
            <span class="speak-debug-label">Forzar</span>
            <div class="speak-debug-tones">
              <button
                class="speak-debug-tone tone-bad"
                type="button"
                data-debug-tone="bad"
                aria-label="Forzar rojo ${toneMax.bad}%"
                title="Rojo ${toneMax.bad}%"
                ${controlsDisabledAttr}
              ></button>
              <button
                class="speak-debug-tone tone-okay"
                type="button"
                data-debug-tone="okay"
                aria-label="Forzar amarillo ${toneMax.okay}%"
                title="Amarillo ${toneMax.okay}%"
                ${controlsDisabledAttr}
              ></button>
              <button
                class="speak-debug-tone tone-good"
                type="button"
                data-debug-tone="good"
                aria-label="Forzar verde ${toneMax.good}%"
                title="Verde ${toneMax.good}%"
                ${controlsDisabledAttr}
              ></button>
              <button
                class="speak-debug-tone tone-reset"
                type="button"
                data-debug-tone="reset"
                aria-label="Desasignar porcentaje"
                title="Desasignar %"
                ${controlsDisabledAttr}
              ></button>
            </div>
          </div>
          <div class="speak-debug-row">
            <span class="speak-debug-label">Score</span>
            <span class="speak-debug-value">${percentText}</span>
          </div>
          <div class="speak-debug-row">
            <span class="speak-debug-label">Rec</span>
            <span class="speak-debug-value">${recordingText}</span>
          </div>
          <div class="speak-debug-row">
            <span class="speak-debug-label">STT</span>
            <span class="speak-debug-value">${transcribingText}</span>
          </div>
        </div>
      </div>
    `;
  }

  renderBottomPanel(copy) {
    if (this.isSpeakDebugEnabled() && this.debugPanelOpen) {
      return this.renderDebugPanel();
    }
    return `
      <div class="speak-voice-actions free-ride-voice-actions">
        <button
          class="speak-circle-btn speak-record-btn"
          id="free-ride-record"
          type="button"
          aria-pressed="false"
        >
          <span class="record-visual" aria-hidden="true">
            <ion-icon class="record-mic-icon" name="mic"></ion-icon>
            <span class="record-live-wave">
              <span></span><span></span><span></span><span></span><span></span>
            </span>
          </span>
          <span class="record-label" id="free-ride-record-label">${this.escapeHtml(
            copy.sayLabel || 'Say'
          )}</span>
        </button>
        <button class="speak-circle-btn" id="free-ride-voice" type="button">
          <ion-icon name="ear"></ion-icon>
          <span>${this.escapeHtml(copy.yourVoiceLabel || 'Your voice')}</span>
        </button>
      </div>
    `;
  }

  updateHeaderUser(user) {
    const infoEl = this.querySelector('#free-ride-user-info');
    const nameEl = this.querySelector('#free-ride-user-name');
    const avatarEl = this.querySelector('#free-ride-user-avatar');
    const logoutBtn = this.querySelector('#free-ride-logout-btn');
    if (!infoEl) return;

    const loggedIn = Boolean(user && user.id !== undefined && user.id !== null);
    infoEl.hidden = !loggedIn;
    if (logoutBtn) logoutBtn.hidden = !loggedIn;

    if (!loggedIn || !user) {
      if (nameEl) nameEl.textContent = '';
      if (avatarEl) {
        avatarEl.src = '';
        avatarEl.hidden = true;
      }
      return;
    }

    const name = user.name || user.first_name || user.email || user.social_id || '';
    const avatar = user.image_local || user.image || '';
    if (nameEl) nameEl.textContent = name || 'Usuario';
    if (avatarEl) {
      avatarEl.src = avatar || '';
      avatarEl.alt = name ? `Avatar ${name}` : 'Avatar';
      avatarEl.hidden = !avatar;
    }
  }

  updateHeaderRewards() {
    const container = this.querySelector('#free-ride-reward-badges');
    if (!container) return;
    const rewards =
      window.r34lp0w3r && window.r34lp0w3r.speakSessionRewards
        ? window.r34lp0w3r.speakSessionRewards
        : {};
    const totals = {};
    Object.values(rewards).forEach((entry) => {
      if (!entry || typeof entry.rewardQty !== 'number') return;
      const icon = entry.rewardIcon || 'diamond';
      totals[icon] = (totals[icon] || 0) + entry.rewardQty;
    });
    const entries = Object.entries(totals).filter(([, qty]) => qty > 0);
    if (!entries.length) {
      container.innerHTML = '';
      container.hidden = true;
      return;
    }
    container.hidden = false;
    container.innerHTML = entries
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([icon, qty]) =>
          `<div class="training-badge reward-badge"><ion-icon name="${icon}"></ion-icon><span>${qty}</span></div>`
      )
      .join('');
  }

  logoutUser() {
    if (typeof window.setUser === 'function') {
      window.setUser(null);
      return;
    }
    window.user = null;
    try {
      localStorage.removeItem('appv5:user');
    } catch (err) {
      // no-op
    }
    window.dispatchEvent(new CustomEvent('app:user-change', { detail: null }));
  }

  updatePhrasePreview(copy = this.currentCopy) {
    const phraseEl = this.querySelector('#free-ride-target');
    const playBtn = this.querySelector('#free-ride-play');
    const recordBtn = this.querySelector('#free-ride-record');
    const recordLabelEl = this.querySelector('#free-ride-record-label');
    const voiceBtn = this.querySelector('#free-ride-voice');
    const inputEl = this.querySelector('#free-ride-input');
    const scoreLineEl = this.querySelector('#free-ride-score-line');
    const scoreValueEl = this.querySelector('#free-ride-score-value');
    const scoreTextEl = this.querySelector('#free-ride-score-text');
    const rewardEl = this.querySelector('#free-ride-earned-reward');
    const transcriptEl = this.querySelector('#free-ride-transcript');
    const debugToggleBtn = this.querySelector('#free-ride-debug-toggle');

    const expected = this.getExpectedTextTrimmed();
    const hasText = Boolean(expected);

    if (phraseEl) {
      phraseEl.textContent = hasText ? expected : copy.emptyPhrase || '';
    }
    if (playBtn) {
      playBtn.disabled = !hasText || this.state.isRecording || this.state.isTranscribing;
    }
    if (recordBtn) {
      recordBtn.disabled = !hasText || this.state.isTranscribing;
      recordBtn.classList.toggle('is-recording', this.state.isRecording);
      recordBtn.setAttribute('aria-pressed', this.state.isRecording ? 'true' : 'false');
    }
    if (recordLabelEl) {
      recordLabelEl.textContent = this.state.isRecording
        ? copy.endLabel || 'End'
        : copy.sayLabel || 'Say';
    }
    if (voiceBtn) {
      voiceBtn.disabled = !this.state.recordingUrl || this.state.isRecording || this.state.isTranscribing;
    }
    if (inputEl) {
      inputEl.disabled = this.state.isRecording || this.state.isTranscribing;
    }

    const feedback = this.getFeedbackState(copy);
    if (scoreLineEl && scoreValueEl && scoreTextEl) {
      if (feedback.hasScore) {
        scoreLineEl.className = `speak-score-line ${feedback.tone}`;
        scoreValueEl.textContent = `${feedback.percent}%`;
        scoreTextEl.textContent = feedback.label;
      } else {
        scoreLineEl.className = 'speak-score-line hint';
        scoreValueEl.textContent = '';
        scoreTextEl.textContent = feedback.label;
      }
    }
    if (rewardEl) {
      const reward = this.state.recentReward;
      if (
        reward &&
        typeof reward.rewardQty === 'number' &&
        reward.rewardQty > 0 &&
        reward.rewardIcon
      ) {
        const label = this.escapeHtml(
          `+${Math.round(reward.rewardQty)} ${String(reward.rewardLabel || '').trim() || 'reward'}`
        );
        const icon = this.escapeHtml(reward.rewardIcon);
        rewardEl.hidden = false;
        rewardEl.innerHTML = `<ion-icon name="${icon}"></ion-icon><span>${label}</span>`;
      } else {
        rewardEl.hidden = true;
        rewardEl.innerHTML = '';
      }
    }
    if (transcriptEl) {
      const transcript = String(this.state.transcript || '').trim();
      transcriptEl.classList.toggle('has-text', Boolean(transcript));
      transcriptEl.textContent = transcript || ' ';
    }
    if (debugToggleBtn) {
      const active = this.isSpeakDebugEnabled() && this.debugPanelOpen;
      debugToggleBtn.classList.toggle('is-active', active);
      debugToggleBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  bindUi(copy) {
    const inputEl = this.querySelector('#free-ride-input');
    const flagBtn = this.querySelector('#free-ride-toggle-language');
    const playBtn = this.querySelector('#free-ride-play');
    const recordBtn = this.querySelector('#free-ride-record');
    const voiceBtn = this.querySelector('#free-ride-voice');
    const debugToggleBtn = this.querySelector('#free-ride-debug-toggle');
    const debugToneButtons = Array.from(this.querySelectorAll('[data-debug-tone]'));

    if (inputEl) {
      inputEl.value = this.getExpectedText();
      inputEl.addEventListener('input', () => {
        this.onInputText(inputEl.value);
        this.scheduleLayoutSync(0);
      });
      inputEl.addEventListener('focus', () => {
        this.scheduleLayoutSync(0);
        this.scheduleLayoutSync(140);
      });
      inputEl.addEventListener('blur', () => {
        this.scheduleLayoutSync(0);
        this.scheduleLayoutSync(140);
      });
    }

    flagBtn?.addEventListener('click', () => {
      this.toggleLocaleFromFlag();
    });

    debugToggleBtn?.addEventListener('click', () => {
      this.debugPanelOpen = !this.debugPanelOpen;
      this.persistDebugPanelOpen(this.debugPanelOpen);
      this.render();
    });

    debugToneButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const tone = button.dataset.debugTone || '';
        this.applyDebugTone(tone);
      });
    });

    playBtn?.addEventListener('click', () => {
      this.playPhrase(playBtn);
    });

    recordBtn?.addEventListener('click', () => {
      if (this.state.isRecording) {
        this.stopRecording();
      } else {
        this.startRecording();
      }
    });

    voiceBtn?.addEventListener('click', () => {
      this.playRecording(voiceBtn);
    });

    this.updatePhrasePreview(copy);
  }

  render(options = {}) {
    const uiLocale = this.getUiLocale();
    this.currentUiLocale = uiLocale;
    const copy = getFreeRideCopy(uiLocale);
    this.currentCopy = copy;
    const localeMeta = getLocaleMeta(uiLocale);
    const nextLocaleCode = getNextLocaleCode(uiLocale);
    const nextLocaleMeta = getLocaleMeta(nextLocaleCode);
    const debugEnabled = this.isSpeakDebugEnabled();
    const heroMascotSrc = this.getHeroMascotFramePath(this.heroMascotFrameIndex);
    const toggleLanguageLabel = String(copy.toggleLanguage || '').replace(
      '{lang}',
      nextLocaleMeta.label
    );

    this.innerHTML = `
      <ion-header translucent="true">
        <ion-toolbar class="secret-title">
          <ion-title class="secret-title"></ion-title>
          <div class="app-header-actions" slot="end">
            <div class="app-user-info" id="free-ride-user-info" hidden>
              <img class="app-user-avatar" id="free-ride-user-avatar" alt="Avatar">
              <span class="app-user-name" id="free-ride-user-name"></span>
            </div>
            <div class="reward-badges" id="free-ride-reward-badges"></div>
            <ion-button fill="clear" size="small" class="app-notify-btn">
              <ion-icon slot="icon-only" name="notifications-outline"></ion-icon>
            </ion-button>
            <ion-button fill="clear" size="small" class="app-logout-btn" id="free-ride-logout-btn" hidden>
              <ion-icon slot="icon-only" name="log-out-outline"></ion-icon>
            </ion-button>
          </div>
        </ion-toolbar>
      </ion-header>
      <ion-content fullscreen class="free-ride-content speak-content secret-content">
        <div class="speak-shell free-ride-shell">
          <div class="journey-title free-ride-title-wrap">
            <h2 class="onboarding-intro-title free-ride-screen-title">${this.escapeHtml(
              copy.title || 'Free ride'
            )}</h2>
          </div>
          <section class="free-ride-hero-card onboarding-intro-card">
            <span class="journey-plan-mascot-wrap free-ride-mascot-wrap" aria-hidden="true">
              <img
                class="onboarding-intro-cat free-ride-mascot"
                id="free-ride-hero-mascot"
                src="${this.escapeHtml(heroMascotSrc)}"
                alt=""
              >
            </span>
            <p class="onboarding-intro-bubble free-ride-hero-bubble journey-plan-bubble">${this.escapeHtml(
              copy.subtitle || ''
            )}</p>
            <div class="free-ride-hero-flag-wrap">
              ${
                debugEnabled
                  ? `<button
                class="speak-hero-debug-btn free-ride-hero-debug-btn ${this.debugPanelOpen ? 'is-active' : ''}"
                id="free-ride-debug-toggle"
                type="button"
                aria-label="Toggle debug panel"
                aria-pressed="${this.debugPanelOpen ? 'true' : 'false'}"
              >
                Debug
              </button>`
                  : ''
              }
              <button
                class="onboarding-intro-flag-btn free-ride-flag-btn"
                id="free-ride-toggle-language"
                type="button"
                aria-label="${this.escapeHtml(toggleLanguageLabel)}"
                title="${this.escapeHtml(toggleLanguageLabel)}"
              >
                <img class="onboarding-intro-flag" src="${this.escapeHtml(localeMeta.flag)}" alt="${this.escapeHtml(
                  localeMeta.alt
                )}">
              </button>
            </div>
          </section>

          <section class="free-ride-card">
            <div class="free-ride-card-main">
              <div class="free-ride-input-wrap">
                <label class="free-ride-label" for="free-ride-input">${this.escapeHtml(copy.inputLabel || '')}</label>
                <textarea
                  id="free-ride-input"
                  class="free-ride-input"
                  rows="3"
                  placeholder="${this.escapeHtml(copy.inputPlaceholder || '')}"
                ></textarea>
              </div>

              <div class="speak-sentence-row free-ride-sentence-row">
                <div class="speak-sentence" id="free-ride-target"></div>
                <button class="speak-play-btn" id="free-ride-play" type="button" aria-label="${this.escapeHtml(
                  copy.playPhrase || 'Play phrase'
                )}">
                  <ion-icon name="volume-high"></ion-icon>
                </button>
              </div>

              <div class="speak-score-line placeholder" id="free-ride-score-line">
                <div class="speak-score-line-value" id="free-ride-score-value">&nbsp;</div>
                <div class="speak-score-line-text" id="free-ride-score-text">&nbsp;</div>
              </div>
              <div class="free-ride-earned-reward" id="free-ride-earned-reward" hidden></div>
              <div class="free-ride-transcript" id="free-ride-transcript"> </div>
            </div>

            <div class="speak-step-bottom free-ride-bottom">
              ${this.renderBottomPanel(copy)}
            </div>
          </section>
        </div>
      </ion-content>
    `;

    this.bindUi(copy);
    this.updateHeaderUser(window.user || null);
    this.updateHeaderRewards();
    this.querySelector('#free-ride-logout-btn')?.addEventListener('click', () => {
      this.logoutUser();
    });
    this.renderHeroMascotFrame(this.heroMascotFrameIndex);
    this.setHeroBubbleSpeaking(this.heroMascotIsTalking);
    this.scheduleLayoutSync(0);
    this.scheduleLayoutSync(140);

    const forceNarration = Boolean(options.forceNarration);
    const narrationDelayMs =
      typeof options.narrationDelayMs === 'number' ? options.narrationDelayMs : forceNarration ? 80 : null;
    if (forceNarration || narrationDelayMs !== null) {
      this.scheduleHeroNarration(narrationDelayMs === null ? 90 : narrationDelayMs, forceNarration);
    }
  }
}

customElements.define('page-free-ride', PageFreeRide);
