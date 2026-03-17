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
                  <button type="button" class="chat-mode-btn" data-mode="public">${uiCopy.modePublic}</button>
                  <button type="button" class="chat-mode-btn" data-mode="private">${uiCopy.modePrivate}</button>
                  <button type="button" class="chat-mode-btn" data-mode="coach">${uiCopy.modeCoach}</button>
                </div>
                <div class="chat-title-row">
                  <h3 id="chat-coach-title">${uiCopy.coachCatbotTitle}</h3>
                  <div class="chat-community-presence" id="chat-community-presence" hidden></div>
                </div>
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
              <div class="chat-community-lists" id="chat-community-lists" hidden>
                <section class="chat-community-list-block">
                  <div class="chat-community-list-title" id="chat-community-rooms-title">${uiCopy.communityChatsTitle}</div>
                  <div class="chat-community-list" id="chat-community-room-list"></div>
                </section>
                <section class="chat-community-list-block">
                  <div class="chat-community-list-title" id="chat-community-online-title">${uiCopy.communityOnlineUsersTitle}</div>
                  <div class="chat-community-list" id="chat-community-peer-list"></div>
                </section>
              </div>
              <div class="chat-community-dm-header" id="chat-community-dm-header" hidden>
                <button type="button" class="chat-community-dm-back" id="chat-community-dm-back" aria-label="${uiCopy.communityBackToChats}">
                  <ion-icon name="chevron-back"></ion-icon>
                </button>
                <div class="chat-community-dm-avatar" id="chat-community-dm-avatar" aria-hidden="true"></div>
                <div class="chat-community-dm-main">
                  <div class="chat-community-dm-name" id="chat-community-dm-name">${uiCopy.communityNoPeerName}</div>
                  <div class="chat-community-dm-status" id="chat-community-dm-status"></div>
                </div>
              </div>
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
              <div class="chat-hint" id="chat-chat-hint"></div>
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
    const communityPresenceEl = this.querySelector('#chat-community-presence');
    const communityListsEl = this.querySelector('#chat-community-lists');
    const communityRoomListEl = this.querySelector('#chat-community-room-list');
    const communityPeerListEl = this.querySelector('#chat-community-peer-list');
    const communityRoomsTitleEl = this.querySelector('#chat-community-rooms-title');
    const communityOnlineTitleEl = this.querySelector('#chat-community-online-title');
    const communityDmHeaderEl = this.querySelector('#chat-community-dm-header');
    const communityDmBackBtn = this.querySelector('#chat-community-dm-back');
    const communityDmAvatarEl = this.querySelector('#chat-community-dm-avatar');
    const communityDmNameEl = this.querySelector('#chat-community-dm-name');
    const communityDmStatusEl = this.querySelector('#chat-community-dm-status');
    const composerRow = this.querySelector('#chat-composer-row');
    const textRow = this.querySelector('#chat-text-row');
    const textInput = this.querySelector('#chat-text-input');
    let defaultHint = uiCopy.hintDefault;

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
    let activeMessagePlayback = { id: '', source: '' };
    let previewAudio = null;
    let isPreviewPlaying = false;
    const preparedMessageAudio = new Map();
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
    let pusherCommunityPublicChannel = null;
    let pusherCommunityInboxChannel = null;
    const pusherCommunityDmChannels = new Map();
    const communityDmReadRequests = new Map();
    const communityDmDeliveredAcks = new Set();
    let realtimeConnected = false;
    let communityPresenceHeartbeatTimer = null;
    let communityPresenceSessionId = '';
    let communityPresenceLastHeartbeatAt = 0;
    let communityPresenceLastHeartbeatSignature = '';
    let controlsBaseEnabled = false;
    let chatbotDailyLimitBlocked = false;
    let chatbotDailyLimitInfo = null;
    let chatMode = 'catbot';
    let communityPresenceCount = 0;
    let communityPresenceUsers = [];
    let communityView = 'public';
    let communityRoomsLoading = false;
    let communityRoomsLoaded = false;
    let communityPublicUnreadCount = 0;
    let communityDmRooms = [];
    let activeCommunityDmRoomId = '';
    let currentAppTab = (() => {
      try {
        return String(localStorage.getItem('appv5:active-tab') || '').trim().toLowerCase() || 'home';
      } catch (err) {
        return 'home';
      }
    })();
    const communityDmThreads = {};
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
    const CHATBOT_AUDIO_RENDER_FALLBACK_MS = 1800;
    const REALTIME_EMIT_TIMEOUT_MS = 8000;
    const CHATBOT_REPLY_TIMEOUT_MS = 12000;
    const COMMUNITY_PUBLIC_CHANNEL = 'site-wide-chat-channel';
    const COMMUNITY_USER_INBOX_CHANNEL_PREFIX = 'private-community-user-';
    const COMMUNITY_PRESENCE_HEARTBEAT_MS = 8000;
    const COMMUNITY_PRESENCE_IMMEDIATE_THROTTLE_MS = 3000;
    const RECORDING_TIMESLICE = 500;
    const VOSK_SAMPLE_RATE_DEFAULT = 16000;
	    const TALK_STORAGE_PREFIX = 'appv5:talk-timelines:';
	    const TALK_STORAGE_LEGACY = 'appv5:talk-timelines';
	    const CHAT_MODE_DEBUG_KEY = 'appv5:chat-debug-chat-mode';
	    const CHAT_CATBOT_ENABLED_KEY = 'appv5:chat-catbot-enabled';
	    const COMMUNITY_PRESENCE_SESSION_KEY = 'appv5:community-presence-session-id';
	    const COMMUNITY_CHAT_UNREAD_STORAGE_PREFIX = 'appv5:chat-community-unread:';
	    const APP_TAB_STORAGE_KEY = 'appv5:active-tab';
	    const SHARED_AUDIO_MODE_KEY = 'appv5:free-ride-audio-mode';
	    const SHARED_AUDIO_MODE_GENERATED = 'generated';
	    const SHARED_AUDIO_MODE_LOCAL = 'local';
	    const CHATBOT_ALIGNED_TTS_CACHE_MAX_ITEMS = 80;
	    let talkStorageKey = `${TALK_STORAGE_PREFIX}anon`;
    const replyTimers = { catbot: null, chatbot: null, community: null };
    const awaitingBot = { catbot: false, chatbot: false, community: false };
    const typingState = { catbot: false, chatbot: false, community: false };
    const chatThreads = { catbot: [], chatbot: [], community: [] };
    let talkState = TALK_STATE_IDLE;
    let communityHistoryLoading = false;
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
    let catbotFeatureEnabled = false;
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
    const normalizeCatbotFeatureEnabled = (value) => {
      if (typeof value === 'boolean') return value;
      const normalized = String(value || '')
        .trim()
        .toLowerCase();
      if (!normalized) return false;
      return ['1', 'true', 'on', 'yes'].includes(normalized);
    };
    const getStoredCatbotFeatureEnabled = () => {
      const globalValue =
        window.r34lp0w3r && Object.prototype.hasOwnProperty.call(window.r34lp0w3r, 'chatCatbotEnabled')
          ? window.r34lp0w3r.chatCatbotEnabled
          : undefined;
      if (globalValue !== undefined) return normalizeCatbotFeatureEnabled(globalValue);
      try {
        return normalizeCatbotFeatureEnabled(localStorage.getItem(CHAT_CATBOT_ENABLED_KEY));
      } catch (err) {
        return false;
      }
    };
    const isCatbotFeatureEnabled = () => catbotFeatureEnabled === true;
    const isCommunityFeatureEnabled = () => true;
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
        communityPublicMessagesEndpoint: config.communityPublicMessagesEndpoint || '',
        communityPublicPresenceEndpoint: config.communityPublicPresenceEndpoint || '',
        communityRoomsEndpoint: config.communityRoomsEndpoint || '',
        communityMessagesEndpoint: config.communityMessagesEndpoint || '',
        communityDmRoomEndpoint: config.communityDmRoomEndpoint || '',
        communityDmReadEndpoint: config.communityDmReadEndpoint || '',
        enabledTransports: Array.isArray(config.enabledTransports) ? config.enabledTransports : ['ws', 'wss'],
        channelType: config.channelType || 'private',
        channelPrefix: config.channelPrefix || 'coach'
      };
    };

    const getCoachId = () => (chatMode === 'chatbot' ? '2' : '1');

    const buildChannelName = (userId, config) => {
      if (chatMode === 'community') return COMMUNITY_PUBLIC_CHANNEL;
      const coachId = getCoachId();
      const base = `${config.channelPrefix}${coachId}-${userId}`;
      const type = config.channelType;
      if (!type || type === 'public') return base;
      return `${type}-${base}`;
    };

    const buildCommunityInboxChannelName = (userId) => {
      const safeUserId = userId !== undefined && userId !== null ? String(userId).trim() : '';
      return safeUserId ? `${COMMUNITY_USER_INBOX_CHANNEL_PREFIX}${safeUserId}` : '';
    };

    const pickFirstText = (...values) => {
      for (let idx = 0; idx < values.length; idx += 1) {
        const value = values[idx];
        if (value === undefined || value === null) continue;
        const text = String(value).trim();
        if (text) return text;
      }
      return '';
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

		    const getRealtimeStateToken = () => {
		      const cfg = window.realtimeConfig || {};
		      return typeof cfg.stateToken === 'string'
		        ? cfg.stateToken.trim()
		        : typeof window.REALTIME_STATE_TOKEN === 'string'
		        ? window.REALTIME_STATE_TOKEN.trim()
		        : '';
		    };

		    const buildRealtimeStateHeaders = (base = {}) => {
		      const headers = { ...base };
		      const token = getRealtimeStateToken();
		      if (token) headers['x-rt-token'] = token;
		      return headers;
		    };

		    const buildAlignedTtsHeaders = () =>
		      buildRealtimeStateHeaders({ 'Content-Type': 'application/json' });

		    const createClientSessionId = () => {
		      try {
		        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
		          return window.crypto.randomUUID();
		        }
		      } catch (err) {
		        // no-op
		      }
		      return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
		    };

		    const getCommunityPresenceSessionId = () => {
		      if (communityPresenceSessionId) return communityPresenceSessionId;
		      try {
		        const stored = sessionStorage.getItem(COMMUNITY_PRESENCE_SESSION_KEY);
		        if (stored && String(stored).trim()) {
		          communityPresenceSessionId = String(stored).trim();
		          return communityPresenceSessionId;
		        }
		      } catch (err) {
		        // no-op
		      }
		      communityPresenceSessionId = createClientSessionId();
		      try {
		        sessionStorage.setItem(COMMUNITY_PRESENCE_SESSION_KEY, communityPresenceSessionId);
		      } catch (err) {
		        // no-op
		      }
		      return communityPresenceSessionId;
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

    const normalizeIncoming = (data, fallbackRole, options = {}) => {
      const messageMode = options.mode || chatMode;
      const viewerId = pickFirstText(options.viewerId);
      if (!data) return null;
      if (typeof data === 'string') {
        const text = normalizeChatText(data);
        if (!text) return null;
        return {
          id: '',
          clientMessageId: '',
          role: fallbackRole,
          text,
          audioUrl: '',
          audioKind: '',
          speakText: text,
          actorId: '',
          actorName: '',
          actorAvatar: '',
          actorApp: '',
          limitReached: false,
          tokenLimitDay: 0,
          usedTokensDay: 0,
          day: ''
        };
      }
      if (typeof data !== 'object') return null;
      const text = normalizeChatText(data.text || data.message || data.body || data.content);
      if (!text) return null;
      const actor =
        data.actor && typeof data.actor === 'object' ? data.actor : {};
      const actorId = pickFirstText(actor.id, actor.user_id, actor.userId);
      const actorName = pickFirstText(
        actor.displayName,
        actor.display_name,
        actor.name,
        data.user_name,
        data.userName,
        data.nickname
      );
      const actorAvatar = pickFirstText(actor.avatar, actor.image, actor.img);
      const actorApp = pickFirstText(actor.app, data.app);
      const role =
        messageMode === 'community'
          ? actorId && viewerId && actorId === viewerId
            ? 'user'
            : 'bot'
          : normalizeRole(data.role || data.sender || data.from, fallbackRole);
      const audioUrl = messageMode === 'community' ? '' : data.audio_url || data.audioUrl || '';
      const audioKind = messageMode === 'community' ? '' : String(data.audio_kind || data.audioKind || '').trim();
      const speakText =
        messageMode === 'community'
          ? ''
          : normalizeChatText(data.speakText || data.speak_text || text) || text;
      const limitReached = Boolean(
        data.limit_reached ||
        data.limitReached ||
        data.chatbot_disabled === 'daily_token_limit'
      );
      return {
        id: pickFirstText(data.id),
        clientMessageId: pickFirstText(
          data.client_message_id,
          data.clientMessageId,
          data.message_id,
          data.messageId
        ),
        role,
        text,
        audioUrl,
        audioKind,
        speakText,
        createdAt: pickFirstText(data.created_at, data.createdAt, data.published, data.timestamp),
        deliveredAt: pickFirstText(data.delivered_at, data.deliveredAt),
        deliveredUserId: pickFirstText(data.delivered_user_id, data.deliveredUserId),
        deliveredUuid: pickFirstText(data.delivered_uuid, data.deliveredUuid),
        actorId,
        actorName,
        actorAvatar,
        actorApp,
        limitReached,
        tokenLimitDay: Number(data.token_limit_day || data.tokenLimitDay || 0),
        usedTokensDay: Number(data.used_tokens_day || data.usedTokensDay || 0),
        day: typeof data.day === 'string' ? data.day : ''
      };
    };

    const normalizeAudioKind = (value) => {
      const raw = String(value || '').trim().toLowerCase();
      if (!raw) return '';
      if (raw === 'aws-polly' || raw === 'polly' || raw === 'tts-aligned') return 'polly';
      if (raw === 'blob' || raw === 'local' || raw === 'recorded') return 'local';
      if (raw === 'native' || raw === 'speech' || raw === 'web-speech') return 'native';
      return raw;
    };

    const sanitizeStoredAudioUrl = (value) => {
      const raw = typeof value === 'string' ? value.trim() : '';
      if (!raw || raw.startsWith('blob:')) return '';
      return raw;
    };

    const inferPlaybackSource = ({ audioUrl, audioKind }) => {
      const rawUrl = typeof audioUrl === 'string' ? audioUrl.trim() : '';
      if (!rawUrl) return 'native';
      const normalizedKind = normalizeAudioKind(audioKind);
      if (normalizedKind) return normalizedKind;
      if (rawUrl.startsWith('blob:')) return 'local';
      if (/tts-aligned/i.test(rawUrl)) return 'polly';
      return 'local';
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

    const isPublicAvatarUrl = (value) => {
      const url = pickFirstText(value);
      if (!url) return false;
      if (!/^https?:\/\//i.test(url)) return false;
      return !/(localhost|127\.0\.0\.1|_capacitor_file_)/i.test(url);
    };

    const getUserPublicAvatar = (user) => {
      if (!user) return '';
      if (typeof window.getUserAvatarRemoteCandidates === 'function') {
        const candidates = window.getUserAvatarRemoteCandidates(user);
        const match = (Array.isArray(candidates) ? candidates : []).find((entry) => isPublicAvatarUrl(entry));
        if (match) return String(match).trim();
      }
      const remote = pickFirstText(user.image);
      if (isPublicAvatarUrl(remote)) return remote;
      const local = pickFirstText(user.image_local);
      if (isPublicAvatarUrl(local)) return local;
      return '';
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

    const escapeHintText = (value) =>
      String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const renderHintMarkup = (text) => {
      const escaped = escapeHintText(text);
      const recordLabel = escapeHintText(uiCopy.record || 'Record');
      const stopLabel = escapeHintText(uiCopy.stop || 'Stop');
      return escaped
        .replace(
          /\[record\]/g,
          `<span class="chat-hint-icon" aria-label="${recordLabel}"><ion-icon name="mic"></ion-icon></span>`
        )
        .replace(
          /\[stop\]/g,
          `<span class="chat-hint-icon" aria-label="${stopLabel}"><ion-icon name="stop"></ion-icon></span>`
        );
    };

    const setHint = (text) => {
      if (!hintEl) return;
      const rawText = String(text == null ? '' : text);
      hintEl.dataset.rawHint = rawText;
      hintEl.innerHTML = renderHintMarkup(rawText);
    };

    setHint(defaultHint);

    const getDefaultHintForMode = (mode = chatMode) =>
      mode === 'community'
        ? communityView === 'dm'
          ? uiCopy.communitySelectChat || uiCopy.introCommunityDm || uiCopy.introCommunity
          : uiCopy.introCommunity
        : uiCopy.hintDefault;

    const updateCommunityPresenceUi = () => {
      if (!communityPresenceEl) return;
      const currentUser = window.user;
      const currentUserId =
        currentUser && currentUser.id !== undefined && currentUser.id !== null
          ? String(currentUser.id).trim()
          : '';
      if (chatMode !== 'community' || !isChatEnabledUser(currentUser) || !currentUserId) {
        communityPresenceEl.hidden = true;
        communityPresenceEl.textContent = '';
        return;
      }
      communityPresenceEl.hidden = false;
      communityPresenceEl.textContent = uiCopy.communityPresenceCount(
        tokenFmt.format(Math.max(0, Number(communityPresenceCount) || 0))
      );
    };

    const isCommunityPublicVisible = () =>
      currentAppTab === 'chat' && chatMode === 'community' && communityView === 'public';

    const isCommunityDmVisible = () =>
      currentAppTab === 'chat' && chatMode === 'community' && communityView === 'dm';

    const updateCommunityNavUnreadUi = (count = getCommunityTotalUnreadCount()) => {
      if (!modeToggle) return;
      const publicButton = modeToggle.querySelector('[data-mode="public"]');
      const dmButton = modeToggle.querySelector('[data-mode="private"]');
      const dmUnread = Math.max(0, Math.round(Number(count) || 0));
      const publicUnread = Math.max(0, Math.round(Number(communityPublicUnreadCount) || 0));
      if (publicButton) {
        const showPublicDot = publicUnread > 0 && !isCommunityPublicVisible();
        publicButton.classList.toggle('has-unread', showPublicDot);
      }
      if (dmButton) {
        const showDmDot = dmUnread > 0 && !isCommunityDmVisible();
        dmButton.classList.toggle('has-unread', showDmDot);
      }
    };

    const getCommunityRoomsEndpoint = () =>
      typeof (window.realtimeConfig || {}).communityRoomsEndpoint === 'string'
        ? window.realtimeConfig.communityRoomsEndpoint.trim()
        : '';

    const getCommunityMessagesEndpoint = () =>
      typeof (window.realtimeConfig || {}).communityMessagesEndpoint === 'string'
        ? window.realtimeConfig.communityMessagesEndpoint.trim()
        : '';

    const getCommunityDmRoomEndpoint = () =>
      typeof (window.realtimeConfig || {}).communityDmRoomEndpoint === 'string'
        ? window.realtimeConfig.communityDmRoomEndpoint.trim()
        : '';

    const getCommunityDmReadEndpoint = () =>
      typeof (window.realtimeConfig || {}).communityDmReadEndpoint === 'string'
        ? window.realtimeConfig.communityDmReadEndpoint.trim()
        : '';

    const getCommunityDmDeliveredEndpoint = () =>
      typeof (window.realtimeConfig || {}).communityDmDeliveredEndpoint === 'string'
        ? window.realtimeConfig.communityDmDeliveredEndpoint.trim()
        : '';

    const getCommunityUnreadStorageKey = (userId = lastUserId) => {
      const safeUserId =
        userId !== undefined && userId !== null ? String(userId).trim() : '';
      return safeUserId ? `${COMMUNITY_CHAT_UNREAD_STORAGE_PREFIX}${safeUserId}` : '';
    };

    const getCommunityTotalUnreadCount = () =>
      communityDmRooms.reduce(
        (total, room) => total + Math.max(0, Number(room && room.unreadCount) || 0),
        0
      );

    const setCommunityPublicUnreadCount = (count, { sync = true } = {}) => {
      communityPublicUnreadCount = Math.max(0, Math.round(Number(count) || 0));
      if (sync) syncCommunityUnreadIndicators();
      return communityPublicUnreadCount;
    };

    const syncCommunityUnreadIndicators = (userId = lastUserId) => {
      if (!isCommunityFeatureEnabled()) {
        updateCommunityNavUnreadUi(0);
        const storageKey = getCommunityUnreadStorageKey(userId);
        try {
          if (storageKey) {
            localStorage.setItem(
              storageKey,
              JSON.stringify({
                count: 0,
                dmUnread: 0,
                publicUnread: 0,
                showTabDot: false
              })
            );
          }
        } catch (err) {
          // no-op
        }
        window.dispatchEvent(
          new CustomEvent('app:chat-unread-change', {
            detail: {
              userId: userId !== undefined && userId !== null ? String(userId) : '',
              count: 0,
              dmUnread: 0,
              publicUnread: 0,
              showTabDot: false
            }
          })
        );
        return 0;
      }
      const dmUnread = getCommunityTotalUnreadCount();
      const publicUnread = Math.max(0, Number(communityPublicUnreadCount) || 0);
      updateCommunityNavUnreadUi(dmUnread);
      const showTabDot =
        (publicUnread > 0 && !isCommunityPublicVisible()) || (dmUnread > 0 && !isCommunityDmVisible());
      const count = dmUnread + publicUnread;
      const storageKey = getCommunityUnreadStorageKey(userId);
      try {
        if (storageKey) {
          localStorage.setItem(
            storageKey,
            JSON.stringify({
              count,
              dmUnread,
              publicUnread,
              showTabDot
            })
          );
        }
      } catch (err) {
        // no-op
      }
      window.dispatchEvent(
        new CustomEvent('app:chat-unread-change', {
          detail: {
            userId: userId !== undefined && userId !== null ? String(userId) : '',
            count,
            dmUnread,
            publicUnread,
            showTabDot
          }
        })
      );
      return count;
    };

    const syncCommunityUnreadStateForCurrentView = () => {
      if (isCommunityPublicVisible()) {
        setCommunityPublicUnreadCount(0);
        return;
      }
      if (isCommunityDmVisible() && activeCommunityDmRoomId) {
        syncVisibleCommunityDmReadState(activeCommunityDmRoomId, { silent: true }).catch(() => {});
        return;
      }
      syncCommunityUnreadIndicators();
    };

    const resetCommunityUnreadIndicators = (userId = lastUserId) => {
      communityPublicUnreadCount = 0;
      communityDmRooms = communityDmRooms.map((room) => (room ? { ...room, unreadCount: 0 } : room));
      return syncCommunityUnreadIndicators(userId);
    };

    const sortCommunityDmRooms = () => {
      communityDmRooms.sort((left, right) => {
        const leftTs = Date.parse((left && left.lastMessageAt) || '');
        const rightTs = Date.parse((right && right.lastMessageAt) || '');
        const safeLeft = Number.isFinite(leftTs) ? leftTs : 0;
        const safeRight = Number.isFinite(rightTs) ? rightTs : 0;
        return safeRight - safeLeft;
      });
    };

    const normalizeCommunityRoom = (value) => {
      if (!value || typeof value !== 'object') return null;
      const roomId = pickFirstText(value.room_id, value.roomId);
      const channel = pickFirstText(value.channel);
      if (!roomId || !channel) return null;
      const participants = Array.isArray(value.participants)
        ? value.participants
            .map((participant) => {
              if (!participant || typeof participant !== 'object') return null;
              const participantId = pickFirstText(participant.id, participant.user_id, participant.userId);
              if (!participantId) return null;
              return {
                id: participantId,
                name: pickFirstText(participant.name, participant.displayName, participant.email),
                avatar: pickFirstText(participant.avatar, participant.image, participant.img),
                premium: participant.premium === true
              };
            })
            .filter(Boolean)
        : [];
      const peerRaw = value.peer && typeof value.peer === 'object' ? value.peer : null;
      const peerId = pickFirstText(
        peerRaw && (peerRaw.id || peerRaw.user_id || peerRaw.userId),
        participants.find((participant) => participant.id !== (lastUserId || ''))?.id
      );
      const peer =
        (peerRaw || participants.find((participant) => participant.id === peerId) || {
          id: peerId,
          name: '',
          avatar: '',
          premium: false
        });
      return {
        roomId,
        channel,
        roomType: 'dm',
        participants,
        peer: {
          id: pickFirstText(peer.id, peer.user_id, peer.userId),
          name: pickFirstText(peer.name, peer.displayName, peer.email),
          avatar: pickFirstText(peer.avatar, peer.image, peer.img),
          premium: peer.premium === true
        },
        lastMessagePreview: pickFirstText(value.last_message_preview, value.lastMessagePreview),
        lastMessageAt: pickFirstText(value.last_message_at, value.lastMessageAt, value.updated_at, value.updatedAt),
        lastMessageActorId: pickFirstText(value.last_message_actor_id, value.lastMessageActorId),
        lastMessageActorName: pickFirstText(value.last_message_actor_name, value.lastMessageActorName),
        unreadCount: Math.max(0, Math.round(Number(value.unread_count || value.unreadCount || 0) || 0))
      };
    };

    const ensureCommunityDmThread = (roomId) => {
      const safeRoomId = pickFirstText(roomId);
      if (!safeRoomId) return [];
      if (!communityDmThreads[safeRoomId]) {
        communityDmThreads[safeRoomId] = [];
      }
      return communityDmThreads[safeRoomId];
    };

    const getCommunityActiveRoom = () =>
      communityDmRooms.find((room) => room && room.roomId === activeCommunityDmRoomId) || null;

    const getCommunityPresenceUser = (userId) => {
      const safeUserId = pickFirstText(userId);
      if (!safeUserId || !Array.isArray(communityPresenceUsers)) return null;
      return (
        communityPresenceUsers.find((entry) => pickFirstText(entry && (entry.user_id || entry.id)) === safeUserId) ||
        null
      );
    };

    const isCommunityUserOnline = (userId) => Boolean(getCommunityPresenceUser(userId));

    const formatCommunityTimestamp = (value) => {
      const raw = pickFirstText(value);
      if (!raw) return '';
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) return '';
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const diffDays = Math.round((todayStart.getTime() - targetStart.getTime()) / 86400000);
      if (diffDays === 0) {
        return new Intl.DateTimeFormat(uiLocale === 'es' ? 'es-ES' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit'
        }).format(date);
      }
      if (diffDays === 1) {
        return uiCopy.communityYesterday || (uiLocale === 'es' ? 'Ayer' : 'Yesterday');
      }
      const currentWeekDay = todayStart.getDay() === 0 ? 7 : todayStart.getDay();
      const weekStart = new Date(todayStart);
      weekStart.setDate(todayStart.getDate() - (currentWeekDay - 1));
      if (targetStart.getTime() >= weekStart.getTime()) {
        return new Intl.DateTimeFormat(uiLocale === 'es' ? 'es-ES' : 'en-US', {
          weekday: 'short'
        }).format(date);
      }
      const dd = String(date.getDate()).padStart(2, '0');
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const yy = String(date.getFullYear()).slice(-2);
      return `${dd}/${mm}/${yy}`;
    };

    const formatCommunityBubbleTime = (value) => {
      const raw = pickFirstText(value);
      if (!raw) return '';
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) return '';
      const now = new Date();
      const isSameDay =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();
      if (isSameDay) {
        return new Intl.DateTimeFormat(uiLocale === 'es' ? 'es-ES' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit'
        }).format(date);
      }
      return formatCommunityTimestamp(raw);
    };

    const getCommunityPeerLabel = (room) => {
      const peerName = pickFirstText(room && room.peer && room.peer.name);
      if (peerName) return peerName;
      const peerId = pickFirstText(room && room.peer && room.peer.id);
      return peerId || uiCopy.communityNoPeerName;
    };

    const getCommunityPeerStatusLabel = (peer, fallbackText = '') => {
      const safePeer = peer && typeof peer === 'object' ? peer : {};
      if (isCommunityUserOnline(safePeer.id)) {
        return uiCopy.communityOnlineNow;
      }
      return fallbackText || '';
    };

    const getCommunityRoomPreview = (room) => {
      const safeRoom = room && typeof room === 'object' ? room : {};
      const preview = pickFirstText(safeRoom.lastMessagePreview);
      if (preview) return preview;
      return uiCopy.communityStartChat;
    };

    const buildCommunityStatusDot = ({ online = false } = {}) => {
      const dotEl = document.createElement('span');
      dotEl.className = 'chat-community-status-dot';
      dotEl.classList.add(online ? 'is-online' : 'is-offline');
      dotEl.setAttribute('aria-hidden', 'true');
      return dotEl;
    };

    const buildCommunityAvatar = (entry, options = {}) => {
      const safeEntry = entry && typeof entry === 'object' ? entry : {};
      const rootEl = document.createElement('span');
      rootEl.className = 'chat-community-avatar';
      if (options.large) rootEl.classList.add('is-large');
      const avatarUrl = pickFirstText(safeEntry.avatar);
      const name = pickFirstText(safeEntry.name, safeEntry.id, uiCopy.communityNoPeerName);
      if (avatarUrl) {
        const imgEl = document.createElement('img');
        imgEl.src = avatarUrl;
        imgEl.alt = '';
        rootEl.appendChild(imgEl);
      } else {
        const initialsEl = document.createElement('span');
        initialsEl.className = 'chat-community-avatar-fallback';
        const initials = name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part.charAt(0).toUpperCase())
          .join('');
        initialsEl.textContent = initials || '?';
        rootEl.appendChild(initialsEl);
      }
      return rootEl;
    };

    const getCommunityDmIntro = () => {
      const activeRoom = getCommunityActiveRoom();
      if (!activeRoom) return uiCopy.introCommunityDm || uiCopy.communitySelectChat;
      return uiCopy.communityDmBadge
        ? `${uiCopy.communityDmBadge}: ${getCommunityPeerLabel(activeRoom)}`
        : getCommunityPeerLabel(activeRoom);
    };

    const resolvePresenceCount = (channel, payload) => {
      if (
        payload &&
        payload.presence &&
        typeof payload.presence.count === 'number' &&
        Number.isFinite(payload.presence.count)
      ) {
        return Math.max(0, Math.round(payload.presence.count));
      }
      if (payload && typeof payload.user_count === 'number' && Number.isFinite(payload.user_count)) {
        return Math.max(0, Math.round(payload.user_count));
      }
      if (
        payload &&
        typeof payload.subscription_count === 'number' &&
        Number.isFinite(payload.subscription_count)
      ) {
        return Math.max(0, Math.round(payload.subscription_count));
      }
      if (payload && typeof payload.count === 'number' && Number.isFinite(payload.count)) {
        return Math.max(0, Math.round(payload.count));
      }
      if (channel && channel.members) {
        if (typeof channel.members.count === 'number' && Number.isFinite(channel.members.count)) {
          return Math.max(0, Math.round(channel.members.count));
        }
        if (channel.members.members && typeof channel.members.members === 'object') {
          return Object.keys(channel.members.members).length;
        }
      }
      return 0;
    };

    const isChatbotRealtimeAvailable = () => {
      if (chatMode !== 'chatbot') return true;
      return realtimeConnected;
    };

    const presentSystemToast = (message) => {
      const text = String(message || '').trim();
      if (!text) return;
      try {
        const toast = document.createElement('ion-toast');
        toast.message = text;
        toast.duration = 2600;
        toast.position = 'top';
        document.body.appendChild(toast);
        toast.present().catch(() => {});
        toast.addEventListener(
          'didDismiss',
          () => {
            toast.remove();
          },
          { once: true }
        );
      } catch (_err) {
        // no-op
      }
    };

    const handleChatbotServerUnavailable = () => {
      cancelSimulatedReply('chatbot');
      awaitingBot.chatbot = false;
      setTypingState('chatbot', false);
      setHint(defaultHint || uiCopy.hintDefault);
      presentSystemToast(
        uiCopy.serverUnavailable || 'Chat server unavailable. Please try again later.'
      );
    };

    const handleChatbotRealtimeDisconnected = ({ notify = false } = {}) => {
      cancelSimulatedReply('chatbot');
      awaitingBot.chatbot = false;
      setTypingState('chatbot', false);
      applyControlsEnabled();
      updateDraftButtons();
      setHint(
        uiCopy.realtimeDisconnected || uiCopy.serverUnavailable || 'Connection lost. Reconnecting...'
      );
      if (notify) {
        presentSystemToast(
          uiCopy.realtimeDisconnectedToast ||
            uiCopy.serverUnavailable ||
          'Chat server unavailable. Please try again later.'
        );
      }
    };

    const handleCommunityRealtimeDisconnected = ({ notify = false } = {}) => {
      setHint(uiCopy.communityRealtimeDisconnected || uiCopy.realtimeDisconnected || uiCopy.serverUnavailable);
      if (notify) {
        presentSystemToast(
          uiCopy.communityRealtimeDisconnected ||
            uiCopy.realtimeDisconnectedToast ||
            uiCopy.serverUnavailable
        );
      }
    };

    const handleCommunityAccessDenied = ({ notify = true } = {}) => {
      communityRoomsLoaded = false;
      communityRoomsLoading = false;
      communityHistoryLoading = false;
      activeCommunityDmRoomId = '';
      disconnectRealtime();
      updateCommunityViewUi();
      renderCommunityLists();
      setHint(uiCopy.communityRoomsError || uiCopy.communityHistoryError || uiCopy.serverUnavailable);
      if (notify) {
        presentSystemToast(uiCopy.communityRoomsError || uiCopy.serverUnavailable);
      }
    };

    const getCommunityPresenceContextPayload = () => {
      const activeTab = pickFirstText(currentAppTab).toLowerCase();
      const appState =
        typeof document !== 'undefined' && document.hidden ? 'background' : 'foreground';
      const inChatTab = activeTab === 'chat';
      const activeChatMode = inChatTab ? chatMode : '';
      const activeCommunityView =
        inChatTab && activeChatMode === 'community' ? communityView : '';
      const activeRoomType =
        activeCommunityView === 'dm' && activeCommunityDmRoomId
          ? 'dm'
          : activeCommunityView === 'public'
            ? 'public'
            : '';
      const activeRoomId =
        activeRoomType === 'dm'
          ? activeCommunityDmRoomId
          : activeRoomType === 'public'
            ? COMMUNITY_PUBLIC_CHANNEL
            : '';
      return {
        app_state: appState,
        tab: activeTab,
        chat_mode: activeChatMode,
        community_view: activeCommunityView,
        active_room_type: activeRoomType,
        active_room_id: activeRoomId
      };
    };

    const getClientUuid = () => {
      try {
        return pickFirstText(window.uuid, window.localStorage && window.localStorage.getItem('uuid'));
      } catch (err) {
        return pickFirstText(window.uuid);
      }
    };

    const getClientPlatform = () => {
      try {
        const cap = window.Capacitor;
        if (cap && typeof cap.getPlatform === 'function') {
          return pickFirstText(cap.getPlatform()).toLowerCase();
        }
      } catch (err) {
        // no-op
      }
      return '';
    };

    const getCommunityPublicMessagesEndpoint = () => {
      const config = getRealtimeConfig();
      return typeof config.communityPublicMessagesEndpoint === 'string'
        ? config.communityPublicMessagesEndpoint.trim()
        : '';
    };

    const getCommunityPublicPresenceEndpoint = () => {
      const config = getRealtimeConfig();
      return typeof config.communityPublicPresenceEndpoint === 'string'
        ? config.communityPublicPresenceEndpoint.trim()
        : '';
    };

    const clearCommunityPresenceHeartbeat = () => {
      if (!communityPresenceHeartbeatTimer) return;
      clearTimeout(communityPresenceHeartbeatTimer);
      communityPresenceHeartbeatTimer = null;
    };

    const getCommunityPresenceThrottleSignature = (payload) => {
      if (!payload || typeof payload !== 'object') return '';
      return JSON.stringify({
        action: pickFirstText(payload.action),
        roomId: pickFirstText(payload.room_id, payload.roomId),
        sessionId: pickFirstText(payload.session_id, payload.sessionId),
        userId: pickFirstText(payload.user_id, payload.userId),
        uuid: pickFirstText(payload.uuid),
        appState: pickFirstText(payload.app_state),
        tab: pickFirstText(payload.tab),
        chatMode: pickFirstText(payload.chat_mode),
        communityView: pickFirstText(payload.community_view),
        activeRoomType: pickFirstText(payload.active_room_type),
        activeRoomId: pickFirstText(payload.active_room_id)
      });
    };

    const sendCommunityPresence = async ({
      action = 'heartbeat',
      keepalive = false,
      silent = false,
      contextOverride = null,
      throttleMs = 0
    } = {}) => {
      const endpoint = getCommunityPublicPresenceEndpoint();
      const user = window.user;
      const userId = user && user.id !== undefined && user.id !== null ? String(user.id).trim() : '';
      if (!endpoint || !userId || !isChatEnabledUser(user)) return false;
      const payload = {
        action,
        room_id: COMMUNITY_PUBLIC_CHANNEL,
        session_id: getCommunityPresenceSessionId(),
        uuid: getClientUuid(),
        platform: getClientPlatform(),
        user_id: userId,
        user_name: getUserDisplayName(user),
        email: user && user.email ? user.email : '',
        avatar: getUserPublicAvatar(user),
        app: 'speakapp',
        premium: isChatEnabledUser(user)
      };
      Object.assign(
        payload,
        getCommunityPresenceContextPayload(),
        contextOverride && typeof contextOverride === 'object' ? contextOverride : {}
      );
      const effectiveThrottleMs =
        action === 'heartbeat' && !keepalive
          ? Math.max(0, Math.floor(Number(throttleMs) || 0))
          : 0;
      if (effectiveThrottleMs > 0) {
        const signature = getCommunityPresenceThrottleSignature(payload);
        const now = Date.now();
        const elapsed = communityPresenceLastHeartbeatAt > 0 ? now - communityPresenceLastHeartbeatAt : Infinity;
        if (
          signature &&
          signature === communityPresenceLastHeartbeatSignature &&
          elapsed >= 0 &&
          elapsed < effectiveThrottleMs
        ) {
          return {
            ok: true,
            sent: false,
            throttled: true,
            retryAfterMs: Math.max(0, effectiveThrottleMs - elapsed)
          };
        }
      }
      const realtimeStateToken = getRealtimeStateToken();
      if (realtimeStateToken) {
        payload.rt_token = realtimeStateToken;
      }
      try {
        if (
          keepalive &&
          typeof navigator !== 'undefined' &&
          typeof navigator.sendBeacon === 'function'
        ) {
          const body = new Blob([JSON.stringify(payload)], { type: 'application/json' });
          const queued = navigator.sendBeacon(endpoint, body);
          if (!queued) {
            throw new Error(`community_presence_${action}_beacon_failed`);
          }
          if (action === 'heartbeat') {
            communityPresenceLastHeartbeatAt = Date.now();
            communityPresenceLastHeartbeatSignature = getCommunityPresenceThrottleSignature(payload);
          }
          return { ok: true, sent: true, throttled: false };
        }
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: buildRealtimeStateHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
          body: JSON.stringify(payload),
          keepalive
        });
        if (!response.ok) {
          if (response.status === 403) {
            handleCommunityAccessDenied({ notify: false });
          }
          throw new Error(`community_presence_${action}_${response.status}`);
        }
        const data = await response.json();
        communityPresenceCount = resolvePresenceCount(null, data);
        communityPresenceUsers = Array.isArray(data && data.users) ? data.users : [];
        updateCommunityPresenceUi();
        renderCommunityLists();
        if (action === 'heartbeat') {
          communityPresenceLastHeartbeatAt = Date.now();
          communityPresenceLastHeartbeatSignature = getCommunityPresenceThrottleSignature(payload);
        }
        return { ok: true, sent: true, throttled: false };
      } catch (err) {
        if (!silent) {
          console.warn('[chat] community presence send error', action, err);
        }
        return { ok: false, sent: false, throttled: false };
      }
    };

    const scheduleCommunityPresenceHeartbeat = ({ immediate = false } = {}) => {
      const currentUser = window.user;
      const currentUserId =
        currentUser && currentUser.id !== undefined && currentUser.id !== null
          ? String(currentUser.id).trim()
          : '';
      clearCommunityPresenceHeartbeat();
      if (chatMode !== 'community' || !isChatEnabledUser(currentUser) || !currentUserId) return;
      const run = async () => {
        communityPresenceHeartbeatTimer = null;
        const result = await sendCommunityPresence({
          action: 'heartbeat',
          silent: true,
          throttleMs: immediate ? COMMUNITY_PRESENCE_IMMEDIATE_THROTTLE_MS : 0
        });
        const nextDelay =
          result && result.throttled
            ? Math.max(1000, Math.min(COMMUNITY_PRESENCE_HEARTBEAT_MS, Number(result.retryAfterMs) || 0))
            : COMMUNITY_PRESENCE_HEARTBEAT_MS;
        communityPresenceHeartbeatTimer = setTimeout(run, nextDelay);
      };
      if (immediate) {
        run();
        return;
      }
      communityPresenceHeartbeatTimer = setTimeout(run, COMMUNITY_PRESENCE_HEARTBEAT_MS);
    };

    const leaveCommunityPresence = ({ keepalive = false, silent = true } = {}) => {
      const endpoint = getCommunityPublicPresenceEndpoint();
      if (!endpoint || !communityPresenceSessionId || !lastUserId) return;
      const payload = {
        action: 'leave',
        room_id: COMMUNITY_PUBLIC_CHANNEL,
        session_id: communityPresenceSessionId,
        uuid: getClientUuid(),
        platform: getClientPlatform(),
        user_id: lastUserId,
        app: 'speakapp'
      };
      const realtimeStateToken = getRealtimeStateToken();
      if (realtimeStateToken) {
        payload.rt_token = realtimeStateToken;
      }
      if (keepalive && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        try {
          const body = new Blob([JSON.stringify(payload)], { type: 'application/json' });
          navigator.sendBeacon(endpoint, body);
          return;
        } catch (err) {
          // no-op
        }
      }
      sendCommunityPresence({ action: 'leave', keepalive, silent }).catch(() => {});
    };

    const loadCommunityHistory = async ({ force = false } = {}) => {
      if (chatMode !== 'community' && !force) return false;
      const endpoint = getCommunityPublicMessagesEndpoint();
      const currentUserId = pickFirstText(lastUserId);
      if (!endpoint) return false;
      if (communityHistoryLoading) return false;
      communityHistoryLoading = true;
      if (chatMode === 'community') {
        setHint(uiCopy.communityHistoryLoading || uiCopy.loadingUser);
      }
      try {
        const url = new URL(endpoint, window.location.origin);
        if (currentUserId) {
          url.searchParams.set('user_id', currentUserId);
        }
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            Accept: 'application/json'
          }
        });
        if (!response.ok) {
          if (response.status === 403) {
            handleCommunityAccessDenied();
          }
          throw new Error(`community_history_${response.status}`);
        }
        const data = await response.json();
        const messages = Array.isArray(data && data.messages)
          ? data.messages
              .map((item) => normalizeIncoming(item, 'bot', { mode: 'community', viewerId: lastUserId || '' }))
              .filter(Boolean)
          : [];
        replaceThreadMessages('community', messages, { rerender: communityView === 'public', scope: 'public' });
        if (isCommunityPublicVisible()) {
          setCommunityPublicUnreadCount(0);
        }
        if (!messages.length) {
          if (communityView === 'public') {
            ensureIntroMessage('community');
          }
        }
        if (chatMode === 'community') {
          setHint(getDefaultHintForMode('community'));
        }
        return true;
      } catch (err) {
        console.warn('[chat] community history error', err);
        if (!getThread('community', { scope: 'public' }).length && communityView === 'public') {
          ensureIntroMessage('community');
        }
        if (chatMode === 'community') {
          setHint(uiCopy.communityHistoryError || uiCopy.serverUnavailable);
        }
        return false;
      } finally {
        communityHistoryLoading = false;
      }
    };

    const emitCommunityMessage = async ({ text }) => {
      const endpoint = getCommunityPublicMessagesEndpoint();
      const user = window.user;
      const userId = user && user.id !== undefined && user.id !== null ? String(user.id).trim() : '';
      if (!endpoint || !userId) return { ok: false };
      const payload = {
        text,
        uuid: getClientUuid(),
        platform: getClientPlatform(),
        user_id: userId,
        user_name: getUserDisplayName(user),
        email: user && user.email ? user.email : '',
        avatar: getUserPublicAvatar(user),
        app: 'speakapp',
        premium: isChatEnabledUser(user)
      };
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          return { ok: false, status: response.status };
        }
        return response.json();
      } catch (err) {
        console.warn('[chat] community send error', err);
        return { ok: false, error: err && err.message ? err.message : 'community_send_failed' };
      }
    };

    const upsertCommunityRoom = (value) => {
      const room = normalizeCommunityRoom(value);
      if (!room) return null;
      const hasExplicitUnread =
        value &&
        typeof value === 'object' &&
        (Object.prototype.hasOwnProperty.call(value, 'unread_count') ||
          Object.prototype.hasOwnProperty.call(value, 'unreadCount'));
      const hasExplicitPreview =
        value &&
        typeof value === 'object' &&
        (Object.prototype.hasOwnProperty.call(value, 'last_message_preview') ||
          Object.prototype.hasOwnProperty.call(value, 'lastMessagePreview'));
      const hasExplicitLastMessageAt =
        value &&
        typeof value === 'object' &&
        (Object.prototype.hasOwnProperty.call(value, 'last_message_at') ||
          Object.prototype.hasOwnProperty.call(value, 'lastMessageAt') ||
          Object.prototype.hasOwnProperty.call(value, 'updated_at') ||
          Object.prototype.hasOwnProperty.call(value, 'updatedAt'));
      const hasExplicitLastMessageActorId =
        value &&
        typeof value === 'object' &&
        (Object.prototype.hasOwnProperty.call(value, 'last_message_actor_id') ||
          Object.prototype.hasOwnProperty.call(value, 'lastMessageActorId'));
      const hasExplicitLastMessageActorName =
        value &&
        typeof value === 'object' &&
        (Object.prototype.hasOwnProperty.call(value, 'last_message_actor_name') ||
          Object.prototype.hasOwnProperty.call(value, 'lastMessageActorName'));
      const index = communityDmRooms.findIndex((entry) => entry && entry.roomId === room.roomId);
      if (index >= 0) {
        const existingRoom = communityDmRooms[index];
        communityDmRooms[index] = {
          ...existingRoom,
          ...room,
          lastMessagePreview: hasExplicitPreview ? room.lastMessagePreview : existingRoom.lastMessagePreview,
          lastMessageAt: hasExplicitLastMessageAt ? room.lastMessageAt : existingRoom.lastMessageAt,
          lastMessageActorId: hasExplicitLastMessageActorId
            ? room.lastMessageActorId
            : existingRoom.lastMessageActorId,
          lastMessageActorName: hasExplicitLastMessageActorName
            ? room.lastMessageActorName
            : existingRoom.lastMessageActorName,
          unreadCount: hasExplicitUnread ? room.unreadCount : existingRoom.unreadCount,
          peer: {
            ...(existingRoom.peer || {}),
            ...(room.peer || {})
          }
        };
      } else {
        communityDmRooms.push(room);
      }
      sortCommunityDmRooms();
      syncCommunityUnreadIndicators();
      return room;
    };

    const setCommunityRoomUnreadCount = (roomId, unreadCount) => {
      const safeRoomId = pickFirstText(roomId);
      if (!safeRoomId) return null;
      const index = communityDmRooms.findIndex((entry) => entry && entry.roomId === safeRoomId);
      if (index < 0) return null;
      communityDmRooms[index] = {
        ...communityDmRooms[index],
        unreadCount: Math.max(0, Math.round(Number(unreadCount) || 0))
      };
      syncCommunityUnreadIndicators();
      return communityDmRooms[index];
    };

    const getCommunityDmLatestMessage = (roomId) => {
      const safeRoomId = pickFirstText(roomId);
      if (!safeRoomId) return null;
      const thread = ensureCommunityDmThread(safeRoomId);
      for (let index = thread.length - 1; index >= 0; index -= 1) {
        const message = thread[index];
        if (!message || !message.id || !normalizeChatText(message.text) || !pickFirstText(message.actorId)) continue;
        return message;
      }
      return null;
    };

    const isVisibleCommunityDmRoom = (roomId) =>
      currentAppTab === 'chat' &&
      chatMode === 'community' &&
      communityView === 'dm' &&
      pickFirstText(activeCommunityDmRoomId) === pickFirstText(roomId);

    const openCommunityDmRoom = async (roomId, options = {}) => {
      const safeRoomId = pickFirstText(roomId);
      if (!safeRoomId) return false;
      activeCommunityDmRoomId = safeRoomId;
      refreshCommunityPresenceNow({ silent: true });
      updateCommunityViewUi();
      updateTextRowVisibility();
      await loadCommunityDmHistory(safeRoomId, {
        force: options.forceHistory === true
      });
      renderThread('community');
      setHint(getDefaultHintForMode('community'));
      applyControlsEnabled();
      updateDraftButtons();
      return true;
    };

    const closeCommunityDmRoom = () => {
      activeCommunityDmRoomId = '';
      updateCommunityViewUi();
      updateTextRowVisibility();
      renderThread('community');
      setHint(getDefaultHintForMode('community'));
      applyControlsEnabled();
      updateDraftButtons();
    };

    const markCommunityDmRoomRead = async (roomId, options = {}) => {
      const safeRoomId = pickFirstText(roomId);
      const currentUserId = pickFirstText(lastUserId);
      const endpoint = getCommunityDmReadEndpoint();
      if (!safeRoomId || !currentUserId || !endpoint) return false;
      const latestMessage = options.message || getCommunityDmLatestMessage(safeRoomId);
      const latestMessageId = pickFirstText(options.messageId, latestMessage && latestMessage.id);
      const previousRoom = communityDmRooms.find((room) => room && room.roomId === safeRoomId) || null;
      const previousUnread = previousRoom ? Math.max(0, Number(previousRoom.unreadCount) || 0) : 0;
      setCommunityRoomUnreadCount(safeRoomId, 0);
      renderCommunityLists();

      const pending = communityDmReadRequests.get(safeRoomId) || Promise.resolve();
      const nextRequest = pending
        .catch(() => {})
        .then(async () => {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json'
            },
            body: JSON.stringify({
              room_id: safeRoomId,
              user_id: currentUserId,
              message_id: latestMessageId
            })
          });
          if (!response.ok) {
            throw new Error(`community_dm_read_${response.status}`);
          }
          const data = await response.json();
          if (!data || data.ok !== true) {
            throw new Error('community_dm_read_invalid');
          }
          if (data.room) {
            upsertCommunityRoom(data.room);
          } else {
            setCommunityRoomUnreadCount(safeRoomId, 0);
          }
          renderCommunityLists();
          return true;
        })
        .catch((err) => {
          setCommunityRoomUnreadCount(safeRoomId, previousUnread);
          renderCommunityLists();
          if (!options.silent) {
            console.warn('[chat] community dm read error', err);
          }
          return false;
        })
        .finally(() => {
          if (communityDmReadRequests.get(safeRoomId) === nextRequest) {
            communityDmReadRequests.delete(safeRoomId);
          }
        });
      communityDmReadRequests.set(safeRoomId, nextRequest);
      return nextRequest;
    };

    const syncVisibleCommunityDmReadState = (roomId, options = {}) => {
      const safeRoomId = pickFirstText(roomId);
      if (!safeRoomId || !isVisibleCommunityDmRoom(safeRoomId)) return Promise.resolve(false);
      const latestMessage = options.message || getCommunityDmLatestMessage(safeRoomId);
      if (!latestMessage) {
        setCommunityRoomUnreadCount(safeRoomId, 0);
        renderCommunityLists();
        return Promise.resolve(true);
      }
      return markCommunityDmRoomRead(safeRoomId, {
        messageId: latestMessage.id,
        message: latestMessage,
        silent: options.silent !== false
      });
    };

    const buildCommunityDeliveredAckKey = (roomId, messageId) =>
      `${pickFirstText(roomId)}::${pickFirstText(messageId)}`;

    const markCommunityDmMessageDelivered = async (roomId, message, options = {}) => {
      const safeRoomId = pickFirstText(roomId);
      const currentUserId = pickFirstText(lastUserId);
      const endpoint = getCommunityDmDeliveredEndpoint();
      const safeMessage = message && typeof message === 'object' ? message : {};
      const messageId = pickFirstText(options.messageId, safeMessage.id);
      const actorId = pickFirstText(safeMessage.actorId, safeMessage.actor_id);
      const deliveredAt = pickFirstText(safeMessage.deliveredAt, safeMessage.delivered_at);
      if (!safeRoomId || !currentUserId || !endpoint || !messageId) return false;
      if (!actorId || actorId === currentUserId || deliveredAt) return false;
      const ackKey = buildCommunityDeliveredAckKey(safeRoomId, messageId);
      if (communityDmDeliveredAcks.has(ackKey)) return true;
      communityDmDeliveredAcks.add(ackKey);
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({
            room_id: safeRoomId,
            user_id: currentUserId,
            message_id: messageId,
            uuid: getClientUuid(),
            platform: getClientPlatform()
          })
        });
        if (!response.ok) {
          throw new Error(`community_dm_delivered_${response.status}`);
        }
        const data = await response.json();
        if (!data || data.ok !== true) {
          throw new Error('community_dm_delivered_invalid');
        }
        if (data.message) {
          updateThreadMessage(
            'community',
            pickFirstText(data.message.id, messageId),
            (current) => ({
              ...current,
              deliveredAt:
                pickFirstText(data.message.delivered_at, data.message.deliveredAt) || current.deliveredAt,
              deliveredUserId:
                pickFirstText(data.message.delivered_user_id, data.message.deliveredUserId) ||
                current.deliveredUserId,
              deliveredUuid:
                pickFirstText(data.message.delivered_uuid, data.message.deliveredUuid) || current.deliveredUuid,
              sendState: current.sendState === 'failed' ? current.sendState : 'sent',
              failed: false
            }),
            { scope: 'dm', roomId: safeRoomId, rerender: true }
          );
        }
        return true;
      } catch (err) {
        communityDmDeliveredAcks.delete(ackKey);
        if (!options.silent) {
          console.warn('[chat] community dm delivered error', err);
        }
        return false;
      }
    };

    const updateCommunityDmHeader = () => {
      if (!communityDmHeaderEl || !communityDmAvatarEl || !communityDmNameEl || !communityDmStatusEl) return;
      const isCommunityDmThread =
        chatMode === 'community' && communityView === 'dm' && Boolean(activeCommunityDmRoomId);
      communityDmHeaderEl.hidden = !isCommunityDmThread;
      if (!isCommunityDmThread) return;
      const room = getCommunityActiveRoom();
      const peer = room && room.peer ? room.peer : null;
      communityDmAvatarEl.innerHTML = '';
      communityDmAvatarEl.appendChild(buildCommunityAvatar(peer, { large: true }));
      communityDmNameEl.textContent = '';
      communityDmNameEl.appendChild(
        buildCommunityStatusDot({
          online: Boolean(peer && isCommunityUserOnline(peer.id))
        })
      );
      const nameTextEl = document.createElement('span');
      nameTextEl.textContent = room ? getCommunityPeerLabel(room) : uiCopy.communityNoPeerName;
      communityDmNameEl.appendChild(nameTextEl);
      communityDmStatusEl.textContent = getCommunityPeerStatusLabel(peer);
    };

    const renderCommunityLists = () => {
      if (!communityListsEl || !communityRoomListEl || !communityPeerListEl) return;
      const isCommunityDmList =
        chatMode === 'community' && communityView === 'dm' && !activeCommunityDmRoomId;
      communityListsEl.hidden = !isCommunityDmList;
      updateCommunityDmHeader();
      if (!isCommunityDmList) return;

      if (communityRoomsTitleEl) communityRoomsTitleEl.textContent = uiCopy.communityChatsTitle;
      if (communityOnlineTitleEl) communityOnlineTitleEl.textContent = uiCopy.communityOnlineUsersTitle;

      communityRoomListEl.innerHTML = '';
      if (communityRoomsLoading && !communityDmRooms.length) {
        const loadingEl = document.createElement('div');
        loadingEl.className = 'chat-community-empty';
        loadingEl.textContent = uiCopy.communityRoomsLoading || uiCopy.loadingUser;
        communityRoomListEl.appendChild(loadingEl);
      } else if (!communityDmRooms.length) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'chat-community-empty';
        emptyEl.textContent = uiCopy.communityNoChats;
        communityRoomListEl.appendChild(emptyEl);
      } else {
        communityDmRooms.forEach((room) => {
          const itemEl = document.createElement('button');
          itemEl.type = 'button';
          itemEl.className = 'chat-community-item';
          const peerLabel = getCommunityPeerLabel(room);
          const peer = room && room.peer ? room.peer : {};
          const online = isCommunityUserOnline(peer.id);
          const mainEl = document.createElement('span');
          mainEl.className = 'chat-community-item-main';
          const headingEl = document.createElement('span');
          headingEl.className = 'chat-community-item-heading';
          const titleEl = document.createElement('span');
          titleEl.className = 'chat-community-item-title';
          titleEl.textContent = peerLabel;
          const subtitleEl = document.createElement('span');
          subtitleEl.className = 'chat-community-item-subtitle';
          subtitleEl.textContent = getCommunityRoomPreview(room);
          const sideEl = document.createElement('span');
          sideEl.className = 'chat-community-item-side';
          const timeEl = document.createElement('span');
          timeEl.className = 'chat-community-item-time';
          timeEl.textContent = formatCommunityTimestamp(room.lastMessageAt);
          const trailingEl = document.createElement('span');
          trailingEl.className = 'chat-community-item-trailing';
          const chevronEl = document.createElement('ion-icon');
          chevronEl.className = 'chat-community-item-chevron';
          chevronEl.setAttribute('name', 'chevron-forward');
          itemEl.appendChild(
            buildCommunityAvatar(peer, {
              online: false
            })
          );
          headingEl.appendChild(buildCommunityStatusDot({ online }));
          headingEl.appendChild(titleEl);
          mainEl.appendChild(headingEl);
          mainEl.appendChild(subtitleEl);
          itemEl.appendChild(mainEl);
          if (room.unreadCount > 0) {
            const badgeEl = document.createElement('span');
            badgeEl.className = 'chat-community-item-badge';
            badgeEl.textContent = room.unreadCount > 99 ? '99+' : String(room.unreadCount);
            trailingEl.appendChild(badgeEl);
          }
          trailingEl.appendChild(chevronEl);
          sideEl.appendChild(timeEl);
          sideEl.appendChild(trailingEl);
          itemEl.appendChild(sideEl);
          itemEl.addEventListener('click', () => {
            openCommunityDmRoom(room.roomId, { forceHistory: true });
          });
          communityRoomListEl.appendChild(itemEl);
        });
      }

      const peers = Array.isArray(getCommunityPresenceUsersForDm())
        ? getCommunityPresenceUsersForDm()
        : [];
      communityPeerListEl.innerHTML = '';
      if (!peers.length) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'chat-community-empty';
        emptyEl.textContent = uiCopy.communityNoOnlineUsers;
        communityPeerListEl.appendChild(emptyEl);
      } else {
        peers.forEach((peer) => {
          const itemEl = document.createElement('button');
          itemEl.type = 'button';
          itemEl.className = 'chat-community-item';
          const label = pickFirstText(peer.name, peer.id) || uiCopy.communityNoPeerName;
          const mainEl = document.createElement('span');
          mainEl.className = 'chat-community-item-main';
          const headingEl = document.createElement('span');
          headingEl.className = 'chat-community-item-heading';
          const titleEl = document.createElement('span');
          titleEl.className = 'chat-community-item-title';
          titleEl.textContent = label;
          const subtitleEl = document.createElement('span');
          subtitleEl.className = 'chat-community-item-subtitle';
          subtitleEl.textContent = uiCopy.communityStartChat;
          itemEl.appendChild(
            buildCommunityAvatar(peer, {
              online: false
            })
          );
          headingEl.appendChild(buildCommunityStatusDot({ online: true }));
          headingEl.appendChild(titleEl);
          mainEl.appendChild(headingEl);
          mainEl.appendChild(subtitleEl);
          itemEl.appendChild(mainEl);
          itemEl.addEventListener('click', () => {
            ensureCommunityDmRoomOpen(peer).then((room) => {
              if (!room) return;
              openCommunityDmRoom(room.roomId, { forceHistory: false });
            });
          });
          communityPeerListEl.appendChild(itemEl);
        });
      }
    };

    const getCommunityPresenceUsersForDm = () => {
      const currentUserId = pickFirstText(lastUserId);
      const existingRoomPeerIds = new Set(
        communityDmRooms
          .map((room) => pickFirstText(room && room.peer && room.peer.id))
          .filter(Boolean)
      );
      const seen = new Set();
      const peers = [];
      if (Array.isArray(communityPresenceUsers)) {
        communityPresenceUsers.forEach((peer) => {
          const peerId = pickFirstText(peer && peer.user_id, peer && peer.id);
          if (
            !peerId ||
            peerId === currentUserId ||
            seen.has(peerId) ||
            existingRoomPeerIds.has(peerId)
          ) {
            return;
          }
          seen.add(peerId);
          peers.push({
            id: peerId,
            name: pickFirstText(peer && peer.name),
            avatar: pickFirstText(peer && peer.avatar),
            premium: peer && peer.premium === true
          });
        });
      }
      return peers;
    };

    const loadCommunityDmRooms = async ({ force = false } = {}) => {
      const endpoint = getCommunityRoomsEndpoint();
      const currentUserId = pickFirstText(lastUserId);
      if (!endpoint || !currentUserId) return false;
      if (communityRoomsLoading) return false;
      if (communityRoomsLoaded && !force) return true;
      communityRoomsLoading = true;
      if (communityView === 'dm') {
        setHint(uiCopy.communityRoomsLoading || uiCopy.loadingUser);
      }
      try {
        const url = new URL(endpoint, window.location.origin);
        url.searchParams.set('scope', 'dm');
        url.searchParams.set('user_id', currentUserId);
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: { Accept: 'application/json' }
        });
        if (!response.ok) {
          if (response.status === 403) {
            handleCommunityAccessDenied();
          }
          throw new Error(`community_rooms_${response.status}`);
        }
        const data = await response.json();
        communityDmRooms = Array.isArray(data && data.rooms)
          ? data.rooms.map(normalizeCommunityRoom).filter(Boolean)
          : [];
        sortCommunityDmRooms();
        syncCommunityUnreadIndicators(currentUserId);
        communityRoomsLoaded = true;
        if (
          activeCommunityDmRoomId &&
          !communityDmRooms.some((room) => room && room.roomId === activeCommunityDmRoomId)
        ) {
          activeCommunityDmRoomId = '';
        }
        if (pusherClient && chatMode === 'community') {
          syncCommunityDmSubscriptions();
        }
        updateCommunityViewUi();
        if (communityView === 'dm' && activeCommunityDmRoomId) {
          loadCommunityDmHistory(activeCommunityDmRoomId, { force: false });
        }
        if (communityView === 'dm') {
          setHint(getDefaultHintForMode('community'));
        }
        return true;
      } catch (err) {
        console.warn('[chat] community dm rooms error', err);
        renderCommunityLists();
        if (communityView === 'dm') {
          setHint(uiCopy.communityRoomsError || uiCopy.serverUnavailable);
        }
        return false;
      } finally {
        communityRoomsLoading = false;
      }
    };

    const loadCommunityDmHistory = async (roomId, { force = false } = {}) => {
      const safeRoomId = pickFirstText(roomId, activeCommunityDmRoomId);
      const currentUserId = pickFirstText(lastUserId);
      if (!safeRoomId) return false;
      const endpoint = getCommunityMessagesEndpoint();
      if (!endpoint || !currentUserId) return false;
      const thread = ensureCommunityDmThread(safeRoomId);
      if (thread.length && !force) {
        await syncVisibleCommunityDmReadState(safeRoomId, { silent: true });
        return true;
      }
      try {
        const url = new URL(endpoint, window.location.origin);
        url.searchParams.set('room_type', 'dm');
        url.searchParams.set('room_id', safeRoomId);
        url.searchParams.set('user_id', currentUserId);
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: { Accept: 'application/json' }
        });
        if (!response.ok) {
          if (response.status === 403) {
            handleCommunityAccessDenied();
          }
          throw new Error(`community_dm_history_${response.status}`);
        }
        const data = await response.json();
        const messages = Array.isArray(data && data.messages)
          ? data.messages
              .map((item) => normalizeIncoming(item, 'bot', { mode: 'community', viewerId: lastUserId || '' }))
              .filter(Boolean)
          : [];
        replaceThreadMessages('community', messages, {
          rerender: communityView === 'dm' && safeRoomId === activeCommunityDmRoomId,
          scope: 'dm',
          roomId: safeRoomId
        });
        const latestIncomingMessage =
          [...messages]
            .reverse()
            .find((item) => item && item.role !== 'user' && pickFirstText(item.id)) || null;
        if (latestIncomingMessage) {
          markCommunityDmMessageDelivered(safeRoomId, latestIncomingMessage, { silent: true }).catch(() => {});
        }
        if (!messages.length && communityView === 'dm' && safeRoomId === activeCommunityDmRoomId) {
          ensureIntroMessage('community');
        }
        await syncVisibleCommunityDmReadState(safeRoomId, {
          silent: true,
          message: messages.length ? messages[messages.length - 1] : null
        });
        return true;
      } catch (err) {
        console.warn('[chat] community dm history error', err);
        return false;
      }
    };

    const ensureCommunityDmRoomOpen = async (peer) => {
      const endpoint = getCommunityDmRoomEndpoint();
      const currentUser = window.user;
      const currentUserId =
        currentUser && currentUser.id !== undefined && currentUser.id !== null ? String(currentUser.id).trim() : '';
      const peerUserId = pickFirstText(peer && (peer.id || peer.user_id || peer.userId));
      if (!endpoint || !currentUserId || !peerUserId) return null;
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({
            uuid: getClientUuid(),
            platform: getClientPlatform(),
            user_id: currentUserId,
            user_name: getUserDisplayName(currentUser),
            avatar: getUserPublicAvatar(currentUser),
            app: 'speakapp',
            premium: isChatEnabledUser(currentUser),
            peer_user_id: peerUserId,
            peer_name: pickFirstText(peer && peer.name),
            peer_avatar: pickFirstText(peer && peer.avatar)
          })
        });
        if (!response.ok) {
          if (response.status === 403) {
            handleCommunityAccessDenied();
          }
          throw new Error(`community_dm_open_${response.status}`);
        }
        const data = await response.json();
        if (!data || data.ok !== true || !data.room) throw new Error('community_dm_open_invalid');
        const room = upsertCommunityRoom(data.room);
        renderCommunityLists();
        if (room && pusherClient && chatMode === 'community') {
          syncCommunityDmSubscriptions();
          await loadCommunityDmHistory(room.roomId, { force: true });
        }
        return room;
      } catch (err) {
        console.warn('[chat] community dm open error', err);
        presentSystemToast(uiCopy.communityDmOpenError || uiCopy.serverUnavailable);
        return null;
      }
    };

    const emitCommunityDmMessage = async ({ roomId, text, clientMessageId = '' }) => {
      const endpoint = getCommunityMessagesEndpoint();
      const currentUser = window.user;
      const currentUserId =
        currentUser && currentUser.id !== undefined && currentUser.id !== null ? String(currentUser.id).trim() : '';
      const activeRoom = communityDmRooms.find((room) => room && room.roomId === roomId) || null;
      if (!endpoint || !currentUserId || !roomId || !activeRoom) return { ok: false };
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({
            room_type: 'dm',
            room_id: roomId,
            uuid: getClientUuid(),
            platform: getClientPlatform(),
            user_id: currentUserId,
            user_name: getUserDisplayName(currentUser),
            avatar: getUserPublicAvatar(currentUser),
            app: 'speakapp',
            premium: isChatEnabledUser(currentUser),
            peer_user_id: pickFirstText(activeRoom.peer && activeRoom.peer.id),
            peer_name: pickFirstText(activeRoom.peer && activeRoom.peer.name),
            peer_avatar: pickFirstText(activeRoom.peer && activeRoom.peer.avatar),
            client_message_id: pickFirstText(clientMessageId),
            text
          })
        });
        if (!response.ok) {
          return { ok: false, status: response.status };
        }
        return response.json();
      } catch (err) {
        console.warn('[chat] community dm send error', err);
        return { ok: false, error: err && err.message ? err.message : 'community_dm_send_failed' };
      }
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
      Boolean(textInput && textRow && !textRow.hidden && (chatMode === 'chatbot' || chatMode === 'community'));

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

    const scrollChatTimelineToLatest = (behavior = 'auto') => {
      if (chatMode === 'community' && communityView === 'dm' && !activeCommunityDmRoomId) return;
      requestAnimationFrame(() => {
        scrollThreadToBottom(behavior);
      });
      setTimeout(() => {
        scrollThreadToBottom('auto');
      }, 80);
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
      const hasLoggedUser =
        Boolean(window.user && window.user.id !== undefined && window.user.id !== null);
      if (chatMode === 'community' && !hasLoggedUser) {
        sendBtn.disabled = true;
        return;
      }
      if (chatMode === 'community' && communityView === 'dm' && !activeCommunityDmRoomId) {
        sendBtn.disabled = true;
        return;
      }
      if (!isChatbotRealtimeAvailable()) {
        sendBtn.disabled = true;
        return;
      }
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
        if (textInput) {
          textInput.disabled = Boolean(chatMode === 'community' && communityView === 'dm' && !activeCommunityDmRoomId);
        }
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
	      clearActiveMessagePlayback();
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
	      const { skipStop = false, messageId = '', playbackSource = '', onStart, onEnd, onError } = options;
	      if (!url) return false;
	      if (!skipStop) {
	        stopPlayback();
	      }
	      const resolvedSource = inferPlaybackSource({ audioUrl: url, audioKind: playbackSource });
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
	        clearActiveMessagePlayback(messageId);
	        stopCoachMascotTalk({ settle: true });
	      };
	      const preparedEntry = getPreparedMessageAudioEntry(messageId, url);
	      const audio = preparedEntry && preparedEntry.audio ? preparedEntry.audio : new Audio(url);
	      audio.preload = 'auto';
	      if (!preparedEntry) {
	        audio.src = url;
	      }
	      try {
	        audio.currentTime = 0;
	      } catch (_err) {
	        // no-op
	      }
	      activeAudio = audio;
	      audio.onplaying = () => {
	        setActiveMessagePlayback(messageId, resolvedSource);
	        startTalkOnAudible();
	        if (typeof onStart === 'function') onStart(resolvedSource);
	      };
	      const playPromise = audio.play();
	      if (playPromise && typeof playPromise.then === 'function') {
	        playPromise
	          .then(() => {})
	          .catch((err) => {
	            console.warn('[chat] audio play error', err);
	            if (activeAudio === audio) activeAudio = null;
	            releaseTalk();
	            if (typeof onError === 'function') onError(err);
	          });
	      }
	      audio.onended = () => {
	        if (activeAudio === audio) activeAudio = null;
	        releaseTalk();
	        if (typeof onEnd === 'function') onEnd();
	      };
	      audio.onerror = () => {
	        if (activeAudio === audio) activeAudio = null;
	        releaseTalk();
	        if (typeof onError === 'function') onError(new Error('audio-url-error'));
	      };
	      return true;
	    };

    const playSpeechWeb = (text, options = {}) => {
      const { onStart, onEnd, onError, skipStop = false, messageId = '', playbackSource = 'native' } = options;
      if (!text || !canSpeak()) return false;
      if (!skipStop) {
        stopPlayback();
      }
      let startedTalk = false;
      const startTalk = () => {
        if (startedTalk) return;
        startedTalk = true;
        setActiveMessagePlayback(messageId, playbackSource);
        startCoachMascotTalk();
      };
      let releasedTalk = false;
      const releaseTalk = () => {
        if (releasedTalk) return;
        releasedTalk = true;
        clearActiveMessagePlayback(messageId);
        stopCoachMascotTalk({ settle: true });
      };
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'en-US';
      utter.onstart = () => {
        startTalk();
        if (typeof onStart === 'function') onStart(playbackSource);
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
      const { onStart, onEnd, onError, skipStop = false, messageId = '', playbackSource = 'native' } = options;
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
          setActiveMessagePlayback(messageId, playbackSource);
          startCoachMascotTalk();
          if (typeof onStart === 'function') onStart(playbackSource);
        };
        let releasedTalk = false;
        const releaseTalk = () => {
          if (releasedTalk) return;
          releasedTalk = true;
          clearStartTalkTimer();
          clearActiveMessagePlayback(messageId);
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
              onStart,
              onEnd,
              onError,
              skipStop: true,
              messageId,
              playbackSource
            });
            if (!startedWeb && typeof onError === 'function') {
              onError(err);
            }
          });
        return true;
      }
      return playSpeechWeb(text, { onStart, onEnd, onError, skipStop: true, messageId, playbackSource });
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

	    const playChatbotAlignedMessageAudio = async (text, requestToken, options = {}) => {
	      const { messageId = '', onStart, onEnd, onError } = options;
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
	      return playAudioUrl(audioUrl, {
	        skipStop: true,
	        messageId,
	        playbackSource: normalizeAudioKind(payload.audio_kind || payload.provider || 'polly') || 'polly',
	        onStart,
	        onEnd,
	        onError
	      });
	    };

	    const playMessageAudio = ({ id, audioUrl, audioKind, speakText, mode, role, onStart, onEnd, onError }) => {
	      const normalizedRole = role === 'bot' ? 'bot' : 'user';
	      const targetMode = mode === 'chatbot' ? 'chatbot' : 'catbot';
	      const messageId = id ? String(id).trim() : '';
	      const playbackSource = inferPlaybackSource({ audioUrl, audioKind });
	      if (audioUrl) {
	        return playAudioUrl(audioUrl, {
	          messageId,
	          playbackSource,
	          onStart,
	          onEnd,
	          onError: (err) => {
	            if (!speakText) {
	              if (typeof onError === 'function') onError(err);
	              return;
	            }
	            const fallbackStarted = playSpeech(speakText, {
	              skipStop: true,
	              messageId,
	              playbackSource: 'native',
	              onStart,
	              onEnd,
	              onError
	            });
	            if (!fallbackStarted && typeof onError === 'function') {
	              onError(err);
	            }
	          }
	        });
	      }
	      if (!speakText) return;

	      const wantsAlignedChatbotAudio =
	        targetMode === 'chatbot' &&
	        normalizedRole === 'bot' &&
	        getSharedAudioMode() === SHARED_AUDIO_MODE_GENERATED &&
	        !isChatbotAlignedTtsBlockedByLimit();

	      if (!wantsAlignedChatbotAudio) {
	        return playSpeech(speakText, { messageId, playbackSource, onStart, onEnd, onError });
	      }

	      stopPlayback();
	      const requestToken = playbackRequestToken;
	      playChatbotAlignedMessageAudio(speakText, requestToken, { messageId, onStart, onEnd, onError })
	        .then((started) => {
	          if (started) return;
	          if (requestToken !== playbackRequestToken) return;
	          playSpeech(speakText, {
	            skipStop: true,
	            messageId,
	            playbackSource: 'native',
	            onStart,
	            onEnd,
	            onError
	          });
	        })
	        .catch(() => {
	          if (requestToken !== playbackRequestToken) return;
	          playSpeech(speakText, {
	            skipStop: true,
	            messageId,
	            playbackSource: 'native',
	            onStart,
	            onEnd,
	            onError
	          });
	        });
	      return true;
	    };

    const resolveTalkStorageKey = (userId) =>
      `${TALK_STORAGE_PREFIX}${userId ? String(userId) : 'anon'}`;

    const readDebugChatMode = () => {
      try {
        const raw = localStorage.getItem(CHAT_MODE_DEBUG_KEY);
        if (raw === 'community') return 'community';
        if (raw === 'chatbot') return 'chatbot';
        if (raw === 'catbot') return isCatbotFeatureEnabled() ? 'catbot' : 'community';
      } catch (err) {
        // no-op
      }
      return isCatbotFeatureEnabled() ? 'catbot' : 'community';
    };

    const writeDebugChatMode = (mode) => {
      const normalizedMode = mode === 'catbot' && !isCatbotFeatureEnabled() ? 'community' : mode;
      if (normalizedMode !== 'catbot' && normalizedMode !== 'chatbot' && normalizedMode !== 'community') return;
      try {
        localStorage.setItem(CHAT_MODE_DEBUG_KEY, normalizedMode);
      } catch (err) {
        // no-op
      }
    };

    const getVisibleChatMode = () => {
      if (chatMode === 'chatbot') return 'coach';
      if (chatMode === 'community') return communityView === 'dm' ? 'private' : 'public';
      return 'catbot';
    };

    const updateModeToggleUi = () => {
      if (!modeToggle) return;
      const activeMode = getVisibleChatMode();
      modeToggle.querySelectorAll('.chat-mode-btn').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.mode === activeMode);
      });
      const catbotBtn = modeToggle.querySelector('[data-mode="catbot"]');
      if (catbotBtn) {
        catbotBtn.hidden = !isCatbotFeatureEnabled();
      }
    };

    const sanitizeTalkMessage = (message) => {
      if (!message || typeof message !== 'object') return null;
      const role = message.role === 'bot' ? 'bot' : 'user';
      const text = normalizeChatText(message.text);
      if (!text) return null;
      const idRaw =
        message.id !== undefined && message.id !== null ? String(message.id).trim() : '';
      const failed = role === 'user' ? Boolean(message.failed) : false;
      const sendStateRaw = pickFirstText(message.sendState, message.send_state);
      const sendState =
        role === 'user' && (sendStateRaw === 'sending' || sendStateRaw === 'sent' || sendStateRaw === 'failed')
          ? sendStateRaw
          : '';
      const speakText = normalizeChatText(message.speakText) || text;
      const audioUrl = sanitizeStoredAudioUrl(message.audioUrl || message.audio_url);
      const audioKind = normalizeAudioKind(message.audioKind || message.audio_kind);
      const createdAt = pickFirstText(
        message.createdAt,
        message.created_at,
        message.published,
        message.timestamp
      );
      return {
        id: idRaw,
        clientMessageId: pickFirstText(message.clientMessageId, message.client_message_id),
        role,
        text,
        audioUrl,
        audioKind,
        speakText,
        failed,
        sendState,
        createdAt,
        deliveredAt: pickFirstText(message.deliveredAt, message.delivered_at),
        deliveredUserId: pickFirstText(message.deliveredUserId, message.delivered_user_id),
        deliveredUuid: pickFirstText(message.deliveredUuid, message.delivered_uuid),
        actorId: pickFirstText(message.actorId, message.actor_id),
        actorName: pickFirstText(message.actorName, message.actor_name),
        actorAvatar: pickFirstText(message.actorAvatar, message.actor_avatar),
        actorApp: pickFirstText(message.actorApp, message.actor_app)
      };
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
        const community = normalizeStoredTimeline(parsed.community);
        return { catbot, chatbot, community };
      } catch (err) {
        return null;
      }
    };

    const persistTalkTimelines = () => {
      try {
        const payload = {
          catbot: chatThreads.catbot.map(sanitizeTalkMessage).filter(Boolean),
          chatbot: chatThreads.chatbot.map(sanitizeTalkMessage).filter(Boolean),
          community: chatThreads.community.map(sanitizeTalkMessage).filter(Boolean)
        };
        localStorage.setItem(talkStorageKey, JSON.stringify(payload));
      } catch (err) {
        // no-op
      }
    };

    const getThread = (mode, options = {}) => {
      if (mode === 'chatbot') return chatThreads.chatbot;
      if (mode === 'community') {
        const scope = pickFirstText(options.scope, communityView);
        const roomId = pickFirstText(options.roomId, activeCommunityDmRoomId);
        if (scope === 'dm') {
          return ensureCommunityDmThread(roomId);
        }
        return chatThreads.community;
      }
      return chatThreads.catbot;
    };

    const createChatMessageId = () =>
      `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    const isVisibleThread = (mode, options = {}) => {
      if (mode !== chatMode) return false;
      if (mode !== 'community') return true;
      const scope = pickFirstText(options.scope, communityView);
      const roomId = pickFirstText(options.roomId, activeCommunityDmRoomId);
      if (scope !== communityView) return false;
      if (scope === 'dm') {
        return Boolean(roomId) && roomId === activeCommunityDmRoomId;
      }
      return true;
    };

    const updateThreadMessage = (mode, messageId, updater, options = {}) => {
      if (!messageId || typeof updater !== 'function') return null;
      const thread = getThread(mode, options);
      const index = thread.findIndex((item) => item && item.id === messageId);
      if (index < 0) return null;
      const current = thread[index];
      const next = updater({ ...current });
      if (!next || typeof next !== 'object') return current;
      thread[index] = next;
      persistTalkTimelines();
      if (options.rerender !== false && isVisibleThread(mode, options)) {
        renderThread(mode);
      }
      return next;
    };

    const updateThreadMessageBy = (mode, matcher, updater, options = {}) => {
      if (typeof matcher !== 'function' || typeof updater !== 'function') return null;
      const thread = getThread(mode, options);
      const index = thread.findIndex((item) => item && matcher(item));
      if (index < 0) return null;
      const current = thread[index];
      const next = updater({ ...current });
      if (!next || typeof next !== 'object') return current;
      thread[index] = next;
      persistTalkTimelines();
      if (options.rerender !== false && isVisibleThread(mode, options)) {
        renderThread(mode);
      }
      return next;
    };

    const replaceThreadMessages = (mode, messages, options = {}) => {
      const thread = getThread(mode, options);
      thread.length = 0;
      normalizeStoredTimeline(messages).forEach((message) => thread.push(message));
      persistTalkTimelines();
      if (options.rerender !== false && isVisibleThread(mode, options)) {
        renderThread(mode);
      }
      return thread;
    };

    const applyCommunityMessageModerationUpdate = (scope, roomId, data) => {
      const safeScope = pickFirstText(scope, 'public');
      const safeRoomId = pickFirstText(roomId);
      const messageId = pickFirstText(data && (data.message_id || data.messageId));
      const moderatedText = normalizeChatText(data && data.text);
      if (!messageId || !moderatedText) return false;
      const updated = updateThreadMessage(
        'community',
        messageId,
        (current) => ({
          ...current,
          text: moderatedText,
          speakText: moderatedText,
          deletedAt: pickFirstText(data && (data.deleted_at || data.deletedAt)),
          deleteReason: pickFirstText(data && (data.delete_reason || data.deleteReason))
        }),
        {
          scope: safeScope,
          roomId: safeRoomId,
          rerender: true
        }
      );
      if (safeScope === 'dm' && safeRoomId) {
        loadCommunityDmRooms({ force: true }).catch(() => {});
      }
      return Boolean(updated);
    };

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
      chatThreads.community = stored ? stored.community : [];
      Object.keys(communityDmThreads).forEach((roomId) => {
        delete communityDmThreads[roomId];
      });
      return stored;
    };

    const syncActiveMessagePlaybackUi = () => {
      if (!threadEl) return;
      const activeId = activeMessagePlayback && activeMessagePlayback.id ? String(activeMessagePlayback.id) : '';
      const activeSource = activeId ? normalizeAudioKind(activeMessagePlayback.source) : '';
      threadEl.querySelectorAll('.chat-msg').forEach((msgEl) => {
        const isActive = Boolean(activeId) && msgEl.dataset.messageId === activeId;
        msgEl.classList.toggle('is-playing', isActive);
        msgEl.classList.toggle('is-playing-polly', isActive && activeSource === 'polly');
        msgEl.classList.toggle('is-playing-native', isActive && activeSource === 'native');
        msgEl.classList.toggle('is-playing-local', isActive && activeSource === 'local');
        const playBtn = msgEl.querySelector('.chat-play-btn');
        if (playBtn) {
          playBtn.classList.toggle('is-playing', isActive);
          if (isActive) {
            playBtn.dataset.playingSource = activeSource || '';
            playBtn.setAttribute('aria-pressed', 'true');
          } else {
            delete playBtn.dataset.playingSource;
            playBtn.removeAttribute('aria-pressed');
          }
          const iconEl = playBtn.querySelector('ion-icon');
          if (iconEl) {
            iconEl.setAttribute('name', isActive ? 'stop' : 'play');
          }
        }
      });
    };

    const setActiveMessagePlayback = (messageId, source) => {
      const nextId = messageId ? String(messageId).trim() : '';
      activeMessagePlayback = {
        id: nextId,
        source: normalizeAudioKind(source) || 'native'
      };
      syncActiveMessagePlaybackUi();
    };

    const clearActiveMessagePlayback = (messageId = '') => {
      const targetId = messageId ? String(messageId).trim() : '';
      if (targetId && activeMessagePlayback.id && activeMessagePlayback.id !== targetId) return;
      if (!activeMessagePlayback.id && !activeMessagePlayback.source) return;
      activeMessagePlayback = { id: '', source: '' };
      syncActiveMessagePlaybackUi();
    };

    const clearPreparedMessageAudio = (messageId = '') => {
      if (!messageId) {
        preparedMessageAudio.clear();
        return;
      }
      preparedMessageAudio.delete(String(messageId).trim());
    };

    const getPreparedMessageAudioEntry = (messageId, audioUrl = '') => {
      const key = messageId ? String(messageId).trim() : '';
      if (!key) return null;
      const entry = preparedMessageAudio.get(key);
      if (!entry) return null;
      if (audioUrl && entry.url !== audioUrl) return null;
      return entry;
    };

    const ensurePreparedMessageAudio = (messageId, audioUrl) => {
      const key = messageId ? String(messageId).trim() : '';
      const url = typeof audioUrl === 'string' ? audioUrl.trim() : '';
      if (!key || !url) return null;
      const existing = getPreparedMessageAudioEntry(key, url);
      if (existing) return existing;

      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = url;
      audio.load();

      const entry = {
        id: key,
        url,
        audio,
        ready: false,
        readyPromise: null
      };

      entry.readyPromise = new Promise((resolve) => {
        let settled = false;
        const finish = (isReady) => {
          if (settled) return;
          settled = true;
          entry.ready = Boolean(isReady);
          audio.removeEventListener('canplay', onReady);
          audio.removeEventListener('canplaythrough', onReady);
          audio.removeEventListener('loadeddata', onReady);
          audio.removeEventListener('error', onFail);
          audio.removeEventListener('abort', onFail);
          resolve(entry.ready);
        };
        const onReady = () => finish(true);
        const onFail = () => finish(false);
        audio.addEventListener('canplay', onReady, { once: true });
        audio.addEventListener('canplaythrough', onReady, { once: true });
        audio.addEventListener('loadeddata', onReady, { once: true });
        audio.addEventListener('error', onFail, { once: true });
        audio.addEventListener('abort', onFail, { once: true });
      });

      preparedMessageAudio.set(key, entry);
      while (preparedMessageAudio.size > 12) {
        const oldestKey = preparedMessageAudio.keys().next();
        if (!oldestKey || oldestKey.done) break;
        if (oldestKey.value === key) break;
        preparedMessageAudio.delete(oldestKey.value);
      }

      return entry;
    };

    const getIntroCopy = (mode) => {
      if (mode === 'chatbot') return uiCopy.introChatbot;
      if (mode === 'community') {
        return communityView === 'dm' ? getCommunityDmIntro() : uiCopy.introCommunity;
      }
      return uiCopy.introCatbot;
    };

    const renderMessage = (
      {
        id,
        clientMessageId,
        role,
        text,
        audioUrl,
        audioKind,
        speakText,
        failed,
        sendState,
        createdAt,
        deliveredAt,
        actorName
      },
      mode
    ) => {
      if (!threadEl) return;
      const msgEl = document.createElement('div');
      msgEl.className = `chat-msg chat-msg-${role}`;
      if (id) msgEl.dataset.messageId = id;
      if (audioKind) msgEl.dataset.audioKind = normalizeAudioKind(audioKind);

      const bubbleEl = document.createElement('div');
      bubbleEl.className = 'chat-bubble';

      const textEl = document.createElement('p');
      textEl.className = 'chat-text';
      textEl.textContent = text;
      const isCommunityMessage = mode === 'community';
      if (isCommunityMessage) {
        const bodyEl = document.createElement('div');
        bodyEl.className = 'chat-bubble-body';
        const copyEl = document.createElement('div');
        copyEl.className = 'chat-bubble-copy';
        if (role !== 'user' && actorName) {
          const metaEl = document.createElement('div');
          metaEl.className = 'chat-msg-meta';
          metaEl.textContent = actorName || 'User';
          copyEl.appendChild(metaEl);
        }
        copyEl.appendChild(textEl);
        bodyEl.appendChild(copyEl);

        const isCommunityDmThread = mode === 'community' && communityView === 'dm';
        const effectiveSendState =
          role === 'user'
            ? pickFirstText(sendState) || (isCommunityDmThread ? 'sent' : '')
            : '';
        const isDelivered = role === 'user' && isCommunityDmThread && Boolean(pickFirstText(deliveredAt));
        const bubbleTime = formatCommunityBubbleTime(createdAt);
        const showBubbleTime = Boolean(bubbleTime) && effectiveSendState !== 'sending';
        const showStateIcon =
          role === 'user' &&
          (effectiveSendState === 'sending' ||
            effectiveSendState === 'failed' ||
            effectiveSendState === 'sent' ||
            isDelivered);
        if (showBubbleTime || showStateIcon) {
          const effectiveStateClass =
            effectiveSendState === 'failed'
              ? 'failed'
              : effectiveSendState === 'sending'
                ? 'sending'
                : isDelivered
                  ? 'delivered'
                  : effectiveSendState === 'sent'
                    ? 'sent'
                    : '';
          const stateEl = document.createElement('div');
          stateEl.className = `chat-msg-state${effectiveStateClass ? ` chat-msg-state-${effectiveStateClass}` : ''}`;
          if (showStateIcon) {
            const iconEl = document.createElement('ion-icon');
            iconEl.setAttribute(
              'name',
              effectiveSendState === 'failed'
                ? 'alert-circle-outline'
                : effectiveSendState === 'sending'
                  ? 'time-outline'
                  : isDelivered
                    ? 'checkmark-done'
                    : 'checkmark'
            );
            stateEl.appendChild(iconEl);
          }
          if (showBubbleTime) {
            const labelEl = document.createElement('span');
            labelEl.textContent = bubbleTime;
            stateEl.appendChild(labelEl);
          }
          bodyEl.appendChild(stateEl);
        }
        bubbleEl.appendChild(bodyEl);
      } else {
        bubbleEl.appendChild(textEl);
      }

      const allowAudioAction = mode === 'catbot' || mode === 'chatbot';
      const showAudioAction = allowAudioAction && (mode !== 'chatbot' || role === 'bot');
      const showRetryAction = mode === 'chatbot' && role === 'user' && Boolean(failed);
      if (showAudioAction || showRetryAction) {
        const actionEl = document.createElement('div');
        actionEl.className = 'chat-bubble-actions';
        if (showAudioAction) {
          const playBtn = document.createElement('button');
          playBtn.type = 'button';
          playBtn.className = 'chat-audio-btn chat-play-btn';
          playBtn.innerHTML = `<ion-icon name="play"></ion-icon><span>${role === 'user' ? uiCopy.listen : uiCopy.repeat}</span>`;
          if (!audioUrl && !speakText) {
            playBtn.disabled = true;
          }
          playBtn.addEventListener('pointerdown', (event) => {
            if (!isChatInputActive()) return;
            event.preventDefault();
            keepChatInputFocused({ scroll: true });
          });
          playBtn.addEventListener('click', () => {
            const targetId = id && String(id).trim() ? String(id).trim() : '';
            if (targetId && activeMessagePlayback.id === targetId) {
              stopPlayback();
              return;
            }
            playMessageAudio({ id, audioUrl, audioKind, speakText, role, mode });
          });
          actionEl.appendChild(playBtn);
        }
        if (showRetryAction) {
          const retryBtn = document.createElement('button');
          retryBtn.type = 'button';
          retryBtn.className = 'chat-audio-btn chat-retry-btn';
          retryBtn.innerHTML = `<ion-icon name="refresh"></ion-icon><span>${uiCopy.retrySend || 'Retry'}</span>`;
          retryBtn.addEventListener('pointerdown', (event) => {
            if (!isChatInputActive()) return;
            event.preventDefault();
            keepChatInputFocused({ scroll: true });
          });
          retryBtn.addEventListener('click', () => {
            if (!id) return;
            sendUserText(text, {
              audioUrl: '',
              speakText: speakText || text,
              retryMessageId: id
            });
          });
          actionEl.appendChild(retryBtn);
        }
        bubbleEl.appendChild(actionEl);
      }

      msgEl.appendChild(bubbleEl);
      threadEl.appendChild(msgEl);
      syncActiveMessagePlaybackUi();
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
      if (mode === 'community' && communityView === 'dm' && !activeCommunityDmRoomId) {
        renderMessage(
          {
            id: '',
            role: 'bot',
            text: getCommunityDmIntro(),
            audioUrl: '',
            audioKind: '',
            speakText: '',
            failed: false,
            actorName: '',
            actorApp: ''
          },
          mode
        );
        return;
      }
      thread.forEach((message) => renderMessage(message, mode));
      if (typingState[mode]) {
        renderTypingIndicator();
      }
      scrollThreadToBottom();
      updateChatAutoScroll();
    };

    const appendMessage = (
      {
        id,
        clientMessageId,
        role,
        text,
        audioUrl,
        audioKind,
        speakText,
        failed,
        sendState,
        createdAt,
        deliveredAt,
        deliveredUserId,
        deliveredUuid,
        actorId,
        actorName,
        actorAvatar,
        actorApp
      },
      options = {}
    ) => {
      const targetMode = options.mode || chatMode;
      const shouldAutoplay = options.autoplay === true;
      const normalizedRole = role === 'bot' ? 'bot' : 'user';
      const normalizedText = normalizeChatText(text);
      if (!normalizedText) return;
      const normalizedId = id && String(id).trim() ? String(id).trim() : createChatMessageId();
      const normalizedSpeakText = normalizeChatText(speakText) || normalizedText;
      const normalizedAudioUrl = typeof audioUrl === 'string' ? audioUrl : '';
      const normalizedAudioKind = normalizeAudioKind(audioKind);
      const normalizedFailed = normalizedRole === 'user' ? Boolean(failed) : false;
      const normalizedClientMessageId = pickFirstText(options.clientMessageId, clientMessageId);
      const normalizedSendStateRaw = pickFirstText(options.sendState, sendState);
      const normalizedSendState =
        normalizedRole === 'user' &&
        (normalizedSendStateRaw === 'sending' ||
          normalizedSendStateRaw === 'sent' ||
          normalizedSendStateRaw === 'failed')
          ? normalizedSendStateRaw
          : '';
      const normalizedCreatedAt =
        pickFirstText(options.createdAt, createdAt) || new Date().toISOString();
      if (normalizedRole === 'bot') {
        typingState[targetMode] = false;
      }
      const thread = getThread(targetMode, options);
      if (thread.some((item) => item && item.id && item.id === normalizedId)) {
        return;
      }
      const message = {
        id: normalizedId,
        clientMessageId: normalizedClientMessageId,
        role: normalizedRole,
        text: normalizedText,
        audioUrl: normalizedAudioUrl,
        audioKind: normalizedAudioKind,
        speakText: normalizedSpeakText,
        failed: normalizedFailed,
        sendState: normalizedSendState,
        createdAt: normalizedCreatedAt,
        deliveredAt: pickFirstText(deliveredAt),
        deliveredUserId: pickFirstText(deliveredUserId),
        deliveredUuid: pickFirstText(deliveredUuid),
        actorId: pickFirstText(actorId),
        actorName: pickFirstText(actorName),
        actorAvatar: pickFirstText(actorAvatar),
        actorApp: pickFirstText(actorApp)
      };
      thread.push(message);
      persistTalkTimelines();
      if (isVisibleThread(targetMode, options)) {
        if (normalizedRole === 'bot') {
          removeTypingIndicator();
        }
        renderMessage(message, targetMode);
	        if (shouldAutoplay && normalizedRole === 'bot') {
	          playMessageAudio({
	            id: normalizedId,
	            audioUrl: normalizedAudioUrl,
	            audioKind: normalizedAudioKind,
	            speakText: normalizedSpeakText,
	            role: normalizedRole,
	            mode: targetMode
	          });
	        }
      }
    };

    const ensureIntroMessage = (mode) => {
      const targetMode = mode || chatMode;
      const targetScope = targetMode === 'community' ? communityView : '';
      const targetRoomId = targetMode === 'community' && targetScope === 'dm' ? activeCommunityDmRoomId : '';
      const thread = getThread(targetMode, { scope: targetScope, roomId: targetRoomId });
      if (thread.length) return;
      const introCopy = getIntroCopy(targetMode);
      appendMessage(
        {
          role: 'bot',
          text: introCopy,
          audioUrl: '',
          audioKind: '',
          speakText: introCopy,
          actorName: ''
        },
        { mode: targetMode, scope: targetScope, roomId: targetRoomId }
      );
    };

    const resetChatSession = ({ keepIntro, setDefaultHint, keepTimeline } = {}) => {
      stopPlayback();
      clearPreparedMessageAudio();
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
        chatThreads.community.length = 0;
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

    const subscribeCommunityDmRoom = (room, userId) => {
      if (!pusherClient || !room || !room.channel || !room.roomId) return null;
      if (pusherCommunityDmChannels.has(room.roomId)) {
        return pusherCommunityDmChannels.get(room.roomId);
      }
      const channel = pusherClient.subscribe(room.channel);
      channel.bind('pusher:subscription_error', (status) => {
        console.warn('[chat] dm subscription error', room.channel, status);
      });
      channel.bind('chat_message', (data) => {
        const message = normalizeIncoming(data, 'user', {
          mode: 'community',
          viewerId: userId
        });
        if (!message) return;
        const normalizedClientMessageId = pickFirstText(message.clientMessageId);
        const isOwnMessage = pickFirstText(message.actorId) === pickFirstText(userId);
        if (isOwnMessage && normalizedClientMessageId) {
          const reconciled = updateThreadMessage(
            'community',
            normalizedClientMessageId,
            (current) => ({
              ...current,
              id: pickFirstText(message.id) || current.id,
              clientMessageId: normalizedClientMessageId,
              createdAt: pickFirstText(message.createdAt, current.createdAt),
              sendState: 'sent',
              failed: false
            }),
            { scope: 'dm', roomId: room.roomId, rerender: true }
          );
          if (reconciled) {
            upsertCommunityRoom({
              ...room,
              last_message_preview: message.text,
              last_message_at: pickFirstText(data && (data.created_at || data.published)) || new Date().toISOString(),
              last_message_actor_id: pickFirstText(message.actorId),
              last_message_actor_name: pickFirstText(message.actorName)
            });
            setCommunityRoomUnreadCount(room.roomId, 0);
            renderCommunityLists();
            return;
          }
        }
        if (isOwnMessage) {
          const reconciledByText = updateThreadMessageBy(
            'community',
            (current) =>
              current &&
              current.role === 'user' &&
              current.sendState === 'sending' &&
              normalizeChatText(current.text) === normalizeChatText(message.text),
            (current) => ({
              ...current,
              id: pickFirstText(message.id) || current.id,
              clientMessageId: normalizedClientMessageId || current.clientMessageId || current.id,
              createdAt: pickFirstText(message.createdAt, current.createdAt),
              sendState: 'sent',
              failed: false
            }),
            { scope: 'dm', roomId: room.roomId, rerender: true }
          );
          if (reconciledByText) {
            upsertCommunityRoom({
              ...room,
              last_message_preview: message.text,
              last_message_at: pickFirstText(data && (data.created_at || data.published)) || new Date().toISOString(),
              last_message_actor_id: pickFirstText(message.actorId),
              last_message_actor_name: pickFirstText(message.actorName)
            });
            setCommunityRoomUnreadCount(room.roomId, 0);
            renderCommunityLists();
            return;
          }
        }
        const ensuredId =
          message.id && String(message.id).trim() ? String(message.id).trim() : createChatMessageId();
        message.id = ensuredId;
        appendMessage(message, {
          mode: 'community',
          autoplay: false,
          scope: 'dm',
          roomId: room.roomId
        });
        const isVisibleRoom = isVisibleCommunityDmRoom(room.roomId);
        upsertCommunityRoom({
          ...room,
          last_message_preview: message.text,
          last_message_at: pickFirstText(data && (data.created_at || data.published)) || new Date().toISOString(),
          last_message_actor_id: pickFirstText(message.actorId),
          last_message_actor_name: pickFirstText(message.actorName)
        });
        if (!isOwnMessage && !isVisibleRoom) {
          const currentRoom = communityDmRooms.find((entry) => entry && entry.roomId === room.roomId) || null;
          setCommunityRoomUnreadCount(room.roomId, (currentRoom ? currentRoom.unreadCount : 0) + 1);
        } else {
          setCommunityRoomUnreadCount(room.roomId, 0);
        }
        renderCommunityLists();
        if (!isOwnMessage && isVisibleRoom) {
          syncVisibleCommunityDmReadState(room.roomId, {
            silent: true,
            message
          });
        }
        if (!isOwnMessage) {
          markCommunityDmMessageDelivered(room.roomId, message, { silent: true }).catch(() => {});
        }
      });
      channel.bind('message_delivery_update', (data) => {
        const messageId = pickFirstText(data && (data.message_id || data.messageId));
        const clientMessageId = pickFirstText(data && (data.client_message_id || data.clientMessageId));
        const deliveredAt = pickFirstText(data && (data.delivered_at || data.deliveredAt));
        const deliveredUserId = pickFirstText(data && (data.delivered_user_id || data.deliveredUserId));
        const deliveredUuid = pickFirstText(data && (data.delivered_uuid || data.deliveredUuid));
        if (!messageId && !clientMessageId) return;
        const updated =
          (messageId
            ? updateThreadMessage(
                'community',
                messageId,
                (current) => ({
                  ...current,
                  deliveredAt: deliveredAt || current.deliveredAt,
                  deliveredUserId: deliveredUserId || current.deliveredUserId,
                  deliveredUuid: deliveredUuid || current.deliveredUuid,
                  sendState: current.sendState === 'failed' ? current.sendState : 'sent',
                  failed: false
                }),
                { scope: 'dm', roomId: room.roomId, rerender: true }
              )
            : null) ||
          (clientMessageId
            ? updateThreadMessage(
                'community',
                clientMessageId,
                (current) => ({
                  ...current,
                  deliveredAt: deliveredAt || current.deliveredAt,
                  deliveredUserId: deliveredUserId || current.deliveredUserId,
                  deliveredUuid: deliveredUuid || current.deliveredUuid,
                  sendState: current.sendState === 'failed' ? current.sendState : 'sent',
                  failed: false
                }),
                { scope: 'dm', roomId: room.roomId, rerender: true }
              )
            : null);
        if (!updated && clientMessageId) {
          updateThreadMessageBy(
            'community',
            (current) => current && current.clientMessageId === clientMessageId,
            (current) => ({
              ...current,
              deliveredAt: deliveredAt || current.deliveredAt,
              deliveredUserId: deliveredUserId || current.deliveredUserId,
              deliveredUuid: deliveredUuid || current.deliveredUuid,
              sendState: current.sendState === 'failed' ? current.sendState : 'sent',
              failed: false
            }),
            { scope: 'dm', roomId: room.roomId, rerender: true }
          );
        }
      });
      channel.bind('message_moderation_update', (data) => {
        applyCommunityMessageModerationUpdate('dm', room.roomId, data);
      });
      pusherCommunityDmChannels.set(room.roomId, channel);
      return channel;
    };

    const syncCommunityDmSubscriptions = () => {
      if (!pusherClient || !pickFirstText(lastUserId)) return;
      const desired = new Set(communityDmRooms.map((room) => room.roomId));
      Array.from(pusherCommunityDmChannels.entries()).forEach(([roomId, channel]) => {
        if (desired.has(roomId)) return;
        try {
          channel.unbind_all();
        } catch (err) {
          // no-op
        }
        try {
          pusherClient.unsubscribe(channel.name || `private-${roomId}`);
        } catch (err) {
          // no-op
        }
        pusherCommunityDmChannels.delete(roomId);
      });
      communityDmRooms.forEach((room) => {
        subscribeCommunityDmRoom(room, lastUserId || '');
      });
    };

    const disconnectRealtime = () => {
      clearCommunityPresenceHeartbeat();
      communityDmReadRequests.clear();
      if (chatMode === 'community' || pusherChannelName === COMMUNITY_PUBLIC_CHANNEL) {
        leaveCommunityPresence({ keepalive: true, silent: true });
      }
      Array.from(pusherCommunityDmChannels.entries()).forEach(([roomId, channel]) => {
        try {
          channel.unbind_all();
        } catch (err) {
          // no-op
        }
        try {
          if (pusherClient) pusherClient.unsubscribe(channel.name || `private-${roomId}`);
        } catch (err) {
          // no-op
        }
      });
      pusherCommunityDmChannels.clear();
      if (pusherCommunityPublicChannel) {
        try {
          pusherCommunityPublicChannel.unbind_all();
        } catch (err) {
          // no-op
        }
        try {
          if (pusherClient) {
            pusherClient.unsubscribe(COMMUNITY_PUBLIC_CHANNEL);
          }
        } catch (err) {
          // no-op
        }
        pusherCommunityPublicChannel = null;
      }
      if (pusherCommunityInboxChannel) {
        try {
          pusherCommunityInboxChannel.unbind_all();
        } catch (err) {
          // no-op
        }
        try {
          if (pusherClient) {
            pusherClient.unsubscribe(pusherCommunityInboxChannel.name || buildCommunityInboxChannelName(lastUserId));
          }
        } catch (err) {
          // no-op
        }
        pusherCommunityInboxChannel = null;
      }
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
      communityPresenceCount = 0;
      communityPresenceUsers = [];
      updateCommunityPresenceUi();
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
        realtimeConnected = false;
        if (chatMode === 'chatbot') {
          handleChatbotRealtimeDisconnected();
        } else if (chatMode === 'community') {
          handleCommunityRealtimeDisconnected();
        }
        return;
      }
      if (typeof window.Pusher !== 'function') {
        console.warn('[chat] Pusher no disponible');
        realtimeConnected = false;
        if (chatMode === 'chatbot') {
          handleChatbotRealtimeDisconnected();
        } else if (chatMode === 'community') {
          handleCommunityRealtimeDisconnected();
        }
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

      if (connectedMode === 'community' || channelName.startsWith('private-') || channelName.startsWith('presence-')) {
        const userInfo = {
          id: user.id,
          name: getUserDisplayName(user),
          email: user.email || '',
          avatar: getUserPublicAvatar(user),
          app: 'speakapp',
          premium: isChatEnabledUser(user)
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
      pusherChannelName = connectedMode === 'community' ? COMMUNITY_PUBLIC_CHANNEL : channelName;

      pusherClient.connection.bind('connected', () => {
        realtimeConnected = true;
        applyControlsEnabled();
        updateDraftButtons();
        if (connectedMode === 'chatbot' && !isChatbotDailyLimitActive() && talkState === TALK_STATE_IDLE) {
          setHint(defaultHint || uiCopy.hintDefault);
        } else if (connectedMode === 'community') {
          setHint(getDefaultHintForMode('community'));
          syncCommunityDmSubscriptions();
        }
        if (isCommunityFeatureEnabled()) {
          loadCommunityDmRooms({ force: false }).then(() => {
            syncCommunityDmSubscriptions();
          });
        }
      });
      pusherClient.connection.bind('disconnected', () => {
        realtimeConnected = false;
        if (connectedMode === 'chatbot') {
          handleChatbotRealtimeDisconnected();
        } else if (connectedMode === 'community') {
          handleCommunityRealtimeDisconnected();
        }
      });
      pusherClient.connection.bind('error', (err) => {
        console.warn('[chat] pusher error', err);
        realtimeConnected = false;
        if (connectedMode === 'chatbot') {
          handleChatbotRealtimeDisconnected();
        } else if (connectedMode === 'community') {
          handleCommunityRealtimeDisconnected();
        }
      });

      if (isCommunityFeatureEnabled()) {
        const handleCommunityIncoming = (data, scope = 'public', roomId = '') => {
          const message = normalizeIncoming(data, 'user', {
            mode: 'community',
            viewerId: userId
          });
          if (!message) return;
          const ensuredId =
            message.id && String(message.id).trim() ? String(message.id).trim() : createChatMessageId();
          message.id = ensuredId;
          appendMessage(message, {
            mode: 'community',
            autoplay: false,
            scope,
            roomId
          });
          if (scope === 'public') {
            if (isCommunityPublicVisible()) {
              setCommunityPublicUnreadCount(0);
            } else {
              setCommunityPublicUnreadCount(communityPublicUnreadCount + 1);
            }
          }
          if (scope === 'dm' && roomId) {
            upsertCommunityRoom({
              room_id: roomId,
              channel: `private-${roomId}`,
              last_message_preview: message.text,
              last_message_at: new Date().toISOString()
            });
            renderCommunityLists();
          }
        };

        const handleCommunityDmRoomUpsert = (data) => {
          const room = normalizeCommunityRoom(data && data.room);
          if (!room) return;
          const alreadySubscribed = pusherCommunityDmChannels.has(room.roomId);
          upsertCommunityRoom(room);
          if (!alreadySubscribed) {
            syncCommunityDmSubscriptions();
          }
          renderCommunityLists();
        };

        const handleCommunityDmNotice = (data) => {
          const room = normalizeCommunityRoom(data && data.room);
          if (!room || !room.roomId) return;
          const message = data && data.message && typeof data.message === 'object' ? data.message : {};
          const actorId = pickFirstText(message.actor && message.actor.id);
          const alreadySubscribed = pusherCommunityDmChannels.has(room.roomId);
          const existingRoom = communityDmRooms.find((entry) => entry && entry.roomId === room.roomId) || null;
          upsertCommunityRoom(room);
          if (!alreadySubscribed && actorId !== userId && !isVisibleCommunityDmRoom(room.roomId)) {
            const previousUnread = existingRoom ? Math.max(0, Number(existingRoom.unreadCount) || 0) : 0;
            setCommunityRoomUnreadCount(room.roomId, Math.max(1, previousUnread + 1));
          }
          if (!alreadySubscribed) {
            syncCommunityDmSubscriptions();
          }
          renderCommunityLists();
          if (actorId !== userId) {
            markCommunityDmMessageDelivered(room.roomId, normalizeIncoming(message, 'user', {
              mode: 'community',
              viewerId: userId
            }) || message, { silent: true }).catch(() => {});
          }
        };

        pusherCommunityPublicChannel = pusherClient.subscribe(COMMUNITY_PUBLIC_CHANNEL);
        pusherCommunityPublicChannel.bind('pusher:subscription_error', (status) => {
          console.warn('[chat] subscription error', status);
          realtimeConnected = false;
          handleCommunityRealtimeDisconnected();
        });
        pusherCommunityPublicChannel.bind('chat_message', (data) => {
          handleCommunityIncoming(data, 'public', COMMUNITY_PUBLIC_CHANNEL);
        });
        pusherCommunityPublicChannel.bind('message_moderation_update', (data) => {
          applyCommunityMessageModerationUpdate('public', COMMUNITY_PUBLIC_CHANNEL, data);
        });
        const communityInboxChannelName = buildCommunityInboxChannelName(userId);
        if (communityInboxChannelName) {
          pusherCommunityInboxChannel = pusherClient.subscribe(communityInboxChannelName);
          pusherCommunityInboxChannel.bind('pusher:subscription_error', (status) => {
            console.warn('[chat] inbox subscription error', status);
          });
          pusherCommunityInboxChannel.bind('dm_room_upsert', handleCommunityDmRoomUpsert);
          pusherCommunityInboxChannel.bind('dm_message_notice', handleCommunityDmNotice);
        }

        loadCommunityDmRooms({ force: false }).then(() => {
          syncCommunityDmSubscriptions();
        });
      }

      if (connectedMode === 'community') {
        return;
      }

      const handleIncoming = async (data, fallbackRole) => {
        const messageMode = connectedMode;
        const message = normalizeIncoming(data, fallbackRole, {
          mode: messageMode,
          viewerId: userId
        });
        if (!message) return;
        if (message.role === 'bot') {
          cancelSimulatedReply(messageMode);
          if (messageMode === 'chatbot' && message.limitReached) {
            setChatbotDailyLimitBlocked(true, {
              day: message.day,
              tokenLimitDay: message.tokenLimitDay,
              usedTokensDay: message.usedTokensDay
            });
          }
        }
        const ensuredId =
          message.id && String(message.id).trim() ? String(message.id).trim() : createChatMessageId();
        message.id = ensuredId;
        if (message.role === 'bot' && message.audioUrl) {
          ensurePreparedMessageAudio(ensuredId, message.audioUrl);
        }

        const shouldSyncBotRender = messageMode === 'chatbot' && message.role === 'bot';
        if (shouldSyncBotRender) {
          let rendered = false;
          let renderFallbackTimer = null;
          const renderNow = (options = {}) => {
            const playbackSource = options.playbackSource || '';
            if (rendered) {
              if (playbackSource) {
                setActiveMessagePlayback(message.id, playbackSource);
              }
              return;
            }
            rendered = true;
            if (renderFallbackTimer) {
              clearTimeout(renderFallbackTimer);
              renderFallbackTimer = null;
            }
            setTypingState(messageMode, false);
            appendMessage(message, {
              mode: messageMode,
              autoplay: false
            });
            if (playbackSource) {
              setActiveMessagePlayback(message.id, playbackSource);
            }
          };
          renderFallbackTimer = setTimeout(() => {
            renderNow();
          }, CHATBOT_AUDIO_RENDER_FALLBACK_MS);
          const started = playMessageAudio({
            id: message.id,
            audioUrl: message.audioUrl,
            audioKind: message.audioKind,
            speakText: message.speakText,
            role: message.role,
            mode: messageMode,
            onStart: (actualPlaybackSource) => {
              renderNow({ playbackSource: actualPlaybackSource || 'native' });
            },
            onError: () => {
              renderNow();
            }
          });
          if (!started) {
            renderNow();
          }
          return;
        }
        if (message.role === 'bot') {
          setTypingState(messageMode, false);
        }
        appendMessage(message, {
          mode: messageMode,
          autoplay: messageMode === 'community' ? false : message.role === 'bot'
        });
      };

      pusherChannel = pusherClient.subscribe(channelName);
      pusherChannel.bind('pusher:subscription_error', (status) => {
        console.warn('[chat] subscription error', status);
        realtimeConnected = false;
        if (connectedMode === 'chatbot') {
          handleChatbotRealtimeDisconnected();
        } else if (connectedMode === 'community') {
          handleCommunityRealtimeDisconnected();
        }
      });
      pusherChannel.bind('chat_message', (data) =>
        handleIncoming(data, connectedMode === 'community' ? 'user' : 'bot')
      );
      if (connectedMode !== 'community') {
        pusherChannel.bind('bot_message', (data) => handleIncoming(data, 'bot'));
      }
    };

    const emitRealtimeMessage = async ({ text }) => {
      const config = getRealtimeConfig();
      if (!config.emitEndpoint || !pusherChannelName) return false;
      if (!lastUserId) return false;
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
      const hasAbortController = typeof AbortController === 'function';
      const controller = hasAbortController ? new AbortController() : null;
      const timeoutId = hasAbortController
        ? setTimeout(() => {
            try {
              controller.abort();
            } catch (_err) {
              // no-op
            }
          }, REALTIME_EMIT_TIMEOUT_MS)
        : null;
      try {
        const response = await fetch(config.emitEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller ? controller.signal : undefined
        });
        if (!response || !response.ok) {
          throw new Error(`emit_failed_${response ? response.status : 'unknown'}`);
        }
        return true;
      } catch (err) {
        console.warn('[chat] emit error', err);
        return false;
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
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
      const hasStoredMessages =
        chatThreads.catbot.length > 0 ||
        chatThreads.chatbot.length > 0 ||
        chatThreads.community.length > 0;

      updateUserHeader(user, loggedIn);

      if (loginPanel) loginPanel.hidden = loggedIn;
      if (lockedPanel) lockedPanel.hidden = !loggedIn || chatEnabled;
      if (accessPanel) accessPanel.hidden = chatEnabled;
      if (chatPanel) chatPanel.hidden = !chatEnabled;

	      if (userChanged) {
	        setChatbotDailyLimitBlocked(false);
	        clearChatbotAlignedTtsLimitStatus();
        loadTalkTimelinesForUser(userId);
          communityDmReadRequests.clear();
          communityDmDeliveredAcks.clear();
          communityPublicUnreadCount = 0;
          communityDmRooms = [];
          communityRoomsLoaded = false;
          activeCommunityDmRoomId = '';
          communityPresenceUsers = [];
	        clearThread();
          updateCommunityViewUi();
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
        if (chatMode === 'community') {
          loadCommunityHistory({ force: true });
          if (communityView === 'dm') {
            loadCommunityDmRooms({ force: true });
          }
          scheduleCommunityPresenceHeartbeat({ immediate: true });
        }
      }

      lastUserId = userId;
      lastChatEnabled = chatEnabled;
      syncCommunityUnreadIndicators(userId);
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
      const retryMessageId =
        payload && payload.retryMessageId ? String(payload.retryMessageId).trim() : '';
      const outboundMessageId = retryMessageId || createChatMessageId();
      if (messageMode === 'community') {
        if (communityView === 'dm') {
          const roomId = pickFirstText(activeCommunityDmRoomId);
          if (!roomId) {
            setHint(uiCopy.communitySelectChat);
            return;
          }
          const clientMessageId = outboundMessageId;
          clearDraft(false);
          setHint(getDefaultHintForMode('community'));
          appendMessage(
            {
              id: clientMessageId,
              clientMessageId,
              role: 'user',
              text: userText,
              audioUrl: '',
              audioKind: '',
              speakText: '',
              failed: false,
              sendState: 'sending',
              createdAt: new Date().toISOString(),
              actorId: pickFirstText(lastUserId),
              actorName: getUserDisplayName(window.user),
              actorAvatar: getUserPublicAvatar(window.user),
              actorApp: 'speakapp'
            },
            {
              mode: 'community',
              autoplay: false,
              scope: 'dm',
              roomId,
              sendState: 'sending',
              clientMessageId
            }
          );
          emitCommunityDmMessage({ roomId, text: userText, clientMessageId }).then((result) => {
            if (result && result.ok && result.message) {
              if (result.room) {
                upsertCommunityRoom(result.room);
                setCommunityRoomUnreadCount(roomId, 0);
                renderCommunityLists();
                if (pusherClient && chatMode === 'community') {
                  syncCommunityDmSubscriptions();
                }
              }
              const normalizedMessage = normalizeIncoming(result.message, 'user', {
                mode: 'community',
                viewerId: lastUserId || ''
              });
              if (normalizedMessage) {
                const updated =
                  updateThreadMessage(
                    'community',
                    clientMessageId,
                    (current) => ({
                      ...current,
                      id: pickFirstText(normalizedMessage.id) || current.id,
                      clientMessageId,
                      createdAt: pickFirstText(normalizedMessage.createdAt, current.createdAt),
                      sendState: 'sent',
                      failed: false
                    }),
                    { scope: 'dm', roomId, rerender: true }
                  ) ||
                  updateThreadMessageBy(
                    'community',
                    (current) =>
                      current &&
                      current.role === 'user' &&
                      current.sendState === 'sending' &&
                      normalizeChatText(current.text) === normalizeChatText(normalizedMessage.text),
                    (current) => ({
                      ...current,
                      id: pickFirstText(normalizedMessage.id) || current.id,
                      clientMessageId,
                      createdAt: pickFirstText(normalizedMessage.createdAt, current.createdAt),
                      sendState: 'sent',
                      failed: false
                    }),
                    { scope: 'dm', roomId, rerender: true }
                  );
                if (!updated) {
                  appendMessage(normalizedMessage, {
                    mode: 'community',
                    autoplay: false,
                    scope: 'dm',
                    roomId
                  });
                }
                syncVisibleCommunityDmReadState(roomId, {
                  silent: true,
                  message: normalizedMessage
                });
              }
              return;
            }
            updateThreadMessage(
              'community',
              clientMessageId,
              (current) => ({
                ...current,
                sendState: 'failed',
                failed: true
              }),
              { scope: 'dm', roomId, rerender: true }
            );
            presentSystemToast(uiCopy.communityDmSendError || uiCopy.serverUnavailable);
          });
          return;
        }
        if (retryMessageId) {
          updateThreadMessage(
            messageMode,
            retryMessageId,
            (message) => ({
              ...message,
              failed: false
            }),
            { rerender: true }
          );
        }
        clearDraft(false);
        setHint(getDefaultHintForMode('community'));
        emitCommunityMessage({ text: userText }).then((result) => {
          if (result && result.ok && result.message) {
            const normalizedMessage = normalizeIncoming(result.message, 'user', {
              mode: 'community',
              viewerId: lastUserId || ''
            });
            if (normalizedMessage) {
              appendMessage(normalizedMessage, {
                mode: 'community',
                autoplay: false,
                scope: 'public'
              });
            }
            return;
          }
          presentSystemToast(uiCopy.communitySendError || uiCopy.serverUnavailable);
        });
        return;
      }
      if (messageMode === 'chatbot' && isChatbotDailyLimitActive()) {
        setHint(getChatbotDailyLimitHint());
        return;
      }
      if (messageMode === 'chatbot' && !isChatbotRealtimeAvailable()) {
        handleChatbotRealtimeDisconnected({ notify: true });
        return;
      }
      if (messageMode === 'catbot' || messageMode === 'chatbot') {
        awaitingBot[messageMode] = true;
      }
      removeTypingIndicator();
      if (retryMessageId) {
        updateThreadMessage(
          messageMode,
          retryMessageId,
          (message) => ({
            ...message,
            failed: false
          }),
          { rerender: true }
        );
      } else {
        appendMessage(
          {
            id: outboundMessageId,
            role: 'user',
            text: userText,
            audioUrl: payload.audioUrl || '',
            speakText: payload.audioUrl ? '' : payload.speakText || userText,
            failed: false
          },
          { mode: messageMode }
        );
      }
      setTypingState(messageMode, true);
      if (payload.audioUrl) retainedAudioUrls.push(payload.audioUrl);
      clearDraft(false);
      setHint(uiCopy.hintRecordAgain);
      if (messageMode === 'chatbot') {
        if (replyTimers.chatbot) clearTimeout(replyTimers.chatbot);
        replyTimers.chatbot = setTimeout(() => {
          if (!awaitingBot.chatbot) {
            replyTimers.chatbot = null;
            return;
          }
          replyTimers.chatbot = null;
          updateThreadMessage(
            messageMode,
            outboundMessageId,
            (message) => ({
              ...message,
              failed: true
            }),
            { rerender: true }
          );
          handleChatbotServerUnavailable();
        }, CHATBOT_REPLY_TIMEOUT_MS);
      }
      emitRealtimeMessage({ text: userText }).then((ok) => {
        if (ok) return;
        if (messageMode !== 'chatbot') return;
        if (!awaitingBot.chatbot) return;
        updateThreadMessage(
          messageMode,
          outboundMessageId,
          (message) => ({
            ...message,
            failed: true
          }),
          { rerender: true }
        );
        handleChatbotServerUnavailable();
      });
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

    const handleWindowPageHide = () => {
      if (chatMode === 'community') {
        leaveCommunityPresence({ keepalive: true, silent: true });
      }
    };

    const refreshCommunityPresenceNow = ({ silent = true } = {}) => {
      if (chatMode !== 'community' || !window.user || window.user.id === undefined || window.user.id === null) {
        return;
      }
      scheduleCommunityPresenceHeartbeat({ immediate: true });
      if (!silent) {
        updateCommunityPresenceUi();
      }
    };

    const syncCommunityStateAfterResume = async () => {
      if (chatMode !== 'community' || !window.user || window.user.id === undefined || window.user.id === null) {
        return;
      }
      refreshCommunityPresenceNow({ silent: true });
      await loadCommunityDmRooms({ force: true });
      if (communityView === 'dm' && activeCommunityDmRoomId) {
        await loadCommunityDmHistory(activeCommunityDmRoomId, { force: true });
      } else if (communityView === 'public') {
        await loadCommunityHistory({ force: true });
      }
      renderThread('community');
    };

    const handleDocumentVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      if (document.hidden) {
        sendCommunityPresence({
          action: 'heartbeat',
          keepalive: true,
          silent: true,
          contextOverride: { app_state: 'background' }
        });
        return;
      }
      syncCommunityStateAfterResume();
    };

    const previousTriggerResume = typeof window._trigger_resume === 'function' ? window._trigger_resume : null;
    const previousTriggerPause = typeof window._trigger_pause === 'function' ? window._trigger_pause : null;

    window._trigger_resume = () => {
      if (typeof previousTriggerResume === 'function') {
        previousTriggerResume();
      }
      syncCommunityStateAfterResume();
    };

    window._trigger_pause = () => {
      if (typeof previousTriggerPause === 'function') {
        previousTriggerPause();
      }
      sendCommunityPresence({
        action: 'heartbeat',
        keepalive: true,
        silent: true,
        contextOverride: { app_state: 'background' }
      });
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
    communityDmBackBtn?.addEventListener('click', () => {
      closeCommunityDmRoom();
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
    window.addEventListener('pagehide', handleWindowPageHide);
    document.addEventListener('visibilitychange', handleDocumentVisibilityChange);
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
      if (chatMode === 'community') {
        coachAvatar.hidden = true;
        return;
      }
      coachAvatar.hidden = false;
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
      } else if (chatMode === 'community') {
        if (communityView === 'dm') {
          coachTitleEl.textContent = uiCopy.coachPrivateTitle || uiCopy.communityChatsTitle;
          coachSubtitleEl.textContent = uiCopy.coachPrivateSubtitle || uiCopy.communitySelectChat;
        } else {
          coachTitleEl.textContent = uiCopy.coachCommunityTitle;
          coachSubtitleEl.textContent = uiCopy.coachCommunitySubtitle;
        }
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
        const publicBtn = modeToggle.querySelector('[data-mode="public"]');
        const privateBtn = modeToggle.querySelector('[data-mode="private"]');
        const coachBtn = modeToggle.querySelector('[data-mode="coach"]');
        if (catBtn) catBtn.textContent = uiCopy.modeCatbot;
        if (publicBtn) publicBtn.textContent = uiCopy.modePublic;
        if (privateBtn) privateBtn.textContent = uiCopy.modePrivate;
        if (coachBtn) coachBtn.textContent = uiCopy.modeCoach;
      }
      updateModeToggleUi();
      if (communityRoomsTitleEl) communityRoomsTitleEl.textContent = uiCopy.communityChatsTitle;
      if (communityOnlineTitleEl) communityOnlineTitleEl.textContent = uiCopy.communityOnlineUsersTitle;

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

      if (textInput) {
        textInput.placeholder =
          chatMode === 'community'
            ? communityView === 'dm'
              ? (activeCommunityDmRoomId
                ? (uiCopy.inputPlaceholderCommunityDm || uiCopy.inputPlaceholderCommunity)
                : uiCopy.communitySelectChat)
              : uiCopy.inputPlaceholderCommunity
            : uiCopy.inputPlaceholder;
      }

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

      defaultHint = getDefaultHintForMode(chatMode);
      if (hintEl) {
        const currentHint = String(hintEl.dataset.rawHint || hintEl.textContent || '').trim();
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
      updateCommunityPresenceUi();
      updateCommunityViewUi();
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

    const updateChatHintVisibility = () => {
      if (!hintEl) return;
      const hideHint =
        chatMode === 'community' && communityView === 'dm' && Boolean(activeCommunityDmRoomId);
      hintEl.hidden = hideHint;
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
      if (chatMode === 'community') {
        target = textRow;
      } else if (chatMode === 'chatbot') {
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
      const isCommunity = chatMode === 'community';
      if (chatControls) chatControls.hidden = isCommunity;
      if (textRow) textRow.classList.toggle('chat-text-row-inline', isChatbot || isCommunity);
      placeSendButton();
      updateSendButtonIcon();
      setTalkState(talkState);
      updateChatHintVisibility();
      updateChatbotOneLineLayout();
      scheduleChatKeyboardSync();
    };

    const updateCommunityViewUi = () => {
      const isCommunity = chatMode === 'community';
      const isCommunityDm = isCommunity && communityView === 'dm';
      const hasActiveCommunityDm = isCommunityDm && Boolean(activeCommunityDmRoomId);
      updateModeToggleUi();
      updateCommunityNavUnreadUi();
      if (communityDmBackBtn) {
        communityDmBackBtn.setAttribute('aria-label', uiCopy.communityBackToChats || uiCopy.communityTabChats);
        communityDmBackBtn.title = uiCopy.communityBackToChats || uiCopy.communityTabChats;
      }
      if (threadEl) {
        threadEl.hidden = Boolean(isCommunityDm && !hasActiveCommunityDm);
      }
      if (composerRow) {
        composerRow.hidden = Boolean(isCommunityDm && !hasActiveCommunityDm);
      }
      renderCommunityLists();
      if (textInput) {
        if (isCommunity && isCommunityDm) {
          textInput.placeholder = activeCommunityDmRoomId
            ? uiCopy.inputPlaceholderCommunityDm || uiCopy.inputPlaceholderCommunity
            : uiCopy.communitySelectChat;
        } else if (isCommunity) {
          textInput.placeholder = uiCopy.inputPlaceholderCommunity;
        }
      }
      if (textInput) {
        const disableInput = isCommunityDm && !hasActiveCommunityDm;
        textInput.disabled = disableInput;
      }
      if (sendBtn) {
        const disableSend = isCommunityDm && !hasActiveCommunityDm;
        if (disableSend) {
          sendBtn.disabled = true;
        }
      }
      updateChatHintVisibility();
    };

    const setCommunityView = (view, options = {}) => {
      const nextView = view === 'dm' ? 'dm' : 'public';
      const changed = communityView !== nextView;
      communityView = nextView;
      if (nextView === 'public') {
        setCommunityPublicUnreadCount(0);
      } else {
        syncCommunityUnreadIndicators();
      }
      if (changed && nextView === 'dm') {
        loadCommunityDmRooms({ force: !communityRoomsLoaded });
        if (activeCommunityDmRoomId) {
          loadCommunityDmHistory(activeCommunityDmRoomId, { force: false });
        }
      }
      if (chatMode === 'community') {
        refreshCommunityPresenceNow({ silent: true });
      }
      updateCoachCopy();
      updateCommunityViewUi();
      updateTextRowVisibility();
      if (options.rerender !== false && chatMode === 'community') {
        renderThread('community');
      }
      if (chatMode === 'community') {
        setHint(getDefaultHintForMode('community'));
      }
      applyControlsEnabled();
      updateDraftButtons();
    };

    const updateTextRowVisibility = (debugOverride) => {
      const isCommunityDmWithoutSelection =
        chatMode === 'community' && communityView === 'dm' && !activeCommunityDmRoomId;
      const isInlineTextMode =
        chatMode === 'chatbot' || (chatMode === 'community' && !isCommunityDmWithoutSelection);
      const collapsed = chatMode === 'chatbot' && talkState !== TALK_STATE_IDLE;
      if (textRow) {
        textRow.hidden = !isInlineTextMode;
        textRow.classList.toggle('is-collapsed', collapsed);
        textRow.classList.toggle('chat-text-row-inline', isInlineTextMode);
      }
      if (!isInlineTextMode && textInput) {
        textInput.value = '';
      }
      if (textInput) {
        textInput.placeholder =
          chatMode === 'community'
            ? communityView === 'dm'
              ? (activeCommunityDmRoomId
                ? (uiCopy.inputPlaceholderCommunityDm || uiCopy.inputPlaceholderCommunity)
                : uiCopy.communitySelectChat)
              : uiCopy.inputPlaceholderCommunity
            : uiCopy.inputPlaceholder;
      }
      updateCommunityPresenceUi();
      updateCommunityViewUi();
      updateChatbotOneLineLayout();
      scheduleChatKeyboardSync();
    };

    const setSurfaceChatMode = (mode, options = {}) => {
      const target = String(mode || '').trim().toLowerCase();
      if (target === 'coach') {
        setChatMode('chatbot', options);
        return;
      }
      if (target === 'public' || target === 'private') {
        const targetView = target === 'private' ? 'dm' : 'public';
        const isAlreadyCommunity = chatMode === 'community';
        if (communityView !== targetView) {
          setCommunityView(targetView, { rerender: isAlreadyCommunity });
        }
        if (!isAlreadyCommunity) {
          setChatMode('community', options);
        } else if (options.persist !== false) {
          writeDebugChatMode('community');
          updateModeToggleUi();
        }
        return;
      }
      if (target === 'catbot') {
        if (!isCatbotFeatureEnabled()) {
          setSurfaceChatMode('public', options);
          return;
        }
        setChatMode('catbot', options);
      }
    };

    const setChatMode = (mode, { reconnect, persist } = {}) => {
      const normalizedMode = mode === 'catbot' && !isCatbotFeatureEnabled() ? 'community' : mode;
      if (normalizedMode !== 'catbot' && normalizedMode !== 'chatbot' && normalizedMode !== 'community') return;
      if (chatMode === normalizedMode) return;
      const previousMode = chatMode;
      stopPlayback();
      chatMode = normalizedMode;
      defaultHint = getDefaultHintForMode(normalizedMode);
      if (persist !== false) {
        writeDebugChatMode(normalizedMode);
      }
      updateModeToggleUi();
      updateCoachAvatar();
      updateCoachCopy();
      updateChatControlsVisibility();
      updateTextRowVisibility();
      updateCommunityViewUi();
      renderThread(chatMode);
      ensureIntroMessage(chatMode);
      if (reconnect && lastChatEnabled && window.user) {
        disconnectRealtime();
        connectRealtime(window.user);
      }
      if (normalizedMode === 'community' && lastChatEnabled && window.user) {
        loadCommunityHistory({ force: true });
        if (communityView === 'dm') {
          loadCommunityDmRooms({ force: false });
          if (activeCommunityDmRoomId) {
            loadCommunityDmHistory(activeCommunityDmRoomId, { force: false });
          }
        }
        scheduleCommunityPresenceHeartbeat({ immediate: true });
      } else {
        if (previousMode === 'community') {
          leaveCommunityPresence({ keepalive: true, silent: true });
        }
        clearCommunityPresenceHeartbeat();
      }
      if (normalizedMode === 'community' && (!window.user || window.user.id === undefined || window.user.id === null)) {
        setHint(uiCopy.loginRequired);
      }
      applyControlsEnabled();
      updateDraftButtons();
    };

    const applyCatbotFeatureState = (enabled) => {
      catbotFeatureEnabled = normalizeCatbotFeatureEnabled(enabled);
      window.r34lp0w3r = window.r34lp0w3r || {};
      window.r34lp0w3r.chatCatbotEnabled = catbotFeatureEnabled;
      updateModeToggleUi();
      if (!catbotFeatureEnabled && chatMode === 'catbot') {
        setSurfaceChatMode('public', { reconnect: true, persist: true });
        return;
      }
      updateCommunityViewUi();
      updateTextRowVisibility();
    };

    const applyDebugMode = () => {
      const debug = Boolean(window.r34lp0w3r && window.r34lp0w3r.speakDebug);
      const showModeToggle = debug || CHAT_MODE_TOGGLE_ALWAYS_VISIBLE_FOR_TESTING;
      if (modeToggle) modeToggle.hidden = !showModeToggle;
      if (!showModeToggle) {
        if (textInput) textInput.value = '';
        updateTextRowVisibility(false);
        setSurfaceChatMode(isCatbotFeatureEnabled() ? 'catbot' : 'public', { reconnect: true, persist: false });
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
      setSurfaceChatMode(mode, { reconnect: true });
    });

    catbotFeatureEnabled = getStoredCatbotFeatureEnabled();
    window.r34lp0w3r = window.r34lp0w3r || {};
    window.r34lp0w3r.chatCatbotEnabled = catbotFeatureEnabled;
    applyLocaleCopy(uiLocale, { force: true, rerenderThread: false });
    this._localeHandler = (event) => {
      const nextLocale = event && event.detail ? event.detail.locale : '';
      applyLocaleCopy(nextLocale, { rerenderThread: true });
    };
    window.addEventListener('app:locale-change', this._localeHandler);

    this._debugHandler = applyDebugMode;
    window.addEventListener('app:speak-debug', this._debugHandler);
    this._catbotToggleHandler = (event) => {
      const nextEnabled =
        event && event.detail && event.detail.enabled !== undefined
          ? Boolean(event.detail.enabled)
          : getStoredCatbotFeatureEnabled();
      applyCatbotFeatureState(nextEnabled);
    };
    window.addEventListener('app:chat-catbot-enabled-change', this._catbotToggleHandler);
    applyDebugMode();
    updateCoachAvatar();
    updateCoachCopy();
    updateChatControlsVisibility();

    this._talkResetHandler = () => {
      resetChatSession({ keepIntro: true, setDefaultHint: true });
      renderThread(chatMode);
    };
    window.addEventListener('app:talk-timelines-reset', this._talkResetHandler);

    this._tabChangeHandler = (event) => {
      const tab = event && event.detail ? String(event.detail.tab || '').trim().toLowerCase() : '';
      currentAppTab = tab || currentAppTab;
      syncCommunityUnreadStateForCurrentView();
      if (chatMode === 'community') {
        refreshCommunityPresenceNow({ silent: true });
      }
      if (tab !== 'chat') return;
      scrollChatTimelineToLatest('auto');
    };
    window.addEventListener('app:tab-change', this._tabChangeHandler);

    this._tabUserClickHandler = (event) => {
      const tab = event && event.detail ? String(event.detail.tab || '').trim().toLowerCase() : '';
      currentAppTab = tab || currentAppTab;
      syncCommunityUnreadStateForCurrentView();
      if (chatMode === 'community') {
        refreshCommunityPresenceNow({ silent: true });
      }
      if (tab !== 'chat') return;
      scrollChatTimelineToLatest('auto');
    };
    window.addEventListener('app:tab-user-click', this._tabUserClickHandler);

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
      window.removeEventListener('pagehide', handleWindowPageHide);
      document.removeEventListener('visibilitychange', handleDocumentVisibilityChange);
      threadEl?.removeEventListener('scroll', updateChatAutoScroll);
      window._trigger_resume = previousTriggerResume || null;
      window._trigger_pause = previousTriggerPause || null;
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
    if (this._catbotToggleHandler) {
      window.removeEventListener('app:chat-catbot-enabled-change', this._catbotToggleHandler);
    }
    if (this._localeHandler) {
      window.removeEventListener('app:locale-change', this._localeHandler);
    }
    if (this._talkResetHandler) {
      window.removeEventListener('app:talk-timelines-reset', this._talkResetHandler);
    }
    if (this._tabChangeHandler) {
      window.removeEventListener('app:tab-change', this._tabChangeHandler);
    }
    if (this._tabUserClickHandler) {
      window.removeEventListener('app:tab-user-click', this._tabUserClickHandler);
    }
  }
}

if (!customElements.get('page-chat')) {
  customElements.define('page-chat', PageChat);
}
