class PagePremium extends HTMLElement {
  connectedCallback() {
    this.classList.add('ion-page');
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
      <ion-content fullscreen class="secret-content">
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
              <div class="chat-text-row" id="premium-text-row" hidden>
                <input
                  type="text"
                  id="premium-text-input"
                  class="chat-text-input"
                  placeholder="Escribe tu mensaje..."
                  autocomplete="off"
                />
              </div>
              <div class="chat-controls" id="premium-chat-controls">
                <button class="chat-btn chat-btn-record" id="premium-record-btn" type="button" aria-pressed="false">
                  <ion-icon name="mic"></ion-icon>
                  <span>Grabar</span>
                </button>
                <button class="chat-btn" id="premium-preview-btn" type="button" disabled>
                  <ion-icon name="play"></ion-icon>
                  <span>Escuchar</span>
                </button>
                <button class="chat-btn chat-btn-send" id="premium-send-btn" type="button" disabled>
                  <ion-icon name="paper-plane"></ion-icon>
                  <span>Enviar</span>
                </button>
              </div>
              <div class="chat-hint" id="premium-chat-hint">Pulsa "Grabar" y luego "Detener" para crear tu frase.</div>
            </div>
          </div>
        </div>
      </ion-content>
    `;

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
    const hintEl = this.querySelector('#premium-chat-hint');
    const loginBtn = this.querySelector('#premium-login-btn');
    const modeToggle = this.querySelector('#premium-mode-toggle');
    const coachAvatar = this.querySelector('#premium-coach-avatar');
    const coachTitleEl = this.querySelector('#premium-coach-title');
    const coachSubtitleEl = this.querySelector('#premium-coach-subtitle');
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
    const retainedAudioUrls = [];
    let speechRecognizer = null;
    let speechTranscript = '';
    let speechInterim = '';
    let speechFailed = false;
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
    let chatMode = 'catbot';
    const TALK_STORAGE_PREFIX = 'appv5:talk-timelines:';
    const TALK_STORAGE_LEGACY = 'appv5:talk-timelines';
    let talkStorageKey = `${TALK_STORAGE_PREFIX}anon`;
    const replyTimers = { catbot: null, chatbot: null };
    const awaitingBot = { catbot: false, chatbot: false };
    const chatThreads = { catbot: [], chatbot: [] };

    const canSpeak = () =>
      typeof window !== 'undefined' &&
      typeof window.speechSynthesis !== 'undefined' &&
      typeof window.SpeechSynthesisUtterance !== 'undefined';

    const canRecord = () =>
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      typeof MediaRecorder !== 'undefined';

    const getSpeechRecognition = () =>
      window.SpeechRecognition || window.webkitSpeechRecognition;

    const canTranscribe = () => typeof getSpeechRecognition() === 'function';

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

    const normalizeIncoming = (data, fallbackRole) => {
      if (!data) return null;
      if (typeof data === 'string') {
        return { role: fallbackRole, text: data, audioUrl: '', speakText: data };
      }
      if (typeof data !== 'object') return null;
      const text = data.text || data.message || data.body || data.content;
      if (!text) return null;
      const role = normalizeRole(data.role || data.sender || data.from, fallbackRole);
      const audioUrl = data.audio_url || data.audioUrl || '';
      const speakText = data.speakText || data.speak_text || text;
      return { role, text, audioUrl, speakText };
    };

    const isPremiumUser = (user) => {
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

    const setRecordButton = (recording) => {
      isRecording = recording;
      if (!recordBtn) return;
      recordBtn.classList.toggle('is-recording', recording);
      recordBtn.setAttribute('aria-pressed', recording ? 'true' : 'false');
      recordBtn.innerHTML = recording
        ? '<ion-icon name="stop"></ion-icon><span>Detener</span>'
        : '<ion-icon name="mic"></ion-icon><span>Grabar</span>';
    };

    const updateDraftButtons = () => {
      if (!previewBtn || !sendBtn) return;
      const typedText = textInput ? textInput.value.trim() : '';
      const hasTranscript = Boolean(draftTranscript) || Boolean(typedText);
      const hasPlayback =
        Boolean(draftAudioUrl) ||
        (Boolean(draftSpeakText) && canSpeak()) ||
        (Boolean(typedText) && canSpeak());
      previewBtn.disabled = !hasTranscript || !hasPlayback;
      sendBtn.disabled = !hasTranscript;
    };

    const setControlsEnabled = (enabled) => {
      if (recordBtn) recordBtn.disabled = !enabled;
      if (!enabled) {
        if (previewBtn) previewBtn.disabled = true;
        if (sendBtn) sendBtn.disabled = true;
        if (textInput) textInput.disabled = true;
      } else {
        if (textInput) textInput.disabled = false;
        updateDraftButtons();
      }
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
      const label = simulated ? 'Transcripcion simulada' : 'Transcripcion lista';
      const hintText = notice ? `${notice} ${label}: "${transcript}"` : `${label}: "${transcript}"`;
      setHint(hintText);
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

    const updateSpeechHint = () => {
      if (!isRecording) return;
      const preview = `${speechTranscript} ${speechInterim}`.trim();
      if (preview) {
        setHint(`Escuchando: "${preview}"`);
      }
    };

    const finalizePendingDraft = (forceSimulated) => {
      if (!pendingAudioUrl) return;
      const transcript = forceSimulated ? '' : (speechTranscript || speechInterim);
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
      if (!speechRecognizer) return;
      try {
        speechRecognizer.stop();
      } catch (err) {
        console.warn('[premium] speech recognition stop error', err);
      }
    };

    const abortSpeechRecognition = () => {
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
      setRecordButton(false);
    };

    const stopPlayback = () => {
      if (activeAudio) {
        activeAudio.pause();
        activeAudio.currentTime = 0;
        activeAudio = null;
      }
      if (canSpeak()) {
        window.speechSynthesis.cancel();
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

    const playSpeech = (text) => {
      if (!text || !canSpeak()) return false;
      stopPlayback();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'en-US';
      window.speechSynthesis.speak(utter);
      return true;
    };

    const playMessageAudio = ({ audioUrl, speakText }) => {
      if (audioUrl && playAudioUrl(audioUrl)) return;
      playSpeech(speakText);
    };

    const resolveTalkStorageKey = (userId) =>
      `${TALK_STORAGE_PREFIX}${userId ? String(userId) : 'anon'}`;

    const sanitizeTalkMessage = (message) => {
      if (!message || typeof message !== 'object') return null;
      const role = message.role === 'bot' ? 'bot' : 'user';
      const text = typeof message.text === 'string' ? message.text.trim() : '';
      if (!text) return null;
      const speakText =
        typeof message.speakText === 'string' && message.speakText.trim()
          ? message.speakText.trim()
          : text;
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

      if (mode !== 'chatbot') {
        const actionEl = document.createElement('div');
        actionEl.className = 'chat-bubble-actions';
        const playBtn = document.createElement('button');
        playBtn.type = 'button';
        playBtn.className = 'chat-audio-btn';
        playBtn.innerHTML = `<ion-icon name="play"></ion-icon><span>${role === 'user' ? 'Escuchar' : 'Repetir'}</span>`;
        if (!audioUrl && !speakText) {
          playBtn.disabled = true;
        }
        playBtn.addEventListener('click', () => playMessageAudio({ audioUrl, speakText }));
        actionEl.appendChild(playBtn);
        bubbleEl.appendChild(actionEl);
      }

      msgEl.appendChild(bubbleEl);
      threadEl.appendChild(msgEl);
      threadEl.scrollTop = threadEl.scrollHeight;
    };

    const clearThread = () => {
      if (!threadEl) return;
      threadEl.innerHTML = '';
    };

    const renderThread = (mode) => {
      if (!threadEl) return;
      clearThread();
      const thread = getThread(mode);
      thread.forEach((message) => renderMessage(message, mode));
      threadEl.scrollTop = threadEl.scrollHeight;
    };

    const appendMessage = ({ role, text, audioUrl, speakText }, options = {}) => {
      const targetMode = options.mode || chatMode;
      const thread = getThread(targetMode);
      const message = { role, text, audioUrl, speakText };
      thread.push(message);
      persistTalkTimelines();
      if (targetMode === chatMode) {
        renderMessage(message, targetMode);
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
        return;
      }
      const blob = new Blob(recordedChunks, { type: mimeType || 'audio/webm' });
      const url = URL.createObjectURL(blob);
      pendingAudioUrl = url;
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
        const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'];
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
      };
      mediaRecorder.start();
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
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      stopSpeechRecognition();
      if (recordingStream) {
        recordingStream.getTracks().forEach((track) => track.stop());
        recordingStream = null;
      }
      setRecordButton(false);
      setHint('Procesando audio...');
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
          cancelSimulatedReply(connectedMode);
        }
        appendMessage(message, { mode: connectedMode });
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
      const payload = {
        channel: pusherChannelName,
        event: 'user_message',
        data: {
          text,
          user_id: lastUserId,
          name: getUserDisplayName(window.user || {})
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
        loadTalkTimelinesForUser(userId);
        clearThread();
      }

      if (!premium) {
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

    previewBtn?.addEventListener('click', () => {
      const typedText = textInput ? textInput.value.trim() : '';
      const activeText = draftTranscript || typedText;
      if (!activeText) return;
      const audioUrl = draftAudioUrl;
      const speakText = draftSpeakText || activeText;
      playMessageAudio({ audioUrl, speakText });
    });

    const sendUserText = (userText, payload = {}) => {
      if (!userText) return;
      const messageMode = chatMode;
      if (messageMode === 'catbot') {
        awaitingBot[messageMode] = true;
      }
      appendMessage({
        role: 'user',
        text: userText,
        audioUrl: payload.audioUrl || '',
        speakText: payload.audioUrl ? '' : payload.speakText || userText
      }, { mode: messageMode });
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
          const reply = pickBotReply(userText);
          appendMessage(
            { role: 'bot', text: reply, audioUrl: '', speakText: reply },
            { mode: messageMode }
          );
          replyTimers[messageMode] = null;
        }, 700);
      }
    };

    sendBtn?.addEventListener('click', () => {
      const typedText = textInput ? textInput.value.trim() : '';
      const userText = draftTranscript || typedText;
      if (!userText) return;
      sendUserText(userText, {
        audioUrl: draftAudioUrl,
        speakText: draftSpeakText || userText
      });
    });

    textInput?.addEventListener('input', () => {
      updateDraftButtons();
    });

    textInput?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      const typedText = textInput.value.trim();
      if (!typedText) return;
      event.preventDefault();
      sendUserText(typedText, { audioUrl: '', speakText: typedText });
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

    const placeSendButton = () => {
      if (!sendBtn || !textRow || !chatControls) return;
      const target = chatMode === 'chatbot' ? textRow : chatControls;
      if (sendBtn.parentElement !== target) {
        target.appendChild(sendBtn);
      }
    };

    const updateChatControlsVisibility = () => {
      const isChatbot = chatMode === 'chatbot';
      if (recordBtn) recordBtn.hidden = isChatbot;
      if (previewBtn) previewBtn.hidden = isChatbot;
      if (hintEl) hintEl.hidden = isChatbot;
      if (chatControls) chatControls.hidden = isChatbot;
      if (textRow) textRow.classList.toggle('chat-text-row-inline', isChatbot);
      placeSendButton();
    };

    const updateTextRowVisibility = (debugOverride) => {
      const debug =
        debugOverride !== undefined
          ? debugOverride
          : Boolean(window.r34lp0w3r && window.r34lp0w3r.speakDebug);
      const showText = debug && chatMode === 'chatbot';
      if (textRow) textRow.hidden = !showText;
      if (!showText && textInput) {
        textInput.value = '';
      }
    };

    const setChatMode = (mode, { reconnect } = {}) => {
      if (mode !== 'catbot' && mode !== 'chatbot') return;
      if (chatMode === mode) return;
      chatMode = mode;
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
      updateDraftButtons();
    };

    const applyDebugMode = () => {
      const debug = Boolean(window.r34lp0w3r && window.r34lp0w3r.speakDebug);
      if (modeToggle) modeToggle.hidden = !debug;
      if (!debug) {
        if (textInput) textInput.value = '';
        updateTextRowVisibility(false);
        setChatMode('catbot', { reconnect: true });
        renderThread(chatMode);
      } else {
        updateTextRowVisibility(true);
        updateChatControlsVisibility();
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
    };
  }

  disconnectedCallback() {
    if (this._cleanupPremiumChat) {
      this._cleanupPremiumChat();
    }
    if (this._userHandler) {
      window.removeEventListener('app:user-change', this._userHandler);
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
