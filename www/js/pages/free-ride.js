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
const FREE_RIDE_ALIGNED_CACHE_MAX_ITEMS = 36;
const FREE_RIDE_AUDIO_MODE_KEY = 'appv5:free-ride-audio-mode';
const FREE_RIDE_AUDIO_MODE_GENERATED = 'generated';
const FREE_RIDE_AUDIO_MODE_LOCAL = 'local';
const FREE_RIDE_EVAL_MODE_KEY = 'appv5:free-ride-eval-mode';
const FREE_RIDE_EVAL_MODE_STANDARD = 'standard';
const FREE_RIDE_EVAL_MODE_ADVANCED = 'advanced';
const FREE_RIDE_ADVANCED_ENABLED_KEY = 'appv5:free-ride-advanced-enabled';
const FREE_RIDE_ADVANCED_AUDIO_SAMPLE_RATE = 16000;

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
      isTranscribing: false,
      advancedAssessment: null,
      advancedAssessmentPending: false
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
    this.alignedTtsCache = new Map();
    this.alignedTtsLimitStatus = null;
    this.advancedAssessLimitStatus = null;
    this.advancedAssessRequestToken = 0;
    this.advancedPhraseWordMeta = [];
    this.advancedSelectedPhraseWordIndex = -1;
    this.phraseHighlightRaf = null;
    this.phraseHighlightTimeline = [];
    this.phraseHighlightTokenEls = [];
    this.playbackRequestToken = 0;
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
      this.clearAlignedTtsLimitStatus();
      this.clearAdvancedAssessLimitStatus();
      this.clearAdvancedAssessmentState({ skipRender: true });
      this.updatePhrasePreview(this.currentCopy);
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

    this._audioModeHandler = () => {
      if (!this.isConnected) return;
      this.updatePhrasePreview(this.currentCopy);
    };
    window.addEventListener('app:free-ride-audio-mode-change', this._audioModeHandler);

    this._advancedFeatureHandler = () => {
      if (!this.isConnected) return;
      if (!this.isAdvancedEvalFeatureEnabled()) {
        this.clearAdvancedAssessmentState({ skipRender: true });
      }
      this.render();
    };
    window.addEventListener('app:free-ride-advanced-enabled-change', this._advancedFeatureHandler);

    this._tabsDidChangeHandler = (event) => {
      const tab = event && event.detail ? event.detail.tab : '';
      if (tab !== 'freeride') {
        this.clearNarrationTimer();
        this.narrationToken += 1;
        if (this.heroMascotIsTalking) {
          this.stopNarrationPlayback().catch(() => {});
        } else {
          this.stopHeroMascotTalk({ settle: true });
        }
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
    if (this._freeRideDetailsModal) {
      try {
        this._freeRideDetailsModal.dismiss().catch(() => {});
      } catch (err) {
        // no-op
      }
      this._freeRideDetailsModal = null;
    }

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

    if (this._audioModeHandler) {
      window.removeEventListener('app:free-ride-audio-mode-change', this._audioModeHandler);
      this._audioModeHandler = null;
    }

    if (this._advancedFeatureHandler) {
      window.removeEventListener('app:free-ride-advanced-enabled-change', this._advancedFeatureHandler);
      this._advancedFeatureHandler = null;
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

  normalizeFreeRideAudioMode(value) {
    const normalized = String(value || '')
      .trim()
      .toLowerCase();
    return normalized === FREE_RIDE_AUDIO_MODE_LOCAL
      ? FREE_RIDE_AUDIO_MODE_LOCAL
      : FREE_RIDE_AUDIO_MODE_GENERATED;
  }

  getFreeRideAudioMode() {
    const modeFromState =
      window.r34lp0w3r && typeof window.r34lp0w3r.freeRideAudioMode === 'string'
        ? window.r34lp0w3r.freeRideAudioMode
        : '';
    if (modeFromState) {
      return this.normalizeFreeRideAudioMode(modeFromState);
    }
    try {
      return this.normalizeFreeRideAudioMode(localStorage.getItem(FREE_RIDE_AUDIO_MODE_KEY));
    } catch (err) {
      return FREE_RIDE_AUDIO_MODE_GENERATED;
    }
  }

  setFreeRideAudioMode(mode) {
    const normalized = this.normalizeFreeRideAudioMode(mode);
    window.r34lp0w3r = window.r34lp0w3r || {};
    window.r34lp0w3r.freeRideAudioMode = normalized;
    try {
      localStorage.setItem(FREE_RIDE_AUDIO_MODE_KEY, normalized);
    } catch (err) {
      // no-op
    }
    window.dispatchEvent(
      new CustomEvent('app:free-ride-audio-mode-change', {
        detail: { mode: normalized }
      })
    );
    return normalized;
  }

  normalizeFreeRideEvalMode(value) {
    const normalized = String(value || '')
      .trim()
      .toLowerCase();
    return normalized === FREE_RIDE_EVAL_MODE_ADVANCED
      ? FREE_RIDE_EVAL_MODE_ADVANCED
      : FREE_RIDE_EVAL_MODE_STANDARD;
  }

  getFreeRideEvalMode() {
    const modeFromState =
      window.r34lp0w3r && typeof window.r34lp0w3r.freeRideEvalMode === 'string'
        ? window.r34lp0w3r.freeRideEvalMode
        : '';
    if (modeFromState) {
      return this.normalizeFreeRideEvalMode(modeFromState);
    }
    try {
      return this.normalizeFreeRideEvalMode(localStorage.getItem(FREE_RIDE_EVAL_MODE_KEY));
    } catch (err) {
      return FREE_RIDE_EVAL_MODE_STANDARD;
    }
  }

  setFreeRideEvalMode(mode) {
    const normalized = this.normalizeFreeRideEvalMode(mode);
    window.r34lp0w3r = window.r34lp0w3r || {};
    window.r34lp0w3r.freeRideEvalMode = normalized;
    try {
      localStorage.setItem(FREE_RIDE_EVAL_MODE_KEY, normalized);
    } catch (err) {
      // no-op
    }
    return normalized;
  }

  isAdvancedEvalFeatureEnabled() {
    const globalValue =
      window.r34lp0w3r && Object.prototype.hasOwnProperty.call(window.r34lp0w3r, 'freeRideAdvancedEnabled')
        ? window.r34lp0w3r.freeRideAdvancedEnabled
        : undefined;
    if (typeof globalValue === 'boolean') return globalValue;
    if (typeof globalValue === 'string') {
      const normalized = globalValue.trim().toLowerCase();
      if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
      if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
    }
    try {
      const raw = localStorage.getItem(FREE_RIDE_ADVANCED_ENABLED_KEY);
      if (raw === null || raw === undefined || raw === '') return true;
      return !['0', 'false', 'off'].includes(String(raw).trim().toLowerCase());
    } catch (err) {
      return true;
    }
  }

  getCurrentUsageDayUtc() {
    return new Date().toISOString().slice(0, 10);
  }

  getCurrentTtsUsageUserId() {
    const user = window.user;
    if (!user || user.id === undefined || user.id === null) return '';
    const value = String(user.id).trim();
    return value || '';
  }

  clearAlignedTtsLimitStatus() {
    this.alignedTtsLimitStatus = null;
  }

  clearAdvancedAssessLimitStatus() {
    this.advancedAssessLimitStatus = null;
  }

  setAlignedTtsLimitStatus(status) {
    if (!status || typeof status !== 'object') {
      this.alignedTtsLimitStatus = null;
      return null;
    }
    const userIdRaw =
      status.user_id !== undefined && status.user_id !== null ? String(status.user_id).trim() : '';
    const dayRaw = status.day !== undefined && status.day !== null ? String(status.day).trim() : '';
    const charLimit = Number(status.char_limit_day);
    const usedChars = Number(status.used_chars_day);
    const remainingChars = Number(status.remaining_chars_day);
    const normalized = {
      user_id: userIdRaw || '',
      day: dayRaw,
      char_limit_day: Number.isFinite(charLimit) ? Math.max(0, Math.floor(charLimit)) : 0,
      used_chars_day: Number.isFinite(usedChars) ? Math.max(0, Math.floor(usedChars)) : 0,
      remaining_chars_day: Number.isFinite(remainingChars) ? Math.max(0, Math.floor(remainingChars)) : null,
      limit_reached_today: Boolean(status.limit_reached_today)
    };
    this.alignedTtsLimitStatus = normalized;
    return normalized;
  }

  setAdvancedAssessLimitStatus(status) {
    if (!status || typeof status !== 'object') {
      this.advancedAssessLimitStatus = null;
      return null;
    }
    const userIdRaw =
      status.user_id !== undefined && status.user_id !== null ? String(status.user_id).trim() : '';
    const dayRaw = status.day !== undefined && status.day !== null ? String(status.day).trim() : '';
    const secondsLimit = Number(status.seconds_limit_day);
    const usedSeconds = Number(status.used_seconds_day);
    const remainingSeconds = Number(status.remaining_seconds_day);
    const normalized = {
      user_id: userIdRaw || '',
      day: dayRaw,
      seconds_limit_day: Number.isFinite(secondsLimit)
        ? Math.max(0, Math.floor(secondsLimit))
        : 0,
      used_seconds_day: Number.isFinite(usedSeconds)
        ? Math.max(0, Number(usedSeconds.toFixed(3)))
        : 0,
      remaining_seconds_day: Number.isFinite(remainingSeconds)
        ? Math.max(0, Number(remainingSeconds.toFixed(3)))
        : null,
      limit_reached_today: Boolean(status.limit_reached_today)
    };
    this.advancedAssessLimitStatus = normalized;
    return normalized;
  }

  applyAlignedTtsLimitStatusFromPayload(payload) {
    if (!payload || typeof payload !== 'object') return null;
    if (payload.limit_status && typeof payload.limit_status === 'object') {
      return this.setAlignedTtsLimitStatus(payload.limit_status);
    }
    if (
      payload.char_limit_day !== undefined ||
      payload.used_chars_day !== undefined ||
      payload.remaining_chars_day !== undefined ||
      payload.limit_reached_today !== undefined
    ) {
      return this.setAlignedTtsLimitStatus(payload);
    }
    return null;
  }

  applyAdvancedAssessLimitStatusFromPayload(payload) {
    if (!payload || typeof payload !== 'object') return null;
    if (payload.limit_status && typeof payload.limit_status === 'object') {
      return this.setAdvancedAssessLimitStatus(payload.limit_status);
    }
    if (
      payload.seconds_limit_day !== undefined ||
      payload.used_seconds_day !== undefined ||
      payload.remaining_seconds_day !== undefined ||
      payload.limit_reached_today !== undefined
    ) {
      return this.setAdvancedAssessLimitStatus(payload);
    }
    return null;
  }

  isAlignedTtsBlockedByLimit() {
    const status = this.alignedTtsLimitStatus;
    if (!status || !status.limit_reached_today) return false;
    if (status.day && status.day !== this.getCurrentUsageDayUtc()) return false;
    const currentUserId = this.getCurrentTtsUsageUserId();
    if (currentUserId) {
      if (status.user_id && status.user_id !== currentUserId) return false;
      return true;
    }
    if (status.user_id && status.user_id !== 'unknown') return false;
    return true;
  }

  isAdvancedAssessBlockedByLimit() {
    const status = this.advancedAssessLimitStatus;
    if (!status || !status.limit_reached_today) return false;
    if (status.day && status.day !== this.getCurrentUsageDayUtc()) return false;
    const currentUserId = this.getCurrentTtsUsageUserId();
    if (currentUserId) {
      if (status.user_id && status.user_id !== currentUserId) return false;
      return true;
    }
    if (status.user_id && status.user_id !== 'unknown') return false;
    return true;
  }

  getEffectiveFreeRideAudioMode() {
    const selectedMode = this.getFreeRideAudioMode();
    if (
      selectedMode === FREE_RIDE_AUDIO_MODE_GENERATED &&
      this.isAlignedTtsBlockedByLimit()
    ) {
      return FREE_RIDE_AUDIO_MODE_LOCAL;
    }
    return selectedMode;
  }

  getEffectiveFreeRideEvalMode() {
    const selectedMode = this.getFreeRideEvalMode();
    if (!this.isAdvancedEvalFeatureEnabled() && selectedMode === FREE_RIDE_EVAL_MODE_ADVANCED) {
      return FREE_RIDE_EVAL_MODE_STANDARD;
    }
    if (
      selectedMode === FREE_RIDE_EVAL_MODE_ADVANCED &&
      this.isAdvancedAssessBlockedByLimit()
    ) {
      return FREE_RIDE_EVAL_MODE_STANDARD;
    }
    return selectedMode;
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

  escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  resolveAlignedTtsEndpoint() {
    const cfg = window.realtimeConfig || {};
    const direct = cfg.ttsAlignedEndpoint || window.REALTIME_TTS_ALIGNED_ENDPOINT;
    if (typeof direct === 'string' && direct.trim()) {
      return direct.trim();
    }
    const emitEndpoint = cfg.emitEndpoint;
    if (typeof emitEndpoint === 'string' && emitEndpoint.trim()) {
      const trimmed = emitEndpoint.trim().replace(/\/+$/, '');
      if (trimmed.endsWith('/emit')) {
        return `${trimmed.slice(0, -5)}/tts/aligned`;
      }
    }
    return 'https://realtime.curso-ingles.com/realtime/tts/aligned';
  }

  buildAlignedTtsHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const cfg = window.realtimeConfig || {};
    const token =
      typeof cfg.stateToken === 'string'
        ? cfg.stateToken.trim()
        : typeof window.REALTIME_STATE_TOKEN === 'string'
        ? window.REALTIME_STATE_TOKEN.trim()
        : '';
    if (token) {
      headers['x-rt-token'] = token;
    }
    return headers;
  }

  getAlignedTtsCacheKey(text, lang) {
    return `${String(lang || '').trim().toLowerCase()}::${String(text || '').trim()}`;
  }

  getAlignedTtsFromCache(text, lang) {
    const key = this.getAlignedTtsCacheKey(text, lang);
    if (!key || !this.alignedTtsCache.has(key)) return null;
    const cached = this.alignedTtsCache.get(key);
    this.alignedTtsCache.delete(key);
    this.alignedTtsCache.set(key, cached);
    return cached;
  }

  storeAlignedTtsInCache(text, lang, payload) {
    const key = this.getAlignedTtsCacheKey(text, lang);
    if (!key || !payload) return;
    this.alignedTtsCache.set(key, payload);
    while (this.alignedTtsCache.size > FREE_RIDE_ALIGNED_CACHE_MAX_ITEMS) {
      const oldest = this.alignedTtsCache.keys().next();
      if (oldest && !oldest.done) {
        this.alignedTtsCache.delete(oldest.value);
      } else {
        break;
      }
    }
  }

  async fetchAlignedTts(text, lang) {
    const expected = String(text || '').trim();
    const locale = String(lang || '').trim() || 'en-US';
    if (!expected) return null;

    const cached = this.getAlignedTtsFromCache(expected, locale);
    if (cached) return cached;

    const endpoint = this.resolveAlignedTtsEndpoint();
    if (!endpoint) return null;
    const body = {
      text: expected,
      locale
    };
    const user = window.user;
    if (user && user.id !== undefined && user.id !== null && String(user.id).trim()) {
      body.user_id = String(user.id).trim();
    }
    if (user && typeof user.name === 'string' && user.name.trim()) {
      body.user_name = user.name.trim();
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.buildAlignedTtsHeaders(),
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      let errorPayload = null;
      try {
        errorPayload = await response.json();
      } catch (err) {
        errorPayload = null;
      }
      if (errorPayload) {
        const prevBlocked = this.isAlignedTtsBlockedByLimit();
        this.applyAlignedTtsLimitStatusFromPayload(errorPayload);
        const nextBlocked = this.isAlignedTtsBlockedByLimit();
        if (nextBlocked !== prevBlocked) {
          this.updatePhrasePreview(this.currentCopy);
        }
      }
      return null;
    }
    const data = await response.json();
    if (data) {
      const prevBlocked = this.isAlignedTtsBlockedByLimit();
      this.applyAlignedTtsLimitStatusFromPayload(data);
      const nextBlocked = this.isAlignedTtsBlockedByLimit();
      if (nextBlocked !== prevBlocked) {
        this.updatePhrasePreview(this.currentCopy);
      }
    }
    if (!data || data.ok !== true) return null;
    if (typeof data.audio_url !== 'string' || !data.audio_url.trim()) return null;
    this.storeAlignedTtsInCache(expected, locale, data);
    return data;
  }

  resolvePronunciationAssessEndpoint() {
    const cfg = window.realtimeConfig || {};
    const direct = cfg.pronunciationAssessEndpoint || window.REALTIME_PRONUNCIATION_ASSESS_ENDPOINT;
    if (typeof direct === 'string' && direct.trim()) {
      return direct.trim();
    }
    const emitEndpoint = cfg.emitEndpoint;
    if (typeof emitEndpoint === 'string' && emitEndpoint.trim()) {
      const trimmed = emitEndpoint.trim().replace(/\/+$/, '');
      if (trimmed.endsWith('/emit')) {
        return `${trimmed.slice(0, -5)}/pronunciation/assess`;
      }
    }
    return 'https://realtime.curso-ingles.com/realtime/pronunciation/assess';
  }

  clearAdvancedAssessmentState(options = {}) {
    this.advancedAssessRequestToken += 1;
    this.state.advancedAssessment = null;
    this.state.advancedAssessmentPending = false;
    this.advancedPhraseWordMeta = [];
    this.advancedSelectedPhraseWordIndex = -1;
    if (!options.skipRender) {
      this.render();
    }
  }

  setAdvancedAssessmentPending(pending, options = {}) {
    this.state.advancedAssessmentPending = Boolean(pending);
    if (!pending && options.clearResult) {
      this.state.advancedAssessment = null;
    }
    if (pending) {
      this.advancedPhraseWordMeta = [];
      this.advancedSelectedPhraseWordIndex = -1;
    }
    if (!options.skipRender) {
      this.render();
    }
  }

  setAdvancedAssessmentResult(result, options = {}) {
    this.state.advancedAssessment = result && typeof result === 'object' ? result : null;
    this.state.advancedAssessmentPending = false;
    this.advancedPhraseWordMeta = [];
    this.advancedSelectedPhraseWordIndex = -1;
    if (!options.skipRender) {
      this.render();
    }
  }

  getAdvancedAssessmentSummaryText() {
    if (this.state.advancedAssessmentPending) return 'Evaluando...';
    const result = this.state.advancedAssessment;
    if (!result || typeof result !== 'object') return 'n/d';
    if (result.ok === false) {
      return result.error_label || result.error || 'error';
    }
    const scores = result.scores && typeof result.scores === 'object' ? result.scores : {};
    const parts = [];
    const pushScore = (label, value) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        parts.push(`${label}${Math.round(value)}`);
      }
    };
    pushScore('O', scores.overall);
    pushScore('A', scores.accuracy);
    pushScore('F', scores.fluency);
    pushScore('C', scores.completeness);
    pushScore('P', scores.prosody);
    if (!parts.length) {
      const status = String(result.recognition_status || '').trim();
      return status || 'ok';
    }
    return parts.join(' · ');
  }

  getAdvancedAssessmentDisplayInfo() {
    if (!this.isAdvancedEvalFeatureEnabled()) {
      return { visible: false, tone: '', text: '', html: '' };
    }
    const effectiveMode = this.getEffectiveFreeRideEvalMode();
    const blocked = this.isAdvancedAssessBlockedByLimit();
    if (effectiveMode !== FREE_RIDE_EVAL_MODE_ADVANCED) {
      if (blocked && this.getFreeRideEvalMode() === FREE_RIDE_EVAL_MODE_ADVANCED) {
        return {
          visible: true,
          tone: 'warn',
          text: this.getFreeRideUiLabelText('advancedBlockedUsingStandard'),
          html: this.renderFreeRideUiLabelHtml('advancedBlockedUsingStandard')
        };
      }
      return { visible: false, tone: '', text: '', html: '' };
    }
    if (this.state.advancedAssessmentPending) {
      return {
        visible: true,
        tone: 'pending',
        text: `${this.getFreeRideUiLabelText('advanced')}: ${this.getFreeRideUiLabelText('evaluatingPronunciation')}`,
        html: `${this.renderFreeRideUiLabelHtml('advanced')} · ${this.renderFreeRideUiLabelHtml('evaluatingPronunciation', {
          altClass: 'is-compact'
        })}`
      };
    }
    const result = this.state.advancedAssessment;
    if (!result) {
      return { visible: false, tone: '', text: '', html: '' };
    }
    if (result.ok !== true) {
      const label = String(result.error_label || result.error || 'Error').trim();
      return {
        visible: true,
        tone: 'warn',
        text: `${this.getFreeRideUiLabelText('advanced')}: ${label}`,
        html: `${this.renderFreeRideUiLabelHtml('advanced')} · ${this.escapeHtml(label)}`
      };
    }
    const summary = this.getAdvancedAssessmentSummaryText();
    const summaryHtml =
      summary && /^[A-Za-z]+(?:[A-Za-z0-9_-]*)$/.test(summary)
        ? this.renderRecognitionStatusBilingualHtml(summary, { altClass: 'is-compact' })
        : this.escapeHtml(summary);
    return {
      visible: true,
      tone: 'ok',
      text: `${this.getFreeRideUiLabelText('advanced')} · ${summary}`,
      html: `${this.renderFreeRideUiLabelHtml('advanced')} · ${summaryHtml}`
    };
  }

  clearAdvancedWordSelection(options = {}) {
    this.advancedSelectedPhraseWordIndex = -1;
    if (!options.skipRender) {
      this.updatePhrasePreview(this.currentCopy);
    }
  }

  setAdvancedWordSelection(index, options = {}) {
    const numeric = Number(index);
    if (!Number.isFinite(numeric)) {
      this.clearAdvancedWordSelection(options);
      return;
    }
    const normalized = Math.max(0, Math.floor(numeric));
    this.advancedSelectedPhraseWordIndex =
      this.advancedSelectedPhraseWordIndex === normalized && !options.allowToggleOff
        ? normalized
        : this.advancedSelectedPhraseWordIndex === normalized && options.allowToggleOff
        ? -1
        : normalized;
    if (!options.skipRender) {
      this.updatePhrasePreview(this.currentCopy);
    }
  }

  getAdvancedSelectedWordMeta() {
    const selectedIndex = Number(this.advancedSelectedPhraseWordIndex);
    if (!Number.isFinite(selectedIndex) || selectedIndex < 0) return null;
    const list = Array.isArray(this.advancedPhraseWordMeta) ? this.advancedPhraseWordMeta : [];
    const meta = list[selectedIndex];
    return meta && typeof meta === 'object' ? meta : null;
  }

  getAdvancedSelectedWordDetailInfo() {
    if (!this.isAdvancedEvalFeatureEnabled()) return { visible: false, tone: '', html: '' };
    const activeAdvanced = this.getActiveAdvancedAssessment();
    if (!activeAdvanced) return { visible: false, tone: '', html: '' };
    if (this.state.advancedAssessmentPending) {
      return {
        visible: true,
        tone: 'pending',
        html: this.renderFreeRideUiLabelHtml('evaluatingPronunciation')
      };
    }
    const selected = this.getAdvancedSelectedWordMeta();
    if (!selected) {
      return {
        visible: true,
        tone: 'hint',
        html: this.renderFreeRideUiLabelHtml('wordTapHint')
      };
    }

    const expected = this.escapeHtml(selected.expected || 'n/d');
    const recognized = this.escapeHtml(selected.recognized || '—');
    const statusRaw = String(selected.status || '').trim().toLowerCase();
    const statusLabel =
      statusRaw === 'ok'
        ? this.renderFreeRideUiLabelHtml('ok', { altClass: 'is-mini' })
        : statusRaw === 'wrong'
        ? this.renderBilingualCopyHtml('Incorrecta', 'Incorrect', { altClass: 'is-mini' })
        : statusRaw === 'missing'
        ? this.renderBilingualCopyHtml('Omitida', 'Missing', { altClass: 'is-mini' })
        : statusRaw === 'extra'
        ? this.renderBilingualCopyHtml('Extra', 'Extra', { altClass: 'is-mini' })
        : statusRaw === 'issue'
        ? this.renderFreeRideUiLabelHtml('issue', { altClass: 'is-mini' })
        : this.escapeHtml(selected.status || 'n/d');
    const scoreText =
      typeof selected.score === 'number' && Number.isFinite(selected.score)
        ? `${Math.round(selected.score)}%`
        : 'n/d';
    const errorType = this.escapeHtml(selected.error_type || '—');

    let phonemeText = '';
    if (Array.isArray(selected.phonemes) && selected.phonemes.length) {
      const weak = this.getAdvancedDisplayablePhonemes(selected)
        .slice()
        .sort((a, b) => a.score - b.score)[0];
      if (weak) {
        phonemeText = ` · ${this.renderFreeRideUiLabelHtml('phoneme', { altClass: 'is-mini' })}: ${this.escapeHtml(
          weak.phoneme
        )} (${Math.round(weak.score)}%)`;
      } else {
        phonemeText = ` · ${this.renderFreeRideUiLabelHtml('phoneme', { altClass: 'is-mini' })}: n/d`;
      }
    }

    const tone =
      statusRaw === 'ok'
        ? 'ok'
        : statusRaw === 'missing' || statusRaw === 'wrong' || statusRaw === 'issue'
        ? 'warn'
        : 'hint';

    return {
      visible: true,
      tone,
      html: `<strong>${expected}</strong> · ${this.renderFreeRideUiLabelHtml('score', { altClass: 'is-mini' })} ${scoreText} · ${statusLabel} · ${this.renderFreeRideUiLabelHtml(
        'recognizedShort',
        { altClass: 'is-mini' }
      )}: ${recognized} · ${this.renderFreeRideUiLabelHtml('errorShort', { altClass: 'is-mini' })}: ${errorType}${phonemeText}`
    };
  }

  canOpenPhraseDetailsModal() {
    if (this.getExpectedTextTrimmed()) return true;
    if (String(this.state.transcript || '').trim()) return true;
    if (this.state.advancedAssessmentPending) return true;
    if (this.state.advancedAssessment) return true;
    if (typeof this.state.percent === 'number') return true;
    return false;
  }

  formatDurationMsForDetail(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return '—';
    return `${Math.round(n)} ms`;
  }

  renderBilingualCopyHtml(primaryText, secondaryText, options = {}) {
    const primary = String(primaryText || '').trim();
    const secondary = String(secondaryText || '').trim();
    if (!primary && !secondary) return '';
    if (!primary) return this.escapeHtml(secondary);
    if (!secondary) return this.escapeHtml(primary);
    if (primary.toLowerCase() === secondary.toLowerCase()) return this.escapeHtml(primary);
    const altClass = options.altClass ? ` ${String(options.altClass).trim()}` : '';
    return `${this.escapeHtml(primary)} <span class="free-ride-copy-alt${altClass}">(${this.escapeHtml(
      secondary
    )})</span>`;
  }

  getFreeRideCopyValueForLocale(key, locale, fallback = '') {
    const source = getFreeRideCopy(locale) || {};
    const raw = source && Object.prototype.hasOwnProperty.call(source, key) ? source[key] : fallback;
    return String(raw || '').trim();
  }

  renderFreeRideCopyBilingualHtml(key, options = {}) {
    const fallbackEs = Object.prototype.hasOwnProperty.call(options, 'fallbackEs') ? options.fallbackEs : '';
    const fallbackEn = Object.prototype.hasOwnProperty.call(options, 'fallbackEn') ? options.fallbackEn : '';
    const primary = this.getFreeRideCopyValueForLocale(key, 'es', fallbackEs);
    const secondary = this.getFreeRideCopyValueForLocale(key, 'en', fallbackEn);
    return this.renderBilingualCopyHtml(primary, secondary, options);
  }

  getFreeRideCopyBilingualPlainText(key, options = {}) {
    const fallbackEs = Object.prototype.hasOwnProperty.call(options, 'fallbackEs') ? options.fallbackEs : '';
    const fallbackEn = Object.prototype.hasOwnProperty.call(options, 'fallbackEn') ? options.fallbackEn : '';
    const primary = this.getFreeRideCopyValueForLocale(key, 'es', fallbackEs);
    const secondary = this.getFreeRideCopyValueForLocale(key, 'en', fallbackEn);
    if (!primary && !secondary) return '';
    if (!primary) return secondary;
    if (!secondary) return primary;
    if (primary.toLowerCase() === secondary.toLowerCase()) return primary;
    return `${primary} (${secondary})`;
  }

  getFreeRideUiLabelPair(key) {
    const labels = {
      advanced: ['Avanzado', 'Advanced'],
      standard: ['Estándar', 'Standard'],
      evaluating: ['Evaluando...', 'Evaluating...'],
      advancedBlockedUsingStandard: ['Avanzado bloqueado por límite diario, usando estándar', 'Advanced blocked by daily limit, using Standard'],
      evaluatingPronunciation: ['Evaluando pronunciación...', 'Evaluating pronunciation...'],
      wordTapHint: ['Toca una palabra marcada para ver detalle.', 'Tap a marked word to see details.'],
      score: ['puntuación', 'score'],
      recognizedShort: ['rec', 'rec'],
      errorShort: ['err', 'err'],
      phoneme: ['Fonema', 'Phoneme'],
      expected: ['Esperado', 'Expected'],
      transcript: ['Transcrito', 'Transcript'],
      standardScore: ['Puntuación estándar', 'Standard score'],
      diffSummary: ['Resumen diff', 'Diff summary'],
      noComparisonDataYet: ['Sin datos de comparación todavía.', 'No comparison data yet.'],
      recognition: ['Reconocimiento', 'Recognition'],
      transcriptAzure: ['Transcrito (Azure)', 'Transcript (Azure)'],
      overall: ['Global', 'Overall'],
      accuracy: ['Precisión', 'Accuracy'],
      fluency: ['Fluidez', 'Fluency'],
      completeness: ['Completitud', 'Completeness'],
      prosody: ['Prosodia', 'Prosody'],
      selectedWord: ['Palabra seleccionada', 'Selected word'],
      phonemes: ['Fonemas', 'Phonemes'],
      noAdvancedWordDetail: ['Sin detalle de palabras en la respuesta avanzada.', 'No word-level detail in the advanced response.'],
      rawProviderPayloadDebug: ['Payload bruto del proveedor (debug)', 'Raw provider payload (debug)'],
      advancedErrorPrefix: ['Avanzado', 'Advanced'],
      noAdvancedDataYet: ['Sin datos avanzados todavía.', 'No advanced data yet.'],
      phraseDetails: ['Detalle de la frase', 'Phrase details'],
      standardPlusAdvancedIfAvailable: ['Estándar + Avanzado (si disponible)', 'Standard + Advanced (if available)'],
      match: ['Acierto', 'match'],
      replace: ['Sustitución', 'replace'],
      missing: ['Omitida', 'missing'],
      extra: ['Extra', 'extra'],
      distance: ['distancia', 'distance'],
      ok: ['OK', 'OK'],
      incorrecta: ['Incorrecta', 'Incorrect'],
      issue: ['Incidencia', 'Issue']
    };
    return labels[key] || [String(key || ''), String(key || '')];
  }

  renderFreeRideUiLabelHtml(key, options = {}) {
    const [es, en] = this.getFreeRideUiLabelPair(key);
    return this.renderBilingualCopyHtml(es, en, options);
  }

  getFreeRideUiLabelText(key) {
    const [es, en] = this.getFreeRideUiLabelPair(key);
    if (!es && !en) return '';
    if (!es) return en;
    if (!en) return es;
    if (String(es).toLowerCase() === String(en).toLowerCase()) return es;
    return `${es} (${en})`;
  }

  getRecognitionStatusBilingualText(status) {
    const raw = String(status || '').trim();
    if (!raw) return 'n/d';
    const normalized = raw.toLowerCase();
    if (normalized === 'success') return 'Éxito (Success)';
    if (normalized === 'nomatch') return 'Sin coincidencia (NoMatch)';
    if (normalized === 'initialsilencetimeout') return 'Silencio inicial agotado (InitialSilenceTimeout)';
    if (normalized === 'babbletimeout') return 'Ruido/Babble timeout (BabbleTimeout)';
    return raw;
  }

  renderRecognitionStatusBilingualHtml(status, options = {}) {
    const raw = String(status || '').trim();
    if (!raw) return 'n/d';
    const normalized = raw.toLowerCase();
    if (normalized === 'success') return this.renderBilingualCopyHtml('Éxito', 'Success', options);
    if (normalized === 'nomatch') return this.renderBilingualCopyHtml('Sin coincidencia', 'NoMatch', options);
    if (normalized === 'initialsilencetimeout') {
      return this.renderBilingualCopyHtml('Silencio inicial agotado', 'InitialSilenceTimeout', options);
    }
    if (normalized === 'babbletimeout') return this.renderBilingualCopyHtml('Ruido/Babble timeout', 'BabbleTimeout', options);
    return this.escapeHtml(raw);
  }

  isAdvancedPhonemeScoreUsable(wordLike, phonemeLike) {
    const status = String(wordLike && wordLike.status ? wordLike.status : '')
      .trim()
      .toLowerCase();
    if (status === 'missing' || status === 'extra') return false;
    const wordScoreRaw = wordLike && wordLike.score;
    if (typeof wordScoreRaw !== 'number' || !Number.isFinite(wordScoreRaw)) return false;
    const phonemeScoreRaw = phonemeLike && phonemeLike.score;
    return typeof phonemeScoreRaw === 'number' && Number.isFinite(phonemeScoreRaw);
  }

  getAdvancedDisplayablePhonemes(wordLike) {
    const phonemes = Array.isArray(wordLike && wordLike.phonemes) ? wordLike.phonemes : [];
    return phonemes
      .map((phoneme) => {
        const rawScore = phoneme && phoneme.score;
        return {
          phoneme: phoneme && phoneme.phoneme ? String(phoneme.phoneme) : '',
          score: typeof rawScore === 'number' && Number.isFinite(rawScore) ? rawScore : null,
          usable: this.isAdvancedPhonemeScoreUsable(wordLike, phoneme)
        };
      })
      .filter((item) => item.phoneme && item.usable && item.score !== null);
  }

  getAdvancedStatusLabel(status) {
    const key = String(status || '')
      .trim()
      .toLowerCase();
    if (key === 'ok') return 'OK';
    if (key === 'wrong') return 'Incorrecta';
    if (key === 'missing') return 'Omitida';
    if (key === 'extra') return 'Extra';
    if (key === 'issue') return 'Issue';
    return key || 'n/d';
  }

  renderAdvancedStatusLabelHtml(status, options = {}) {
    const key = String(status || '')
      .trim()
      .toLowerCase();
    if (key === 'ok') return this.renderBilingualCopyHtml('OK', 'OK', options);
    if (key === 'wrong') return this.renderBilingualCopyHtml('Incorrecta', 'Incorrect', options);
    if (key === 'missing') return this.renderBilingualCopyHtml('Omitida', 'Missing', options);
    if (key === 'extra') return this.renderBilingualCopyHtml('Extra', 'Extra', options);
    if (key === 'issue') return this.renderBilingualCopyHtml('Incidencia', 'Issue', options);
    return this.escapeHtml(this.getAdvancedStatusLabel(status));
  }

  getWordDiffKindLabel(kind) {
    const key = String(kind || '')
      .trim()
      .toLowerCase();
    if (key === 'match') return 'match';
    if (key === 'replace') return 'replace';
    if (key === 'missing') return 'missing';
    if (key === 'extra') return 'extra';
    return key || 'n/d';
  }

  renderWordDiffKindLabelHtml(kind, options = {}) {
    const key = String(kind || '')
      .trim()
      .toLowerCase();
    if (key === 'match') return this.renderBilingualCopyHtml('Acierto', 'match', options);
    if (key === 'replace') return this.renderBilingualCopyHtml('Sustitución', 'replace', options);
    if (key === 'missing') return this.renderBilingualCopyHtml('Omitida', 'missing', options);
    if (key === 'extra') return this.renderBilingualCopyHtml('Extra', 'extra', options);
    return this.escapeHtml(this.getWordDiffKindLabel(kind));
  }

  getWordDiffKindTone(kind) {
    const key = String(kind || '')
      .trim()
      .toLowerCase();
    if (key === 'match') return 'ok';
    if (key === 'replace') return 'warn';
    if (key === 'missing' || key === 'extra') return 'bad';
    return 'neutral';
  }

  buildPhraseDetailsModalHtml() {
    const copy = this.currentCopy || {};
    const expected = this.getExpectedTextTrimmed();
    const transcript = String(this.state.transcript || '').trim();
    const feedback = this.getFeedbackState(copy);
    const diff = this.buildWordDiffDetailedComparison(expected, transcript);
    const advanced = this.state.advancedAssessment;
    const advancedFeatureEnabled = this.isAdvancedEvalFeatureEnabled();
    const advancedOk = Boolean(advanced && typeof advanced === 'object' && advanced.ok === true);
    const advancedWords = advancedOk && Array.isArray(advanced.words) ? advanced.words : [];
    const advancedScores = advancedOk && advanced.scores && typeof advanced.scores === 'object' ? advanced.scores : {};
    const selectedMeta = this.getAdvancedSelectedWordMeta();
    const feedbackDetailLabel = feedback.labelKey
      ? this.getFreeRideCopyBilingualPlainText(feedback.labelKey, { fallbackEs: feedback.label, fallbackEn: feedback.label })
      : (feedback.label || '');

    const standardCards = [
      { labelHtml: this.renderFreeRideUiLabelHtml('expected'), value: expected || 'n/d' },
      { labelHtml: this.renderFreeRideUiLabelHtml('transcript'), value: transcript || 'n/d' },
      {
        labelHtml: this.renderFreeRideUiLabelHtml('standardScore'),
        value:
          typeof this.state.percent === 'number'
            ? `${Math.max(0, Math.min(100, Math.round(this.state.percent)))}% · ${feedbackDetailLabel || ''}`
            : `n/d · ${feedbackDetailLabel || ''}`
      }
    ];

    const diffSummary = diff
      ? `${this.getFreeRideUiLabelText('match')} ${diff.counts.match} · ${this.getFreeRideUiLabelText('replace')} ${
          diff.counts.replace
        } · ${this.getFreeRideUiLabelText('missing')} ${diff.counts.missing} · ${this.getFreeRideUiLabelText('extra')} ${
          diff.counts.extra
        } · ${this.getFreeRideUiLabelText('distance')} ${diff.distance}`
      : 'n/d';

    const standardSection = `
      <section class="free-ride-detail-section">
        <h3>${this.renderFreeRideUiLabelHtml('standard')}</h3>
        <div class="free-ride-detail-grid">
          ${standardCards
            .map(
              (item) => `
            <div class="free-ride-detail-card">
              <div class="free-ride-detail-card-label">${item.labelHtml || ''}</div>
              <div class="free-ride-detail-card-value">${this.escapeHtml(item.value)}</div>
            </div>`
            )
            .join('')}
          <div class="free-ride-detail-card">
            <div class="free-ride-detail-card-label">${this.renderFreeRideUiLabelHtml('diffSummary')}</div>
            <div class="free-ride-detail-card-value">${this.escapeHtml(diffSummary)}</div>
          </div>
        </div>
        <div class="free-ride-detail-list">
          ${
            diff && Array.isArray(diff.pairs) && diff.pairs.length
              ? diff.pairs
                  .map((row, index) => {
                    const tone = this.getWordDiffKindTone(row.kind);
                    return `
                  <div class="free-ride-detail-row is-${tone}">
                    <div class="free-ride-detail-row-index">${index + 1}</div>
                    <div class="free-ride-detail-row-main">
                      <div class="free-ride-detail-row-top">
                        <span class="free-ride-detail-badge is-${tone}">${this.renderWordDiffKindLabelHtml(row.kind, {
                          altClass: 'is-mini'
                        })}</span>
                        <span class="free-ride-detail-row-word"><b>${this.escapeHtml(
                          row.expected_word || '—'
                        )}</b> → ${this.escapeHtml(row.actual_word || '—')}</span>
                      </div>
                    </div>
                  </div>`;
                  })
                  .join('')
                : `<div class="free-ride-detail-empty">${this.renderFreeRideUiLabelHtml('noComparisonDataYet')}</div>`
            }
          </div>
      </section>
    `;

    const advancedScoresList = ['overall', 'accuracy', 'fluency', 'completeness', 'prosody']
      .map((key) => {
        const value = advancedScores[key];
        const labelKey =
          key === 'overall'
            ? 'overall'
            : key === 'accuracy'
            ? 'accuracy'
            : key === 'fluency'
            ? 'fluency'
            : key === 'completeness'
            ? 'completeness'
            : 'prosody';
        return { labelKey, value };
      })
      .filter((item) => typeof item.value === 'number' && Number.isFinite(item.value));

    const advancedSection = !advancedFeatureEnabled
      ? ''
      : `
      <section class="free-ride-detail-section">
        <h3>${this.renderFreeRideUiLabelHtml('advanced')}</h3>
        ${
          this.state.advancedAssessmentPending
            ? `<div class="free-ride-detail-empty">${this.renderFreeRideUiLabelHtml('evaluatingPronunciation')}</div>`
            : advancedOk
            ? `
          <div class="free-ride-detail-grid">
            <div class="free-ride-detail-card">
              <div class="free-ride-detail-card-label">${this.renderFreeRideUiLabelHtml('recognition')}</div>
              <div class="free-ride-detail-card-value">${this.renderRecognitionStatusBilingualHtml(
                String(advanced.recognition_status || 'n/d'),
                { altClass: 'is-compact' }
              )}</div>
            </div>
            <div class="free-ride-detail-card">
              <div class="free-ride-detail-card-label">${this.renderFreeRideUiLabelHtml('transcriptAzure')}</div>
              <div class="free-ride-detail-card-value">${this.escapeHtml(
                String(advanced.transcript || '').trim() || 'n/d'
              )}</div>
            </div>
            ${advancedScoresList
              .map(
                (item) => `
              <div class="free-ride-detail-card">
                <div class="free-ride-detail-card-label">${this.renderFreeRideUiLabelHtml(item.labelKey, {
                  altClass: 'is-mini'
                })}</div>
                <div class="free-ride-detail-card-value">${Math.round(item.value)}%</div>
              </div>`
              )
              .join('')}
          </div>
          ${
            selectedMeta
              ? `<div class="free-ride-detail-selected">
              <b>${this.renderFreeRideUiLabelHtml('selectedWord', { altClass: 'is-mini' })}</b>: ${this.escapeHtml(
                  selectedMeta.expected || 'n/d'
                )} · ${this.renderFreeRideUiLabelHtml('score', { altClass: 'is-mini' })} ${
                  typeof selectedMeta.score === 'number' ? `${Math.round(selectedMeta.score)}%` : 'n/d'
                } · ${this.renderAdvancedStatusLabelHtml(selectedMeta.status, { altClass: 'is-mini' })} · ${this.renderFreeRideUiLabelHtml(
                  'errorShort',
                  { altClass: 'is-mini' }
                )}: ${this.escapeHtml(selectedMeta.error_type || '—')}
            </div>`
              : ''
          }
          <div class="free-ride-detail-list">
            ${
              advancedWords.length
                ? advancedWords
                    .map((word, index) => {
                      const status = String(word && word.status ? word.status : '').trim().toLowerCase();
                      const tone =
                        status === 'ok'
                          ? 'ok'
                          : status === 'wrong' || status === 'missing' || status === 'issue'
                          ? 'warn'
                          : status === 'extra'
                          ? 'bad'
                          : 'neutral';
                      const phonemes = Array.isArray(word && word.phonemes) ? word.phonemes : [];
                      const displayablePhonemes = this.getAdvancedDisplayablePhonemes(word);
                      const phonemeInline = displayablePhonemes.length
                        ? displayablePhonemes
                            .slice()
                            .sort((a, b) => {
                              return a.score - b.score;
                            })
                            .slice(0, 4)
                            .map((phoneme) => {
                              const pv = phoneme && phoneme.phoneme ? String(phoneme.phoneme) : '?';
                              return `${pv}:${Math.round(phoneme.score)}%`;
                            })
                            .join(' · ')
                        : '';
                      return `
                    <div class="free-ride-detail-row is-${tone}">
                      <div class="free-ride-detail-row-index">${index + 1}</div>
                      <div class="free-ride-detail-row-main">
                        <div class="free-ride-detail-row-top">
                          <span class="free-ride-detail-badge is-${tone}">${this.renderAdvancedStatusLabelHtml(status, {
                            altClass: 'is-mini'
                          })}</span>
                          <span class="free-ride-detail-row-word"><b>${this.escapeHtml(
                            String(word && word.expected ? word.expected : word && word.text ? word.text : '—')
                          )}</b></span>
                          <span class="free-ride-detail-row-score">${
                            typeof word?.score === 'number' ? `${Math.round(word.score)}%` : 'n/d'
                          }</span>
                        </div>
                        <div class="free-ride-detail-row-meta">
                          ${this.renderFreeRideUiLabelHtml('recognizedShort', { altClass: 'is-mini' })}: ${this.escapeHtml(
                            String(word && word.recognized ? word.recognized : '—')
                          )}
                          · ${this.renderFreeRideUiLabelHtml('errorShort', { altClass: 'is-mini' })}: ${this.escapeHtml(
                            String(word && word.error_type ? word.error_type : '—')
                          )}
                          · ${this.formatDurationMsForDetail(
                            Number(word?.end_ms) - Number(word?.start_ms)
                          )}
                          ${
                            phonemes.length
                              ? phonemeInline
                                ? ` · ${this.renderFreeRideUiLabelHtml('phonemes', { altClass: 'is-mini' })}: ${this.escapeHtml(
                                    phonemeInline
                                  )}`
                                : ` · ${this.renderFreeRideUiLabelHtml('phonemes', { altClass: 'is-mini' })}: n/d`
                              : ''
                          }
                        </div>
                      </div>
                    </div>`;
                    })
                    .join('')
                : `<div class="free-ride-detail-empty">${this.renderFreeRideUiLabelHtml('noAdvancedWordDetail')}</div>`
            }
          </div>
          ${
            advanced.provider_payload
              ? `<details class="free-ride-detail-raw">
              <summary>${this.renderFreeRideUiLabelHtml('rawProviderPayloadDebug')}</summary>
              <pre>${this.escapeHtml(JSON.stringify(advanced.provider_payload, null, 2))}</pre>
            </details>`
              : ''
          }
        `
            : advanced && typeof advanced === 'object'
            ? `<div class="free-ride-detail-empty">${this.renderFreeRideUiLabelHtml('advancedErrorPrefix')}: ${this.escapeHtml(
                String(advanced.error_label || advanced.error || 'Error')
              )}${advanced.error_message ? ` · ${this.escapeHtml(String(advanced.error_message))}` : ''}</div>`
            : `<div class="free-ride-detail-empty">${this.renderFreeRideUiLabelHtml('noAdvancedDataYet')}</div>`
        }
      </section>
    `;

    return `
      <div class="free-ride-detail-modal-page">
        <div class="free-ride-detail-modal-head">
          <div>
            <div class="free-ride-detail-modal-title">${this.renderFreeRideUiLabelHtml('phraseDetails')}</div>
            <div class="free-ride-detail-modal-sub">${this.renderFreeRideUiLabelHtml('standardPlusAdvancedIfAvailable')}</div>
          </div>
          <button class="free-ride-detail-close" type="button" data-close-detail aria-label="Cerrar (Close)">
            <ion-icon name="close"></ion-icon>
          </button>
        </div>
        <div class="free-ride-detail-modal-body">
          ${standardSection}
          ${advancedSection}
        </div>
      </div>
    `;
  }

  async openPhraseDetailsModal() {
    if (!this.canOpenPhraseDetailsModal()) return;
    if (this._freeRideDetailsModal) {
      try {
        await this._freeRideDetailsModal.dismiss();
      } catch (err) {
        // no-op
      }
      this._freeRideDetailsModal = null;
    }

    const modal = document.createElement('ion-modal');
    modal.classList.add('free-ride-detail-modal');
    modal.backdropDismiss = true;
    modal.canDismiss = true;
    const presentingEl = document.querySelector('ion-router-outlet');
    if (presentingEl) {
      modal.presentingElement = presentingEl;
    }
    modal.innerHTML = `
      <ion-content class="free-ride-detail-modal-content" fullscreen="true">
        ${this.buildPhraseDetailsModalHtml()}
      </ion-content>
    `;
    document.body.appendChild(modal);
    this._freeRideDetailsModal = modal;

    modal.addEventListener(
      'didDismiss',
      () => {
        if (this._freeRideDetailsModal === modal) {
          this._freeRideDetailsModal = null;
        }
        if (modal.parentNode) {
          modal.parentNode.removeChild(modal);
        }
      },
      { once: true }
    );

    const closeBtn = modal.querySelector('[data-close-detail]');
    closeBtn?.addEventListener('click', () => {
      modal.dismiss().catch(() => {});
    });

    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    await modal.present();
  }

  async fetchAdvancedPronunciationAssessment(expectedText, recordingBlob) {
    const expected = String(expectedText || '').trim();
    if (!expected || !recordingBlob) return null;
    const endpoint = this.resolvePronunciationAssessEndpoint();
    if (!endpoint) return null;

    const prepared = await this.prepareAdvancedAssessmentAudio(recordingBlob);
    const preparedBlob = prepared && prepared.blob ? prepared.blob : recordingBlob;
    const audioBase64 = await this.blobToBase64(preparedBlob);
    const body = {
      expected_text: expected,
      locale: this.getPracticeSpeechLocale(),
      audio_base64: audioBase64,
      audio_content_type: preparedBlob.type || 'audio/wav',
      audio_duration_sec:
        prepared && typeof prepared.durationSeconds === 'number' ? prepared.durationSeconds : undefined
    };

    const user = window.user;
    if (user && user.id !== undefined && user.id !== null && String(user.id).trim()) {
      body.user_id = String(user.id).trim();
    }
    if (user && typeof user.name === 'string' && user.name.trim()) {
      body.user_name = user.name.trim();
    }
    if (this.isSpeakDebugEnabled()) {
      body.debug = 1;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.buildAlignedTtsHeaders(),
      body: JSON.stringify(body)
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch (err) {
      payload = null;
    }
    if (payload) {
      this.applyAdvancedAssessLimitStatusFromPayload(payload);
    }
    if (!response.ok) {
      const errorCode =
        payload && typeof payload.error === 'string' ? payload.error : `http_${response.status}`;
      const errorMessage =
        payload && typeof payload.message === 'string' ? payload.message : `HTTP ${response.status}`;
      return {
        ok: false,
        error: errorCode,
        error_message: errorMessage,
        error_label:
          errorCode === 'pronunciation_daily_seconds_limit'
            ? 'Límite diario'
            : errorCode === 'pronunciation_assess_not_configured'
            ? 'No configurado'
            : 'Error'
      };
    }
    if (!payload || payload.ok !== true) return null;
    return payload;
  }

  async runAdvancedAssessmentIfEnabled(recordingBlob, expectedText) {
    if (!recordingBlob || !(recordingBlob instanceof Blob)) return;
    if (this.getEffectiveFreeRideEvalMode() !== FREE_RIDE_EVAL_MODE_ADVANCED) return;
    const expected = String(expectedText || '').trim();
    if (!expected) return;

    const requestToken = ++this.advancedAssessRequestToken;
    this.setAdvancedAssessmentPending(true, { clearResult: true });

    try {
      const result = await this.fetchAdvancedPronunciationAssessment(expected, recordingBlob);
      if (requestToken !== this.advancedAssessRequestToken) return;
      if (!result) {
        this.setAdvancedAssessmentResult(
          { ok: false, error: 'empty_response', error_label: 'Sin respuesta' }
        );
        return;
      }
      this.setAdvancedAssessmentResult(result);
    } catch (err) {
      if (requestToken !== this.advancedAssessRequestToken) return;
      this.setAdvancedAssessmentResult({
        ok: false,
        error: 'exception',
        error_message: err && err.message ? err.message : String(err),
        error_label: 'Error'
      });
    }
  }

  toNumberOrFallback(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  buildTimedWordData(text, words) {
    const sourceText = String(text || '');
    if (!sourceText) return null;
    if (!Array.isArray(words) || !words.length) return null;

    const ranges = [];
    let searchCursor = 0;

    words.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      const tokenRaw = entry.text || entry.word || '';
      const token = String(tokenRaw || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!token) return;

      const startMs = Math.max(
        0,
        Math.round(this.toNumberOrFallback(entry.start_ms, this.toNumberOrFallback(entry.start, 0)))
      );
      const endMs = Math.max(
        startMs + 40,
        Math.round(
          this.toNumberOrFallback(
            entry.end_ms,
            this.toNumberOrFallback(entry.end, startMs + 260)
          )
        )
      );

      const escaped = this.escapeRegex(token).replace(/'/g, "['\\u2019\\u2018]");
      const regex = new RegExp(escaped, 'i');
      const remaining = sourceText.slice(searchCursor);
      const match = regex.exec(remaining);
      if (!match) return;

      const startChar = searchCursor + match.index;
      const endChar = startChar + match[0].length;
      ranges.push({ startChar, endChar, startMs, endMs });
      searchCursor = endChar;
    });

    if (!ranges.length) return null;

    const segments = [];
    const timeline = [];
    let cursor = 0;

    ranges.forEach((range, tokenIndex) => {
      const safeStart = Math.max(cursor, Math.min(sourceText.length, range.startChar));
      const safeEnd = Math.max(safeStart, Math.min(sourceText.length, range.endChar));
      if (safeStart > cursor) {
        segments.push({ type: 'plain', text: sourceText.slice(cursor, safeStart) });
      }
      const tokenText = sourceText.slice(safeStart, safeEnd);
      if (!tokenText) return;
      segments.push({ type: 'token', text: tokenText, tokenIndex });
      timeline[tokenIndex] = { startMs: range.startMs, endMs: range.endMs };
      cursor = safeEnd;
    });

    if (cursor < sourceText.length) {
      segments.push({ type: 'plain', text: sourceText.slice(cursor) });
    }

    const validTimeline = timeline.filter(Boolean);
    if (!validTimeline.length) return null;
    return { segments, timeline };
  }

  setPhraseTextPlain(text) {
    const phraseEl = this.querySelector('#free-ride-target');
    if (!phraseEl) return;
    phraseEl.classList.remove('is-word-timed');
    phraseEl.classList.remove('is-compare-diff');
    delete phraseEl.dataset.localSpeakingActive;
    delete phraseEl.dataset.localSpeakingText;
    phraseEl.textContent = String(text || '');
    this.advancedPhraseWordMeta = [];
    this.phraseHighlightTimeline = [];
    this.phraseHighlightTokenEls = [];
  }

  getActiveAdvancedAssessment() {
    if (this.getEffectiveFreeRideEvalMode() !== FREE_RIDE_EVAL_MODE_ADVANCED) return null;
    const result = this.state.advancedAssessment;
    if (!result || typeof result !== 'object' || result.ok !== true) return null;
    return result;
  }

  mapAdvancedWordStatusToPhraseTokenStatus(status) {
    const normalized = String(status || '')
      .trim()
      .toLowerCase();
    if (normalized === 'ok') return 'ok';
    if (normalized === 'wrong' || normalized === 'issue') return 'miss';
    if (normalized === 'missing') return 'miss';
    return '';
  }

  buildExpectedStatusesFromAdvancedAssessment(expectedText, assessment) {
    const source = String(expectedText || '');
    const tokenized = this.tokenizePhraseDisplayWords(source);
    const tokenCount = Array.isArray(tokenized.words) ? tokenized.words.length : 0;
    if (!tokenCount) return null;
    const words = assessment && Array.isArray(assessment.words) ? assessment.words : [];
    if (!words.length) return null;

    const statuses = new Array(tokenCount).fill('');
    const meta = new Array(tokenCount).fill(null);
    let tokenIndex = 0;

    words.forEach((entry) => {
      if (tokenIndex >= tokenCount) return;
      const rawStatus = String(entry && entry.status ? entry.status : '')
        .trim()
        .toLowerCase();
      if (!rawStatus) return;
      if (rawStatus === 'extra') {
        return;
      }
      const mapped = this.mapAdvancedWordStatusToPhraseTokenStatus(rawStatus);
      if (mapped) {
        statuses[tokenIndex] = mapped;
      }
      const expectedRaw =
        entry && typeof entry.expected === 'string' && entry.expected.trim()
          ? entry.expected.trim()
          : tokenized.words[tokenIndex] && tokenized.words[tokenIndex].raw
          ? tokenized.words[tokenIndex].raw
          : '';
      const recognizedRaw =
        entry && typeof entry.recognized === 'string' && entry.recognized.trim()
          ? entry.recognized.trim()
          : '';
      const scoreRaw = entry && typeof entry.score === 'number' && Number.isFinite(entry.score) ? entry.score : null;
      const errorTypeRaw =
        entry && typeof entry.error_type === 'string' && entry.error_type.trim()
          ? entry.error_type.trim()
          : '';
      meta[tokenIndex] = {
        phrase_word_index: tokenIndex,
        expected: expectedRaw,
        recognized: recognizedRaw,
        status: rawStatus || '',
        score: scoreRaw !== null ? Math.max(0, Math.min(100, Math.round(scoreRaw))) : null,
        error_type: errorTypeRaw,
        phonemes: Array.isArray(entry && entry.phonemes) ? entry.phonemes : []
      };
      tokenIndex += 1;
    });

    while (tokenIndex < tokenCount) {
      statuses[tokenIndex] = statuses[tokenIndex] || 'miss';
      meta[tokenIndex] = meta[tokenIndex] || {
        phrase_word_index: tokenIndex,
        expected:
          tokenized.words[tokenIndex] && tokenized.words[tokenIndex].raw
            ? tokenized.words[tokenIndex].raw
            : '',
        recognized: '',
        status: 'missing',
        score: null,
        error_type: 'Omission',
        phonemes: []
      };
      tokenIndex += 1;
    }

    if (!statuses.some(Boolean)) return null;
    return { statuses, meta };
  }

  setPhraseTextAdvancedAssessment(expectedText, assessment) {
    const phraseEl = this.querySelector('#free-ride-target');
    if (!phraseEl) return;

    const source = String(expectedText || '');
    const tokenized = this.tokenizePhraseDisplayWords(source);
    const mapping = this.buildExpectedStatusesFromAdvancedAssessment(source, assessment);
    const statuses = mapping && Array.isArray(mapping.statuses) ? mapping.statuses : null;

    if (!source || !tokenized.segments.length || !Array.isArray(statuses)) {
      this.setPhraseTextPlain(source);
      return;
    }

    phraseEl.classList.remove('is-word-timed');
    phraseEl.classList.add('is-compare-diff');
    delete phraseEl.dataset.localSpeakingActive;
    delete phraseEl.dataset.localSpeakingText;
    this.advancedPhraseWordMeta =
      mapping && Array.isArray(mapping.meta) ? mapping.meta : [];
    const selectedIndex = Number(this.advancedSelectedPhraseWordIndex);

    phraseEl.innerHTML = tokenized.segments
      .map((segment) => {
        if (!segment || segment.type !== 'word') {
          return this.escapeHtml(segment && segment.text ? segment.text : '');
        }
        const status = statuses[segment.wordIndex] === 'ok' ? 'ok' : 'miss';
        const hasMeta = Boolean(this.advancedPhraseWordMeta[segment.wordIndex]);
        const selectableClass = hasMeta ? ' is-advanced-selectable' : '';
        const selectedClass = selectedIndex === segment.wordIndex ? ' is-selected' : '';
        const attrs = hasMeta ? ` data-adv-phrase-word-index="${segment.wordIndex}"` : '';
        return `<span class="free-ride-diff-token is-${status}${selectableClass}${selectedClass}"${attrs}>${this.escapeHtml(
          segment.text || ''
        )}</span>`;
      })
      .join('');

    this.phraseHighlightTimeline = [];
    this.phraseHighlightTokenEls = [];
  }

  tokenizePhraseDisplayWords(text) {
    const source = String(text || '');
    const wordRegex = /[A-Za-z0-9\u00c0-\u024f]+/g;
    const segments = [];
    const words = [];
    let cursor = 0;
    let match;

    while ((match = wordRegex.exec(source))) {
      const start = match.index;
      const rawWord = match[0] || '';
      if (start > cursor) {
        segments.push({ type: 'plain', text: source.slice(cursor, start) });
      }
      const normalized = this.normalizeText(rawWord);
      const wordIndex = words.length;
      words.push({ raw: rawWord, normalized });
      segments.push({ type: 'word', text: rawWord, wordIndex });
      cursor = start + rawWord.length;
    }

    if (cursor < source.length) {
      segments.push({ type: 'plain', text: source.slice(cursor) });
    }

    return { segments, words };
  }

  getNormalizedWordList(value) {
    const normalized = this.normalizeText(value);
    return normalized ? normalized.split(' ') : [];
  }

  buildWordDiffComparison(expectedText, actualText) {
    const expectedWords = this.getNormalizedWordList(expectedText);
    const actualWords = this.getNormalizedWordList(actualText);
    if (!expectedWords.length || !actualWords.length) return null;

    const rows = expectedWords.length;
    const cols = actualWords.length;
    const costs = Array.from({ length: rows + 1 }, () => new Array(cols + 1).fill(0));
    const ops = Array.from({ length: rows + 1 }, () => new Array(cols + 1).fill(''));

    for (let i = 0; i <= rows; i += 1) {
      costs[i][0] = i;
      if (i > 0) ops[i][0] = 'delete';
    }
    for (let j = 0; j <= cols; j += 1) {
      costs[0][j] = j;
      if (j > 0) ops[0][j] = 'insert';
    }

    for (let i = 1; i <= rows; i += 1) {
      for (let j = 1; j <= cols; j += 1) {
        const same = expectedWords[i - 1] === actualWords[j - 1];
        const diagCost = costs[i - 1][j - 1] + (same ? 0 : 1);
        const delCost = costs[i - 1][j] + 1;
        const insCost = costs[i][j - 1] + 1;

        let bestCost = diagCost;
        let bestOp = same ? 'match' : 'replace';

        if (delCost < bestCost) {
          bestCost = delCost;
          bestOp = 'delete';
        }
        if (insCost < bestCost) {
          bestCost = insCost;
          bestOp = 'insert';
        }

        costs[i][j] = bestCost;
        ops[i][j] = bestOp;
      }
    }

    const expectedStatuses = new Array(rows).fill('missing');
    const actualStatuses = new Array(cols).fill('extra');
    let i = rows;
    let j = cols;

    while (i > 0 || j > 0) {
      const op = ops[i] && ops[i][j] ? ops[i][j] : '';
      if ((op === 'match' || op === 'replace') && i > 0 && j > 0) {
        const expectedStatus = op === 'match' ? 'ok' : 'wrong';
        const actualStatus = op === 'match' ? 'ok' : 'wrong';
        expectedStatuses[i - 1] = expectedStatus;
        actualStatuses[j - 1] = actualStatus;
        i -= 1;
        j -= 1;
        continue;
      }
      if (op === 'delete' && i > 0) {
        expectedStatuses[i - 1] = 'missing';
        i -= 1;
        continue;
      }
      if (op === 'insert' && j > 0) {
        actualStatuses[j - 1] = 'extra';
        j -= 1;
        continue;
      }
      // Fallback for unexpected ties/empty op.
      if (i > 0 && j > 0) {
        const same = expectedWords[i - 1] === actualWords[j - 1];
        expectedStatuses[i - 1] = same ? 'ok' : 'wrong';
        actualStatuses[j - 1] = same ? 'ok' : 'wrong';
        i -= 1;
        j -= 1;
      } else if (i > 0) {
        expectedStatuses[i - 1] = 'missing';
        i -= 1;
      } else {
        actualStatuses[j - 1] = 'extra';
        j -= 1;
      }
    }

    return { expectedStatuses, actualStatuses };
  }

  buildWordDiffDetailedComparison(expectedText, actualText) {
    const expectedWords = this.getNormalizedWordList(expectedText);
    const actualWords = this.getNormalizedWordList(actualText);

    const rows = expectedWords.length;
    const cols = actualWords.length;
    const costs = Array.from({ length: rows + 1 }, () => new Array(cols + 1).fill(0));
    const ops = Array.from({ length: rows + 1 }, () => new Array(cols + 1).fill(''));

    for (let i = 0; i <= rows; i += 1) {
      costs[i][0] = i;
      if (i > 0) ops[i][0] = 'delete';
    }
    for (let j = 0; j <= cols; j += 1) {
      costs[0][j] = j;
      if (j > 0) ops[0][j] = 'insert';
    }

    for (let i = 1; i <= rows; i += 1) {
      for (let j = 1; j <= cols; j += 1) {
        const same = expectedWords[i - 1] === actualWords[j - 1];
        const diagCost = costs[i - 1][j - 1] + (same ? 0 : 1);
        const delCost = costs[i - 1][j] + 1;
        const insCost = costs[i][j - 1] + 1;

        let bestCost = diagCost;
        let bestOp = same ? 'match' : 'replace';

        if (delCost < bestCost) {
          bestCost = delCost;
          bestOp = 'delete';
        }
        if (insCost < bestCost) {
          bestCost = insCost;
          bestOp = 'insert';
        }

        costs[i][j] = bestCost;
        ops[i][j] = bestOp;
      }
    }

    const expectedStatuses = new Array(rows).fill('missing');
    const actualStatuses = new Array(cols).fill('extra');
    const pairs = [];
    let i = rows;
    let j = cols;

    while (i > 0 || j > 0) {
      const op = ops[i] && ops[i][j] ? ops[i][j] : '';
      if ((op === 'match' || op === 'replace') && i > 0 && j > 0) {
        const expectedStatus = op === 'match' ? 'ok' : 'wrong';
        const actualStatus = op === 'match' ? 'ok' : 'wrong';
        expectedStatuses[i - 1] = expectedStatus;
        actualStatuses[j - 1] = actualStatus;
        pairs.push({
          kind: op === 'match' ? 'match' : 'replace',
          expected_word: expectedWords[i - 1] || '',
          actual_word: actualWords[j - 1] || '',
          expected_index: i - 1,
          actual_index: j - 1
        });
        i -= 1;
        j -= 1;
        continue;
      }
      if (op === 'delete' && i > 0) {
        expectedStatuses[i - 1] = 'missing';
        pairs.push({
          kind: 'missing',
          expected_word: expectedWords[i - 1] || '',
          actual_word: '',
          expected_index: i - 1,
          actual_index: null
        });
        i -= 1;
        continue;
      }
      if (op === 'insert' && j > 0) {
        actualStatuses[j - 1] = 'extra';
        pairs.push({
          kind: 'extra',
          expected_word: '',
          actual_word: actualWords[j - 1] || '',
          expected_index: null,
          actual_index: j - 1
        });
        j -= 1;
        continue;
      }
      if (i > 0 && j > 0) {
        const same = expectedWords[i - 1] === actualWords[j - 1];
        const expectedStatus = same ? 'ok' : 'wrong';
        const actualStatus = same ? 'ok' : 'wrong';
        expectedStatuses[i - 1] = expectedStatus;
        actualStatuses[j - 1] = actualStatus;
        pairs.push({
          kind: same ? 'match' : 'replace',
          expected_word: expectedWords[i - 1] || '',
          actual_word: actualWords[j - 1] || '',
          expected_index: i - 1,
          actual_index: j - 1
        });
        i -= 1;
        j -= 1;
      } else if (i > 0) {
        expectedStatuses[i - 1] = 'missing';
        pairs.push({
          kind: 'missing',
          expected_word: expectedWords[i - 1] || '',
          actual_word: '',
          expected_index: i - 1,
          actual_index: null
        });
        i -= 1;
      } else {
        actualStatuses[j - 1] = 'extra';
        pairs.push({
          kind: 'extra',
          expected_word: '',
          actual_word: actualWords[j - 1] || '',
          expected_index: null,
          actual_index: j - 1
        });
        j -= 1;
      }
    }

    const counts = {
      match: 0,
      replace: 0,
      missing: 0,
      extra: 0
    };
    pairs.forEach((entry) => {
      if (!entry || !entry.kind) return;
      if (Object.prototype.hasOwnProperty.call(counts, entry.kind)) {
        counts[entry.kind] += 1;
      }
    });

    return {
      expectedWords,
      actualWords,
      expectedStatuses,
      actualStatuses,
      pairs: pairs.reverse(),
      distance: costs[rows][cols],
      counts
    };
  }

  buildExpectedWordDiffStatuses(expectedText, actualText) {
    const comparison = this.buildWordDiffComparison(expectedText, actualText);
    return comparison && Array.isArray(comparison.expectedStatuses)
      ? comparison.expectedStatuses
      : null;
  }

  buildActualWordDiffStatuses(expectedText, actualText) {
    const comparison = this.buildWordDiffComparison(expectedText, actualText);
    return comparison && Array.isArray(comparison.actualStatuses)
      ? comparison.actualStatuses
      : null;
  }

  setPhraseTextCompared(expectedText, actualText) {
    const phraseEl = this.querySelector('#free-ride-target');
    if (!phraseEl) return;

    const source = String(expectedText || '');
    const transcript = String(actualText || '');
    const tokenized = this.tokenizePhraseDisplayWords(source);
    const statuses = this.buildExpectedWordDiffStatuses(source, transcript);

    if (!source || !tokenized.segments.length || !Array.isArray(statuses)) {
      this.setPhraseTextPlain(source);
      return;
    }

    phraseEl.classList.remove('is-word-timed');
    phraseEl.classList.add('is-compare-diff');
    delete phraseEl.dataset.localSpeakingActive;
    delete phraseEl.dataset.localSpeakingText;
    this.advancedPhraseWordMeta = [];

    phraseEl.innerHTML = tokenized.segments
      .map((segment) => {
        if (!segment || segment.type !== 'word') {
          return this.escapeHtml(segment && segment.text ? segment.text : '');
        }
        const status = statuses[segment.wordIndex] === 'ok' ? 'ok' : 'miss';
        return `<span class="free-ride-diff-token is-${status}">${this.escapeHtml(segment.text || '')}</span>`;
      })
      .join('');

    this.phraseHighlightTimeline = [];
    this.phraseHighlightTokenEls = [];
  }

  setTranscriptCompared(expectedText, actualText) {
    const transcriptEl = this.querySelector('#free-ride-transcript');
    if (!transcriptEl) return;

    const transcript = String(actualText || '').trim();
    if (!transcript) {
      transcriptEl.classList.remove('has-text', 'is-compare-diff');
      transcriptEl.textContent = ' ';
      return;
    }

    const tokenized = this.tokenizePhraseDisplayWords(transcript);
    const statuses = this.buildActualWordDiffStatuses(expectedText, transcript);
    transcriptEl.classList.add('has-text');

    if (!tokenized.segments.length || !Array.isArray(statuses)) {
      transcriptEl.classList.remove('is-compare-diff');
      transcriptEl.textContent = transcript;
      return;
    }

    transcriptEl.classList.add('is-compare-diff');
    transcriptEl.innerHTML = tokenized.segments
      .map((segment) => {
        if (!segment || segment.type !== 'word') {
          return this.escapeHtml(segment && segment.text ? segment.text : '');
        }
        const rawStatus = String(statuses[segment.wordIndex] || 'wrong');
        const status = rawStatus === 'ok' || rawStatus === 'extra' ? rawStatus : 'miss';
        return `<span class="free-ride-transcript-token is-${status}">${this.escapeHtml(segment.text || '')}</span>`;
      })
      .join('');
  }

  setPhraseTextTimed(text, timedData) {
    const phraseEl = this.querySelector('#free-ride-target');
    if (!phraseEl) return;
    const timed = timedData && Array.isArray(timedData.segments) ? timedData : null;
    if (!timed || !timed.segments.length) {
      this.setPhraseTextPlain(text);
      return;
    }

    phraseEl.classList.add('is-word-timed');
    phraseEl.classList.remove('is-compare-diff');
    phraseEl.innerHTML = '';
    this.advancedPhraseWordMeta = [];
    const tokenEls = [];

    timed.segments.forEach((segment) => {
      if (!segment || segment.type !== 'token') {
        phraseEl.appendChild(document.createTextNode(segment && segment.text ? segment.text : ''));
        return;
      }
      const tokenEl = document.createElement('span');
      tokenEl.className = 'free-ride-tts-token';
      tokenEl.textContent = segment.text || '';
      phraseEl.appendChild(tokenEl);
      tokenEls[segment.tokenIndex] = tokenEl;
    });

    this.phraseHighlightTokenEls = tokenEls;
    this.phraseHighlightTimeline = Array.isArray(timed.timeline) ? timed.timeline : [];
  }

  clearPhraseHighlightClasses() {
    this.phraseHighlightTokenEls.forEach((tokenEl) => {
      if (!tokenEl) return;
      tokenEl.classList.remove('is-active');
      tokenEl.classList.remove('is-past');
    });
  }

  stopPhraseHighlightLoop() {
    if (this.phraseHighlightRaf) {
      cancelAnimationFrame(this.phraseHighlightRaf);
      this.phraseHighlightRaf = null;
    }
    this.clearPhraseHighlightClasses();
  }

  setPhraseLocalSpeaking(isSpeaking) {
    const phraseEl = this.querySelector('#free-ride-target');
    if (!phraseEl) return;
    if (phraseEl.classList.contains('is-word-timed')) return;

    if (isSpeaking) {
      if (phraseEl.dataset.localSpeakingActive === '1') return;
      const rawText = String(phraseEl.textContent || '');
      phraseEl.dataset.localSpeakingActive = '1';
      phraseEl.dataset.localSpeakingText = rawText;
      phraseEl.innerHTML = `<span class="free-ride-local-speaking-pill">${this.escapeHtml(rawText)}</span>`;
      return;
    }

    if (phraseEl.dataset.localSpeakingActive === '1') {
      this.restorePhrasePreviewText();
    }
    delete phraseEl.dataset.localSpeakingActive;
    delete phraseEl.dataset.localSpeakingText;
  }

  updatePhraseHighlight(timeMs) {
    const timeline = this.phraseHighlightTimeline;
    const tokenEls = this.phraseHighlightTokenEls;
    if (!Array.isArray(timeline) || !timeline.length || !Array.isArray(tokenEls) || !tokenEls.length) {
      return;
    }

    const ms = Math.max(0, Number(timeMs) || 0);
    tokenEls.forEach((tokenEl, index) => {
      if (!tokenEl) return;
      const slot = timeline[index];
      if (!slot) {
        tokenEl.classList.remove('is-active');
        tokenEl.classList.remove('is-past');
        return;
      }
      const startMs = Math.max(0, this.toNumberOrFallback(slot.startMs, 0));
      const endMs = Math.max(startMs + 40, this.toNumberOrFallback(slot.endMs, startMs + 260));
      const isActive = ms >= startMs && ms <= endMs;
      const isPast = ms > endMs;
      tokenEl.classList.toggle('is-active', isActive);
      tokenEl.classList.toggle('is-past', !isActive && isPast);
    });
  }

  startPhraseHighlightLoop(audioEl, playbackToken) {
    this.stopPhraseHighlightLoop();
    if (!audioEl) return;
    const step = () => {
      if (!this.isConnected) return;
      if (playbackToken !== this.playbackRequestToken) return;
      if (!audioEl || audioEl.paused || audioEl.ended) return;
      this.updatePhraseHighlight(audioEl.currentTime * 1000);
      this.phraseHighlightRaf = requestAnimationFrame(step);
    };
    this.updatePhraseHighlight(0);
    this.phraseHighlightRaf = requestAnimationFrame(step);
  }

  restorePhrasePreviewText(copy = this.currentCopy) {
    const expected = this.getExpectedTextTrimmed();
    const transcript = String(this.state && this.state.transcript ? this.state.transcript : '').trim();
    const advanced = expected ? this.getActiveAdvancedAssessment() : null;
    if (expected && advanced) {
      this.setPhraseTextAdvancedAssessment(expected, advanced);
      return;
    }
    if (expected && transcript) {
      this.setPhraseTextCompared(expected, transcript);
      return;
    }
    const text = expected || (copy && copy.emptyPhrase ? copy.emptyPhrase : '');
    this.setPhraseTextPlain(text);
  }

  async playPhraseAligned(text, lang, playbackToken) {
    let payload = null;
    try {
      payload = await this.fetchAlignedTts(text, lang);
    } catch (err) {
      payload = null;
    }
    if (!payload || playbackToken !== this.playbackRequestToken) return false;

    const audioUrl = String(payload.audio_url || '').trim();
    if (!audioUrl) return false;

    const timedData = this.buildTimedWordData(text, payload.words);
    if (timedData && timedData.segments && timedData.segments.length) {
      this.setPhraseTextTimed(text, timedData);
    } else {
      this.setPhraseTextPlain(text);
    }

    const audio = new Audio(audioUrl);
    audio.preload = 'auto';
    this.activeAudio = audio;
    if (timedData) {
      this.startPhraseHighlightLoop(audio, playbackToken);
    }

    const finish = () => {
      if (this.activeAudio === audio) {
        this.activeAudio = null;
      }
      this.stopPhraseHighlightLoop();
      this.restorePhrasePreviewText();
      if (playbackToken === this.playbackRequestToken) {
        this.clearActivePlayButton();
      }
    };

    audio.onended = () => {
      finish();
    };
    audio.onerror = () => {
      finish();
    };

    try {
      await audio.play();
      if (playbackToken !== this.playbackRequestToken) {
        audio.pause();
        audio.currentTime = 0;
        return false;
      }
      return true;
    } catch (err) {
      finish();
      return false;
    }
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

  getFeedbackLabelKey(percent) {
    const value = typeof percent === 'number' ? percent : 0;
    if (value >= 85) return 'feedbackNative';
    if (value >= 70) return 'feedbackGood';
    if (value >= 60) return 'feedbackAlmost';
    return 'feedbackKeep';
  }

  getFeedbackState(copy = this.currentCopy) {
    if (this.state.isTranscribing) {
      return { tone: 'hint', label: copy.transcribing || 'Transcribing...', labelKey: 'transcribing', hasScore: false };
    }
    if (typeof this.state.percent !== 'number') {
      return { tone: 'hint', label: copy.feedbackHint || 'Practice the phrase', labelKey: 'feedbackHint', hasScore: false };
    }
    const percent = Math.max(0, Math.min(100, Math.round(this.state.percent)));
    const tone = this.getScoreTone(percent);
    const labelKey = this.getFeedbackLabelKey(percent);
    const label = this.getFeedbackLabel(percent, copy);
    return { tone, label, labelKey, percent, hasScore: true };
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

  async prepareAdvancedAssessmentAudio(blob) {
    const decoded = await this.decodeAudioBlob(blob);
    const resampled = await this.resampleAudioBuffer(decoded, FREE_RIDE_ADVANCED_AUDIO_SAMPLE_RATE);
    const buffer = resampled || decoded;
    if (!buffer) {
      throw new Error('No se pudo preparar el audio para evaluación avanzada');
    }
    const wavBlob = this.audioBufferToWav(buffer, FREE_RIDE_ADVANCED_AUDIO_SAMPLE_RATE);
    const durationSeconds = Number(Math.max(0, Number(buffer.duration) || 0).toFixed(3));
    return {
      blob: wavBlob,
      durationSeconds
    };
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
    this.advancedAssessRequestToken += 1;
    this.state.advancedAssessment = null;
    this.state.advancedAssessmentPending = false;
    this.advancedPhraseWordMeta = [];
    this.advancedSelectedPhraseWordIndex = -1;

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
    this.playbackRequestToken += 1;
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
    this.stopPhraseHighlightLoop();
    this.restorePhrasePreviewText();
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

  playPhraseWeb(text, lang, hooks = null) {
    if (!text || !this.canSpeak()) return false;
    const onStart = hooks && typeof hooks.onStart === 'function' ? hooks.onStart : null;
    const onEnd = hooks && typeof hooks.onEnd === 'function' ? hooks.onEnd : null;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang || this.getPracticeSpeechLocale();
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      if (onEnd) onEnd();
      this.clearActivePlayButton();
    };
    utter.onstart = () => {
      if (onStart) onStart();
    };
    utter.onend = () => settle();
    utter.onerror = () => settle();
    try {
      const started =
        typeof window.speakWebUtterance === 'function'
          ? window.speakWebUtterance(utter)
          : (() => {
              window.speechSynthesis.speak(utter);
              return true;
            })();
      if (!started) {
        settle();
        return false;
      }
      return true;
    } catch (err) {
      settle();
      return false;
    }
  }

  playPhrase(triggerBtn) {
    const text = this.getExpectedTextTrimmed();
    if (!text) return;
    // Prevent overlap with hero narration timers/playback that can hijack Web Speech on Chrome.
    const stopNarrationPromise = this.stopNarration().catch(() => {});
    if (triggerBtn && this.activePlayButton === triggerBtn) {
      this.stopPlayback();
      return;
    }
    this.stopPlayback();
    this.setActivePlayButton(triggerBtn || null);
    const lang = this.getPracticeSpeechLocale();
    const effectiveAudioMode = this.getEffectiveFreeRideAudioMode();
    const localMode = effectiveAudioMode === FREE_RIDE_AUDIO_MODE_LOCAL;
    const playbackToken = this.playbackRequestToken;
    const markLocalStart = () => {
      if (this.getEffectiveFreeRideAudioMode() !== FREE_RIDE_AUDIO_MODE_LOCAL) return;
      this.setPhraseLocalSpeaking(true);
    };
    const markLocalEnd = () => {
      if (this.getEffectiveFreeRideAudioMode() !== FREE_RIDE_AUDIO_MODE_LOCAL) return;
      this.setPhraseLocalSpeaking(false);
    };

    const fallback = () => {
      Promise.resolve(stopNarrationPromise)
        .catch(() => {})
        .then(() => {
          if (playbackToken !== this.playbackRequestToken) return;
      const plugin = this.getNativeTtsPlugin();
      if (plugin && typeof plugin.speak === 'function') {
        markLocalStart();
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
            if (playbackToken !== this.playbackRequestToken) return;
            markLocalEnd();
            this.clearActivePlayButton();
          })
          .catch(() => {
            if (playbackToken !== this.playbackRequestToken) return;
            markLocalEnd();
            const started = this.playPhraseWeb(
              text,
              lang,
              this.getEffectiveFreeRideAudioMode() === FREE_RIDE_AUDIO_MODE_LOCAL
                ? {
                    onStart: markLocalStart,
                    onEnd: markLocalEnd
                  }
                : null
            );
            if (!started) {
              markLocalEnd();
              this.clearActivePlayButton();
            }
          });
        return;
      }
      const started = this.playPhraseWeb(
        text,
        lang,
        this.getEffectiveFreeRideAudioMode() === FREE_RIDE_AUDIO_MODE_LOCAL
          ? {
              onStart: markLocalStart,
              onEnd: markLocalEnd
            }
          : null
      );
      if (!started) {
        markLocalEnd();
        this.clearActivePlayButton();
      }
        });
    };

    if (localMode) {
      fallback();
      return;
    }

    this.playPhraseAligned(text, lang, playbackToken)
      .then((started) => {
        if (started || playbackToken !== this.playbackRequestToken) return;
        fallback();
      })
      .catch(() => {
        if (playbackToken !== this.playbackRequestToken) return;
        fallback();
      });
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
    this.clearAdvancedAssessmentState({ skipRender: true });
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
            this.finalizeRecording(url, text, blob);
          })
          .catch(() => {
            this.finalizeRecording(url, '', blob);
          });
        return;
      }

      const finish = () => {
        const transcript = this.speechTranscript || this.speechInterim || '';
        this.finalizeRecording(url, transcript, blob);
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

  finalizeRecording(audioUrl, forcedTranscript, recordedBlob = null) {
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
    this.runAdvancedAssessmentIfEnabled(recordedBlob, expected);
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
    const copy = this.currentCopy || {};
    const hasExpected = this.hasExpectedText();
    const expected = this.escapeHtml(this.getExpectedTextTrimmed() || 'n/d');
    const transcript = this.escapeHtml((this.state.transcript || '').trim() || 'n/d');
    const toneMax = this.getToneMaxValues();
    const controlsDisabled = this.state.isRecording || this.state.isTranscribing;
    const controlsDisabledAttr = controlsDisabled ? 'disabled' : '';
    const recordControlDisabledAttr = (!hasExpected || this.state.isTranscribing) ? 'disabled' : '';
    const voiceControlDisabledAttr =
      (!this.state.recordingUrl || this.state.isRecording || this.state.isTranscribing) ? 'disabled' : '';
    const percentText =
      typeof this.state.percent === 'number' ? `${Math.max(0, Math.min(100, Math.round(this.state.percent)))}%` : 'n/d';
    const audioMode = this.getFreeRideAudioMode();
    const effectiveEvalMode = this.getEffectiveFreeRideEvalMode();
    const advancedFeatureEnabled = this.isAdvancedEvalFeatureEnabled();
    const advBlocked = this.isAdvancedAssessBlockedByLimit();
    const advSummary = this.escapeHtml(this.getAdvancedAssessmentSummaryText());
    const advTranscriptRaw =
      this.state.advancedAssessment &&
      this.state.advancedAssessment.ok === true &&
      typeof this.state.advancedAssessment.transcript === 'string'
        ? this.state.advancedAssessment.transcript.trim()
        : '';
    const advTranscript = this.escapeHtml(advTranscriptRaw || 'n/d');

    return `
      <div class="speak-voice-nav speak-voice-nav-debug">
        <div class="speak-debug speak-debug-inline free-ride-debug-inline">
          <div class="free-ride-debug-toolbar" aria-hidden="false">
            <div class="free-ride-debug-actions free-ride-debug-actions-top">
              <button
                class="free-ride-debug-mini-btn free-ride-debug-mini-btn-record"
                type="button"
                id="free-ride-debug-record"
                aria-pressed="${this.state.isRecording ? 'true' : 'false'}"
                ${recordControlDisabledAttr}
              >
                <ion-icon name="${this.state.isRecording ? 'stop-circle' : 'mic'}" aria-hidden="true"></ion-icon>
                <span id="free-ride-debug-record-label">${this.escapeHtml(
                  this.state.isRecording
                    ? copy.endLabel || 'End'
                    : copy.sayLabel || 'Say'
                )}</span>
              </button>
              <button
                class="free-ride-debug-mini-btn"
                type="button"
                id="free-ride-debug-voice"
                ${voiceControlDisabledAttr}
              >
                <ion-icon name="play-circle" aria-hidden="true"></ion-icon>
                <span>Voice</span>
              </button>
            </div>
          </div>
          <div class="speak-debug-row">
            <span class="speak-debug-label">Esperado</span>
            <span class="speak-debug-value">${expected}</span>
          </div>
          <div class="speak-debug-row">
            <span class="speak-debug-label">Transcrito</span>
            <span class="speak-debug-value">${transcript}</span>
          </div>
          <div class="speak-debug-row free-ride-debug-score-row">
            <span class="speak-debug-label">Score</span>
            <div class="free-ride-debug-score-tools">
              <span class="speak-debug-value free-ride-debug-score-value">${percentText}</span>
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
          </div>
          <div class="speak-debug-row">
            <span class="speak-debug-label">Audio</span>
            <div class="free-ride-debug-audio-toggle">
              <button
                class="free-ride-debug-audio-btn ${audioMode === FREE_RIDE_AUDIO_MODE_GENERATED ? 'is-active' : ''}"
                type="button"
                data-audio-mode="${FREE_RIDE_AUDIO_MODE_GENERATED}"
                aria-label="Usar audio generado con alineación"
                title="Audio generado (alineado)"
                aria-pressed="${audioMode === FREE_RIDE_AUDIO_MODE_GENERATED ? 'true' : 'false'}"
                ${controlsDisabledAttr}
              >Alineado</button>
              <button
                class="free-ride-debug-audio-btn ${audioMode === FREE_RIDE_AUDIO_MODE_LOCAL ? 'is-active' : ''}"
                type="button"
                data-audio-mode="${FREE_RIDE_AUDIO_MODE_LOCAL}"
                aria-label="Usar audio local sin alineación"
                title="Audio local"
                aria-pressed="${audioMode === FREE_RIDE_AUDIO_MODE_LOCAL ? 'true' : 'false'}"
                ${controlsDisabledAttr}
              >Local</button>
            </div>
          </div>
          ${
            advancedFeatureEnabled
              ? `<div class="speak-debug-row">
            <span class="speak-debug-label">Eval</span>
            <div class="free-ride-debug-audio-toggle">
              <button
                class="free-ride-debug-audio-btn ${effectiveEvalMode === FREE_RIDE_EVAL_MODE_STANDARD ? 'is-active' : ''}"
                type="button"
                data-eval-mode="${FREE_RIDE_EVAL_MODE_STANDARD}"
                aria-label="Evaluación estándar"
                title="Evaluación estándar (STT + comparación textual)"
                aria-pressed="${effectiveEvalMode === FREE_RIDE_EVAL_MODE_STANDARD ? 'true' : 'false'}"
                ${controlsDisabledAttr}
              >Standard</button>
              <button
                class="free-ride-debug-audio-btn ${effectiveEvalMode === FREE_RIDE_EVAL_MODE_ADVANCED ? 'is-active' : ''}"
                type="button"
                data-eval-mode="${FREE_RIDE_EVAL_MODE_ADVANCED}"
                aria-label="${advBlocked ? 'Evaluación avanzada bloqueada por límite diario' : 'Evaluación avanzada de pronunciación'}"
                title="${
                  !advancedFeatureEnabled
                    ? 'Evaluación avanzada desactivada en Diagnósticos'
                    : advBlocked
                    ? 'Evaluación avanzada bloqueada por límite diario'
                    : 'Evaluación avanzada (Azure Speech)'
                }"
                aria-pressed="${effectiveEvalMode === FREE_RIDE_EVAL_MODE_ADVANCED ? 'true' : 'false'}"
                ${(!advancedFeatureEnabled || controlsDisabled || advBlocked) ? 'disabled' : ''}
              >Advanced</button>
            </div>
          </div>
          <div class="speak-debug-row">
            <span class="speak-debug-label">Adv</span>
            <span class="speak-debug-value" title="${this.escapeHtml(
              advBlocked ? 'Límite diario de evaluación avanzada alcanzado' : ''
            )}">${advSummary}</span>
          </div>
          <div class="speak-debug-row">
            <span class="speak-debug-label">Adv txt</span>
            <span class="speak-debug-value">${advTranscript}</span>
          </div>`
              : ''
          }
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
          <span class="record-label" id="free-ride-record-label">${this.renderFreeRideCopyBilingualHtml('sayLabel', {
            fallbackEs: 'Habla',
            fallbackEn: 'Say',
            altClass: 'is-compact'
          })}</span>
        </button>
        <button class="speak-circle-btn" id="free-ride-voice" type="button">
          <ion-icon name="ear"></ion-icon>
          <span>${this.renderFreeRideCopyBilingualHtml('yourVoiceLabel', {
            fallbackEs: 'Tu voz',
            fallbackEn: 'Your voice',
            altClass: 'is-compact'
          })}</span>
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
    const debugRecordBtn = this.querySelector('#free-ride-debug-record');
    const debugRecordLabelEl = this.querySelector('#free-ride-debug-record-label');
    const debugVoiceBtn = this.querySelector('#free-ride-debug-voice');
    const inputEl = this.querySelector('#free-ride-input');
    const scoreLineEl = this.querySelector('#free-ride-score-line');
    const scoreValueEl = this.querySelector('#free-ride-score-value');
    const scoreTextEl = this.querySelector('#free-ride-score-text');
    const advancedSummaryEl = this.querySelector('#free-ride-advanced-summary');
    const advancedWordDetailEl = this.querySelector('#free-ride-advanced-word-detail');
    const rewardEl = this.querySelector('#free-ride-earned-reward');
    const transcriptEl = this.querySelector('#free-ride-transcript');
    const debugToggleBtn = this.querySelector('#free-ride-debug-toggle');
    const debugAudioModeButtons = Array.from(this.querySelectorAll('[data-audio-mode]'));
    const debugEvalModeButtons = Array.from(this.querySelectorAll('[data-eval-mode]'));

    const expected = this.getExpectedTextTrimmed();
    const hasText = Boolean(expected);

    if (phraseEl) {
      this.restorePhrasePreviewText(copy);
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
      const recordKey = this.state.isRecording ? 'endLabel' : 'sayLabel';
      recordLabelEl.innerHTML = this.renderFreeRideCopyBilingualHtml(recordKey, {
        fallbackEs: this.state.isRecording ? 'Fin' : 'Habla',
        fallbackEn: this.state.isRecording ? 'End' : 'Say',
        altClass: 'is-compact'
      });
    }
    if (voiceBtn) {
      voiceBtn.disabled = !this.state.recordingUrl || this.state.isRecording || this.state.isTranscribing;
    }
    if (debugRecordBtn) {
      debugRecordBtn.disabled = !hasText || this.state.isTranscribing;
      debugRecordBtn.classList.toggle('is-recording', this.state.isRecording);
      debugRecordBtn.setAttribute('aria-pressed', this.state.isRecording ? 'true' : 'false');
    }
    if (debugRecordLabelEl) {
      const recordKey = this.state.isRecording ? 'endLabel' : 'sayLabel';
      debugRecordLabelEl.innerHTML = this.renderFreeRideCopyBilingualHtml(recordKey, {
        fallbackEs: this.state.isRecording ? 'Fin' : 'Habla',
        fallbackEn: this.state.isRecording ? 'End' : 'Say',
        altClass: 'is-mini'
      });
    }
    if (debugVoiceBtn) {
      debugVoiceBtn.disabled = !this.state.recordingUrl || this.state.isRecording || this.state.isTranscribing;
    }
    if (inputEl) {
      inputEl.disabled = this.state.isRecording || this.state.isTranscribing;
    }

    const feedback = this.getFeedbackState(copy);
    const feedbackHtml = feedback.labelKey
      ? this.renderFreeRideCopyBilingualHtml(feedback.labelKey, { fallbackEs: feedback.label, fallbackEn: feedback.label })
      : this.escapeHtml(feedback.label || '');
    if (scoreLineEl && scoreValueEl && scoreTextEl) {
      if (feedback.hasScore) {
        scoreLineEl.className = `speak-score-line ${feedback.tone}`;
        scoreValueEl.textContent = `${feedback.percent}%`;
        scoreTextEl.innerHTML = feedbackHtml;
      } else {
        scoreLineEl.className = 'speak-score-line hint';
        scoreValueEl.textContent = '';
        scoreTextEl.innerHTML = feedbackHtml;
      }
    }
    if (advancedSummaryEl) {
      const advancedInfo = this.getAdvancedAssessmentDisplayInfo();
      advancedSummaryEl.hidden = !advancedInfo.visible;
      advancedSummaryEl.classList.remove('is-pending', 'is-warn', 'is-ok');
      if (advancedInfo.visible) {
        if (advancedInfo.tone === 'pending') advancedSummaryEl.classList.add('is-pending');
        else if (advancedInfo.tone === 'warn') advancedSummaryEl.classList.add('is-warn');
        else if (advancedInfo.tone === 'ok') advancedSummaryEl.classList.add('is-ok');
        advancedSummaryEl.innerHTML = advancedInfo.html || this.escapeHtml(advancedInfo.text || '');
      } else {
        advancedSummaryEl.innerHTML = '';
      }
    }
    if (advancedWordDetailEl) {
      const detail = this.getAdvancedSelectedWordDetailInfo();
      advancedWordDetailEl.hidden = !detail.visible;
      advancedWordDetailEl.classList.remove('is-pending', 'is-warn', 'is-ok', 'is-hint');
      if (detail.visible) {
        if (detail.tone === 'pending') advancedWordDetailEl.classList.add('is-pending');
        else if (detail.tone === 'warn') advancedWordDetailEl.classList.add('is-warn');
        else if (detail.tone === 'ok') advancedWordDetailEl.classList.add('is-ok');
        else advancedWordDetailEl.classList.add('is-hint');
        advancedWordDetailEl.innerHTML = detail.html || '';
      } else {
        advancedWordDetailEl.innerHTML = '';
      }
    }
    const detailTriggerEls = [scoreLineEl, advancedSummaryEl, advancedWordDetailEl, transcriptEl];
    const canOpenDetails = this.canOpenPhraseDetailsModal();
    detailTriggerEls.forEach((el) => {
      if (!el) return;
      el.classList.toggle('free-ride-detail-trigger', canOpenDetails);
      if (canOpenDetails) {
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
      } else {
        el.removeAttribute('role');
        el.removeAttribute('tabindex');
      }
    });
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
      if (transcript && expected) {
        this.setTranscriptCompared(expected, transcript);
      } else {
        transcriptEl.classList.remove('is-compare-diff');
        transcriptEl.classList.toggle('has-text', Boolean(transcript));
        transcriptEl.textContent = transcript || ' ';
      }
    }
    if (debugToggleBtn) {
      const active = this.isSpeakDebugEnabled() && this.debugPanelOpen;
      debugToggleBtn.classList.toggle('is-active', active);
      debugToggleBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
    if (debugAudioModeButtons.length) {
      const selectedAudioMode = this.getFreeRideAudioMode();
      const effectiveAudioMode = this.getEffectiveFreeRideAudioMode();
      const modeControlsDisabled = this.state.isRecording || this.state.isTranscribing;
      const generatedBlockedByLimit = this.isAlignedTtsBlockedByLimit();
      debugAudioModeButtons.forEach((button) => {
        const mode = String(button.dataset.audioMode || '');
        const isActive = mode === effectiveAudioMode;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        const disabledByLimit =
          generatedBlockedByLimit && mode === FREE_RIDE_AUDIO_MODE_GENERATED;
        button.disabled = modeControlsDisabled || disabledByLimit;
        if (mode === FREE_RIDE_AUDIO_MODE_GENERATED) {
          const title = generatedBlockedByLimit
            ? 'Audio generado bloqueado por limite diario TTS'
            : 'Audio generado (alineado)';
          button.title = title;
          button.setAttribute(
            'aria-label',
            generatedBlockedByLimit
              ? 'Audio generado bloqueado por limite diario TTS'
              : 'Usar audio generado con alineación'
          );
        } else if (mode === FREE_RIDE_AUDIO_MODE_LOCAL) {
          button.title =
            selectedAudioMode === FREE_RIDE_AUDIO_MODE_GENERATED && generatedBlockedByLimit
              ? 'Audio local (activo por limite diario TTS)'
              : 'Audio local';
        }
      });
    }
    if (debugEvalModeButtons.length) {
      const selectedEvalMode = this.getFreeRideEvalMode();
      const effectiveEvalMode = this.getEffectiveFreeRideEvalMode();
      const evalControlsDisabled = this.state.isRecording || this.state.isTranscribing;
      const advancedBlockedByLimit = this.isAdvancedAssessBlockedByLimit();
      debugEvalModeButtons.forEach((button) => {
        const mode = String(button.dataset.evalMode || '');
        const isActive = mode === effectiveEvalMode;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        const disabledByLimit =
          advancedBlockedByLimit && mode === FREE_RIDE_EVAL_MODE_ADVANCED;
        button.disabled = evalControlsDisabled || disabledByLimit;
        if (mode === FREE_RIDE_EVAL_MODE_ADVANCED) {
          const title = advancedBlockedByLimit
            ? 'Evaluación avanzada bloqueada por límite diario'
            : 'Evaluación avanzada (pronunciación)';
          button.title = title;
          button.setAttribute('aria-label', title);
        } else if (mode === FREE_RIDE_EVAL_MODE_STANDARD) {
          button.title =
            selectedEvalMode === FREE_RIDE_EVAL_MODE_ADVANCED && advancedBlockedByLimit
              ? 'Evaluación estándar (activa por límite diario)'
              : 'Evaluación estándar (STT + comparación textual)';
        }
      });
    }
  }

  bindUi(copy) {
    const inputEl = this.querySelector('#free-ride-input');
    const flagBtn = this.querySelector('#free-ride-toggle-language');
    const playBtn = this.querySelector('#free-ride-play');
    const recordBtn = this.querySelector('#free-ride-record');
    const voiceBtn = this.querySelector('#free-ride-voice');
    const debugRecordBtn = this.querySelector('#free-ride-debug-record');
    const debugVoiceBtn = this.querySelector('#free-ride-debug-voice');
    const debugToggleBtn = this.querySelector('#free-ride-debug-toggle');
    const debugToneButtons = Array.from(this.querySelectorAll('[data-debug-tone]'));
    const debugAudioModeButtons = Array.from(this.querySelectorAll('[data-audio-mode]'));
    const debugEvalModeButtons = Array.from(this.querySelectorAll('[data-eval-mode]'));
    const phraseTargetEl = this.querySelector('#free-ride-target');
    const scoreLineEl = this.querySelector('#free-ride-score-line');
    const advancedSummaryEl = this.querySelector('#free-ride-advanced-summary');
    const advancedWordDetailEl = this.querySelector('#free-ride-advanced-word-detail');
    const transcriptEl = this.querySelector('#free-ride-transcript');

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

    debugAudioModeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        if (this.state.isRecording || this.state.isTranscribing) return;
        const nextMode = button.dataset.audioMode || '';
        if (!nextMode) return;
        if (
          nextMode === FREE_RIDE_AUDIO_MODE_GENERATED &&
          this.isAlignedTtsBlockedByLimit()
        ) {
          this.updatePhrasePreview(copy);
          return;
        }
        this.stopPlayback();
        this.setFreeRideAudioMode(nextMode);
        this.updatePhrasePreview(copy);
      });
    });

    debugEvalModeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        if (this.state.isRecording || this.state.isTranscribing) return;
        const nextMode = button.dataset.evalMode || '';
        if (!nextMode) return;
        if (
          nextMode === FREE_RIDE_EVAL_MODE_ADVANCED &&
          this.isAdvancedAssessBlockedByLimit()
        ) {
          this.updatePhrasePreview(copy);
          return;
        }
        this.setFreeRideEvalMode(nextMode);
        this.updatePhrasePreview(copy);
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

    debugRecordBtn?.addEventListener('click', () => {
      if (this.state.isRecording) {
        this.stopRecording();
      } else {
        this.startRecording();
      }
    });

    voiceBtn?.addEventListener('click', () => {
      this.playRecording(voiceBtn);
    });

    debugVoiceBtn?.addEventListener('click', () => {
      this.playRecording(debugVoiceBtn);
    });

    phraseTargetEl?.addEventListener('click', (event) => {
      const target = event && event.target && typeof event.target.closest === 'function'
        ? event.target.closest('[data-adv-phrase-word-index]')
        : null;
      if (!target) return;
      const idx = Number(target.dataset.advPhraseWordIndex);
      if (!Number.isFinite(idx)) return;
      this.setAdvancedWordSelection(idx, { allowToggleOff: true });
    });

    const bindDetailsTrigger = (el) => {
      if (!el) return;
      const open = () => {
        if (!this.canOpenPhraseDetailsModal()) return;
        this.openPhraseDetailsModal().catch((err) => {
          console.error('[free-ride] error abriendo detalles', err);
        });
      };
      el.addEventListener('click', (event) => {
        const target = event && event.target;
        if (target && typeof target.closest === 'function' && target.closest('[data-adv-phrase-word-index]')) {
          return;
        }
        open();
      });
      el.addEventListener('keydown', (event) => {
        const key = event && event.key ? event.key : '';
        if (key !== 'Enter' && key !== ' ') return;
        event.preventDefault();
        open();
      });
    };

    [scoreLineEl, advancedSummaryEl, advancedWordDetailEl, transcriptEl].forEach(bindDetailsTrigger);

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
    const bilingualPlaceholder = this.getFreeRideCopyBilingualPlainText('inputPlaceholder', {
      fallbackEs: 'Ejemplo: I would like to order a coffee, please.',
      fallbackEn: 'Example: I would like to order a coffee, please.'
    });

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
            <h2 class="onboarding-intro-title free-ride-screen-title">${this.renderFreeRideCopyBilingualHtml('title', {
              fallbackEs: 'Práctica libre',
              fallbackEn: 'Free ride'
            })}</h2>
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
            <p class="onboarding-intro-bubble free-ride-hero-bubble journey-plan-bubble">${this.renderFreeRideCopyBilingualHtml('subtitle', {
              fallbackEs: copy.subtitle || '',
              fallbackEn: copy.subtitle || ''
            })}</p>
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
                <label class="free-ride-label" for="free-ride-input">${this.renderFreeRideCopyBilingualHtml('inputLabel', {
                  fallbackEs: 'Tu frase',
                  fallbackEn: 'Your phrase'
                })}</label>
                <textarea
                  id="free-ride-input"
                  class="free-ride-input"
                  rows="3"
                  placeholder="${this.escapeHtml(bilingualPlaceholder || copy.inputPlaceholder || '')}"
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
              <div class="free-ride-advanced-summary" id="free-ride-advanced-summary" hidden></div>
              <div class="free-ride-advanced-word-detail" id="free-ride-advanced-word-detail" hidden></div>
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
