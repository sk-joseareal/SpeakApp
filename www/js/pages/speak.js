import { ensureTrainingData, getSelection, resolveSelection, setSelection } from '../data/training-data.js';

class PageSpeak extends HTMLElement {
  connectedCallback() {
    this.classList.add('ion-page');
    this.innerHTML = `
      <ion-header translucent="true" class="speak-header">
        <ion-toolbar class="speak-toolbar">
          <ion-buttons slot="start">
            <ion-button fill="clear" id="speak-prev">
              <ion-icon slot="icon-only" name="chevron-back"></ion-icon>
            </ion-button>
          </ion-buttons>
          <ion-title class="speak-progress" id="speak-progress">1/4</ion-title>
          <ion-buttons slot="end">
            <ion-button fill="clear" id="speak-next">
              <ion-icon slot="icon-only" name="chevron-forward"></ion-icon>
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content fullscreen class="speak-content">
        <div class="speak-top">
          <div class="speak-track">
            <div class="speak-track-route" id="speak-track-route">SOUND JOURNEY</div>
            <div class="speak-track-title" id="speak-track-title">TRAINING 1</div>
            <div class="speak-track-sub" id="speak-track-sub">EL SONIDO W de WATER</div>
          </div>
        </div>
        <div class="speak-sheet">
          <div id="speak-step"></div>
        </div>
      </ion-content>
    `;

    const stepRoot = this.querySelector('#speak-step');
    const progressEl = this.querySelector('#speak-progress');
    const prevBtn = this.querySelector('#speak-prev');
    const nextBtn = this.querySelector('#speak-next');
    const trackRouteEl = this.querySelector('#speak-track-route');
    const trackTitleEl = this.querySelector('#speak-track-title');
    const trackSubEl = this.querySelector('#speak-track-sub');

    const AVATAR_BASE = 'assets/speak/avatar';
    const DATA_BASE = 'assets/speak/data';
    const DEMO_AUDIO_ID = 'lf_audio.000003741';
    const AV_SYNC_DELAY = 0.06;

    const stepOrder = ['sound', 'spelling', 'sentence'];
    let soundStep = null;
    let spellingStep = null;
    let sentenceStep = null;
    let focusKey = 'w';
    let sessionTitle = '';
    let currentSessionId = '';
    let showSummary = false;
    let summaryState = null;

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
    let activeAudio = null;
    let avatarAudio = null;
    let visemes = [];
    let animating = false;
    let currentViseme = 0;
    let lastVisemeKey = 'NEUTRAL';
    let mouthImgA = null;
    let mouthImgB = null;
    let activeMouth = null;
    let inactiveMouth = null;
    let rafId = null;
    let isRecording = false;

    const stepState = {
      sound: { recordingUrl: '', transcript: '', percent: null },
      spelling: { recordingUrl: '', transcript: '', percent: null },
      sentence: { recordingUrl: '', transcript: '', percent: null }
    };

    const getSpeechRecognition = () => window.SpeechRecognition || window.webkitSpeechRecognition;

    const canRecord = () =>
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      typeof MediaRecorder !== 'undefined';

    const canSpeak = () =>
      typeof window !== 'undefined' &&
      typeof window.speechSynthesis !== 'undefined' &&
      typeof window.SpeechSynthesisUtterance !== 'undefined';

    const normalizeText = (value) =>
      String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
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

    const DEFAULT_LABEL_SCALE = [
      { min: 85, label: 'You sound like a native' },
      { min: 70, label: 'Good! Continue practicing' },
      { min: 60, label: 'Almost Correct!' },
      { min: 0, label: 'Keep practicing' }
    ];

    const getFeedbackConfig = () => {
      const config = window.r34lp0w3r && window.r34lp0w3r.speakFeedback;
      const toneScale =
        config && Array.isArray(config.toneScale) ? config.toneScale : DEFAULT_TONE_SCALE;
      const labelScale =
        config && Array.isArray(config.labelScale) ? config.labelScale : DEFAULT_LABEL_SCALE;
      return { toneScale, labelScale };
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

    const getSummaryConfig = () => {
      const config = window.speakSummaryConfig || {};
      const range = config.range || {};
      const min = typeof range.min === 'number' ? range.min : 55;
      const max = typeof range.max === 'number' ? range.max : 98;
      const phrases = config.phrases || {};
      const rewards = Array.isArray(config.rewards) ? config.rewards : [];
      const labelPrefix = config.labelPrefix || 'YOU WIN';
      return {
        minPercent: Math.max(0, Math.min(100, min)),
        maxPercent: Math.max(0, Math.min(100, max)),
        phrases,
        rewards,
        labelPrefix
      };
    };

    const getSummaryTitleTemplates = () => {
      const templates = window.r34lp0w3r && window.r34lp0w3r.speakSummaryTitles;
      if (templates && typeof templates === 'object') {
        return templates;
      }
      return {
        good: ['Muy bien! aprendiste {{session}}'],
        okay: ['Buen trabajo! sigue practicando {{session}}'],
        bad: ['Sigue practicando {{session}}']
      };
    };

    const formatSummaryTitle = (template, sessionName) => {
      const base = String(template || '');
      const withSession = base.replace(/\{\{\s*session\s*\}\}/g, sessionName || '');
      const trimmed = withSession.replace(/\s+/g, ' ').trim();
      if (trimmed) return trimmed;
      return sessionName ? sessionName : '';
    };

    const getSummaryTitle = (tone, sessionName) => {
      const templates = getSummaryTitleTemplates();
      const list = templates && Array.isArray(templates[tone]) ? templates[tone] : [];
      const fallback =
        tone === 'good'
          ? 'Muy bien! aprendiste {{session}}'
          : tone === 'okay'
          ? 'Buen trabajo! sigue practicando {{session}}'
          : 'Sigue practicando {{session}}';
      const template = pickRandom(list) || fallback;
      return formatSummaryTitle(template, sessionName);
    };

    const clampPercent = (value) => Math.max(0, Math.min(100, value));

    const getRandomInt = (min, max) => {
      const low = Math.ceil(min);
      const high = Math.floor(max);
      if (high <= low) return low;
      return Math.floor(Math.random() * (high - low + 1)) + low;
    };

    const pickRandom = (items) => {
      if (!items || !items.length) return '';
      const idx = Math.floor(Math.random() * items.length);
      return items[idx];
    };

    const rollSummaryOutcome = () => {
      const { phrases, rewards, labelPrefix } = getSummaryConfig();
      const percent = clampPercent(getSessionPercent());
      const tone = getScoreTone(percent);
      const phraseList = phrases && phrases[tone] ? phrases[tone] : [];
      const phraseFallback = getScoreLabel(percent);
      const phrase = pickRandom(phraseList) || phraseFallback;
      const storedReward = getStoredSessionReward(currentSessionId);
      let rewardQty = storedReward && typeof storedReward.rewardQty === 'number' ? storedReward.rewardQty : null;
      let rewardLabel = storedReward && storedReward.rewardLabel ? storedReward.rewardLabel : '';
      let rewardIcon = storedReward && storedReward.rewardIcon ? storedReward.rewardIcon : '';
      if (rewardQty === null) {
        const reward = rewards.length ? pickRandom(rewards) : { icon: 'diamond', label: 'diamonds', min: 1, max: 1 };
        const rewardMin = reward && typeof reward.min === 'number' ? reward.min : 1;
        const rewardMax = reward && typeof reward.max === 'number' ? reward.max : rewardMin;
        rewardQty = getRandomInt(Math.min(rewardMin, rewardMax), Math.max(rewardMin, rewardMax));
        rewardLabel = reward && reward.label ? reward.label : 'reward';
        rewardIcon = reward && reward.icon ? reward.icon : 'diamond';
        setStoredSessionReward(currentSessionId, { rewardQty, rewardLabel, rewardIcon });
      }
      return {
        percent,
        tone,
        phrase,
        rewardQty,
        rewardLabel,
        rewardIcon,
        labelPrefix
      };
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
      sessionScores[word] = { ...payload };
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
      store[sessionId] = { ...payload };
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
      store[sessionId] = { ...payload };
      persistSpeakStores();
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

    const renderDebugBox = (key) => {
      if (!isSpeakDebugEnabled()) return '';
      const expected = getExpectedText(key);
      const state = stepState[key] || {};
      const transcript = state.transcript || '';
      const expectedText = expected ? expected : 'n/d';
      const transcriptText = transcript ? transcript : 'n/d';
      const wordsPercent = getWordsPhasePercent();
      const phrasePercent = getPhrasePhasePercent();
      const sessionPercent = getSessionPercent();
      return `
        <div class="speak-debug">
          <div class="speak-debug-row">
            <span class="speak-debug-label">Esperado</span>
            <span class="speak-debug-value">${escapeHtml(expectedText)}</span>
          </div>
          <div class="speak-debug-row">
            <span class="speak-debug-label">Transcrito</span>
            <span class="speak-debug-value">${escapeHtml(transcriptText)}</span>
          </div>
          <div class="speak-debug-row">
            <span class="speak-debug-label">Words %</span>
            <span class="speak-debug-value">${wordsPercent}%</span>
          </div>
          <div class="speak-debug-row">
            <span class="speak-debug-label">Phrase %</span>
            <span class="speak-debug-value">${phrasePercent}%</span>
          </div>
          <div class="speak-debug-row">
            <span class="speak-debug-label">Session %</span>
            <span class="speak-debug-value">${sessionPercent}%</span>
          </div>
        </div>
      `;
    };

    const getScoreTone = (percent) => {
      const value = typeof percent === 'number' ? percent : 0;
      const { toneScale } = getFeedbackConfig();
      const normalized = normalizeScale(toneScale, 'tone');
      return resolveFromScale(normalized, value, 'tone', 'bad');
    };

    const getScoreLabel = (percent) => {
      const value = typeof percent === 'number' ? percent : 0;
      const { labelScale } = getFeedbackConfig();
      const normalized = normalizeScale(labelScale, 'label');
      return resolveFromScale(normalized, value, 'label', 'Keep practicing');
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

    const stopAvatarPlayback = () => {
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

    const clearRecordingForStep = (key) => {
      const state = stepState[key];
      if (state && state.recordingUrl) {
        URL.revokeObjectURL(state.recordingUrl);
      }
      if (state) {
        state.recordingUrl = '';
        state.transcript = '';
        state.percent = null;
      }
    };

    const startRecording = async () => {
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
        const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'];
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
          const url = URL.createObjectURL(blob);
          finalizeRecording(url, recordingStepKey || getStepKey());
          recordingStepKey = null;
          mediaRecorder = null;
        };
        mediaRecorder.start();
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
        mediaRecorder.stop();
      }
      setRecordingState(false);
      stopSpeechRecognition();
      if (recordingStream) {
        recordingStream.getTracks().forEach((track) => track.stop());
        recordingStream = null;
      }
    };

    const finalizeRecording = (audioUrl, stepKey) => {
      const key = stepKey || getStepKey();
      if (!stepState[key]) return;
      const expected = getExpectedText(key);
      const transcript = speechTranscript || speechInterim;
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
      if (!state || !state.recordingUrl) return;
      stopPlayback();
      activeAudio = new Audio(state.recordingUrl);
      activeAudio.play().catch(() => {});
      activeAudio.onended = () => {
        if (activeAudio) activeAudio = null;
      };
    };

    const playTts = (text) => {
      if (!text || !canSpeak()) return;
      stopPlayback();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'en-US';
      window.speechSynthesis.speak(utter);
    };

    const loadVisemes = async () => {
      if (visemes.length) return;
      try {
        const res = await fetch(`${DATA_BASE}/${DEMO_AUDIO_ID}.visemes.json`);
        if (!res.ok) return;
        visemes = await res.json();
      } catch (err) {
        console.warn('[speak] visemes error', err);
      }
    };

    const setMouthViseme = (visemeKeyRaw) => {
      if (!mouthImgA || !mouthImgB) return;
      const visemeKey = (visemeKeyRaw || 'NEUTRAL').toUpperCase();
      if (visemeKey === lastVisemeKey) return;

      const map = {
        NEUTRAL: 'mouth-neutral.png',
        A: 'mouth-a.png',
        E: 'mouth-e.png',
        I: 'mouth-e.png',
        O: 'mouth-o.png',
        U: 'mouth-o.png',
        M: 'mouth-m.png',
        F: 'mouth-f.png',
        TH: 'mouth-th.png'
      };

      const imgName = map[visemeKey] || map.NEUTRAL;
      const imgPath = `${AVATAR_BASE}/${imgName}`;

      const next = inactiveMouth;
      const prev = activeMouth;

      if (!next.src.endsWith(imgName)) {
        next.src = imgPath;
      }

      next.className = `speak-mouth mouth-layer mouth-layer-active viseme-${visemeKey.toLowerCase()}`;
      prev.className = `speak-mouth mouth-layer viseme-${lastVisemeKey.toLowerCase()}`;

      activeMouth = next;
      inactiveMouth = prev;
      lastVisemeKey = visemeKey;
    };

    const updateAvatar = () => {
      if (!animating || !avatarAudio || avatarAudio.paused || avatarAudio.ended) {
        animating = false;
        return;
      }
      const t = Math.max(0, avatarAudio.currentTime - AV_SYNC_DELAY);
      if (visemes.length > 0) {
        while (currentViseme < visemes.length - 1 && t > visemes[currentViseme].end) {
          currentViseme += 1;
        }
        const v = visemes[currentViseme];
        if (v && v.viseme && t >= v.start) {
          setMouthViseme(v.viseme);
        }
      }
      rafId = requestAnimationFrame(updateAvatar);
    };

    const playAvatarReference = async () => {
      stopPlayback();
      stopAvatarPlayback();
      await loadVisemes();
      const audio = new Audio(`${DATA_BASE}/${DEMO_AUDIO_ID}.wav`);
      avatarAudio = audio;
      animating = true;
      currentViseme = 0;
      lastVisemeKey = 'NEUTRAL';
      setMouthViseme('NEUTRAL');
      audio.onended = () => {
        animating = false;
        setMouthViseme('NEUTRAL');
      };
      audio.play().catch(() => {});
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

    const getExpectedText = (key) => {
      if (key === 'sound') return soundStep && soundStep.expected ? soundStep.expected : '';
      if (key === 'spelling') return selectedWord;
      if (key === 'sentence') return sentenceStep && sentenceStep.expected ? sentenceStep.expected : '';
      return '';
    };

    const getScoreForStep = (key) => {
      const state = stepState[key];
      if (!state || state.percent === null) return null;
      const percent = state.percent;
      return {
        percent,
        tone: getScoreTone(percent),
        label: getScoreLabel(percent)
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

    const applySessionData = (nextSelection = getSelection()) => {
      const { route, module, session } = resolveSelection(nextSelection);
      if (!route || !module || !session || !session.speak) return;
      currentSessionId = session.id;
      sessionTitle = session.title || '';
      focusKey = session.focus || (session.speak && session.speak.focus) || '';
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
      if (trackRouteEl) trackRouteEl.textContent = route.title || '';
      if (trackTitleEl) trackTitleEl.textContent = module.title || '';
      if (trackSubEl) trackSubEl.textContent = sessionTitle;
      stepIndex = startStep !== null ? resolveStartStepIndex(startStep) : 0;
      showSummary = false;
      summaryState = null;
      resetStepState();
      syncSpellingStateFromStore(selectedWord);
      syncSentenceStateFromStore();
      if (window.r34lp0w3r) {
        window.r34lp0w3r.speakStartStep = null;
        window.r34lp0w3r.speakStartWord = null;
      }
      renderStep();
    };

    const renderSoundStep = () => {
      const score = getScoreForStep('sound');
      const hasRecording = Boolean(stepState.sound.recordingUrl);
      const percent = score && hasRecording ? score.percent : '';
      const tone = score && hasRecording ? score.tone : 'hint';
      const label = score && hasRecording ? score.label : 'Practice the sound';

      return `
        <div class="speak-step speak-step-sound">
          <div class="speak-guide">
            <div class="mascot-cat"></div>
            <div class="speak-guide-body">
              <div class="speak-step-title">${soundStep.title}</div>
              <div class="speak-bubble">${soundStep.hint}</div>
            </div>
          </div>

          <div class="speak-avatar">
            <div class="avatar-wrapper">
              <img class="avatar-head" src="${AVATAR_BASE}/avatar-head.png" alt="Avatar">
              <div class="avatar-mouth-container">
                <img
                  id="speak-mouth-a"
                  class="speak-mouth mouth-layer mouth-layer-active viseme-neutral"
                  src="${AVATAR_BASE}/mouth-neutral.png"
                  alt="Mouth"
                />
                <img
                  id="speak-mouth-b"
                  class="speak-mouth mouth-layer viseme-neutral"
                  src="${AVATAR_BASE}/mouth-neutral.png"
                  alt="Mouth"
                />
              </div>
            </div>
          </div>

          <div class="speak-phonetic">
            <button class="speak-play-btn" id="speak-play-ref" type="button">
              <ion-icon name="volume-high"></ion-icon>
            </button>
            <span class="speak-phonetic-text">${highlightLetter(soundStep.phonetic, focusKey)}</span>
          </div>

          <div class="speak-score speak-score-${tone}">
            <div class="speak-score-label">${label}</div>
            <div class="speak-score-value">${percent !== '' ? percent + '%' : ''}</div>
          </div>

          <div class="speak-voice-actions">
            <button class="speak-circle-btn speak-record-btn ${isRecording ? 'is-recording' : ''}" id="speak-record" type="button" aria-pressed="${isRecording}">
              <ion-icon name="mic"></ion-icon>
              <span class="record-label">${isRecording ? 'End' : 'Say'}</span>
            </button>
            <button class="speak-circle-btn" id="speak-voice" type="button" ${hasRecording ? '' : 'disabled'}>
              <ion-icon name="ear"></ion-icon>
              <span>Your voice</span>
            </button>
          </div>

          ${renderDebugBox('sound')}

          <button class="speak-next-btn" id="speak-next-step" type="button">Next</button>
        </div>
      `;
    };

    const renderSpellingStep = () => {
      const stored = getStoredWordResult(currentSessionId, selectedWord);
      const hasScore = stored && typeof stored.percent === 'number';
      const percent = hasScore ? stored.percent : null;
      const tone = hasScore ? getScoreTone(percent) : 'hint';
      const label = hasScore ? getScoreLabel(percent) : 'Practice the words';
      const hasRecording = Boolean(stepState.spelling.recordingUrl);

      const words = spellingStep.words
        .map((word) => {
          const result = getStoredWordResult(currentSessionId, word);
          const wordTone =
            result && typeof result.percent === 'number' ? getScoreTone(result.percent) : '';
          const toneClass = wordTone ? `speak-word-tone-${wordTone}` : '';
          return `
            <button class="speak-word ${toneClass} ${word === selectedWord ? 'is-active' : ''}" data-word="${word}" type="button">
              <ion-icon name="volume-medium"></ion-icon>
              <span>${highlightLetter(word, focusKey)}</span>
            </button>
          `;
        })
        .join('');

      return `
        <div class="speak-step speak-step-spelling">
          <div class="speak-guide">
            <div class="mascot-cat"></div>
            <div class="speak-guide-body">
              <div class="speak-step-title">${spellingStep.title}</div>
              <div class="speak-bubble">${spellingStep.hint}</div>
            </div>
          </div>

          <div class="speak-word-grid">${words}</div>

          <div class="speak-score speak-score-${tone}">
            <div class="speak-score-label">${label}</div>
            <div class="speak-score-value">${percent !== null ? percent + '%' : ''}</div>
          </div>

          <div class="speak-voice-actions">
            <button class="speak-circle-btn speak-record-btn ${isRecording ? 'is-recording' : ''}" id="speak-record" type="button" aria-pressed="${isRecording}">
              <ion-icon name="mic"></ion-icon>
              <span class="record-label">${isRecording ? 'End' : 'Say'}</span>
            </button>
            <button class="speak-circle-btn" id="speak-voice" type="button" ${hasRecording ? '' : 'disabled'}>
              <ion-icon name="ear"></ion-icon>
              <span>Your voice</span>
            </button>
          </div>

          ${renderDebugBox('spelling')}

          <button class="speak-next-btn" id="speak-next-step" type="button">Next</button>
        </div>
      `;
    };

    const renderSentenceStep = () => {
      const score = getScoreForStep('sentence');
      const hasScore = score && typeof score.percent === 'number';
      const percent = hasScore ? score.percent : '';
      const tone = hasScore ? score.tone : 'hint';
      const label = hasScore ? score.label : 'Practice the phrase';
      const hasRecordingUrl = Boolean(stepState.sentence.recordingUrl);
      const scoreLine = hasScore
        ? `
          <div class="speak-score-line ${tone}">
            <div class="speak-score-line-value">${percent}%</div>
            <div class="speak-score-line-text">Good! Continue practicing</div>
          </div>
        `
        : '';

      return `
        <div class="speak-step speak-step-sentence">
          <div class="speak-guide">
            <div class="mascot-cat"></div>
            <div class="speak-guide-body">
              <div class="speak-step-title">${sentenceStep.title}</div>
              <div class="speak-bubble">${sentenceStep.hint}</div>
            </div>
          </div>

          <div class="speak-sentence-row">
            <button class="speak-play-btn" id="speak-play-sentence" type="button">
              <ion-icon name="volume-high"></ion-icon>
            </button>
            <div class="speak-sentence">${highlightSentence(sentenceStep.sentence, focusKey)}</div>
          </div>
          <div class="speak-feedback ${tone}">${label}</div>
          ${scoreLine}

          <div class="speak-voice-actions">
            <button class="speak-circle-btn speak-record-btn ${isRecording ? 'is-recording' : ''}" id="speak-record" type="button" aria-pressed="${isRecording}">
              <ion-icon name="mic"></ion-icon>
              <span class="record-label">${isRecording ? 'End' : 'Say'}</span>
            </button>
            <button class="speak-circle-btn" id="speak-voice" type="button" ${hasRecordingUrl ? '' : 'disabled'}>
              <ion-icon name="ear"></ion-icon>
              <span>Your voice</span>
            </button>
          </div>

          ${renderDebugBox('sentence')}

          <button class="speak-next-btn" id="speak-next-step" type="button">Next</button>
        </div>
      `;
    };

    const renderSummaryStep = () => {
      const summary = summaryState || rollSummaryOutcome();
      summaryState = summary;
      const percent = summary.percent;
      const tone = summary.tone;
      const phrase = summary.phrase;
      const rewardLabel = `${summary.labelPrefix} ${summary.rewardQty} ${summary.rewardLabel}`;
      const summaryTitle = getSummaryTitle(tone, sessionTitle);
      const showConfetti = tone === 'good';
      const mascotToneClass = showConfetti ? 'mascot-confetti' : '';
      return `
        <div class="speak-step speak-step-summary">
          ${
            showConfetti
              ? `<div class="summary-confetti">
            <span></span><span></span><span></span><span></span><span></span>
            <span></span><span></span><span></span><span></span><span></span>
          </div>`
              : ''
          }
          <div class="mascot-cat mascot-large ${mascotToneClass}"></div>
          <div class="summary-title">${summaryTitle}</div>
          <div class="summary-score ${tone}">
            <ion-icon name="checkmark-circle"></ion-icon>
            <span>${percent}%</span>
          </div>
          <div class="summary-feedback ${tone}">${phrase}</div>
          <div class="summary-reward">
            <div class="summary-reward-label">${rewardLabel}</div>
            <ion-icon name="${summary.rewardIcon}"></ion-icon>
          </div>
          <button class="speak-next-btn" id="speak-next-step" type="button">Continue</button>
        </div>
      `;
    };

    const renderStep = () => {
      const key = getStepKey();
      if (progressEl) {
        if (showSummary) {
          progressEl.textContent = '';
          progressEl.style.visibility = 'hidden';
        } else {
          const current = Math.min(stepIndex + 1, stepOrder.length);
          progressEl.textContent = `${current}/${stepOrder.length}`;
          progressEl.style.visibility = '';
        }
      }
      if (prevBtn) {
        prevBtn.disabled = showSummary || stepIndex === 0;
        prevBtn.style.visibility = showSummary ? 'hidden' : '';
      }
      if (nextBtn) {
        nextBtn.disabled = showSummary || stepIndex >= stepOrder.length - 1;
        nextBtn.style.visibility = showSummary ? 'hidden' : '';
      }

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

      bindStepControls();
    };

    const bindStepControls = () => {
      const playRefBtn = stepRoot.querySelector('#speak-play-ref');
      const playSentenceBtn = stepRoot.querySelector('#speak-play-sentence');
      const recordBtn = stepRoot.querySelector('#speak-record');
      const voiceBtn = stepRoot.querySelector('#speak-voice');
      const nextStepBtn = stepRoot.querySelector('#speak-next-step');
      const wordButtons = Array.from(stepRoot.querySelectorAll('.speak-word'));

      mouthImgA = stepRoot.querySelector('#speak-mouth-a');
      mouthImgB = stepRoot.querySelector('#speak-mouth-b');
      if (mouthImgA && mouthImgB) {
        activeMouth = mouthImgA;
        inactiveMouth = mouthImgB;
      }

      playRefBtn?.addEventListener('click', () => {
        playAvatarReference();
      });

      playSentenceBtn?.addEventListener('click', () => {
        if (sentenceStep && sentenceStep.sentence) {
          playTts(sentenceStep.sentence);
        }
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

      nextStepBtn?.addEventListener('click', () => {
        nextStep();
      });

      wordButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const word = btn.dataset.word;
          if (!word) return;
          selectedWord = word;
          syncSpellingStateFromStore(word);
          playTts(word);
          renderStep();
        });
      });

      updateRecordUi();
    };

    const nextStep = () => {
      stopPlayback();
      stopAvatarPlayback();
      stopRecording();
      if (showSummary) {
        const { route, module, session } = resolveSelection(getSelection());
        if (!route || !module || !session) {
          const tabs = document.querySelector('ion-tabs');
          if (tabs && typeof tabs.select === 'function') {
            tabs.select('listas');
          }
          return;
        }
        const sessionIndex = module.sessions.findIndex((item) => item.id === session.id);
        const nextSession = module.sessions[sessionIndex + 1];
        showSummary = false;
        summaryState = null;
        if (nextSession) {
          setSelection({
            routeId: route.id,
            moduleId: module.id,
            sessionId: nextSession.id
          });
          return;
        }
        const moduleIndex = route.modules.findIndex((item) => item.id === module.id);
        const nextModule = route.modules[moduleIndex + 1] || route.modules[0];
        const nextSessionFallback = nextModule.sessions[0];
        if (nextModule && nextSessionFallback) {
          setSelection({
            routeId: route.id,
            moduleId: nextModule.id,
            sessionId: nextSessionFallback.id
          });
        }
        const tabs = document.querySelector('ion-tabs');
        if (tabs && typeof tabs.select === 'function') {
          tabs.select('listas');
        }
        return;
      }
      if (stepIndex < stepOrder.length - 1) {
        stepIndex += 1;
        renderStep();
        return;
      }
      showSummary = true;
      summaryState = rollSummaryOutcome();
      renderStep();
    };

    const prevStep = () => {
      stopPlayback();
      stopAvatarPlayback();
      stopRecording();
      if (showSummary) {
        showSummary = false;
        summaryState = null;
        renderStep();
        return;
      }
      if (stepIndex > 0) {
        stepIndex -= 1;
        renderStep();
      }
    };

    prevBtn?.addEventListener('click', prevStep);
    nextBtn?.addEventListener('click', nextStep);

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

    ensureTrainingData().then(() => {
      applySessionData(getSelection());
    });

    this._cleanupSpeak = () => {
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
    };
  }

  disconnectedCallback() {
    if (this._cleanupSpeak) {
      this._cleanupSpeak();
    }
  }
}

customElements.define('page-speak', PageSpeak);
