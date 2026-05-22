import {
  clearLoginTabsLock,
  getAppLocale,
  onboardingDone,
  setLoginTabsLock,
  setOnboardingDone
} from '../state.js';
import { goToHome } from '../nav.js';
import { getOnboardingCopy, normalizeLocale as normalizeCopyLocale } from '../content/copy.js';

const SWIPE_MIN_DISTANCE = 52;
const SWIPE_MAX_OFF_AXIS = 44;
const ONBOARDING_MASCOT_SRC = 'assets/mascot/nena_trimmed.png';
const ONBOARDING_STATUSBAR_COLOR = '#00000000';
const ONBOARDING_THEME_COLOR = '#00000000';
const APP_STATUSBAR_COLOR = '#00000000';
const APP_STATUSBAR_PRESET_KEY = 'appv5:statusbar-preset';

function getStatusBarStyle(lightIcons) {
  return lightIcons ? 'DARK' : 'LIGHT';
}

function normalizeStatusbarPreset(value) {
  return String(value || '').trim().toLowerCase() === 'clear' ? 'clear' : 'dark';
}

function getStoredStatusbarPreset() {
  const globalValue =
    window.r34lp0w3r && Object.prototype.hasOwnProperty.call(window.r34lp0w3r, 'appStatusbarPreset')
      ? window.r34lp0w3r.appStatusbarPreset
      : undefined;
  if (globalValue !== undefined) return normalizeStatusbarPreset(globalValue);
  try {
    return normalizeStatusbarPreset(localStorage.getItem(APP_STATUSBAR_PRESET_KEY));
  } catch (_err) {
    return 'dark';
  }
}

function isAndroidPlatform() {
  return (
    window.Capacitor &&
    typeof window.Capacitor.getPlatform === 'function' &&
    window.Capacitor.getPlatform() === 'android'
  );
}

function setNativeChrome(color, lightIcons, meta = {}) {
  try {
    const nativePlugin = window.Capacitor?.Plugins?.P4w4Plugin;
    if (!nativePlugin || typeof nativePlugin.setNativeChrome !== 'function') return;
    nativePlugin.setNativeChrome({
      backgroundColor: color,
      lightIcons,
      source: meta && meta.source ? meta.source : '',
      path: meta && meta.path ? meta.path : ''
    });
  } catch (_err) {
    // no-op
  }
}

const onboardingSlides = [{ id: 'natural', copyKey: 'natural' }];

class PageOnboarding extends HTMLElement {
  constructor() {
    super();
    this.currentStep = 0;
    this._layoutRaf = 0;
    this._chromeRetryTimers = [];
    this._skipRestoreChromeOnDisconnect = false;
    this.touchGesture = {
      active: false,
      startX: 0,
      startY: 0,
      ignore: false
    };
  }

  connectedCallback() {
    const embedded = this.hasAttribute('embedded');
    if (!embedded) {
      this.classList.add('ion-page', 'onboarding-page');
    }
    this.render();
    this.cacheElements();
    this.bindEvents();
    if (!embedded) {
      this.applyOnboardingChrome();
    }
    this.updateSlide();
    this._localeHandler = () => {
      if (!this.isConnected) return;
      this.render();
      this.cacheElements();
      this.updateSlide();
    };
    window.addEventListener('app:locale-change', this._localeHandler);
  }

  normalizeLocale(locale) {
    return normalizeCopyLocale(locale);
  }

  getDeviceLocale() {
    const browserLocale =
      typeof navigator !== 'undefined'
        ? navigator.language || (Array.isArray(navigator.languages) ? navigator.languages[0] : '')
        : '';
    return (
      this.normalizeLocale(window.varGlobal?.locale) ||
      this.normalizeLocale(browserLocale) ||
      this.normalizeLocale(getAppLocale())
    );
  }

  getUiLocale() {
    return this.getDeviceLocale() || 'en';
  }

  getCopy() {
    return getOnboardingCopy(this.getUiLocale());
  }

  getSlideCopy(step, copy) {
    const key = step && step.copyKey ? step.copyKey : '';
    if (!key) return {};
    const slides = copy && copy.slides ? copy.slides : {};
    return slides[key] || {};
  }

  getNaturalCenterContent(slideCopy, locale) {
    const fallback =
      locale === 'es'
        ? {
            titleLines: [
              { text: 'Mejora tu', accent: false },
              { text: 'pronunciacion', accent: true },
              { text: 'del ingles', accent: false },
              { text: 'sonido por sonido', accent: true }
            ],
            subtitle: 'Sesiones donde podras corregir al instante y sonar natural',
            steps: [
              { num: '1', label: 'Escucha', icon: 'ear-outline', tone: 'violet' },
              { num: '2', label: 'Repite', icon: 'mic-outline', tone: 'blue' },
              { num: '3', label: 'Mejora', icon: 'trending-up-outline', tone: 'mint' }
            ]
          }
        : {
            titleLines: [
              { text: 'Improve your', accent: false },
              { text: 'English pronunciation', accent: true },
              { text: 'sound by', accent: false },
              { text: 'sound', accent: true }
            ],
            subtitle: 'Sessions where you can correct yourself instantly and sound natural',
            steps: [
              { num: '1', label: 'Listen', icon: 'ear-outline', tone: 'violet' },
              { num: '2', label: 'Repeat', icon: 'mic-outline', tone: 'blue' },
              { num: '3', label: 'Improve', icon: 'trending-up-outline', tone: 'mint' }
            ]
          };
    const titleLines = Array.isArray(slideCopy?.titleLines) && slideCopy.titleLines.length
      ? slideCopy.titleLines
      : fallback.titleLines;
    const steps = Array.isArray(slideCopy?.steps) && slideCopy.steps.length
      ? slideCopy.steps
      : fallback.steps;
    return {
      titleLines,
      subtitle: String(slideCopy?.subtitle || '').trim() || fallback.subtitle,
      steps
    };
  }

  render() {
    if (this.hasAttribute('embedded')) {
      this.innerHTML = `
        <div class="onboarding-v5-shell">
          <div class="onboarding-v5-stage" data-field="stage"></div>
        </div>
      `;
    } else {
      this.innerHTML = `
        <ion-content fullscreen>
          <div class="onboarding-v5-shell">
            <div class="onboarding-v5-stage" data-field="stage"></div>
          </div>
        </ion-content>
      `;
    }
  }

  cacheElements() {
    this.stageEl = this.querySelector('[data-field="stage"]');
    this.footerEl = this.querySelector('[data-field="footer"]');
    this.dotsEl = this.querySelector('[data-field="dots"]');
  }

  bindEvents() {
    const embedded = this.hasAttribute('embedded');
    this.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const action = String(button.dataset.action || '').trim();
      if (action === 'next') {
        this.goNextStep();
        return;
      }
      if (action === 'prev') {
        this.goPrevStep();
      }
    });
    this.addEventListener('touchstart', (event) => this.handleTouchStart(event), { passive: true });
    this.addEventListener('touchend', (event) => this.handleTouchEnd(event), { passive: true });
    this.addEventListener('touchcancel', () => this.resetSwipeGesture(), { passive: true });
    this._resizeHandler = () => this.scheduleHeroLayoutSync();
    window.addEventListener('resize', this._resizeHandler);
    this._visibilityHandler = null;
    this._resumeHandler = null;
    this._appStateChangeListener = null;
    this._deviceReadyHandler = null;
    this._deviceReadyHandler = () => {
      if (!embedded) this.applyOnboardingChrome();
    };
    document.addEventListener('deviceready', this._deviceReadyHandler);
  }

  updateSlide() {
    const copy = this.getCopy();
    const uiLocale = this.getUiLocale();
    const step = onboardingSlides[this.currentStep];
    const slideCopy = this.getSlideCopy(step, copy);
    const points = Array.isArray(slideCopy.points) ? slideCopy.points : [];
    const title = String(slideCopy.title || '').trim();
    const subtitle = String(slideCopy.subtitle || '').trim();
    const cta = String(slideCopy.cta || copy.cta || '').trim();
    const naturalCenter = this.getNaturalCenterContent(slideCopy, uiLocale);

    this.stageEl.innerHTML = `
      <article class="onboarding-v5-card" data-step="${step.id}">
        <div class="onboarding-v5-hero">
          <div class="onboarding-v5-test-block" aria-hidden="true">
            <span class="onboarding-v5-spark onboarding-v5-spark--star onboarding-v5-spark--s1"></span>
            <span class="onboarding-v5-spark onboarding-v5-spark--star onboarding-v5-spark--s2"></span>
            <span class="onboarding-v5-spark onboarding-v5-spark--star onboarding-v5-spark--s3"></span>
            <span class="onboarding-v5-spark onboarding-v5-spark--dot onboarding-v5-spark--d1"></span>
            <span class="onboarding-v5-spark onboarding-v5-spark--dot onboarding-v5-spark--d2"></span>
            <span class="onboarding-v5-spark onboarding-v5-spark--dot onboarding-v5-spark--d3"></span>
            <img class="onboarding-v5-test-block-image" src="${ONBOARDING_MASCOT_SRC}" alt="" />
          </div>
        </div>
        <div class="onboarding-v5-body">
          ${
            step.id === 'natural'
              ? `
            <h1 class="onboarding-v5-title onboarding-v5-title--stacked">
              ${naturalCenter.titleLines
                .map(
                  (line) =>
                    `<span class="onboarding-v5-title-line${line.accent ? ' is-accent' : ''}">${this.escapeHtml(line.text)}</span>`
                )
                .join('')}
            </h1>
            <p class="onboarding-v5-subtitle onboarding-v5-subtitle--center">${this.escapeHtml(naturalCenter.subtitle)}</p>
            <div class="onboarding-v5-steps" role="list">
              ${naturalCenter.steps
                .map(
                  (item, index) => `
                    <div class="onboarding-v5-step" role="listitem">
                      <div class="onboarding-v5-step-badge onboarding-v5-step-badge--${this.escapeHtml(item.tone)}" aria-hidden="true">
                        <ion-icon name="${this.escapeHtml(item.icon)}"></ion-icon>
                      </div>
                      <div class="onboarding-v5-step-meta">
                        <span class="onboarding-v5-step-num onboarding-v5-step-num--${this.escapeHtml(item.tone)}">${this.escapeHtml(item.num)}</span>
                        <span class="onboarding-v5-step-label">${this.escapeHtml(item.label)}</span>
                      </div>
                    </div>
                    ${index < naturalCenter.steps.length - 1 ? '<span class="onboarding-v5-step-arrow" aria-hidden="true">→</span>' : ''}
                  `
                )
                .join('')}
            </div>
          `
              : `
            <h1 class="onboarding-v5-title">${this.escapeHtml(title)}</h1>
            ${subtitle ? `<p class="onboarding-v5-subtitle">${this.escapeHtml(subtitle)}</p>` : ''}
            ${
              points.length
                ? `<ul class="onboarding-v5-points">
                    ${points
                      .map(
                        (point) => `
                          <li class="onboarding-v5-point">
                            <span class="onboarding-v5-point-icon" aria-hidden="true">
                              <ion-icon name="checkmark"></ion-icon>
                            </span>
                            <span>${this.escapeHtml(point)}</span>
                          </li>
                        `
                      )
                      .join('')}
                  </ul>`
                : '<div class="onboarding-v5-body-spacer"></div>'
            }
          `
          }
          ${
            this.currentStep === onboardingSlides.length - 1
              ? `<button class="onboarding-v5-cta" data-action="next" type="button">${this.escapeHtml(cta)}</button>`
              : ''
          }
        </div>
      </article>
    `;
    this.scheduleHeroLayoutSync();
  }

  goNextStep() {
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

  finish() {
    this._skipRestoreChromeOnDisconnect = true;
    this.clearChromeRetryTimers();
    setOnboardingDone();

    if (this.hasAttribute('embedded')) {
      window.dispatchEvent(new CustomEvent('app:onboarding-finish'));
      return;
    }

    try {
      if (typeof window.applyAppChromeForPath === 'function') {
        window.applyAppChromeForPath('/tabs');
      }
    } catch (_err) {
      // no-op
    }
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
  }

  handleTouchStart(event) {
    const touch = event.touches && event.touches[0];
    if (!touch) return;
    this.touchGesture.active = true;
    this.touchGesture.startX = touch.clientX;
    this.touchGesture.startY = touch.clientY;
    this.touchGesture.ignore = false;
  }

  handleTouchEnd(event) {
    if (!this.touchGesture.active || this.touchGesture.ignore) {
      this.resetSwipeGesture();
      return;
    }
    const touch = event.changedTouches && event.changedTouches[0];
    if (!touch) {
      this.resetSwipeGesture();
      return;
    }
    const dx = touch.clientX - this.touchGesture.startX;
    const dy = touch.clientY - this.touchGesture.startY;
    this.resetSwipeGesture();
    if (Math.abs(dy) > SWIPE_MAX_OFF_AXIS) return;
    if (dx <= -SWIPE_MIN_DISTANCE) {
      this.goNextStep();
      return;
    }
    if (dx >= SWIPE_MIN_DISTANCE && this.currentStep > 0) {
      this.currentStep -= 1;
      this.updateSlide();
    }
  }

  resetSwipeGesture() {
    this.touchGesture.active = false;
    this.touchGesture.startX = 0;
    this.touchGesture.startY = 0;
    this.touchGesture.ignore = false;
  }

  scheduleHeroLayoutSync() {
    if (this._layoutRaf) cancelAnimationFrame(this._layoutRaf);
    this._layoutTimers?.forEach(clearTimeout);
    this._layoutTimers = [];
    this._layoutRaf = requestAnimationFrame(() => {
      this._layoutRaf = 0;
      this.syncHeroLayout();
    });
    // Retries at increasing intervals — layout may settle later on first load
    [120, 320, 700, 1200, 1800].forEach(delay => {
      this._layoutTimers.push(setTimeout(() => this.syncHeroLayout(), delay));
    });
  }

  setThemeColor(color) {
    if (typeof document === 'undefined') return;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', color);
  }

  clearChromeRetryTimers() {
    this._chromeRetryTimers.forEach((timerId) => clearTimeout(timerId));
    this._chromeRetryTimers = [];
  }

  applyOnboardingChrome() {
    if (onboardingDone()) {
      console.log('[chrome] onboarding.applyOnboardingChrome skipped because onboardingDone');
      this.restoreDefaultChrome();
      return;
    }

    console.log('[chrome] onboarding.applyOnboardingChrome');
    document.body?.classList?.add('onboarding-chrome-active');
    const statusbarPreset = getStoredStatusbarPreset();
    const lightIcons = statusbarPreset === 'clear';
    this.setThemeColor(ONBOARDING_THEME_COLOR);
    document.body?.classList?.toggle('app-statusbar-items-clear', lightIcons);
    document.body?.classList?.toggle('app-statusbar-items-dark', !lightIcons);
    this.clearChromeRetryTimers();

    const applyNativeChrome = () => {
      try {
        const sb = window.Capacitor?.Plugins?.StatusBar;
        if (!sb) return;
        sb.setOverlaysWebView({ overlay: true });
        if (isAndroidPlatform()) {
          setNativeChrome(ONBOARDING_STATUSBAR_COLOR, lightIcons, {
            source: 'onboarding.applyOnboardingChrome',
            path: (window.location.hash || '').replace('#', '') || '/'
          });
        } else {
          sb.setBackgroundColor({ color: ONBOARDING_STATUSBAR_COLOR });
          sb.setStyle({ style: getStatusBarStyle(lightIcons) });
        }
      } catch (_err) {
        // no-op
      }
    };

    applyNativeChrome();
    [120, 320, 800].forEach((delay) => {
      const timerId = setTimeout(() => applyNativeChrome(), delay);
      this._chromeRetryTimers.push(timerId);
    });
  }

  restoreDefaultChrome() {
    console.log('[chrome] onboarding.restoreDefaultChrome');
    document.body?.classList?.remove('onboarding-chrome-active');
    const statusbarPreset = getStoredStatusbarPreset();
    const lightIcons = statusbarPreset === 'clear';
    this.setThemeColor(APP_STATUSBAR_COLOR);
    this.clearChromeRetryTimers();
    try {
      const sb = window.Capacitor?.Plugins?.StatusBar;
      if (!sb) return;
      sb.setOverlaysWebView({ overlay: true });
      if (isAndroidPlatform()) {
        setNativeChrome(APP_STATUSBAR_COLOR, lightIcons, {
          source: 'onboarding.restoreDefaultChrome',
          path: (window.location.hash || '').replace('#', '') || '/'
        });
      } else {
        sb.setBackgroundColor({ color: APP_STATUSBAR_COLOR });
        sb.setStyle({ style: getStatusBarStyle(lightIcons) });
      }
    } catch (_err) {
      // no-op
    }
  }

  syncHeroLayout() {
    const cardEl = this.stageEl?.querySelector('.onboarding-v5-card');
    const heroEl = this.stageEl?.querySelector('.onboarding-v5-hero');
    const mascotWrapEl = this.stageEl?.querySelector('.onboarding-v5-mascot-wrap');
    const mascotEl = this.stageEl?.querySelector('.onboarding-v5-mascot');
    if (!cardEl || !heroEl) return;

    const apply = () => {
      const heroRect = heroEl.getBoundingClientRect();
      if (!heroRect.height) return;

      const heroHeight = heroRect.height;
      const waveHeight = Math.max(178, Math.min(250, window.innerHeight * 0.22));
      // border-radius 50%/58% with left:-12% → screen edge intersects ellipse
      // at ~23.7% of waveHeight. Position wave so that point is at 40% of screen.
      const waveTop = Math.round(
        Math.max(heroHeight * 0.35, Math.min(heroHeight * 0.82,
          window.innerHeight * 0.4 - heroRect.top - 0.237 * waveHeight
        ))
      );

      // Size and position mascot so it always tracks the wave:
      // character bottom lands ~20px into the wave, assuming ~75% character fill.
      if (mascotEl && mascotEl.naturalWidth && mascotEl.naturalHeight) {
        const imageRatio = mascotEl.naturalHeight / mascotEl.naturalWidth;
        const mascotTop = 8;
        const mascotHeight = (waveTop + 50 - mascotTop) / 0.75;
        const mascotWidth = Math.round(mascotHeight / imageRatio);
        cardEl.style.setProperty('--onboarding-mascot-top', `${mascotTop}px`);
        cardEl.style.setProperty('--onboarding-mascot-width', `${mascotWidth}px`);
      }

      cardEl.style.setProperty('--onboarding-wave-top', `${waveTop}px`);
      cardEl.style.setProperty('--onboarding-wave-height', `${heroHeight - waveTop}px`);
      cardEl.style.setProperty('--onboarding-body-overlap',
        `${Math.round(Math.max(48, heroHeight - waveTop))}px`);
      cardEl.classList.add('is-laid-out');
    };

    if (!mascotEl || mascotEl.complete) {
      apply();
    } else {
      mascotEl.addEventListener('load', apply, { once: true });
    }
  }

  escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  disconnectedCallback() {
    this.clearChromeRetryTimers();
    if (!this._skipRestoreChromeOnDisconnect && !this.hasAttribute('embedded')) {
      this.restoreDefaultChrome();
    }
    if (this._localeHandler) {
      window.removeEventListener('app:locale-change', this._localeHandler);
      this._localeHandler = null;
    }
    if (this._deviceReadyHandler) {
      document.removeEventListener('deviceready', this._deviceReadyHandler);
    }
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
    if (this._visibilityHandler) {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
    }
    if (this._resumeHandler) {
      document.removeEventListener('resume', this._resumeHandler);
    }
    if (this._appStateChangeListener && typeof this._appStateChangeListener.remove === 'function') {
      this._appStateChangeListener.remove();
    }
    this._appStateChangeListener = null;
    if (this._layoutRaf) {
      cancelAnimationFrame(this._layoutRaf);
      this._layoutRaf = 0;
    }
    this._layoutTimers?.forEach(clearTimeout);
    this._layoutTimers = [];
  }
}

customElements.define('page-onboarding', PageOnboarding);
