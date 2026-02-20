import {
  ensureTrainingData,
  getRoutes,
  getSelection,
  resolveSelection,
  setSelection
} from '../data/training-data.js';
import { getAppLocale } from '../state.js';
import { goToSpeak } from '../nav.js';
import {
  getHomeCopy,
  getLocaleMeta,
  getNextLocaleCode,
  normalizeLocale as normalizeCopyLocale
} from '../content/copy.js';

const TTS_LANG_BY_LOCALE = {
  es: 'es-ES',
  en: 'en-US'
};

const PLAN_MASCOT_FRAME_COUNT = 9;
const PLAN_MASCOT_REST_FRAME = PLAN_MASCOT_FRAME_COUNT - 1;
const PLAN_MASCOT_FRAME_INTERVAL_MS = 150;

class PageHome extends HTMLElement {
  constructor() {
    super();
    this.state = {
      localeOverride: ''
    };
    this.expandedRouteId = '';
    this.expandedModuleId = '';
    this.currentUiLocale = 'en';
    this.currentPlanMessage = '';
    this.narrationToken = 0;
    this.narrationTimer = null;
    this.initialPlanNarrationStarted = this.hasAutoPlanNarrationPlayed();
    this.browserNarrationRetryAttempts = 0;
    this.browserNarrationRetryHandler = null;
    this.browserNarrationRetryTimer = null;
    this.pendingRoutesCenterScroll = null;
    this.routesCenterScrollTimers = [];
    this.planMascotFrameIndex = PLAN_MASCOT_REST_FRAME;
    this.planMascotFrameTimer = null;
    this.planMascotIsTalking = false;
  }

  connectedCallback() {
    this.classList.add('ion-page');
    const logoutUser = () => {
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
    };
    this._logoutUser = logoutUser;
    this.handleSelectionChange = () => {
      const { route, module } = resolveSelection(getSelection());
      if (route) this.expandedRouteId = route.id;
      if (module) this.expandedModuleId = module.id;
      this.render();
    };
    window.addEventListener('training:selection-change', this.handleSelectionChange);
    this.updateHeaderUser = (user) => {
      const infoEl = this.querySelector('#home-user-info');
      const nameEl = this.querySelector('#home-user-name');
      const avatarEl = this.querySelector('#home-user-avatar');
      const logoutBtn = this.querySelector('#home-logout-btn');
      if (!infoEl) return;
      const loggedIn = Boolean(user && user.id !== undefined && user.id !== null);
      infoEl.hidden = !loggedIn;
      if (logoutBtn) logoutBtn.hidden = !loggedIn;
      if (!loggedIn || !user) {
        if (nameEl) nameEl.textContent = '';
        if (avatarEl) {
          avatarEl.src = '';
          avatarEl.hidden = true;
        }
        return;
      }
      const name = user.name || user.first_name || user.email || user.social_id || '';
      const avatar = user.image_local || user.image || '';
      if (nameEl) nameEl.textContent = name || 'Usuario';
      if (avatarEl) {
        avatarEl.src = avatar || '';
        avatarEl.alt = name ? `Avatar ${name}` : 'Avatar';
        avatarEl.hidden = !avatar;
      }
    };
    this.updateHeaderRewards = () => {
      const container = this.querySelector('#home-reward-badges');
      if (!container) return;
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
        container.innerHTML = '';
        container.hidden = true;
        return;
      }
      container.hidden = false;
      container.innerHTML = entries
        .sort(([a], [b]) => a.localeCompare(b))
        .map(
          ([icon, qty]) =>
            `<div class="training-badge reward-badge"><ion-icon name="${icon}"></ion-icon><span>${qty}</span></div>`
        )
        .join('');
    };
    this._userHandler = (event) => this.updateHeaderUser(event.detail);
    window.addEventListener('app:user-change', this._userHandler);
    this._rewardsHandler = () => this.render();
    window.addEventListener('app:speak-stores-change', this._rewardsHandler);
    this._debugHandler = () => this.render();
    window.addEventListener('app:speak-debug', this._debugHandler);
    this._localeHandler = () => {
      if (!this.isConnected) return;
      if (this.normalizeLocale(this.state.localeOverride)) return;
      this.render();
    };
    window.addEventListener('app:locale-change', this._localeHandler);
    this._tabsDidChangeHandler = (event) => {
      const tab = event && event.detail ? event.detail.tab : '';
      if (tab !== 'home') return;
      const delayMs = this.isNativeRuntime() ? 180 : 90;
      this.schedulePlanNarration(delayMs, false);
    };
    this._tabsEl = this.getTabsEl();
    this._tabsEl?.addEventListener('ionTabsDidChange', this._tabsDidChangeHandler);
    if (!this.isNativeRuntime()) {
      this.setupBrowserNarrationRetry();
    }
    const initialDelayMs = this.isNativeRuntime() ? 280 : 950;
    this.render({
      narrationDelayMs: initialDelayMs,
      skipNarration: !this.isTabActive('home')
    });
  }

  disconnectedCallback() {
    if (this.handleSelectionChange) {
      window.removeEventListener('training:selection-change', this.handleSelectionChange);
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
    if (this._localeHandler) {
      window.removeEventListener('app:locale-change', this._localeHandler);
    }
    if (this._tabsDidChangeHandler) {
      if (this._tabsEl) {
        this._tabsEl.removeEventListener('ionTabsDidChange', this._tabsDidChangeHandler);
      }
      this._tabsEl = null;
      this._tabsDidChangeHandler = null;
    }
    this.teardownBrowserNarrationRetry();
    this.clearRoutesCenterScrollTimers();
    this.stopPlanMascotTalk({ settle: true });
    this.clearNarrationTimer();
    this.stopNarration().catch(() => {});
  }

  normalizePlanMascotFrameIndex(frameIndex) {
    const value = Number(frameIndex);
    if (!Number.isFinite(value)) return PLAN_MASCOT_REST_FRAME;
    const rounded = Math.round(value);
    return Math.min(Math.max(rounded, 0), PLAN_MASCOT_FRAME_COUNT - 1);
  }

  getPlanMascotFramePath(frameIndex = PLAN_MASCOT_REST_FRAME) {
    const normalized = this.normalizePlanMascotFrameIndex(frameIndex);
    const padded = String(normalized).padStart(2, '0');
    return `assets/mascot/mascota-boca-${padded}.png`;
  }

  getPlanMascotImageEl() {
    return this.querySelector('#home-plan-mascot');
  }

  getPlanBubbleEl() {
    return this.querySelector('.journey-plan-bubble');
  }

  setPlanBubbleSpeaking(isSpeaking) {
    const bubbleEl = this.getPlanBubbleEl();
    if (!bubbleEl) return;
    bubbleEl.classList.toggle('is-speaking', Boolean(isSpeaking));
  }

  renderPlanMascotFrame(frameIndex) {
    const normalized = this.normalizePlanMascotFrameIndex(frameIndex);
    this.planMascotFrameIndex = normalized;
    const imgEl = this.getPlanMascotImageEl();
    if (!imgEl) return;
    const nextSrc = this.getPlanMascotFramePath(normalized);
    if (imgEl.getAttribute('src') !== nextSrc) {
      imgEl.setAttribute('src', nextSrc);
    }
  }

  startPlanMascotTalk() {
    if (this.planMascotIsTalking) return;
    this.planMascotIsTalking = true;
    this.setPlanBubbleSpeaking(true);
    if (this.planMascotFrameTimer) {
      clearInterval(this.planMascotFrameTimer);
      this.planMascotFrameTimer = null;
    }
    let frame = 0;
    this.renderPlanMascotFrame(frame);
    this.planMascotFrameTimer = setInterval(() => {
      if (!this.planMascotIsTalking) return;
      frame = (frame + 1) % (PLAN_MASCOT_FRAME_COUNT - 1);
      this.renderPlanMascotFrame(frame);
    }, PLAN_MASCOT_FRAME_INTERVAL_MS);
  }

  stopPlanMascotTalk(options = {}) {
    const settle = options.settle !== false;
    this.planMascotIsTalking = false;
    this.setPlanBubbleSpeaking(false);
    if (this.planMascotFrameTimer) {
      clearInterval(this.planMascotFrameTimer);
      this.planMascotFrameTimer = null;
    }
    if (settle) {
      this.renderPlanMascotFrame(PLAN_MASCOT_REST_FRAME);
    }
  }

  clearRoutesCenterScrollTimers() {
    if (!Array.isArray(this.routesCenterScrollTimers) || !this.routesCenterScrollTimers.length) {
      this.routesCenterScrollTimers = [];
      return;
    }
    this.routesCenterScrollTimers.forEach((timerId) => {
      clearTimeout(timerId);
    });
    this.routesCenterScrollTimers = [];
  }

  queueRoutesCenterScroll(request = {}) {
    this.pendingRoutesCenterScroll = {
      routeId: request.routeId || '',
      moduleId: request.moduleId || '',
      sessionId: request.sessionId || '',
      fallback: request.fallback || 'session'
    };
  }

  findRouteHeader(routeId) {
    const headers = Array.from(this.querySelectorAll('.route-header'));
    return headers.find((el) => el.dataset.routeId === routeId) || null;
  }

  findModuleHeader(routeId, moduleId) {
    const headers = Array.from(this.querySelectorAll('.module-header'));
    return (
      headers.find(
        (el) => el.dataset.routeId === routeId && el.dataset.moduleId === moduleId
      ) || null
    );
  }

  findSessionRow(routeId, moduleId, sessionId = '') {
    const rows = Array.from(this.querySelectorAll('.module-sessions .training-row'));
    return (
      rows.find((row) => {
        if (routeId && row.dataset.routeId !== routeId) return false;
        if (moduleId && row.dataset.moduleId !== moduleId) return false;
        if (sessionId && row.dataset.sessionId !== sessionId) return false;
        return true;
      }) || null
    );
  }

  resolveRoutesCenterTarget(request = {}) {
    const routeId = request.routeId || '';
    const moduleId = request.moduleId || '';
    const sessionId = request.sessionId || '';
    const fallback = request.fallback || 'session';

    if (sessionId) {
      const exactSession = this.findSessionRow(routeId, moduleId, sessionId);
      if (exactSession) return exactSession;
    }

    if (fallback !== 'module') {
      const activeRow = this.findSessionRow(routeId, moduleId, '');
      if (activeRow) return activeRow;
    }

    if (moduleId) {
      const moduleHeader = this.findModuleHeader(routeId, moduleId);
      if (moduleHeader) return moduleHeader;
    }

    if (routeId) {
      const routeHeader = this.findRouteHeader(routeId);
      if (routeHeader) return routeHeader;
    }

    return this.querySelector('.journey-start-btn') || null;
  }

  async scrollRoutesTargetToCenter(targetEl, durationMs = 340) {
    if (!targetEl || !this.isConnected) return;
    const contentEl = this.querySelector('ion-content.home-journey');
    if (!contentEl) return;
    let scrollEl = null;
    if (typeof contentEl.getScrollElement === 'function') {
      try {
        scrollEl = await contentEl.getScrollElement();
      } catch (err) {
        scrollEl = null;
      }
    }
    if (!scrollEl) return;

    const scrollRect = scrollEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const delta = targetRect.top - scrollRect.top - (scrollRect.height - targetRect.height) / 2;
    const nextTop = Math.max(0, Math.round(scrollEl.scrollTop + delta));

    if (typeof contentEl.scrollToPoint === 'function') {
      try {
        await contentEl.scrollToPoint(0, nextTop, Math.max(0, durationMs));
      } catch (err) {
        // no-op
      }
      return;
    }

    scrollEl.scrollTo({
      top: nextTop,
      behavior: durationMs > 0 ? 'smooth' : 'auto'
    });
  }

  flushRoutesCenterScroll() {
    const request = this.pendingRoutesCenterScroll;
    this.pendingRoutesCenterScroll = null;
    if (!request) return;

    this.clearRoutesCenterScrollTimers();
    const delays = request.fallback === 'module' ? [80, 560] : [90, 620, 1240];

    delays.forEach((delayMs, idx) => {
      const timerId = setTimeout(() => {
        if (!this.isConnected) return;
        const target = this.resolveRoutesCenterTarget(request);
        if (!target) return;
        const duration = idx === 0 ? 760 : 980;
        this.scrollRoutesTargetToCenter(target, duration).catch(() => {});
      }, delayMs);
      this.routesCenterScrollTimers.push(timerId);
    });
  }

  render(options = {}) {
    this.clearRoutesCenterScrollTimers();
    const baseLocale = this.getBaseLocale();
    const uiLocale = this.getUiLocale(baseLocale);
    const copy = getHomeCopy(uiLocale);
    const planFlag = getLocaleMeta(uiLocale);
    const nextLocaleCode = getNextLocaleCode(uiLocale);
    const nextLocaleMeta = getLocaleMeta(nextLocaleCode);
    const toggleLanguageLabel = String(copy.toggleLanguage || '').replace(
      '{lang}',
      nextLocaleMeta.label
    );
    this.currentUiLocale = uiLocale;
    this.currentPlanMessage = copy.planMessage || '';
    const planMascotSrc = this.getPlanMascotFramePath(this.planMascotFrameIndex);

    const routes = getRoutes();
    if (!routes.length) {
      this.innerHTML = `
        <ion-header translucent="true">
          <ion-toolbar class="secret-title">
            <ion-title class="secret-title"></ion-title>
            <div class="app-header-actions" slot="end">
              <div class="app-user-info" id="home-user-info" hidden>
                <img class="app-user-avatar" id="home-user-avatar" alt="Avatar">
                <span class="app-user-name" id="home-user-name"></span>
              </div>
              <div class="reward-badges" id="home-reward-badges"></div>
              <ion-button fill="clear" size="small" class="app-notify-btn">
                <ion-icon slot="icon-only" name="notifications-outline"></ion-icon>
              </ion-button>
              <ion-button fill="clear" size="small" class="app-logout-btn" id="home-logout-btn" hidden>
                <ion-icon slot="icon-only" name="log-out-outline"></ion-icon>
              </ion-button>
            </div>
          </ion-toolbar>
        </ion-header>
        <ion-content fullscreen class="home-journey secret-content">
          <div class="journey-shell">
            <div class="journey-title">
              <h2 class="onboarding-intro-title">${copy.planTitle}</h2>
            </div>
            <section class="journey-plan-card onboarding-intro-card">
              <button class="onboarding-intro-flag-btn journey-plan-flag-btn" type="button" data-action="toggle-language" aria-label="${toggleLanguageLabel}" title="${toggleLanguageLabel}">
                <img class="onboarding-intro-flag" src="${planFlag.flag}" alt="${planFlag.alt}">
              </button>
              <span class="journey-plan-mascot-wrap" aria-hidden="true">
                <img
                  class="onboarding-intro-cat"
                  id="home-plan-mascot"
                  src="${planMascotSrc}"
                  alt=""
                >
              </span>
              <p class="onboarding-intro-bubble journey-plan-bubble">
                ${copy.planMessage}
              </p>
            </section>
          </div>
        </ion-content>
      `;
      this.bindPlanHeroEvents(options);
      ensureTrainingData().then(() => this.render());
      this.updateHeaderUser(window.user);
      this.updateHeaderRewards();
      this.renderPlanMascotFrame(this.planMascotFrameIndex);
      this.setPlanBubbleSpeaking(this.planMascotIsTalking);
      return;
    }

    const {
      route: activeRoute,
      module: activeModule,
      session: activeSession
    } = resolveSelection(getSelection());
    if (!activeRoute || !activeModule || !activeSession) return;

    const getFeedbackConfig = () => {
      const config = window.r34lp0w3r && window.r34lp0w3r.speakFeedback;
      return {
        toneScale: config && Array.isArray(config.toneScale) ? config.toneScale : [],
        labelScale: config && Array.isArray(config.labelScale) ? config.labelScale : []
      };
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

    const getGoodThreshold = () => {
      const { toneScale } = getFeedbackConfig();
      const normalized = normalizeScale(toneScale, 'tone');
      const match = normalized.find((item) => item.tone === 'good');
      return match && typeof match.min === 'number' ? match.min : 80;
    };

    const wordScoresStore =
      window.r34lp0w3r && window.r34lp0w3r.speakWordScores ? window.r34lp0w3r.speakWordScores : {};
    const phraseScoresStore =
      window.r34lp0w3r && window.r34lp0w3r.speakPhraseScores ? window.r34lp0w3r.speakPhraseScores : {};

    const hasSessionAttempts = (session) => {
      const wordScores = wordScoresStore[session.id] || {};
      const hasWord = Object.values(wordScores).some(
        (entry) => entry && typeof entry.percent === 'number'
      );
      const phrase = phraseScoresStore[session.id];
      const hasPhrase = phrase && typeof phrase.percent === 'number';
      return hasWord || hasPhrase;
    };

    const getWordsPercent = (session) => {
      const words =
        session && session.speak && session.speak.spelling && Array.isArray(session.speak.spelling.words)
          ? session.speak.spelling.words
          : [];
      if (!words.length) return 0;
      const sessionScores = wordScoresStore[session.id] || {};
      const total = words.reduce((sum, word) => {
        const stored = sessionScores[word];
        const value = stored && typeof stored.percent === 'number' ? stored.percent : 0;
        return sum + value;
      }, 0);
      return Math.round(total / words.length);
    };

    const getPhrasePercent = (session) => {
      const stored = phraseScoresStore[session.id];
      if (stored && typeof stored.percent === 'number') return stored.percent;
      return 0;
    };

    const getSessionPercent = (session) => {
      const wordsPercent = getWordsPercent(session);
      const phrasePercent = getPhrasePercent(session);
      return Math.round((wordsPercent + phrasePercent) / 2);
    };

    const getCorrectCount = (session) => {
      const words =
        session && session.speak && session.speak.spelling && Array.isArray(session.speak.spelling.words)
          ? session.speak.spelling.words
          : [];
      const sessionScores = wordScoresStore[session.id] || {};
      const threshold = getGoodThreshold();
      const wordCorrect = words.reduce((sum, word) => {
        const stored = sessionScores[word];
        const value = stored && typeof stored.percent === 'number' ? stored.percent : null;
        return sum + (value !== null && value >= threshold ? 1 : 0);
      }, 0);
      const phrase = phraseScoresStore[session.id];
      const phraseCorrect =
        phrase && typeof phrase.percent === 'number' && phrase.percent >= threshold ? 1 : 0;
      return { correct: wordCorrect + phraseCorrect, total: words.length + 1 };
    };

    const getModulePercent = (module) => {
      const sessions = module && Array.isArray(module.sessions) ? module.sessions : [];
      if (!sessions.length) return { started: false, percent: null, tone: 'neutral' };
      const started = sessions.some((session) => hasSessionAttempts(session));
      if (!started) return { started: false, percent: null, tone: 'neutral' };
      const total = sessions.reduce((sum, session) => sum + getSessionPercent(session), 0);
      const percent = Math.round(total / sessions.length);
      return { started: true, percent, tone: getScoreTone(percent) };
    };

    const getRoutePercent = (route) => {
      const modules = route && Array.isArray(route.modules) ? route.modules : [];
      if (!modules.length) return { started: false, percent: null, tone: 'neutral' };
      const moduleProgress = modules.map((module) => getModulePercent(module));
      const started = moduleProgress.some((entry) => entry.started);
      if (!started) return { started: false, percent: null, tone: 'neutral' };
      const total = moduleProgress.reduce(
        (sum, entry) => sum + (entry.started ? entry.percent : 0),
        0
      );
      const percent = Math.round(total / modules.length);
      return { started: true, percent, tone: getScoreTone(percent) };
    };

    const rewardsStore =
      window.r34lp0w3r && window.r34lp0w3r.speakSessionRewards
        ? window.r34lp0w3r.speakSessionRewards
        : {};

    const getRouteRewards = (route) => {
      const totals = {};
      const modules = route && Array.isArray(route.modules) ? route.modules : [];
      modules.forEach((module) => {
        const sessions = module && Array.isArray(module.sessions) ? module.sessions : [];
        sessions.forEach((session) => {
          if (!session) return;
          const reward = rewardsStore[session.id];
          if (!reward || typeof reward.rewardQty !== 'number') return;
          const icon = reward.rewardIcon || 'diamond';
          totals[icon] = (totals[icon] || 0) + reward.rewardQty;
        });
      });
      return totals;
    };

    const routeProgressList = routes.map((route) => getRoutePercent(route));
    const isDebug = Boolean(window.r34lp0w3r && window.r34lp0w3r.speakDebug);
    const routeUnlockList = routes.map((_, idx) => {
      if (isDebug) return true;
      if (idx === 0) return true;
      const prev = routeProgressList[idx - 1];
      return prev && prev.tone === 'good';
    });

    const activeRouteIndex = routes.findIndex((item) => item.id === activeRoute.id);
    const activeRouteUnlocked = activeRouteIndex === 0 || routeUnlockList[activeRouteIndex] === true;

    if (!activeRouteUnlocked) {
      const lastUnlockedIndex = routeUnlockList.lastIndexOf(true);
      const fallbackIndex = lastUnlockedIndex >= 0 ? lastUnlockedIndex : 0;
      const fallbackRoute = routes[fallbackIndex];
      const fallbackModule = fallbackRoute.modules[0];
      const fallbackSession = fallbackModule.sessions[0];
      setSelection({
        routeId: fallbackRoute.id,
        moduleId: fallbackModule.id,
        sessionId: fallbackSession.id
      });
      return;
    }

    if (!this.expandedRouteId || !routes.some((item) => item.id === this.expandedRouteId)) {
      this.expandedRouteId = activeRoute.id;
    }
    const expandedRoute = routes.find((item) => item.id === this.expandedRouteId) || activeRoute;
    const expandedRouteIndex = routes.findIndex((item) => item.id === expandedRoute.id);
    const expandedRouteUnlocked =
      expandedRouteIndex === 0 || routeUnlockList[expandedRouteIndex] === true;
    if (
      !this.expandedModuleId ||
      !expandedRoute.modules.some((item) => item.id === this.expandedModuleId)
    ) {
      this.expandedModuleId =
        expandedRoute.id === activeRoute.id
          ? activeModule.id
          : expandedRoute.modules[0]
            ? expandedRoute.modules[0].id
            : '';
    }

    const showLockedRouteToast = (routeIndex) => {
      const prevRoute = routeIndex > 0 ? routes[routeIndex - 1] : null;
      const message = prevRoute
        ? `Aún no puedes acceder a este modulo. Completa primero la ruta anterior: ${prevRoute.title}.`
        : 'Aún no puedes acceder a este modulo.';
      const toast = document.createElement('ion-toast');
      toast.message = message;
      toast.duration = 2200;
      toast.position = 'top';
      document.body.appendChild(toast);
      toast.present().catch(() => {});
      toast.addEventListener('didDismiss', () => {
        toast.remove();
      });
    };

    const accordionMarkup = routes
      .map((route, routeIndex) => {
        const isRouteOpen = route.id === this.expandedRouteId;
        const routeUnlocked = routeIndex === 0 || routeUnlockList[routeIndex] === true;
        const routeProgress = routeProgressList[routeIndex];
        const routeRewards = getRouteRewards(route);
        const rewardEntries = Object.entries(routeRewards).filter(([, qty]) => qty > 0);
        const hasRouteRewards = rewardEntries.length > 0;
        const routeRewardsMarkup = hasRouteRewards
          ? `<div class="route-badges">${rewardEntries
              .sort(([a], [b]) => a.localeCompare(b))
              .map(
                ([icon, qty]) =>
                  `<div class="training-badge reward-badge"><ion-icon name="${icon}"></ion-icon><span>${qty}</span></div>`
              )
              .join('')}</div>`
          : '';
        const routePercentMarkup =
          routeProgress && routeProgress.started
            ? `<span class="route-progress ${routeProgress.tone}">${routeProgress.percent}%</span>`
            : '';
        const modulesMarkup = route.modules
          .map((module) => {
            const isActive = route.id === activeRoute.id && module.id === activeModule.id;
            const isModuleOpen = isRouteOpen && module.id === this.expandedModuleId;
            const progress = getModulePercent(module);
            const moduleClass = progress.started ? '' : 'module-item-neutral';
            const lockedClass = routeUnlocked ? '' : 'module-item-locked';
            const progressMarkup = progress.started
              ? `<span class="module-progress ${progress.tone}">${progress.percent}%</span>`
              : '';
            const sessionsMarkup =
              routeUnlocked && isModuleOpen
                ? `<div class="module-sessions training-list">${module.sessions
                    .map((item) => {
                      const sessionProgress = getCorrectCount(item);
                      const progressText = `${sessionProgress.correct}/${sessionProgress.total}`;
                      const started = hasSessionAttempts(item);
                      const sessionPercent = started ? getSessionPercent(item) : null;
                      const labelText =
                        started && sessionPercent !== null ? getScoreLabel(sessionPercent) : '';
                      const tone =
                        started && sessionPercent !== null ? getScoreTone(sessionPercent) : 'neutral';
                      const toneClass =
                        tone === 'good'
                          ? 'good'
                          : tone === 'okay'
                            ? 'warn'
                            : tone === 'bad'
                              ? 'bad'
                              : 'neutral';
                      const scoreText = started && sessionPercent !== null ? `${sessionPercent}%` : '';
                      const reward = rewardsStore[item.id];
                      const rewardIcon = reward && reward.rewardIcon ? reward.rewardIcon : 'diamond';
                      const rewardQty =
                        reward && typeof reward.rewardQty === 'number' ? reward.rewardQty : null;
                      const rewardMarkup =
                        rewardQty !== null && started
                          ? `<div class="training-row-reward">
                          <ion-icon name="${rewardIcon}"></ion-icon>
                          <span>${rewardQty}</span>
                        </div>`
                          : '';
                      const isCurrentSession =
                        route.id === activeRoute.id &&
                        module.id === activeModule.id &&
                        item.id === activeSession.id;
                      const iconClass = toneClass !== 'neutral' ? `training-row-icon-${toneClass}` : '';
                      return `
                        <div
                          class="training-row ${isCurrentSession ? 'is-active' : ''}"
                          data-session-id="${item.id}"
                          data-route-id="${route.id}"
                          data-module-id="${module.id}"
                          data-locked="${routeUnlocked ? '0' : '1'}"
                        >
                          <div class="training-row-icon ${iconClass}">
                            <ion-icon name="play"></ion-icon>
                          </div>
                          <div class="training-row-body">
                            <div class="training-row-title">${item.title}</div>
                            <div class="training-row-sub">${progressText}</div>
                          </div>
                          <div class="training-row-status training-row-status-${toneClass}">
                            ${rewardMarkup}
                            ${scoreText ? `<span>${scoreText}</span>` : ''}
                            ${labelText ? `<span>${labelText}</span>` : ''}
                          </div>
                          <ion-icon name="chevron-forward" class="training-row-arrow"></ion-icon>
                        </div>
                      `;
                    })
                    .join('')}</div>`
                : '';

            return `
              <div class="module-item ${moduleClass} ${lockedClass} ${isActive ? 'is-active' : ''} ${isModuleOpen ? 'is-open' : ''}">
                <button
                  class="module-header"
                  type="button"
                  data-locked="${routeUnlocked ? '0' : '1'}"
                  data-route-id="${route.id}"
                  data-module-id="${module.id}"
                >
                  <div>
                    <div class="module-title">${module.title}</div>
                    <div class="module-sub">${module.subtitle}</div>
                  </div>
                  <div class="module-meta">
                    ${progressMarkup}
                    <ion-icon name="${isModuleOpen ? 'chevron-down' : 'chevron-forward'}"></ion-icon>
                  </div>
                </button>
                ${sessionsMarkup}
              </div>
            `;
          })
          .join('');

        return `
          <div class="route-item ${isRouteOpen ? 'is-open' : ''} ${hasRouteRewards ? 'has-rewards' : ''}">
            <button
              class="route-header"
              type="button"
              data-route-id="${route.id}"
              data-locked="${routeUnlocked ? '0' : '1'}"
            >
              <span>${route.title}</span>
              <div class="route-header-meta">
                ${routePercentMarkup}
                <ion-icon name="chevron-down"></ion-icon>
              </div>
            </button>
            ${route.note ? `<div class="route-note">${route.note}</div>` : ''}
            ${routeRewardsMarkup}
            <div class="route-modules">
              ${modulesMarkup}
            </div>
          </div>
        `;
      })
      .join('');

    this.innerHTML = `
      <ion-header translucent="true">
        <ion-toolbar class="secret-title">
          <ion-title class="secret-title"></ion-title>
          <div class="app-header-actions" slot="end">
            <div class="app-user-info" id="home-user-info" hidden>
              <img class="app-user-avatar" id="home-user-avatar" alt="Avatar">
              <span class="app-user-name" id="home-user-name"></span>
            </div>
            <div class="reward-badges" id="home-reward-badges"></div>
            <ion-button fill="clear" size="small" class="app-notify-btn">
              <ion-icon slot="icon-only" name="notifications-outline"></ion-icon>
            </ion-button>
            <ion-button fill="clear" size="small" class="app-logout-btn" id="home-logout-btn" hidden>
              <ion-icon slot="icon-only" name="log-out-outline"></ion-icon>
            </ion-button>
          </div>
        </ion-toolbar>
      </ion-header>
      <ion-content fullscreen class="home-journey secret-content">
        <div class="journey-shell">
          <div class="journey-title">
            <h2 class="onboarding-intro-title">${copy.planTitle}</h2>
          </div>

          <section class="journey-plan-card onboarding-intro-card">
            <button class="onboarding-intro-flag-btn journey-plan-flag-btn" type="button" data-action="toggle-language" aria-label="${toggleLanguageLabel}" title="${toggleLanguageLabel}">
              <img class="onboarding-intro-flag" src="${planFlag.flag}" alt="${planFlag.alt}">
            </button>
            <span class="journey-plan-mascot-wrap" aria-hidden="true">
              <img
                class="onboarding-intro-cat"
                id="home-plan-mascot"
                src="${planMascotSrc}"
                alt=""
              >
            </span>
            <p class="onboarding-intro-bubble journey-plan-bubble">
              ${copy.planMessage}
            </p>
          </section>

          <div class="journey-start">
            <div class="journey-start-pill">${expandedRoute.title}</div>
            <button class="journey-start-btn ${expandedRouteUnlocked ? '' : 'is-locked'}" type="button">
              Start
            </button>
          </div>

          <div class="journey-accordion">
            ${accordionMarkup}
          </div>
        </div>
      </ion-content>
    `;

    this.querySelector('.journey-start-btn')?.addEventListener('click', () => {
      if (!expandedRouteUnlocked) {
        showLockedRouteToast(expandedRouteIndex);
        return;
      }
      const startModule =
        expandedRoute.modules.find((item) => item.id === this.expandedModuleId) ||
        expandedRoute.modules[0];
      if (!startModule || !Array.isArray(startModule.sessions) || !startModule.sessions.length) return;
      const firstSession = startModule.sessions[0];
      const startSession =
        expandedRoute.id === activeRoute.id &&
        startModule.id === activeModule.id &&
        activeSession &&
        startModule.sessions.some((item) => item.id === activeSession.id)
          ? activeSession
          : firstSession;
      setSelection({
        routeId: expandedRoute.id,
        moduleId: startModule.id,
        sessionId: startSession.id
      });
      goToSpeak('forward');
    });

    const routeButtons = Array.from(this.querySelectorAll('.route-header'));
    routeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const routeId = button.dataset.routeId;
        if (!routeId) return;
        if (button.dataset.locked === '1') {
          const routeIndex = routes.findIndex((item) => item.id === routeId);
          showLockedRouteToast(routeIndex);
          return;
        }
        this.expandedRouteId = routeId;
        const route = routes.find((item) => item.id === routeId);
        if (!route) return;
        if (!route.modules.some((item) => item.id === this.expandedModuleId)) {
          this.expandedModuleId = route.modules[0] ? route.modules[0].id : '';
        }
        const routeModule =
          route.modules.find((item) => item.id === this.expandedModuleId) ||
          route.modules[0] ||
          null;
        const targetSession =
          routeModule &&
          Array.isArray(routeModule.sessions) &&
          routeModule.sessions.length &&
          route.id === activeRoute.id &&
          routeModule.id === activeModule.id &&
          activeSession &&
          routeModule.sessions.some((item) => item.id === activeSession.id)
            ? activeSession
            : routeModule && Array.isArray(routeModule.sessions) && routeModule.sessions.length
              ? routeModule.sessions[0]
              : null;
        this.queueRoutesCenterScroll({
          routeId,
          moduleId: routeModule ? routeModule.id : '',
          sessionId: targetSession ? targetSession.id : ''
        });
        this.render();
      });
    });

    const moduleButtons = Array.from(this.querySelectorAll('.module-header'));
    moduleButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const routeId = button.dataset.routeId;
        const moduleId = button.dataset.moduleId;
        if (!routeId || !moduleId) return;
        if (button.dataset.locked === '1') {
          const routeIndex = routes.findIndex((item) => item.id === routeId);
          showLockedRouteToast(routeIndex);
          return;
        }
        const route = routes.find((item) => item.id === routeId);
        const module =
          route && Array.isArray(route.modules)
            ? route.modules.find((item) => item.id === moduleId)
            : null;
        const isClosing = this.expandedModuleId === moduleId;
        this.expandedRouteId = routeId;
        this.expandedModuleId = isClosing ? '' : moduleId;
        if (isClosing) {
          this.queueRoutesCenterScroll({
            routeId,
            moduleId,
            sessionId: '',
            fallback: 'module'
          });
        } else {
          const targetSession =
            module &&
            Array.isArray(module.sessions) &&
            module.sessions.length &&
            routeId === activeRoute.id &&
            moduleId === activeModule.id &&
            activeSession &&
            module.sessions.some((item) => item.id === activeSession.id)
              ? activeSession
              : module && Array.isArray(module.sessions) && module.sessions.length
                ? module.sessions[0]
                : null;
          this.queueRoutesCenterScroll({
            routeId,
            moduleId,
            sessionId: targetSession ? targetSession.id : ''
          });
        }
        this.render();
      });
    });

    const sessionRows = Array.from(this.querySelectorAll('.module-sessions .training-row'));
    sessionRows.forEach((row) => {
      row.addEventListener('click', () => {
        if (row.dataset.locked === '1') {
          const routeIndex = routes.findIndex((item) => item.id === row.dataset.routeId);
          showLockedRouteToast(routeIndex);
          return;
        }
        const routeId = row.dataset.routeId;
        const moduleId = row.dataset.moduleId;
        const sessionId = row.dataset.sessionId;
        if (!routeId || !moduleId || !sessionId) return;
        setSelection({
          routeId,
          moduleId,
          sessionId
        });
        goToSpeak('forward');
      });
    });

    this.querySelector('#home-logout-btn')?.addEventListener('click', this._logoutUser);
    this.updateHeaderUser(window.user);
    this.updateHeaderRewards();
    this.bindPlanHeroEvents(options);
    this.flushRoutesCenterScroll();
    this.renderPlanMascotFrame(this.planMascotFrameIndex);
    this.setPlanBubbleSpeaking(this.planMascotIsTalking);
  }

  bindPlanHeroEvents(options = {}) {
    const toggleLanguageBtn = this.querySelector('[data-action="toggle-language"]');
    toggleLanguageBtn?.addEventListener('click', () => {
      this.toggleLocaleFromFlag();
    });
    if (options.skipNarration) {
      this.clearNarrationTimer();
      return;
    }
    const forceNarration = Boolean(options.forceNarration);
    const narrationDelayMs =
      typeof options.narrationDelayMs === 'number' ? options.narrationDelayMs : 90;
    this.schedulePlanNarration(narrationDelayMs, forceNarration);
  }

  normalizeLocale(locale) {
    return normalizeCopyLocale(locale);
  }

  getBaseLocale() {
    const fromState = getAppLocale() || (window.varGlobal && window.varGlobal.locale) || 'en';
    return this.normalizeLocale(fromState) || 'en';
  }

  getUiLocale(baseLocale = '') {
    const overrideLocale = this.normalizeLocale(this.state.localeOverride);
    if (overrideLocale) return overrideLocale;
    return this.normalizeLocale(baseLocale) || this.getBaseLocale();
  }

  getTabsEl() {
    return this.closest('ion-tabs') || document.querySelector('tabs-page ion-tabs');
  }

  isTabActive(tabName = 'home') {
    const tabHost = this.closest('ion-tab');
    if (tabHost) {
      const hostTab = String(tabHost.getAttribute('tab') || '');
      if (tabName && hostTab && hostTab !== tabName) return false;
      if (tabHost.getAttribute('aria-hidden') === 'true') return false;
      if (tabHost.classList.contains('tab-hidden')) return false;
      const styles = window.getComputedStyle ? window.getComputedStyle(tabHost) : null;
      if (styles && styles.display === 'none') return false;
    }
    const tabsEl = this.getTabsEl();
    if (tabsEl && tabName) {
      const selectedFromAttr = String(tabsEl.getAttribute('selected-tab') || '');
      const selectedFromProp =
        typeof tabsEl.selectedTab === 'string' ? String(tabsEl.selectedTab) : '';
      const selected = selectedFromAttr || selectedFromProp;
      if (selected && selected !== tabName) return false;
    }
    return true;
  }

  toggleLocaleFromFlag() {
    const baseLocale = this.getBaseLocale();
    const currentUiLocale = this.getUiLocale(baseLocale);
    const nextLocale = currentUiLocale === 'en' ? 'es' : 'en';
    this.state.localeOverride = nextLocale === baseLocale ? '' : nextLocale;
    this.render({ forceNarration: true, narrationDelayMs: 80 });
  }

  getNativeTtsPlugin() {
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
      window.speechSynthesis.cancel();
    }
    this.stopPlanMascotTalk({ settle: true });
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

  hasAutoPlanNarrationPlayed() {
    if (typeof window === 'undefined') return false;
    const appState = window.r34lp0w3r;
    return Boolean(appState && appState.homePlanAutoNarrationPlayed);
  }

  markAutoPlanNarrationPlayed() {
    if (typeof window === 'undefined') return;
    if (!window.r34lp0w3r) window.r34lp0w3r = {};
    window.r34lp0w3r.homePlanAutoNarrationPlayed = true;
  }

  setupBrowserNarrationRetry() {
    if (this.browserNarrationRetryHandler || this.isNativeRuntime()) return;
    if (this.initialPlanNarrationStarted || this.hasAutoPlanNarrationPlayed()) return;
    this.browserNarrationRetryHandler = () => {
      if (!this.isConnected) return;
      if (this.initialPlanNarrationStarted) return;
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
    if (this.initialPlanNarrationStarted) return;
    if (!force && this.browserNarrationRetryAttempts >= 7) return;
    if (this.browserNarrationRetryTimer) return;
    const waitMs = Math.max(0, Number(delayMs) || 0);
    this.browserNarrationRetryTimer = setTimeout(() => {
      this.browserNarrationRetryTimer = null;
      if (!this.isConnected || this.initialPlanNarrationStarted) return;
      this.browserNarrationRetryAttempts += 1;
      this.playPlanNarration().then((started) => {
        if (started || this.initialPlanNarrationStarted) return;
        this.queueBrowserNarrationRetry(1400);
      });
    }, waitMs);
  }

  schedulePlanNarration(delayMs, forceNarration = false) {
    this.clearNarrationTimer();
    if (!forceNarration && this.initialPlanNarrationStarted) return;
    if (!forceNarration && !this.isTabActive('home')) return;
    const waitMs = Number.isFinite(delayMs) ? Math.max(0, delayMs) : 90;
    this.narrationTimer = setTimeout(() => {
      this.narrationTimer = null;
      if (!this.isConnected) return;
      if (!forceNarration && !this.isTabActive('home')) return;
      this.playPlanNarration();
    }, waitMs);
  }

  playPlanNarration() {
    if (!this.isTabActive('home')) {
      return Promise.resolve(false);
    }
    const text = this.extractSpeechText(this.currentPlanMessage);
    if (!text) {
      this.stopNarration().catch(() => {});
      return Promise.resolve(false);
    }
    const locale = this.getUiLocale(this.currentUiLocale);
    return this.speakNarration(text, locale)
      .then((started) => {
        if (started && !this.initialPlanNarrationStarted) {
          this.initialPlanNarrationStarted = true;
          this.markAutoPlanNarrationPlayed();
          this.teardownBrowserNarrationRetry();
        }
        return started;
      })
      .catch((err) => {
        console.warn('[home] narration error', err);
        return false;
      });
  }

  async speakNarrationWeb(text, lang, normalizedLocale, token, voiceWaitMs = 1200, hooks = {}) {
    if (!this.canWebSpeak()) return false;
    await this.waitForDocumentVisible(1800);
    if (token !== this.narrationToken) return true;
    await this.waitForWebVoices(voiceWaitMs);
    if (token !== this.narrationToken) return true;

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    const voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
    const langPrefix = normalizedLocale === 'en' ? 'en' : 'es';
    const voiceMatch =
      voices.find((voice) => String(voice.lang || '').toLowerCase() === String(lang).toLowerCase()) ||
      voices.find((voice) => String(voice.lang || '').toLowerCase().startsWith(langPrefix));
    if (voiceMatch) {
      utter.voice = voiceMatch;
    }

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
        window.speechSynthesis.speak(utter);
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
    if (token !== this.narrationToken) return;

    const plugin = this.getNativeTtsPlugin();
    if (plugin && typeof plugin.speak === 'function') {
      this.startPlanMascotTalk();
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
          this.stopPlanMascotTalk({ settle: true });
        }
      }
    }

    const hooks = {
      onPlaybackStart: () => {
        if (token !== this.narrationToken) return;
        this.startPlanMascotTalk();
      },
      onPlaybackEnd: () => {
        if (token !== this.narrationToken) return;
        this.stopPlanMascotTalk({ settle: true });
      }
    };

    const started = await this.speakNarrationWeb(
      text,
      lang,
      normalizedLocale,
      token,
      1500,
      hooks
    );
    if (started || token !== this.narrationToken) return started;

    await new Promise((resolve) => setTimeout(resolve, 450));
    if (token !== this.narrationToken) return false;
    await this.stopNarrationPlayback();
    if (token !== this.narrationToken) return false;
    return this.speakNarrationWeb(text, lang, normalizedLocale, token, 3200, hooks);
  }
}

customElements.define('page-home', PageHome);
