class PagePremium extends HTMLElement {
  connectedCallback() {
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
            <div class="app-user-info" id="premium-user-info" hidden>
              <img class="app-user-avatar" id="premium-user-avatar" alt="Avatar">
              <span class="app-user-name" id="premium-user-name"></span>
            </div>
            <div class="reward-badges" id="premium-reward-badges"></div>
            <ion-button fill="clear" size="small" class="app-notify-btn">
              <ion-icon slot="icon-only" name="notifications-outline"></ion-icon>
            </ion-button>
            <ion-button fill="clear" size="small" class="app-logout-btn" id="premium-logout-btn" hidden>
              <ion-icon slot="icon-only" name="log-out-outline"></ion-icon>
            </ion-button>
          </div>
        </ion-toolbar>
      </ion-header>
      <ion-content fullscreen class="secret-content" scroll-y="false">
        <div class="page-shell">
          <div class="card premium-chat-card">
            <div class="premium-card-header">
              <div>
                <div class="chat-mode-toggle" id="premium-mode-toggle" hidden>
                  <button type="button" class="chat-mode-btn is-active" data-mode="catbot">Catbot</button>
                  <button type="button" class="chat-mode-btn" data-mode="chatbot">Chatbot</button>
                </div>
                <h3 id="premium-coach-title">Coach de pronunciacion</h3>
                <p class="muted" id="premium-coach-subtitle">
                  Graba tu frase, escucha tu audio y recibe una respuesta simulada.
                </p>
              </div>
              <div class="coach-avatar coach-avatar-cat" id="premium-coach-avatar" aria-label="Coach"></div>
            </div>
            <div class="premium-access" id="premium-access">
              <div class="premium-access-panel premium-loading-panel" id="premium-loading-panel" hidden>
                <ion-spinner name="dots"></ion-spinner>
                <span>Cargando estado de usuario...</span>
              </div>
              <div class="premium-access-panel" id="premium-login-panel" hidden>
                <p>Debes iniciar sesion para usar el coach premium.</p>
                <button class="chat-btn chat-btn-send premium-login-btn" id="premium-login-btn" type="button">
                  <ion-icon name="log-in"></ion-icon>
                  <span>Iniciar sesion</span>
                </button>
              </div>
              <div class="premium-access-panel" id="premium-locked-panel" hidden>
                <p>Tu plan no incluye el coach premium.</p>
                <p class="muted">Actualiza tu plan para desbloquear esta funcionalidad.</p>
              </div>
            </div>
            <div class="chat-panel" id="premium-chat-panel">
              <div class="chat-thread" id="premium-chat-thread" role="log" aria-live="polite" aria-relevant="additions"></div>
              <div class="chat-composer-row" id="premium-composer-row">
                <div class="chat-text-row" id="premium-text-row" hidden>
                  <input
                    type="text"
                    id="premium-text-input"
                    class="chat-text-input"
                    placeholder="Escribe tu mensaje..."
                    autocomplete="off"
                    enterkeyhint="send"
                  />
                </div>
                <div class="chat-controls talk-controls" id="premium-chat-controls">
                  <button class="chat-btn chat-btn-record talk-record-btn" id="premium-record-btn" type="button" aria-pressed="false" aria-label="Grabar">
                    <ion-icon name="mic"></ion-icon>
                    <span>Grabar</span>
                  </button>
                  <div class="talk-recording" id="premium-recording-ui" hidden>
                    <div class="talk-wave talk-wave-recording" id="premium-recording-wave">
                      ${waveBarsMarkup}
                    </div>
                    <div class="talk-timer" id="premium-recording-timer">0:00</div>
                    <button class="talk-icon-btn talk-stop-btn" id="premium-stop-btn" type="button" aria-label="Detener">
                      <ion-icon name="stop"></ion-icon>
                    </button>
                  </div>
                  <div class="talk-review" id="premium-review-ui" hidden>
                    <button class="talk-icon-btn talk-cancel-btn" id="premium-cancel-btn" type="button" aria-label="Cancelar">
                      <ion-icon name="close"></ion-icon>
                    </button>
                    <button class="chat-btn talk-play-btn" id="premium-preview-btn" type="button" aria-label="Reproducir" disabled>
                      <ion-icon name="play"></ion-icon>
                      <span>Escuchar</span>
                    </button>
                    <div class="talk-wave talk-wave-review" id="premium-review-wave">
                      ${waveBarsMarkup}
                    </div>
                    <div class="talk-timer talk-timer-review" id="premium-review-timer">0:00</div>
                    <button class="chat-btn chat-btn-send talk-send-btn" id="premium-send-btn" type="button" aria-label="Enviar" disabled>
                      <ion-icon name="arrow-up"></ion-icon>
                      <span>Enviar</span>
                    </button>
                  </div>
                </div>
              </div>
              <div class="chat-hint" id="premium-chat-hint">Pulsa "Grabar" y luego "Detener" para crear tu frase.</div>
            </div>
          </div>
        </div>
      </ion-content>
    `;

    const contentEl = this.querySelector('ion-content.secret-content');
    const threadEl = this.querySelector('#premium-chat-thread');
    const chatPanel = this.querySelector('#premium-chat-panel');
    const accessPanel = this.querySelector('#premium-access');
    const loginPanel = this.querySelector('#premium-login-panel');
    const lockedPanel = this.querySelector('#premium-locked-panel');
    const loadingPanel = this.querySelector('#premium-loading-panel');
    const userInfoEl = this.querySelector('#premium-user-info');
    const userAvatarEl = this.querySelector('#premium-user-avatar');
    const userNameEl = this.querySelector('#premium-user-name');
    const rewardsEl = this.querySelector('#premium-reward-badges');
    const logoutBtn = this.querySelector('#premium-logout-btn');
    const recordBtn = this.querySelector('#premium-record-btn');
    const previewBtn = this.querySelector('#premium-preview-btn');
    const sendBtn = this.querySelector('#premium-send-btn');
    const chatControls = this.querySelector('#premium-chat-controls');
    const recordingUi = this.querySelector('#premium-recording-ui');
    const recordingWave = this.querySelector('#premium-recording-wave');
    const recordingTimerEl = this.querySelector('#premium-recording-timer');
    const stopBtn = this.querySelector('#premium-stop-btn');
    const reviewUi = this.querySelector('#premium-review-ui');
    const reviewWave = this.querySelector('#premium-review-wave');
    const reviewTimerEl = this.querySelector('#premium-review-timer');
    const cancelBtn = this.querySelector('#premium-cancel-btn');
    const hintEl = this.querySelector('#premium-chat-hint');
    const loginBtn = this.querySelector('#premium-login-btn');
    const modeToggle = this.querySelector('#premium-mode-toggle');
    const coachAvatar = this.querySelector('#premium-coach-avatar');
    const coachTitleEl = this.querySelector('#premium-coach-title');
    const coachSubtitleEl = this.querySelector('#premium-coach-subtitle');
    const composerRow = this.querySelector('#premium-composer-row');
    const textRow = this.querySelector('#premium-text-row');
    const textInput = this.querySelector('#premium-text-input');
    const defaultHint = hintEl ? hintEl.textContent : '';

    const sampleTranscripts = [
      'I would like to order a coffee, please.',
      'Can you help me find the train station?',
      'I am practicing my pronunciation today.',
      'Could you repeat that a little slower?',
      'I have a meeting at three o clock.',
      'What do you recommend for dinner?'
    ];

    const botTemplates = [
      (text) => `Nice! Try stressing the key words: "${text}"`,
      (text) => `Good job. Now say it a bit slower: "${text}"`,
      (text) => `Great start. Focus on linking the words: "${text}"`,
      (text) => `Try this version with a softer "t": "${text}"`,
      (text) => `Let's repeat with clear vowel sounds: "${text}"`
    ];

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
    let lastPremium = false;
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
    const RECORDING_TIMESLICE = 500;
    const VOSK_SAMPLE_RATE_DEFAULT = 16000;
    const TALK_STORAGE_PREFIX = 'appv5:talk-timelines:';
    const TALK_STORAGE_LEGACY = 'appv5:talk-timelines';
    const CHAT_MODE_DEBUG_KEY = 'appv5:premium-debug-chat-mode';
    let talkStorageKey = `${TALK_STORAGE_PREFIX}anon`;
    const replyTimers = { catbot: null, chatbot: null };
    const awaitingBot = { catbot: false, chatbot: false };
    const typingState = { catbot: false, chatbot: false };
    const chatThreads = { catbot: [], chatbot: [] };
    let talkState = TALK_STATE_IDLE;
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

    const getPremiumOverride = () => {
      if (window.r34lp0w3r && window.r34lp0w3r.premiumOverride === true) {
        return true;
      }
      try {
        const raw = localStorage.getItem('appv5:premium-override');
        if (raw === '1') {
          window.r34lp0w3r = window.r34lp0w3r || {};
          window.r34lp0w3r.premiumOverride = true;
          return true;
        }
        if (raw === '0') {
          localStorage.removeItem('appv5:premium-override');
        }
      } catch (err) {
        // no-op
      }
      return null;
    };

    const isPremiumUser = (user) => {
      const override = getPremiumOverride();
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

    const tokenFmt = new Intl.NumberFormat('es-ES');

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
        return `Limite diario alcanzado: ${tokenFmt.format(used)} / ${tokenFmt.format(limit)} tokens. Vuelve manana.`;
      }
      return 'Limite diario del chatbot alcanzado. Vuelve manana.';
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

    let premiumKeyboardOffset = 0;
    let premiumKeyboardRaf = null;
    let premiumKeyboardOpen = false;
    let premiumKeyboardResized = false;
    let premiumViewportBaseHeight = 0;
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

    const setPremiumKeyboardState = (open, resized) => {
      const nextOpen = Boolean(open);
      const nextResized = nextOpen && Boolean(resized);
      const changed = premiumKeyboardOpen !== nextOpen || premiumKeyboardResized !== nextResized;
      premiumKeyboardOpen = nextOpen;
      premiumKeyboardResized = nextResized;
      this.classList.toggle('chat-keyboard-open', nextOpen);
      this.classList.toggle('chat-keyboard-resized', nextResized);
      return changed;
    };

    const setPremiumKeyboardOffset = (value) => {
      const next = Math.max(0, Math.round(value || 0));
      if (premiumKeyboardOffset === next) return;
      premiumKeyboardOffset = next;
      this.style.setProperty('--premium-keyboard-offset', `${next}px`);
    };

    const clearThreadViewportClamp = () => {
      if (!threadEl) return;
      threadEl.style.maxHeight = '';
      threadEl.style.minHeight = '';
    };

    const applyThreadViewportClamp = () => {
      if (!threadEl || !chatPanel) return;
      if (!isChatInputActive() || !premiumKeyboardOpen) {
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

    const getPremiumKeyboardOffset = () => {
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

    const syncPremiumKeyboardOffset = () => {
      const visibleBottom = getVisibleViewportBottom();
      if (!isChatInputActive()) {
        setPremiumKeyboardOffset(0);
        setPremiumKeyboardState(false, false);
        clearThreadViewportClamp();
        if (visibleBottom > 0) {
          premiumViewportBaseHeight = visibleBottom;
        }
        return;
      }
      if (visibleBottom > 0 && (!premiumViewportBaseHeight || visibleBottom > premiumViewportBaseHeight)) {
        premiumViewportBaseHeight = visibleBottom;
      }
      const wasKeyboardOpen = premiumKeyboardOpen;
      const previousOffset = premiumKeyboardOffset;
      const offset = getPremiumKeyboardOffset();
      const resizeDelta = Math.max(0, premiumViewportBaseHeight - visibleBottom);
      const inputFocused = Boolean(textInput && document.activeElement === textInput);
      const nativeFocusedKeyboard = (isIOSPlatform() || isAndroidPlatform()) && inputFocused;
      const resizedKeyboardOpen =
        offset <= KEYBOARD_OFFSET_EPSILON && resizeDelta > KEYBOARD_RESIZE_THRESHOLD;
      const keyboardOpen = offset > KEYBOARD_OFFSET_EPSILON || resizedKeyboardOpen || nativeFocusedKeyboard;
      setPremiumKeyboardOffset(offset > KEYBOARD_OFFSET_EPSILON ? offset : 0);
      setPremiumKeyboardState(keyboardOpen, resizedKeyboardOpen);
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

    const schedulePremiumKeyboardSync = () => {
      if (premiumKeyboardRaf) cancelAnimationFrame(premiumKeyboardRaf);
      premiumKeyboardRaf = requestAnimationFrame(() => {
        premiumKeyboardRaf = null;
        syncPremiumKeyboardOffset();
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
      setHint('Cargando estado de usuario...');
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
      const label = simulated ? 'Transcripcion simulada' : 'Transcripcion lista';
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

    const pickTranscript = () =>
      sampleTranscripts[Math.floor(Math.random() * sampleTranscripts.length)];

    const pickBotReply = (text) =>
      botTemplates[Math.floor(Math.random() * botTemplates.length)](text);

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
        setHint(`Escuchando: "${preview}"`);
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
          notice = 'Transcripcion real no disponible.';
        } else if (speechFailed) {
          notice = 'No se pudo transcribir.';
        } else {
          notice = 'Transcripcion simulada.';
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
        console.warn('[premium] speech recognition error', event);
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
        console.warn('[premium] speech recognition start error', err);
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
        console.warn('[premium] speech recognition stop error', err);
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
        console.warn('[premium] speech recognition abort error', err);
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

    const playAudioUrl = (url) => {
      if (!url) return false;
      stopPlayback();
      const audio = new Audio(url);
      activeAudio = audio;
      audio.play().catch((err) => {
        console.warn('[premium] audio play error', err);
      });
      audio.onended = () => {
        if (activeAudio === audio) activeAudio = null;
      };
      return true;
    };

    const playSpeechWeb = (text, options = {}) => {
      const { onEnd, onError, skipStop = false } = options;
      if (!text || !canSpeak()) return false;
      if (!skipStop) {
        stopPlayback();
      }
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'en-US';
      utter.onend = () => {
        if (typeof onEnd === 'function') onEnd();
      };
      utter.onerror = (err) => {
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
            if (typeof onEnd === 'function') onEnd();
          })
          .catch((err) => {
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
        const audio = new Audio(audioUrl);
        activeAudio = audio;
        previewAudio = audio;
        setPreviewPlaying(true);
        audio.play().catch((err) => {
          console.warn('[premium] audio play error', err);
          if (previewAudio === audio) {
            previewAudio = null;
            setPreviewPlaying(false);
          }
        });
        audio.onended = () => {
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

    const playMessageAudio = ({ audioUrl, speakText }) => {
      if (audioUrl && playAudioUrl(audioUrl)) return;
      playSpeech(speakText);
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
        ? 'Hi!, i am your English teacher, how can i help you?'
        : 'Hi! Record a phrase in English and I will answer with a suggestion.';

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
        playBtn.innerHTML = `<ion-icon name="play"></ion-icon><span>${role === 'user' ? 'Escuchar' : 'Repetir'}</span>`;
        if (!audioUrl && !speakText) {
          playBtn.disabled = true;
        }
        playBtn.addEventListener('pointerdown', (event) => {
          if (!isChatInputActive()) return;
          event.preventDefault();
          keepChatInputFocused({ scroll: true });
        });
        playBtn.addEventListener('click', () => playMessageAudio({ audioUrl, speakText }));
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
      msgEl.setAttribute('aria-label', 'Escribiendo...');
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
          playMessageAudio({ audioUrl: normalizedAudioUrl, speakText: normalizedSpeakText });
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
        setHint('No se detecto audio. Pulsa "Grabar" para intentarlo de nuevo.');
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
          notice: 'Microfono no disponible.'
        });
        return;
      }
      try {
        recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        console.warn('[premium] getUserMedia error', err);
        const transcript = pickTranscript();
        setDraft({
          transcript,
          audioUrl: '',
          speakText: transcript,
          simulated: true,
          notice: 'No se pudo acceder al microfono.'
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
        setHint('Grabando... habla en ingles y pulsa "Detener".');
      } else if (!canTranscribe()) {
        setHint('Grabando... pulsa "Detener" (transcripcion simulada).');
      } else {
        setHint('Grabando... pulsa "Detener" cuando termines.');
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
      setHint(transcribing ? 'Transcribiendo...' : 'Procesando audio...');
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
        console.warn('[premium] realtime key missing');
        return;
      }
      if (typeof window.Pusher !== 'function') {
        console.warn('[premium] Pusher no disponible');
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
        console.warn('[premium] pusher error', err);
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
        console.warn('[premium] subscription error', status);
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
        console.warn('[premium] emit error', err);
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
      const premium = loggedIn && isPremiumUser(user);
      const userChanged = userId !== lastUserId;
      const premiumChanged = premium !== lastPremium;
      const isInitialLoad = lastUserId === null;
      const hasStoredMessages = chatThreads.catbot.length > 0 || chatThreads.chatbot.length > 0;

      updateUserHeader(user, loggedIn);

      if (loginPanel) loginPanel.hidden = loggedIn;
      if (lockedPanel) lockedPanel.hidden = !loggedIn || premium;
      if (accessPanel) accessPanel.hidden = premium;
      if (chatPanel) chatPanel.hidden = !premium;

      if (userChanged) {
        setChatbotDailyLimitBlocked(false);
        loadTalkTimelinesForUser(userId);
        clearThread();
      }

      if (!premium) {
        setChatbotDailyLimitBlocked(false);
        if (userChanged || premiumChanged) {
          resetChatSession({ keepIntro: false, setDefaultHint: false, keepTimeline: true });
        }
        setControlsEnabled(false);
        disconnectRealtime();
      } else {
        if (userChanged || premiumChanged) {
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
      lastPremium = premium;
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
      setHint('Puedes grabar otra frase cuando quieras.');
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
      if (target && target.closest && target.closest('#premium-text-row')) return;
      event.preventDefault();
      keepChatInputFocused({ scroll: true });
    };

    const handleChatPanelPointerDown = (event) => {
      if (!isChatInputActive()) return;
      const target = event.target;
      if (target && target.closest && (
        target.closest('#premium-text-row') ||
        target.closest('#premium-chat-controls') ||
        target.closest('#premium-composer-row') ||
        target.closest('#premium-chat-thread')
      )) {
        return;
      }
      if (textInput && document.activeElement === textInput) {
        textInput.blur();
      }
    };

    const handleViewportChange = () => {
      schedulePremiumKeyboardSync();
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
      schedulePremiumKeyboardSync();
      scheduleScrollThreadToBottom('auto');
    });

    textInput?.addEventListener('blur', () => {
      schedulePremiumKeyboardSync();
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
        console.error('[premium] error abriendo login', err);
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
    this._premiumOverrideHandler = () => updateAccessState(window.user);
    window.addEventListener('app:premium-override', this._premiumOverrideHandler);
    this._rewardsHandler = () => updateHeaderRewards();
    window.addEventListener('app:speak-stores-change', this._rewardsHandler);

    const updateCoachAvatar = () => {
      if (!coachAvatar) return;
      if (chatMode === 'chatbot') {
        coachAvatar.textContent = '';
        coachAvatar.classList.remove('coach-avatar-cat');
        coachAvatar.classList.add('coach-avatar-bot');
      } else {
        coachAvatar.textContent = '';
        coachAvatar.classList.remove('coach-avatar-bot');
        coachAvatar.classList.add('coach-avatar-cat');
      }
    };

    const updateCoachCopy = () => {
      if (!coachTitleEl || !coachSubtitleEl) return;
      if (chatMode === 'chatbot') {
        coachTitleEl.textContent = 'Coach de IA';
        coachSubtitleEl.textContent = 'Interactua libremente con el tutor de Ingles.';
      } else {
        coachTitleEl.textContent = 'Coach de pronunciacion';
        coachSubtitleEl.textContent =
          'Graba tu frase, escucha tu audio y recibe una respuesta simulada.';
      }
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
      this.classList.toggle('premium-chatbot-one-line', isOneLine);
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
      schedulePremiumKeyboardSync();
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
      schedulePremiumKeyboardSync();
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
      if (reconnect && lastPremium && window.user) {
        disconnectRealtime();
        connectRealtime(window.user);
      }
      applyControlsEnabled();
      updateDraftButtons();
    };

    const applyDebugMode = () => {
      const debug = Boolean(window.r34lp0w3r && window.r34lp0w3r.speakDebug);
      if (modeToggle) modeToggle.hidden = !debug;
      if (!debug) {
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

    this._cleanupPremiumChat = () => {
      resetChatSession({ keepIntro: false, setDefaultHint: false });
      disconnectRealtime();
      if (accessLoadingTimer) {
        clearTimeout(accessLoadingTimer);
        accessLoadingTimer = null;
      }
      if (premiumKeyboardRaf) {
        cancelAnimationFrame(premiumKeyboardRaf);
        premiumKeyboardRaf = null;
      }
      if (scrollToBottomTimer) {
        clearTimeout(scrollToBottomTimer);
        scrollToBottomTimer = null;
      }
      if (keyboardOpenScrollTimer) {
        clearTimeout(keyboardOpenScrollTimer);
        keyboardOpenScrollTimer = null;
      }
      setPremiumKeyboardOffset(0);
      setPremiumKeyboardState(false, false);
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
    if (this._cleanupPremiumChat) {
      this._cleanupPremiumChat();
    }
    if (this._userHandler) {
      window.removeEventListener('app:user-change', this._userHandler);
    }
    if (this._premiumOverrideHandler) {
      window.removeEventListener('app:premium-override', this._premiumOverrideHandler);
    }
    if (this._rewardsHandler) {
      window.removeEventListener('app:speak-stores-change', this._rewardsHandler);
    }
    if (this._debugHandler) {
      window.removeEventListener('app:speak-debug', this._debugHandler);
    }
    if (this._talkResetHandler) {
      window.removeEventListener('app:talk-timelines-reset', this._talkResetHandler);
    }
  }
}

customElements.define('page-premium', PagePremium);
