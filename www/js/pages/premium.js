class PagePremium extends HTMLElement {
  connectedCallback() {
    this.classList.add('ion-page');
    this.innerHTML = `
      <ion-header translucent="true">
        <ion-toolbar>
          <ion-title>Premium</ion-title>
          <div class="premium-user" slot="end">
            <div class="premium-user-info" id="premium-user-info" hidden>
              <img class="premium-user-avatar" id="premium-user-avatar" alt="Avatar">
              <span class="premium-user-name" id="premium-user-name"></span>
            </div>
            <ion-button fill="clear" size="small" id="premium-logout-btn" hidden>Logout</ion-button>
          </div>
        </ion-toolbar>
      </ion-header>
      <ion-content fullscreen>
        <div class="page-shell">
          <div class="card premium-chat-card">
            <div class="pill">Chatbot (beta)</div>
            <h3>Coach de pronunciacion</h3>
            <p class="muted">Graba tu frase, escucha tu audio y recibe una respuesta simulada.</p>
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
              <div class="chat-controls">
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
    const logoutBtn = this.querySelector('#premium-logout-btn');
    const recordBtn = this.querySelector('#premium-record-btn');
    const previewBtn = this.querySelector('#premium-preview-btn');
    const sendBtn = this.querySelector('#premium-send-btn');
    const hintEl = this.querySelector('#premium-chat-hint');
    const loginBtn = this.querySelector('#premium-login-btn');
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
    let replyTimer = null;
    let lastUserId = null;
    let lastPremium = false;
    let accessLoading = true;
    let accessLoadingTimer = null;
    let pusherClient = null;
    let pusherChannel = null;
    let pusherChannelName = '';
    let awaitingBot = false;
    let realtimeConnected = false;

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

    const buildChannelName = (userId, config) => {
      const base = `${config.channelPrefix}-${userId}`;
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

    const cancelSimulatedReply = () => {
      if (replyTimer) {
        clearTimeout(replyTimer);
        replyTimer = null;
      }
      awaitingBot = false;
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
      const hasTranscript = Boolean(draftTranscript);
      const hasPlayback = Boolean(draftAudioUrl) || (Boolean(draftSpeakText) && canSpeak());
      previewBtn.disabled = !hasTranscript || !hasPlayback;
      sendBtn.disabled = !hasTranscript;
    };

    const setControlsEnabled = (enabled) => {
      if (recordBtn) recordBtn.disabled = !enabled;
      if (!enabled) {
        if (previewBtn) previewBtn.disabled = true;
        if (sendBtn) sendBtn.disabled = true;
      } else {
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
      updateDraftButtons();
    };

    const setDraft = ({ transcript, audioUrl, speakText, simulated, notice }) => {
      if (draftAudioUrl && draftAudioUrl !== audioUrl) {
        URL.revokeObjectURL(draftAudioUrl);
      }
      draftTranscript = transcript;
      draftAudioUrl = audioUrl || '';
      draftSpeakText = speakText || '';
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

    const appendMessage = ({ role, text, audioUrl, speakText }) => {
      if (!threadEl) return;
      const msgEl = document.createElement('div');
      msgEl.className = `chat-msg chat-msg-${role}`;

      const bubbleEl = document.createElement('div');
      bubbleEl.className = 'chat-bubble';

      const textEl = document.createElement('p');
      textEl.className = 'chat-text';
      textEl.textContent = text;
      bubbleEl.appendChild(textEl);

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

      msgEl.appendChild(bubbleEl);
      threadEl.appendChild(msgEl);
      threadEl.scrollTop = threadEl.scrollHeight;
    };

    const clearThread = () => {
      if (!threadEl) return;
      threadEl.innerHTML = '';
    };

    const seedIntroMessage = () => {
      if (!threadEl || threadEl.children.length) return;
      appendMessage({
        role: 'bot',
        text: 'Hi! Record a phrase in English and I will answer with a suggestion.',
        audioUrl: '',
        speakText: 'Hi! Record a phrase in English and I will answer with a suggestion.'
      });
    };

    const resetChatSession = ({ keepIntro, setDefaultHint } = {}) => {
      stopPlayback();
      stopActiveCapture();
      cancelSimulatedReply();
      clearDraft(true);
      retainedAudioUrls.forEach((url) => URL.revokeObjectURL(url));
      retainedAudioUrls.length = 0;
      clearThread();
      if (keepIntro) {
        seedIntroMessage();
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
          cancelSimulatedReply();
        }
        appendMessage(message);
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

      updateUserHeader(user, loggedIn);

      if (loginPanel) loginPanel.hidden = loggedIn;
      if (lockedPanel) lockedPanel.hidden = !loggedIn || premium;
      if (accessPanel) accessPanel.hidden = premium;
      if (chatPanel) chatPanel.hidden = !premium;

      if (!premium) {
        if (userChanged || premiumChanged) {
          resetChatSession({ keepIntro: false, setDefaultHint: false });
        }
        setControlsEnabled(false);
        disconnectRealtime();
      } else {
        if (userChanged || premiumChanged) {
          resetChatSession({ keepIntro: true, setDefaultHint: true });
        } else {
          seedIntroMessage();
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
      if (!draftTranscript) return;
      playMessageAudio({ audioUrl: draftAudioUrl, speakText: draftSpeakText || draftTranscript });
    });

    sendBtn?.addEventListener('click', () => {
      if (!draftTranscript) return;
      const userText = draftTranscript;
      awaitingBot = true;
      appendMessage({
        role: 'user',
        text: userText,
        audioUrl: draftAudioUrl,
        speakText: draftAudioUrl ? '' : draftSpeakText || userText
      });
      if (draftAudioUrl) retainedAudioUrls.push(draftAudioUrl);
      clearDraft(false);
      setHint('Puedes grabar otra frase cuando quieras.');
      emitRealtimeMessage({ text: userText });
      if (replyTimer) clearTimeout(replyTimer);
      replyTimer = setTimeout(() => {
        if (!awaitingBot) {
          replyTimer = null;
          return;
        }
        awaitingBot = false;
        const reply = pickBotReply(userText);
        appendMessage({ role: 'bot', text: reply, audioUrl: '', speakText: reply });
        replyTimer = null;
      }, 700);
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

    showLoadingState();
    accessLoadingTimer = setTimeout(() => {
      updateAccessState(window.user);
    }, 180);
    this._userHandler = (event) => updateAccessState(event.detail);
    window.addEventListener('app:user-change', this._userHandler);

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
  }
}

customElements.define('page-premium', PagePremium);
