import { getAppLocale } from '../state.js';
import { getChatCopy, normalizeLocale as normalizeCopyLocale } from '../content/copy.js';

class PageChat extends HTMLElement {
  connectedCallback() {
    const CHAT_ALWAYS_ON_FOR_TESTING = true;
    const CHAT_MODE_TOGGLE_ALWAYS_VISIBLE_FOR_TESTING = CHAT_ALWAYS_ON_FOR_TESTING;
    const getRuntimeLocale = () =>
      normalizeCopyLocale(getAppLocale() || (window.varGlobal && window.varGlobal.locale) || 'en') || 'en';
    let uiLocale = getRuntimeLocale();
    let uiCopy = getChatCopy(uiLocale);
    let tokenFmt = new Intl.NumberFormat(uiLocale === 'es' ? 'es-ES' : 'en-US');
    this.classList.add('ion-page');
    const WAVE_BAR_COUNT = 32;
    const waveBarsMarkup = Array.from(
      { length: WAVE_BAR_COUNT },
      (_, idx) => `<span class="talk-wave-bar" style="--i:${idx}"></span>`
    ).join('');
    this.innerHTML = `
      <ion-header translucent="true">
        <ion-toolbar class="secret-title">
          <div class="app-header-actions" slot="end">
            <div class="app-user-info" id="chat-user-info" hidden>
              <img class="app-user-avatar" id="chat-user-avatar" alt="Avatar">
              <span class="app-user-name" id="chat-user-name"></span>
            </div>
            <div class="reward-badges" id="chat-reward-badges"></div>
            <ion-button fill="clear" size="small" class="app-notify-btn">
              <ion-icon slot="icon-only" name="notifications-outline"></ion-icon>
            </ion-button>
            <ion-button fill="clear" size="small" class="app-logout-btn" id="chat-logout-btn" hidden>
              <ion-icon slot="icon-only" name="log-out-outline"></ion-icon>
            </ion-button>
          </div>
        </ion-toolbar>
      </ion-header>
      <ion-content fullscreen class="secret-content" scroll-y="false">
        <div class="page-shell">
          <div class="card chat-chat-card">
            <div class="chat-card-header">
              <div>
                <div class="chat-mode-toggle" id="chat-mode-toggle" hidden>
                  <button type="button" class="chat-mode-btn is-active" data-mode="catbot">${uiCopy.modeCatbot}</button>
                  <button type="button" class="chat-mode-btn" data-mode="chatbot">${uiCopy.modeChatbot}</button>
                </div>
                <h3 id="chat-coach-title">${uiCopy.coachCatbotTitle}</h3>
                <p class="muted" id="chat-coach-subtitle">
                  ${uiCopy.coachCatbotSubtitle}
                </p>
              </div>
              <div class="coach-avatar coach-avatar-cat" id="chat-coach-avatar" aria-label="Coach">
                <img
                  class="coach-avatar-mascot"
                  id="chat-coach-avatar-mascot"
                  src="/assets/mascot/mascota-boca-08.png"
                  alt=""
                  aria-hidden="true"
                >
              </div>
            </div>
            <div class="chat-access" id="chat-access">
              <div class="chat-access-panel chat-loading-panel" id="chat-loading-panel" hidden>
                <ion-spinner name="dots"></ion-spinner>
                <span>${uiCopy.loadingUser}</span>
              </div>
              <div class="chat-access-panel" id="chat-login-panel" hidden>
                <p>${uiCopy.loginRequired}</p>
                <button class="chat-btn chat-btn-send chat-login-btn" id="chat-login-btn" type="button">
                  <ion-icon name="log-in"></ion-icon>
                  <span>${uiCopy.loginCta}</span>
                </button>
              </div>
              <div class="chat-access-panel" id="chat-locked-panel" hidden>
                <p>${uiCopy.planLocked}</p>
                <p class="muted">${uiCopy.planUpgrade}</p>
              </div>
            </div>
            <div class="chat-panel" id="chat-chat-panel">
              <div class="chat-thread" id="chat-chat-thread" role="log" aria-live="polite" aria-relevant="additions"></div>
              <div class="chat-composer-row" id="chat-composer-row">
                <div class="chat-text-row" id="chat-text-row" hidden>
                  <input
                    type="text"
                    id="chat-text-input"
                    class="chat-text-input"
                    placeholder="${uiCopy.inputPlaceholder}"
                    autocomplete="off"
                    enterkeyhint="send"
                  />
                </div>
                <div class="chat-controls talk-controls" id="chat-chat-controls">
                  <button class="chat-btn chat-btn-record talk-record-btn" id="chat-record-btn" type="button" aria-pressed="false" aria-label="${uiCopy.record}">
                    <ion-icon name="mic"></ion-icon>
                    <span>${uiCopy.record}</span>
                  </button>
                  <div class="talk-recording" id="chat-recording-ui" hidden>
                    <div class="talk-wave talk-wave-recording" id="chat-recording-wave">
                      ${waveBarsMarkup}
                    </div>
                    <div class="talk-timer" id="chat-recording-timer">0:00</div>
                    <button class="talk-icon-btn talk-stop-btn" id="chat-stop-btn" type="button" aria-label="${uiCopy.stop}">
                      <ion-icon name="stop"></ion-icon>
                    </button>
                  </div>
                  <div class="talk-review" id="chat-review-ui" hidden>
                    <button class="talk-icon-btn talk-cancel-btn" id="chat-cancel-btn" type="button" aria-label="${uiCopy.cancel}">
                      <ion-icon name="close"></ion-icon>
                    </button>
                    <button class="chat-btn talk-play-btn" id="chat-preview-btn" type="button" aria-label="${uiCopy.play}" disabled>
                      <ion-icon name="play"></ion-icon>
                      <span>${uiCopy.listen}</span>
                    </button>
                    <div class="talk-wave talk-wave-review" id="chat-review-wave">
                      ${waveBarsMarkup}
                    </div>
                    <div class="talk-timer talk-timer-review" id="chat-review-timer">0:00</div>
                    <button class="chat-btn chat-btn-send talk-send-btn" id="chat-send-btn" type="button" aria-label="${uiCopy.send}" disabled>
                      <ion-icon name="arrow-up"></ion-icon>
                      <span>${uiCopy.send}</span>
                    </button>
                  </div>
                </div>
              </div>
              <div class="chat-hint" id="chat-chat-hint">${uiCopy.hintDefault}</div>
            </div>
          </div>
        </div>
      </ion-content>
    `;

    const contentEl = this.querySelector('ion-content.secret-content');
    const threadEl = this.querySelector('#chat-chat-thread');
    const chatPanel = this.querySelector('#chat-chat-panel');
    const accessPanel = this.querySelector('#chat-access');
    const loginPanel = this.querySelector('#chat-login-panel');
    const lockedPanel = this.querySelector('#chat-locked-panel');
    const loadingPanel = this.querySelector('#chat-loading-panel');
    const userInfoEl = this.querySelector('#chat-user-info');
    const userAvatarEl = this.querySelector('#chat-user-avatar');
    const userNameEl = this.querySelector('#chat-user-name');
    const rewardsEl = this.querySelector('#chat-reward-badges');
    const logoutBtn = this.querySelector('#chat-logout-btn');
    const recordBtn = this.querySelector('#chat-record-btn');
    const previewBtn = this.querySelector('#chat-preview-btn');
    const sendBtn = this.querySelector('#chat-send-btn');
    const chatControls = this.querySelector('#chat-chat-controls');
    const recordingUi = this.querySelector('#chat-recording-ui');
    const recordingWave = this.querySelector('#chat-recording-wave');
    const recordingTimerEl = this.querySelector('#chat-recording-timer');
    const stopBtn = this.querySelector('#chat-stop-btn');
    const reviewUi = this.querySelector('#chat-review-ui');
    const reviewWave = this.querySelector('#chat-review-wave');
    const reviewTimerEl = this.querySelector('#chat-review-timer');
    const cancelBtn = this.querySelector('#chat-cancel-btn');
    const hintEl = this.querySelector('#chat-chat-hint');
    const loginBtn = this.querySelector('#chat-login-btn');
    const modeToggle = this.querySelector('#chat-mode-toggle');
    const coachAvatar = this.querySelector('#chat-coach-avatar');
    const coachAvatarMascot = this.querySelector('#chat-coach-avatar-mascot');
    const coachTitleEl = this.querySelector('#chat-coach-title');
    const coachSubtitleEl = this.querySelector('#chat-coach-subtitle');
    const composerRow = this.querySelector('#chat-composer-row');
    const textRow = this.querySelector('#chat-text-row');
    const textInput = this.querySelector('#chat-text-input');
    let defaultHint = hintEl ? hintEl.textContent : uiCopy.hintDefault;

    const DEFAULT_SAMPLE_TRANSCRIPTS = [
      'I would like to order a coffee, please.',
      'Can you help me find the train station?',
      'I am practicing my pronunciation today.',
      'Could you repeat that a little slower?',
      'I have a meeting at three o clock.',
      'What do you recommend for dinner?'
    ];

    const DEFAULT_BOT_TEMPLATES = [
      'Nice! Try stressing the key words: "{text}"',
      'Good job. Now say it a bit slower: "{text}"',
      'Great start. Focus on linking the words: "{text}"',
      'Try this version with a softer "t": "{text}"',
      'Let\'s repeat with clear vowel sounds: "{text}"'
    ];

    const resolveCopyList = (value, fallback) =>
      Array.isArray(value) && value.length ? value : fallback;

    let mediaRecorder = null;
    let recordingStream = null;
    let recordedChunks = [];
    let isRecording = false;
    let draftTranscript = '';
    let draftAudioUrl = '';
    let draftSpeakText = '';
    let activeAudio = null;
    let previewAudio = null;
    let isPreviewPlaying = false;
    const retainedAudioUrls = [];
    let speechRecognizer = null;
    let speechTranscript = '';
    let speechInterim = '';
    let speechFailed = false;
    let nativeSpeechActive = false;
    let nativeSpeechListeners = [];
    let pendingAudioUrl = '';
    let finalizeTimer = null;
    let lastUserId = null;
    let lastChatEnabled = false;
    let accessLoading = true;
    let accessLoadingTimer = null;
    let pusherClient = null;
    let pusherChannel = null;
    let pusherChannelName = '';
    let realtimeConnected = false;
    let controlsBaseEnabled = false;
    let chatbotDailyLimitBlocked = false;
    let chatbotDailyLimitInfo = null;
    let chatMode = 'catbot';
    const TALK_STATE_IDLE = 'idle';
    const TALK_STATE_RECORDING = 'recording';
    const TALK_STATE_REVIEW = 'review';
    const COACH_MASCOT_SEQUENCES = {
      catbot: {
        framePaths: [
          '/assets/mascot/mascota-boca-00.png',
          '/assets/mascot/mascota-boca-01.png',
          '/assets/mascot/mascota-boca-02.png',
          '/assets/mascot/mascota-boca-03.png',
          '/assets/mascot/mascota-boca-04.png',
          '/assets/mascot/mascota-boca-05.png',
          '/assets/mascot/mascota-boca-06.png',
          '/assets/mascot/mascota-boca-07.png',
          '/assets/mascot/mascota-boca-08.png'
        ],
        restFrame: 8
      },
      chatbot: {
        framePaths: [
          '/assets/mascot/robot1.png',
          '/assets/mascot/robot2.png',
          '/assets/mascot/robot3.png',
          '/assets/mascot/robot4.png',
          '/assets/mascot/robot5.png'
        ],
        restFrame: 0
      }
    };
    const COACH_MASCOT_FRAME_INTERVAL_MS = 150;
    const COACH_MASCOT_AUDIO_START_DELAY_MS = 140;
    const RECORDING_TIMESLICE = 500;
    const VOSK_SAMPLE_RATE_DEFAULT = 16000;
	    const TALK_STORAGE_PREFIX = 'appv5:talk-timelines:';
	    const TALK_STORAGE_LEGACY = 'appv5:talk-timelines';
	    const CHAT_MODE_DEBUG_KEY = 'appv5:chat-debug-chat-mode';
	    const SHARED_AUDIO_MODE_KEY = 'appv5:free-ride-audio-mode';
	    const SHARED_AUDIO_MODE_GENERATED = 'generated';
	    const SHARED_AUDIO_MODE_LOCAL = 'local';
	    const CHATBOT_ALIGNED_TTS_CACHE_MAX_ITEMS = 80;
	    let talkStorageKey = `${TALK_STORAGE_PREFIX}anon`;
    const replyTimers = { catbot: null, chatbot: null };
    const awaitingBot = { catbot: false, chatbot: false };
    const typingState = { catbot: false, chatbot: false };
    const chatThreads = { catbot: [], chatbot: [] };
    let talkState = TALK_STATE_IDLE;
    let coachMascotFrameIndex = COACH_MASCOT_SEQUENCES.catbot.restFrame;
    let coachMascotFrameTimer = null;
    let coachMascotTalkRefs = 0;
    let recordingStartedAt = 0;
    let recordingDurationMs = 0;
    let recordingTimer = null;
    let recordingWaveValues = new Array(WAVE_BAR_COUNT).fill(0);
    let reviewWaveValues = new Array(WAVE_BAR_COUNT).fill(0);
    let waveContext = null;
    let waveAnalyser = null;
	    let waveSource = null;
    let waveFrame = null;
    let waveData = null;
    let playbackRequestToken = 0;
    const chatbotAlignedTtsCache = new Map();
    let chatbotAlignedTtsLimitStatus = null;
    const coachMascotFramePaths = Array.from(
      new Set(
        Object.values(COACH_MASCOT_SEQUENCES).flatMap((sequence) =>
          Array.isArray(sequence.framePaths) ? sequence.framePaths : []
        )
      )
    );
    let coachMascotFramesPreloaded = false;
    const recordingBars = recordingWave
      ? Array.from(recordingWave.querySelectorAll('.talk-wave-bar'))
      : [];
    const reviewBars = reviewWave
      ? Array.from(reviewWave.querySelectorAll('.talk-wave-bar'))
      : [];

    const canSpeak = () =>
      typeof window !== 'undefined' &&
      typeof window.speechSynthesis !== 'undefined' &&
      typeof window.SpeechSynthesisUtterance !== 'undefined';
    const isNativeRuntime = () => {
      const cap = window.Capacitor;
      if (!cap) return false;
      if (typeof cap.isNativePlatform === 'function') {
        return Boolean(cap.isNativePlatform());
      }
      const platform =
        typeof cap.getPlatform === 'function' ? cap.getPlatform() : cap.platform;
      return platform === 'ios' || platform === 'android';
    };
    const getNativeTtsPlugin = () => {
      if (!isNativeRuntime()) return null;
      return window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins.TextToSpeech : null;
    };
    const canSpeechPlayback = () => {
      const nativeTts = getNativeTtsPlugin();
      return Boolean(
        (nativeTts && typeof nativeTts.speak === 'function') ||
        canSpeak()
      );
    };

    const canRecord = () =>
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      typeof MediaRecorder !== 'undefined';

    const getSpeechRecognition = () =>
      window.SpeechRecognition || window.webkitSpeechRecognition;

    const getNativeSpeechPlugin = () =>
      window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins.SpeechRecognition : null;
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
    const isNativeSpeechSupported = () => {
      const cap = window.Capacitor;
      return !!(
        cap &&
        typeof cap.isNativePlatform === 'function' &&
        cap.isNativePlatform() &&
        getNativeSpeechPlugin()
      );
    };

    const canTranscribe = () =>
      typeof getSpeechRecognition() === 'function' || isNativeSpeechSupported() || canNativeFileTranscribe();

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
      updateSpeechHint();
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
        speechRecognizer = null;
        return false;
      }
      if (typeof plugin.available === 'function') {
        const availability = await plugin.available();
        if (!availability || availability.available === false) {
          speechFailed = true;
          nativeSpeechActive = false;
          speechRecognizer = null;
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

    const stopNativeSpeechRecognition = async (options = {}) => {
      const plugin = getNativeSpeechPlugin();
      if (!plugin || !nativeSpeechActive) return;
      const { finalize = true } = options;
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
      speechRecognizer = null;
      if (finalize && pendingAudioUrl) {
        finalizePendingDraft(false);
      }
    };

    const getRealtimeConfig = () => {
      const config = window.realtimeConfig || {};
      return {
        key: config.key || '',
        wsHost: config.wsHost || '',
        wssPort: config.wssPort || 443,
        forceTLS: config.forceTLS !== undefined ? config.forceTLS : true,
        authEndpoint: config.authEndpoint || '',
        emitEndpoint: config.emitEndpoint || '',
        enabledTransports: Array.isArray(config.enabledTransports) ? config.enabledTransports : ['ws', 'wss'],
        channelType: config.channelType || 'private',
        channelPrefix: config.channelPrefix || 'coach'
      };
    };

    const getCoachId = () => (chatMode === 'chatbot' ? '2' : '1');

    const buildChannelName = (userId, config) => {
      const coachId = getCoachId();
      const base = `${config.channelPrefix}${coachId}-${userId}`;
      const type = config.channelType;
      if (!type || type === 'public') return base;
      return `${type}-${base}`;
    };

    const normalizeRole = (value, fallbackRole) => {
      if (!value) return fallbackRole;
      const role = String(value).toLowerCase();
      if (role === 'bot' || role === 'assistant' || role === 'coach') return 'bot';
      if (role === 'user' || role === 'student' || role === 'member') return 'user';
      return fallbackRole;
    };

    const stripMarkdownSyntax = (value) => {
      if (typeof value !== 'string') return '';
      let text = value.replace(/\r/g, '');
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

	    const normalizeChatText = (value) => {
	      if (value === undefined || value === null) return '';
	      return stripMarkdownSyntax(String(value)).trim();
	    };

	    const normalizeSharedAudioMode = (value) => {
	      const normalized = String(value || '').trim().toLowerCase();
	      return normalized === SHARED_AUDIO_MODE_LOCAL
	        ? SHARED_AUDIO_MODE_LOCAL
	        : SHARED_AUDIO_MODE_GENERATED;
	    };

	    const getSharedAudioMode = () => {
	      const stateMode =
	        window.r34lp0w3r && typeof window.r34lp0w3r.freeRideAudioMode === 'string'
	          ? window.r34lp0w3r.freeRideAudioMode
	          : '';
	      if (stateMode) return normalizeSharedAudioMode(stateMode);
	      try {
	        return normalizeSharedAudioMode(localStorage.getItem(SHARED_AUDIO_MODE_KEY));
	      } catch (err) {
	        return SHARED_AUDIO_MODE_GENERATED;
	      }
	    };

	    const getCurrentUsageDayUtc = () => new Date().toISOString().slice(0, 10);

	    const getCurrentTtsUsageUserId = () => {
	      const user = window.user;
	      if (!user || user.id === undefined || user.id === null) return '';
	      const value = String(user.id).trim();
	      return value || '';
	    };

	    const setChatbotAlignedTtsLimitStatus = (status) => {
	      if (!status || typeof status !== 'object') {
	        chatbotAlignedTtsLimitStatus = null;
	        return null;
	      }
	      const userIdRaw =
	        status.user_id !== undefined && status.user_id !== null ? String(status.user_id).trim() : '';
	      const dayRaw = status.day !== undefined && status.day !== null ? String(status.day).trim() : '';
	      const charLimit = Number(status.char_limit_day);
	      const usedChars = Number(status.used_chars_day);
	      const remainingChars = Number(status.remaining_chars_day);
	      chatbotAlignedTtsLimitStatus = {
	        user_id: userIdRaw || '',
	        day: dayRaw,
	        char_limit_day: Number.isFinite(charLimit) ? Math.max(0, Math.floor(charLimit)) : 0,
	        used_chars_day: Number.isFinite(usedChars) ? Math.max(0, Math.floor(usedChars)) : 0,
	        remaining_chars_day: Number.isFinite(remainingChars) ? Math.max(0, Math.floor(remainingChars)) : null,
	        limit_reached_today: Boolean(status.limit_reached_today)
	      };
	      return chatbotAlignedTtsLimitStatus;
	    };

	    const applyChatbotAlignedTtsLimitStatusFromPayload = (payload) => {
	      if (!payload || typeof payload !== 'object') return null;
	      if (payload.limit_status && typeof payload.limit_status === 'object') {
	        return setChatbotAlignedTtsLimitStatus(payload.limit_status);
	      }
	      if (
	        payload.char_limit_day !== undefined ||
	        payload.used_chars_day !== undefined ||
	        payload.remaining_chars_day !== undefined ||
	        payload.limit_reached_today !== undefined
	      ) {
	        return setChatbotAlignedTtsLimitStatus(payload);
	      }
	      return null;
	    };

	    const isChatbotAlignedTtsBlockedByLimit = () => {
	      const status = chatbotAlignedTtsLimitStatus;
	      if (!status || !status.limit_reached_today) return false;
	      if (status.day && status.day !== getCurrentUsageDayUtc()) return false;
	      const currentUserId = getCurrentTtsUsageUserId();
	      if (currentUserId) {
	        if (status.user_id && status.user_id !== currentUserId) return false;
	        return true;
	      }
	      if (status.user_id && status.user_id !== 'unknown') return false;
	      return true;
	    };

	    const clearChatbotAlignedTtsLimitStatus = () => {
	      chatbotAlignedTtsLimitStatus = null;
	    };

	    const resolveAlignedTtsEndpoint = () => {
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
	    };

	    const buildAlignedTtsHeaders = () => {
	      const headers = { 'Content-Type': 'application/json' };
	      const cfg = window.realtimeConfig || {};
	      const token =
	        typeof cfg.stateToken === 'string'
	          ? cfg.stateToken.trim()
	          : typeof window.REALTIME_STATE_TOKEN === 'string'
	          ? window.REALTIME_STATE_TOKEN.trim()
	          : '';
	      if (token) headers['x-rt-token'] = token;
	      return headers;
	    };

	    const getChatbotAlignedTtsCacheKey = (text, locale) =>
	      `${String(locale || '').trim().toLowerCase()}::${String(text || '').trim()}`;

	    const getChatbotAlignedTtsFromCache = (text, locale) => {
	      const key = getChatbotAlignedTtsCacheKey(text, locale);
	      if (!key || !chatbotAlignedTtsCache.has(key)) return null;
	      const cached = chatbotAlignedTtsCache.get(key);
	      chatbotAlignedTtsCache.delete(key);
	      chatbotAlignedTtsCache.set(key, cached);
	      return cached;
	    };

	    const storeChatbotAlignedTtsInCache = (text, locale, payload) => {
	      const key = getChatbotAlignedTtsCacheKey(text, locale);
	      if (!key || !payload) return;
	      chatbotAlignedTtsCache.set(key, payload);
	      while (chatbotAlignedTtsCache.size > CHATBOT_ALIGNED_TTS_CACHE_MAX_ITEMS) {
	        const oldest = chatbotAlignedTtsCache.keys().next();
	        if (oldest && !oldest.done) {
	          chatbotAlignedTtsCache.delete(oldest.value);
	        } else {
	          break;
	        }
	      }
	    };

	    const fetchChatbotAlignedTts = async (text, locale = 'en-US') => {
	      const expected = String(text || '').trim();
	      const normalizedLocale = String(locale || '').trim() || 'en-US';
	      if (!expected) return null;

	      const cached = getChatbotAlignedTtsFromCache(expected, normalizedLocale);
	      if (cached) return cached;

	      const endpoint = resolveAlignedTtsEndpoint();
	      if (!endpoint) return null;
	      const body = {
	        text: expected,
	        locale: normalizedLocale
	      };
	      const user = window.user;
	      if (user && user.id !== undefined && user.id !== null && String(user.id).trim()) {
	        body.user_id = String(user.id).trim();
	      }
	      const userName = getUserDisplayName(user || {});
	      if (userName) {
	        body.user_name = userName;
	      }

	      const response = await fetch(endpoint, {
	        method: 'POST',
	        headers: buildAlignedTtsHeaders(),
	        body: JSON.stringify(body)
	      });

	      if (!response.ok) {
	        let errorPayload = null;
	        try {
	          errorPayload = await response.json();
	        } catch (err) {
	          errorPayload = null;
	        }
	        applyChatbotAlignedTtsLimitStatusFromPayload(errorPayload);
	        return null;
	      }

	      const data = await response.json();
	      applyChatbotAlignedTtsLimitStatusFromPayload(data);
	      if (!data || data.ok !== true) return null;
	      if (typeof data.audio_url !== 'string' || !data.audio_url.trim()) return null;
	      storeChatbotAlignedTtsInCache(expected, normalizedLocale, data);
	      return data;
	    };

	    const normalizeIncoming = (data, fallbackRole) => {
      if (!data) return null;
      if (typeof data === 'string') {
        const text = normalizeChatText(data);
        if (!text) return null;
        return {
          role: fallbackRole,
          text,
          audioUrl: '',
          speakText: text,
          limitReached: false,
          tokenLimitDay: 0,
          usedTokensDay: 0,
          day: ''
        };
      }
      if (typeof data !== 'object') return null;
      const text = normalizeChatText(data.text || data.message || data.body || data.content);
      if (!text) return null;
      const role = normalizeRole(data.role || data.sender || data.from, fallbackRole);
      const audioUrl = data.audio_url || data.audioUrl || '';
      const speakText = normalizeChatText(data.speakText || data.speak_text || text) || text;
      const limitReached = Boolean(
        data.limit_reached ||
        data.limitReached ||
        data.chatbot_disabled === 'daily_token_limit'
      );
      return {
        role,
        text,
        audioUrl,
        speakText,
        limitReached,
        tokenLimitDay: Number(data.token_limit_day || data.tokenLimitDay || 0),
        usedTokensDay: Number(data.used_tokens_day || data.usedTokensDay || 0),
        day: typeof data.day === 'string' ? data.day : ''
      };
    };

    const getChatOverride = () => {
      if (window.r34lp0w3r && window.r34lp0w3r.chatOverride === true) {
        return true;
      }
      try {
        const raw = localStorage.getItem('appv5:chat-override');
        if (raw === '1') {
          window.r34lp0w3r = window.r34lp0w3r || {};
          window.r34lp0w3r.chatOverride = true;
          return true;
        }
        if (raw === '0') {
          localStorage.removeItem('appv5:chat-override');
        }
      } catch (err) {
        // no-op
      }
      return null;
    };

    const isChatEnabledUser = (user) => {
      if (CHAT_ALWAYS_ON_FOR_TESTING) return true;
      const override = getChatOverride();
      if (override !== null) return override;
      if (!user || !user.expires_date) return false;
      const expires = new Date(user.expires_date);
      if (Number.isNaN(expires.getTime())) return false;
      return expires.getTime() > Date.now();
    };

    const getUserDisplayName = (user) => {
      if (!user) return '';
      return user.name || user.first_name || user.email || user.social_id || '';
    };

    const getUserAvatar = (user) => {
      if (!user) return '';
      return user.image_local || user.image || '';
    };

    const cancelSimulatedReply = (mode) => {
      const targetMode = mode || chatMode;
      if (!replyTimers[targetMode]) {
        awaitingBot[targetMode] = false;
        return;
      }
      clearTimeout(replyTimers[targetMode]);
      replyTimers[targetMode] = null;
      awaitingBot[targetMode] = false;
    };

    const cancelAllSimulatedReplies = () => {
      Object.keys(replyTimers).forEach((mode) => cancelSimulatedReply(mode));
    };

    const setHint = (text) => {
      if (hintEl) hintEl.textContent = text;
    };

    const getTodayKey = () => new Date().toISOString().slice(0, 10);

    const isChatbotDailyLimitActive = () => {
      if (!chatbotDailyLimitBlocked) return false;
      const limitDay = chatbotDailyLimitInfo && chatbotDailyLimitInfo.day ? String(chatbotDailyLimitInfo.day) : '';
      if (limitDay && limitDay !== getTodayKey()) {
        chatbotDailyLimitBlocked = false;
        chatbotDailyLimitInfo = null;
        return false;
      }
      return true;
    };

    const getChatbotDailyLimitHint = () => {
      const info = chatbotDailyLimitInfo || {};
      const limit = Number.isFinite(Number(info.tokenLimitDay))
        ? Math.max(0, Math.round(Number(info.tokenLimitDay)))
        : 0;
      const used = Number.isFinite(Number(info.usedTokensDay))
        ? Math.max(0, Math.round(Number(info.usedTokensDay)))
        : 0;
      if (limit > 0) {
        return uiCopy.hintDailyLimitWithCount(tokenFmt.format(used), tokenFmt.format(limit));
      }
      return uiCopy.hintDailyLimit;
    };

    const setChatbotDailyLimitBlocked = (blocked, info = {}) => {
      chatbotDailyLimitBlocked = Boolean(blocked);
      chatbotDailyLimitInfo = chatbotDailyLimitBlocked
        ? {
            day: info.day || getTodayKey(),
            tokenLimitDay: Number(info.tokenLimitDay || info.token_limit_day || 0),
            usedTokensDay: Number(info.usedTokensDay || info.used_tokens_day || 0)
          }
        : null;
      if (chatbotDailyLimitBlocked) {
        setTypingState('chatbot', false);
        setHint(getChatbotDailyLimitHint());
      }
      applyControlsEnabled();
    };

    let chatAutoScroll = true;
    let scrollToBottomTimer = null;
    let keyboardOpenScrollTimer = null;

    const scrollThreadToBottom = (behavior = 'auto') => {
      if (!threadEl) return;
      try {
        if (typeof threadEl.scrollTo === 'function') {
          threadEl.scrollTo({ top: threadEl.scrollHeight, behavior });
        } else {
          threadEl.scrollTop = threadEl.scrollHeight;
        }
      } catch (err) {
        threadEl.scrollTop = threadEl.scrollHeight;
      }
      chatAutoScroll = true;
    };

    const shouldAutoScroll = () =>
      chatAutoScroll || (textInput && document.activeElement === textInput);

    const scheduleScrollThreadToBottom = (behavior = 'auto') => {
      if (!threadEl || !shouldAutoScroll()) return;
      if (scrollToBottomTimer) clearTimeout(scrollToBottomTimer);
      scrollToBottomTimer = setTimeout(() => {
        scrollToBottomTimer = null;
        scrollThreadToBottom(behavior);
      }, 60);
    };

    const updateChatAutoScroll = () => {
      if (!threadEl) return;
      const distance = threadEl.scrollHeight - threadEl.clientHeight - threadEl.scrollTop;
      chatAutoScroll = distance <= 24;
    };

    let chatKeyboardOffset = 0;
    let chatKeyboardRaf = null;
    let chatKeyboardOpen = false;
    let chatKeyboardResized = false;
    let chatViewportBaseHeight = 0;
    const KEYBOARD_RESIZE_THRESHOLD = 96;
    const KEYBOARD_OFFSET_EPSILON = 2;

    const isChatInputActive = () =>
      Boolean(textInput && textRow && !textRow.hidden && chatMode === 'chatbot');

    const getVisibleViewportBottom = () => {
      const viewport = window.visualViewport;
      if (viewport) {
        return Math.max(0, viewport.height + viewport.offsetTop);
      }
      return Math.max(
        0,
        window.innerHeight ||
        (document && document.documentElement ? document.documentElement.clientHeight : 0) ||
        0
      );
    };

    const setChatKeyboardState = (open, resized) => {
      const nextOpen = Boolean(open);
      const nextResized = nextOpen && Boolean(resized);
      const changed = chatKeyboardOpen !== nextOpen || chatKeyboardResized !== nextResized;
      chatKeyboardOpen = nextOpen;
      chatKeyboardResized = nextResized;
      this.classList.toggle('chat-keyboard-open', nextOpen);
      this.classList.toggle('chat-keyboard-resized', nextResized);
      return changed;
    };

    const setChatKeyboardOffset = (value) => {
      const next = Math.max(0, Math.round(value || 0));
      if (chatKeyboardOffset === next) return;
      chatKeyboardOffset = next;
      this.style.setProperty('--chat-keyboard-offset', `${next}px`);
    };

    const clearThreadViewportClamp = () => {
      if (!threadEl) return;
      threadEl.style.maxHeight = '';
      threadEl.style.minHeight = '';
    };

    const applyThreadViewportClamp = () => {
      if (!threadEl || !chatPanel) return;
      if (!isChatInputActive() || !chatKeyboardOpen) {
        clearThreadViewportClamp();
        return;
      }

      const visibleBottom = getVisibleViewportBottom();
      const threadTopRaw = threadEl.getBoundingClientRect().top;
      const threadTop = Math.max(0, threadTopRaw);
      if (!Number.isFinite(threadTop) || visibleBottom <= threadTop) {
        clearThreadViewportClamp();
        return;
      }

      const panelStyles = window.getComputedStyle ? window.getComputedStyle(chatPanel) : null;
      const panelGapRaw = panelStyles ? panelStyles.rowGap || panelStyles.gap || '0' : '0';
      const panelGap = Number.parseFloat(panelGapRaw) || 0;
      const composerHeight = composerRow ? composerRow.getBoundingClientRect().height || 0 : 0;
      const hintVisible = Boolean(hintEl && !hintEl.hidden);
      const hintHeight = hintVisible && hintEl ? hintEl.getBoundingClientRect().height || 0 : 0;
      const reservedBottom = composerHeight + hintHeight + panelGap * 2 + 14;
      const availableHeight = Math.floor(visibleBottom - threadTop - reservedBottom);
      const clampedHeight = Math.max(96, availableHeight);

      threadEl.style.minHeight = '0px';
      threadEl.style.maxHeight = `${clampedHeight}px`;
    };

    const getChatKeyboardOffset = () => {
      const viewport = window.visualViewport;
      if (viewport) {
        const visible = viewport.height + viewport.offsetTop;
        const diff = window.innerHeight - visible;
        return Math.max(0, diff);
      }
      if (typeof window.__keyboardHeight === 'number') {
        return Math.max(0, window.__keyboardHeight);
      }
      return 0;
    };

    const syncChatKeyboardOffset = () => {
      const visibleBottom = getVisibleViewportBottom();
      if (!isChatInputActive()) {
        setChatKeyboardOffset(0);
        setChatKeyboardState(false, false);
        clearThreadViewportClamp();
        if (visibleBottom > 0) {
          chatViewportBaseHeight = visibleBottom;
        }
        return;
      }
      if (visibleBottom > 0 && (!chatViewportBaseHeight || visibleBottom > chatViewportBaseHeight)) {
        chatViewportBaseHeight = visibleBottom;
      }
      const wasKeyboardOpen = chatKeyboardOpen;
      const previousOffset = chatKeyboardOffset;
      const offset = getChatKeyboardOffset();
      const resizeDelta = Math.max(0, chatViewportBaseHeight - visibleBottom);
      const inputFocused = Boolean(textInput && document.activeElement === textInput);
      const nativeFocusedKeyboard = (isIOSPlatform() || isAndroidPlatform()) && inputFocused;
      const resizedKeyboardOpen =
        offset <= KEYBOARD_OFFSET_EPSILON && resizeDelta > KEYBOARD_RESIZE_THRESHOLD;
      const keyboardOpen = offset > KEYBOARD_OFFSET_EPSILON || resizedKeyboardOpen || nativeFocusedKeyboard;
      setChatKeyboardOffset(offset > KEYBOARD_OFFSET_EPSILON ? offset : 0);
      setChatKeyboardState(keyboardOpen, resizedKeyboardOpen);
      if (keyboardOpen && contentEl) {
        try {
          if (typeof contentEl.scrollToTop === 'function') {
            contentEl.scrollToTop(0).catch(() => {});
          } else if (typeof contentEl.scrollToPoint === 'function') {
            contentEl.scrollToPoint(0, 0, 0).catch(() => {});
          }
        } catch (err) {
          // no-op
        }
      }
      applyThreadViewportClamp();
      scheduleScrollThreadToBottom('auto');
      const openedByOffset = offset > KEYBOARD_OFFSET_EPSILON && previousOffset <= KEYBOARD_OFFSET_EPSILON;
      if ((keyboardOpen && !wasKeyboardOpen) || openedByOffset) {
        scrollThreadToBottom('auto');
        if (keyboardOpenScrollTimer) clearTimeout(keyboardOpenScrollTimer);
        keyboardOpenScrollTimer = setTimeout(() => {
          keyboardOpenScrollTimer = null;
          scrollThreadToBottom('auto');
        }, 140);
      }
    };

    const scheduleChatKeyboardSync = () => {
      if (chatKeyboardRaf) cancelAnimationFrame(chatKeyboardRaf);
      chatKeyboardRaf = requestAnimationFrame(() => {
        chatKeyboardRaf = null;
        syncChatKeyboardOffset();
      });
    };

    const keepChatInputFocused = ({ defer, scroll } = {}) => {
      if (!isChatInputActive()) return;
      const focus = () => {
        if (!textInput) return;
        if (document.activeElement !== textInput) {
          try {
            textInput.focus({ preventScroll: true });
          } catch (err) {
            textInput.focus();
          }
        }
        if (scroll) {
          scrollThreadToBottom();
        }
      };
      if (defer) {
        requestAnimationFrame(focus);
      } else {
        focus();
      }
    };

    const formatDuration = (ms) => {
      const totalSeconds = Math.max(0, Math.floor(ms / 1000));
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}:${String(seconds).padStart(2, '0')}`;
    };

    const setTimerText = (el, ms) => {
      if (!el) return;
      el.textContent = formatDuration(ms);
    };

    const setWaveBars = (bars, values) => {
      if (!bars.length) return;
      bars.forEach((bar, idx) => {
        const raw = typeof values[idx] === 'number' ? values[idx] : 0;
        const level = Math.max(0.08, Math.min(1, raw));
        bar.style.setProperty('--level', level.toFixed(3));
      });
    };

    const resetWaveBars = (bars) => {
      if (!bars.length) return;
      setWaveBars(
        bars,
        new Array(bars.length).fill(0)
      );
    };

    const setPreviewPlaying = (playing) => {
      isPreviewPlaying = playing;
      if (previewBtn) {
        previewBtn.classList.toggle('is-playing', playing);
        previewBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
        const icon = previewBtn.querySelector('ion-icon');
        if (icon) {
          icon.setAttribute('name', playing ? 'pause' : 'play');
        }
      }
      if (reviewWave) {
        reviewWave.classList.toggle('is-playing', playing);
      }
    };

    const getCoachMascotSequenceKey = () => (chatMode === 'chatbot' ? 'chatbot' : 'catbot');

    const getCoachMascotSequence = (mode = chatMode) => {
      const key = mode === 'chatbot' ? 'chatbot' : 'catbot';
      return COACH_MASCOT_SEQUENCES[key] || COACH_MASCOT_SEQUENCES.catbot;
    };

    const normalizeCoachMascotFrameIndex = (frameIndex, frameCount, fallbackIndex = 0) => {
      const value = Number(frameIndex);
      const safeCount = Math.max(1, Number(frameCount) || 0);
      const safeFallback = Math.min(Math.max(Number(fallbackIndex) || 0, 0), safeCount - 1);
      if (!Number.isFinite(value)) return safeFallback;
      const rounded = Math.round(value);
      return Math.min(Math.max(rounded, 0), safeCount - 1);
    };

    const getCoachMascotFramePath = (frameIndex, sequence = getCoachMascotSequence()) => {
      const framePaths =
        sequence && Array.isArray(sequence.framePaths) && sequence.framePaths.length
          ? sequence.framePaths
          : COACH_MASCOT_SEQUENCES.catbot.framePaths;
      const restFrame = Number.isFinite(sequence && sequence.restFrame)
        ? sequence.restFrame
        : framePaths.length - 1;
      const normalized = normalizeCoachMascotFrameIndex(frameIndex, framePaths.length, restFrame);
      return (
        framePaths[normalized] ||
        framePaths[Math.min(Math.max(restFrame, 0), Math.max(0, framePaths.length - 1))]
      );
    };

    const preloadCoachMascotFrames = () => {
      if (coachMascotFramesPreloaded) return;
      coachMascotFramesPreloaded = true;
      if (typeof Image === 'undefined') return;
      coachMascotFramePaths.forEach((path) => {
        const img = new Image();
        img.src = path;
      });
    };

    const renderCoachMascotFrame = (frameIndex, sequence = getCoachMascotSequence()) => {
      const frameCount =
        sequence && Array.isArray(sequence.framePaths) && sequence.framePaths.length
          ? sequence.framePaths.length
          : 1;
      const restFrame = Number.isFinite(sequence && sequence.restFrame) ? sequence.restFrame : 0;
      coachMascotFrameIndex = normalizeCoachMascotFrameIndex(frameIndex, frameCount, restFrame);
      if (!coachAvatar) return;
      if (!coachAvatarMascot) return;
      const nextSrc = getCoachMascotFramePath(coachMascotFrameIndex, sequence);
      if (coachAvatarMascot.getAttribute('src') !== nextSrc) {
        coachAvatarMascot.setAttribute('src', nextSrc);
      }
    };

    const startCoachMascotTalk = () => {
      if (chatMode !== 'chatbot' && chatMode !== 'catbot') return;
      preloadCoachMascotFrames();
      coachMascotTalkRefs += 1;
      if (coachMascotTalkRefs > 1) return;
      if (coachAvatar) coachAvatar.classList.add('is-speaking');
      if (coachMascotFrameTimer) {
        clearInterval(coachMascotFrameTimer);
        coachMascotFrameTimer = null;
      }
      const sequence = getCoachMascotSequence();
      const framePaths = Array.isArray(sequence.framePaths) ? sequence.framePaths : [];
      const restFrame = Number.isFinite(sequence.restFrame)
        ? sequence.restFrame
        : Math.max(0, framePaths.length - 1);
      const talkFrameIndexes = framePaths
        .map((_, idx) => idx)
        .filter((idx) => idx !== restFrame);
      if (!talkFrameIndexes.length) {
        renderCoachMascotFrame(restFrame, sequence);
        return;
      }
      let talkFramePos = 0;
      renderCoachMascotFrame(talkFrameIndexes[talkFramePos], sequence);
      coachMascotFrameTimer = setInterval(() => {
        if (coachMascotTalkRefs <= 0) return;
        const liveSequence = getCoachMascotSequence();
        const liveFramePaths = Array.isArray(liveSequence.framePaths) ? liveSequence.framePaths : [];
        const liveRestFrame = Number.isFinite(liveSequence.restFrame)
          ? liveSequence.restFrame
          : Math.max(0, liveFramePaths.length - 1);
        const liveTalkFrameIndexes = liveFramePaths
          .map((_, idx) => idx)
          .filter((idx) => idx !== liveRestFrame);
        if (!liveTalkFrameIndexes.length) return;
        talkFramePos = (talkFramePos + 1) % liveTalkFrameIndexes.length;
        renderCoachMascotFrame(liveTalkFrameIndexes[talkFramePos], liveSequence);
      }, COACH_MASCOT_FRAME_INTERVAL_MS);
    };

    const stopCoachMascotTalk = (options = {}) => {
      const { settle = true, all = false } = options;
      if (all) {
        coachMascotTalkRefs = 0;
      } else {
        coachMascotTalkRefs = Math.max(0, coachMascotTalkRefs - 1);
      }
      if (coachMascotTalkRefs > 0) return;
      if (coachMascotFrameTimer) {
        clearInterval(coachMascotFrameTimer);
        coachMascotFrameTimer = null;
      }
      if (coachAvatar) coachAvatar.classList.remove('is-speaking');
      if (settle) {
        const sequence = getCoachMascotSequence();
        const restFrame = Number.isFinite(sequence.restFrame)
          ? sequence.restFrame
          : Math.max(0, (Array.isArray(sequence.framePaths) ? sequence.framePaths.length : 1) - 1);
        renderCoachMascotFrame(restFrame, sequence);
      }
    };

    const setTalkState = (state) => {
      talkState = state;
      if (chatControls) {
        chatControls.dataset.state = state;
      }
      if (recordBtn) recordBtn.hidden = state !== TALK_STATE_IDLE;
      if (recordingUi) recordingUi.hidden = state !== TALK_STATE_RECORDING;
      if (reviewUi) reviewUi.hidden = state !== TALK_STATE_REVIEW;
      if (state !== TALK_STATE_REVIEW) {
        setPreviewPlaying(false);
        previewAudio = null;
      }
      if (state === TALK_STATE_IDLE) {
        recordingDurationMs = 0;
        setTimerText(recordingTimerEl, 0);
        setTimerText(reviewTimerEl, 0);
        resetWaveBars(recordingBars);
        resetWaveBars(reviewBars);
      }
      placeSendButton();
      updateSendButtonIcon();
      updateTextRowVisibility();
      updateChatbotOneLineLayout();
    };

    const startRecordingTimer = () => {
      if (recordingTimer) {
        clearInterval(recordingTimer);
      }
      recordingStartedAt = Date.now();
      recordingDurationMs = 0;
      setTimerText(recordingTimerEl, 0);
      recordingTimer = setInterval(() => {
        setTimerText(recordingTimerEl, Date.now() - recordingStartedAt);
      }, 200);
    };

    const stopRecordingTimer = () => {
      if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
      }
      if (recordingStartedAt) {
        recordingDurationMs = Math.max(0, Date.now() - recordingStartedAt);
      }
      recordingStartedAt = 0;
      setTimerText(reviewTimerEl, recordingDurationMs);
    };

    const stopWaveMonitor = () => {
      if (waveFrame) {
        cancelAnimationFrame(waveFrame);
        waveFrame = null;
      }
      if (waveSource) {
        try {
          waveSource.disconnect();
        } catch (err) {
          // no-op
        }
        waveSource = null;
      }
      waveAnalyser = null;
      waveData = null;
      if (waveContext) {
        if (typeof waveContext.close === 'function') {
          waveContext.close().catch(() => {});
        }
        waveContext = null;
      }
    };

    const startWaveMonitor = (stream) => {
      stopWaveMonitor();
      if (!stream || !recordingBars.length) return;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      waveContext = new AudioContext();
      if (typeof waveContext.resume === 'function') {
        waveContext.resume().catch(() => {});
      }
      waveAnalyser = waveContext.createAnalyser();
      waveAnalyser.fftSize = 256;
      waveAnalyser.smoothingTimeConstant = 0.8;
      waveData = new Uint8Array(waveAnalyser.frequencyBinCount);
      waveSource = waveContext.createMediaStreamSource(stream);
      waveSource.connect(waveAnalyser);
      const update = () => {
        if (!waveAnalyser || !waveData) return;
        waveAnalyser.getByteFrequencyData(waveData);
        const values = new Array(recordingBars.length).fill(0);
        const bins = waveData.length || 1;
        for (let i = 0; i < recordingBars.length; i += 1) {
          const idx = Math.min(bins - 1, Math.floor((i / recordingBars.length) * bins));
          values[i] = waveData[idx] / 255;
        }
        recordingWaveValues = values;
        setWaveBars(recordingBars, values);
        waveFrame = requestAnimationFrame(update);
      };
      update();
    };

    const computeWaveform = (audioBuffer) => {
      const bars = reviewBars.length || recordingBars.length;
      if (!audioBuffer || !bars) return [];
      const channel = audioBuffer.getChannelData(0);
      if (!channel || !channel.length) return [];
      const samplesPerBar = Math.max(1, Math.floor(channel.length / bars));
      const values = new Array(bars).fill(0);
      for (let i = 0; i < bars; i += 1) {
        const start = i * samplesPerBar;
        const end = Math.min(channel.length, start + samplesPerBar);
        let peak = 0;
        for (let j = start; j < end; j += 16) {
          const value = Math.abs(channel[j]);
          if (value > peak) peak = value;
        }
        values[i] = peak;
      }
      const maxValue = Math.max(...values, 0.01);
      return values.map((value) => Math.min(1, value / maxValue));
    };

    const renderReviewWaveform = async (blob) => {
      if (!blob || !reviewBars.length) return;
      try {
        const buffer = await decodeAudioBlob(blob);
        const values = computeWaveform(buffer);
        if (values.length) {
          reviewWaveValues = values;
          setWaveBars(reviewBars, values);
        }
        if (buffer && typeof buffer.duration === 'number') {
          recordingDurationMs = Math.round(buffer.duration * 1000);
          setTimerText(reviewTimerEl, recordingDurationMs);
        }
      } catch (err) {
        const fallback = recordingWaveValues.length
          ? recordingWaveValues
          : new Array(reviewBars.length).fill(0.2);
        reviewWaveValues = fallback;
        setWaveBars(reviewBars, fallback);
      }
    };

    const setRecordButton = (recording) => {
      isRecording = recording;
      if (!recordBtn) return;
      recordBtn.classList.toggle('is-recording', recording);
      recordBtn.setAttribute('aria-pressed', recording ? 'true' : 'false');
    };

    const updateDraftButtons = () => {
      if (!previewBtn || !sendBtn) return;
      if (!controlsBaseEnabled || (chatMode === 'chatbot' && isChatbotDailyLimitActive())) {
        previewBtn.disabled = true;
        sendBtn.disabled = true;
        return;
      }
      const typedText = textInput ? textInput.value.trim() : '';
      const hasTranscript = Boolean(draftTranscript) || Boolean(typedText);
      const hasPlayback =
        Boolean(draftAudioUrl) ||
        (Boolean(draftSpeakText) && canSpeechPlayback()) ||
        (Boolean(typedText) && canSpeechPlayback());
      previewBtn.disabled = !hasTranscript || !hasPlayback;
      sendBtn.disabled = !hasTranscript;
    };

    const applyControlsEnabled = () => {
      const limited = chatMode === 'chatbot' && isChatbotDailyLimitActive();
      const enabled = controlsBaseEnabled && !limited;
      if (recordBtn) recordBtn.disabled = !enabled;
      if (stopBtn) stopBtn.disabled = !enabled;
      if (cancelBtn) cancelBtn.disabled = !enabled;
      if (!enabled) {
        if (previewBtn) previewBtn.disabled = true;
        if (sendBtn) sendBtn.disabled = true;
        if (textInput) textInput.disabled = true;
      } else {
        if (textInput) textInput.disabled = false;
        updateDraftButtons();
      }
      if (limited) {
        setHint(getChatbotDailyLimitHint());
      }
    };

    const setControlsEnabled = (enabled) => {
      controlsBaseEnabled = Boolean(enabled);
      applyControlsEnabled();
    };

    const showLoadingState = () => {
      accessLoading = true;
      if (loadingPanel) loadingPanel.hidden = false;
      if (loginPanel) loginPanel.hidden = true;
      if (lockedPanel) lockedPanel.hidden = true;
      if (accessPanel) accessPanel.hidden = false;
      if (chatPanel) chatPanel.hidden = true;
      setControlsEnabled(false);
      setHint(uiCopy.loadingUser);
    };

    const hideLoadingState = () => {
      if (!accessLoading) return;
      accessLoading = false;
      if (loadingPanel) loadingPanel.hidden = true;
    };

    const clearDraft = (revokeUrl) => {
      if (revokeUrl && draftAudioUrl) {
        URL.revokeObjectURL(draftAudioUrl);
      }
      draftTranscript = '';
      draftAudioUrl = '';
      draftSpeakText = '';
      if (textInput) textInput.value = '';
      updateDraftButtons();
      if (!isRecording) {
        setTalkState(TALK_STATE_IDLE);
      }
    };

    const setDraft = ({ transcript, audioUrl, speakText, simulated, notice }) => {
      if (draftAudioUrl && draftAudioUrl !== audioUrl) {
        URL.revokeObjectURL(draftAudioUrl);
      }
      draftTranscript = transcript;
      draftAudioUrl = audioUrl || '';
      draftSpeakText = speakText || '';
      if (textInput) textInput.value = '';
      updateDraftButtons();
      if (!isRecording) {
        setTalkState(TALK_STATE_REVIEW);
      }
      const label = simulated ? uiCopy.transcriptSimulated : uiCopy.transcriptReady;
      const hintText = notice ? `${notice} ${label}: "${transcript}"` : `${label}: "${transcript}"`;
      setHint(hintText);
    };

    const cancelDraft = () => {
      stopPlayback();
      if (isRecording) {
        stopActiveCapture();
      }
      if (pendingAudioUrl) {
        URL.revokeObjectURL(pendingAudioUrl);
        pendingAudioUrl = '';
      }
      if (finalizeTimer) {
        clearTimeout(finalizeTimer);
        finalizeTimer = null;
      }
      clearDraft(true);
      if (defaultHint) {
        setHint(defaultHint);
      }
    };

    const pickTranscript = () => {
      const transcripts = resolveCopyList(uiCopy.sampleTranscripts, DEFAULT_SAMPLE_TRANSCRIPTS);
      return transcripts[Math.floor(Math.random() * transcripts.length)];
    };

    const pickBotReply = (text) => {
      const templates = resolveCopyList(uiCopy.botTemplates, DEFAULT_BOT_TEMPLATES);
      const template = templates[Math.floor(Math.random() * templates.length)] || '{text}';
      return String(template).replace(/\{text\}/g, String(text || ''));
    };

    const resetSpeechState = () => {
      speechTranscript = '';
      speechInterim = '';
      speechFailed = false;
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
        stored = await writeBlobForTranscription(prepared, 'talk');
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

    const updateSpeechHint = () => {
      if (!isRecording) return;
      const preview = `${speechTranscript} ${speechInterim}`.trim();
      if (preview) {
        setHint(uiCopy.hintListening(preview));
      }
    };

    const finalizePendingDraft = (forceSimulated, overrideTranscript) => {
      if (!pendingAudioUrl) return;
      const transcript = forceSimulated
        ? ''
        : typeof overrideTranscript === 'string'
          ? overrideTranscript
          : speechTranscript || speechInterim;
      const finalText = transcript || pickTranscript();
      const simulated = !transcript;
      let notice = '';
      if (simulated) {
        if (!canTranscribe()) {
          notice = uiCopy.transcriptionUnavailable;
        } else if (speechFailed) {
          notice = uiCopy.transcriptionFailed;
        } else {
          notice = `${uiCopy.transcriptSimulated}.`;
        }
      }
      setDraft({
        transcript: finalText,
        audioUrl: pendingAudioUrl,
        speakText: finalText,
        simulated,
        notice: notice || undefined
      });
      pendingAudioUrl = '';
      if (finalizeTimer) {
        clearTimeout(finalizeTimer);
        finalizeTimer = null;
      }
      recordedChunks = [];
    };

    const startSpeechRecognition = () => {
      if (canNativeFileTranscribe()) {
        return false;
      }
      if (isNativeSpeechSupported()) {
        speechRecognizer = { native: true };
        startNativeSpeechRecognition().catch(() => {
          speechFailed = true;
          nativeSpeechActive = false;
          speechRecognizer = null;
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
        updateSpeechHint();
      };
      recognition.onerror = (event) => {
        console.warn('[chat] speech recognition error', event);
        speechFailed = true;
      };
      recognition.onend = () => {
        speechRecognizer = null;
        if (pendingAudioUrl) {
          finalizePendingDraft(false);
        }
      };
      try {
        recognition.start();
        return true;
      } catch (err) {
        console.warn('[chat] speech recognition start error', err);
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
        console.warn('[chat] speech recognition stop error', err);
      }
    };

    const abortSpeechRecognition = () => {
      if (nativeSpeechActive) {
        stopNativeSpeechRecognition({ finalize: false }).catch(() => {
          // no-op
        });
        return;
      }
      if (!speechRecognizer) return;
      try {
        speechRecognizer.onresult = null;
        speechRecognizer.onerror = null;
        speechRecognizer.onend = null;
        speechRecognizer.abort();
      } catch (err) {
        console.warn('[chat] speech recognition abort error', err);
      }
      speechRecognizer = null;
    };

    const stopActiveCapture = () => {
      if (pendingAudioUrl) {
        URL.revokeObjectURL(pendingAudioUrl);
        pendingAudioUrl = '';
      }
      if (finalizeTimer) {
        clearTimeout(finalizeTimer);
        finalizeTimer = null;
      }
      abortSpeechRecognition();
      if (mediaRecorder) {
        try {
          mediaRecorder.ondataavailable = null;
          mediaRecorder.onstop = null;
        } catch (err) {
          // no-op
        }
        try {
          if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
        } catch (err) {
          // no-op
        }
        mediaRecorder = null;
      }
      if (recordingStream) {
        recordingStream.getTracks().forEach((track) => track.stop());
        recordingStream = null;
      }
      recordedChunks = [];
      stopWaveMonitor();
      stopRecordingTimer();
      setTalkState(TALK_STATE_IDLE);
      setRecordButton(false);
    };

	    const stopPlayback = () => {
	      playbackRequestToken += 1;
	      stopCoachMascotTalk({ settle: true, all: true });
	      const ttsPlugin = getNativeTtsPlugin();
      if (ttsPlugin && typeof ttsPlugin.stop === 'function') {
        try {
          Promise.resolve(ttsPlugin.stop()).catch(() => {});
        } catch (err) {
          // no-op
        }
      }
      if (activeAudio) {
        activeAudio.pause();
        activeAudio.currentTime = 0;
        if (previewAudio === activeAudio) {
          previewAudio = null;
          setPreviewPlaying(false);
        }
        activeAudio = null;
      }
      if (canSpeak()) {
        if (typeof window.cancelWebSpeech === 'function') {
          window.cancelWebSpeech();
        } else {
          window.speechSynthesis.cancel();
        }
      }
      if (isPreviewPlaying) {
        setPreviewPlaying(false);
        previewAudio = null;
      }
	    };

	    const playAudioUrl = (url, options = {}) => {
	      const { skipStop = false } = options;
	      if (!url) return false;
	      if (!skipStop) {
	        stopPlayback();
	      }
	      let startedTalk = false;
	      let startTalkTimer = null;
	      const clearStartTalkTimer = () => {
	        if (!startTalkTimer) return;
	        clearTimeout(startTalkTimer);
	        startTalkTimer = null;
	      };
	      const startTalk = () => {
	        clearStartTalkTimer();
	        if (startedTalk) return;
	        startedTalk = true;
	        startCoachMascotTalk();
	      };
	      const startTalkOnAudible = () => {
	        clearStartTalkTimer();
	        startTalkTimer = setTimeout(startTalk, COACH_MASCOT_AUDIO_START_DELAY_MS);
	      };
	      let releasedTalk = false;
	      const releaseTalk = () => {
	        if (releasedTalk) return;
	        releasedTalk = true;
	        clearStartTalkTimer();
	        stopCoachMascotTalk({ settle: true });
	      };
	      const audio = new Audio(url);
	      activeAudio = audio;
	      audio.onplaying = startTalkOnAudible;
	      const playPromise = audio.play();
	      if (playPromise && typeof playPromise.then === 'function') {
	        playPromise
	          .then(() => {})
	          .catch((err) => {
	            console.warn('[chat] audio play error', err);
	            if (activeAudio === audio) activeAudio = null;
	            releaseTalk();
	          });
	      }
	      audio.onended = () => {
	        if (activeAudio === audio) activeAudio = null;
	        releaseTalk();
	      };
	      audio.onerror = () => {
	        if (activeAudio === audio) activeAudio = null;
	        releaseTalk();
	      };
	      return true;
	    };

    const playSpeechWeb = (text, options = {}) => {
      const { onEnd, onError, skipStop = false } = options;
      if (!text || !canSpeak()) return false;
      if (!skipStop) {
        stopPlayback();
      }
      let startedTalk = false;
      const startTalk = () => {
        if (startedTalk) return;
        startedTalk = true;
        startCoachMascotTalk();
      };
      let releasedTalk = false;
      const releaseTalk = () => {
        if (releasedTalk) return;
        releasedTalk = true;
        stopCoachMascotTalk({ settle: true });
      };
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'en-US';
      utter.onstart = () => {
        startTalk();
      };
      utter.onend = () => {
        releaseTalk();
        if (typeof onEnd === 'function') onEnd();
      };
      utter.onerror = (err) => {
        releaseTalk();
        if (typeof onError === 'function') onError(err);
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
          if (typeof onError === 'function') onError(new Error('web-tts-unavailable'));
          return false;
        }
        return true;
      } catch (err) {
        if (typeof onError === 'function') onError(err);
        return false;
      }
    };

    const playSpeech = (text, options = {}) => {
      const { onEnd, onError, skipStop = false } = options;
      if (!text) return false;
      if (!skipStop) {
        stopPlayback();
      }

      const ttsPlugin = getNativeTtsPlugin();
      if (ttsPlugin && typeof ttsPlugin.speak === 'function') {
        let startedTalk = false;
        let startTalkTimer = null;
        const clearStartTalkTimer = () => {
          if (!startTalkTimer) return;
          clearTimeout(startTalkTimer);
          startTalkTimer = null;
        };
        const startTalk = () => {
          clearStartTalkTimer();
          if (startedTalk) return;
          startedTalk = true;
          startCoachMascotTalk();
        };
        let releasedTalk = false;
        const releaseTalk = () => {
          if (releasedTalk) return;
          releasedTalk = true;
          clearStartTalkTimer();
          stopCoachMascotTalk({ settle: true });
        };
        startTalkTimer = setTimeout(startTalk, 240);
        Promise.resolve(
          ttsPlugin.speak({
            text,
            lang: 'en-US',
            rate: 1.0,
            pitch: 1.0,
            volume: 1.0,
            category: 'ambient',
            queueStrategy: 1
          })
        )
          .then(() => {
            releaseTalk();
            if (typeof onEnd === 'function') onEnd();
          })
          .catch((err) => {
            releaseTalk();
            const startedWeb = playSpeechWeb(text, {
              onEnd,
              onError,
              skipStop: true
            });
            if (!startedWeb && typeof onError === 'function') {
              onError(err);
            }
          });
        return true;
      }
      return playSpeechWeb(text, { onEnd, onError, skipStop: true });
    };

    const playPreviewAudio = ({ audioUrl, speakText }) => {
      if (isPreviewPlaying) {
        stopPlayback();
        return;
      }
      if (audioUrl) {
        stopPlayback();
        let startedTalk = false;
        let startTalkTimer = null;
        const clearStartTalkTimer = () => {
          if (!startTalkTimer) return;
          clearTimeout(startTalkTimer);
          startTalkTimer = null;
        };
        const startTalk = () => {
          clearStartTalkTimer();
          if (startedTalk) return;
          startedTalk = true;
          startCoachMascotTalk();
        };
        const startTalkOnAudible = () => {
          clearStartTalkTimer();
          startTalkTimer = setTimeout(startTalk, COACH_MASCOT_AUDIO_START_DELAY_MS);
        };
        let releasedTalk = false;
        const releaseTalk = () => {
          if (releasedTalk) return;
          releasedTalk = true;
          clearStartTalkTimer();
          stopCoachMascotTalk({ settle: true });
        };
        const audio = new Audio(audioUrl);
        activeAudio = audio;
        previewAudio = audio;
        setPreviewPlaying(true);
        audio.onplaying = startTalkOnAudible;
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise
            .then(() => {})
            .catch((err) => {
              console.warn('[chat] audio play error', err);
              releaseTalk();
              if (previewAudio === audio) {
                previewAudio = null;
                setPreviewPlaying(false);
              }
              if (activeAudio === audio) activeAudio = null;
            });
        }
        audio.onended = () => {
          releaseTalk();
          if (previewAudio === audio) {
            previewAudio = null;
            setPreviewPlaying(false);
          }
          if (activeAudio === audio) activeAudio = null;
        };
        audio.onerror = () => {
          releaseTalk();
          if (previewAudio === audio) {
            previewAudio = null;
            setPreviewPlaying(false);
          }
          if (activeAudio === audio) activeAudio = null;
        };
        return;
      }
      if (!speakText) return;
      stopPlayback();
      setPreviewPlaying(true);
      const started = playSpeech(speakText, {
        skipStop: true,
        onEnd: () => setPreviewPlaying(false),
        onError: () => setPreviewPlaying(false)
      });
      if (!started) {
        setPreviewPlaying(false);
      }
    };

	    const playChatbotAlignedMessageAudio = async (text, requestToken) => {
	      if (!text) return false;
	      if (requestToken !== playbackRequestToken) return false;
	      let payload = null;
	      try {
	        payload = await fetchChatbotAlignedTts(text, 'en-US');
	      } catch (err) {
	        payload = null;
	      }
	      if (requestToken !== playbackRequestToken) return false;
	      if (!payload || payload.ok === false) return false;
	      const audioUrl = typeof payload.audio_url === 'string' ? payload.audio_url.trim() : '';
	      if (!audioUrl) return false;
	      return playAudioUrl(audioUrl, { skipStop: true });
	    };

	    const playMessageAudio = ({ audioUrl, speakText, mode, role }) => {
	      const normalizedRole = role === 'bot' ? 'bot' : 'user';
	      const targetMode = mode === 'chatbot' ? 'chatbot' : 'catbot';
	      if (audioUrl) {
	        playAudioUrl(audioUrl);
	        return;
	      }
	      if (!speakText) return;

	      const wantsAlignedChatbotAudio =
	        targetMode === 'chatbot' &&
	        normalizedRole === 'bot' &&
	        getSharedAudioMode() === SHARED_AUDIO_MODE_GENERATED &&
	        !isChatbotAlignedTtsBlockedByLimit();

	      if (!wantsAlignedChatbotAudio) {
	        playSpeech(speakText);
	        return;
	      }

	      stopPlayback();
	      const requestToken = playbackRequestToken;
	      playChatbotAlignedMessageAudio(speakText, requestToken)
	        .then((started) => {
	          if (started) return;
	          if (requestToken !== playbackRequestToken) return;
	          playSpeech(speakText, { skipStop: true });
	        })
	        .catch(() => {
	          if (requestToken !== playbackRequestToken) return;
	          playSpeech(speakText, { skipStop: true });
	        });
	    };

    const resolveTalkStorageKey = (userId) =>
      `${TALK_STORAGE_PREFIX}${userId ? String(userId) : 'anon'}`;

    const readDebugChatMode = () => {
      try {
        const raw = localStorage.getItem(CHAT_MODE_DEBUG_KEY);
        if (raw === 'catbot' || raw === 'chatbot') return raw;
      } catch (err) {
        // no-op
      }
      return 'catbot';
    };

    const writeDebugChatMode = (mode) => {
      if (mode !== 'catbot' && mode !== 'chatbot') return;
      try {
        localStorage.setItem(CHAT_MODE_DEBUG_KEY, mode);
      } catch (err) {
        // no-op
      }
    };

    const sanitizeTalkMessage = (message) => {
      if (!message || typeof message !== 'object') return null;
      const role = message.role === 'bot' ? 'bot' : 'user';
      const text = normalizeChatText(message.text);
      if (!text) return null;
      const speakText =
        normalizeChatText(message.speakText) || text;
      return { role, text, speakText };
    };

    const normalizeStoredTimeline = (value) =>
      Array.isArray(value) ? value.map(sanitizeTalkMessage).filter(Boolean) : [];

    const readStoredTimelines = (key) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const catbot = normalizeStoredTimeline(parsed.catbot);
        const chatbot = normalizeStoredTimeline(parsed.chatbot);
        return { catbot, chatbot };
      } catch (err) {
        return null;
      }
    };

    const persistTalkTimelines = () => {
      try {
        const payload = {
          catbot: chatThreads.catbot.map(sanitizeTalkMessage).filter(Boolean),
          chatbot: chatThreads.chatbot.map(sanitizeTalkMessage).filter(Boolean)
        };
        localStorage.setItem(talkStorageKey, JSON.stringify(payload));
      } catch (err) {
        // no-op
      }
    };

    const getThread = (mode) => (mode === 'chatbot' ? chatThreads.chatbot : chatThreads.catbot);

    const loadTalkTimelinesForUser = (userId) => {
      const nextKey = resolveTalkStorageKey(userId);
      talkStorageKey = nextKey;
      let stored = readStoredTimelines(nextKey);
      if ((!stored || (!stored.catbot.length && !stored.chatbot.length)) && userId) {
        const legacy = readStoredTimelines(TALK_STORAGE_LEGACY);
        if (legacy && (legacy.catbot.length || legacy.chatbot.length)) {
          stored = legacy;
          try {
            localStorage.setItem(nextKey, JSON.stringify(legacy));
            localStorage.removeItem(TALK_STORAGE_LEGACY);
          } catch (err) {
            // no-op
          }
        }
      }
      chatThreads.catbot = stored ? stored.catbot : [];
      chatThreads.chatbot = stored ? stored.chatbot : [];
      return stored;
    };

    const getIntroCopy = (mode) =>
      mode === 'chatbot'
        ? uiCopy.introChatbot
        : uiCopy.introCatbot;

    const renderMessage = ({ role, text, audioUrl, speakText }, mode) => {
      if (!threadEl) return;
      const msgEl = document.createElement('div');
      msgEl.className = `chat-msg chat-msg-${role}`;

      const bubbleEl = document.createElement('div');
      bubbleEl.className = 'chat-bubble';

      const textEl = document.createElement('p');
      textEl.className = 'chat-text';
      textEl.textContent = text;
      bubbleEl.appendChild(textEl);

      const showAudioAction = mode !== 'chatbot' || role === 'bot';
      if (showAudioAction) {
        const actionEl = document.createElement('div');
        actionEl.className = 'chat-bubble-actions';
        const playBtn = document.createElement('button');
        playBtn.type = 'button';
        playBtn.className = 'chat-audio-btn';
        playBtn.innerHTML = `<ion-icon name="play"></ion-icon><span>${role === 'user' ? uiCopy.listen : uiCopy.repeat}</span>`;
        if (!audioUrl && !speakText) {
          playBtn.disabled = true;
        }
        playBtn.addEventListener('pointerdown', (event) => {
          if (!isChatInputActive()) return;
          event.preventDefault();
          keepChatInputFocused({ scroll: true });
        });
	        playBtn.addEventListener('click', () => playMessageAudio({ audioUrl, speakText, role, mode }));
        actionEl.appendChild(playBtn);
        bubbleEl.appendChild(actionEl);
      }

      msgEl.appendChild(bubbleEl);
      threadEl.appendChild(msgEl);
      scrollThreadToBottom();
    };

    const removeTypingIndicator = () => {
      if (!threadEl) return;
      const existing = threadEl.querySelectorAll('.chat-msg-typing');
      existing.forEach((el) => el.remove());
    };

    const renderTypingIndicator = () => {
      if (!threadEl) return;
      if (threadEl.querySelector('.chat-msg-typing')) return;
      const msgEl = document.createElement('div');
      msgEl.className = 'chat-msg chat-msg-bot chat-msg-typing';
      msgEl.setAttribute('aria-label', uiCopy.typingAria);
      const bubbleEl = document.createElement('div');
      bubbleEl.className = 'chat-bubble chat-bubble-typing';
      bubbleEl.innerHTML = `
        <div class="chat-typing-dots" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
      `;
      msgEl.appendChild(bubbleEl);
      threadEl.appendChild(msgEl);
      scrollThreadToBottom();
    };

    const setTypingState = (mode, isTyping) => {
      const targetMode = mode || chatMode;
      typingState[targetMode] = Boolean(isTyping);
      if (targetMode !== chatMode) return;
      if (typingState[targetMode]) {
        renderTypingIndicator();
      } else {
        removeTypingIndicator();
      }
    };

    const clearThread = () => {
      if (!threadEl) return;
      threadEl.innerHTML = '';
      updateChatAutoScroll();
    };

    const renderThread = (mode) => {
      if (!threadEl) return;
      clearThread();
      const thread = getThread(mode);
      thread.forEach((message) => renderMessage(message, mode));
      if (typingState[mode]) {
        renderTypingIndicator();
      }
      scrollThreadToBottom();
      updateChatAutoScroll();
    };

    const appendMessage = ({ role, text, audioUrl, speakText }, options = {}) => {
      const targetMode = options.mode || chatMode;
      const shouldAutoplay = options.autoplay === true;
      const normalizedRole = role === 'bot' ? 'bot' : 'user';
      const normalizedText = normalizeChatText(text);
      if (!normalizedText) return;
      const normalizedSpeakText = normalizeChatText(speakText) || normalizedText;
      const normalizedAudioUrl = typeof audioUrl === 'string' ? audioUrl : '';
      if (normalizedRole === 'bot') {
        typingState[targetMode] = false;
      }
      const thread = getThread(targetMode);
      const message = {
        role: normalizedRole,
        text: normalizedText,
        audioUrl: normalizedAudioUrl,
        speakText: normalizedSpeakText
      };
      thread.push(message);
      persistTalkTimelines();
      if (targetMode === chatMode) {
        if (normalizedRole === 'bot') {
          removeTypingIndicator();
        }
        renderMessage(message, targetMode);
	        if (shouldAutoplay && normalizedRole === 'bot') {
	          playMessageAudio({
	            audioUrl: normalizedAudioUrl,
	            speakText: normalizedSpeakText,
	            role: normalizedRole,
	            mode: targetMode
	          });
	        }
      }
    };

    const ensureIntroMessage = (mode) => {
      const targetMode = mode || chatMode;
      const thread = getThread(targetMode);
      if (thread.length) return;
      const introCopy = getIntroCopy(targetMode);
      appendMessage(
        {
          role: 'bot',
          text: introCopy,
          audioUrl: '',
          speakText: introCopy
        },
        { mode: targetMode }
      );
    };

    const resetChatSession = ({ keepIntro, setDefaultHint, keepTimeline } = {}) => {
      stopPlayback();
      stopActiveCapture();
      cancelAllSimulatedReplies();
      typingState.catbot = false;
      typingState.chatbot = false;
      clearDraft(true);
      retainedAudioUrls.forEach((url) => URL.revokeObjectURL(url));
      retainedAudioUrls.length = 0;
      clearThread();
      if (!keepTimeline) {
        chatThreads.catbot.length = 0;
        chatThreads.chatbot.length = 0;
        persistTalkTimelines();
      }
      if (keepIntro) {
        ensureIntroMessage(chatMode);
      }
      if (setDefaultHint && defaultHint) {
        setHint(defaultHint);
      }
    };

    const finishRecording = (mimeType) => {
      if (!recordedChunks.length) {
        setHint(uiCopy.hintNoAudio);
        clearDraft(true);
        setTalkState(TALK_STATE_IDLE);
        return;
      }
      const blob = new Blob(recordedChunks, { type: mimeType || 'audio/webm' });
      const url = URL.createObjectURL(blob);
      pendingAudioUrl = url;
      if (!recordingDurationMs && recordingStartedAt) {
        recordingDurationMs = Math.max(0, Date.now() - recordingStartedAt);
      }
      setTimerText(reviewTimerEl, recordingDurationMs);
      setTalkState(TALK_STATE_REVIEW);
      renderReviewWaveform(blob);
      if (canNativeFileTranscribe()) {
        transcribeNativeAudioBlob(blob)
          .then((text) => {
            finalizePendingDraft(false, text);
          })
          .catch(() => {
            finalizePendingDraft(true);
          });
        return;
      }
      const hasSpeechText = Boolean(speechTranscript || speechInterim);
      if (speechRecognizer) {
        if (finalizeTimer) clearTimeout(finalizeTimer);
        finalizeTimer = setTimeout(() => {
          finalizePendingDraft(true);
        }, 1500);
        return;
      }
      if (hasSpeechText) {
        finalizePendingDraft(false);
        return;
      }
      finalizePendingDraft(true);
    };

    const startRecording = async () => {
      if (recordBtn && recordBtn.disabled) return;
      stopPlayback();
      clearDraft(true);
      stopSpeechRecognition();
      if (finalizeTimer) {
        clearTimeout(finalizeTimer);
        finalizeTimer = null;
      }
      if (pendingAudioUrl) {
        URL.revokeObjectURL(pendingAudioUrl);
        pendingAudioUrl = '';
      }
      resetSpeechState();
      if (!canRecord()) {
        const transcript = pickTranscript();
        setDraft({
          transcript,
          audioUrl: '',
          speakText: transcript,
          simulated: true,
          notice: uiCopy.microphoneUnavailable
        });
        return;
      }
      try {
        recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        console.warn('[chat] getUserMedia error', err);
        const transcript = pickTranscript();
        setDraft({
          transcript,
          audioUrl: '',
          speakText: transcript,
          simulated: true,
          notice: uiCopy.microphoneAccessFailed
        });
        return;
      }

      let options;
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        const candidates = getRecordMimeCandidates();
        const supported = candidates.find((type) => MediaRecorder.isTypeSupported(type));
        if (supported) options = { mimeType: supported };
      }

      recordedChunks = [];
      mediaRecorder = options ? new MediaRecorder(recordingStream, options) : new MediaRecorder(recordingStream);
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };
      mediaRecorder.onstop = () => {
        finishRecording(mediaRecorder && mediaRecorder.mimeType);
        mediaRecorder = null;
        if (recordingStream) {
          recordingStream.getTracks().forEach((track) => track.stop());
          recordingStream = null;
        }
      };
      mediaRecorder.start(RECORDING_TIMESLICE);
      setTalkState(TALK_STATE_RECORDING);
      recordingWaveValues = new Array(WAVE_BAR_COUNT).fill(0);
      reviewWaveValues = new Array(WAVE_BAR_COUNT).fill(0);
      resetWaveBars(recordingBars);
      resetWaveBars(reviewBars);
      startRecordingTimer();
      startWaveMonitor(recordingStream);
      const transcribing = startSpeechRecognition();
      setRecordButton(true);
      if (transcribing) {
        setHint(uiCopy.hintRecordingTranscribing);
      } else if (!canTranscribe()) {
        setHint(uiCopy.hintRecordingSimulated);
      } else {
        setHint(uiCopy.hintRecordingGeneric);
      }
    };

    const stopRecording = () => {
      if (!isRecording) return;
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
      stopSpeechRecognition();
      stopWaveMonitor();
      stopRecordingTimer();
      setTalkState(TALK_STATE_REVIEW);
      if (recordingWaveValues.length && reviewBars.length) {
        setWaveBars(reviewBars, recordingWaveValues);
      }
      setRecordButton(false);
      const transcribing = isAndroidPlatform() && canNativeFileTranscribe();
      setHint(transcribing ? uiCopy.hintTranscribing : uiCopy.hintProcessing);
    };

    const disconnectRealtime = () => {
      if (pusherChannel) {
        try {
          pusherChannel.unbind_all();
        } catch (err) {
          // no-op
        }
        try {
          if (pusherClient && pusherChannelName) {
            pusherClient.unsubscribe(pusherChannelName);
          }
        } catch (err) {
          // no-op
        }
        pusherChannel = null;
      }
      if (pusherClient) {
        try {
          pusherClient.disconnect();
        } catch (err) {
          // no-op
        }
        pusherClient = null;
      }
      pusherChannelName = '';
      realtimeConnected = false;
    };

    const connectRealtime = (user) => {
      const config = getRealtimeConfig();
      if (!config.key) {
        console.warn('[chat] realtime key missing');
        return;
      }
      if (typeof window.Pusher !== 'function') {
        console.warn('[chat] Pusher no disponible');
        return;
      }
      const userId =
        user && user.id !== undefined && user.id !== null ? String(user.id) : '';
      if (!userId) return;

      const connectedMode = chatMode;
      const channelName = buildChannelName(userId, config);
      if (pusherClient && pusherChannelName === channelName) {
        return;
      }

      disconnectRealtime();

      const options = {
        wsHost: config.wsHost,
        wssPort: config.wssPort,
        forceTLS: config.forceTLS,
        enabledTransports: config.enabledTransports,
        disableStats: true
      };
      if (config.authEndpoint) {
        options.authEndpoint = config.authEndpoint;
      }

      if (channelName.startsWith('private-') || channelName.startsWith('presence-')) {
        const userInfo = {
          id: user.id,
          name: getUserDisplayName(user),
          email: user.email || '',
          avatar: getUserAvatar(user)
        };
        options.auth = {
          params: {
            user_id: user.id,
            user_info: JSON.stringify(userInfo),
            token: user.token || ''
          }
        };
      }

      pusherClient = new window.Pusher(config.key, options);
      pusherChannelName = channelName;

      pusherClient.connection.bind('connected', () => {
        realtimeConnected = true;
      });
      pusherClient.connection.bind('disconnected', () => {
        realtimeConnected = false;
      });
      pusherClient.connection.bind('error', (err) => {
        console.warn('[chat] pusher error', err);
      });

      const handleIncoming = (data, fallbackRole) => {
        const message = normalizeIncoming(data, fallbackRole);
        if (!message) return;
        if (message.role === 'bot') {
          setTypingState(connectedMode, false);
          cancelSimulatedReply(connectedMode);
          if (connectedMode === 'chatbot' && message.limitReached) {
            setChatbotDailyLimitBlocked(true, {
              day: message.day,
              tokenLimitDay: message.tokenLimitDay,
              usedTokensDay: message.usedTokensDay
            });
          }
        }
        appendMessage(message, {
          mode: connectedMode,
          autoplay: message.role === 'bot'
        });
      };

      pusherChannel = pusherClient.subscribe(channelName);
      pusherChannel.bind('pusher:subscription_error', (status) => {
        console.warn('[chat] subscription error', status);
      });
      pusherChannel.bind('chat_message', (data) => handleIncoming(data, 'bot'));
      pusherChannel.bind('bot_message', (data) => handleIncoming(data, 'bot'));
    };

    const emitRealtimeMessage = async ({ text }) => {
      const config = getRealtimeConfig();
      if (!config.emitEndpoint || !pusherChannelName) return;
      if (!lastUserId) return;
      const userName = getUserDisplayName(window.user || {});
      const payload = {
        channel: pusherChannelName,
        event: 'user_message',
        data: {
          text,
          user_id: lastUserId,
          userId: lastUserId,
          id: lastUserId,
          name: userName,
          user_name: userName,
          userName
        }
      };
      try {
        await fetch(config.emitEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        console.warn('[chat] emit error', err);
      }
    };

    const openLoginModal = async () => {
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

    const updateUserHeader = (user, loggedIn) => {
      if (userInfoEl) userInfoEl.hidden = !loggedIn;
      if (logoutBtn) logoutBtn.hidden = !loggedIn;
      if (!loggedIn || !user) {
        if (userNameEl) userNameEl.textContent = '';
        if (userAvatarEl) {
          userAvatarEl.src = '';
          userAvatarEl.hidden = true;
        }
        return;
      }
      const name = getUserDisplayName(user);
      const avatar = getUserAvatar(user);
      if (userNameEl) userNameEl.textContent = name || 'Usuario';
      if (userAvatarEl) {
        userAvatarEl.src = avatar || '';
        userAvatarEl.alt = name ? `Avatar ${name}` : 'Avatar';
        userAvatarEl.hidden = !avatar;
      }
    };

    const updateHeaderRewards = () => {
      if (!rewardsEl) return;
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
        rewardsEl.innerHTML = '';
        rewardsEl.hidden = true;
        return;
      }
      rewardsEl.hidden = false;
      rewardsEl.innerHTML = entries
        .sort(([a], [b]) => a.localeCompare(b))
        .map(
          ([icon, qty]) =>
            `<div class="training-badge reward-badge"><ion-icon name="${icon}"></ion-icon><span>${qty}</span></div>`
        )
        .join('');
    };

    const updateAccessState = (user) => {
      if (accessLoadingTimer) {
        clearTimeout(accessLoadingTimer);
        accessLoadingTimer = null;
      }
      hideLoadingState();
      const userId =
        user && user.id !== undefined && user.id !== null ? String(user.id) : null;
      const loggedIn = Boolean(userId);
      const chatEnabled = isChatEnabledUser(user);
      const userChanged = userId !== lastUserId;
      const chatEnabledChanged = chatEnabled !== lastChatEnabled;
      const isInitialLoad = lastUserId === null;
      const hasStoredMessages = chatThreads.catbot.length > 0 || chatThreads.chatbot.length > 0;

      updateUserHeader(user, loggedIn);

      if (loginPanel) loginPanel.hidden = loggedIn;
      if (lockedPanel) lockedPanel.hidden = !loggedIn || chatEnabled;
      if (accessPanel) accessPanel.hidden = chatEnabled;
      if (chatPanel) chatPanel.hidden = !chatEnabled;

	      if (userChanged) {
	        setChatbotDailyLimitBlocked(false);
	        clearChatbotAlignedTtsLimitStatus();
	        loadTalkTimelinesForUser(userId);
	        clearThread();
	      }

      if (!chatEnabled) {
        setChatbotDailyLimitBlocked(false);
        if (userChanged || chatEnabledChanged) {
          resetChatSession({ keepIntro: false, setDefaultHint: false, keepTimeline: true });
        }
        setControlsEnabled(false);
        disconnectRealtime();
      } else {
        if (userChanged || chatEnabledChanged) {
          resetChatSession({ keepIntro: true, setDefaultHint: true, keepTimeline: true });
          renderThread(chatMode);
          ensureIntroMessage(chatMode);
        } else {
          ensureIntroMessage(chatMode);
        }
        setControlsEnabled(true);
        connectRealtime(user);
      }

      lastUserId = userId;
      lastChatEnabled = chatEnabled;
    };

    recordBtn?.addEventListener('click', () => {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    });

    stopBtn?.addEventListener('click', () => {
      if (isRecording) {
        stopRecording();
      }
    });

    cancelBtn?.addEventListener('click', () => {
      cancelDraft();
    });

    previewBtn?.addEventListener('click', () => {
      const typedText = textInput ? textInput.value.trim() : '';
      const activeText = draftTranscript || typedText;
      if (!activeText) return;
      const audioUrl = draftAudioUrl;
      const speakText = draftSpeakText || activeText;
      playPreviewAudio({ audioUrl, speakText });
    });

    const sendUserText = (userText, payload = {}) => {
      if (!userText) return;
      const messageMode = chatMode;
      if (messageMode === 'chatbot' && isChatbotDailyLimitActive()) {
        setHint(getChatbotDailyLimitHint());
        return;
      }
      if (messageMode === 'catbot') {
        awaitingBot[messageMode] = true;
      }
      removeTypingIndicator();
      appendMessage({
        role: 'user',
        text: userText,
        audioUrl: payload.audioUrl || '',
        speakText: payload.audioUrl ? '' : payload.speakText || userText
      }, { mode: messageMode });
      setTypingState(messageMode, true);
      if (payload.audioUrl) retainedAudioUrls.push(payload.audioUrl);
      clearDraft(false);
      setHint(uiCopy.hintRecordAgain);
      emitRealtimeMessage({ text: userText });
      if (messageMode === 'catbot') {
        if (replyTimers[messageMode]) clearTimeout(replyTimers[messageMode]);
        replyTimers[messageMode] = setTimeout(() => {
          if (!awaitingBot[messageMode]) {
            replyTimers[messageMode] = null;
            return;
          }
          awaitingBot[messageMode] = false;
          setTypingState(messageMode, false);
          const reply = pickBotReply(userText);
          appendMessage(
            { role: 'bot', text: reply, audioUrl: '', speakText: reply },
            { mode: messageMode }
          );
          replyTimers[messageMode] = null;
        }, 700);
      }
    };

    const handleSendPointerDown = (event) => {
      if (!isChatInputActive()) return;
      event.preventDefault();
      keepChatInputFocused({ scroll: true });
    };

    const handleControlPointerDown = (event) => {
      if (!isChatInputActive()) return;
      const target = event.target;
      if (target && target.closest && target.closest('#chat-text-row')) return;
      event.preventDefault();
      keepChatInputFocused({ scroll: true });
    };

    const handleChatPanelPointerDown = (event) => {
      if (!isChatInputActive()) return;
      const target = event.target;
      if (target && target.closest && (
        target.closest('#chat-text-row') ||
        target.closest('#chat-chat-controls') ||
        target.closest('#chat-composer-row') ||
        target.closest('#chat-chat-thread')
      )) {
        return;
      }
      if (textInput && document.activeElement === textInput) {
        textInput.blur();
      }
    };

    const handleViewportChange = () => {
      scheduleChatKeyboardSync();
    };

    sendBtn?.addEventListener('click', () => {
      const typedText = textInput ? textInput.value.trim() : '';
      const hasDraft = Boolean(draftTranscript);
      const userText = hasDraft ? draftTranscript : typedText;
      if (!userText) return;
      if (!hasDraft) {
        keepChatInputFocused({ scroll: true });
      }
      sendUserText(userText, {
        audioUrl: draftAudioUrl,
        speakText: draftSpeakText || userText
      });
      if (!hasDraft) {
        keepChatInputFocused({ defer: true, scroll: true });
      }
    });

    textInput?.addEventListener('input', () => {
      updateDraftButtons();
    });

    textInput?.addEventListener('focus', () => {
      scheduleChatKeyboardSync();
      scheduleScrollThreadToBottom('auto');
    });

    textInput?.addEventListener('blur', () => {
      scheduleChatKeyboardSync();
      scheduleScrollThreadToBottom('auto');
    });

    textInput?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      const typedText = textInput.value.trim();
      if (!typedText) return;
      event.preventDefault();
      sendUserText(typedText, { audioUrl: '', speakText: typedText });
      keepChatInputFocused({ defer: true, scroll: true });
    });

    loginBtn?.addEventListener('click', () => {
      openLoginModal().catch((err) => {
        console.error('[chat] error abriendo login', err);
      });
    });
    logoutBtn?.addEventListener('click', () => {
      if (typeof window.setUser === 'function') {
        window.setUser(null);
        return;
      }
      window.user = null;
      try {
        localStorage.removeItem('appv5:user');
      } catch (err) {
        console.error('[user] error borrando localStorage', err);
      }
      window.dispatchEvent(new CustomEvent('app:user-change', { detail: null }));
    });

    chatPanel?.addEventListener('pointerdown', handleChatPanelPointerDown);
    composerRow?.addEventListener('pointerdown', handleControlPointerDown);
    recordBtn?.addEventListener('pointerdown', handleControlPointerDown);
    stopBtn?.addEventListener('pointerdown', handleControlPointerDown);
    cancelBtn?.addEventListener('pointerdown', handleControlPointerDown);
    previewBtn?.addEventListener('pointerdown', handleControlPointerDown);
    sendBtn?.addEventListener('pointerdown', handleSendPointerDown);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
    }
    window.addEventListener('resize', handleViewportChange);
    threadEl?.addEventListener('scroll', updateChatAutoScroll, { passive: true });

    const initialUser = window.user;
    const initialLoggedIn =
      initialUser && initialUser.id !== undefined && initialUser.id !== null;
    if (initialUser && initialUser.id !== undefined && initialUser.id !== null) {
      loadTalkTimelinesForUser(initialUser.id);
    } else {
      loadTalkTimelinesForUser(null);
    }
    updateUserHeader(initialUser, Boolean(initialLoggedIn));
    updateHeaderRewards();
    showLoadingState();
    accessLoadingTimer = setTimeout(() => {
      updateAccessState(window.user);
    }, 180);
    this._userHandler = (event) => updateAccessState(event.detail);
    window.addEventListener('app:user-change', this._userHandler);
    this._chatOverrideHandler = () => updateAccessState(window.user);
    window.addEventListener('app:chat-override', this._chatOverrideHandler);
    this._rewardsHandler = () => updateHeaderRewards();
    window.addEventListener('app:speak-stores-change', this._rewardsHandler);

    const updateCoachAvatar = () => {
      if (!coachAvatar) return;
      stopCoachMascotTalk({ settle: false, all: true });
      if (chatMode === 'chatbot') {
        coachAvatar.classList.remove('coach-avatar-cat');
        coachAvatar.classList.add('coach-avatar-bot');
      } else {
        coachAvatar.classList.remove('coach-avatar-bot');
        coachAvatar.classList.add('coach-avatar-cat');
      }
      preloadCoachMascotFrames();
      const sequence = getCoachMascotSequence();
      const restFrame = Number.isFinite(sequence.restFrame)
        ? sequence.restFrame
        : Math.max(0, (Array.isArray(sequence.framePaths) ? sequence.framePaths.length : 1) - 1);
      renderCoachMascotFrame(restFrame, sequence);
    };

    const updateCoachCopy = () => {
      if (!coachTitleEl || !coachSubtitleEl) return;
      if (chatMode === 'chatbot') {
        coachTitleEl.textContent = uiCopy.coachChatbotTitle;
        coachSubtitleEl.textContent = uiCopy.coachChatbotSubtitle;
      } else {
        coachTitleEl.textContent = uiCopy.coachCatbotTitle;
        coachSubtitleEl.textContent = uiCopy.coachCatbotSubtitle;
      }
    };

    const applyLocaleCopy = (nextLocale, options = {}) => {
      const normalized = normalizeCopyLocale(nextLocale || getRuntimeLocale()) || 'en';
      const force = options.force === true;
      const rerenderThread = options.rerenderThread === true;
      if (!force && normalized === uiLocale) return false;

      const previousDefaultHint = defaultHint;
      uiLocale = normalized;
      uiCopy = getChatCopy(uiLocale);
      tokenFmt = new Intl.NumberFormat(uiLocale === 'es' ? 'es-ES' : 'en-US');

      if (modeToggle) {
        const catBtn = modeToggle.querySelector('[data-mode="catbot"]');
        const botBtn = modeToggle.querySelector('[data-mode="chatbot"]');
        if (catBtn) catBtn.textContent = uiCopy.modeCatbot;
        if (botBtn) botBtn.textContent = uiCopy.modeChatbot;
      }

      if (loadingPanel) {
        const loadingText = loadingPanel.querySelector('span');
        if (loadingText) loadingText.textContent = uiCopy.loadingUser;
      }

      if (loginPanel) {
        const loginText = loginPanel.querySelector('p');
        if (loginText) loginText.textContent = uiCopy.loginRequired;
      }
      if (loginBtn) {
        const loginLabel = loginBtn.querySelector('span');
        if (loginLabel) loginLabel.textContent = uiCopy.loginCta;
      }

      if (lockedPanel) {
        const lockedText = lockedPanel.querySelector('p');
        const lockedMuted = lockedPanel.querySelector('p.muted');
        if (lockedText) lockedText.textContent = uiCopy.planLocked;
        if (lockedMuted) lockedMuted.textContent = uiCopy.planUpgrade;
      }

      if (textInput) textInput.placeholder = uiCopy.inputPlaceholder;

      if (recordBtn) {
        recordBtn.setAttribute('aria-label', uiCopy.record);
        const recordLabel = recordBtn.querySelector('span');
        if (recordLabel) recordLabel.textContent = uiCopy.record;
      }
      if (stopBtn) stopBtn.setAttribute('aria-label', uiCopy.stop);
      if (cancelBtn) cancelBtn.setAttribute('aria-label', uiCopy.cancel);
      if (previewBtn) {
        previewBtn.setAttribute('aria-label', uiCopy.play);
        const previewLabel = previewBtn.querySelector('span');
        if (previewLabel) previewLabel.textContent = uiCopy.listen;
      }
      if (sendBtn) {
        sendBtn.setAttribute('aria-label', uiCopy.send);
        const sendLabel = sendBtn.querySelector('span');
        if (sendLabel) sendLabel.textContent = uiCopy.send;
      }

      defaultHint = uiCopy.hintDefault;
      if (hintEl) {
        const currentHint = String(hintEl.textContent || '').trim();
        const shouldResetHint =
          !currentHint ||
          currentHint === previousDefaultHint ||
          currentHint === uiCopy.hintDefault;
        if (chatMode === 'chatbot' && isChatbotDailyLimitActive()) {
          setHint(getChatbotDailyLimitHint());
        } else if (shouldResetHint) {
          setHint(defaultHint);
        }
      }

      updateCoachCopy();
      if (rerenderThread) {
        renderThread(chatMode);
      }
      return true;
    };

    const updateSendButtonIcon = () => {
      if (!sendBtn) return;
      const icon = sendBtn.querySelector('ion-icon');
      if (!icon) return;
      const isInlineTextSend = sendBtn.parentElement === textRow;
      icon.setAttribute('name', isInlineTextSend ? 'paper-plane' : 'arrow-up');
    };

    const updateChatbotOneLineLayout = () => {
      const textVisible = Boolean(textRow && !textRow.hidden);
      const controlsVisible = Boolean(chatControls && !chatControls.hidden);
      const isOneLine =
        chatMode === 'chatbot' &&
        talkState === TALK_STATE_IDLE &&
        textVisible &&
        controlsVisible;
      this.classList.toggle('chat-chatbot-one-line', isOneLine);
    };

    const placeSendButton = () => {
      if (!sendBtn || !textRow || !chatControls) return;
      let target = reviewUi || chatControls;
      if (chatMode === 'chatbot') {
        const reviewTarget = reviewUi || chatControls;
        const hasDraftReview = talkState === TALK_STATE_REVIEW && Boolean(draftTranscript);
        target = hasDraftReview ? reviewTarget : textRow;
      }
      if (sendBtn.parentElement !== target) {
        target.appendChild(sendBtn);
      }
      updateSendButtonIcon();
    };

    const updateChatControlsVisibility = () => {
      const isChatbot = chatMode === 'chatbot';
      if (hintEl) hintEl.hidden = false;
      if (chatControls) chatControls.hidden = false;
      if (textRow) textRow.classList.toggle('chat-text-row-inline', isChatbot);
      placeSendButton();
      updateSendButtonIcon();
      setTalkState(talkState);
      updateChatbotOneLineLayout();
      scheduleChatKeyboardSync();
    };

    const updateTextRowVisibility = (debugOverride) => {
      const isChatbot = chatMode === 'chatbot';
      const collapsed = isChatbot && talkState !== TALK_STATE_IDLE;
      if (textRow) {
        textRow.hidden = !isChatbot;
        textRow.classList.toggle('is-collapsed', collapsed);
      }
      if (!isChatbot && textInput) {
        textInput.value = '';
      }
      updateChatbotOneLineLayout();
      scheduleChatKeyboardSync();
    };

    const setChatMode = (mode, { reconnect, persist } = {}) => {
      if (mode !== 'catbot' && mode !== 'chatbot') return;
      if (chatMode === mode) return;
      chatMode = mode;
      if (persist !== false) {
        writeDebugChatMode(mode);
      }
      if (modeToggle) {
        modeToggle.querySelectorAll('.chat-mode-btn').forEach((btn) => {
          btn.classList.toggle('is-active', btn.dataset.mode === mode);
        });
      }
      updateCoachAvatar();
      updateCoachCopy();
      updateChatControlsVisibility();
      updateTextRowVisibility();
      renderThread(chatMode);
      ensureIntroMessage(chatMode);
      if (reconnect && lastChatEnabled && window.user) {
        disconnectRealtime();
        connectRealtime(window.user);
      }
      applyControlsEnabled();
      updateDraftButtons();
    };

    const applyDebugMode = () => {
      const debug = Boolean(window.r34lp0w3r && window.r34lp0w3r.speakDebug);
      const showModeToggle = debug || CHAT_MODE_TOGGLE_ALWAYS_VISIBLE_FOR_TESTING;
      if (modeToggle) modeToggle.hidden = !showModeToggle;
      if (!showModeToggle) {
        if (textInput) textInput.value = '';
        updateTextRowVisibility(false);
        setChatMode('catbot', { reconnect: true, persist: false });
        renderThread(chatMode);
      } else {
        const preferredMode = readDebugChatMode();
        if (chatMode !== preferredMode) {
          setChatMode(preferredMode, { reconnect: true, persist: false });
        } else {
          updateTextRowVisibility(true);
          updateChatControlsVisibility();
        }
      }
      updateDraftButtons();
    };

    modeToggle?.addEventListener('click', (event) => {
      const button = event.target.closest('.chat-mode-btn');
      if (!button) return;
      const mode = button.dataset.mode;
      setChatMode(mode, { reconnect: true });
    });

    applyLocaleCopy(uiLocale, { force: true, rerenderThread: false });
    this._localeHandler = (event) => {
      const nextLocale = event && event.detail ? event.detail.locale : '';
      applyLocaleCopy(nextLocale, { rerenderThread: true });
    };
    window.addEventListener('app:locale-change', this._localeHandler);

    this._debugHandler = applyDebugMode;
    window.addEventListener('app:speak-debug', this._debugHandler);
    applyDebugMode();
    updateCoachAvatar();
    updateCoachCopy();
    updateChatControlsVisibility();

    this._talkResetHandler = () => {
      resetChatSession({ keepIntro: true, setDefaultHint: true });
      renderThread(chatMode);
    };
    window.addEventListener('app:talk-timelines-reset', this._talkResetHandler);

    this._cleanupChat = () => {
      resetChatSession({ keepIntro: false, setDefaultHint: false });
      disconnectRealtime();
      if (accessLoadingTimer) {
        clearTimeout(accessLoadingTimer);
        accessLoadingTimer = null;
      }
      if (chatKeyboardRaf) {
        cancelAnimationFrame(chatKeyboardRaf);
        chatKeyboardRaf = null;
      }
      if (scrollToBottomTimer) {
        clearTimeout(scrollToBottomTimer);
        scrollToBottomTimer = null;
      }
      if (keyboardOpenScrollTimer) {
        clearTimeout(keyboardOpenScrollTimer);
        keyboardOpenScrollTimer = null;
      }
      setChatKeyboardOffset(0);
      setChatKeyboardState(false, false);
      clearThreadViewportClamp();
      chatPanel?.removeEventListener('pointerdown', handleChatPanelPointerDown);
      composerRow?.removeEventListener('pointerdown', handleControlPointerDown);
      recordBtn?.removeEventListener('pointerdown', handleControlPointerDown);
      stopBtn?.removeEventListener('pointerdown', handleControlPointerDown);
      cancelBtn?.removeEventListener('pointerdown', handleControlPointerDown);
      previewBtn?.removeEventListener('pointerdown', handleControlPointerDown);
      sendBtn?.removeEventListener('pointerdown', handleSendPointerDown);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
        window.visualViewport.removeEventListener('scroll', handleViewportChange);
      }
      window.removeEventListener('resize', handleViewportChange);
      threadEl?.removeEventListener('scroll', updateChatAutoScroll);
    };
  }

  disconnectedCallback() {
    if (this._cleanupChat) {
      this._cleanupChat();
    }
    if (this._userHandler) {
      window.removeEventListener('app:user-change', this._userHandler);
    }
    if (this._chatOverrideHandler) {
      window.removeEventListener('app:chat-override', this._chatOverrideHandler);
    }
    if (this._rewardsHandler) {
      window.removeEventListener('app:speak-stores-change', this._rewardsHandler);
    }
    if (this._debugHandler) {
      window.removeEventListener('app:speak-debug', this._debugHandler);
    }
    if (this._localeHandler) {
      window.removeEventListener('app:locale-change', this._localeHandler);
    }
    if (this._talkResetHandler) {
      window.removeEventListener('app:talk-timelines-reset', this._talkResetHandler);
    }
  }
}

if (!customElements.get('page-chat')) {
  customElements.define('page-chat', PageChat);
}
