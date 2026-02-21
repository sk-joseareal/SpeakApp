import { ensureTrainingData, getSelection, resolveSelection, setSelection } from '../data/training-data.js';
import { goToHome } from '../nav.js';

class PageSpeak extends HTMLElement {
  connectedCallback() {
    this.classList.add('ion-page');
    this.innerHTML = `
      <ion-content fullscreen class="speak-content secret-content">
        <div class="speak-shell">
          <div class="speak-session-title-wrap">
            <h2 class="speak-session-title secret-title" id="speak-session-title"></h2>
          </div>
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
            <button
              class="onboarding-intro-flag-btn journey-plan-flag-btn speak-hero-flag-btn"
              type="button"
              aria-label="English"
              title="English"
            >
              <img class="onboarding-intro-flag" src="assets/flags/eeuu.png" alt="English">
            </button>
            <div class="speak-hero-head">
              <img class="onboarding-intro-cat speak-hero-cat" src="assets/mascot/mascot-cat.png" alt="" aria-hidden="true">
              <p class="speak-hero-step-title" id="speak-hero-step-title"></p>
            </div>
            <p class="onboarding-intro-bubble speak-hero-bubble" id="speak-hero-hint"></p>
          </section>
          <div class="speak-sheet">
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
    const heroCardEl = this.querySelector('#speak-hero-card');
    const heroStepTitleEl = this.querySelector('#speak-hero-step-title');
    const heroHintEl = this.querySelector('#speak-hero-hint');
    const debugToggleBtn = this.querySelector('#speak-debug-toggle');

    const AVATAR_BASE = 'assets/speak/avatar';
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
    const swipeSurface = this.querySelector('.speak-sheet');

    const stepOrder = ['sound', 'spelling', 'sentence'];
    let soundStep = null;
    let spellingStep = null;
    let sentenceStep = null;
    let focusKey = 'w';
    let sessionTitle = '';
    let currentSessionId = '';
    let showSummary = false;
    let summaryState = null;
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

    const stepState = {
      sound: { recordingUrl: '', transcript: '', percent: null },
      spelling: { recordingUrl: '', transcript: '', percent: null },
      sentence: { recordingUrl: '', transcript: '', percent: null }
    };

    const getSpeechRecognition = () => window.SpeechRecognition || window.webkitSpeechRecognition;
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

    const DEFAULT_LABEL_SCALE = [
      { min: 85, label: 'You sound like a native' },
      { min: 70, label: 'Good! Continue practicing' },
      { min: 60, label: 'Almost Correct!' },
      { min: 0, label: 'Keep practicing' }
    ];

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
          ${inlineNav}
        </div>
      `;
    };

    const renderBottomPanel = (key, options = {}) => {
      const hasVoiceRecording = Boolean(options.hasVoiceRecording);
      if (isSpeakDebugEnabled() && debugPanelOpen) {
        return `
          <div class="speak-step-bottom">
            <div class="speak-voice-nav speak-voice-nav-debug">
              ${renderDebugBox(key, { inline: true })}
            </div>
          </div>
        `;
      }
      return `
        <div class="speak-step-bottom">
          <div class="speak-voice-nav">
            <button class="speak-step-arrow-btn" id="speak-prev-inline" type="button" aria-label="Previous step">
              <ion-icon name="chevron-back"></ion-icon>
            </button>
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
              <button class="speak-circle-btn" id="speak-voice" type="button" ${hasVoiceRecording ? '' : 'disabled'}>
                <ion-icon name="ear"></ion-icon>
                <span>Your voice</span>
              </button>
            </div>
            <button class="speak-step-arrow-btn" id="speak-next-inline" type="button" aria-label="Next step">
              <ion-icon name="chevron-forward"></ion-icon>
            </button>
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
          const url = URL.createObjectURL(blob);
          const stepKey = recordingStepKey || getStepKey();
          if (canNativeFileTranscribe()) {
            if (isAndroidPlatform()) {
              setTranscribingState(true, stepKey);
            }
            transcribeNativeAudioBlob(blob)
              .then((text) => {
                if (isAndroidPlatform()) {
                  setTranscribingState(false, stepKey);
                }
                finalizeRecording(url, stepKey, text);
              })
              .catch(() => {
                if (isAndroidPlatform()) {
                  setTranscribingState(false, stepKey);
                }
                finalizeRecording(url, stepKey);
              });
          } else {
            finalizeRecording(url, stepKey);
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

    const finalizeRecording = (audioUrl, stepKey, forcedTranscript) => {
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

    const getHeroSourceByStepKey = (stepKey) => {
      if (stepKey === 'sound') return soundStep;
      if (stepKey === 'spelling') return spellingStep;
      if (stepKey === 'sentence') return sentenceStep;
      return null;
    };

    const applyHeroSource = (source) => {
      if (!heroStepTitleEl || !heroHintEl) return;
      heroStepTitleEl.textContent = source && source.title ? source.title : '';
      const hint = source && source.hint ? source.hint : '';
      heroHintEl.textContent = hint;
      heroHintEl.hidden = !hint;
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
      currentSessionId = session.id;
      sessionTitle = session.title || '';
      if (sessionTitleEl) {
        sessionTitleEl.textContent = sessionTitle;
      }
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
      lockHeroCardHeight();
      renderStep();
    };

    const renderSoundStep = () => {
      const score = getScoreForStep('sound');
      const hasRecording = Boolean(stepState.sound.recordingUrl);
      const transcribing = isTranscribingStep('sound');
      const percent = transcribing ? '' : score && hasRecording ? score.percent : '';
      const tone = transcribing ? 'hint' : score && hasRecording ? score.tone : 'hint';
      const label = transcribing ? 'Transcribiendo...' : score && hasRecording ? score.label : 'Practice the sound';
      const displayText = getSoundDisplayText();

      return `
        <div class="speak-step speak-step-sound">
          <div class="speak-step-main">
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
              <span class="speak-phonetic-text" id="speak-phonetic-text">
                ${highlightLetter(displayText, focusKey)}
              </span>
            </div>

            <div class="speak-score speak-score-${tone}">
              <div class="speak-score-label">${label}</div>
              <div class="speak-score-value">${percent !== '' ? percent + '%' : ''}</div>
            </div>
          </div>

          ${renderBottomPanel('sound', { hasVoiceRecording: hasRecording })}
        </div>
      `;
    };

    const renderSpellingStep = () => {
      const stored = getStoredWordResult(currentSessionId, selectedWord);
      const hasScore = stored && typeof stored.percent === 'number';
      const transcribing = isTranscribingStep('spelling');
      const percent = transcribing ? null : hasScore ? stored.percent : null;
      const tone = transcribing ? 'hint' : hasScore ? getScoreTone(percent) : 'hint';
      const label = transcribing ? 'Transcribiendo...' : hasScore ? getScoreLabel(percent) : 'Practice the words';
      const hasRecording = Boolean(stepState.spelling.recordingUrl);

      const words = spellingStep.words
        .map((word) => {
          const result = getStoredWordResult(currentSessionId, word);
          const wordTone =
            result && typeof result.percent === 'number' ? getScoreTone(result.percent) : '';
          const toneClass = wordTone ? `speak-word-tone-${wordTone}` : '';
          return `
            <button class="speak-word ${toneClass} ${word === selectedWord ? 'is-active' : ''}" data-word="${word}" type="button">
              <span>${highlightLetter(word, focusKey)}</span>
            </button>
          `;
        })
        .join('');

      return `
        <div class="speak-step speak-step-spelling">
          <div class="speak-step-main">
            <div class="speak-word-grid">${words}</div>
            <div class="speak-word-play">
              <button class="speak-play-btn" id="speak-play-word" type="button" ${selectedWord ? '' : 'disabled'}>
                <ion-icon name="volume-high"></ion-icon>
              </button>
            </div>

            <div class="speak-score speak-score-${tone}">
              <div class="speak-score-label">${label}</div>
              <div class="speak-score-value">${percent !== null ? percent + '%' : ''}</div>
            </div>
          </div>

          ${renderBottomPanel('spelling', { hasVoiceRecording: hasRecording })}
        </div>
      `;
    };

    const renderSentenceStep = () => {
      const score = getScoreForStep('sentence');
      const hasScore = score && typeof score.percent === 'number';
      const transcribing = isTranscribingStep('sentence');
      const percent = transcribing ? '' : hasScore ? score.percent : '';
      const tone = transcribing ? 'hint' : hasScore ? score.tone : 'hint';
      const label = transcribing ? 'Transcribiendo...' : hasScore ? score.label : 'Practice the phrase';
      const hasRecordingUrl = Boolean(stepState.sentence.recordingUrl);
      const scoreLine = hasScore && !transcribing
        ? `
          <div class="speak-score-line ${tone}">
            <div class="speak-score-line-value">${percent}%</div>
            <div class="speak-score-line-text">Good! Continue practicing</div>
          </div>
        `
        : `
          <div class="speak-score-line placeholder">
            <div class="speak-score-line-value">&nbsp;</div>
            <div class="speak-score-line-text">&nbsp;</div>
          </div>
        `;

      return `
        <div class="speak-step speak-step-sentence">
          <div class="speak-step-main">
            <div class="speak-sentence-row">
              <div class="speak-sentence" id="speak-sentence-text">
                ${highlightSentence(sentenceStep.sentence, focusKey)}
              </div>
              <button class="speak-play-btn" id="speak-play-sentence" type="button">
                <ion-icon name="volume-high"></ion-icon>
              </button>
            </div>
            <div class="speak-feedback ${tone}">${label}</div>
            ${scoreLine}
          </div>

          ${renderBottomPanel('sentence', { hasVoiceRecording: hasRecordingUrl })}
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
        if (debugToggleBtn) {
          debugToggleBtn.hidden = true;
          debugToggleBtn.classList.remove('is-active');
          debugToggleBtn.setAttribute('aria-pressed', 'false');
        }
        return;
      }
      heroCardEl.hidden = false;
      const debugEnabled = isSpeakDebugEnabled();
      if (debugToggleBtn) {
        debugToggleBtn.hidden = !debugEnabled;
        debugToggleBtn.classList.toggle('is-active', debugEnabled && debugPanelOpen);
        debugToggleBtn.setAttribute('aria-pressed', debugEnabled && debugPanelOpen ? 'true' : 'false');
      }
      applyHeroSource(getHeroSourceByStepKey(stepKey));
      if (sessionTitleEl) {
        sessionTitleEl.textContent = sessionTitle || '';
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

    const renderStep = () => {
      const key = getStepKey();
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
      requestAnimationFrame(updateSwipeStageHeight);
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
        if (window.r34lp0w3r && window.r34lp0w3r.speakReturnToReview) {
          const returnSessionId = window.r34lp0w3r.speakReturnSessionId;
          if (!returnSessionId || returnSessionId === currentSessionId) {
            window.r34lp0w3r.speakReturnToReview = false;
            window.r34lp0w3r.speakReturnSessionId = null;
            window.r34lp0w3r.profileForceTab = 'review';
            try {
              localStorage.setItem('appv5:active-tab', 'tu');
            } catch (err) {
              // no-op
            }
            goToHome('back');
            return;
          }
          window.r34lp0w3r.speakReturnToReview = false;
          window.r34lp0w3r.speakReturnSessionId = null;
        }
        const { route, module, session } = resolveSelection(getSelection());
        if (route && module && session) {
          setSelection({
            routeId: route.id,
            moduleId: module.id,
            sessionId: session.id
          });
        }
        showSummary = false;
        summaryState = null;
        try {
          localStorage.setItem('appv5:active-tab', 'home');
        } catch (err) {
          // no-op
        }
        goToHome('back');
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

    const goBackToRoutes = () => {
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

    const handleViewportResize = () => {
      if (!this.isConnected) return;
      lockHeroCardHeight();
    };
    this._handleSpeakResize = handleViewportResize;
    window.addEventListener('resize', handleViewportResize);

    ensureTrainingData().then(() => {
      applySessionData(getSelection());
    });

    debugToggleBtn?.addEventListener('click', toggleDebugPanel);

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
      if (this._handleSpeakResize) {
        window.removeEventListener('resize', this._handleSpeakResize);
      }
      if (debugToggleBtn) {
        debugToggleBtn.removeEventListener('click', toggleDebugPanel);
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
