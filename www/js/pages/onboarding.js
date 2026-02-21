import {
  clearLoginTabsLock,
  getAppLocale,
  setAppLocale,
  setLoginTabsLock,
  setOnboardingDone
} from '../state.js';
import { goToHome } from '../nav.js';
import {
  getLocaleMeta,
  getOnboardingCopy,
  normalizeLocale as normalizeCopyLocale
} from '../content/copy.js';

const SWIPE_MIN_DISTANCE = 52;
const SWIPE_MAX_OFF_AXIS = 44;
const TTS_LANG_BY_LOCALE = {
  es: 'es-ES',
  en: 'en-US'
};
const HERO_MASCOT_FRAME_COUNT = 9;
const HERO_MASCOT_REST_FRAME = HERO_MASCOT_FRAME_COUNT - 1;
const HERO_MASCOT_FRAME_INTERVAL_MS = 150;

const onboardingSlides = [
  {
    id: 'intro',
    hero: {
      copyKey: 'intro',
      tone: 'default'
    }
  },
  {
    id: 'level',
    hero: {
      copyKey: 'level',
      tone: 'accent'
    }
  },
  {
    id: 'topics',
    hero: {
      copyKey: 'topics',
      selector: {
        type: 'locale',
        options: ['es', 'en']
      },
      tone: 'locale'
    }
  }
];

class PageOnboarding extends HTMLElement {
  constructor() {
    super();
    this.currentStep = 0;
    const savedLocale = this.normalizeLocale(getAppLocale());
    this.state = {
      locale: savedLocale || '',
      localeOverride: ''
    };
    this.narrationToken = 0;
    this.firstSlideNarrationStarted = false;
    this.browserNarrationRetryAttempts = 0;
    this.browserNarrationRetryHandler = null;
    this.browserNarrationRetryTimer = null;
    this.heroMascotFrameIndex = HERO_MASCOT_REST_FRAME;
    this.heroMascotFrameTimer = null;
    this.heroMascotIsTalking = false;
    this.touchGesture = {
      active: false,
      startX: 0,
      startY: 0,
      ignore: false
    };
  }

  connectedCallback() {
    this.classList.add('ion-page', 'onboarding-page');
    this.render();
    this.cacheElements();
    this.bindEvents();
    if (!this.isNativeRuntime()) {
      this.setupBrowserNarrationRetry();
    }
    const initialDelayMs = this.isNativeRuntime() ? 280 : 950;
    this.updateSlide({ narrationDelayMs: initialDelayMs });
  }

  disconnectedCallback() {
    this.teardownBrowserNarrationRetry();
    this.clearNarrationTimer();
    this.stopHeroMascotTalk({ settle: true });
    this.stopNarration().catch(() => {});
  }

  render() {
    const copy = this.getCopy();
    const dotsMarkup = onboardingSlides
      .map((_, idx) => `<span class="dot" data-step-dot="${idx}"></span>`)
      .join('');
    this.innerHTML = `
      <ion-content fullscreen>
        <div class="onboarding-shell">
          <div class="onboarding-top">
            <div class="pill brand-pill" data-field="brand">${copy.brand}</div>
            <button class="ghost-btn" data-action="skip">${copy.skip}</button>
          </div>
          <div class="onboarding-body" data-field="body"></div>
          <div class="onboarding-progress">
            ${dotsMarkup}
          </div>
          <div class="onboarding-actions">
            <ion-button expand="block" shape="round" size="large" data-action="next">
              ${copy.cta}
            </ion-button>
          </div>
        </div>
      </ion-content>
    `;
  }

  cacheElements() {
    this.shellEl = this.querySelector('.onboarding-shell');
    this.bodyEl = this.querySelector('[data-field="body"]');
    this.brandEl = this.querySelector('[data-field="brand"]');
    this.dots = Array.from(this.querySelectorAll('[data-step-dot]'));
    this.nextBtn = this.querySelector('[data-action="next"]');
    this.skipBtn = this.querySelector('[data-action="skip"]');
  }

  bindEvents() {
    this.nextBtn.addEventListener('click', () => this.goNextStep());
    this.skipBtn.addEventListener('click', () => this.finish());
    this.shellEl.addEventListener('touchstart', (event) => this.handleTouchStart(event), { passive: true });
    this.shellEl.addEventListener('touchend', (event) => this.handleTouchEnd(event), { passive: true });
    this.shellEl.addEventListener('touchcancel', () => this.resetSwipeGesture(), { passive: true });
  }

  updateSlide(options = {}) {
    const copy = this.getCopy();
    const step = onboardingSlides[this.currentStep];
    const isHeroStep = Boolean(step.hero);
    this.shellEl?.setAttribute('data-step', step.id);
    this.shellEl?.setAttribute('data-hero-step', isHeroStep ? 'true' : 'false');
    this.classList.toggle('is-hero-step', isHeroStep);
    this.brandEl.textContent = copy.brand;
    this.skipBtn.textContent = copy.skip;
    this.bodyEl.innerHTML = this.renderBody(step, copy);
    this.bindDynamicEvents(step);
    this.renderHeroMascotFrame(this.heroMascotFrameIndex);
    this.setHeroBubbleSpeaking(this.heroMascotIsTalking);
    this.dots.forEach((dot, index) => dot.classList.toggle('active', index === this.currentStep));
    if (isHeroStep) {
      this.nextBtn.textContent = copy.cta;
      this.updateNextButtonState(step);
    } else {
      this.nextBtn.textContent = copy.cta;
      this.updateNextButtonState(step);
    }
    if (!this.isNativeRuntime()) {
      if (this.currentStep === 0 && !this.firstSlideNarrationStarted) {
        this.queueBrowserNarrationRetry(1200);
      } else {
        this.teardownBrowserNarrationRetry();
      }
    }
    const skipNarration = Boolean(options && options.skipNarration);
    if (skipNarration) {
      this.stopNarration().catch(() => {});
      return;
    }
    const delayMs =
      options && typeof options.narrationDelayMs === 'number' ? options.narrationDelayMs : 90;
    this.scheduleSlideNarration(step, copy, delayMs);
  }

  finish() {
    this.stopNarration().catch(() => {});
    setOnboardingDone();
    const user = window.user;
    const loggedIn = Boolean(user && user.id !== undefined && user.id !== null);
    if (loggedIn) {
      clearLoginTabsLock();
      window.dispatchEvent(new CustomEvent('app:tabs-lock-change', { detail: { locked: false } }));
      goToHome('root');
      return;
    }

    setLoginTabsLock();
    window.dispatchEvent(new CustomEvent('app:tabs-lock-change', { detail: { locked: true } }));
    goToHome('root');
    const openLockedLogin = () => {
      if (typeof window.openLoginModal !== 'function') return;
      window.openLoginModal({ locked: true }).catch((err) => {
        console.error('[onboarding] error abriendo login bloqueado', err);
      });
    };
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(openLockedLogin);
      return;
    }
    setTimeout(openLockedLogin, 0);
  }

  renderBody(step, copy) {
    if (step.hero) {
      const slideCopy = this.getSlideCopy(step, copy);
      const uiLocale = this.getUiLocale();
      const currentLocaleMeta = getLocaleMeta(uiLocale);
      const nextLocaleCode = uiLocale === 'en' ? 'es' : 'en';
      const nextLocaleMeta = getLocaleMeta(nextLocaleCode);
      const heroMascotSrc = this.getHeroMascotFramePath(this.heroMascotFrameIndex);
      const toggleLanguageLabel = String(copy.toggleLanguage || '').replace(
        '{lang}',
        nextLocaleMeta.label
      );
      const layoutClasses = ['onboarding-intro-layout'];
      if (step.hero.tone === 'accent') layoutClasses.push('is-accent');
      if (step.hero.tone === 'locale') layoutClasses.push('is-locale');

      const isLocaleSelection = this.isLocaleSelectionStep(step);
      let extraMarkup = '';
      if (isLocaleSelection) {
        const optionsMarkup = (step.hero.selector.options || [])
          .map((localeCode) => {
            const option = getLocaleMeta(localeCode);
            if (!option) return '';
            const selected = this.state.locale === option.code;
            return `
              <button class="onboarding-locale-option" data-locale="${option.code}" data-selected="${selected ? 'true' : 'false'}" type="button">
                <img src="${option.flag}" alt="${option.alt || option.label}">
                <span>${option.label}</span>
              </button>
            `;
          })
          .join('');
        extraMarkup = `
          <div class="onboarding-locale-list" data-list="locales">
            ${optionsMarkup}
          </div>
        `;
      } else {
        const pointsMarkup = ((slideCopy && slideCopy.points) || [])
          .map((point) => `<li>${point}</li>`)
          .join('');
        extraMarkup = `
          <ul class="onboarding-intro-points">
            ${pointsMarkup}
          </ul>
        `;
      }
      return `
        <div class="${layoutClasses.join(' ')}">
          <h1 class="onboarding-intro-title">${slideCopy.title || ''}</h1>
          <section class="onboarding-intro-card">
            <button class="onboarding-intro-flag-btn" type="button" data-action="toggle-language" aria-label="${toggleLanguageLabel}" title="${toggleLanguageLabel}">
              <img class="onboarding-intro-flag" src="${currentLocaleMeta.flag}" alt="${currentLocaleMeta.alt}">
            </button>
            <span class="onboarding-hero-mascot-wrap" aria-hidden="true">
              <img class="onboarding-intro-cat onboarding-hero-mascot" id="onboarding-hero-mascot" src="${heroMascotSrc}" alt="">
            </span>
            <p class="onboarding-intro-bubble onboarding-hero-bubble">
              ${slideCopy.messageHtml || ''}
            </p>
          </section>
          ${extraMarkup}
        </div>
      `;
    }

    return '<div></div>';
  }

  bindDynamicEvents(step) {
    const toggleLanguageBtn = this.querySelector('[data-action="toggle-language"]');
    toggleLanguageBtn?.addEventListener('click', () => {
      this.toggleLocaleFromFlag();
    });

    if (this.isLocaleSelectionStep(step)) {
      const localeEls = Array.from(this.querySelectorAll('.onboarding-locale-option'));
      localeEls.forEach((el) => {
        el.addEventListener('click', () => {
          const locale = String(el.dataset.locale || '').toLowerCase();
          this.applyLocaleSetting(locale, { rerender: true, skipNarration: true });
        });
      });
    }
  }

  normalizeLocale(locale) {
    return normalizeCopyLocale(locale);
  }

  getUiLocale() {
    const overrideLocale = this.normalizeLocale(this.state.localeOverride);
    if (overrideLocale) return overrideLocale;
    return this.normalizeLocale(this.state.locale) || 'en';
  }

  getCopy() {
    const locale = this.getUiLocale();
    return getOnboardingCopy(locale);
  }

  getSlideCopy(step, copy) {
    const key = step && step.hero ? step.hero.copyKey : '';
    if (!key) return {};
    const slides = copy && copy.slides ? copy.slides : {};
    return slides[key] || {};
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
    return this.querySelector('#onboarding-hero-mascot');
  }

  getHeroBubbleEl() {
    return this.querySelector('.onboarding-hero-bubble');
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

  getNativeTtsPlugin() {
    if (!this.isNativeRuntime()) return null;
    if (typeof window === 'undefined') return null;
    const plugins =
      window && window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins : null;
    if (!plugins) return null;
    return plugins.TextToSpeech || null;
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

  canWebSpeak() {
    return (
      typeof window !== 'undefined' &&
      typeof window.speechSynthesis !== 'undefined' &&
      typeof window.SpeechSynthesisUtterance !== 'undefined'
    );
  }

  waitForWebVoices(timeoutMs = 1200) {
    if (!this.canWebSpeak()) return Promise.resolve([]);
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

  extractSpeechText(value) {
    const container = document.createElement('div');
    container.innerHTML = String(value || '');
    return String(container.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
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
    if (this.canWebSpeak() && typeof window.speechSynthesis.cancel === 'function') {
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

  clearNarrationTimer() {
    if (!this.narrationTimer) return;
    clearTimeout(this.narrationTimer);
    this.narrationTimer = null;
  }

  clearBrowserNarrationRetryTimer() {
    if (!this.browserNarrationRetryTimer) return;
    clearTimeout(this.browserNarrationRetryTimer);
    this.browserNarrationRetryTimer = null;
  }

  setupBrowserNarrationRetry() {
    if (this.browserNarrationRetryHandler || this.isNativeRuntime()) return;
    this.browserNarrationRetryHandler = () => {
      if (!this.isConnected) return;
      if (this.currentStep !== 0 || this.firstSlideNarrationStarted) return;
      this.queueBrowserNarrationRetry(0, true);
    };
    window.addEventListener('load', this.browserNarrationRetryHandler);
    window.addEventListener('pageshow', this.browserNarrationRetryHandler);
    window.addEventListener('focus', this.browserNarrationRetryHandler);
    document.addEventListener('visibilitychange', this.browserNarrationRetryHandler);
    document.addEventListener('pointerdown', this.browserNarrationRetryHandler, { passive: true });
    document.addEventListener('keydown', this.browserNarrationRetryHandler, { passive: true });
    document.addEventListener('touchstart', this.browserNarrationRetryHandler, { passive: true });
  }

  teardownBrowserNarrationRetry() {
    this.clearBrowserNarrationRetryTimer();
    if (!this.browserNarrationRetryHandler) return;
    window.removeEventListener('load', this.browserNarrationRetryHandler);
    window.removeEventListener('pageshow', this.browserNarrationRetryHandler);
    window.removeEventListener('focus', this.browserNarrationRetryHandler);
    document.removeEventListener('visibilitychange', this.browserNarrationRetryHandler);
    document.removeEventListener('pointerdown', this.browserNarrationRetryHandler);
    document.removeEventListener('keydown', this.browserNarrationRetryHandler);
    document.removeEventListener('touchstart', this.browserNarrationRetryHandler);
    this.browserNarrationRetryHandler = null;
  }

  queueBrowserNarrationRetry(delayMs = 0, force = false) {
    if (this.isNativeRuntime()) return;
    if (this.currentStep !== 0 || this.firstSlideNarrationStarted) return;
    if (!force && this.browserNarrationRetryAttempts >= 7) return;
    if (this.browserNarrationRetryTimer) return;
    const waitMs = Math.max(0, Number(delayMs) || 0);
    this.browserNarrationRetryTimer = setTimeout(() => {
      this.browserNarrationRetryTimer = null;
      if (!this.isConnected) return;
      if (this.currentStep !== 0 || this.firstSlideNarrationStarted) return;
      this.browserNarrationRetryAttempts += 1;
      const step = onboardingSlides[this.currentStep];
      const copy = this.getCopy();
      this.playSlideNarration(step, copy).then((started) => {
        if (started || this.firstSlideNarrationStarted) return;
        this.queueBrowserNarrationRetry(1400);
      });
    }, waitMs);
  }

  scheduleSlideNarration(step, copy, delayMs) {
    this.clearNarrationTimer();
    const waitMs = Number.isFinite(delayMs) ? Math.max(0, delayMs) : 90;
    this.narrationTimer = setTimeout(() => {
      this.narrationTimer = null;
      if (!this.isConnected) return;
      this.playSlideNarration(step, copy);
    }, waitMs);
  }

  playSlideNarration(step, copy) {
    if (!step || !step.hero) {
      this.stopNarration().catch(() => {});
      return Promise.resolve(false);
    }
    const slideCopy = this.getSlideCopy(step, copy);
    const text = this.extractSpeechText(slideCopy.messageHtml);
    if (!text) {
      this.stopNarration().catch(() => {});
      return Promise.resolve(false);
    }
    const locale = this.getUiLocale();
    return this.speakNarration(text, locale)
      .then((started) => {
        if (started && this.currentStep === 0) {
          this.firstSlideNarrationStarted = true;
          this.teardownBrowserNarrationRetry();
        }
        return started;
      })
      .catch((err) => {
        console.warn('[onboarding] narration error', err);
        return false;
      });
  }

  async speakNarrationWeb(text, lang, token, voiceWaitMs = 1200, hooks = {}) {
    if (!this.canWebSpeak()) return false;
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
    const lang = TTS_LANG_BY_LOCALE[normalizedLocale] || 'en-US';
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

  applyLocaleSetting(locale, options = {}) {
    const normalized = this.normalizeLocale(locale);
    if (!normalized) return;

    this.state.locale = normalized;
    if (this.normalizeLocale(this.state.localeOverride) === normalized) {
      this.state.localeOverride = '';
    }
    setAppLocale(normalized);
    if (window.varGlobal && typeof window.varGlobal === 'object') {
      window.varGlobal.locale = normalized;
    }
    window.dispatchEvent(new CustomEvent('app:locale-change', { detail: { locale: normalized } }));

    if (options.rerender) {
      this.updateSlide({ skipNarration: Boolean(options.skipNarration) });
      return;
    }

    const step = onboardingSlides[this.currentStep];
    this.updateNextButtonState(step);
  }

  toggleLocaleFromFlag() {
    const currentUiLocale = this.getUiLocale();
    const baseLocale = this.normalizeLocale(this.state.locale) || 'en';
    const nextLocale = currentUiLocale === 'en' ? 'es' : 'en';
    this.state.localeOverride = nextLocale === baseLocale ? '' : nextLocale;
    this.updateSlide();
  }

  isLocaleSelectionStep(step) {
    return Boolean(step && step.hero && step.hero.selector && step.hero.selector.type === 'locale');
  }

  hasSelectedLocale() {
    return this.state.locale === 'es' || this.state.locale === 'en';
  }

  updateNextButtonState(step) {
    const requiresLocaleSelection = this.isLocaleSelectionStep(step);
    this.nextBtn.disabled = requiresLocaleSelection && !this.hasSelectedLocale();
  }

  isCurrentStepBlocked() {
    const step = onboardingSlides[this.currentStep];
    return this.isLocaleSelectionStep(step) && !this.hasSelectedLocale();
  }

  goNextStep() {
    if (this.nextBtn.disabled || this.isCurrentStepBlocked()) return;
    if (this.currentStep < onboardingSlides.length - 1) {
      this.currentStep += 1;
      this.updateSlide();
      return;
    }
    this.finish();
  }

  goPrevStep() {
    if (this.currentStep <= 0) return;
    this.currentStep -= 1;
    this.updateSlide();
  }

  handleTouchStart(event) {
    const touch = event.changedTouches && event.changedTouches[0];
    if (!touch) return;
    const target = event.target instanceof Element ? event.target : null;
    const ignore = Boolean(
      target &&
        target.closest('button, ion-button, a, input, textarea, select, label, [data-no-swipe]')
    );
    this.touchGesture = {
      active: true,
      startX: touch.clientX,
      startY: touch.clientY,
      ignore
    };
  }

  handleTouchEnd(event) {
    if (!this.touchGesture.active) return;
    const gesture = { ...this.touchGesture };
    this.resetSwipeGesture();
    if (gesture.ignore) return;

    const touch = event.changedTouches && event.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - gesture.startX;
    const deltaY = touch.clientY - gesture.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX < SWIPE_MIN_DISTANCE) return;
    if (absY > SWIPE_MAX_OFF_AXIS) return;
    if (absX <= absY) return;

    if (deltaX < 0) {
      this.goNextStep();
      return;
    }
    this.goPrevStep();
  }

  resetSwipeGesture() {
    this.touchGesture.active = false;
    this.touchGesture.startX = 0;
    this.touchGesture.startY = 0;
    this.touchGesture.ignore = false;
  }
}

customElements.define('page-onboarding', PageOnboarding);
