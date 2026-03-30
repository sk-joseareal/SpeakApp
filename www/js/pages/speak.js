import {
  ensureTrainingData,
  getLocalizedContentField,
  getRoutes,
  getSelection,
  resolveSelection,
  setSelection
} from '../data/training-data.js';
import {
  getLocaleMeta,
  getNextLocaleCode,
  getSpeakCopy as getSpeakCopyBundle,
  getSpeakFeedbackLabelScale,
  getSpeakFeedbackPhrases,
  getSpeakSummaryLabelPrefix,
  getSpeakSummaryTitleTemplates as getSpeakSummaryTitleTemplatesCopy,
  resolveLocale as resolveCopyLocale
} from '../content/copy.js';
import { renderAppHeader } from '../components/app-header.js';
import { getAppLocale, setAppLocale } from '../state.js';
import { addNotification } from '../notifications-store.js';
import { goToHome } from '../nav.js';

class PageSpeak extends HTMLElement {
  connectedCallback() {
    this.classList.add('ion-page');
    const appLocale = resolveCopyLocale(getAppLocale() || 'en');
    this.innerHTML = `
      ${renderAppHeader({ title: '', rewardBadgesId: 'speak-reward-badges', locale: appLocale })}
      <ion-content fullscreen class="speak-content secret-content">
        <div class="speak-shell">
          <h2 class="speak-session-title secret-title" id="speak-session-title" hidden></h2>
          <section class="speak-hero-card onboarding-intro-card" id="speak-hero-card">
            <button
              class="speak-hero-debug-btn"
              id="speak-debug-toggle"
              type="button"
              aria-label="Toggle debug panel"
              aria-pressed="false"
              hidden
            >
              Debug
            </button>
            <span class="speak-hero-mascot-wrap" aria-hidden="true">
              <img
                class="onboarding-intro-cat speak-hero-cat"
                id="speak-hero-mascot"
                src="assets/mascot/mascota-boca-08.png"
                alt=""
                aria-hidden="true"
              >
            </span>
            <div class="speak-hero-body">
              <p class="onboarding-intro-bubble speak-hero-bubble hero-playable-bubble" id="speak-hero-hint-display"></p>
              <p class="speak-hero-step-title secret-title" id="speak-hero-step-title"></p>
            </div>
            <p class="secret-title" id="speak-hero-hint" aria-hidden="true"></p>
          </section>
          <div class="speak-sheet">
            <div class="speak-route-banner" id="speak-route-banner" aria-hidden="true"></div>
            <div class="speak-swipe-stage">
              <div class="speak-swipe-ghost" id="speak-ghost" aria-hidden="true"></div>
              <div id="speak-step" class="speak-swipe-active"></div>
            </div>
          </div>
        </div>
      </ion-content>
    `;

    const stepRoot = this.querySelector('#speak-step');
    const ghostRoot = this.querySelector('#speak-ghost');
    const swipeStage = this.querySelector('.speak-swipe-stage');
    const sessionTitleEl = this.querySelector('#speak-session-title');
    const headerTitleEl = this.querySelector('.app-toolbar-title');
    const heroHintDisplayEl = this.querySelector('#speak-hero-hint-display');
    const heroCardEl = this.querySelector('#speak-hero-card');
    const routeBannerEl = this.querySelector('#speak-route-banner');
    const heroStepTitleEl = this.querySelector('#speak-hero-step-title');
    const heroHintEl = this.querySelector('#speak-hero-hint');
    const heroFlagBtn = this.querySelector('.speak-hero-flag-btn');
    const heroFlagImgEl = heroFlagBtn
      ? heroFlagBtn.querySelector('.onboarding-intro-flag')
      : null;
    const debugToggleBtn = this.querySelector('#speak-debug-toggle');

    const AVATAR_BASE = 'assets/speak/avatar';
    const AVATAR_CHICA_BASE = 'assets/speak/avatar-chica';
    const MFA_BASE = 'assets/speak/mfa';
    const MFA_ITEMS_URL = `${MFA_BASE}/items.json`;
    const MFA_AUDIO_BASE = `${MFA_BASE}/audio`;
    const MFA_VISEME_BASE = `${MFA_BASE}/visemes`;
    const MFA_WORDS_BASE = `${MFA_BASE}/words`;
    const MFA_SYLLABLES_BASE = `${MFA_BASE}/syllables`;
    const AV_SYNC_DELAY = 0.06;
    const RECORDING_TIMESLICE = 500;
    const VOSK_SAMPLE_RATE_DEFAULT = 16000;
    const SWIPE_DRAG_THRESHOLD = 8;
    const SWIPE_COMMIT_RATIO = 0.25;
    const SWIPE_COMMIT_VELOCITY = 0.6;
    const SWIPE_EDGE_GUARD = 16;
    const SWIPE_VERTICAL_RATIO = 1.2;
    const DEBUG_PANEL_OPEN_KEY = 'appv5:speak-debug-panel-open';
    const SPEAK_SESSION_PERCENTAGES_VISIBLE_KEY = 'appv5:speak-session-percentages-visible';
    const SPEAK_PRONUNCIATION_AVATAR_MODE_KEY = 'appv5:speak-pronunciation-avatar-mode';
    const HOME_RETURN_REVEAL_KEY = 'appv5:home-return-reveal-target';
    const SPEAK_PRONUNCIATION_AVATAR_OLD = 'old';
    const SPEAK_PRONUNCIATION_AVATAR_NEW = 'new';
    const MODULE_TROPHY_REWARD_QTY = 1;
    const MODULE_TROPHY_REWARD_ICON = 'trophy';
    const MAX_ROUTE_BADGE_COUNT = 5;
    const HERO_MASCOT_FRAME_COUNT = 9;
    const HERO_MASCOT_REST_FRAME = HERO_MASCOT_FRAME_COUNT - 1;
    const HERO_MASCOT_FRAME_INTERVAL_MS = 150;
    const MIN_RECORDING_BLOB_BYTES = 128;
    const swipeSurface = this.querySelector('.speak-sheet');

    const stepOrder = ['sound', 'spelling', 'sentence'];
    let soundStep = null;
    let spellingStep = null;
    let sentenceStep = null;
    let focusKey = 'w';
    let sessionTitle = '';
    let currentSessionId = '';
    let currentSessionData = null;
    let showSummary = false;
    let summaryState = null;
    let lastSummaryAudioCue = '';
    let progressUpdatedThisRun = false;
    let debugPanelOpen = false;

    const DEFAULT_SCORES = {
      sound: 68,
      spelling: 60,
      sentence: 80
    };

    let stepIndex = 0;
    let selectedWord = '';
    let mediaRecorder = null;
    let recordingStepKey = null;
    let recordingStream = null;
    let recordedChunks = [];
    let speechRecognizer = null;
    let speechTranscript = '';
    let speechInterim = '';
    let speechFailed = false;
    let nativeSpeechActive = false;
    let nativeSpeechListeners = [];
    let activeAudio = null;
    let avatarAudio = null;
    let playbackAudio = null;
    let activePlayButton = null;
    let mfaItems = [];
    let mfaLookup = {};
    let mfaReady = false;
    let visemes = [];
    let animating = false;
    let currentViseme = 0;
    let syllableTimeline = [];
    let currentSyllable = 0;
    let activeSyllableIndex = -1;
    let lastVisemeKey = 'NEUTRAL';
    let mouthImgA = null;
    let mouthImgB = null;
    let activeMouth = null;
    let inactiveMouth = null;
    let currentPronunciationAvatarConfig = null;
    let rafId = null;
    let isRecording = false;
    let isTranscribing = false;
    let transcribingStepKey = null;
    let phoneticTextEl = null;
    let sentenceTextEl = null;
    let swipeStartX = 0;
    let swipeStartY = 0;
    let swipeStartTime = 0;
    let swipeActive = false;
    let swipeDragging = false;
    let swipeDirection = 0;
    let swipeWidth = 0;
    let swipeCurrentX = 0;
    let swipeAnimating = false;
    let heroCardLockedHeight = 0;
    let lastHeroNarratedStepKey = '';
    let heroNarrationToken = 0;
    let heroNarrationTimer = null;
    let heroMascotFrameIndex = HERO_MASCOT_REST_FRAME;
    let heroMascotFrameTimer = null;
    let heroMascotIsTalking = false;
    let heroNarrationInProgress = false;
    let heroRemoteAudioEl = null;
    let heroFirstRenderAt = 0;
    let hintLocaleOverride = '';
    let activeHintLocale = 'en';
    let avatarResizeObserver = null;

    const stepState = {
      sound: { recordingUrl: '', recordingBlob: null, transcript: '', percent: null },
      spelling: { recordingUrl: '', recordingBlob: null, transcript: '', percent: null },
      sentence: { recordingUrl: '', recordingBlob: null, transcript: '', percent: null }
    };

    const getSpeechRecognition = () => window.SpeechRecognition || window.webkitSpeechRecognition;
    const normalizePronunciationAvatarMode = (value) => {
      const normalized = String(value || '')
        .trim()
        .toLowerCase();
      return normalized === SPEAK_PRONUNCIATION_AVATAR_OLD
        ? SPEAK_PRONUNCIATION_AVATAR_OLD
        : SPEAK_PRONUNCIATION_AVATAR_NEW;
    };
    const getStoredPronunciationAvatarMode = () => {
      const globalValue =
        window.r34lp0w3r &&
        typeof window.r34lp0w3r.speakPronunciationAvatarMode === 'string'
          ? window.r34lp0w3r.speakPronunciationAvatarMode
          : '';
      if (globalValue) return normalizePronunciationAvatarMode(globalValue);
      try {
        return normalizePronunciationAvatarMode(
          localStorage.getItem(SPEAK_PRONUNCIATION_AVATAR_MODE_KEY)
        );
      } catch (err) {
        return SPEAK_PRONUNCIATION_AVATAR_OLD;
      }
    };
    const getPronunciationAvatarConfig = () => {
      const mode = getStoredPronunciationAvatarMode();
      if (mode === SPEAK_PRONUNCIATION_AVATAR_NEW) {
        return {
          mode,
          aspectRatio: 3 / 2,
          headSrc: `${AVATAR_CHICA_BASE}/chica-sin-boca.png`,
          wrapperClass: 'avatar-wrapper avatar-wrapper-wide',
          mouthBaseClass: 'speak-mouth speak-mouth-crop',
          mouthMap: {
            NEUTRAL: `${AVATAR_CHICA_BASE}/7-R.png`,
            A: `${AVATAR_CHICA_BASE}/1-AEI.png`,
            E: `${AVATAR_CHICA_BASE}/11-EE.png`,
            I: `${AVATAR_CHICA_BASE}/11-EE.png`,
            O: `${AVATAR_CHICA_BASE}/12-O.png`,
            U: `${AVATAR_CHICA_BASE}/6-U.png`,
            M: `${AVATAR_CHICA_BASE}/9-BMP.png`,
            F: `${AVATAR_CHICA_BASE}/2-FV.png`,
            TH: `${AVATAR_CHICA_BASE}/10-TH.png`
          }
        };
      }
      return {
        mode,
        aspectRatio: 1,
        headSrc: `${AVATAR_BASE}/avatar-head.png`,
        wrapperClass: 'avatar-wrapper',
        mouthBaseClass: 'speak-mouth',
        mouthMap: {
          NEUTRAL: `${AVATAR_BASE}/mouth-neutral.png`,
          A: `${AVATAR_BASE}/mouth-a.png`,
          E: `${AVATAR_BASE}/mouth-e.png`,
          I: `${AVATAR_BASE}/mouth-e.png`,
          O: `${AVATAR_BASE}/mouth-o.png`,
          U: `${AVATAR_BASE}/mouth-o.png`,
          M: `${AVATAR_BASE}/mouth-m.png`,
          F: `${AVATAR_BASE}/mouth-f.png`,
          TH: `${AVATAR_BASE}/mouth-th.png`
        }
      };
    };
    const getNativeTranscribePlugin = () =>
      window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins.P4w4Plugin : null;
    const getVoskSampleRate = () => {
      const config = window.r34lp0w3r && window.r34lp0w3r.voskSampleRate;
      const rate = Number(config);
      if (Number.isFinite(rate) && rate >= 8000 && rate <= 48000) {
        return Math.round(rate);
      }
      return VOSK_SAMPLE_RATE_DEFAULT;
    };
    const getVoskModelPath = () => {
      const config = window.r34lp0w3r && window.r34lp0w3r.voskModelPath;
      if (typeof config === 'string') {
        const trimmed = config.trim();
        if (trimmed) return trimmed;
      }
      return '';
    };
    const getFilesystemPlugin = () =>
      window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins.Filesystem : null;
    const isIOSPlatform = () => {
      const cap = window.Capacitor;
      if (!cap) return false;
      if (typeof cap.getPlatform === 'function') {
        return cap.getPlatform() === 'ios';
      }
      return false;
    };
    const isAndroidPlatform = () => {
      const cap = window.Capacitor;
      if (!cap) return false;
      if (typeof cap.getPlatform === 'function') {
        return cap.getPlatform() === 'android';
      }
      return false;
    };
    const canNativeFileTranscribe = () => {
      const plugin = getNativeTranscribePlugin();
      if (!plugin || typeof plugin.transcribeAudio !== 'function') return false;
      return isIOSPlatform() || isAndroidPlatform();
    };
    const isTranscribingStep = (key) =>
      isAndroidPlatform() && isTranscribing && transcribingStepKey === key;

    const getRecordMimeCandidates = () => {
      if (isIOSPlatform()) {
        return [
          'audio/mp4;codecs=mp4a.40.2',
          'audio/mp4',
          'audio/aac',
          'audio/webm;codecs=opus',
          'audio/webm'
        ];
      }
      return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'];
    };
    const getNativeSpeechPlugin = () =>
      window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins.SpeechRecognition : null;
    const isNativeSpeechSupported = () => {
      const cap = window.Capacitor;
      return !!(
        cap &&
        typeof cap.isNativePlatform === 'function' &&
        cap.isNativePlatform() &&
        getNativeSpeechPlugin()
      );
    };

    const extractNativeMatches = (payload) => {
      if (!payload) return [];
      if (Array.isArray(payload.matches)) return payload.matches;
      if (Array.isArray(payload.results)) return payload.results;
      if (Array.isArray(payload.value)) return payload.value;
      if (typeof payload === 'string') return [payload];
      return [];
    };

    const handleNativeSpeechResults = (payload, isFinal) => {
      const matches = extractNativeMatches(payload);
      if (!matches.length) return;
      const text = String(matches[0] || '').trim();
      if (!text) return;
      if (isFinal) {
        speechTranscript = text;
        speechInterim = '';
      } else {
        speechInterim = text;
      }
    };

    const clearNativeSpeechListeners = () => {
      nativeSpeechListeners.forEach((listener) => {
        try {
          if (listener && typeof listener.remove === 'function') {
            listener.remove();
          }
        } catch (err) {
          // no-op
        }
      });
      nativeSpeechListeners = [];
    };

    const isSpeechPermissionGranted = (status) => {
      if (!status) return false;
      if (typeof status === 'boolean') return status;
      if (typeof status.granted === 'boolean') return status.granted;
      if (typeof status.speechRecognition === 'string') {
        return status.speechRecognition === 'granted';
      }
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
    };

    const ensureNativeSpeechPermission = async (plugin) => {
      if (!plugin) return false;
      try {
        if (typeof plugin.checkPermissions === 'function') {
          const status = await plugin.checkPermissions();
          if (isSpeechPermissionGranted(status)) return true;
        } else if (typeof plugin.hasPermission === 'function') {
          const status = await plugin.hasPermission();
          if (isSpeechPermissionGranted(status)) return true;
        }
      } catch (err) {
        // no-op
      }
      try {
        if (typeof plugin.requestPermissions === 'function') {
          const status = await plugin.requestPermissions();
          return isSpeechPermissionGranted(status);
        }
        if (typeof plugin.requestPermission === 'function') {
          const status = await plugin.requestPermission();
          return isSpeechPermissionGranted(status);
        }
      } catch (err) {
        // no-op
      }
      return false;
    };

    const startNativeSpeechRecognition = async () => {
      const plugin = getNativeSpeechPlugin();
      if (!plugin) return false;
      resetSpeechState();
      nativeSpeechActive = true;
      const allowed = await ensureNativeSpeechPermission(plugin);
      if (!allowed) {
        speechFailed = true;
        nativeSpeechActive = false;
        return false;
      }
      if (typeof plugin.available === 'function') {
        const availability = await plugin.available();
        if (!availability || availability.available === false) {
          speechFailed = true;
          nativeSpeechActive = false;
          return false;
        }
      }
      clearNativeSpeechListeners();
      if (typeof plugin.addListener === 'function') {
        const add = (event, handler) => {
          try {
            nativeSpeechListeners.push(plugin.addListener(event, handler));
          } catch (err) {
            // no-op
          }
        };
        add('partialResults', (data) => handleNativeSpeechResults(data, false));
        add('partialResult', (data) => handleNativeSpeechResults(data, false));
        add('result', (data) => handleNativeSpeechResults(data, true));
        add('results', (data) => handleNativeSpeechResults(data, true));
        add('speechResults', (data) => handleNativeSpeechResults(data, true));
        add('error', () => {
          speechFailed = true;
        });
      }
      if (typeof plugin.start === 'function') {
        await plugin.start({
          language: 'en-US',
          maxResults: 1,
          partialResults: true,
          popup: false
        });
      }
      return true;
    };

    const stopNativeSpeechRecognition = async () => {
      const plugin = getNativeSpeechPlugin();
      if (!plugin || !nativeSpeechActive) return;
      try {
        if (typeof plugin.stop === 'function') {
          const result = await plugin.stop();
          handleNativeSpeechResults(result, true);
        }
      } catch (err) {
        speechFailed = true;
      }
      clearNativeSpeechListeners();
      nativeSpeechActive = false;
    };

    const canRecord = () =>
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      typeof MediaRecorder !== 'undefined';

    const canSpeak = () =>
      typeof window !== 'undefined' &&
      typeof window.speechSynthesis !== 'undefined' &&
      typeof window.SpeechSynthesisUtterance !== 'undefined';

    const getNativeTtsPlugin = () =>
      window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins.TextToSpeech : null;

    const waitMs = (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, Math.max(0, Number(ms) || 0));
      });

    const waitForDocumentVisible = (timeoutMs = 1600) => {
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
    };

    const waitForWebVoices = (timeoutMs = 1200) => {
      if (!canSpeak()) return Promise.resolve([]);
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
        const onVoicesChanged = () => finish();
        if (typeof synth.addEventListener === 'function') {
          synth.addEventListener('voiceschanged', onVoicesChanged, { once: true });
        } else {
          synth.onvoiceschanged = onVoicesChanged;
        }
        setTimeout(finish, Math.max(0, timeoutMs));
      });
    };

    const waitWebSpeechIdle = async (token, maxMs = 7000) => {
      if (!canSpeak()) return;
      const synth = window.speechSynthesis;
      const startedAt = Date.now();
      while (token === heroNarrationToken && Date.now() - startedAt < maxMs) {
        if (!synth.speaking && !synth.pending && !synth.paused) return;
        await waitMs(60);
      }
    };

    const waitForHeroNarrationIdle = async (maxMs = 2400) => {
      const startedAt = Date.now();
      while (heroNarrationInProgress && Date.now() - startedAt < Math.max(0, Number(maxMs) || 0)) {
        await waitMs(60);
      }
      return !heroNarrationInProgress;
    };

    const estimateHeroLinePlaybackMs = (lineText) => {
      const chars = String(lineText || '').trim().length;
      return Math.min(9500, Math.max(900, Math.round(chars * 72)));
    };

    const normalizeHeroMascotFrameIndex = (frameIndex) => {
      const value = Number(frameIndex);
      if (!Number.isFinite(value)) return HERO_MASCOT_REST_FRAME;
      const rounded = Math.round(value);
      return Math.min(Math.max(rounded, 0), HERO_MASCOT_FRAME_COUNT - 1);
    };

    const getHeroMascotFramePath = (frameIndex = HERO_MASCOT_REST_FRAME) => {
      const normalized = normalizeHeroMascotFrameIndex(frameIndex);
      const padded = String(normalized).padStart(2, '0');
      return `assets/mascot/mascota-boca-${padded}.png`;
    };

    const getHeroMascotImageEl = () => this.querySelector('#speak-hero-mascot');

    const setHeroBubbleSpeaking = (isSpeaking) => {
      if (!heroHintEl) return;
      heroHintEl.classList.toggle('is-speaking', Boolean(isSpeaking));
    };

    const renderHeroMascotFrame = (frameIndex) => {
      const normalized = normalizeHeroMascotFrameIndex(frameIndex);
      heroMascotFrameIndex = normalized;
      const imgEl = getHeroMascotImageEl();
      if (!imgEl) return;
      const nextSrc = getHeroMascotFramePath(normalized);
      if (imgEl.getAttribute('src') !== nextSrc) {
        imgEl.setAttribute('src', nextSrc);
      }
    };

    const startHeroMascotTalk = () => {
      if (heroMascotIsTalking) return;
      heroMascotIsTalking = true;
      setHeroBubbleSpeaking(true);
      if (heroMascotFrameTimer) {
        clearInterval(heroMascotFrameTimer);
        heroMascotFrameTimer = null;
      }
      let frame = 0;
      renderHeroMascotFrame(frame);
      heroMascotFrameTimer = setInterval(() => {
        if (!heroMascotIsTalking) return;
        frame = (frame + 1) % (HERO_MASCOT_FRAME_COUNT - 1);
        renderHeroMascotFrame(frame);
      }, HERO_MASCOT_FRAME_INTERVAL_MS);
    };

    const stopHeroMascotTalk = (options = {}) => {
      const settle = options.settle !== false;
      heroMascotIsTalking = false;
      setHeroBubbleSpeaking(false);
      if (heroMascotFrameTimer) {
        clearInterval(heroMascotFrameTimer);
        heroMascotFrameTimer = null;
      }
      if (settle) {
        renderHeroMascotFrame(HERO_MASCOT_REST_FRAME);
      }
    };

    const clearHeroNarrationTimer = () => {
      if (!heroNarrationTimer) return;
      clearTimeout(heroNarrationTimer);
      heroNarrationTimer = null;
    };

    const extractHeroSpeechText = (value) =>
      String(value || '')
        .replace(/<\s*br\s*\/?>/gi, '\n')
        .split(/\r?\n+/)
        .map((part) => String(part || '').trim())
        .filter(Boolean)
        .join(' ');

    const extractHeroNarrationLines = (value) => {
      const raw = String(value || '');
      if (!raw.trim()) return [];
      const normalized = raw
        .replace(/<\s*br\s*\/?>/gi, '\n')
        .replace(/<\/p>\s*<p>/gi, '\n')
        .replace(/<\/li>\s*<li>/gi, '\n');
      const lines = normalized
        .split(/\r?\n+/)
        .map((part) => {
          const text = extractHeroSpeechText(part);
          return text ? { text } : null;
        })
        .filter(Boolean);
      if (lines.length) return lines;
      const fallback = extractHeroSpeechText(raw);
      return fallback ? [{ text: fallback }] : [];
    };

    const measureHeroHintMaxHeight = (lines) => {
      if (!heroHintEl || !Array.isArray(lines) || lines.length < 2) return 0;
      const width =
        Math.ceil(
          heroHintEl.getBoundingClientRect().width || heroHintEl.clientWidth || heroHintEl.offsetWidth || 0
        ) || 0;
      if (!width) return 0;
      const probe = document.createElement('div');
      probe.className = heroHintEl.className;
      probe.setAttribute('aria-hidden', 'true');
      probe.style.position = 'absolute';
      probe.style.visibility = 'hidden';
      probe.style.pointerEvents = 'none';
      probe.style.left = '-99999px';
      probe.style.top = '0';
      probe.style.width = `${width}px`;
      probe.style.minHeight = '0';
      probe.style.height = 'auto';
      const parent = heroHintEl.parentElement || heroCardEl || this;
      parent.appendChild(probe);
      let maxHeight = 0;
      lines.forEach((line) => {
        probe.textContent = line && line.text ? String(line.text).trim() : '';
        const nextHeight = Math.ceil(
          Math.max(probe.scrollHeight || 0, probe.getBoundingClientRect().height || 0)
        );
        if (nextHeight > maxHeight) maxHeight = nextHeight;
      });
      probe.remove();
      return maxHeight;
    };

    const stopHeroRemoteAudio = () => {
      if (!heroRemoteAudioEl) return;
      try {
        heroRemoteAudioEl.pause();
      } catch (err) {
        // no-op
      }
      heroRemoteAudioEl.src = '';
      heroRemoteAudioEl = null;
    };

    const normalizeSpeechComparable = (value) =>
      extractHeroSpeechText(value)
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

    const resolveHeroRemoteAudioEntry = (source, locale, lineNumber, lineText) => {
      if (!source || typeof source !== 'object') return null;
      const ttsMap = source.tts && typeof source.tts === 'object' ? source.tts : {};
      if (!Object.keys(ttsMap).length) return null;
      const normalizedLocale = normalizeHintLocale(locale) || 'en';
      const localeCandidates =
        normalizedLocale === 'es'
          ? ['es', 'es-ES', 'es_es', 'es-es']
          : ['en', 'en-US', 'en_us', 'en-us'];
      let localeNode = null;
      for (let i = 0; i < localeCandidates.length; i += 1) {
        const key = localeCandidates[i];
        if (ttsMap[key] && typeof ttsMap[key] === 'object') {
          localeNode = ttsMap[key];
          break;
        }
      }
      if (!localeNode) return null;
      const lineKey = Number(lineNumber) === 2 ? 'line2' : 'line1';
      const rawEntry = localeNode[lineKey] || localeNode[String(Number(lineNumber) === 2 ? 2 : 1)];
      if (!rawEntry || typeof rawEntry !== 'object') return null;
      const audioUrl = String(rawEntry.audio_url || rawEntry.audioUrl || '').trim();
      if (!audioUrl) return null;
      const expectedText = normalizeSpeechComparable(lineText);
      const entryText = normalizeSpeechComparable(rawEntry.text || '');
      if (entryText && expectedText && entryText !== expectedText) return null;
      return {
        text: String(rawEntry.text || lineText || ''),
        audio_url: audioUrl,
        words_url: String(rawEntry.words_url || rawEntry.wordsUrl || '').trim(),
        duration_ms: Number(rawEntry.duration_ms || rawEntry.durationMs || 0) || 0,
        hash: String(rawEntry.hash || '').trim(),
        voice: String(rawEntry.voice || '').trim(),
        engine: String(rawEntry.engine || '').trim()
      };
    };

    const playHeroRemoteAudioLine = async (entry, token) => {
      const audioUrl = entry && typeof entry.audio_url === 'string' ? entry.audio_url.trim() : '';
      if (!audioUrl) return false;
      if (token !== heroNarrationToken) return false;
      await waitForDocumentVisible(1800);
      if (token !== heroNarrationToken) return false;

      return new Promise((resolve) => {
        let settled = false;
        let started = false;
        let audio = null;
        const text = entry && entry.text ? String(entry.text) : '';
        const expectedMs = Number(entry && entry.duration_ms ? entry.duration_ms : 0);
        const maxMs = Math.min(
          18000,
          Math.max(2600, (Number.isFinite(expectedMs) && expectedMs > 0
            ? expectedMs + 1800
            : estimateHeroLinePlaybackMs(text) + 2600))
        );
        const startTimer = setTimeout(() => {
          if (!started) finish(false);
        }, 2200);
        const safetyTimer = setTimeout(() => finish(started), maxMs);

        const cleanup = () => {
          clearTimeout(startTimer);
          clearTimeout(safetyTimer);
          if (audio) {
            audio.removeEventListener('playing', onPlaying);
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('error', onError);
            audio.removeEventListener('pause', onPause);
          }
          if (heroRemoteAudioEl === audio) {
            heroRemoteAudioEl = null;
          }
        };

        const finish = (ok) => {
          if (settled) return;
          settled = true;
          cleanup();
          if (token === heroNarrationToken) {
            stopHeroMascotTalk({ settle: true });
          }
          resolve(Boolean(ok));
        };

        const onPlaying = () => {
          if (token !== heroNarrationToken) {
            finish(false);
            return;
          }
          started = true;
          startHeroMascotTalk();
        };
        const onEnded = () => finish(started || true);
        const onError = () => finish(false);
        const onPause = () => {
          if (audio.ended) return;
          finish(started);
        };

        try {
          audio = new Audio(audioUrl);
        } catch (err) {
          finish(false);
          return;
        }
        heroRemoteAudioEl = audio;
        audio.preload = 'auto';
        audio.addEventListener('playing', onPlaying);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('error', onError);
        audio.addEventListener('pause', onPause);

        let playPromise = null;
        try {
          playPromise = audio.play();
        } catch (err) {
          finish(false);
          return;
        }
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise.catch(() => {
            finish(false);
          });
        }
      });
    };

    const stopHeroNarrationPlayback = async () => {
      stopHeroRemoteAudio();
      const plugin = getNativeTtsPlugin();
      if (plugin && typeof plugin.stop === 'function') {
        try {
          await plugin.stop();
        } catch (err) {
          // no-op
        }
      }
      if (canSpeak()) {
        if (typeof window.cancelWebSpeech === 'function') {
          window.cancelWebSpeech();
        } else {
          window.speechSynthesis.cancel();
        }
      }
      stopHeroMascotTalk({ settle: true });
    };

    const stopHeroNarration = async () => {
      clearHeroNarrationTimer();
      heroNarrationToken += 1;
      if (heroHintEl && heroHintEl.dataset) {
        delete heroHintEl.dataset.narrationToken;
      }
      await stopHeroNarrationPlayback();
    };

    const speakHeroLineWebWithRetry = async (lineText, token, locale = 'en') => {
      if (!canSpeak()) return false;
      await waitForDocumentVisible(1800);
      if (token !== heroNarrationToken) return false;
      await waitForWebVoices(1500);
      if (token !== heroNarrationToken) return false;

      const run = async () => {
        const utter = new SpeechSynthesisUtterance(lineText);
        utter.lang = getHintSpeechLocale(locale);
        return new Promise((resolve) => {
          let settled = false;
          const settle = (started) => {
            if (settled) return;
            settled = true;
            clearTimeout(startTimeout);
            resolve(started);
          };
          const startTimeout = setTimeout(() => settle(false), 1800);
          utter.onstart = () => {
            if (token !== heroNarrationToken) return;
            startHeroMascotTalk();
            settle(true);
          };
          utter.onend = () => {
            if (token !== heroNarrationToken) return;
            stopHeroMascotTalk({ settle: true });
          };
          utter.onerror = () => {
            if (token !== heroNarrationToken) return;
            stopHeroMascotTalk({ settle: true });
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
              stopHeroMascotTalk({ settle: true });
              settle(false);
            }
          } catch (err) {
            stopHeroMascotTalk({ settle: true });
            settle(false);
          }
        });
      };

      let started = await run();
      if (started && token === heroNarrationToken) {
        const maxWait = Math.min(11000, estimateHeroLinePlaybackMs(lineText) + 2400);
        await waitWebSpeechIdle(token, maxWait);
      }
      if (started || token !== heroNarrationToken) return started;

      await waitMs(450);
      if (token !== heroNarrationToken) return false;
      await stopHeroNarrationPlayback();
      if (token !== heroNarrationToken) return false;
      started = await run();
      if (started && token === heroNarrationToken) {
        const maxWait = Math.min(12000, estimateHeroLinePlaybackMs(lineText) + 3000);
        await waitWebSpeechIdle(token, maxWait);
      }
      return started;
    };

    const speakHeroNarrationFromSource = async (source, options = {}) => {
      if (heroNarrationInProgress) {
        await waitForHeroNarrationIdle(2600);
        if (heroNarrationInProgress) return false;
      }
      const locale = normalizeHintLocale(options.locale) || activeHintLocale || getHintUiLocale();
      const speakCopy = getSpeakCopyBundle(locale);
      const hint = (speakCopy && speakCopy.heroNarration) || "Let's keep practicing!";
      const lines = extractHeroNarrationLines(hint);
      if (!lines.length || !heroHintEl || showSummary) {
        await stopHeroNarration().catch(() => {});
        return false;
      }

      const token = ++heroNarrationToken;
      const hasMultipleLines = lines.length > 1;
      const restLineText = String(lines[0] && lines[0].text ? lines[0].text : '').trim();
      const originalHintText = hint;
      const originalHintMinHeight = heroHintEl.style.minHeight;
      const plugin = getNativeTtsPlugin();

      await stopHeroNarrationPlayback();
      if (token !== heroNarrationToken) return false;

      heroHintEl.dataset.narrationToken = String(token);
      if (restLineText) {
        heroHintEl.textContent = restLineText;
      }
      if (hasMultipleLines) {
        const maxHeight = measureHeroHintMaxHeight(lines);
        if (maxHeight > 0) {
          heroHintEl.style.minHeight = `${maxHeight}px`;
        }
      } else {
        heroHintEl.style.minHeight = originalHintMinHeight;
      }
      const renderLine = (lineText) => {
        if (!hasMultipleLines) return;
        if (heroHintEl.dataset.narrationToken !== String(token)) return;
        heroHintEl.textContent = lineText;
      };
      const restoreHint = () => {
        if (heroHintEl.dataset.narrationToken !== String(token)) return;
        heroHintEl.textContent = restLineText || originalHintText;
        if (!hasMultipleLines) {
          heroHintEl.style.minHeight = originalHintMinHeight;
        }
        delete heroHintEl.dataset.narrationToken;
      };

      let startedAny = false;
      heroNarrationInProgress = true;
      try {
        for (let index = 0; index < lines.length; index += 1) {
          if (token !== heroNarrationToken) return startedAny;
          const lineText = String(lines[index].text || '').trim();
          if (!lineText) continue;
          renderLine(lineText);

          let started = false;
          const remoteEntry = resolveHeroRemoteAudioEntry(source, locale, index + 1, lineText);
          if (remoteEntry && token === heroNarrationToken) {
            started = await playHeroRemoteAudioLine(remoteEntry, token);
          }
          if (!started && plugin && typeof plugin.speak === 'function') {
            startHeroMascotTalk();
            const startedAt = Date.now();
            try {
              await plugin.speak({
                text: lineText,
                lang: getHintSpeechLocale(locale),
                rate: 1.0,
                pitch: 1.0,
                volume: 1.0,
                category: 'ambient',
                queueStrategy: 1
              });
              const minMs = estimateHeroLinePlaybackMs(lineText);
              const elapsed = Date.now() - startedAt;
              if (elapsed < minMs && token === heroNarrationToken) {
                await waitMs(minMs - elapsed);
              }
              started = true;
            } catch (err) {
              started = false;
            } finally {
              if (token === heroNarrationToken) {
                stopHeroMascotTalk({ settle: true });
              }
            }
          }
          if (!started && token === heroNarrationToken) {
            started = await speakHeroLineWebWithRetry(lineText, token, locale);
          }
          startedAny = startedAny || started;

          if (index < lines.length - 1 && token === heroNarrationToken) {
            await waitMs(130);
          }
        }
        return startedAny;
      } finally {
        heroNarrationInProgress = false;
        if (token === heroNarrationToken) {
          stopHeroMascotTalk({ settle: true });
        }
        restoreHint();
      }
    };

    const scheduleHeroNarration = (source, delayMs = 90, options = {}) => {
      clearHeroNarrationTimer();
      const locale = normalizeHintLocale(options.locale) || activeHintLocale || getHintUiLocale();
      const hint = resolveHeroHintText(source, locale);
      if (!hint || showSummary) return;

      const scheduleStart = Date.now();
      const run = async () => {
        heroNarrationTimer = null;
        if (!this.isConnected || showSummary) return;
        if (heroNarrationInProgress) {
          if (Date.now() - scheduleStart < 2600) {
            heroNarrationTimer = setTimeout(run, 120);
          }
          return;
        }
        const started = await speakHeroNarrationFromSource(source, { locale }).catch(() => false);
        if (!started && this.isConnected && !showSummary && Date.now() - scheduleStart < 2600) {
          heroNarrationTimer = setTimeout(run, 160);
        }
      };

      heroNarrationTimer = setTimeout(run, Math.max(0, Number(delayMs) || 0));
    };

    const normalizeText = (value) =>
      String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const CONTRACTION_EXPANSIONS = {
      "i'm": 'i am',
      "i'd": 'i would',
      "i'll": 'i will',
      "i've": 'i have',
      "you're": 'you are',
      "you'd": 'you would',
      "you'll": 'you will',
      "you've": 'you have',
      "we're": 'we are',
      "we'd": 'we would',
      "we'll": 'we will',
      "we've": 'we have',
      "they're": 'they are',
      "they'd": 'they would',
      "they'll": 'they will',
      "they've": 'they have',
      "it's": 'it is',
      "that's": 'that is',
      "can't": 'cannot',
      "won't": 'will not',
      "don't": 'do not',
      "isn't": 'is not',
      "aren't": 'are not',
      "wasn't": 'was not',
      "weren't": 'were not'
    };

    const CONTRACTION_MERGES = Object.entries(CONTRACTION_EXPANSIONS)
      .map(([contraction, expanded]) => ({
        contraction,
        expandedTokens: expanded.split(' ')
      }))
      .sort((a, b) => b.expandedTokens.length - a.expandedTokens.length);

    const normalizeMfaKey = (value) =>
      String(value || '')
        .toLowerCase()
        .replace(/[\u2019\u2018]/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[.,!?]+$/g, '')
        .trim();

    const escapeHtml = (value) =>
      String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const levenshtein = (a, b) => {
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
    };

    const scoreSimilarity = (expected, actual) => {
      const normalizedExpected = normalizeText(expected);
      const normalizedActual = normalizeText(actual);
      if (!normalizedExpected || !normalizedActual) return 0;
      const distance = levenshtein(normalizedExpected, normalizedActual);
      const maxLen = Math.max(normalizedExpected.length, normalizedActual.length);
      const ratio = maxLen === 0 ? 1 : 1 - distance / maxLen;
      return Math.max(0, Math.min(100, Math.round(ratio * 100)));
    };

    const DEFAULT_TONE_SCALE = [
      { min: 80, tone: 'good' },
      { min: 60, tone: 'okay' },
      { min: 0, tone: 'bad' }
    ];

    const getDefaultTonePhrases = (locale = getHintUiLocale()) => {
      const tonePhrases = getSpeakFeedbackPhrases(locale);
      return {
        good: Array.isArray(tonePhrases.good) ? tonePhrases.good.slice() : [],
        okay: Array.isArray(tonePhrases.okay) ? tonePhrases.okay.slice() : [],
        bad: Array.isArray(tonePhrases.bad) ? tonePhrases.bad.slice() : []
      };
    };

    const getDefaultLabelScale = (locale = getHintUiLocale()) =>
      getSpeakFeedbackLabelScale(locale).map((item) => ({ ...item }));

    const getDefaultSummaryTitleTemplates = (locale = getHintUiLocale()) => {
      const templates = getSpeakSummaryTitleTemplatesCopy(locale);
      return {
        good: Array.isArray(templates.good) ? templates.good.slice() : [],
        okay: Array.isArray(templates.okay) ? templates.okay.slice() : [],
        bad: Array.isArray(templates.bad) ? templates.bad.slice() : []
      };
    };

    const getDefaultSummaryPhrases = (locale = getHintUiLocale()) => {
      const tonePhrases = getSpeakFeedbackPhrases(locale);
      return {
        good: Array.isArray(tonePhrases.good) ? tonePhrases.good.slice() : [],
        okay: Array.isArray(tonePhrases.okay) ? tonePhrases.okay.slice() : [],
        bad: Array.isArray(tonePhrases.bad) ? tonePhrases.bad.slice() : []
      };
    };

    const blobToBase64 = (blob) =>
      new Promise((resolve, reject) => {
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

    const decodeAudioBlob = async (blob) => {
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
    };

    const resampleAudioBuffer = async (audioBuffer, targetRate) => {
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
    };

    const writeWavString = (view, offset, value) => {
      for (let i = 0; i < value.length; i += 1) {
        view.setUint8(offset + i, value.charCodeAt(i));
      }
    };

    const audioBufferToWav = (audioBuffer, sampleRate) => {
      const numChannels = 1;
      const channelData = audioBuffer.getChannelData(0);
      const bytesPerSample = 2;
      const blockAlign = numChannels * bytesPerSample;
      const dataSize = channelData.length * bytesPerSample;
      const buffer = new ArrayBuffer(44 + dataSize);
      const view = new DataView(buffer);
      writeWavString(view, 0, 'RIFF');
      view.setUint32(4, 36 + dataSize, true);
      writeWavString(view, 8, 'WAVE');
      writeWavString(view, 12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, numChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * blockAlign, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, 16, true);
      writeWavString(view, 36, 'data');
      view.setUint32(40, dataSize, true);
      let offset = 44;
      for (let i = 0; i < channelData.length; i += 1) {
        let sample = channelData[i];
        sample = Math.max(-1, Math.min(1, sample));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
      return new Blob([view], { type: 'audio/wav' });
    };

    const prepareTranscriptionBlob = async (blob, targetRate) => {
      if (!isAndroidPlatform()) return blob;
      const decoded = await decodeAudioBlob(blob);
      const rate = targetRate || getVoskSampleRate();
      const resampled = await resampleAudioBuffer(decoded, rate);
      const buffer = resampled || decoded;
      if (!buffer || buffer.sampleRate !== rate) {
        throw new Error(`No se pudo remuestrear audio a ${rate} Hz`);
      }
      return audioBufferToWav(buffer, rate);
    };

    const getAudioExtension = (mimeType) => {
      const type = String(mimeType || '').toLowerCase();
      if (type.includes('mp4') || type.includes('aac') || type.includes('m4a')) return 'm4a';
      if (type.includes('wav')) return 'wav';
      if (type.includes('ogg')) return 'ogg';
      if (type.includes('webm')) return 'webm';
      return 'm4a';
    };

    const writeBlobForTranscription = async (blob, prefix) => {
      const fs = getFilesystemPlugin();
      if (!fs) return null;
      const ext = getAudioExtension(blob.type);
      const dir = 'CACHE';
      const folder = 'speech';
      const filename = `${prefix}-${Date.now()}.${ext}`;
      try {
        await fs.mkdir({ path: folder, directory: dir, recursive: true });
      } catch (err) {
        // ignore
      }
      const data = await blobToBase64(blob);
      const path = `${folder}/${filename}`;
      const result = await fs.writeFile({ path, data, directory: dir });
      return { uri: result && result.uri ? result.uri : '', path, directory: dir };
    };

    const transcribeNativeAudioBlob = async (blob) => {
      const plugin = getNativeTranscribePlugin();
      if (!plugin || !canNativeFileTranscribe()) return '';
      const sampleRate = getVoskSampleRate();
      let stored = null;
      try {
        const prepared = await prepareTranscriptionBlob(blob, sampleRate);
        stored = await writeBlobForTranscription(prepared, 'speak');
        if (!stored || !stored.uri) {
          speechFailed = true;
          return '';
        }
        const modelPath = getVoskModelPath();
        const payload = {
          path: stored.uri,
          language: 'en-US',
          sampleRate
        };
        if (modelPath) payload.modelPath = modelPath;
        const result = await plugin.transcribeAudio(payload);
        return result && typeof result.text === 'string' ? result.text : '';
      } catch (err) {
        speechFailed = true;
        return '';
      } finally {
        try {
          const fs = getFilesystemPlugin();
          if (fs && stored && stored.path) {
            await fs.deleteFile({ path: stored.path, directory: stored.directory });
          }
        } catch (err) {
          // no-op
        }
      }
    };

    const resolveToneListMap = (source, fallback) => {
      const tones = ['good', 'okay', 'bad'];
      const safeSource = source && typeof source === 'object' ? source : {};
      const safeFallback = fallback && typeof fallback === 'object' ? fallback : {};
      const output = {};
      tones.forEach((tone) => {
        const fromSource = Array.isArray(safeSource[tone])
          ? safeSource[tone].map((item) => String(item || '').trim()).filter(Boolean)
          : [];
        const fromFallback = Array.isArray(safeFallback[tone])
          ? safeFallback[tone].map((item) => String(item || '').trim()).filter(Boolean)
          : [];
        output[tone] = fromSource.length ? fromSource : fromFallback;
      });
      return output;
    };

    const getSpeakUiCopy = (locale = getHintUiLocale()) => {
      const normalized = normalizeHintLocale(locale) || 'en';
      return getSpeakCopyBundle(normalized) || getSpeakCopyBundle('en') || {};
    };

    const getSpeakUiText = (key, locale = getHintUiLocale(), fallback = '') => {
      const copy = getSpeakUiCopy(locale);
      const value = copy && Object.prototype.hasOwnProperty.call(copy, key) ? copy[key] : '';
      if (typeof value === 'string' && value.trim()) return value;
      return fallback;
    };

    const resolveLocaleConfigBlock = (value, locale) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
      const normalized = normalizeHintLocale(locale) || 'en';
      const scoped = value[normalized];
      if (scoped && typeof scoped === 'object' && !Array.isArray(scoped)) return scoped;
      return value;
    };

    const resolveLabelScaleFromConfig = (config, locale) => {
      if (!config || typeof config !== 'object') return null;
      const normalized = normalizeHintLocale(locale) || 'en';
      if (
        config.labelScaleByLocale &&
        typeof config.labelScaleByLocale === 'object' &&
        Array.isArray(config.labelScaleByLocale[normalized])
      ) {
        return config.labelScaleByLocale[normalized];
      }
      if (
        config.labelScale_i18n &&
        typeof config.labelScale_i18n === 'object' &&
        Array.isArray(config.labelScale_i18n[normalized])
      ) {
        return config.labelScale_i18n[normalized];
      }
      if (Array.isArray(config.labelScale) && normalized === 'en') {
        return config.labelScale;
      }
      return null;
    };

    const resolveTonePhrasesFromConfig = (config, locale) => {
      if (!config || typeof config !== 'object') return null;
      return (
        resolveLocaleConfigBlock(config.tonePhrasesByLocale, locale) ||
        resolveLocaleConfigBlock(config.labelPhrasesByLocale, locale) ||
        resolveLocaleConfigBlock(config.tonePhrases_i18n, locale) ||
        resolveLocaleConfigBlock(config.tonePhrases, locale)
      );
    };

    const getFeedbackConfig = (locale = getHintUiLocale()) => {
      const config = window.r34lp0w3r && window.r34lp0w3r.speakFeedback;
      const toneScale =
        config && Array.isArray(config.toneScale) ? config.toneScale : DEFAULT_TONE_SCALE;
      const fallbackTonePhrases = getDefaultTonePhrases(locale);
      const labelScaleFromConfig = resolveLabelScaleFromConfig(config, locale);
      const labelScale = Array.isArray(labelScaleFromConfig) ? labelScaleFromConfig : getDefaultLabelScale(locale);
      const configuredTonePhrases = resolveTonePhrasesFromConfig(config, locale);
      const tonePhrases = resolveToneListMap(
        configuredTonePhrases,
        deriveTonePhrasesFromLabelScale(labelScale, toneScale, fallbackTonePhrases)
      );
      return { toneScale, tonePhrases };
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

    const deriveTonePhrasesFromLabelScale = (labelScale, toneScale, fallbackTonePhrases) => {
      const normalizedLabels = normalizeScale(labelScale, 'label');
      const normalizedTones = normalizeScale(toneScale, 'tone');
      const derived = {};
      normalizedTones.forEach((entry, index) => {
        const previous = normalizedTones[index - 1];
        const max = index === 0 ? Number.POSITIVE_INFINITY : previous.min - 1;
        derived[entry.tone] = normalizedLabels
          .filter((item) => item.min >= entry.min && item.min <= max)
          .map((item) => item.label);
      });
      return resolveToneListMap(derived, fallbackTonePhrases);
    };

    const pickStableTonePhrase = (items, seed, fallback = '') => {
      const list = Array.isArray(items)
        ? items.map((item) => String(item || '').trim()).filter(Boolean)
        : [];
      if (!list.length) return fallback;
      const base = String(seed || list.join('|'));
      let hash = 0;
      for (let idx = 0; idx < base.length; idx += 1) {
        hash = (hash * 31 + base.charCodeAt(idx)) >>> 0;
      }
      return list[hash % list.length];
    };

    const getSummaryConfig = (locale = getHintUiLocale()) => {
      const config = window.speakSummaryConfig || {};
      const { tonePhrases } = getFeedbackConfig(locale);
      const fallbackPhrases = resolveToneListMap(tonePhrases, getDefaultSummaryPhrases(locale));
      const configuredPhrases = resolveLocaleConfigBlock(config.phrases, locale);
      const phrases = resolveToneListMap(configuredPhrases, fallbackPhrases);
      let labelPrefix = '';
      if (typeof config.labelPrefix === 'string' && config.labelPrefix.trim()) {
        labelPrefix = config.labelPrefix.trim();
      } else if (config.labelPrefix && typeof config.labelPrefix === 'object') {
        const normalized = normalizeHintLocale(locale) || 'en';
        const localized = String(
          config.labelPrefix[normalized] || config.labelPrefix.en || config.labelPrefix.es || ''
        ).trim();
        if (localized) labelPrefix = localized;
      }
      if (!labelPrefix) {
        labelPrefix = getSpeakSummaryLabelPrefix(locale);
      }
      return {
        phrases,
        labelPrefix
      };
    };

    const getSummaryTitleTemplates = (locale = getHintUiLocale()) => {
      const fallback = getDefaultSummaryTitleTemplates(locale);
      const templates = window.r34lp0w3r && window.r34lp0w3r.speakSummaryTitles;
      const configured = resolveLocaleConfigBlock(templates, locale);
      return resolveToneListMap(configured, fallback);
    };

    const formatSummaryTitle = (template, sessionName) => {
      const base = String(template || '');
      const withSession = base.replace(/\{\{\s*session\s*\}\}/g, sessionName || '');
      const trimmed = withSession.replace(/\s+/g, ' ').trim();
      if (trimmed) return trimmed;
      return sessionName ? sessionName : '';
    };

    const getSummaryTitle = (tone, sessionName, locale = getHintUiLocale()) => {
      const templates = getSummaryTitleTemplates(locale);
      const list = templates && Array.isArray(templates[tone]) ? templates[tone] : [];
      const fallbackTemplates = getDefaultSummaryTitleTemplates(locale);
      const fallbackList =
        tone === 'good'
          ? fallbackTemplates.good
          : tone === 'okay'
          ? fallbackTemplates.okay
          : fallbackTemplates.bad;
      const template = pickRandom(list) || pickRandom(fallbackList) || '{{session}}';
      return formatSummaryTitle(template, sessionName);
    };

    const clampPercent = (value) => Math.max(0, Math.min(100, value));

    const pickRandom = (items) => {
      if (!items || !items.length) return '';
      const idx = Math.floor(Math.random() * items.length);
      return items[idx];
    };

    const rollSummaryOutcome = (locale = getHintUiLocale()) => {
      const { phrases, labelPrefix } = getSummaryConfig(locale);
      const percent = clampPercent(getSessionPercent());
      const tone = getScoreTone(percent, locale);
      const phraseList = phrases && phrases[tone] ? phrases[tone] : [];
      const phraseFallback = getScoreLabel(percent, locale, `summary:${currentSessionId}:${percent}`);
      const phrase = pickRandom(phraseList) || phraseFallback;
      const canGrantReward = progressUpdatedThisRun === true || isSpeakDebugEnabled();
      const reward =
        tone === 'good' && canGrantReward ? awardTrophyForCurrentModuleIfEligible(locale) : null;
      const awardedBadge =
        tone === 'good' && canGrantReward ? awardBadgeForCurrentRouteIfEligible() : null;
      progressUpdatedThisRun = false;
      return {
        percent,
        tone,
        phrase,
        rewardQty: reward ? reward.rewardQty : 0,
        rewardLabel: reward ? reward.rewardLabel : '',
        rewardIcon: reward ? reward.rewardIcon : 'diamond',
        labelPrefix,
        awardedBadge
      };
    };

    const localizeExistingSummaryState = (state, locale = getHintUiLocale()) => {
      if (!state || typeof state !== 'object') return state;
      const { phrases, labelPrefix } = getSummaryConfig(locale);
      const tone = String(state.tone || '').toLowerCase().trim();
      const phraseList = phrases && Array.isArray(phrases[tone]) ? phrases[tone] : [];
      const percent =
        typeof state.percent === 'number' && Number.isFinite(state.percent) ? state.percent : 0;
      const phrase = pickRandom(phraseList) || getScoreLabel(percent, locale, `summary:${tone}:${percent}`);
      return {
        ...state,
        phrase,
        labelPrefix
      };
    };

    const playSummaryToneSound = (summary) => {
      if (!summary || typeof summary !== 'object') return;
      const tone = String(summary.tone || '').toLowerCase().trim();
      const soundKey = tone === 'good' ? 'green' : tone === 'okay' ? 'yellow' : tone === 'bad' ? 'red' : '';
      if (!soundKey) return;
      const cueKey = `${currentSessionId}:${tone}:${Math.round(Number(summary.percent) || 0)}`;
      if (cueKey === lastSummaryAudioCue) return;
      lastSummaryAudioCue = cueKey;
      if (typeof window.playSpeakUiSound === 'function') {
        window.playSpeakUiSound(soundKey, { minGapMs: 150, forceRestart: true }).catch(() => {});
      }
    };

    const isSpeakDebugEnabled = () => {
      if (window.r34lp0w3r && typeof window.r34lp0w3r.speakDebug === 'boolean') {
        return window.r34lp0w3r.speakDebug;
      }
      try {
        return localStorage.getItem('appv5:speak-debug') === '1';
      } catch (err) {
        return false;
      }
    };

    const shouldReplayOwnedSpeakAwardsInDebug = () => isSpeakDebugEnabled();

    const areSpeakSessionPercentagesVisible = () => {
      const globalValue =
        window.r34lp0w3r &&
        Object.prototype.hasOwnProperty.call(window.r34lp0w3r, 'speakSessionPercentagesVisible')
          ? window.r34lp0w3r.speakSessionPercentagesVisible
          : undefined;
      if (typeof globalValue === 'boolean') return globalValue;
      if (typeof globalValue === 'string') {
        const normalized = globalValue.trim().toLowerCase();
        if (!normalized) return true;
        return !['0', 'false', 'off'].includes(normalized);
      }
      try {
        const raw = localStorage.getItem(SPEAK_SESSION_PERCENTAGES_VISIBLE_KEY);
        if (raw === null || raw === undefined || raw === '') return true;
        return !['0', 'false', 'off'].includes(String(raw).trim().toLowerCase());
      } catch (err) {
        return true;
      }
    };

    const readPersistedDebugPanelOpen = () => {
      try {
        return localStorage.getItem(DEBUG_PANEL_OPEN_KEY) === '1';
      } catch (err) {
        return false;
      }
    };

    const persistDebugPanelOpen = (value) => {
      try {
        localStorage.setItem(DEBUG_PANEL_OPEN_KEY, value ? '1' : '0');
      } catch (err) {
        // no-op
      }
    };

    debugPanelOpen = readPersistedDebugPanelOpen();

    const getWordScoreStore = () => {
      if (!window.r34lp0w3r) window.r34lp0w3r = {};
      if (!window.r34lp0w3r.speakWordScores) window.r34lp0w3r.speakWordScores = {};
      return window.r34lp0w3r.speakWordScores;
    };

    const getPhraseScoreStore = () => {
      if (!window.r34lp0w3r) window.r34lp0w3r = {};
      if (!window.r34lp0w3r.speakPhraseScores) window.r34lp0w3r.speakPhraseScores = {};
      return window.r34lp0w3r.speakPhraseScores;
    };

    const getSessionRewardStore = () => {
      if (!window.r34lp0w3r) window.r34lp0w3r = {};
      if (!window.r34lp0w3r.speakSessionRewards) window.r34lp0w3r.speakSessionRewards = {};
      return window.r34lp0w3r.speakSessionRewards;
    };

    const persistSpeakStores = () => {
      if (typeof window.persistSpeakStores === 'function') {
        window.persistSpeakStores();
      } else {
        try {
          localStorage.setItem(
            'appv5:speak-word-scores',
            JSON.stringify(window.r34lp0w3r && window.r34lp0w3r.speakWordScores ? window.r34lp0w3r.speakWordScores : {})
          );
          localStorage.setItem(
            'appv5:speak-phrase-scores',
            JSON.stringify(window.r34lp0w3r && window.r34lp0w3r.speakPhraseScores ? window.r34lp0w3r.speakPhraseScores : {})
          );
          localStorage.setItem(
            'appv5:speak-session-rewards',
            JSON.stringify(window.r34lp0w3r && window.r34lp0w3r.speakSessionRewards ? window.r34lp0w3r.speakSessionRewards : {})
          );
          localStorage.setItem(
            'appv5:speak-badges',
            JSON.stringify(window.r34lp0w3r && window.r34lp0w3r.speakBadges ? window.r34lp0w3r.speakBadges : {})
          );
        } catch (err) {
          console.error('[speak] error guardando stores', err);
        }
      }
      if (typeof window.notifySpeakStoresChange === 'function') {
        window.notifySpeakStoresChange();
      } else {
        window.dispatchEvent(new CustomEvent('app:speak-stores-change'));
      }
    };

    const getSessionWordScores = (sessionId) => {
      const store = getWordScoreStore();
      if (!sessionId) return null;
      if (!store[sessionId]) store[sessionId] = {};
      return store[sessionId];
    };

    const getStoredWordResult = (sessionId, word) => {
      if (!sessionId || !word) return null;
      const sessionScores = getSessionWordScores(sessionId);
      if (!sessionScores) return null;
      return sessionScores[word] || null;
    };

    const setStoredWordResult = (sessionId, word, payload) => {
      if (!sessionId || !word) return;
      const sessionScores = getSessionWordScores(sessionId);
      if (!sessionScores) return;
      const now = Date.now();
      const prev = sessionScores[word];
      const next = { ...payload, ts: now };
      progressUpdatedThisRun = true;
      if (prev && prev.percent === next.percent && prev.transcript === next.transcript) return;
      sessionScores[word] = next;
      persistSpeakStores();
      if (typeof window.queueSpeakEvent === 'function') {
        window.queueSpeakEvent({
          type: 'word_score',
          session_id: sessionId,
          word,
          percent: next.percent,
          transcript: next.transcript,
          ts: now
        });
      }
    };

    const clearStoredWordResult = (sessionId, word) => {
      if (!sessionId || !word) return;
      const sessionScores = getSessionWordScores(sessionId);
      if (!sessionScores || !Object.prototype.hasOwnProperty.call(sessionScores, word)) return;
      delete sessionScores[word];
      persistSpeakStores();
    };

    const getStoredPhraseResult = (sessionId) => {
      if (!sessionId) return null;
      const store = getPhraseScoreStore();
      return store[sessionId] || null;
    };

    const setStoredPhraseResult = (sessionId, payload) => {
      if (!sessionId) return;
      const store = getPhraseScoreStore();
      const now = Date.now();
      const prev = store[sessionId];
      const next = { ...payload, ts: now };
      progressUpdatedThisRun = true;
      if (prev && prev.percent === next.percent && prev.transcript === next.transcript) return;
      store[sessionId] = next;
      persistSpeakStores();
      if (typeof window.queueSpeakEvent === 'function') {
        window.queueSpeakEvent({
          type: 'phrase_score',
          session_id: sessionId,
          percent: next.percent,
          transcript: next.transcript,
          ts: now
        });
      }
    };

    const clearStoredPhraseResult = (sessionId) => {
      if (!sessionId) return;
      const store = getPhraseScoreStore();
      if (!Object.prototype.hasOwnProperty.call(store, sessionId)) return;
      delete store[sessionId];
      persistSpeakStores();
    };

    const getStoredSessionReward = (sessionId) => {
      if (!sessionId) return null;
      const store = getSessionRewardStore();
      return store[sessionId] || null;
    };

    const setStoredSessionReward = (sessionId, payload) => {
      if (!sessionId) return;
      const store = getSessionRewardStore();
      const now = Date.now();
      const prev = store[sessionId];
      const next = { ...payload, ts: now };
      if (
        prev &&
        prev.rewardQty === next.rewardQty &&
        prev.rewardLabel === next.rewardLabel &&
        prev.rewardIcon === next.rewardIcon
      ) {
        return;
      }
      store[sessionId] = next;
      persistSpeakStores();
      if (typeof window.queueSpeakEvent === 'function') {
        window.queueSpeakEvent({
          type: 'session_reward',
          session_id: sessionId,
          rewardQty: next.rewardQty,
          rewardLabel: next.rewardLabel,
          rewardIcon: next.rewardIcon,
          ts: now
        });
      }
    };

    const getBadgeStore = () => {
      if (!window.r34lp0w3r) window.r34lp0w3r = {};
      if (!window.r34lp0w3r.speakBadges || typeof window.r34lp0w3r.speakBadges !== 'object') {
        window.r34lp0w3r.speakBadges = {};
      }
      return window.r34lp0w3r.speakBadges;
    };

    const getSessionPercentForRouteChecks = (session) => {
      if (!session || !session.id) return 0;
      const words =
        session && session.speak && session.speak.spelling && Array.isArray(session.speak.spelling.words)
          ? session.speak.spelling.words
          : [];
      const wordStore = getWordScoreStore();
      const phraseStore = getPhraseScoreStore();
      const sessionWordScores =
        wordStore && session.id && wordStore[session.id] && typeof wordStore[session.id] === 'object'
          ? wordStore[session.id]
          : {};
      const wordsPercent = words.length
        ? Math.round(
            words.reduce((sum, word) => {
              const stored = sessionWordScores[word];
              const value = stored && typeof stored.percent === 'number' ? stored.percent : 0;
              return sum + value;
            }, 0) / words.length
          )
        : 0;
      const phrase = phraseStore && session.id ? phraseStore[session.id] : null;
      const phrasePercent = phrase && typeof phrase.percent === 'number' ? phrase.percent : 0;
      return Math.round((wordsPercent + phrasePercent) / 2);
    };

    const hasSessionAttemptsForRouteChecks = (session) => {
      if (!session || !session.id) return false;
      const wordStore = getWordScoreStore();
      const phraseStore = getPhraseScoreStore();
      const wordScores =
        wordStore && session.id && wordStore[session.id] && typeof wordStore[session.id] === 'object'
          ? wordStore[session.id]
          : {};
      const hasWord = Object.values(wordScores).some(
        (entry) => entry && typeof entry.percent === 'number'
      );
      if (hasWord) return true;
      const phrase = phraseStore && session.id ? phraseStore[session.id] : null;
      return Boolean(phrase && typeof phrase.percent === 'number');
    };

    const getRouteProgressForBadges = (route) => {
      const modules = route && Array.isArray(route.modules) ? route.modules : [];
      if (!modules.length) return { started: false, percent: 0, tone: 'neutral' };
      const moduleProgress = modules.map((module) => {
        const sessions = module && Array.isArray(module.sessions) ? module.sessions : [];
        if (!sessions.length) return { started: false, percent: 0 };
        const started = sessions.some((session) => hasSessionAttemptsForRouteChecks(session));
        if (!started) return { started: false, percent: 0 };
        const total = sessions.reduce(
          (sum, session) => sum + getSessionPercentForRouteChecks(session),
          0
        );
        const percent = Math.round(total / sessions.length);
        return { started: true, percent };
      });
      const started = moduleProgress.some((entry) => entry.started);
      if (!started) return { started: false, percent: 0, tone: 'neutral' };
      const total = moduleProgress.reduce((sum, entry) => sum + (entry.started ? entry.percent : 0), 0);
      const percent = Math.round(total / modules.length);
      return { started: true, percent, tone: getScoreTone(percent) };
    };

    const getModuleProgressForRewards = (module) => {
      const sessions = module && Array.isArray(module.sessions) ? module.sessions : [];
      if (!sessions.length) return { started: false, percent: 0, tone: 'neutral' };
      const started = sessions.some((session) => hasSessionAttemptsForRouteChecks(session));
      if (!started) return { started: false, percent: 0, tone: 'neutral' };
      const total = sessions.reduce(
        (sum, session) => sum + getSessionPercentForRouteChecks(session),
        0
      );
      const percent = Math.round(total / sessions.length);
      return { started: true, percent, tone: getScoreTone(percent) };
    };

    const getModuleRewardLabel = (locale = getHintUiLocale()) => {
      const normalized = normalizeHintLocale(locale) || 'en';
      return normalized === 'es' ? 'copa' : 'cup';
    };

    const resolveRouteBadgeMeta = (route) => {
      if (!route || !route.id) return null;
      const routes = Array.isArray(getRoutes()) ? getRoutes() : [];
      const indexInRoutes = routes.findIndex((item) => item && item.id === route.id);
      const badgeIndex = indexInRoutes >= 0 ? indexInRoutes + 1 : 0;
      if (!badgeIndex || badgeIndex > MAX_ROUTE_BADGE_COUNT) return null;
      const routeLocale = getHintUiLocale(getBaseHintLocale());
      const routeTitleLocalized = getLocalizedContentField(route, 'title', routeLocale) || '';
      return {
        id: `route:${route.id}`,
        routeId: route.id,
        routeTitle: routeTitleLocalized,
        badgeIndex,
        image: `assets/badges/badge${badgeIndex}.png`,
        title: `Badge ${badgeIndex}`
      };
    };

    const showBadgePopupSoon = (badgeId, delayMs = 80) => {
      const id = String(badgeId || '').trim();
      if (!id) return;
      setTimeout(() => {
        if (typeof window.openSpeakBadgePopup === 'function') {
          window.openSpeakBadgePopup(id).catch(() => {});
        }
      }, Math.max(0, Number(delayMs) || 0));
    };

    const pickFirstText = (...values) => {
      for (let idx = 0; idx < values.length; idx += 1) {
        const value = String(values[idx] || '').trim();
        if (value) return value;
      }
      return '';
    };

    const clearPendingHomeReturnRevealTarget = () => {
      try {
        sessionStorage.removeItem(HOME_RETURN_REVEAL_KEY);
      } catch (err) {
        // no-op
      }
    };

    const setPendingHomeReturnRevealTarget = (target) => {
      if (!target || !target.routeId || !target.moduleId || !target.sessionId) {
        clearPendingHomeReturnRevealTarget();
        return;
      }
      try {
        sessionStorage.setItem(
          HOME_RETURN_REVEAL_KEY,
          JSON.stringify({
            routeId: String(target.routeId || ''),
            moduleId: String(target.moduleId || ''),
            sessionId: String(target.sessionId || '')
          })
        );
      } catch (err) {
        // no-op
      }
    };

    const getNextSessionRevealTarget = () => {
      const { route, module, session } = resolveSelection(getSelection());
      if (!route || !module || !session) return null;
      const routes = Array.isArray(getRoutes()) ? getRoutes() : [];
      const routeIndex = routes.findIndex((item) => item && item.id === route.id);
      if (routeIndex < 0) return null;
      const modules = Array.isArray(route.modules) ? route.modules : [];
      const moduleIndex = modules.findIndex((item) => item && item.id === module.id);
      if (moduleIndex < 0) return null;
      const sessions = Array.isArray(module.sessions) ? module.sessions : [];
      const currentIndex = sessions.findIndex((item) => item && item.id === session.id);
      if (currentIndex < 0) return null;
      if (currentIndex < sessions.length - 1) {
        const nextSession = sessions[currentIndex + 1];
        if (!nextSession || !nextSession.id) return null;
        return {
          routeId: route.id,
          moduleId: module.id,
          sessionId: nextSession.id
        };
      }
      if (moduleIndex < modules.length - 1) {
        const nextModule = modules[moduleIndex + 1];
        const nextModuleSessions = nextModule && Array.isArray(nextModule.sessions) ? nextModule.sessions : [];
        const nextSession = nextModuleSessions[0];
        if (!nextModule || !nextModule.id || !nextSession || !nextSession.id) return null;
        return {
          routeId: route.id,
          moduleId: nextModule.id,
          sessionId: nextSession.id
        };
      }
      if (routeIndex < routes.length - 1) {
        const nextRoute = routes[routeIndex + 1];
        const nextRouteModules = nextRoute && Array.isArray(nextRoute.modules) ? nextRoute.modules : [];
        const nextModule = nextRouteModules[0];
        const nextModuleSessions = nextModule && Array.isArray(nextModule.sessions) ? nextModule.sessions : [];
        const nextSession = nextModuleSessions[0];
        if (!nextRoute || !nextRoute.id || !nextModule || !nextModule.id || !nextSession || !nextSession.id) {
          return null;
        }
        return {
          routeId: nextRoute.id,
          moduleId: nextModule.id,
          sessionId: nextSession.id
        };
      }
      return null;
    };

    const addBadgeNotification = (badgeEntry) => {
      if (!badgeEntry || !badgeEntry.id) return;
      try {
        addNotification({
          type: 'reward',
          tone: 'good',
          icon: 'ribbon-outline',
          image: badgeEntry.image || '',
          title: 'Nuevo badge desbloqueado',
          text: badgeEntry.routeTitle || 'Ruta completada',
          action: {
            label: 'Ver badge',
            tab: 'tu',
            profileTab: 'prefs',
            callback: 'openSpeakBadgeFromNotification',
            badgeId: badgeEntry.id,
            complete: true
          }
        });
      } catch (err) {
        // no-op
      }
    };

    const syncSpeakAwardsNow = (reason) => {
      if (typeof window.syncSpeakProgress !== 'function') return;
      window
        .syncSpeakProgress({
          reason: reason || 'speak-award',
          force: true,
          includeSnapshot: true
        })
        .catch(() => {});
    };

    const awardTrophyForCurrentModuleIfEligible = (locale = getHintUiLocale()) => {
      const { module } = resolveSelection(getSelection());
      if (!module || !module.id) return null;
      const moduleProgress = getModuleProgressForRewards(module);
      if (!moduleProgress.started || moduleProgress.tone !== 'good') return null;
      const rewardLabel = getModuleRewardLabel(locale);
      const rewardId = `module:${module.id}`;
      if (getStoredSessionReward(rewardId)) {
        if (!shouldReplayOwnedSpeakAwardsInDebug()) return null;
        return {
          rewardQty: MODULE_TROPHY_REWARD_QTY,
          totalQty: MODULE_TROPHY_REWARD_QTY,
          rewardLabel,
          rewardIcon: MODULE_TROPHY_REWARD_ICON,
          simulated: true,
          alreadyOwned: true
        };
      }
      setStoredSessionReward(rewardId, {
        rewardQty: MODULE_TROPHY_REWARD_QTY,
        rewardLabel,
        rewardIcon: MODULE_TROPHY_REWARD_ICON
      });
      syncSpeakAwardsNow('session-reward');
      return {
        rewardQty: MODULE_TROPHY_REWARD_QTY,
        totalQty: MODULE_TROPHY_REWARD_QTY,
        rewardLabel,
        rewardIcon: MODULE_TROPHY_REWARD_ICON
      };
    };

    const awardBadgeForCurrentRouteIfEligible = () => {
      const { route } = resolveSelection(getSelection());
      if (!route) return null;
      const routeProgress = getRouteProgressForBadges(route);
      if (!routeProgress.started || routeProgress.tone !== 'good') return null;
      const meta = resolveRouteBadgeMeta(route);
      if (!meta) return null;
      const badgeStore = getBadgeStore();
      if (badgeStore[meta.id]) {
        if (!shouldReplayOwnedSpeakAwardsInDebug()) return null;
        return {
          id: meta.id,
          routeId: meta.routeId,
          routeTitle: meta.routeTitle,
          badgeIndex: meta.badgeIndex,
          image: meta.image,
          title: meta.title,
          ts: Date.now(),
          simulated: true,
          alreadyOwned: true
        };
      }
      const now = Date.now();
      const entry = {
        routeId: meta.routeId,
        routeTitle: meta.routeTitle,
        badgeIndex: meta.badgeIndex,
        image: meta.image,
        title: meta.title,
        ts: now
      };
      badgeStore[meta.id] = entry;
      persistSpeakStores();
      if (typeof window.queueSpeakEvent === 'function') {
        window.queueSpeakEvent({
          type: 'badge_awarded',
          badge_id: meta.id,
          route_id: meta.routeId,
          route_title: meta.routeTitle,
          badgeIndex: meta.badgeIndex,
          badge_image: meta.image,
          badge_title: meta.title,
          ts: now
        });
      }
      addBadgeNotification({ id: meta.id, ...entry });
      syncSpeakAwardsNow('badge-awarded');
      return { id: meta.id, ...entry };
    };

    const syncSpellingStateFromStore = (word) => {
      const stored = getStoredWordResult(currentSessionId, word);
      if (stored && typeof stored.percent === 'number') {
        stepState.spelling.percent = stored.percent;
        stepState.spelling.transcript = stored.transcript || '';
      } else {
        stepState.spelling.percent = null;
        stepState.spelling.transcript = '';
      }
    };

    const syncSentenceStateFromStore = () => {
      const stored = getStoredPhraseResult(currentSessionId);
      if (stored && typeof stored.percent === 'number') {
        stepState.sentence.percent = stored.percent;
        stepState.sentence.transcript = stored.transcript || '';
      } else {
        stepState.sentence.percent = null;
        stepState.sentence.transcript = '';
      }
    };

    const getWordsPhasePercent = () => {
      const words = spellingStep && Array.isArray(spellingStep.words) ? spellingStep.words : [];
      if (!words.length) return 0;
      const sessionScores = getSessionWordScores(currentSessionId) || {};
      const total = words.reduce((sum, word) => {
        const stored = sessionScores[word];
        const value = stored && typeof stored.percent === 'number' ? stored.percent : 0;
        return sum + value;
      }, 0);
      return Math.round(total / words.length);
    };

    const getPhrasePhasePercent = () => {
      const stored = getStoredPhraseResult(currentSessionId);
      if (stored && typeof stored.percent === 'number') return stored.percent;
      return 0;
    };

    const getSessionPercent = () => {
      const wordsPercent = getWordsPhasePercent();
      const phrasePercent = getPhrasePhasePercent();
      return Math.round((wordsPercent + phrasePercent) / 2);
    };

    const getToneMaxValues = () => {
      const { toneScale } = getFeedbackConfig();
      const normalized = normalizeScale(toneScale, 'tone');
      if (!normalized.length) {
        return { good: 100, okay: 79, bad: 59 };
      }
      const maxByTone = {};
      normalized.forEach((entry, idx) => {
        const prev = normalized[idx - 1];
        let max = idx === 0 ? 100 : prev.min - 1;
        if (typeof max !== 'number' || Number.isNaN(max)) max = entry.min;
        max = Math.max(entry.min, max);
        maxByTone[entry.tone] = Math.max(0, Math.min(100, Math.round(max)));
      });
      if (maxByTone.good === undefined) maxByTone.good = 100;
      if (maxByTone.okay === undefined) maxByTone.okay = Math.max(0, maxByTone.good - 1);
      if (maxByTone.bad === undefined) maxByTone.bad = Math.max(0, maxByTone.okay - 1);
      return maxByTone;
    };

    const renderDebugBox = (key, options = {}) => {
      if (!isSpeakDebugEnabled()) return '';
      const inline = Boolean(options.inline);
      const expected = getExpectedText(key);
      const state = stepState[key] || {};
      const transcript = state.transcript || '';
      const expectedText = expected ? expected : 'n/d';
      const transcriptText = transcript ? transcript : 'n/d';
      const wordsPercent = getWordsPhasePercent();
      const phrasePercent = getPhrasePhasePercent();
      const sessionPercent = getSessionPercent();
      const toneMax = getToneMaxValues();
      const showTonePicker = key !== 'sound';
      const inlineNav = inline
        ? `
          <div class="speak-debug-inline-nav">
            <button class="speak-debug-nav-btn" id="speak-debug-prev" type="button" aria-label="Previous step">&lt;</button>
            <button class="speak-debug-nav-btn" id="speak-debug-next" type="button" aria-label="Next step">&gt;</button>
          </div>
        `
        : '';
      return `
        <div class="speak-debug ${inline ? 'speak-debug-inline' : ''}">
          <div class="speak-debug-row">
            <span class="speak-debug-label">Esperado</span>
            <span class="speak-debug-value">${escapeHtml(expectedText)}</span>
          </div>
          <div class="speak-debug-row">
            <span class="speak-debug-label">Transcrito</span>
            <span class="speak-debug-value">${escapeHtml(transcriptText)}</span>
          </div>
          ${
            showTonePicker
              ? `<div class="speak-debug-row">
            <span class="speak-debug-label">Forzar</span>
            <div class="speak-debug-tones">
              <button
                class="speak-debug-tone tone-bad"
                type="button"
                data-tone="bad"
                aria-label="Forzar rojo ${toneMax.bad}%"
                title="Rojo ${toneMax.bad}%"
              ></button>
              <button
                class="speak-debug-tone tone-okay"
                type="button"
                data-tone="okay"
                aria-label="Forzar amarillo ${toneMax.okay}%"
                title="Amarillo ${toneMax.okay}%"
              ></button>
              <button
                class="speak-debug-tone tone-good"
                type="button"
                data-tone="good"
                aria-label="Forzar verde ${toneMax.good}%"
                title="Verde ${toneMax.good}%"
              ></button>
              <button
                class="speak-debug-tone tone-reset"
                type="button"
                data-tone="reset"
                aria-label="Desasignar porcentaje"
                title="Desasignar %"
              ></button>
            </div>
          </div>`
              : ''
          }
          <div class="speak-debug-row speak-debug-metrics-row">
            <span class="speak-debug-label">Score</span>
            <div class="speak-debug-metrics">
              <span class="speak-debug-metric"><b>Words</b> ${wordsPercent}%</span>
              <span class="speak-debug-metric"><b>Phrase</b> ${phrasePercent}%</span>
              <span class="speak-debug-metric"><b>Session</b> ${sessionPercent}%</span>
            </div>
          </div>
          ${inlineNav}
        </div>
      `;
    };

    const renderBottomPanel = (key, options = {}) => {
      const hasVoiceRecording = Boolean(options.hasVoiceRecording);
      const voiceToneRaw = String(options.voiceTone || '').toLowerCase().trim();
      const voiceTone = ['good', 'okay', 'bad'].includes(voiceToneRaw) ? voiceToneRaw : '';
      if (isSpeakDebugEnabled() && debugPanelOpen) {
        return `
          <div class="speak-step-bottom">
            <div class="speak-voice-nav speak-voice-nav-debug">
              ${renderDebugBox(key, { inline: true })}
            </div>
          </div>
        `;
      }
      const dotsHtml = stepOrder.map((_, i) =>
        `<span class="speak-step-dot${i === stepIndex ? ' is-active' : ''}"></span>`
      ).join('');
      const scoreHtml = options.scoreHtml || '';
      return `
        <div class="speak-step-bottom">
          ${scoreHtml}
          <div class="speak-voice-actions">
            <button class="speak-circle-btn speak-record-btn ${isRecording ? 'is-recording' : ''}" id="speak-record" type="button" aria-pressed="${isRecording}">
              <span class="record-visual" aria-hidden="true">
                <ion-icon class="record-mic-icon" name="mic"></ion-icon>
                <span class="record-live-wave">
                  <span></span><span></span><span></span><span></span><span></span>
                </span>
              </span>
              <span class="record-label">${isRecording ? 'End' : 'Say'}</span>
            </button>
            <button
              class="speak-circle-btn speak-voice-btn${voiceTone ? ` tone-${voiceTone}` : ''}"
              id="speak-voice"
              type="button"
              ${hasVoiceRecording ? '' : 'disabled'}
            >
              <svg class="speak-voice-icon" width="22" height="22" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M13 2.16664C10.8573 2.16664 8.76282 2.802 6.98129 3.99238C5.19976 5.18276 3.81123 6.87469 2.99128 8.85422C2.17133 10.8337 1.9568 13.012 2.3748 15.1134C2.7928 17.2149 3.82458 19.1452 5.33965 20.6603C6.85471 22.1753 8.78502 23.2071 10.8865 23.6252C12.9879 24.0431 15.1662 23.8286 17.1456 23.0086C19.1252 22.1887 20.8172 20.8002 22.0075 19.0186C23.1979 17.2371 23.8333 15.1426 23.8333 13C23.8333 10.7014 22.9201 8.49702 21.2949 6.87171C19.6696 5.24639 17.4651 4.3333 15.1666 4.3333C12.8681 4.3333 10.6637 5.24639 9.03837 6.87171C7.41305 8.49702 6.49996 10.7014 6.49996 13V15.1666" stroke="currentColor" stroke-width="2.1658" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M10.8333 13C10.8333 11.8507 11.2898 10.7485 12.1025 9.93587C12.9151 9.12321 14.0173 8.66667 15.1666 8.66667" stroke="currentColor" stroke-width="2.1658" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span class="speak-voice-icon-wave" aria-hidden="true">
                <span></span><span></span><span></span><span></span><span></span>
              </span>
              <span>Your voice</span>
            </button>
          </div>
          <div class="speak-voice-nav">
            <button class="speak-step-arrow-btn" id="speak-prev-inline" type="button" aria-label="Previous step">
              <ion-icon name="chevron-back"></ion-icon>
            </button>
            <div class="speak-step-dots">${dotsHtml}</div>
            <button class="speak-step-arrow-btn" id="speak-next-inline" type="button" aria-label="Next step">
              <ion-icon name="chevron-forward"></ion-icon>
            </button>
          </div>
        </div>
      `;
    };

    const getScoreTone = (percent, locale = getHintUiLocale()) => {
      const value = typeof percent === 'number' ? percent : 0;
      const { toneScale } = getFeedbackConfig(locale);
      const normalized = normalizeScale(toneScale, 'tone');
      return resolveFromScale(normalized, value, 'tone', 'bad');
    };

    const getScoreLabel = (percent, locale = getHintUiLocale(), seed = '') => {
      const value = typeof percent === 'number' ? percent : 0;
      const tone = getScoreTone(value, locale);
      const { tonePhrases } = getFeedbackConfig(locale);
      const fallbackTonePhrases = getDefaultTonePhrases(locale);
      const fallbackList =
        fallbackTonePhrases && Array.isArray(fallbackTonePhrases[tone])
          ? fallbackTonePhrases[tone]
          : [];
      return pickStableTonePhrase(
        tonePhrases && Array.isArray(tonePhrases[tone]) ? tonePhrases[tone] : [],
        seed || `${locale}:${tone}:${value}`,
        fallbackList[0] || getSpeakUiText('feedbackKeep', locale, 'Keep practicing')
      );
    };

    const getStepKey = () => stepOrder[stepIndex];

    const updateRecordUi = () => {
      if (!stepRoot) return;
      const recordBtn = stepRoot.querySelector('#speak-record');
      if (!recordBtn) return;
      recordBtn.classList.toggle('is-recording', isRecording);
      recordBtn.setAttribute('aria-pressed', isRecording ? 'true' : 'false');
      const label = recordBtn.querySelector('.record-label');
      if (label) label.textContent = isRecording ? 'End' : 'Say';
    };

    const setRecordingState = (nextState) => {
      if (isRecording === nextState) return;
      isRecording = nextState;
      updateRecordUi();
    };

    const setTranscribingState = (nextState, stepKey) => {
      const nextKey = nextState ? stepKey || getStepKey() : null;
      if (isTranscribing === nextState && transcribingStepKey === nextKey) return;
      isTranscribing = nextState;
      transcribingStepKey = nextKey;
      if (stepRoot) renderStep();
    };

    const stopPlayback = () => {
      const shouldResetSyllables = playbackAudio === activeAudio;
      if (activeAudio) {
        activeAudio.pause();
        activeAudio.currentTime = 0;
        activeAudio = null;
      }
      if (canSpeak()) {
        if (typeof window.cancelWebSpeech === 'function') {
          window.cancelWebSpeech();
        } else {
          window.speechSynthesis.cancel();
        }
      }
      if (activePlayButton) {
        activePlayButton.classList.remove('is-playing');
        activePlayButton = null;
      }
      // Cancel full hero narration task (token/timer + playback) to avoid overlap/race
      // when changing steps while the blue-card audio is still running.
      stopHeroNarration().catch(() => {});
      if (shouldResetSyllables) {
        playbackAudio = null;
        resetSyllables();
      }
    };

    const stopAvatarPlayback = () => {
      const shouldResetSyllables = playbackAudio === avatarAudio;
      if (avatarAudio) {
        avatarAudio.pause();
        avatarAudio.currentTime = 0;
        avatarAudio = null;
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      animating = false;
      currentViseme = 0;
      setMouthViseme('NEUTRAL');
      if (shouldResetSyllables) {
        playbackAudio = null;
        resetSyllables();
      }
    };

    const setActivePlayButton = (buttonEl) => {
      if (activePlayButton && activePlayButton !== buttonEl) {
        activePlayButton.classList.remove('is-playing');
      }
      activePlayButton = buttonEl || null;
      if (activePlayButton) {
        activePlayButton.classList.add('is-playing');
      }
    };

    const clearActivePlayButton = () => {
      if (!activePlayButton) return;
      activePlayButton.classList.remove('is-playing');
      activePlayButton = null;
    };

    const startSpeechRecognition = () => {
      if (canNativeFileTranscribe()) {
        return false;
      }
      if (isNativeSpeechSupported()) {
        startNativeSpeechRecognition().catch(() => {
          speechFailed = true;
          nativeSpeechActive = false;
        });
        return true;
      }
      const SpeechRecognition = getSpeechRecognition();
      if (!SpeechRecognition) return false;
      resetSpeechState();
      const recognition = new SpeechRecognition();
      speechRecognizer = recognition;
      recognition.lang = 'en-US';
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
        speechTranscript = finalText.trim();
        speechInterim = interimText.trim();
      };
      recognition.onerror = () => {
        speechFailed = true;
      };
      recognition.onend = () => {
        speechRecognizer = null;
      };
      try {
        recognition.start();
        return true;
      } catch (err) {
        speechFailed = true;
        speechRecognizer = null;
        return false;
      }
    };

    const stopSpeechRecognition = () => {
      if (nativeSpeechActive) {
        stopNativeSpeechRecognition().catch(() => {
          // no-op
        });
        return;
      }
      if (!speechRecognizer) return;
      try {
        speechRecognizer.stop();
      } catch (err) {
        // no-op
      }
    };

    const resetSpeechState = () => {
      speechTranscript = '';
      speechInterim = '';
      speechFailed = false;
    };

    const clearRecordingAudioForStep = (key) => {
      const state = stepState[key];
      if (!state) return;
      if (state.recordingUrl) {
        URL.revokeObjectURL(state.recordingUrl);
      }
      state.recordingUrl = '';
      state.recordingBlob = null;
    };

    const clearRecordingForStep = (key) => {
      const state = stepState[key];
      clearRecordingAudioForStep(key);
      if (state) {
        state.transcript = '';
        state.percent = null;
      }
    };

    const startRecording = async () => {
      if (isTranscribing) {
        setTranscribingState(false, transcribingStepKey);
      }
      if (!canRecord()) {
        setRecordingState(false);
        finalizeRecording('', getStepKey());
        return;
      }
      stopPlayback();
      stopAvatarPlayback();
      resetSpeechState();
      recordedChunks = [];
      recordingStepKey = getStepKey();
      try {
        recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        setRecordingState(false);
        finalizeRecording('', recordingStepKey || getStepKey());
        return;
      }

      let options;
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        const candidates = getRecordMimeCandidates();
        const supported = candidates.find((type) => MediaRecorder.isTypeSupported(type));
        if (supported) options = { mimeType: supported };
      }

      try {
        mediaRecorder = options ? new MediaRecorder(recordingStream, options) : new MediaRecorder(recordingStream);
        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunks.push(event.data);
          }
        };
        mediaRecorder.onstop = () => {
          setRecordingState(false);
          const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
          const stepKey = recordingStepKey || getStepKey();
          const hasPlayableBlob = blob && blob.size >= MIN_RECORDING_BLOB_BYTES;
          const url = hasPlayableBlob ? URL.createObjectURL(blob) : '';
          if (canNativeFileTranscribe()) {
            if (!hasPlayableBlob) {
              if (isAndroidPlatform()) {
                setTranscribingState(false, stepKey);
              }
              finalizeRecording('', stepKey, undefined, null);
            } else {
              if (isAndroidPlatform()) {
                setTranscribingState(true, stepKey);
              }
              transcribeNativeAudioBlob(blob)
                .then((text) => {
                  if (isAndroidPlatform()) {
                    setTranscribingState(false, stepKey);
                  }
                  finalizeRecording(url, stepKey, text, blob);
                })
                .catch(() => {
                  if (isAndroidPlatform()) {
                    setTranscribingState(false, stepKey);
                  }
                  finalizeRecording(url, stepKey, undefined, blob);
                });
            }
          } else if (hasPlayableBlob) {
            finalizeRecording(url, stepKey, undefined, blob);
          } else {
            finalizeRecording('', stepKey, undefined, null);
          }
          recordingStepKey = null;
          mediaRecorder = null;
          if (recordingStream) {
            recordingStream.getTracks().forEach((track) => track.stop());
            recordingStream = null;
          }
        };
        mediaRecorder.start(RECORDING_TIMESLICE);
        setRecordingState(true);
        startSpeechRecognition();
      } catch (err) {
        setRecordingState(false);
        finalizeRecording('', recordingStepKey || getStepKey());
      }
    };

    const stopRecording = () => {
      if (!mediaRecorder) {
        recordingStepKey = null;
        setRecordingState(false);
        return;
      }
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        if (typeof mediaRecorder.requestData === 'function') {
          try {
            mediaRecorder.requestData();
          } catch (err) {
            // no-op
          }
        }
        mediaRecorder.stop();
      }
      setRecordingState(false);
      stopSpeechRecognition();
    };

    const finalizeRecording = (audioUrl, stepKey, forcedTranscript, recordedBlob = null) => {
      const key = stepKey || getStepKey();
      if (!stepState[key]) return;
      const expected = getExpectedText(key);
      const transcript =
        typeof forcedTranscript === 'string' ? forcedTranscript : speechTranscript || speechInterim;
      const finalTranscript = transcript || '';
      let percent;
      if (finalTranscript) {
        percent = scoreSimilarity(expected, finalTranscript);
      } else if (key === 'spelling' || key === 'sentence') {
        percent = 0;
      } else {
        percent = DEFAULT_SCORES[key] || 0;
      }

      clearRecordingForStep(key);
      stepState[key].recordingUrl = audioUrl || '';
      stepState[key].recordingBlob = recordedBlob instanceof Blob ? recordedBlob : null;
      stepState[key].transcript = finalTranscript;
      stepState[key].percent = percent;
      if (key === 'spelling' && selectedWord) {
        setStoredWordResult(currentSessionId, selectedWord, {
          percent,
          transcript: finalTranscript
        });
      }
      if (key === 'sentence') {
        setStoredPhraseResult(currentSessionId, {
          percent,
          transcript: finalTranscript
        });
      }
      renderStep();
    };

    const playRecording = () => {
      const key = getStepKey();
      const state = stepState[key];
      if (!state || (!state.recordingUrl && !(state.recordingBlob instanceof Blob))) return;
      stopPlayback();
      let sourceUrl = state.recordingUrl || '';
      let temporarySourceUrl = '';
      if (state.recordingBlob instanceof Blob && state.recordingBlob.size >= MIN_RECORDING_BLOB_BYTES) {
        try {
          temporarySourceUrl = URL.createObjectURL(state.recordingBlob);
          sourceUrl = temporarySourceUrl;
        } catch (err) {
          temporarySourceUrl = '';
        }
      }
      if (!sourceUrl) return;
      activeAudio = new Audio(sourceUrl);
      const currentAudio = activeAudio;
      const voiceBtn = document.querySelector('#speak-voice');
      voiceBtn?.classList.add('is-playing');
      const release = () => {
        if (temporarySourceUrl) {
          try {
            URL.revokeObjectURL(temporarySourceUrl);
          } catch (err) {
            // no-op
          }
          temporarySourceUrl = '';
        }
        if (activeAudio === currentAudio) activeAudio = null;
        voiceBtn?.classList.remove('is-playing');
      };
      currentAudio.play().catch(() => {
        if (!temporarySourceUrl && state.recordingUrl) {
          clearRecordingAudioForStep(key);
          renderStep();
        }
        release();
      });
      currentAudio.onended = release;
      currentAudio.onerror = () => {
        if (!temporarySourceUrl && state.recordingUrl) {
          clearRecordingAudioForStep(key);
          renderStep();
        }
        release();
      };
    };

    const playTts = (text, triggerBtn) => {
      if (!text || !canSpeak()) return;
      stopPlayback();
      setActivePlayButton(triggerBtn || null);
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'en-US';
      utter.onend = () => {
        clearActivePlayButton();
      };
      utter.onerror = () => {
        clearActivePlayButton();
      };
      const started =
        typeof window.speakWebUtterance === 'function'
          ? window.speakWebUtterance(utter)
          : (() => {
              window.speechSynthesis.speak(utter);
              return true;
            })();
      if (!started) {
        clearActivePlayButton();
      }
    };

    const ensureMfaItems = async () => {
      if (mfaReady) return true;
      try {
        const res = await fetch(MFA_ITEMS_URL);
        if (!res.ok) return false;
        const data = await res.json();
        mfaItems = Array.isArray(data.items) ? data.items : [];
        mfaLookup = data && typeof data.lookup === 'object' ? data.lookup : {};
        mfaReady = true;
        return true;
      } catch (err) {
        console.warn('[speak] mfa items error', err);
        return false;
      }
    };

    const getMfaIdForText = (text) => {
      if (!mfaReady) return null;
      const key = normalizeMfaKey(text);
      if (!key) return null;
      return mfaLookup[key] || null;
    };

    const fetchJson = async (url) => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to load ${url}`);
      }
      return res.json();
    };

    const loadSyllables = async (id) => {
      try {
        return await fetchJson(`${MFA_SYLLABLES_BASE}/${id}.syllables.json`);
      } catch (err) {
        const words = await fetchJson(`${MFA_WORDS_BASE}/${id}.words.json`);
        return (Array.isArray(words) ? words : []).map((word) => ({
          word: word.word,
          start: word.start,
          end: word.end,
          syllables: [
            {
              text: word.word,
              start: word.start,
              end: word.end,
              index: 0
            }
          ]
        }));
      }
    };

    const splitPhoneticText = (phonetic, expected) => {
      if (!phonetic) return null;
      if (expected) {
        const lower = phonetic.toLowerCase();
        const target = expected.toLowerCase();
        const idx = lower.indexOf(target);
        if (idx >= 0) {
          return {
            prefix: phonetic.slice(0, idx),
            suffix: phonetic.slice(idx + expected.length)
          };
        }
      }

      const arrowMatch = phonetic.match(/^(.*?)(?:->|\u2192)\s*(.+)$/);
      if (arrowMatch) {
        const arrowSymbol = phonetic.includes('\u2192') ? '\u2192' : '->';
        return {
          prefix: `${arrowMatch[1]}${arrowSymbol} `,
          suffix: ''
        };
      }

      return null;
    };

    const getDisplayTokenMap = (text) => {
      const tokens = String(text || '')
        .replace(/[\u2019\u2018]/g, "'")
        .split(/\s+/)
        .map((token) => token.replace(/^[^a-z0-9']+|[^a-z0-9']+$/gi, ''))
        .filter(Boolean);
      const map = {};
      tokens.forEach((token) => {
        const key = token.toLowerCase();
        if (!map[key]) map[key] = token;
      });
      return map;
    };

    const mergeSyllableDisplay = (data, displayText) => {
      if (!Array.isArray(data)) return [];
      const tokenMap = displayText ? getDisplayTokenMap(displayText) : {};
      const hasToken = (token) => Boolean(tokenMap && tokenMap[token]);
      const wordsLower = data.map((entry) => String(entry.word || '').toLowerCase());
      const result = [];
      let index = 0;

      while (index < data.length) {
        let merged = false;
        for (const merge of CONTRACTION_MERGES) {
          if (!hasToken(merge.contraction)) continue;
          const len = merge.expandedTokens.length;
          if (index + len - 1 >= data.length) continue;
          const slice = wordsLower.slice(index, index + len);
          const matches = merge.expandedTokens.every((token, idx) => token === slice[idx]);
          if (!matches) continue;
          const first = data[index];
          const last = data[index + len - 1];
          const word = tokenMap[merge.contraction] || merge.contraction;
          result.push({
            word,
            start: first.start,
            end: last.end,
            syllables: [
              {
                text: word,
                start: first.start,
                end: last.end,
                index: 0
              }
            ]
          });
          index += len;
          merged = true;
          break;
        }
        if (merged) continue;
        const entry = data[index];
        const key = String(entry.word || '').toLowerCase();
        const displayWord = tokenMap[key] || entry.word;
        result.push({
          ...entry,
          word: displayWord
        });
        index += 1;
      }
      return result;
    };

    const renderSyllables = (targetEl, data, fallbackText, highlightKey, prefix = '', suffix = '') => {
      if (!targetEl) return;
      targetEl.innerHTML = '';
      syllableTimeline = [];
      currentSyllable = 0;
      activeSyllableIndex = -1;

      if (!Array.isArray(data) || !data.length) {
        targetEl.textContent = fallbackText || '';
        return;
      }

      const displayData = mergeSyllableDisplay(data, fallbackText);
      if (!displayData.length) {
        targetEl.textContent = fallbackText || '';
        return;
      }

      if (prefix) {
        targetEl.appendChild(document.createTextNode(prefix));
      }

      displayData.forEach((wordEntry) => {
        const wordSpan = document.createElement('span');
        wordSpan.className = 'speak-syllable-word';
        const syllables =
          Array.isArray(wordEntry.syllables) && wordEntry.syllables.length
            ? wordEntry.syllables
            : [
                {
                  text: wordEntry.word,
                  start: wordEntry.start,
                  end: wordEntry.end,
                  index: 0
                }
              ];

        syllables.forEach((syllable, idx) => {
          const sylSpan = document.createElement('span');
          sylSpan.className = 'speak-syllable';
          sylSpan.innerHTML = highlightLetter(syllable.text, highlightKey);
          wordSpan.appendChild(sylSpan);
          syllableTimeline.push({
            start: syllable.start,
            end: syllable.end,
            el: sylSpan
          });
          if (idx < syllables.length - 1) {
            const sep = document.createElement('span');
            sep.className = 'speak-syllable-sep';
            sep.textContent = '-';
            wordSpan.appendChild(sep);
          }
        });

        targetEl.appendChild(wordSpan);
        targetEl.appendChild(document.createTextNode(' '));
      });

      if (suffix) {
        targetEl.appendChild(document.createTextNode(suffix));
      }
    };

    const highlightSyllable = (index) => {
      if (activeSyllableIndex === index) return;
      if (activeSyllableIndex >= 0 && syllableTimeline[activeSyllableIndex]) {
        syllableTimeline[activeSyllableIndex].el.classList.remove('is-active');
      }
      if (index >= 0 && syllableTimeline[index]) {
        syllableTimeline[index].el.classList.add('is-active');
      }
      activeSyllableIndex = index;
    };

    const resetSyllables = () => {
      highlightSyllable(-1);
      syllableTimeline = [];
      currentSyllable = 0;
      activeSyllableIndex = -1;
    };

    const updateSyllables = (time) => {
      if (!syllableTimeline.length) return;
      while (currentSyllable < syllableTimeline.length - 1 && time > syllableTimeline[currentSyllable].end) {
        currentSyllable += 1;
      }
      const s = syllableTimeline[currentSyllable];
      const newIndex = s && time >= s.start && time <= s.end ? currentSyllable : -1;
      highlightSyllable(newIndex);
    };

    const playReferenceAudio = async ({ text, targetEl, phonetic, withVisemes, triggerBtn }) => {
      if (!text) return;
      stopPlayback();
      stopAvatarPlayback();

      const ready = await ensureMfaItems();
      const itemId = ready ? getMfaIdForText(text) : null;
      if (!itemId) {
        if (targetEl) targetEl.textContent = phonetic || text;
        playTts(text, triggerBtn || null);
        return;
      }

      let syllablesData = [];
      try {
        syllablesData = await loadSyllables(itemId);
      } catch (err) {
        syllablesData = [];
      }

      if (targetEl) {
        const split = phonetic ? splitPhoneticText(phonetic, text) : null;
        const prefix = split ? split.prefix : '';
        const suffix = split ? split.suffix : '';
        renderSyllables(targetEl, syllablesData, text || phonetic, focusKey, prefix, suffix);
      } else {
        resetSyllables();
      }

      if (withVisemes) {
        try {
          const visemeData = await fetchJson(`${MFA_VISEME_BASE}/${itemId}.visemes.json`);
          visemes = Array.isArray(visemeData) ? visemeData : [];
        } catch (err) {
          visemes = [];
        }
      } else {
        visemes = [];
      }

      const audio = new Audio(`${MFA_AUDIO_BASE}/${itemId}.wav`);
      playbackAudio = audio;
      setActivePlayButton(triggerBtn || null);
      if (withVisemes) {
        avatarAudio = audio;
      } else {
        activeAudio = audio;
      }
      animating = true;
      currentViseme = 0;
      currentSyllable = 0;
      activeSyllableIndex = -1;
      lastVisemeKey = 'NEUTRAL';
      setMouthViseme('NEUTRAL');

      audio.onended = () => {
        animating = false;
        setMouthViseme('NEUTRAL');
        highlightSyllable(-1);
        clearActivePlayButton();
      };

      audio.onerror = () => {
        clearActivePlayButton();
      };

      audio.play().catch(() => {
        clearActivePlayButton();
      });
      rafId = requestAnimationFrame(updateAvatar);
    };

    const setMouthViseme = (visemeKeyRaw) => {
      if (!mouthImgA || !mouthImgB) return;
      const avatarConfig = currentPronunciationAvatarConfig || getPronunciationAvatarConfig();
      const visemeKey = (visemeKeyRaw || 'NEUTRAL').toUpperCase();
      if (visemeKey === lastVisemeKey) return;
      const imgSrc = avatarConfig.mouthMap[visemeKey] || avatarConfig.mouthMap.NEUTRAL;
      const mouthBaseClass = avatarConfig.mouthBaseClass || 'speak-mouth';

      const next = inactiveMouth;
      const prev = activeMouth;

      if (next.getAttribute('src') !== imgSrc) {
        next.setAttribute('src', imgSrc);
      }

      next.className = `${mouthBaseClass} mouth-layer mouth-layer-active viseme-${visemeKey.toLowerCase()}`;
      prev.className = `${mouthBaseClass} mouth-layer viseme-${lastVisemeKey.toLowerCase()}`;

      activeMouth = next;
      inactiveMouth = prev;
      lastVisemeKey = visemeKey;
    };

    const updateAvatar = () => {
      const audio = playbackAudio;
      if (!animating || !audio || audio.paused || audio.ended) {
        animating = false;
        return;
      }
      const t = Math.max(0, audio.currentTime - AV_SYNC_DELAY);
      if (visemes.length > 0) {
        while (currentViseme < visemes.length - 1 && t > visemes[currentViseme].end) {
          currentViseme += 1;
        }
        const v = visemes[currentViseme];
        if (v && v.viseme && t >= v.start) {
          setMouthViseme(v.viseme);
        }
      }
      updateSyllables(t);
      rafId = requestAnimationFrame(updateAvatar);
    };

    const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const highlightLetter = (word, letter) => {
      if (!letter) return word;
      const regex = new RegExp(escapeRegex(letter), 'gi');
      return word.replace(regex, (match) => `<span class="accent">${match}</span>`);
    };

    const highlightSentence = (sentence, letter) => {
      return highlightLetter(sentence, letter);
    };

    const usesPhoneticDisplay = (phonetic, expected) => {
      if (!phonetic) return false;
      if (/[\\/]/.test(phonetic)) return true;
      if (phonetic.includes('->') || phonetic.includes('\u2192')) return true;
      if (expected && phonetic.toLowerCase().includes(expected.toLowerCase())) return true;
      return false;
    };

    const getSoundDisplayText = () => {
      if (!soundStep) return '';
      const phonetic = soundStep.phonetic || '';
      const expected = soundStep.expected || '';
      if (usesPhoneticDisplay(phonetic, expected)) return phonetic;
      return expected || phonetic;
    };

    const getExpectedText = (key) => {
      if (key === 'sound') return soundStep && soundStep.expected ? soundStep.expected : '';
      if (key === 'spelling') return selectedWord;
      if (key === 'sentence') return sentenceStep && sentenceStep.expected ? sentenceStep.expected : '';
      return '';
    };

    const getScoreForStep = (key, locale = getHintUiLocale()) => {
      const state = stepState[key];
      if (!state || state.percent === null) return null;
      const percent = state.percent;
      return {
        percent,
        tone: getScoreTone(percent, locale),
        label: getScoreLabel(percent, locale, `${currentSessionId}:${key}:${percent}`)
      };
    };

    const getOverallScore = () => {
      const sentenceScore = stepState.sentence && stepState.sentence.percent;
      if (sentenceScore !== null && sentenceScore !== undefined) return sentenceScore;
      const soundScore = stepState.sound && stepState.sound.percent;
      if (soundScore !== null && soundScore !== undefined) return soundScore;
      return DEFAULT_SCORES.sentence;
    };

    const resetStepState = () => {
      Object.keys(stepState).forEach((key) => clearRecordingForStep(key));
      resetSpeechState();
    };

    const resolveStartStepIndex = (value) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        const idx = Math.round(value);
        return Math.min(Math.max(idx, 0), stepOrder.length - 1);
      }
      if (typeof value === 'string') {
        const idx = stepOrder.indexOf(value.toLowerCase());
        if (idx >= 0) return idx;
      }
      return 0;
    };

    const resolveStartWord = (value, words) => {
      if (!value || !Array.isArray(words)) return null;
      const target = String(value).toLowerCase();
      return words.find((word) => String(word).toLowerCase() === target) || null;
    };

    const normalizeHintLocale = (locale) => {
      const normalized = String(locale || '').trim().toLowerCase();
      return normalized === 'es' || normalized === 'en' ? normalized : '';
    };

    const getBaseHintLocale = () => {
      const fromState = getAppLocale() || (window.varGlobal && window.varGlobal.locale) || 'en';
      return normalizeHintLocale(resolveCopyLocale(fromState)) || 'en';
    };

    const getHintUiLocale = (baseLocale = getBaseHintLocale()) => {
      const override = normalizeHintLocale(hintLocaleOverride);
      if (override) return override;
      return normalizeHintLocale(baseLocale) || 'en';
    };

    const getHintSpeechLocale = (locale = getHintUiLocale()) => {
      return normalizeHintLocale(locale) === 'es' ? 'es-ES' : 'en-US';
    };

    const getLocalizedSessionTitle = (session, locale = getHintUiLocale()) => {
      return getLocalizedContentField(session, 'title', locale) || '';
    };

    const getLocalizedStepTitle = (stepSource, locale = getHintUiLocale()) => {
      return getLocalizedContentField(stepSource, 'title', locale) || '';
    };

    const readHintLineByLocale = (source, locale, lineIndex) => {
      if (!source || typeof source !== 'object') return '';
      const safeLocale = normalizeHintLocale(locale) || 'en';
      const line = Number(lineIndex) === 2 ? '2' : '1';
      return String(source[`hint_${safeLocale}_line${line}`] || '').trim();
    };

    const getHintTextForLocale = (source, locale, options = {}) => {
      const localeCode = normalizeHintLocale(locale) || 'en';
      const fallbackLocale = localeCode === 'en' ? 'es' : 'en';
      const usePerLineFallback = options && options.perLineFallback === true;
      const line1Primary = readHintLineByLocale(source, localeCode, 1);
      const line2Primary = readHintLineByLocale(source, localeCode, 2);
      if (!usePerLineFallback) {
        const parts = [line1Primary, line2Primary].filter(Boolean);
        return parts.join('\n');
      }
      const line1Fallback = readHintLineByLocale(source, fallbackLocale, 1);
      const line2Fallback = readHintLineByLocale(source, fallbackLocale, 2);
      const line1 = line1Primary || line1Fallback;
      const line2 = line2Primary || line2Fallback;
      const parts = [line1, line2].filter(Boolean);
      return parts.join('\n');
    };

    const resolveHeroHintText = (source, locale = getHintUiLocale()) => {
      const localeCode = normalizeHintLocale(locale) || 'en';
      const primary = getHintTextForLocale(source, localeCode, { perLineFallback: true });
      if (primary) return primary;
      const fallbackLocale = localeCode === 'en' ? 'es' : 'en';
      const fallback = getHintTextForLocale(source, fallbackLocale);
      return fallback || '';
    };

    const getHeroSourceByStepKey = (stepKey) => {
      if (stepKey === 'sound') return soundStep;
      if (stepKey === 'spelling') return spellingStep;
      if (stepKey === 'sentence') return sentenceStep;
      return null;
    };

    const renderHeroFlagButton = (locale = getHintUiLocale()) => {
      if (!heroFlagBtn || !heroFlagImgEl) return;
      const currentLocale = normalizeHintLocale(locale) || getHintUiLocale();
      const currentMeta = getLocaleMeta(currentLocale);
      const nextLocaleCode = getNextLocaleCode(currentLocale);
      const nextMeta = getLocaleMeta(nextLocaleCode);
      const toggleLabel = `Switch language to ${nextMeta.label}`;
      heroFlagImgEl.setAttribute('src', currentMeta.flag);
      heroFlagImgEl.setAttribute('alt', currentMeta.alt);
      heroFlagBtn.setAttribute('aria-label', toggleLabel);
      heroFlagBtn.setAttribute('title', toggleLabel);
    };

    const toggleHintLocaleFromFlag = () => {
      const baseLocale = getBaseHintLocale();
      const currentLocale = getHintUiLocale(baseLocale);
      const nextLocale = getNextLocaleCode(currentLocale);
      hintLocaleOverride = nextLocale === baseLocale ? '' : nextLocale;
      const uiLocale = getHintUiLocale(baseLocale);
      activeHintLocale = uiLocale;
      renderHeroFlagButton(uiLocale);
      if (showSummary && summaryState) {
        summaryState = localizeExistingSummaryState(summaryState, uiLocale);
      }
      renderStep();
      clearHeroNarrationTimer();
      stopHeroNarration().catch(() => {});
    };

    const applyHeroSource = (source, options = {}) => {
      if (!heroStepTitleEl || !heroHintEl) return;
      if (heroHintEl.dataset) {
        delete heroHintEl.dataset.narrationToken;
      }
      const locale = normalizeHintLocale(options.locale) || activeHintLocale || getHintUiLocale();
      heroStepTitleEl.textContent = getLocalizedStepTitle(source, locale);
      // Display fixed narration text in the visible bubble — also used for TTS
      const speakCopy = getSpeakCopyBundle(locale);
      const heroText = (speakCopy && speakCopy.heroNarration) || "Let's keep practicing!";
      if (heroHintDisplayEl) {
        heroHintDisplayEl.textContent = heroText;
        heroHintDisplayEl.hidden = false;
      }
      // heroHintEl (hidden) carries the same text for TTS playback
      if (heroHintEl) heroHintEl.textContent = heroText;
      const lines = extractHeroNarrationLines(heroText);
      const restLineText = String(lines[0] && lines[0].text ? lines[0].text : '').trim();
      if (lines.length > 1) {
        const maxHeight = measureHeroHintMaxHeight(lines);
        heroHintEl.style.minHeight = maxHeight > 0 ? `${maxHeight}px` : '';
      } else {
        heroHintEl.style.minHeight = '';
      }
    };

    const lockHeroCardHeight = () => {
      if (!heroCardEl || !heroStepTitleEl || !heroHintEl) return;
      const sources = [soundStep, spellingStep, sentenceStep].filter(Boolean);
      if (!sources.length) return;

      const prevHidden = heroCardEl.hidden;
      const prevVisibility = heroCardEl.style.visibility;
      const prevPointerEvents = heroCardEl.style.pointerEvents;
      const prevTitle = heroStepTitleEl.textContent;
      const prevHint = heroHintEl.textContent;
      const prevHintHidden = heroHintEl.hidden;
      const prevHintMinHeight = heroHintEl.style.minHeight;
      const prevMinHeight = heroCardEl.style.minHeight;

      heroCardEl.hidden = false;
      heroCardEl.style.visibility = 'hidden';
      heroCardEl.style.pointerEvents = 'none';
      heroCardEl.style.minHeight = '';

      let maxHeight = 0;
      sources.forEach((source) => {
        applyHeroSource(source);
        const nextHeight = Math.ceil(
          Math.max(heroCardEl.scrollHeight || 0, heroCardEl.getBoundingClientRect().height || 0)
        );
        if (nextHeight > maxHeight) {
          maxHeight = nextHeight;
        }
      });

      heroStepTitleEl.textContent = prevTitle;
      heroHintEl.textContent = prevHint;
      heroHintEl.hidden = prevHintHidden;
      heroHintEl.style.minHeight = prevHintMinHeight;
      heroCardEl.hidden = prevHidden;
      heroCardEl.style.visibility = prevVisibility;
      heroCardEl.style.pointerEvents = prevPointerEvents;

      if (maxHeight > 0) {
        heroCardLockedHeight = maxHeight;
        heroCardEl.style.minHeight = `${heroCardLockedHeight}px`;
      } else {
        heroCardEl.style.minHeight = prevMinHeight;
      }
    };

    const applySessionData = (nextSelection = getSelection()) => {
      const { session } = resolveSelection(nextSelection);
      if (!session || !session.speak) return;
      heroFirstRenderAt = Date.now();
      currentSessionId = session.id;
      currentSessionData = session;
      sessionTitle = getLocalizedSessionTitle(session, getHintUiLocale(getBaseHintLocale()));
      if (sessionTitleEl) sessionTitleEl.textContent = sessionTitle;
      if (headerTitleEl) headerTitleEl.textContent = sessionTitle;
      focusKey = session.focus || (session.speak && session.speak.focus) || '';
      hintLocaleOverride = '';
      activeHintLocale = getHintUiLocale(getBaseHintLocale());
      soundStep = session.speak.sound;
      spellingStep = session.speak.spelling;
      sentenceStep = session.speak.sentence;
      const startStep =
        window.r34lp0w3r && window.r34lp0w3r.speakStartStep !== undefined
          ? window.r34lp0w3r.speakStartStep
          : null;
      const startWord =
        window.r34lp0w3r && window.r34lp0w3r.speakStartWord !== undefined
          ? window.r34lp0w3r.speakStartWord
          : null;
      const spellingWords =
        spellingStep && Array.isArray(spellingStep.words) ? spellingStep.words : [];
      const matchedWord = resolveStartWord(startWord, spellingWords);
      selectedWord = matchedWord || (spellingWords.length ? spellingWords[0] : '');
      stepIndex = startStep !== null ? resolveStartStepIndex(startStep) : 0;
      lastHeroNarratedStepKey = '';
      showSummary = false;
      summaryState = null;
      lastSummaryAudioCue = '';
      progressUpdatedThisRun = false;
      stopHeroNarration().catch(() => {});
      resetStepState();
      syncSpellingStateFromStore(selectedWord);
      syncSentenceStateFromStore();
      if (window.r34lp0w3r) {
        window.r34lp0w3r.speakStartStep = null;
        window.r34lp0w3r.speakStartWord = null;
      }
      lockHeroCardHeight();
      renderStep();
    };

    const renderSoundStep = () => {
      currentPronunciationAvatarConfig = getPronunciationAvatarConfig();
      const avatarConfig = currentPronunciationAvatarConfig;
      const locale = activeHintLocale || getHintUiLocale();
      const score = getScoreForStep('sound', locale);
      const hasRecording = Boolean(stepState.sound.recordingUrl);
      const transcribing = isTranscribingStep('sound');
      const showPercentages = areSpeakSessionPercentagesVisible();
      const percent = transcribing ? '' : score && hasRecording ? score.percent : '';
      const tone = transcribing ? 'hint' : score && hasRecording ? score.tone : 'hint';
      const voiceTone = !transcribing && score && hasRecording ? tone : '';
      const label = transcribing
        ? getSpeakUiText('transcribing', locale, 'Transcribing...')
        : score && hasRecording
        ? score.label
        : getSpeakUiText('practiceSound', locale, 'Practice the sound');
      const percentMarkup = showPercentages && percent !== '' ? `${percent}%` : '';
      const noPercentClass = !showPercentages ? ' speak-score-no-percent' : '';
      const displayText = getSoundDisplayText();

      const stepTitle = getSpeakUiText('stepTitleSound', locale, 'Listen carefully and Say');
      const stepSubtitle = resolveHeroHintText(soundStep, locale);
      return `
        <div class="speak-step speak-step-sound">
          <p class="speak-step-heading">${stepTitle}</p>
          ${stepSubtitle ? `<p class="speak-step-subtitle">${stepSubtitle}</p>` : ''}
          <div class="speak-step-main">
            <div class="speak-avatar-stage">
              <div class="speak-avatar">
                <div class="${avatarConfig.wrapperClass}" data-avatar-ratio="${avatarConfig.aspectRatio}">
                  <img class="avatar-head" src="${avatarConfig.headSrc}" alt="Avatar">
                  <div class="avatar-mouth-container">
                    <img
                      id="speak-mouth-a"
                      class="${avatarConfig.mouthBaseClass} mouth-layer mouth-layer-active viseme-neutral"
                      src="${avatarConfig.mouthMap.NEUTRAL}"
                      alt="Mouth"
                    />
                    <img
                      id="speak-mouth-b"
                      class="${avatarConfig.mouthBaseClass} mouth-layer viseme-neutral"
                      src="${avatarConfig.mouthMap.NEUTRAL}"
                      alt="Mouth"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div class="speak-phonetic">
              <button class="speak-play-btn speak-play-btn--wide" id="speak-play-ref" type="button">
                <ion-icon name="volume-high"></ion-icon>
                <span>${(getSpeakCopyBundle(locale) || {}).listen || 'Listen'}</span>
              </button>
              <span class="speak-phonetic-text" id="speak-phonetic-text">
                ${highlightLetter(displayText, focusKey)}
              </span>
            </div>

          </div>

          ${renderBottomPanel('sound', { hasVoiceRecording: hasRecording, voiceTone, scoreHtml: `<div class="speak-score speak-score-${tone}${noPercentClass}"><div class="speak-score-label">${label}</div><div class="speak-score-value">${percentMarkup}</div></div>` })}
        </div>
      `;
    };

    const renderSpellingStep = () => {
      const locale = activeHintLocale || getHintUiLocale();
      const stored = getStoredWordResult(currentSessionId, selectedWord);
      const hasScore = stored && typeof stored.percent === 'number';
      const transcribing = isTranscribingStep('spelling');
      const showPercentages = areSpeakSessionPercentagesVisible();
      const hasRecording = Boolean(stepState.spelling.recordingUrl);
      const percent = transcribing ? null : hasScore ? stored.percent : null;
      const tone = transcribing ? 'hint' : hasScore ? getScoreTone(percent, locale) : 'hint';
      const voiceTone = !transcribing && hasRecording && hasScore ? tone : '';
      const label = transcribing
        ? getSpeakUiText('transcribing', locale, 'Transcribing...')
        : hasScore
        ? getScoreLabel(percent, locale, `spelling:${selectedWord}:${percent}`)
        : getSpeakUiText('practiceWords', locale, 'Practice the words');
      const percentMarkup = showPercentages && percent !== null ? `${percent}%` : '';
      const noPercentClass = !showPercentages ? ' speak-score-no-percent' : '';

      const words = spellingStep.words
        .map((word) => {
          const result = getStoredWordResult(currentSessionId, word);
          const wordTone =
            result && typeof result.percent === 'number' ? getScoreTone(result.percent, locale) : '';
          const toneClass = wordTone ? `speak-word-tone-${wordTone}` : '';
          const toneIcon = wordTone === 'good' ? '<span class="speak-word-icon">✓</span>'
            : wordTone === 'bad' ? '<span class="speak-word-icon">✕</span>'
            : wordTone === 'okay' ? '<span class="speak-word-icon">~</span>'
            : '';
          return `
            <button class="speak-word ${toneClass} ${word === selectedWord ? 'is-active' : ''}" data-word="${word}" type="button">
              <span>${highlightLetter(word, focusKey)}</span>
              ${toneIcon}
            </button>
          `;
        })
        .join('');

      const stepTitle = getSpeakUiText('stepTitleSpelling', locale, 'Say the sound in words');
      return `
        <div class="speak-step speak-step-spelling">
          <p class="speak-step-heading">${stepTitle}</p>
          <div class="speak-step-main">
            <div class="speak-word-grid speak-word-grid--single">${words}</div>
          </div>

          ${renderBottomPanel('spelling', { hasVoiceRecording: hasRecording, voiceTone, scoreHtml: `<div class="speak-score speak-score-${tone}${noPercentClass}"><div class="speak-score-label">${label}</div><div class="speak-score-value">${percentMarkup}</div></div>` })}
        </div>
      `;
    };

    const renderSentenceStep = () => {
      const locale = activeHintLocale || getHintUiLocale();
      const score = getScoreForStep('sentence', locale);
      const hasScore = score && typeof score.percent === 'number';
      const transcribing = isTranscribingStep('sentence');
      const showPercentages = areSpeakSessionPercentagesVisible();
      const hasRecordingUrl = Boolean(stepState.sentence.recordingUrl);
      const percent = transcribing ? '' : hasScore ? score.percent : '';
      const tone = transcribing ? 'hint' : hasScore ? score.tone : 'hint';
      const voiceTone = !transcribing && hasRecordingUrl && hasScore ? tone : '';
      const label = transcribing
        ? getSpeakUiText('transcribing', locale, 'Transcribing...')
        : hasScore
        ? score.label
        : getSpeakUiText('practicePhrase', locale, 'Practice the phrase');
      const sentenceScorePercentMarkup = showPercentages ? `${percent}%` : '';
      const sentenceScoreLine = hasScore && !transcribing
        ? `
          <div class="speak-score-line ${tone}">
            <div class="speak-score-line-value">${sentenceScorePercentMarkup}</div>
          </div>
        `
        : '';

      const stepTitle = getSpeakUiText('stepTitleSentence', locale, 'Say a whole sentence');
      return `
        <div class="speak-step speak-step-sentence">
          <p class="speak-step-heading">${stepTitle}</p>
          <div class="speak-step-main">
            <button class="speak-sentence" id="speak-play-sentence" type="button">
              <span id="speak-sentence-text">${highlightSentence(sentenceStep.sentence, focusKey)}</span>
            </button>
            ${sentenceScoreLine}
          </div>

          ${renderBottomPanel('sentence', { hasVoiceRecording: hasRecordingUrl, voiceTone, scoreHtml: `<div class="speak-score speak-score-${tone}${showPercentages ? '' : ' speak-score-no-percent'}"><div class="speak-score-label">${label}</div><div class="speak-score-value">${sentenceScorePercentMarkup}</div></div>` })}
        </div>
      `;
    };

    const buildSummaryConfettiHtml = (count = 34) => {
      const palette = ['#22c55e', '#3b82f6', '#f59e0b', '#fb7185', '#a855f7', '#0ea5e9', '#14b8a6'];
      return Array.from({ length: count }, (_, index) => {
        const left = 3 + Math.random() * 94;
        const drift = -54 + Math.random() * 108;
        const delay = Math.random() * 380;
        const duration = 720 + Math.random() * 720;
        const size = 6 + Math.random() * 7;
        const angleStart = -34 + Math.random() * 68;
        const angleEnd = angleStart + (-180 + Math.random() * 360);
        const color = palette[index % palette.length];
        return `<span class="summary-confetti-piece" style="--left:${left.toFixed(
          2
        )}%;--dx:${drift.toFixed(1)}px;--delay:${delay.toFixed(0)}ms;--dur:${duration.toFixed(
          0
        )}ms;--size:${size.toFixed(1)}px;--rot0:${angleStart.toFixed(1)}deg;--rot1:${angleEnd.toFixed(
          1
        )}deg;--h:${color};"></span>`;
      }).join('');
    };

    const renderSummaryStep = () => {
      const locale = activeHintLocale || getHintUiLocale();
      const summary = summaryState || rollSummaryOutcome(locale);
      summaryState = summary;
      playSummaryToneSound(summary);
      const percent = summary.percent;
      const tone = summary.tone;
      const phrase = summary.phrase;
      const showPercentages = areSpeakSessionPercentagesVisible();
      const hasReward =
        typeof summary.rewardQty === 'number' &&
        summary.rewardQty > 0 &&
        typeof summary.rewardLabel === 'string' &&
        summary.rewardLabel.trim();
      const rewardLabel = hasReward
        ? `${summary.labelPrefix} ${summary.rewardQty} ${summary.rewardLabel}`
        : '';
      const badgeUnlockedTemplate = getSpeakUiText(
        'summaryBadgeUnlocked',
        locale,
        'Badge unlocked: {route}'
      );
      const badgeLabel =
        summary.awardedBadge && summary.awardedBadge.routeTitle
          ? badgeUnlockedTemplate.replace(/\{route\}/g, summary.awardedBadge.routeTitle)
          : '';
      const summaryTitle = getSummaryTitle(tone, sessionTitle, locale);
      const showConfetti = tone === 'good';
      const mascotToneClass = showConfetti ? 'mascot-confetti' : '';
      const summaryPercentMarkup = showPercentages ? `<span>${percent}%</span>` : '';
      const confettiMarkup = showConfetti ? buildSummaryConfettiHtml(40) : '';
      const continueLabel = getSpeakUiText('summaryContinue', locale, 'Continue');
      const resultBannerText = getSpeakUiText('resultBanner', locale, 'Result');
      return `
        <div class="speak-step speak-step-summary">
          <div class="speak-route-banner speak-route-banner--result" aria-hidden="true">${resultBannerText}</div>
          <div class="speak-step-summary-body">
          <div class="summary-stage ${showConfetti ? 'is-tone-good' : ''}">
            ${showConfetti ? `<div class="summary-confetti" aria-hidden="true">${confettiMarkup}</div>` : ''}
            <div class="summary-panel summary-panel-${tone}">
              <div class="summary-panel-inner">
                <div class="mascot-cat mascot-large ${mascotToneClass}"></div>
                <div class="summary-title">${summaryTitle}</div>
                <div class="summary-score ${tone}">
                  <ion-icon name="checkmark-circle"></ion-icon>
                  ${summaryPercentMarkup}
                </div>
                <div class="summary-feedback ${tone}">${phrase}</div>
                ${
                  hasReward
                    ? `<div class="summary-reward">
                  <div class="summary-reward-label">${rewardLabel}</div>
                  <ion-icon name="${summary.rewardIcon}"></ion-icon>
                </div>`
                    : ''
                }
                ${badgeLabel ? `<div class="summary-badge-earned">${badgeLabel}</div>` : ''}
              </div>
            </div>
          </div>
          <button class="speak-next-btn speak-next-btn--summary" id="speak-next-step" type="button">${continueLabel}</button>
          </div>
        </div>
      `;
    };

    const renderStepMarkup = (key) => {
      if (key === 'sound') return renderSoundStep();
      if (key === 'spelling') return renderSpellingStep();
      if (key === 'sentence') return renderSentenceStep();
      return '';
    };

    const updateHeroCard = (stepKey) => {
      if (!heroCardEl || !heroStepTitleEl || !heroHintEl) return;
      if (showSummary) {
        heroCardEl.hidden = true;
        if (routeBannerEl) routeBannerEl.hidden = true;
        swipeSurface?.classList.add('has-summary');
        lastHeroNarratedStepKey = '';
        stopHeroNarration().catch(() => {});
        if (debugToggleBtn) {
          debugToggleBtn.hidden = true;
          debugToggleBtn.classList.remove('is-active');
          debugToggleBtn.setAttribute('aria-pressed', 'false');
        }
        return;
      }
      if (routeBannerEl) routeBannerEl.hidden = false;
      swipeSurface?.classList.remove('has-summary');
      heroCardEl.hidden = false;
      const uiLocale = getHintUiLocale(getBaseHintLocale());
      activeHintLocale = uiLocale;
      renderHeroFlagButton(uiLocale);
      const source = getHeroSourceByStepKey(stepKey);
      const debugEnabled = isSpeakDebugEnabled();
      if (debugToggleBtn) {
        debugToggleBtn.hidden = !debugEnabled;
        debugToggleBtn.classList.toggle('is-active', debugEnabled && debugPanelOpen);
        debugToggleBtn.setAttribute('aria-pressed', debugEnabled && debugPanelOpen ? 'true' : 'false');
      }
      applyHeroSource(source, { locale: uiLocale });
      sessionTitle = getLocalizedSessionTitle(currentSessionData, uiLocale);
      if (sessionTitleEl) sessionTitleEl.textContent = sessionTitle || '';
      if (headerTitleEl) headerTitleEl.textContent = sessionTitle || '';
      if (routeBannerEl) {
        const speakCopy = getSpeakCopyBundle(uiLocale);
        const stepBannerTemplate = speakCopy && speakCopy.stepBanner ? speakCopy.stepBanner : 'Step {step} of {total}';
        const bannerPrefix = stepBannerTemplate
          .replace('{step}', stepIndex + 1)
          .replace('{total}', stepOrder.length);
        const stepSource = getHeroSourceByStepKey(stepKey);
        const stepTitle = getLocalizedStepTitle(stepSource, uiLocale);
        routeBannerEl.textContent = stepTitle ? `${bannerPrefix} – ${stepTitle}` : bannerPrefix;
      }
      if (stepKey !== lastHeroNarratedStepKey) {
        lastHeroNarratedStepKey = stepKey;
      }
    };

    const sanitizeGhostMarkup = (markup) => {
      if (!markup) return '';
      const container = document.createElement('div');
      container.innerHTML = markup;
      container.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
      return container.innerHTML;
    };

    const resetSwipeStageHeight = () => {
      if (swipeStage) {
        swipeStage.style.minHeight = '';
      }
    };

    const updateSwipeStageHeight = () => {
      if (!swipeStage) return;
      const activeHeight = stepRoot
        ? Math.max(stepRoot.scrollHeight || 0, stepRoot.getBoundingClientRect().height || 0)
        : 0;
      const ghostContent = ghostRoot ? ghostRoot.firstElementChild : null;
      const ghostTarget = ghostContent || ghostRoot;
      const ghostHeight = ghostTarget
        ? Math.max(ghostTarget.scrollHeight || 0, ghostTarget.getBoundingClientRect().height || 0)
        : 0;
      const target = Math.max(activeHeight, ghostHeight);
      if (target) {
        swipeStage.style.minHeight = `${Math.ceil(target)}px`;
      }
    };

    const disconnectAvatarResizeObserver = () => {
      if (!avatarResizeObserver) return;
      avatarResizeObserver.disconnect();
      avatarResizeObserver = null;
    };

    const AVATAR_TARGET_SIDE_MARGIN_PX = 28;
    const AVATAR_EXTRA_HEIGHT_BUDGET_PX = 72;

    const fitAvatarToStage = (root) => {
      const stage = root?.querySelector('.speak-avatar-stage');
      const wrapper = root?.querySelector('.avatar-wrapper, .avatar-wrapper-wide');
      if (!stage || !wrapper) return;
      const stageStyles = window.getComputedStyle(stage);
      const paddingX =
        (parseFloat(stageStyles.paddingLeft) || 0) + (parseFloat(stageStyles.paddingRight) || 0);
      const paddingY =
        (parseFloat(stageStyles.paddingTop) || 0) + (parseFloat(stageStyles.paddingBottom) || 0);
      const availableWidth = Math.max(0, stage.clientWidth - paddingX);
      const availableHeight = Math.max(0, stage.clientHeight - paddingY);
      if (!availableWidth || !availableHeight) return;
      const ratioRaw = Number(wrapper.dataset.avatarRatio || 1);
      const ratio = Number.isFinite(ratioRaw) && ratioRaw > 0 ? ratioRaw : 1;
      let targetWidth = availableWidth;
      let targetHeight = targetWidth / ratio;
      if (targetHeight > availableHeight) {
        targetHeight = availableHeight;
        targetWidth = targetHeight * ratio;
      }
      const widthByPreferredMargin = Math.max(0, availableWidth - AVATAR_TARGET_SIDE_MARGIN_PX * 2);
      const heightByPreferredMargin = widthByPreferredMargin / ratio;
      const relaxedMaxHeight = availableHeight + AVATAR_EXTRA_HEIGHT_BUDGET_PX;
      if (widthByPreferredMargin > targetWidth && heightByPreferredMargin <= relaxedMaxHeight) {
        targetWidth = widthByPreferredMargin;
        targetHeight = heightByPreferredMargin;
      } else if (widthByPreferredMargin > targetWidth && relaxedMaxHeight > targetHeight) {
        targetHeight = relaxedMaxHeight;
        targetWidth = targetHeight * ratio;
      }
      if (targetWidth > availableWidth) {
        targetWidth = availableWidth;
        targetHeight = targetWidth / ratio;
      }
      wrapper.style.width = `${Math.max(0, Math.floor(targetWidth))}px`;
      wrapper.style.height = `${Math.max(0, Math.floor(targetHeight))}px`;
    };

    const scheduleAvatarFit = (root, afterFit = null) => {
      requestAnimationFrame(() => {
        fitAvatarToStage(root);
        requestAnimationFrame(() => {
          fitAvatarToStage(root);
          if (typeof afterFit === 'function') afterFit();
        });
      });
    };

    const observeAvatarStage = (root) => {
      disconnectAvatarResizeObserver();
      if (typeof ResizeObserver !== 'function') return;
      const stage = root?.querySelector('.speak-avatar-stage');
      if (!stage) return;
      avatarResizeObserver = new ResizeObserver(() => {
        fitAvatarToStage(root);
      });
      avatarResizeObserver.observe(stage);
    };

    const renderStep = () => {
      const key = getStepKey();
      const shouldFitAvatar = !showSummary && key === 'sound';
      if (swipeStage) {
        swipeStage.classList.remove('is-swiping');
        swipeStage.style.minHeight = '';
      }
      if (ghostRoot) {
        ghostRoot.innerHTML = '';
        ghostRoot.style.opacity = '0';
        ghostRoot.style.transform = '';
        ghostRoot.style.transition = '';
      }
      if (stepRoot) {
        stepRoot.style.transition = '';
      }
      updateHeroCard(key);
      if (!stepRoot) return;
      if (showSummary) {
        stepRoot.innerHTML = renderSummaryStep();
      } else if (key === 'sound') {
        stepRoot.innerHTML = renderSoundStep();
      } else if (key === 'spelling') {
        stepRoot.innerHTML = renderSpellingStep();
      } else if (key === 'sentence') {
        stepRoot.innerHTML = renderSentenceStep();
      } else {
        stepRoot.innerHTML = renderSummaryStep();
      }
      stepRoot.style.transform = '';

      bindStepControls();
      if (shouldFitAvatar) {
        observeAvatarStage(stepRoot);
        scheduleAvatarFit(stepRoot);
      } else {
        disconnectAvatarResizeObserver();
      }
    };

    const bindStepControls = () => {
      const playRefBtn = stepRoot.querySelector('#speak-play-ref');
      const playWordBtn = stepRoot.querySelector('#speak-play-word');
      const playSentenceBtn = stepRoot.querySelector('#speak-play-sentence');
      const recordBtn = stepRoot.querySelector('#speak-record');
      const voiceBtn = stepRoot.querySelector('#speak-voice');
      const nextStepBtn = stepRoot.querySelector('#speak-next-step');
      const prevInlineBtn = stepRoot.querySelector('#speak-prev-inline');
      const nextInlineBtn = stepRoot.querySelector('#speak-next-inline');
      const debugPrevBtn = stepRoot.querySelector('#speak-debug-prev');
      const debugNextBtn = stepRoot.querySelector('#speak-debug-next');
      const wordButtons = Array.from(stepRoot.querySelectorAll('.speak-word'));

      mouthImgA = stepRoot.querySelector('#speak-mouth-a');
      mouthImgB = stepRoot.querySelector('#speak-mouth-b');
      if (mouthImgA && mouthImgB) {
        currentPronunciationAvatarConfig = getPronunciationAvatarConfig();
        activeMouth = mouthImgA;
        inactiveMouth = mouthImgB;
      }

      phoneticTextEl = stepRoot.querySelector('#speak-phonetic-text');
      sentenceTextEl = stepRoot.querySelector('#speak-sentence-text');

      playRefBtn?.addEventListener('click', () => {
        if (soundStep && soundStep.expected) {
          const phonetic =
            soundStep.phonetic && usesPhoneticDisplay(soundStep.phonetic, soundStep.expected)
              ? soundStep.phonetic
              : '';
          playReferenceAudio({
            text: soundStep.expected,
            targetEl: phoneticTextEl,
            phonetic,
            withVisemes: true,
            triggerBtn: playRefBtn
          });
          return;
        }
        if (soundStep && soundStep.phonetic) {
          playTts(soundStep.phonetic, playRefBtn);
        }
      });

      playSentenceBtn?.addEventListener('click', () => {
        if (sentenceStep && sentenceStep.sentence) {
          playReferenceAudio({
            text: sentenceStep.sentence,
            targetEl: sentenceTextEl,
            withVisemes: false,
            triggerBtn: playSentenceBtn
          });
        }
      });

      playWordBtn?.addEventListener('click', () => {
        if (!selectedWord) return;
        playReferenceAudio({
          text: selectedWord,
          withVisemes: false,
          triggerBtn: playWordBtn
        });
      });

      recordBtn?.addEventListener('click', () => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          stopRecording();
          return;
        }
        startRecording();
      });

      voiceBtn?.addEventListener('click', () => {
        playRecording();
      });

      prevInlineBtn?.addEventListener('click', () => {
        prevStep();
      });

      nextInlineBtn?.addEventListener('click', () => {
        nextStep();
      });

      debugPrevBtn?.addEventListener('click', () => {
        prevStep();
      });

      debugNextBtn?.addEventListener('click', () => {
        nextStep();
      });

      nextStepBtn?.addEventListener('click', () => {
        nextStep();
      });

      wordButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const word = btn.dataset.word;
          if (!word) return;
          stopPlayback();
          stopAvatarPlayback();
          selectedWord = word;
          syncSpellingStateFromStore(word);
          renderStep();
          const nextPlayWordBtn = stepRoot.querySelector('#speak-play-word');
          playReferenceAudio({
            text: selectedWord,
            withVisemes: false,
            triggerBtn: nextPlayWordBtn || null
          });
        });
      });

      const toneButtons = Array.from(stepRoot.querySelectorAll('.speak-debug-tone'));
      toneButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const tone = btn.dataset.tone;
          if (!tone) return;
          const key = getStepKey();
          if (tone === 'reset') {
            if (key === 'spelling') {
              const word =
                selectedWord ||
                (spellingStep && Array.isArray(spellingStep.words) ? spellingStep.words[0] : '');
              if (word) {
                clearStoredWordResult(currentSessionId, word);
                syncSpellingStateFromStore(word);
              }
            } else if (key === 'sentence') {
              clearStoredPhraseResult(currentSessionId);
              syncSentenceStateFromStore();
            } else if (key === 'sound' && stepState.sound) {
              stepState.sound.percent = null;
              stepState.sound.transcript = '';
            }
            renderStep();
            return;
          }
          const toneMax = getToneMaxValues();
          const percent = toneMax[tone];
          if (typeof percent !== 'number') return;
          if (key === 'spelling') {
            const word =
              selectedWord ||
              (spellingStep && Array.isArray(spellingStep.words) ? spellingStep.words[0] : '');
            if (!word) return;
            setStoredWordResult(currentSessionId, word, {
              percent,
              transcript: stepState.spelling ? stepState.spelling.transcript : ''
            });
            syncSpellingStateFromStore(word);
          } else if (key === 'sentence') {
            setStoredPhraseResult(currentSessionId, {
              percent,
              transcript: stepState.sentence ? stepState.sentence.transcript : ''
            });
            syncSentenceStateFromStore();
          } else if (key === 'sound') {
            stepState.sound.percent = percent;
          }
          renderStep();
        });
      });

      updateRecordUi();
    };

    const resetSwipeState = () => {
      swipeActive = false;
      swipeDragging = false;
      swipeDirection = 0;
      swipeWidth = 0;
      swipeCurrentX = 0;
      swipeStartTime = 0;
    };

    const resolveSwipeWidth = () => {
      if (swipeStage) {
        const rect = swipeStage.getBoundingClientRect();
        if (rect && rect.width) return rect.width;
      }
      if (swipeSurface) {
        const rect = swipeSurface.getBoundingClientRect();
        if (rect && rect.width) return rect.width;
      }
      const fallback = window.innerWidth || document.documentElement.clientWidth || 0;
      return fallback || 1;
    };

    const getSwipeTargetKey = (direction) => {
      const nextIndex = stepIndex + direction;
      if (nextIndex < 0 || nextIndex >= stepOrder.length) return '';
      return stepOrder[nextIndex];
    };

    const prepareSwipeGhost = (direction) => {
      if (!ghostRoot) return false;
      const key = getSwipeTargetKey(direction);
      if (!key) return false;
      ghostRoot.innerHTML = sanitizeGhostMarkup(renderStepMarkup(key));
      ghostRoot.style.opacity = '1';
      updateSwipeStageHeight();
      scheduleAvatarFit(ghostRoot, updateSwipeStageHeight);
      return true;
    };

    const setSwipeTransition = (enabled) => {
      const value = enabled ? 'transform 240ms ease' : 'none';
      if (stepRoot) stepRoot.style.transition = value;
      if (ghostRoot) ghostRoot.style.transition = value;
    };

    const setSwipeTransforms = (dx) => {
      if (!stepRoot || !swipeWidth) return;
      stepRoot.style.transform = `translateX(${dx}px)`;
      if (ghostRoot && swipeDirection) {
        ghostRoot.style.transform = `translateX(${dx + swipeDirection * swipeWidth}px)`;
      }
    };

    const resetSwipeVisuals = () => {
      setSwipeTransition(false);
      if (stepRoot) {
        stepRoot.style.transform = '';
      }
      if (ghostRoot) {
        ghostRoot.style.transform = '';
        ghostRoot.style.opacity = '0';
        ghostRoot.innerHTML = '';
      }
      if (swipeStage) {
        swipeStage.classList.remove('is-swiping');
      }
      resetSwipeStageHeight();
    };

    const finalizeSwipe = (commit) => {
      if (swipeAnimating) return;
      swipeAnimating = true;
      const direction = swipeDirection;
      const width = swipeWidth || resolveSwipeWidth();
      const targetX = commit ? (direction === 1 ? -width : width) : 0;
      setSwipeTransition(true);
      requestAnimationFrame(() => {
        setSwipeTransforms(targetX);
      });

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        if (stepRoot) {
          stepRoot.removeEventListener('transitionend', onEnd);
        }
        swipeAnimating = false;
        if (commit) {
          if (direction === 1) {
            nextStep();
          } else {
            prevStep();
          }
        } else {
          resetSwipeVisuals();
        }
        resetSwipeState();
      };

      const onEnd = (event) => {
        if (event && event.propertyName !== 'transform') return;
        finish();
      };

      if (stepRoot) {
        stepRoot.addEventListener('transitionend', onEnd);
      }
      setTimeout(finish, 260);
    };

    const handleSwipeStart = (event) => {
      if (showSummary || swipeAnimating) return;
      if (!event.touches || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const width = window.innerWidth || document.documentElement.clientWidth || 0;
      if (width && (touch.clientX <= SWIPE_EDGE_GUARD || touch.clientX >= width - SWIPE_EDGE_GUARD)) {
        return;
      }
      swipeStartX = touch.clientX;
      swipeStartY = touch.clientY;
      swipeStartTime = Date.now();
      swipeActive = true;
      swipeDragging = false;
      swipeDirection = 0;
      swipeCurrentX = 0;
      swipeWidth = resolveSwipeWidth();
      if (ghostRoot) {
        ghostRoot.innerHTML = '';
        ghostRoot.style.opacity = '0';
        ghostRoot.style.transform = '';
      }
    };

    const handleSwipeMove = (event) => {
      if (!swipeActive || showSummary || swipeAnimating) return;
      if (!event.touches || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const dx = touch.clientX - swipeStartX;
      const dy = touch.clientY - swipeStartY;

      if (!swipeDragging) {
        if (Math.abs(dx) < SWIPE_DRAG_THRESHOLD && Math.abs(dy) < SWIPE_DRAG_THRESHOLD) {
          return;
        }
        if (Math.abs(dx) < Math.abs(dy) * SWIPE_VERTICAL_RATIO) {
          resetSwipeState();
          return;
        }
        const direction = dx < 0 ? 1 : -1;
        if (!getSwipeTargetKey(direction)) {
          resetSwipeState();
          return;
        }
        swipeDragging = true;
        swipeDirection = direction;
        if (!prepareSwipeGhost(direction)) {
          resetSwipeState();
          return;
        }
        if (swipeStage) {
          swipeStage.classList.add('is-swiping');
        }
        setSwipeTransition(false);
      }

      if (!swipeDragging) return;
      const width = swipeWidth || resolveSwipeWidth();
      let clamped = dx;
      if (clamped > width) clamped = width;
      if (clamped < -width) clamped = -width;
      swipeCurrentX = clamped;
      setSwipeTransforms(clamped);
      event.preventDefault();
    };

    const handleSwipeEnd = (event) => {
      if (!swipeActive) return;
      swipeActive = false;
      if (!swipeDragging) {
        resetSwipeState();
        return;
      }
      const touch = event.changedTouches && event.changedTouches[0];
      const dx = swipeCurrentX || (touch ? touch.clientX - swipeStartX : 0);
      const absDx = Math.abs(dx);
      const elapsed = Date.now() - swipeStartTime;
      const velocity = elapsed > 0 ? absDx / elapsed : 0;
      const width = swipeWidth || resolveSwipeWidth();
      const commit = absDx > width * SWIPE_COMMIT_RATIO || velocity > SWIPE_COMMIT_VELOCITY;
      finalizeSwipe(commit);
    };

    const handleSwipeCancel = () => {
      if (!swipeActive) return;
      swipeActive = false;
      if (swipeDragging) {
        finalizeSwipe(false);
        return;
      }
      resetSwipeState();
    };

    const nextStep = () => {
      stopPlayback();
      stopAvatarPlayback();
      stopRecording();
      if (showSummary) {
        const summaryBadgeId = pickFirstText(
          summaryState && summaryState.awardedBadge && summaryState.awardedBadge.id
        );
        if (goBackToReviewIfNeeded()) {
          showBadgePopupSoon(summaryBadgeId, 220);
          return;
        }
        const { route, module, session } = resolveSelection(getSelection());
        if (route && module && session) {
          setSelection({
            routeId: route.id,
            moduleId: module.id,
            sessionId: session.id
          });
        }
        clearPendingHomeReturnRevealTarget();
        showSummary = false;
        summaryState = null;
        lastSummaryAudioCue = '';
        try {
          localStorage.setItem('appv5:active-tab', 'home');
        } catch (err) {
          // no-op
        }
        goToHome('back');
        showBadgePopupSoon(summaryBadgeId, 220);
        return;
      }
      if (stepIndex < stepOrder.length - 1) {
        stepIndex += 1;
        renderStep();
        return;
      }
      showSummary = true;
      summaryState = rollSummaryOutcome(activeHintLocale || getHintUiLocale());
      lastSummaryAudioCue = '';
      renderStep();
    };

    const goBackToReviewIfNeeded = () => {
      if (!window.r34lp0w3r || !window.r34lp0w3r.speakReturnToReview) return false;
      const returnSessionId = window.r34lp0w3r.speakReturnSessionId;
      const canReturn = !returnSessionId || returnSessionId === currentSessionId;
      window.r34lp0w3r.speakReturnToReview = false;
      window.r34lp0w3r.speakReturnSessionId = null;
      if (!canReturn) return false;
      clearPendingHomeReturnRevealTarget();
      window.r34lp0w3r.profileForceTab = 'review';
      try {
        localStorage.setItem('appv5:active-tab', 'tu');
      } catch (err) {
        // no-op
      }
      goToHome('back');
      return true;
    };

    const goBackToRoutes = () => {
      if (goBackToReviewIfNeeded()) return;
      clearPendingHomeReturnRevealTarget();
      try {
        localStorage.setItem('appv5:active-tab', 'home');
      } catch (err) {
        // no-op
      }
      goToHome('back');
    };

    const toggleDebugPanel = () => {
      if (!isSpeakDebugEnabled() || showSummary) return;
      debugPanelOpen = !debugPanelOpen;
      persistDebugPanelOpen(debugPanelOpen);
      stopRecording();
      if (debugPanelOpen) {
        stopPlayback();
        stopAvatarPlayback();
      }
      renderStep();
    };

    const handleHeroCardReplayClick = (event) => {
      if (showSummary || !heroCardEl || heroCardEl.hidden) return;
      const target = event && event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest('button, a, input, textarea, select, label, [role="button"]')) {
        return;
      }
      const source = getHeroSourceByStepKey(getStepKey());
      const locale = activeHintLocale || getHintUiLocale();
      const hint = resolveHeroHintText(source, locale);
      if (!source || !hint) return;
      if (heroNarrationInProgress) return;
      if (Date.now() - heroFirstRenderAt < 1000) return;
      speakHeroNarrationFromSource(source, { locale }).catch(() => {});
    };

    const prevStep = () => {
      stopPlayback();
      stopAvatarPlayback();
      stopRecording();
      if (showSummary) {
        showSummary = false;
        summaryState = null;
        lastSummaryAudioCue = '';
        renderStep();
        return;
      }
      if (stepIndex > 0) {
        stepIndex -= 1;
        renderStep();
        return;
      }
      goBackToRoutes();
    };

    if (swipeSurface) {
      swipeSurface.addEventListener('touchstart', handleSwipeStart, { passive: true });
      swipeSurface.addEventListener('touchmove', handleSwipeMove, { passive: false });
      swipeSurface.addEventListener('touchend', handleSwipeEnd, { passive: true });
      swipeSurface.addEventListener('touchcancel', handleSwipeCancel, { passive: true });
    }

    const handleSelectionChange = () => {
      ensureTrainingData().then(() => {
        const { session } = resolveSelection(getSelection());
        const startStep = window.r34lp0w3r ? window.r34lp0w3r.speakStartStep : null;
        const startWord = window.r34lp0w3r ? window.r34lp0w3r.speakStartWord : null;
        const hasStartOverride =
          (startStep !== null && startStep !== undefined) ||
          (startWord !== null && startWord !== undefined);
        if (!session || (session.id === currentSessionId && !hasStartOverride)) return;
        stopPlayback();
        stopAvatarPlayback();
        stopRecording();
        applySessionData(getSelection());
      });
    };
    this._handleSpeakSelection = handleSelectionChange;
    window.addEventListener('training:selection-change', handleSelectionChange);

    const handleDebugToggle = () => {
      renderStep();
    };
    this._handleSpeakDebug = handleDebugToggle;
    window.addEventListener('app:speak-debug', handleDebugToggle);

    const handleSessionPercentagesVisibilityChange = () => {
      renderStep();
    };
    this._handleSpeakSessionPercentagesVisibility = handleSessionPercentagesVisibilityChange;
    window.addEventListener(
      'app:speak-session-percentages-visible-change',
      handleSessionPercentagesVisibilityChange
    );

    const handlePronunciationAvatarModeChange = () => {
      stopPlayback();
      renderStep();
    };
    this._handleSpeakPronunciationAvatarMode = handlePronunciationAvatarModeChange;
    window.addEventListener(
      'app:speak-pronunciation-avatar-mode-change',
      handlePronunciationAvatarModeChange
    );

    const handleAppLocaleChange = () => {
      const baseLocale = getBaseHintLocale();
      if (normalizeHintLocale(hintLocaleOverride) === baseLocale) {
        hintLocaleOverride = '';
      }
      const nextLocale = getHintUiLocale(baseLocale);
      if (nextLocale === activeHintLocale) return;
      activeHintLocale = nextLocale;
      if (showSummary && summaryState) {
        summaryState = localizeExistingSummaryState(summaryState, nextLocale);
      }
      renderStep();
      clearHeroNarrationTimer();
      stopHeroNarration().catch(() => {});
    };
    this._handleSpeakLocaleChange = handleAppLocaleChange;
    window.addEventListener('app:locale-change', handleAppLocaleChange);

    const handleViewportResize = () => {
      if (!this.isConnected) return;
      lockHeroCardHeight();
      if (stepRoot?.querySelector('.speak-step-sound')) {
        scheduleAvatarFit(stepRoot);
      }
    };
    this._handleSpeakResize = handleViewportResize;
    window.addEventListener('resize', handleViewportResize);

    ensureTrainingData().then(() => {
      heroFirstRenderAt = Date.now();
      applySessionData(getSelection());
    });

    heroFlagBtn?.addEventListener('click', toggleHintLocaleFromFlag);
    heroCardEl?.addEventListener('click', handleHeroCardReplayClick);
    debugToggleBtn?.addEventListener('click', toggleDebugPanel);

    const updateHeaderRewards = () => {
      const container = this.querySelector('#speak-reward-badges');
      if (!container) return;
      const rewards = window.r34lp0w3r && window.r34lp0w3r.speakSessionRewards
        ? window.r34lp0w3r.speakSessionRewards : {};
      const totals = {};
      Object.values(rewards).forEach((entry) => {
        if (!entry || typeof entry.rewardQty !== 'number') return;
        const icon = entry.rewardIcon || 'diamond';
        const rewardKind = String(entry.rewardGroup || icon).trim() || String(icon).trim() || 'diamond';
        if (!totals[rewardKind]) totals[rewardKind] = { icon, qty: 0 };
        totals[rewardKind].qty += entry.rewardQty;
      });
      const entries = Object.entries(totals).filter(([, meta]) => meta && meta.qty > 0);
      if (!entries.length) { container.innerHTML = ''; container.hidden = true; return; }
      container.hidden = false;
      container.innerHTML = entries.sort((left, right) => {
        const leftIcon = String(left[1] && left[1].icon ? left[1].icon : 'diamond').trim().toLowerCase();
        const rightIcon = String(right[1] && right[1].icon ? right[1].icon : 'diamond').trim().toLowerCase();
        const getOrder = (icon) =>
          icon === 'trophy'
            ? 0
            : icon === 'ribbon' || icon === 'medal'
            ? 1
            : icon === 'diamond'
            ? 2
            : 9;
        const byOrder = getOrder(leftIcon) - getOrder(rightIcon);
        if (byOrder !== 0) return byOrder;
        return String(left[0] || '').localeCompare(String(right[0] || ''));
      })
        .map(([rewardKind, meta]) => {
          const icon = meta.icon || 'diamond';
          const qty = meta.qty || 0;
          const normalizedIcon = String(icon || '').trim().toLowerCase();
          const isInteractive =
            normalizedIcon === 'trophy' ||
            normalizedIcon === 'ribbon' ||
            normalizedIcon === 'medal' ||
            rewardKind === 'reference-unit-ribbon';
          return `<div class="training-badge reward-badge${isInteractive ? ' is-interactive' : ''}" data-reward-kind="${rewardKind}" data-reward-icon="${icon}" data-reward-qty="${qty}"${isInteractive ? ' role="button" tabindex="0"' : ''}><ion-icon name="${icon}"></ion-icon><span>${qty}</span></div>`;
        })
        .join('');
    };
    updateHeaderRewards();
    this._handleSpeakRewards = updateHeaderRewards;
    window.addEventListener('app:speak-stores-change', this._handleSpeakRewards);

    const localeBtnEl = this.querySelector('.app-locale-btn');
    const handleLocaleBtn = () => {
      const nextLocale = getNextLocaleCode(getAppLocale() || 'en');
      setAppLocale(nextLocale);
      if (window.varGlobal && typeof window.varGlobal === 'object') window.varGlobal.locale = nextLocale;
      window.dispatchEvent(new CustomEvent('app:locale-change', { detail: { locale: nextLocale } }));
      const localeLabelEl = localeBtnEl?.querySelector('.app-locale-label');
      if (localeLabelEl) localeLabelEl.textContent = nextLocale.toUpperCase();
    };
    localeBtnEl?.addEventListener('click', handleLocaleBtn);

    this._cleanupSpeak = () => {
      stopHeroNarration().catch(() => {});
      stopPlayback();
      stopAvatarPlayback();
      stopRecording();
      Object.keys(stepState).forEach((key) => clearRecordingForStep(key));
      if (this._handleSpeakSelection) {
        window.removeEventListener('training:selection-change', this._handleSpeakSelection);
      }
      if (this._handleSpeakDebug) {
        window.removeEventListener('app:speak-debug', this._handleSpeakDebug);
      }
      if (this._handleSpeakSessionPercentagesVisibility) {
        window.removeEventListener(
          'app:speak-session-percentages-visible-change',
          this._handleSpeakSessionPercentagesVisibility
        );
      }
      if (this._handleSpeakPronunciationAvatarMode) {
        window.removeEventListener(
          'app:speak-pronunciation-avatar-mode-change',
          this._handleSpeakPronunciationAvatarMode
        );
      }
      if (this._handleSpeakLocaleChange) {
        window.removeEventListener('app:locale-change', this._handleSpeakLocaleChange);
      }
      if (this._handleSpeakResize) {
        window.removeEventListener('resize', this._handleSpeakResize);
      }
      disconnectAvatarResizeObserver();
      if (debugToggleBtn) {
        debugToggleBtn.removeEventListener('click', toggleDebugPanel);
      }
      if (heroFlagBtn) {
        heroFlagBtn.removeEventListener('click', toggleHintLocaleFromFlag);
      }
      if (this._handleSpeakRewards) {
        window.removeEventListener('app:speak-stores-change', this._handleSpeakRewards);
      }
      localeBtnEl?.removeEventListener('click', handleLocaleBtn);
      if (heroCardEl) {
        heroCardEl.removeEventListener('click', handleHeroCardReplayClick);
      }
      if (swipeSurface) {
        swipeSurface.removeEventListener('touchstart', handleSwipeStart);
        swipeSurface.removeEventListener('touchmove', handleSwipeMove);
        swipeSurface.removeEventListener('touchend', handleSwipeEnd);
        swipeSurface.removeEventListener('touchcancel', handleSwipeCancel);
      }
    };
  }

  disconnectedCallback() {
    if (this._cleanupSpeak) {
      this._cleanupSpeak();
    }
  }
}

customElements.define('page-speak', PageSpeak);
