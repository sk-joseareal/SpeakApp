import {
  ensureTrainingData,
  getLocalizedContentField,
  getRoutes,
  getSelection,
  resolveSelection,
  setSelection
} from '../data/training-data.js';
import { getAppLocale, setAppLocale, getActiveLocale, setLocaleOverride } from '../state.js';
import { goToSpeak } from '../nav.js';
import {
  getHomeCopy,
  getNextLocaleCode,
  getSpeakCopy,
  getSpeakFeedbackPhrases,
  normalizeLocale as normalizeCopyLocale
} from '../content/copy.js';
import { renderAppHeader } from '../components/app-header.js';
import {
  HERO_MASCOT_FRAMES as PLAN_MASCOT_FRAMES,
  HERO_MASCOT_FRAME_INTERVAL_MS as PLAN_MASCOT_FRAME_INTERVAL_MS,
  HERO_MASCOT_REST_FRAME as PLAN_MASCOT_REST_FRAME,
  HERO_MASCOT_TALK_FRAME_SEQUENCE as PLAN_MASCOT_TALK_FRAME_SEQUENCE,
  preloadHeroMascotFrames
} from '../mascot-frames.js';

const TTS_LANG_BY_LOCALE = {
  es: 'es-ES',
  en: 'en-US'
};

const BROWSER_AUTONARRATION_EXTRA_DELAY_MS = 120;
const SPEAK_SESSION_PERCENTAGES_VISIBLE_KEY = 'appv5:speak-session-percentages-visible';
const HOME_ALIGNED_CACHE_MAX_ITEMS = 24;
const HOME_PLAN_AUTONARRATION_PLAYED_KEY = 'appv5:home-plan-auto-narration-played';
const HOME_EXPANDED_ROUTE_KEY = 'appv5:home-expanded-route-id';
const HOME_RETURN_SCROLL_KEY = 'appv5:home-return-scroll-top';
const HOME_RETURN_REVEAL_KEY = 'appv5:home-return-reveal-target';
const HOME_HANDLE_HINT_KEY = 'appv5:home-handle-hint-seen';
const isHandleHintSeen = () => {
  try { return Boolean(localStorage.getItem(HOME_HANDLE_HINT_KEY)); } catch (_) { return true; }
};
const FREE_RIDE_HEADER_COLOR_KEY = 'appv5:free-ride-header-color';
const FREE_RIDE_CARD_PADDED_KEY = 'appv5:free-ride-card-padded';
const FREE_RIDE_HEADER_COLOR_VALUES = ['white', 'dark', 'blue'];
const MODULE_AUDIO_ICON = `
  <span class="module-audio-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M4.5 14.5V9.5"></path>
      <path d="M8.5 17.5V6.5"></path>
      <path d="M12.5 20V4"></path>
      <path d="M16.5 16.5V7.5"></path>
      <path d="M20.5 13.5V10.5"></path>
    </svg>
  </span>
`;
const SESSION_CIRCLE_COLORS = [
  '#4A7DFF',
  '#8B5CF6',
  '#F97316',
  '#10B981',
  '#06B6D4',
  '#EC4899',
  '#F59E0B',
  '#6366F1'
];

const getResolvedUserName = (user) => {
  if (!user || typeof user !== 'object') return '';
  const derived = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return derived || String(user.name || user.email || user.social_id || '').trim();
};

const getStoredHeaderColor = () => {
  try {
    const raw = String(localStorage.getItem(FREE_RIDE_HEADER_COLOR_KEY) || '').trim().toLowerCase();
    return FREE_RIDE_HEADER_COLOR_VALUES.includes(raw) ? raw : 'blue';
  } catch (_err) {
    return 'blue';
  }
};

const isFreeRideCardPadded = () => {
  try {
    const raw = localStorage.getItem(FREE_RIDE_CARD_PADDED_KEY);
    if (raw === null || raw === undefined || raw === '') return true;
    const normalized = String(raw).trim().toLowerCase();
    return ['1', 'true', 'on', 'yes'].includes(normalized);
  } catch (_err) {
    return true;
  }
};

const hashTextToIndex = (text, modulo) => {
  const value = String(text || '').trim();
  if (!value || !modulo) return 0;
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % modulo;
};

const shufflePalette = (seed, palette) => {
  const items = Array.isArray(palette) ? palette.slice() : [];
  if (items.length < 2) return items;
  let hash = 2166136261 ^ hashTextToIndex(seed, 0x7fffffff);
  for (let index = items.length - 1; index > 0; index -= 1) {
    hash ^= hash << 13;
    hash ^= hash >>> 17;
    hash ^= hash << 5;
    const swapIndex = Math.abs(hash) % (index + 1);
    const temp = items[index];
    items[index] = items[swapIndex];
    items[swapIndex] = temp;
  }
  return items;
};

class PageHome extends HTMLElement {
  constructor() {
    super();
    this.state = {
      localeOverride: ''
    };
    this.expandedRouteId = (() => { try { const v = localStorage.getItem(HOME_EXPANDED_ROUTE_KEY); return v !== null ? v : null; } catch { return null; } })();
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
    this.narrationAudio = null;
    this.alignedTtsCache = new Map();
    this.planNarrationPromise = null;
    this.homeScrollTop = 0;
    this._homeScrollEl = null;
    this._homeScrollHandler = null;
    this._homeScrollBindToken = 0;
    this._pendingHomeReturnRestoreTimers = [];
    this._pendingHomeReturnRevealTimers = [];
    this._pendingHomeReturnRevealScheduleToken = 0;
    this._renderRAFId = null;
    this._pendingRenderOptions = {};
    this.journeySheetExpanded = false;
    this.journeySheetExpandedOffset = 0;
    this.journeySheetTranslateY = 0;
    this.journeySheetDragging = false;
    this._hintWasExpanded = false;
    this.journeySheetPointerId = null;
    this.journeySheetDragStartY = 0;
    this.journeySheetDragStartTranslateY = 0;
    this.journeySheetDragMoved = false;
    this.journeySheetLastPointerUpTs = 0;
    this.layoutSyncTimer = null;
    this.layoutSyncRaf = null;
    this.layoutSyncVersion = 0;
  }

  connectedCallback() {
    this.classList.add('ion-page');
    this.applyHeaderColor(getStoredHeaderColor());
    this.classList.toggle('is-card-padded', isFreeRideCardPadded());
    preloadHeroMascotFrames();
    this.handleSelectionChange = () => {
      const restoreScrollTop = this.homeScrollTop;
      const { route, module } = resolveSelection(getSelection());
      if (route) {
        const stored = (() => { try { return localStorage.getItem(HOME_EXPANDED_ROUTE_KEY); } catch { return null; } })();
        if (stored === null) {
          this.expandedRouteId = route.id;
          try { localStorage.setItem(HOME_EXPANDED_ROUTE_KEY, route.id); } catch {}
        }
      }
      if (module) this.expandedModuleId = module.id;
      this.render({ restoreScrollTop });
    };
    window.addEventListener('training:selection-change', this.handleSelectionChange);
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
    this._profileLocaleToggleHandler = () => {
      if (!this.isConnected) return;
      const hasManualOverride = this.normalizeLocale(this.state.localeOverride);
      if (!hasManualOverride) return;
      const baseLocale = this.getBaseLocale();
      const currentUiLocale = this.getUiLocale(baseLocale);
      const nextUiLocale = getNextLocaleCode(currentUiLocale);
      this.state.localeOverride = nextUiLocale === baseLocale ? '' : nextUiLocale;
      this.render();
    };
    window.addEventListener('app:profile-locale-toggle', this._profileLocaleToggleHandler);
    this._headerColorHandler = (event) => {
      if (!this.isConnected) return;
      const color = event?.detail?.color || getStoredHeaderColor();
      this.applyHeaderColor(color);
    };
    window.addEventListener('app:free-ride-header-color-change', this._headerColorHandler);
    this._cardPaddedHandler = (event) => {
      if (!this.isConnected) return;
      const detail = event && event.detail ? event.detail : {};
      const enabled = typeof detail.enabled === 'boolean' ? detail.enabled : isFreeRideCardPadded();
      this.classList.toggle('is-card-padded', enabled);
      this.journeySheetExpandedOffset = this.measureJourneySheetExpandedOffset();
      this.applyJourneySheetState({ animate: false, force: true });
      this.scheduleLayoutSync(0);
    };
    window.addEventListener('app:free-ride-card-padded-change', this._cardPaddedHandler);
    this._sessionPercentagesVisibilityHandler = () => {
      if (!this.isConnected) return;
      this.render();
    };
    window.addEventListener(
      'app:speak-session-percentages-visible-change',
      this._sessionPercentagesVisibilityHandler
    );
    this._tabsDidChangeHandler = (event) => {
      const tab = String(event && event.detail ? event.detail.tab || '' : '')
        .trim()
        .toLowerCase();
      if (tab !== 'home') {
        this.clearNarrationTimer();
        this.clearBrowserNarrationRetryTimer();
        this.narrationToken += 1;
        if (this.planMascotIsTalking) {
          this.stopNarrationPlayback().catch(() => {});
        } else {
          this.stopPlanMascotTalk({ settle: true });
        }
        return;
      }
      this.journeySheetExpandedOffset = this.measureJourneySheetExpandedOffset();
      this.applyJourneySheetState({ animate: false, force: true });
      this.scheduleLayoutSync(0);
      this.scheduleLayoutSync(140);
      this.schedulePendingHomeReturnScrollRestore();
      this.schedulePendingHomeReturnReveal();
    };
    this._tabsEl = this.getTabsEl();
    this._tabsEl?.addEventListener('ionTabsDidChange', this._tabsDidChangeHandler);
    this._appTabChangeHandler = (event) => {
      this._tabsDidChangeHandler(event);
    };
    window.addEventListener('app:tab-change', this._appTabChangeHandler);
    this._routerEl = document.querySelector('ion-router');
    this._routeDidChangeHandler = (event) => {
      const to = String(event && event.detail ? event.detail.to || '' : '').trim();
      if (to !== '/tabs') return;
      this.schedulePendingHomeReturnScrollRestore();
      this.schedulePendingHomeReturnReveal();
    };
    this._routerEl?.addEventListener('ionRouteDidChange', this._routeDidChangeHandler);
    this._resizeHandler = () => {
      if (!this.isConnected) return;
      if (document.body?.classList?.contains('app-android-legacy-webview')) return;
      this.journeySheetExpandedOffset = this.measureJourneySheetExpandedOffset();
      this.applyJourneySheetState({ animate: false, force: true });
      this.scheduleLayoutSync(0);
    };
    window.addEventListener('resize', this._resizeHandler);
    this._handleHintResetHandler = () => {
      if (this._hintHideTimer) {
        clearTimeout(this._hintHideTimer);
        this._hintHideTimer = null;
      }
      this._hintWasExpanded = false;
      const handleEl = this.getJourneySheetHandleEl();
      const hintEl = handleEl?.querySelector('.handle-hint');
      if (handleEl) handleEl.classList.add('has-hint');
      if (hintEl) {
        hintEl.classList.remove('handle-hint-out');
        hintEl.style.display = '';
        const icon = hintEl.querySelector('ion-icon');
        if (icon) icon.setAttribute('name', 'chevron-up-outline');
      }
    };
    window.addEventListener('app:handle-hint-reset', this._handleHintResetHandler);
    this._layoutViewportHandler = () => {
      if (!this.isConnected) return;
      if (document.body?.classList?.contains('app-android-legacy-webview')) return;
      this.scheduleLayoutSync(0);
    };
    if (window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
      window.visualViewport.addEventListener('resize', this._layoutViewportHandler);
      window.visualViewport.addEventListener('scroll', this._layoutViewportHandler);
    }
    if (this.isTabActive('home')) {
      this.scheduleLayoutSync(0);
      this.scheduleLayoutSync(140);
    }
    this.render();
  }

  disconnectedCallback() {
    if (this._hintHideTimer) {
      clearTimeout(this._hintHideTimer);
      this._hintHideTimer = null;
    }
    if (this.handleSelectionChange) {
      window.removeEventListener('training:selection-change', this.handleSelectionChange);
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
    if (this._profileLocaleToggleHandler) {
      window.removeEventListener('app:profile-locale-toggle', this._profileLocaleToggleHandler);
    }
    if (this._headerColorHandler) {
      window.removeEventListener('app:free-ride-header-color-change', this._headerColorHandler);
      this._headerColorHandler = null;
    }
    if (this._cardPaddedHandler) {
      window.removeEventListener('app:free-ride-card-padded-change', this._cardPaddedHandler);
      this._cardPaddedHandler = null;
    }
    if (this._sessionPercentagesVisibilityHandler) {
      window.removeEventListener(
        'app:speak-session-percentages-visible-change',
        this._sessionPercentagesVisibilityHandler
      );
    }
    if (this._tabsDidChangeHandler) {
      if (this._tabsEl) {
        this._tabsEl.removeEventListener('ionTabsDidChange', this._tabsDidChangeHandler);
      }
      this._tabsEl = null;
      this._tabsDidChangeHandler = null;
    }
    if (this._appTabChangeHandler) {
      window.removeEventListener('app:tab-change', this._appTabChangeHandler);
      this._appTabChangeHandler = null;
    }
    if (this._routeDidChangeHandler) {
      this._routerEl?.removeEventListener('ionRouteDidChange', this._routeDidChangeHandler);
      this._routeDidChangeHandler = null;
      this._routerEl = null;
    }
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }
    if (this._handleHintResetHandler) {
      window.removeEventListener('app:handle-hint-reset', this._handleHintResetHandler);
      this._handleHintResetHandler = null;
    }
    if (this._layoutViewportHandler) {
      if (window.visualViewport && typeof window.visualViewport.removeEventListener === 'function') {
        window.visualViewport.removeEventListener('resize', this._layoutViewportHandler);
        window.visualViewport.removeEventListener('scroll', this._layoutViewportHandler);
      }
      this._layoutViewportHandler = null;
    }
    if (this._renderRAFId) {
      cancelAnimationFrame(this._renderRAFId);
      this._renderRAFId = null;
    }
    this.clearRoutesCenterScrollTimers();
    this.detachHomeScrollTracking();
    this.clearPendingHomeReturnScrollRestoreTimers();
    this.clearPendingHomeReturnRevealTimers();
    this.cancelJourneySheetDrag();
    this.clearLayoutSync();
    this.stopPlanMascotTalk({ settle: true });
    this.clearNarrationTimer();
    this.stopNarration().catch(() => {});
  }

  normalizePlanMascotFrameIndex(frameIndex) {
    const value = Number(frameIndex);
    if (!Number.isFinite(value)) return PLAN_MASCOT_REST_FRAME;
    const rounded = Math.round(value);
    return Math.min(Math.max(rounded, 0), PLAN_MASCOT_FRAMES.length - 1);
  }

  getPlanMascotFramePath(frameIndex = PLAN_MASCOT_REST_FRAME) {
    const normalized = this.normalizePlanMascotFrameIndex(frameIndex);
    return PLAN_MASCOT_FRAMES[normalized] || PLAN_MASCOT_FRAMES[PLAN_MASCOT_REST_FRAME];
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
    let sequenceIndex = 0;
    this.renderPlanMascotFrame(PLAN_MASCOT_TALK_FRAME_SEQUENCE[sequenceIndex]);
    this.planMascotFrameTimer = setInterval(() => {
      if (!this.planMascotIsTalking) return;
      sequenceIndex = (sequenceIndex + 1) % PLAN_MASCOT_TALK_FRAME_SEQUENCE.length;
      this.renderPlanMascotFrame(PLAN_MASCOT_TALK_FRAME_SEQUENCE[sequenceIndex]);
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

  cancelRoutesCentering() {
    this.pendingRoutesCenterScroll = null;
    this.clearRoutesCenterScrollTimers();
    return Promise.resolve();
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

  getHomeContentEl() {
    return this.querySelector('ion-content.home-journey');
  }

  getJourneyShellEl() {
    return this.querySelector('.journey-shell');
  }

  getJourneySheetEl() {
    return this.querySelector('.journey-sheet');
  }

  getJourneySheetHandleEl() {
    return this.querySelector('.journey-sheet-handle');
  }

  getJourneySheetMainEl() {
    return this.querySelector('.journey-sheet-main');
  }

  updateJourneyCardWedgePath() {
    const cardEl = this.getJourneySheetEl();
    if (!cardEl) return;
    cardEl.style.removeProperty('clip-path');
  }

  getJourneySheetTopInset() {
    if (document.body.classList.contains('app-titlebar-enabled')) return 0;
    const shellEl = this.getJourneyShellEl();
    if (!shellEl) return 0;
    const paddingTop = Number.parseFloat(window.getComputedStyle(shellEl).paddingTop || '0');
    return Number.isFinite(paddingTop) ? Math.max(0, Math.round(paddingTop)) : 0;
  }

  measureJourneySheetExpandedOffset() {
    const shellEl = this.getJourneyShellEl();
    const sheetEl = this.getJourneySheetEl();
    if (!shellEl || !sheetEl) return 0;
    const shellRect = shellEl.getBoundingClientRect();
    const sheetRect = sheetEl.getBoundingClientRect();
    const currentTranslate = Number.isFinite(this.journeySheetTranslateY) ? this.journeySheetTranslateY : 0;
    const targetTop = shellRect.top + this.getJourneySheetTopInset();
    const offset = Math.max(0, Math.round(sheetRect.top - currentTranslate - targetTop));
    this.journeySheetExpandedOffset = offset;
    return offset;
  }

  applyJourneySheetState(options = {}) {
    const animate = options.animate !== false;
    const sheetEl = this.getJourneySheetEl();
    const handleEl = this.getJourneySheetHandleEl();
    if (!sheetEl) return;

    const offset = this.journeySheetExpanded
      ? (this.journeySheetExpandedOffset || this.measureJourneySheetExpandedOffset())
      : 0;
    this.journeySheetTranslateY = this.journeySheetExpanded ? -offset : 0;

    sheetEl.dataset.sheetState = this.journeySheetExpanded ? 'expanded' : 'collapsed';
    sheetEl.classList.toggle('is-sheet-dragging', this.journeySheetDragging);
    sheetEl.classList.toggle('is-sheet-instant', !animate);
    const liftMagnitude = Math.max(0, -this.journeySheetTranslateY);
    sheetEl.style.setProperty('--sheet-lift', `${liftMagnitude}px`);
    if (handleEl) {
      handleEl.setAttribute('aria-expanded', this.journeySheetExpanded ? 'true' : 'false');
      handleEl.setAttribute(
        'aria-label',
        this.journeySheetExpanded ? 'Collapse training card' : 'Expand training card'
      );
      const hintEl = handleEl.querySelector('.handle-hint');
      if (hintEl) {
        const seen = isHandleHintSeen();
        handleEl.classList.toggle('has-hint', !seen);
        if (seen) {
          if (!hintEl.classList.contains('handle-hint-out')) hintEl.classList.add('handle-hint-out');
          if (!hintEl.style.display) hintEl.style.display = 'none';
        } else {
          if (hintEl.classList.contains('handle-hint-out')) {
            hintEl.classList.remove('handle-hint-out');
            hintEl.style.display = '';
          }
          const icon = hintEl.querySelector('ion-icon');
          if (this.journeySheetExpanded) {
            if (icon) icon.setAttribute('name', 'chevron-down-outline');
            this._hintWasExpanded = true;
          } else {
            if (icon) icon.setAttribute('name', 'chevron-up-outline');
            if (this._hintWasExpanded) {
              handleEl.classList.remove('has-hint');
              hintEl.classList.add('handle-hint-out');
              if (this._hintHideTimer) clearTimeout(this._hintHideTimer);
              this._hintHideTimer = setTimeout(() => {
                this._hintHideTimer = null;
                hintEl.style.display = 'none';
              }, 400);
              try { localStorage.setItem(HOME_HANDLE_HINT_KEY, '1'); } catch (_) {}
            }
          }
        }
      }
    }

    if (!animate) {
      requestAnimationFrame(() => {
        if (!sheetEl.isConnected) return;
        sheetEl.classList.remove('is-sheet-instant');
      });
    }
  }

  setJourneySheetExpanded(nextExpanded, options = {}) {
    const expanded = Boolean(nextExpanded);
    if (this.journeySheetExpanded === expanded && !options.force) {
      this.applyJourneySheetState(options);
      return;
    }
    this.journeySheetExpanded = expanded;
    if (
      expanded &&
      (!Number.isFinite(this.journeySheetExpandedOffset) || this.journeySheetExpandedOffset <= 0)
    ) {
      this.journeySheetExpandedOffset = this.measureJourneySheetExpandedOffset();
    }
    this.applyJourneySheetState(options);
  }

  toggleJourneySheet(options = {}) {
    this.setJourneySheetExpanded(!this.journeySheetExpanded, options);
  }

  startJourneySheetDrag(event) {
    const handleEl = event && event.currentTarget ? event.currentTarget : null;
    const sheetEl = this.getJourneySheetEl();
    if (!handleEl || !sheetEl || typeof event.pointerId !== 'number') return;
    if (event.button !== 0) return;

    this.journeySheetExpandedOffset = this.measureJourneySheetExpandedOffset();
    this.journeySheetDragging = true;
    this.journeySheetPointerId = event.pointerId;
    this.journeySheetDragStartY = event.clientY;
    this.journeySheetDragStartTranslateY = this.journeySheetExpanded ? -this.journeySheetExpandedOffset : 0;
    this.journeySheetDragMoved = false;
    sheetEl.classList.add('is-sheet-dragging');
    this.applyJourneySheetState({ animate: false });

    try {
      handleEl.setPointerCapture(event.pointerId);
    } catch (_err) {
      // no-op
    }
    event.preventDefault();
  }

  moveJourneySheetDrag(event) {
    if (!this.journeySheetDragging) return;
    if (typeof event.pointerId === 'number' && event.pointerId !== this.journeySheetPointerId) return;
    const sheetEl = this.getJourneySheetEl();
    if (!sheetEl) return;

    const deltaY = Number(event.clientY) - this.journeySheetDragStartY;
    const nextTranslate = this.journeySheetDragStartTranslateY + deltaY;
    const minTranslate = -this.journeySheetExpandedOffset;
    const maxTranslate = 0;
    const clampedTranslate = Math.max(minTranslate, Math.min(maxTranslate, nextTranslate));

    if (Math.abs(clampedTranslate - this.journeySheetDragStartTranslateY) > 4) {
      this.journeySheetDragMoved = true;
    }

    this.journeySheetTranslateY = clampedTranslate;
    const liftMagnitude = Math.max(0, -clampedTranslate);
    sheetEl.style.setProperty('--sheet-lift', `${liftMagnitude}px`);
    event.preventDefault();
  }

  finishJourneySheetDrag(event) {
    if (!this.journeySheetDragging) return;
    if (typeof event.pointerId === 'number' && event.pointerId !== this.journeySheetPointerId) return;
    const sheetEl = this.getJourneySheetEl();
    const handleEl = this.getJourneySheetHandleEl();
    const currentTranslate = Number.isFinite(this.journeySheetTranslateY) ? this.journeySheetTranslateY : 0;
    const midpoint = -Math.max(0, this.journeySheetExpandedOffset) / 2;
    const nextExpanded = this.journeySheetDragMoved ? currentTranslate <= midpoint : !this.journeySheetExpanded;

    this.journeySheetDragging = false;
    this.journeySheetPointerId = null;
    this.journeySheetDragMoved = false;
    this.journeySheetLastPointerUpTs = Date.now();
    if (sheetEl) {
      sheetEl.classList.remove('is-sheet-dragging');
    }
    if (handleEl) {
      try {
        if (typeof event.pointerId === 'number' && handleEl.hasPointerCapture(event.pointerId)) {
          handleEl.releasePointerCapture(event.pointerId);
        }
      } catch (_err) {
        // no-op
      }
    }
    this.setJourneySheetExpanded(nextExpanded, { animate: true });
  }

  cancelJourneySheetDrag() {
    if (!this.journeySheetDragging) return;
    this.journeySheetDragging = false;
    this.journeySheetPointerId = null;
    this.journeySheetDragMoved = false;
    const sheetEl = this.getJourneySheetEl();
    if (sheetEl) {
      sheetEl.classList.remove('is-sheet-dragging');
    }
    this.setJourneySheetExpanded(this.journeySheetExpanded, { animate: true, force: true });
  }

  clearLayoutSync() {
    if (this.layoutSyncTimer) {
      clearTimeout(this.layoutSyncTimer);
      this.layoutSyncTimer = null;
    }
    if (this.layoutSyncRaf) {
      cancelAnimationFrame(this.layoutSyncRaf);
      this.layoutSyncRaf = null;
    }
    this.layoutSyncVersion += 1;
  }

  scheduleLayoutSync(delayMs = 0) {
    if (!this.isConnected) return;
    const legacyAndroid = document.body?.classList?.contains('app-android-legacy-webview');
    if (legacyAndroid && Number(delayMs) > 0) return;
    if (
      document.body?.classList?.contains('app-android-legacy-webview') &&
      window.r34lp0w3r &&
      window.r34lp0w3r.legacyLayoutReady === false
    ) {
      return;
    }
    if (this.layoutSyncTimer) {
      clearTimeout(this.layoutSyncTimer);
      this.layoutSyncTimer = null;
    }

    const runSync = () => {
      if (!this.isConnected) return;
      if (this.layoutSyncRaf) {
        cancelAnimationFrame(this.layoutSyncRaf);
      }
      this.layoutSyncRaf = requestAnimationFrame(() => {
        this.layoutSyncRaf = null;
        this.syncLayoutToViewport().catch(() => {});
      });
    };

    if (delayMs > 0) {
      this.layoutSyncTimer = setTimeout(() => {
        this.layoutSyncTimer = null;
        runSync();
      }, delayMs);
      return;
    }

    runSync();
  }

  async syncLayoutToViewport() {
    if (!this.isConnected) return;
    const shellEl = this.getJourneyShellEl();
    if (!shellEl) return;
    if (!this.isTabActive('home')) return;

    const callVersion = this.layoutSyncVersion;
    if (!this.isConnected || callVersion !== this.layoutSyncVersion || !shellEl.isConnected) return;

    const shellRect = shellEl.getBoundingClientRect();
    const viewport = window.visualViewport;
    const layoutViewportBottom = window.innerHeight || document.documentElement.clientHeight || 0;
    const visualViewportBottom = viewport
      ? viewport.height + viewport.offsetTop
      : layoutViewportBottom;

    const tabBarEl = document.querySelector('tabs-page ion-tab-bar');
    const tabBarTop = tabBarEl ? tabBarEl.getBoundingClientRect().top : layoutViewportBottom;
    const bottomLimit = Math.min(visualViewportBottom, tabBarTop);
    const usableHeight = bottomLimit - shellRect.top - 8;

    if (!Number.isFinite(usableHeight) || usableHeight <= 40) {
      shellEl.style.removeProperty('--free-ride-shell-height');
      shellEl.style.removeProperty('--journey-shell-height');
      return;
    }

    const nextHeight = Math.max(160, Math.floor(usableHeight));
    shellEl.style.setProperty('--free-ride-shell-height', `${nextHeight}px`);
    shellEl.style.setProperty('--journey-shell-height', `${nextHeight}px`);
    this.journeySheetExpandedOffset = this.measureJourneySheetExpandedOffset();
    this.applyJourneySheetState({ animate: false, force: true });
    this.updateJourneyCardWedgePath();
  }

  async getHomeScrollHost() {
    const sheetMainEl = this.getJourneySheetMainEl();
    if (sheetMainEl) {
      return { scrollEl: sheetMainEl, contentEl: null };
    }

    const contentEl = this.getHomeContentEl();
    if (!contentEl || typeof contentEl.getScrollElement !== 'function') {
      return { scrollEl: null, contentEl: null };
    }

    let scrollEl = null;
    try {
      scrollEl = await contentEl.getScrollElement();
    } catch (err) {
      scrollEl = null;
    }
    return { scrollEl, contentEl };
  }

  async scrollHomeHostTo(host, desiredTop, durationMs = 0) {
    if (!host || !host.scrollEl) return 0;
    const scrollEl = host.scrollEl;
    const maxTop = Math.max(0, (scrollEl.scrollHeight || 0) - (scrollEl.clientHeight || 0));
    const nextTop = Math.max(0, Math.min(Math.round(Number(desiredTop) || 0), maxTop));

    if (host.contentEl && typeof host.contentEl.scrollToPoint === 'function') {
      try {
        await host.contentEl.scrollToPoint(0, nextTop, Math.max(0, Number(durationMs) || 0));
      } catch (err) {
        scrollEl.scrollTop = nextTop;
      }
      return nextTop;
    }

    const duration = Math.max(0, Number(durationMs) || 0);
    if (duration > 0 && typeof scrollEl.scrollTo === 'function') {
      scrollEl.scrollTo({
        top: nextTop,
        behavior: 'smooth'
      });
    } else {
      scrollEl.scrollTop = nextTop;
    }
    return nextTop;
  }

  detachHomeScrollTracking() {
    this._homeScrollBindToken += 1;
    if (this._homeScrollEl && this._homeScrollHandler) {
      this._homeScrollEl.removeEventListener('scroll', this._homeScrollHandler);
    }
    this._homeScrollEl = null;
  }

  async bindHomeScrollTracking() {
    const { scrollEl } = await this.getHomeScrollHost();
    if (!scrollEl) {
      this.detachHomeScrollTracking();
      return;
    }
    const bindToken = ++this._homeScrollBindToken;
    if (!scrollEl || bindToken !== this._homeScrollBindToken || !this.isConnected) return;
    if (!this._homeScrollHandler) {
      this._homeScrollHandler = () => {
        if (!this._homeScrollEl) return;
        this.homeScrollTop = Math.max(0, Number(this._homeScrollEl.scrollTop) || 0);
      };
    }
    if (this._homeScrollEl !== scrollEl) {
      if (this._homeScrollEl) {
        this._homeScrollEl.removeEventListener('scroll', this._homeScrollHandler);
      }
      this._homeScrollEl = scrollEl;
      this._homeScrollEl.addEventListener('scroll', this._homeScrollHandler, { passive: true });
    }
    this.homeScrollTop = Math.max(0, Number(scrollEl.scrollTop) || 0);
  }

  waitForNextFrame() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }

  setPendingHomeReturnScroll(scrollTop = this.homeScrollTop) {
    const nextTop = Number(scrollTop);
    if (!Number.isFinite(nextTop) || nextTop < 0) return;
    try {
      sessionStorage.setItem(HOME_RETURN_SCROLL_KEY, String(Math.round(nextTop)));
    } catch (err) {
      // no-op
    }
  }

  getPendingHomeReturnScroll() {
    try {
      const raw = sessionStorage.getItem(HOME_RETURN_SCROLL_KEY);
      const value = Number(raw);
      return Number.isFinite(value) && value >= 0 ? value : null;
    } catch (err) {
      return null;
    }
  }

  clearPendingHomeReturnScroll() {
    try {
      sessionStorage.removeItem(HOME_RETURN_SCROLL_KEY);
    } catch (err) {
      // no-op
    }
  }

  clearPendingHomeReturnScrollRestoreTimers() {
    if (!Array.isArray(this._pendingHomeReturnRestoreTimers) || !this._pendingHomeReturnRestoreTimers.length) {
      this._pendingHomeReturnRestoreTimers = [];
      return;
    }
    this._pendingHomeReturnRestoreTimers.forEach((timerId) => clearTimeout(timerId));
    this._pendingHomeReturnRestoreTimers = [];
  }

  setPendingHomeReturnRevealTarget(target) {
    if (!target || !target.routeId || !target.moduleId || !target.sessionId) {
      this.clearPendingHomeReturnRevealTarget();
      return;
    }
    try {
      sessionStorage.setItem(
        HOME_RETURN_REVEAL_KEY,
        JSON.stringify({
          routeId: String(target.routeId || ''),
          moduleId: String(target.moduleId || ''),
          sessionId: String(target.sessionId || '')
        })
      );
    } catch (err) {
      // no-op
    }
  }

  getPendingHomeReturnRevealTarget() {
    try {
      const raw = sessionStorage.getItem(HOME_RETURN_REVEAL_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      const routeId = String(parsed.routeId || '').trim();
      const moduleId = String(parsed.moduleId || '').trim();
      const sessionId = String(parsed.sessionId || '').trim();
      if (!routeId || !moduleId || !sessionId) return null;
      return { routeId, moduleId, sessionId };
    } catch (err) {
      return null;
    }
  }

  clearPendingHomeReturnRevealTarget() {
    try {
      sessionStorage.removeItem(HOME_RETURN_REVEAL_KEY);
    } catch (err) {
      // no-op
    }
  }

  clearPendingHomeReturnRevealTimers() {
    if (!Array.isArray(this._pendingHomeReturnRevealTimers) || !this._pendingHomeReturnRevealTimers.length) {
      this._pendingHomeReturnRevealTimers = [];
      return;
    }
    this._pendingHomeReturnRevealTimers.forEach((timerId) => clearTimeout(timerId));
    this._pendingHomeReturnRevealTimers = [];
  }

  async restoreHomeScrollPosition(scrollTop = this.homeScrollTop) {
    const desiredTop = Number(scrollTop);
    if (!Number.isFinite(desiredTop) || desiredTop <= 0) return;
    await this.waitForNextFrame();
    const host = await this.getHomeScrollHost();
    if (!host.scrollEl) return;
    const nextTop = await this.scrollHomeHostTo(host, desiredTop, 0);
    this.homeScrollTop = nextTop;
  }

  schedulePendingHomeReturnScrollRestore() {
    const pendingTop = this.getPendingHomeReturnScroll();
    if (!Number.isFinite(pendingTop) || pendingTop <= 0) return;
    this.clearPendingHomeReturnScrollRestoreTimers();
    [0, 120].forEach((delayMs) => {
      const timerId = setTimeout(() => {
        if (!this.isConnected || !this.isTabActive('home')) return;
        this.restoreHomeScrollPosition(pendingTop).catch(() => {});
        this.clearPendingHomeReturnScrollRestoreTimers();
        this.clearPendingHomeReturnScroll();
      }, delayMs);
      this._pendingHomeReturnRestoreTimers.push(timerId);
    });
  }

  async isRoutesTargetVisible(targetEl, padding = 20) {
    if (!targetEl || !this.isConnected) return false;
    const { scrollEl } = await this.getHomeScrollHost();
    if (!scrollEl) return false;
    const scrollRect = scrollEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    return (
      targetRect.top >= scrollRect.top + padding &&
      targetRect.bottom <= scrollRect.bottom - padding
    );
  }

  async ensureRoutesTargetVisible(targetEl, padding = 20, durationMs = 240) {
    if (!targetEl || !this.isConnected) return false;
    const host = await this.getHomeScrollHost();
    const scrollEl = host.scrollEl;
    if (!scrollEl) return false;
    const scrollRect = scrollEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const topLimit = scrollRect.top + padding;
    const bottomLimit = scrollRect.bottom - padding;
    let delta = 0;
    if (targetRect.top < topLimit) {
      delta = targetRect.top - topLimit;
    } else if (targetRect.bottom > bottomLimit) {
      delta = targetRect.bottom - bottomLimit;
    }
    if (Math.abs(delta) < 2) return false;
    const nextTop = await this.scrollHomeHostTo(host, scrollEl.scrollTop + delta, durationMs);
    this.homeScrollTop = nextTop;
    return true;
  }

  async revealRoutesTarget(targetEl, padding = 24, durationMs = 220) {
    if (!targetEl || !this.isConnected) return false;
    const targetHeight = Math.max(0, Math.round(targetEl.getBoundingClientRect().height || 0));
    const effectivePadding = Math.max(
      padding,
      Math.min(44, Math.max(30, Math.round(targetHeight * 0.45)))
    );
    const didScroll = await this.ensureRoutesTargetVisible(targetEl, effectivePadding, durationMs);
    return didScroll;
  }

  schedulePendingHomeReturnReveal() {
    this.clearPendingHomeReturnRevealTimers();
    this._pendingHomeReturnRevealScheduleToken += 1;
    this.clearPendingHomeReturnRevealTarget();
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

    return this.querySelector('.route-header') || this.querySelector('.journey-sheet-handle') || null;
  }

  async scrollRoutesTargetToCenter(targetEl, durationMs = 340) {
    if (!targetEl || !this.isConnected) return;
    const host = await this.getHomeScrollHost();
    const scrollEl = host.scrollEl;
    if (!scrollEl) return;

    const scrollRect = scrollEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const delta = targetRect.top - scrollRect.top - (scrollRect.height - targetRect.height) / 2;
    await this.scrollHomeHostTo(host, scrollEl.scrollTop + delta, durationMs);
  }

  flushRoutesCenterScroll() {
    const request = this.pendingRoutesCenterScroll;
    this.pendingRoutesCenterScroll = null;
    if (!request) return;

    this.clearRoutesCenterScrollTimers();
    const delays = request.fallback === 'module' ? [80] : [90, 420];

    delays.forEach((delayMs) => {
      const timerId = setTimeout(() => {
        if (!this.isConnected) return;
        const target = this.resolveRoutesCenterTarget(request);
        if (!target) return;
        this.scrollRoutesTargetToCenter(target, 300).catch(() => {});
      }, delayMs);
      this.routesCenterScrollTimers.push(timerId);
    });
  }

  render(options = {}) {
    if (this._renderRAFId) {
      if (options.restoreScrollTop !== undefined && options.restoreScrollTop !== null) {
        this._pendingRenderOptions.restoreScrollTop = options.restoreScrollTop;
      }
      return;
    }
    this._pendingRenderOptions = { ...options };
    this._renderRAFId = requestAnimationFrame(() => {
      this._renderRAFId = null;
      const pendingOptions = this._pendingRenderOptions;
      this._pendingRenderOptions = {};
      this._renderSync(pendingOptions);
    });
  }

  _renderSync(options = {}) {
    this.clearRoutesCenterScrollTimers();
    const baseLocale = this.getBaseLocale();
    const uiLocale = this.getUiLocale(baseLocale);
    const copy = getHomeCopy(uiLocale);
    const speakCopy = getSpeakCopy(uiLocale) || {};
    const tabTitle = copy.planTitle;
    this.currentUiLocale = uiLocale;
    this.currentPlanMessage = copy.planMessage || '';
    const planLines = this.extractNarrationLines(this.currentPlanMessage);
    const planRestLine = planLines[0] || null;
    const planRestHtml = planRestLine
      ? planRestLine.html && planRestLine.html.trim()
        ? planRestLine.html
        : planRestLine.text
      : copy.planMessage || '';
    const planMascotSrc = this.getPlanMascotFramePath(this.planMascotFrameIndex);

    const routes = getRoutes();
    const readLocalizedField = (entry, fieldName) => {
      return getLocalizedContentField(entry, fieldName, uiLocale) || '';
    };
    const getRouteTitle = (route) => readLocalizedField(route, 'title');
    const getRouteNote = (route) => readLocalizedField(route, 'note');
    const getModuleTitle = (module) => readLocalizedField(module, 'title');
    const getModuleSubtitle = (module) => readLocalizedField(module, 'subtitle');
    const getSessionTitle = (session) => readLocalizedField(session, 'title');
    const getSessionTitleParts = (session) => {
      const title = String(getSessionTitle(session) || '').trim();
      if (!title) return { primary: '', secondary: '' };
      const match = title.match(/^(the\s+.+?\s+sound)\s+(?:in\s+)?(.+)$/i);
      if (!match) return { primary: title, secondary: '' };
      const primary = String(match[1] || '').trim();
      const secondary = String(match[2] || '').trim();
      if (!primary) return { primary: title, secondary: '' };
      return secondary ? { primary, secondary: `in ${secondary}` } : { primary, secondary: '' };
    };
    const getSessionCircleLabel = (session) => {
      const title = String(getSessionTitle(session) || '').trim();
      if (!title) return '';
      const stopWords = new Set([
        'the', 'a', 'an', 'in', 'as', 'of', 'to', 'and', 'vs',
        'sound', 'sounds', 'basic', 'short', 'long', 'voiced', 'voiceless',
        'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'en', 'al',
        'sonido', 'sonidos'
      ]);
      const tokens = title
        .replace(/[()[\],.]/g, ' ')
        .split(/\s+/)
        .map((token) => String(token || '').replace(/^[^A-Za-zÀ-ÿ0-9]+|[^A-Za-zÀ-ÿ0-9]+$/g, ''))
        .filter(Boolean);
      for (const token of tokens) {
        if (stopWords.has(token.toLowerCase())) continue;
        const upper = token.toUpperCase();
        if (/^[A-ZÀ-ÖØ-Þ0-9]{1,2}$/.test(upper)) {
          return upper;
        }
      }
      const meaningful = tokens.find((token) => !stopWords.has(token.toLowerCase())) || tokens[0] || title;
      const letters = String(meaningful || '')
        .replace(/[^A-Za-zÀ-ÿ0-9]/g, '')
        .trim();
      if (!letters) return '';
      return letters.slice(0, 2).toUpperCase();
    };
    const getSessionCircleColorMap = (sessions, seed) => {
      const palette = shufflePalette(seed, SESSION_CIRCLE_COLORS);
      const assigned = new Map();
      const usedColors = new Set();
      (Array.isArray(sessions) ? sessions : []).forEach((session) => {
        if (!session) return;
        const titleForHash = String(session.title_en || session.id || '').trim();
        const preferredIndex = hashTextToIndex(`${seed}:${titleForHash}`, palette.length);
        let chosenColor = palette[preferredIndex] || palette[0] || SESSION_CIRCLE_COLORS[0];
        for (let offset = 0; offset < palette.length; offset += 1) {
          const candidate = palette[(preferredIndex + offset) % palette.length];
          if (candidate && !usedColors.has(candidate)) {
            chosenColor = candidate;
            break;
          }
        }
        usedColors.add(chosenColor);
        assigned.set(session.id, chosenColor);
      });
      return assigned;
    };
    if (!routes.length) {
      const loadingLabel = String(copy.loading || speakCopy.loading || 'Loading...').trim();
      this.innerHTML = `
        ${renderAppHeader({ title: tabTitle, rewardBadgesId: 'home-reward-badges', locale: uiLocale })}
        <ion-content fullscreen class="home-journey free-ride-content secret-content">
          <div class="speak-shell free-ride-shell journey-shell">
            <section class="free-ride-hero-card journey-plan-card onboarding-intro-card">
              <div class="free-ride-hero-stage journey-plan-stage">
                <span class="journey-plan-mascot-wrap free-ride-mascot-wrap" aria-hidden="true">
                  <img
                    class="onboarding-intro-cat free-ride-mascot"
                    id="home-plan-mascot"
                    src="${planMascotSrc}"
                    alt=""
                  >
                </span>
                <div class="journey-plan-body">
                  <p class="onboarding-intro-bubble free-ride-hero-bubble journey-plan-bubble hero-playable-bubble">
                    <span class="journey-plan-bubble-text"><span class="free-ride-hero-bubble-icon" aria-hidden="true"><ion-icon name="volume-high-outline"></ion-icon></span>${planRestHtml}</span>
                  </p>
                </div>
              </div>
            </section>
            <section class="free-ride-card journey-sheet">
              <button class="free-ride-card-handle journey-sheet-handle${isHandleHintSeen() ? '' : ' has-hint'}" type="button" aria-label="Expand training card" aria-expanded="false">
                <span class="free-ride-card-handle-pill journey-sheet-handle-pill" aria-hidden="true"></span>
                <span class="handle-hint${isHandleHintSeen() ? ' handle-hint-out' : ''}" aria-hidden="true"><ion-icon name="chevron-up-outline"></ion-icon><span class="handle-hint-label">${uiLocale === 'es' ? 'pruébame' : 'try me'}</span></span>
              </button>
              <div class="free-ride-card-main journey-sheet-main">
                <div class="journey-accordion">
                  <div class="reference-empty">${loadingLabel}</div>
                </div>
              </div>
            </section>
          </div>
        </ion-content>
      `;
      this.dataset.homeRenderState = 'loading';
      this.bindPlanHeroEvents(options);
      const journeySheetHandleEl = this.getJourneySheetHandleEl();
      journeySheetHandleEl?.addEventListener('pointerdown', (event) => {
        this.startJourneySheetDrag(event);
      });
      journeySheetHandleEl?.addEventListener('pointermove', (event) => {
        this.moveJourneySheetDrag(event);
      });
      journeySheetHandleEl?.addEventListener('pointerup', (event) => {
        this.finishJourneySheetDrag(event);
      });
      journeySheetHandleEl?.addEventListener('pointercancel', () => {
        this.cancelJourneySheetDrag();
      });
      journeySheetHandleEl?.addEventListener('lostpointercapture', () => {
        this.cancelJourneySheetDrag();
      });
      journeySheetHandleEl?.addEventListener('click', (event) => {
        const lastPointerUpTs = Number(this.journeySheetLastPointerUpTs) || 0;
        if (lastPointerUpTs && Date.now() - lastPointerUpTs < 350) {
          event.preventDefault();
          return;
        }
        this.toggleJourneySheet({ animate: true });
      });
      journeySheetHandleEl?.addEventListener('keydown', (event) => {
        const key = event && event.key ? event.key : '';
        if (key !== 'Enter' && key !== ' ') return;
        event.preventDefault();
        this.toggleJourneySheet({ animate: true });
      });
      this.journeySheetExpandedOffset = this.measureJourneySheetExpandedOffset();
      this.applyJourneySheetState({ animate: false, force: true });
      this.scheduleLayoutSync(0);
      this.scheduleLayoutSync(140);
      if (!this._loadingTrainingData && !this._trainingDataLoadAttempted) {
        this._loadingTrainingData = true;
        this._trainingDataLoadAttempted = true;
        ensureTrainingData()
          .catch((err) => {
            console.warn('[home] training data load failed', err);
          })
          .finally(() => {
            this._loadingTrainingData = false;
            if (this.isConnected) this.render();
          });
      }
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

    const DEFAULT_TONE_SCALE = [
      { min: 80, tone: 'good' },
      { min: 60, tone: 'okay' },
      { min: 0, tone: 'bad' }
    ];

    const getDefaultTonePhrases = () => {
      return getSpeakFeedbackPhrases(uiLocale);
    };

    const resolveToneListMap = (source, fallback) => {
      const tones = ['good', 'okay', 'bad', 'neutral'];
      const safeSource = source && typeof source === 'object' ? source : {};
      const safeFallback = fallback && typeof fallback === 'object' ? fallback : {};
      const output = {};
      tones.forEach((tone) => {
        const fromSource = Array.isArray(safeSource[tone])
          ? safeSource[tone].map((item) => String(item || '').trim()).filter(Boolean)
          : [];
        const fromFallback = Array.isArray(safeFallback[tone])
          ? safeFallback[tone].map((item) => String(item || '').trim()).filter(Boolean)
          : [];
        output[tone] = fromSource.length ? fromSource : fromFallback;
      });
      return output;
    };

    const getFeedbackConfig = () => {
      const config = window.r34lp0w3r && window.r34lp0w3r.speakFeedback;
      const toneScale =
        config && Array.isArray(config.toneScale) ? config.toneScale : DEFAULT_TONE_SCALE;
      const tonePhrasesByLocale =
        config && config.tonePhrasesByLocale && typeof config.tonePhrasesByLocale === 'object'
          ? config.tonePhrasesByLocale
          : config && config.labelPhrasesByLocale && typeof config.labelPhrasesByLocale === 'object'
            ? config.labelPhrasesByLocale
            : null;
      const labelScaleByLocale =
        config && config.labelScaleByLocale && typeof config.labelScaleByLocale === 'object'
          ? config.labelScaleByLocale
          : null;
      const labelScaleI18n =
        config && config.labelScale_i18n && typeof config.labelScale_i18n === 'object'
          ? config.labelScale_i18n
          : null;
      const preferredLabelScale = labelScaleByLocale
        ? labelScaleByLocale[uiLocale]
        : labelScaleI18n
          ? labelScaleI18n[uiLocale]
          : null;
      const fallbackLabelScale =
        config && Array.isArray(config.labelScale) && uiLocale === 'en' ? config.labelScale : null;
      const fallbackTonePhrases = getDefaultTonePhrases();
      const preferredTonePhrases = tonePhrasesByLocale ? tonePhrasesByLocale[uiLocale] : null;
      const labelScale = Array.isArray(preferredLabelScale)
        ? preferredLabelScale
        : Array.isArray(fallbackLabelScale)
          ? fallbackLabelScale
          : [];
      return {
        toneScale,
        tonePhrases: resolveToneListMap(
          preferredTonePhrases,
          deriveTonePhrasesFromLabelScale(labelScale, toneScale, fallbackTonePhrases)
        )
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

    const deriveTonePhrasesFromLabelScale = (labelScale, toneScale, fallbackTonePhrases) => {
      const normalizedLabels = normalizeScale(labelScale, 'label');
      const normalizedTones = normalizeScale(toneScale, 'tone');
      const derived = {};
      normalizedTones.forEach((entry, index) => {
        const previous = normalizedTones[index - 1];
        const max = index === 0 ? Number.POSITIVE_INFINITY : previous.min - 1;
        derived[entry.tone] = normalizedLabels
          .filter((item) => item.min >= entry.min && item.min <= max)
          .map((item) => item.label);
      });
      return resolveToneListMap(derived, fallbackTonePhrases);
    };

    const pickStableListItem = (items, seed, fallback) => {
      const list = Array.isArray(items)
        ? items.map((item) => String(item || '').trim()).filter(Boolean)
        : [];
      if (!list.length) return fallback;
      const base = String(seed || list.join('|'));
      let hash = 0;
      for (let idx = 0; idx < base.length; idx += 1) {
        hash = (hash * 31 + base.charCodeAt(idx)) >>> 0;
      }
      return list[hash % list.length];
    };

    const getScoreTone = (percent) => {
      const value = typeof percent === 'number' ? percent : 0;
      if (value <= 0) return 'neutral';
      const { toneScale } = getFeedbackConfig();
      const normalized = normalizeScale(toneScale, 'tone');
      return resolveFromScale(normalized, value, 'tone', 'bad');
    };

    const getScoreLabel = (percent, seed = '') => {
      const value = typeof percent === 'number' ? percent : 0;
      const tone = getScoreTone(value);
      const { tonePhrases } = getFeedbackConfig();
      const fallbackTonePhrases = getDefaultTonePhrases();
      const fallbackList =
        fallbackTonePhrases && Array.isArray(fallbackTonePhrases[tone])
          ? fallbackTonePhrases[tone]
          : [];
      return pickStableListItem(
        tonePhrases && Array.isArray(tonePhrases[tone]) ? tonePhrases[tone] : [],
        `${seed}|${tone}|${value}`,
        fallbackList[0] || getDefaultTonePhrases().bad[0] || ''
      );
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

    const showSessionPercentages = this.areSessionPercentagesVisible();

    const clampProgress = (value) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return 0;
      return Math.max(0, Math.min(100, Math.round(numeric)));
    };

    const getProgressBarFills = (percent) => {
      const normalized = clampProgress(percent);
      const segment = 100 / 3;
      return [0, 1, 2].map((index) => {
        const start = index * segment;
        const fill = ((normalized - start) / segment) * 100;
        return Math.max(0, Math.min(100, fill));
      });
    };

    const renderProgressBars = (percent, tone, contextClass = '') => {
      const fills = getProgressBarFills(percent);
      const label = `${clampProgress(percent)}%`;
      return `<span class="training-progress-bars ${contextClass} is-${tone}" role="img" aria-label="${label}">
        ${fills
          .map(
            (fill, index) =>
              `<span class="training-progress-bar bar-${index + 1}" style="--bar-fill:${fill.toFixed(2)}%"></span>`
          )
          .join('')}
      </span>`;
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
          const icon = reward.rewardIcon || 'trophy';
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

    if (this.expandedRouteId === null) {
      this.expandedRouteId = activeRoute.id;
      try { localStorage.setItem(HOME_EXPANDED_ROUTE_KEY, this.expandedRouteId); } catch {}
    } else if (this.expandedRouteId && !routes.some((item) => item.id === this.expandedRouteId)) {
      this.expandedRouteId = activeRoute.id;
      try { localStorage.setItem(HOME_EXPANDED_ROUTE_KEY, this.expandedRouteId); } catch {}
    }
    const currentExpandedRoute = routes.find((item) => item.id === this.expandedRouteId) || activeRoute;
    if (
      this.expandedRouteId &&
      (!this.expandedModuleId ||
      !currentExpandedRoute.modules.some((item) => item.id === this.expandedModuleId))
    ) {
      this.expandedModuleId =
        currentExpandedRoute.id === activeRoute.id
          ? activeModule.id
          : currentExpandedRoute.modules[0]
            ? currentExpandedRoute.modules[0].id
            : '';
    }

    const showLockedRouteToast = (routeIndex) => {
      const prevRoute = routeIndex > 0 ? routes[routeIndex - 1] : null;
      const message = prevRoute
        ? `Aún no puedes acceder a este modulo. Completa primero la ruta anterior: ${getRouteTitle(prevRoute)}.`
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

    const buildAccordionMarkup = () =>
      routes
        .map((route, routeIndex) => {
        const isRouteOpen = route.id === this.expandedRouteId;
        const routeUnlocked = routeIndex === 0 || routeUnlockList[routeIndex] === true;
        const routeProgress = routeProgressList[routeIndex];
        const routePercentMarkup =
          routeProgress && routeProgress.started
            ? `<span class="route-progress ${routeProgress.tone}"><ion-icon name="star"></ion-icon>${routeProgress.percent}% ${copy.routeProgress}</span>`
            : '';
        const modulesMarkup = route.modules
          .map((module) => {
            const isActive = route.id === activeRoute.id && module.id === activeModule.id;
            const isModuleOpen = isRouteOpen && module.id === this.expandedModuleId;
            const sessionCircleColorById = getSessionCircleColorMap(module.sessions, `${route.id}:${module.id}`);
            const progress = getModulePercent(module);
            const lockedClass = routeUnlocked ? '' : 'module-item-locked';
            const toneCls = progress.started ? progress.tone : 'neutral';
            const isMastered = progress.started && progress.tone === 'good';
            const totalSessions = module.sessions.length;
            const greenSessions = module.sessions.filter(item => {
              if (!hasSessionAttempts(item)) return false;
              const pct = getSessionPercent(item);
              return pct !== null && getScoreTone(pct) === 'good';
            }).length;
            const showChevron = true;
            const moduleLeadIcon =
              toneCls === 'good'
                ? `<div class="module-circle module-circle-good"><ion-icon name="checkmark"></ion-icon></div>`
                : MODULE_AUDIO_ICON;
            const sessionsMarkup =
              routeUnlocked && isModuleOpen
                ? `<div class="module-sessions training-list">${module.sessions
                    .map((item) => {
                      const sessionProgress = getCorrectCount(item);
                      const progressText = `${sessionProgress.correct}/${sessionProgress.total}`;
                      const sessionPercent = hasSessionAttempts(item) ? getSessionPercent(item) : 0;
                      const tone = getScoreTone(sessionPercent);
                      const toneClass =
                        tone === 'good' ? 'good' : tone === 'okay' ? 'okay' : tone === 'bad' ? 'bad' : 'neutral';
                      const sessionCircleLabel = getSessionCircleLabel(item);
                      const sessionCircleColor = sessionCircleColorById.get(item.id) || SESSION_CIRCLE_COLORS[0];
                      const sessionTitle = getSessionTitle(item);
                      const labelText = getScoreLabel(
                        sessionPercent,
                        `${route.id}:${module.id}:${item.id}`
                      );
                      const isCurrentSession =
                        route.id === activeRoute.id &&
                        module.id === activeModule.id &&
                        item.id === activeSession.id;
                      return `
                        <div
                          class="training-row ${isCurrentSession ? 'is-active' : ''}"
                          data-session-id="${item.id}"
                          data-route-id="${route.id}"
                          data-module-id="${module.id}"
                          data-locked="${routeUnlocked ? '0' : '1'}"
                        >
                          <div class="session-circle" style="background:${sessionCircleColor};">
                            <span class="session-circle-text${sessionCircleLabel.length > 1 ? ' is-two-letter' : ''}">${sessionCircleLabel}</span>
                          </div>
                          <div class="session-body">
                            <div class="session-title">
                              <span class="session-title-main">${sessionTitle}</span>
                              ${labelText ? `<span class="session-label session-label-${toneClass}">${labelText}</span>` : ''}
                            </div>
                          </div>
                          <ion-icon name="chevron-forward" class="training-row-arrow"></ion-icon>
                        </div>
                      `;
                    })
                    .join('')}</div>`
                : '';

            return `
              <div class="module-item ${lockedClass} ${isActive ? 'is-active' : ''} ${isModuleOpen ? 'is-open' : ''}">
                <button
                  class="module-header"
                  type="button"
                  data-locked="${routeUnlocked ? '0' : '1'}"
                  data-route-id="${route.id}"
                  data-module-id="${module.id}"
                >
                  <div class="module-header-inner">
                    ${moduleLeadIcon}
                    <div class="module-info">
                      <div class="module-header-row">
                        <span class="module-title">${getModuleTitle(module)}</span>
                        ${isMastered ? `<span class="module-mastered-pill"><ion-icon name="checkmark"></ion-icon>Mastered!</span>` : ''}
                      </div>
                      <div class="module-sub module-sub-${toneCls}">${getModuleSubtitle(module)}</div>
                      <div class="module-sessions-count">${greenSessions}/${totalSessions} ${copy.sessionsCompleted}</div>
                    </div>
                    ${showChevron ? `<ion-icon name="${isModuleOpen ? 'chevron-up' : 'chevron-down'}" class="module-chevron"></ion-icon>` : ''}
                  </div>
                </button>
                ${progress.started ? `<div class="module-progress-wrap" style="margin-bottom:16px"><div class="module-progress-fill module-progress-fill-${toneCls}" style="width:${Math.min(100, progress.percent)}%"></div></div>` : ''}
                ${sessionsMarkup}
              </div>
            `;
          })
          .join('');

        const routeNote = getRouteNote(route);
        const prevRouteTitle = !routeUnlocked && routeIndex > 0 ? getRouteTitle(routes[routeIndex - 1]) : '';
        const routeUnlockText = !routeUnlocked ? `${copy.unlockAfter} ${prevRouteTitle}` : '';

        return `
          <div class="route-item ${isRouteOpen ? 'is-open' : ''}">
            <button
              class="route-header"
              type="button"
              data-route-id="${route.id}"
              data-locked="${routeUnlocked ? '0' : '1'}"
            >
              <span class="route-header-title">
                <ion-icon name="headset-outline"></ion-icon>
                <span class="route-header-text">
                  <span class="route-header-name">${getRouteTitle(route)}</span>
                  ${routeNote ? `<span class="route-header-sub">${routeNote}</span>` : ''}
                  ${routeUnlockText ? `<span class="route-header-sub route-header-unlock">${routeUnlockText}</span>` : ''}
                </span>
              </span>
              <div class="route-header-meta">
                ${routeUnlocked
                  ? `${routePercentMarkup}<ion-icon name="chevron-down"></ion-icon>`
                  : `<span class="route-lock-pill"><ion-icon name="lock-closed-outline"></ion-icon></span>`
                }
              </div>
            </button>
            <div class="route-modules">
              ${modulesMarkup}
            </div>
          </div>
        `;
        })
        .join('');

    const getExpandedJourneyState = () => {
      const currentExpandedRoute = routes.find((item) => item.id === this.expandedRouteId) || activeRoute;
      return {
        expandedRoute: currentExpandedRoute,
        accordionMarkup: buildAccordionMarkup()
      };
    };

    const bindAccordionInteractions = () => {
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
          const isClosingRoute = this.expandedRouteId === routeId;
          this.expandedRouteId = isClosingRoute ? '' : routeId;
          try { localStorage.setItem(HOME_EXPANDED_ROUTE_KEY, this.expandedRouteId); } catch {}
          if (!isClosingRoute) {
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
          }
          updateJourneyUi();
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
          updateJourneyUi();
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
          this.setPendingHomeReturnScroll(this.homeScrollTop);
          this.cancelRoutesCentering().catch(() => {});
          goToSpeak('forward');
        });
      });
    };

    const updateJourneyUi = () => {
      const state = getExpandedJourneyState();
      const accordionEl = this.querySelector('.journey-accordion');
      if (accordionEl) {
        accordionEl.innerHTML = state.accordionMarkup;
      }
      bindAccordionInteractions();
      this.journeySheetExpandedOffset = this.measureJourneySheetExpandedOffset();
      this.applyJourneySheetState({ animate: false, force: true });
      this.scheduleLayoutSync(0);
      this.flushRoutesCenterScroll();
    };

    const initialJourneyState = getExpandedJourneyState();
    const { accordionMarkup } = initialJourneyState;
    const nextHomeHtml = `
      ${renderAppHeader({ title: tabTitle, rewardBadgesId: 'home-reward-badges', locale: uiLocale })}
      <ion-content fullscreen class="home-journey free-ride-content secret-content">
        <div class="speak-shell free-ride-shell journey-shell">
          <section class="free-ride-hero-card journey-plan-card onboarding-intro-card">
            <div class="free-ride-hero-stage journey-plan-stage">
              <span class="journey-plan-mascot-wrap free-ride-mascot-wrap" aria-hidden="true">
                <img
                  class="onboarding-intro-cat free-ride-mascot"
                  id="home-plan-mascot"
                  src="${planMascotSrc}"
                  alt=""
                >
              </span>
              <div class="journey-plan-body">
                <p class="onboarding-intro-bubble free-ride-hero-bubble journey-plan-bubble hero-playable-bubble">
                  <span class="journey-plan-bubble-text"><span class="free-ride-hero-bubble-icon" aria-hidden="true"><ion-icon name="volume-high-outline"></ion-icon></span>${planRestHtml}</span>
                </p>
              </div>
            </div>
          </section>

          <section class="free-ride-card journey-sheet">
            <button class="free-ride-card-handle journey-sheet-handle${isHandleHintSeen() ? '' : ' has-hint'}" type="button" aria-label="Expand training card" aria-expanded="false">
              <span class="free-ride-card-handle-pill journey-sheet-handle-pill" aria-hidden="true"></span>
              <span class="handle-hint${isHandleHintSeen() ? ' handle-hint-out' : ''}" aria-hidden="true"><ion-icon name="chevron-up-outline"></ion-icon><span class="handle-hint-label">${uiLocale === 'es' ? 'pruébame' : 'try me'}</span></span>
            </button>
            <div class="free-ride-card-main journey-sheet-main">
              <div class="journey-accordion">
                ${accordionMarkup}
              </div>
            </div>
          </section>
        </div>
      </ion-content>
    `;
    const isLoadingHydration = this.dataset.homeRenderState === 'loading';
    if (isLoadingHydration) {
      const currentAccordion = this.querySelector('.journey-accordion');
      if (currentAccordion) {
        currentAccordion.innerHTML = accordionMarkup;
      } else {
        this.innerHTML = nextHomeHtml;
      }
    } else {
      this.innerHTML = nextHomeHtml;
    }
    this.dataset.homeRenderState = 'ready';
    bindAccordionInteractions();
    const journeySheetHandleEl = this.getJourneySheetHandleEl();
    if (!isLoadingHydration) {
      journeySheetHandleEl?.addEventListener('pointerdown', (event) => {
        this.startJourneySheetDrag(event);
      });
      journeySheetHandleEl?.addEventListener('pointermove', (event) => {
        this.moveJourneySheetDrag(event);
      });
      journeySheetHandleEl?.addEventListener('pointerup', (event) => {
        this.finishJourneySheetDrag(event);
      });
      journeySheetHandleEl?.addEventListener('pointercancel', () => {
        this.cancelJourneySheetDrag();
      });
      journeySheetHandleEl?.addEventListener('lostpointercapture', () => {
        this.cancelJourneySheetDrag();
      });
      journeySheetHandleEl?.addEventListener('click', (event) => {
        const lastPointerUpTs = Number(this.journeySheetLastPointerUpTs) || 0;
        if (lastPointerUpTs && Date.now() - lastPointerUpTs < 350) {
          event.preventDefault();
          return;
        }
        this.toggleJourneySheet({ animate: true });
      });
      journeySheetHandleEl?.addEventListener('keydown', (event) => {
        const key = event && event.key ? event.key : '';
        if (key !== 'Enter' && key !== ' ') return;
        event.preventDefault();
        this.toggleJourneySheet({ animate: true });
      });
    }
    this.journeySheetExpandedOffset = this.measureJourneySheetExpandedOffset();
    this.applyJourneySheetState({ animate: false, force: true });

    if (typeof this.updateHeaderRewards === 'function') {
      this.updateHeaderRewards();
    }
    this.bindPlanHeroEvents(options);
    this.flushRoutesCenterScroll();
    this.renderPlanMascotFrame(this.planMascotFrameIndex);
    this.setPlanBubbleSpeaking(this.planMascotIsTalking);
    const restoreScrollTop = Number.isFinite(Number(options.restoreScrollTop))
      ? Number(options.restoreScrollTop)
      : null;
    this.bindHomeScrollTracking().catch(() => {});
    if (restoreScrollTop !== null) {
      this.restoreHomeScrollPosition(restoreScrollTop).catch(() => {});
    }
    this.schedulePendingHomeReturnScrollRestore();
    this.schedulePendingHomeReturnReveal();
    this.scheduleLayoutSync(0);
    this.scheduleLayoutSync(140);
  }

  bindPlanHeroEvents(options = {}) {
    this.querySelector('.app-locale-btn')?.addEventListener('click', () => {
      const nextLocale = getNextLocaleCode(getActiveLocale() || 'en');
      setLocaleOverride(nextLocale);
      if (window.varGlobal && typeof window.varGlobal === 'object') {
        window.varGlobal.locale = nextLocale;
      }
      window.dispatchEvent(new CustomEvent('app:locale-change', { detail: { locale: nextLocale } }));
    });
    const planCardEl = this.querySelector('.journey-plan-card');
    planCardEl?.addEventListener('click', (event) => {
      if (this.isEventInHeaderZone(event)) return;
      const target = event && event.target && typeof event.target.closest === 'function'
        ? event.target
        : null;
      if (!target) return;
      const inNarrationZone = target.closest('.onboarding-intro-bubble, .free-ride-hero-bubble, .journey-plan-bubble');
      if (!inNarrationZone) return;
      this.playPlanNarration({ manual: true });
    });
  }

  normalizeLocale(locale) {
    return normalizeCopyLocale(locale);
  }

  areSessionPercentagesVisible() {
    const globalValue =
      window.r34lp0w3r &&
      Object.prototype.hasOwnProperty.call(window.r34lp0w3r, 'speakSessionPercentagesVisible')
        ? window.r34lp0w3r.speakSessionPercentagesVisible
        : undefined;
    if (typeof globalValue === 'boolean') return globalValue;
    if (typeof globalValue === 'string') {
      const normalized = globalValue.trim().toLowerCase();
      if (!normalized) return true;
      return !['0', 'false', 'off'].includes(normalized);
    }
    try {
      const raw = localStorage.getItem(SPEAK_SESSION_PERCENTAGES_VISIBLE_KEY);
      if (raw === null || raw === undefined || raw === '') return true;
      return !['0', 'false', 'off'].includes(String(raw).trim().toLowerCase());
    } catch (err) {
      return true;
    }
  }

  getBaseLocale() {
    const fromState = getActiveLocale() || (window.varGlobal && window.varGlobal.locale) || 'en';
    return this.normalizeLocale(fromState) || 'en';
  }

  getUiLocale(baseLocale = '') {
    const overrideLocale = this.normalizeLocale(this.state.localeOverride);
    if (overrideLocale) return overrideLocale;
    return this.normalizeLocale(baseLocale) || this.getBaseLocale();
  }

  applyHeaderColor(color) {
    const normalized = FREE_RIDE_HEADER_COLOR_VALUES.includes(color) ? color : 'white';
    FREE_RIDE_HEADER_COLOR_VALUES.forEach((value) => this.classList.remove(`header-color-${value}`));
    this.classList.add(`header-color-${normalized}`);
  }

  getTabsEl() {
    return this.closest('ion-tabs') || document.querySelector('tabs-page ion-tabs');
  }

  isEventInHeaderZone(event) {
    if (!event) return false;
    const y = Number(event.clientY);
    if (!Number.isFinite(y)) return false;
    const headerEl = this.querySelector('ion-header');
    if (!headerEl || typeof headerEl.getBoundingClientRect !== 'function') return false;
    const rect = headerEl.getBoundingClientRect();
    return y <= rect.bottom + 2;
  }

  isTabActive(tabName = 'home') {
    const normalizedTabName = String(tabName || '')
      .trim()
      .toLowerCase();
    const tabHost = this.closest('ion-tab');
    if (tabHost) {
      const hostTab = String(tabHost.getAttribute('tab') || '')
        .trim()
        .toLowerCase();
      if (normalizedTabName && hostTab && hostTab !== normalizedTabName) return false;
      if (tabHost.getAttribute('aria-hidden') === 'true') return false;
      if (tabHost.classList.contains('tab-hidden')) return false;
      const styles = window.getComputedStyle ? window.getComputedStyle(tabHost) : null;
      if (styles && styles.display === 'none') return false;
    }
    const tabsEl = this.getTabsEl();
    if (tabsEl && normalizedTabName) {
      const selectedFromAttr = String(tabsEl.getAttribute('selected-tab') || '')
        .trim()
        .toLowerCase();
      const selectedFromProp =
        typeof tabsEl.selectedTab === 'string' ? String(tabsEl.selectedTab).trim().toLowerCase() : '';
      const selected = selectedFromAttr || selectedFromProp;
      if (selected) return selected === normalizedTabName;
      try {
        const stored = String(localStorage.getItem('appv5:active-tab') || '')
          .trim()
          .toLowerCase();
        if (stored) return stored === normalizedTabName;
      } catch (err) {
        // no-op
      }
      if (tabHost) return tabHost.classList.contains('tab-selected');
      return normalizedTabName === 'home';
    }
    return true;
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

  getAutoNarrationDelay(baseMs = 90) {
    const normalized = Math.max(0, Number(baseMs) || 0);
    if (this.isNativeRuntime()) return normalized;
    return normalized + BROWSER_AUTONARRATION_EXTRA_DELAY_MS;
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

  extractNarrationLines(value) {
    const raw = String(value || '');
    if (!raw.trim()) return [];
    const normalized = raw
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\/p>\s*<p>/gi, '\n')
      .replace(/<\/li>\s*<li>/gi, '\n');
    const lines = normalized
      .split(/\r?\n+/)
      .map((part) => {
        const html = String(part || '').trim();
        const text = this.extractSpeechText(html);
        if (!text) return null;
        return { text, html };
      })
      .filter(Boolean);
    if (lines.length) return lines;
    const fallback = this.extractSpeechText(raw);
    return fallback ? [{ text: fallback, html: '' }] : [];
  }

  resolveAlignedTtsEndpoint() {
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
  }

  buildAlignedTtsHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const cfg = window.realtimeConfig || {};
    const token =
      typeof cfg.authToken === 'string'
        ? cfg.authToken.trim()
          : '';
    if (token) {
      headers['x-rt-token'] = token;
    }
    return headers;
  }

  normalizeAlignedTtsRequestOptions(options = {}) {
    const source = options && typeof options === 'object' ? options : {};
    const voiceProfile = String(source.voiceProfile || source.voice_profile || '').trim().toLowerCase();
    const voice = String(source.voice || '').trim();
    const engine = String(source.engine || '').trim().toLowerCase();
    const rate = String(source.rate || '').trim();
    const pitch = String(source.pitch || '').trim();
    return {
      voiceProfile,
      voice,
      engine,
      rate,
      pitch
    };
  }

  getPlanNarrationTtsOptions(locale = this.currentUiLocale) {
    return {};
  }

  getAlignedTtsCacheKey(text, lang, options = {}) {
    const normalized = this.normalizeAlignedTtsRequestOptions(options);
    return [
      String(lang || '').trim().toLowerCase(),
      String(text || '').trim(),
      normalized.voiceProfile,
      normalized.voice,
      normalized.engine,
      normalized.rate,
      normalized.pitch
    ].join('::');
  }

  getAlignedTtsFromCache(text, lang, options = {}) {
    const key = this.getAlignedTtsCacheKey(text, lang, options);
    if (!key || !this.alignedTtsCache.has(key)) return null;
    const cached = this.alignedTtsCache.get(key);
    this.alignedTtsCache.delete(key);
    this.alignedTtsCache.set(key, cached);
    return cached;
  }

  storeAlignedTtsInCache(text, lang, payload, options = {}) {
    const key = this.getAlignedTtsCacheKey(text, lang, options);
    if (!key || !payload) return;
    this.alignedTtsCache.set(key, payload);
    while (this.alignedTtsCache.size > HOME_ALIGNED_CACHE_MAX_ITEMS) {
      const oldest = this.alignedTtsCache.keys().next();
      if (oldest && !oldest.done) {
        this.alignedTtsCache.delete(oldest.value);
      } else {
        break;
      }
    }
  }

  async fetchAlignedTts(text, lang, options = {}) {
    const expected = String(text || '').trim();
    const locale = String(lang || '').trim() || 'en-US';
    if (!expected) return null;
    const normalizedOptions = this.normalizeAlignedTtsRequestOptions(options);

    const cached = this.getAlignedTtsFromCache(expected, locale, normalizedOptions);
    if (cached) return cached;

    const endpoint = this.resolveAlignedTtsEndpoint();
    if (!endpoint) return null;

    const body = {
      text: expected,
      locale
    };
    if (normalizedOptions.voiceProfile) {
      body.voice_profile = normalizedOptions.voiceProfile;
    }
    if (normalizedOptions.voice) {
      body.voice = normalizedOptions.voice;
    }
    if (normalizedOptions.engine) {
      body.engine = normalizedOptions.engine;
    }
    if (normalizedOptions.rate) {
      body.rate = normalizedOptions.rate;
    }
    if (normalizedOptions.pitch) {
      body.pitch = normalizedOptions.pitch;
    }
    const user = window.user;
    if (user && user.id !== undefined && user.id !== null && String(user.id).trim()) {
      body.user_id = String(user.id).trim();
    }
    const userName = getResolvedUserName(user);
    if (userName) {
      body.user_name = userName;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.buildAlignedTtsHeaders(),
      body: JSON.stringify(body)
    });
    if (!response.ok) return null;

    const data = await response.json();
    if (!data || data.ok !== true) return null;
    if (typeof data.audio_url !== 'string' || !data.audio_url.trim()) return null;
    this.storeAlignedTtsInCache(expected, locale, data, normalizedOptions);
    return data;
  }

  async stopNarrationPlayback() {
    if (this.narrationAudio) {
      try {
        this.narrationAudio.pause();
        this.narrationAudio.currentTime = 0;
      } catch (err) {
        // no-op
      }
      this.narrationAudio.onplaying = null;
      this.narrationAudio.onended = null;
      this.narrationAudio.onerror = null;
      this.narrationAudio = null;
    }
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
    if (appState && appState.homePlanAutoNarrationPlayed) return true;
    try {
      const persisted = localStorage.getItem(HOME_PLAN_AUTONARRATION_PLAYED_KEY) === '1';
      if (persisted) {
        if (!window.r34lp0w3r) window.r34lp0w3r = {};
        window.r34lp0w3r.homePlanAutoNarrationPlayed = true;
      }
      return persisted;
    } catch (err) {
      return false;
    }
  }

  markAutoPlanNarrationPlayed() {
    if (typeof window === 'undefined') return;
    if (!window.r34lp0w3r) window.r34lp0w3r = {};
    window.r34lp0w3r.homePlanAutoNarrationPlayed = true;
    try {
      localStorage.setItem(HOME_PLAN_AUTONARRATION_PLAYED_KEY, '1');
    } catch (err) {
      // no-op
    }
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
  }

  teardownBrowserNarrationRetry() {
    this.clearBrowserNarrationRetryTimer();
    if (!this.browserNarrationRetryHandler) return;
    window.removeEventListener('load', this.browserNarrationRetryHandler);
    window.removeEventListener('pageshow', this.browserNarrationRetryHandler);
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
    if (waitMs === 0) {
      if (!this.isConnected) return;
      if (!forceNarration && !this.isTabActive('home')) return;
      this.playPlanNarration({ manual: false, force: forceNarration });
      return;
    }
    this.narrationTimer = setTimeout(() => {
      this.narrationTimer = null;
      if (!this.isConnected) return;
      if (!forceNarration && !this.isTabActive('home')) return;
      this.playPlanNarration({ manual: false, force: forceNarration });
    }, waitMs);
  }

  playPlanNarration(options = {}) {
    const manual = Boolean(options && options.manual);
    const force = Boolean(options && options.force);
    if (!force && !this.isTabActive('home')) {
      return Promise.resolve(false);
    }
    if (this.planNarrationPromise) {
      return this.planNarrationPromise;
    }
    const lines = this.extractNarrationLines(this.currentPlanMessage);
    if (!lines.length) {
      this.stopNarration().catch(() => {});
      return Promise.resolve(false);
    }
    const locale = this.getUiLocale(this.currentUiLocale);
    const alignedTtsOptions = this.getPlanNarrationTtsOptions(locale);
    const runPromise = this.speakNarration(lines, locale, {
      bubbleEl: this.getPlanBubbleEl(),
      allowWebFallback: manual,
      alignedTtsOptions
    })
      .then((started) => {
        if (started && !this.initialPlanNarrationStarted) {
          this.initialPlanNarrationStarted = true;
          this.markAutoPlanNarrationPlayed();
        }
        return started;
      })
      .catch((err) => {
        console.warn('[home] narration error', err);
        return false;
      })
      .finally(() => {
        if (this.planNarrationPromise === runPromise) {
          this.planNarrationPromise = null;
        }
      });
    this.planNarrationPromise = runPromise;
    return runPromise;
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

  async playNarrationAligned(text, lang, token, hooks = {}, ttsOptions = {}) {
    const lineText = String(text || '').trim();
    if (!lineText) return false;
    if (token !== this.narrationToken) return false;

    let payload = null;
    try {
      payload = await this.fetchAlignedTts(lineText, lang, ttsOptions);
    } catch (err) {
      payload = null;
    }
    if (!payload && ttsOptions && Object.keys(ttsOptions).length) {
      try {
        payload = await this.fetchAlignedTts(lineText, lang);
      } catch (err) {
        payload = null;
      }
    }
    if (!payload || token !== this.narrationToken) return false;

    const audioUrl = String(payload.audio_url || '').trim();
    if (!audioUrl) return false;

    const onPlaybackStart =
      hooks && typeof hooks.onPlaybackStart === 'function' ? hooks.onPlaybackStart : null;
    const onPlaybackEnd =
      hooks && typeof hooks.onPlaybackEnd === 'function' ? hooks.onPlaybackEnd : null;
    const audio = new Audio(audioUrl);
    audio.preload = 'auto';

    return new Promise((resolve) => {
      let started = false;
      let settled = false;
      let cancelTimer = null;
      let startTimeout = null;
      let maxTimeout = null;

      const notifyStart = () => {
        if (started) return;
        started = true;
        if (onPlaybackStart) onPlaybackStart();
      };

      const cleanup = () => {
        if (cancelTimer) {
          clearInterval(cancelTimer);
          cancelTimer = null;
        }
        if (startTimeout) {
          clearTimeout(startTimeout);
          startTimeout = null;
        }
        if (maxTimeout) {
          clearTimeout(maxTimeout);
          maxTimeout = null;
        }
        audio.onplaying = null;
        audio.onended = null;
        audio.onerror = null;
        if (this.narrationAudio === audio) {
          this.narrationAudio = null;
        }
      };

      const settle = () => {
        if (settled) return;
        settled = true;
        cleanup();
        if (onPlaybackEnd) onPlaybackEnd();
        resolve(started);
      };

      cancelTimer = setInterval(() => {
        if (settled) return;
        if (token !== this.narrationToken) {
          try {
            audio.pause();
            audio.currentTime = 0;
          } catch (err) {
            // no-op
          }
          settle();
        }
      }, 80);

      startTimeout = setTimeout(() => {
        settle();
      }, 1800);

      const payloadDurationMs = Number(payload && (payload.duration_ms || payload.durationMs || 0)) || 0;
      const estimatedMs = Math.min(
        18000,
        Math.max(
          1600,
          payloadDurationMs > 0 ? payloadDurationMs + 1800 : Math.round(lineText.length * 80) + 3200
        )
      );
      maxTimeout = setTimeout(() => {
        settle();
      }, estimatedMs);

      audio.onplaying = () => {
        notifyStart();
      };
      audio.onended = () => {
        settle();
      };
      audio.onerror = () => {
        settle();
      };

      this.narrationAudio = audio;
      audio
        .play()
        .then(() => {
          if (token !== this.narrationToken) {
            try {
              audio.pause();
              audio.currentTime = 0;
            } catch (err) {
              // no-op
            }
            settle();
            return;
          }
          notifyStart();
        })
        .catch(() => {
          settle();
        });
    });
  }

  async speakNarration(linesOrText, locale, options = {}) {
    const lines = Array.isArray(linesOrText)
      ? linesOrText.filter((line) => line && typeof line.text === 'string' && line.text.trim())
      : this.extractNarrationLines(linesOrText);
    if (!lines.length) return false;
    const normalizedLocale = this.normalizeLocale(locale) || 'en';
    const lang = TTS_LANG_BY_LOCALE[normalizedLocale] || 'en-US';
    const token = ++this.narrationToken;
    const bubbleEl = options && options.bubbleEl ? options.bubbleEl : this.getPlanBubbleEl();
    const allowWebFallback = options && options.allowWebFallback !== false;
    const alignedTtsOptions =
      options && options.alignedTtsOptions ? options.alignedTtsOptions : {};
    const hasMultipleLines = lines.length > 1;
    const originalBubbleHtml = bubbleEl ? bubbleEl.innerHTML : '';
    const originalBubbleMinHeight = bubbleEl ? bubbleEl.style.minHeight : '';
    const restLine = lines[0] || null;

    await this.stopNarrationPlayback();
    if (token !== this.narrationToken) return false;

    if (bubbleEl) {
      bubbleEl.dataset.narrationToken = String(token);
    }

    const applyLine = (line) => {
      if (!bubbleEl) return;
      if (bubbleEl.dataset.narrationToken !== String(token)) return;
      const lineHtml = line && typeof line.html === 'string' ? line.html.trim() : '';
      if (lineHtml) {
        bubbleEl.innerHTML = lineHtml;
      } else {
        bubbleEl.textContent = line && line.text ? line.text : '';
      }
    };

    const measureMaxLineHeight = () => {
      if (!bubbleEl || !hasMultipleLines) return 0;
      const width =
        Math.ceil(
          bubbleEl.getBoundingClientRect().width || bubbleEl.clientWidth || bubbleEl.offsetWidth || 0
        ) || 0;
      if (!width) return 0;
      const probe = document.createElement('div');
      probe.className = bubbleEl.className;
      probe.setAttribute('aria-hidden', 'true');
      probe.style.position = 'absolute';
      probe.style.visibility = 'hidden';
      probe.style.pointerEvents = 'none';
      probe.style.left = '-99999px';
      probe.style.top = '0';
      probe.style.width = `${width}px`;
      probe.style.minHeight = '0';
      probe.style.height = 'auto';
      const parent = bubbleEl.parentElement || this;
      parent.appendChild(probe);
      let maxHeight = 0;
      lines.forEach((line) => {
        const html = line && typeof line.html === 'string' ? line.html.trim() : '';
        if (html) probe.innerHTML = html;
        else probe.textContent = line && line.text ? line.text : '';
        const nextHeight = Math.ceil(
          Math.max(probe.scrollHeight || 0, probe.getBoundingClientRect().height || 0)
        );
        if (nextHeight > maxHeight) maxHeight = nextHeight;
      });
      probe.remove();
      return maxHeight;
    };

    if (bubbleEl) {
      if (hasMultipleLines && restLine) applyLine(restLine);
      if (hasMultipleLines) {
        const maxHeight = measureMaxLineHeight();
        if (maxHeight > 0) {
          bubbleEl.style.minHeight = `${maxHeight}px`;
        }
      } else {
        bubbleEl.style.minHeight = originalBubbleMinHeight;
      }
    }

    const restoreBubble = () => {
      if (!bubbleEl) return;
      if (bubbleEl.dataset.narrationToken !== String(token)) return;
      if (originalBubbleHtml) {
        bubbleEl.innerHTML = originalBubbleHtml;
      } else if (restLine) {
        applyLine(restLine);
      } else {
        bubbleEl.innerHTML = originalBubbleHtml;
      }
      bubbleEl.style.minHeight = originalBubbleMinHeight;
      delete bubbleEl.dataset.narrationToken;
    };

    const waitMs = (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, Math.max(0, Number(ms) || 0));
      });

    const estimateLinePlaybackMs = (lineText) => {
      const chars = String(lineText || '').trim().length;
      return Math.min(9500, Math.max(900, Math.round(chars * 72)));
    };

    const waitWebSpeechIdle = async (maxMs = 7000) => {
      if (!this.canWebSpeak() || typeof window === 'undefined' || !window.speechSynthesis) return;
      const synth = window.speechSynthesis;
      const startedAt = Date.now();
      while (token === this.narrationToken && Date.now() - startedAt < maxMs) {
        if (!synth.speaking && !synth.pending && !synth.paused) return;
        await waitMs(60);
      }
    };

    const plugin = this.getNativeTtsPlugin();
    const speakLineWithPlugin = async (lineText) => {
      if (!plugin || typeof plugin.speak !== 'function') return false;
      this.startPlanMascotTalk();
      const startedAt = Date.now();
      try {
        await plugin.speak({
          text: lineText,
          lang,
          rate: 1.0,
          pitch: 1.0,
          volume: 1.0,
          category: 'ambient',
          queueStrategy: 1
        });
        const minMs = estimateLinePlaybackMs(lineText);
        const elapsed = Date.now() - startedAt;
        if (elapsed < minMs && token === this.narrationToken) {
          await waitMs(minMs - elapsed);
        }
        return true;
      } catch (err) {
        return false;
      } finally {
        if (token === this.narrationToken) {
          this.stopPlanMascotTalk({ settle: true });
        }
      }
    };

    const speakLineWebWithRetry = async (lineText) => {
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

      let started = await this.speakNarrationWeb(lineText, lang, token, 1500, hooks);
      if (started && token === this.narrationToken) {
        const maxWait = Math.min(11000, estimateLinePlaybackMs(lineText) + 2400);
        await waitWebSpeechIdle(maxWait);
      }
      if (started || token !== this.narrationToken) return started;

      await waitMs(450);
      if (token !== this.narrationToken) return false;
      await this.stopNarrationPlayback();
      if (token !== this.narrationToken) return false;
      started = await this.speakNarrationWeb(lineText, lang, token, 3200, hooks);
      if (started && token === this.narrationToken) {
        const maxWait = Math.min(12000, estimateLinePlaybackMs(lineText) + 3000);
        await waitWebSpeechIdle(maxWait);
      }
      return started;
    };

    let startedAny = false;
    try {
      for (let index = 0; index < lines.length; index += 1) {
        if (token !== this.narrationToken) return startedAny;
        const line = lines[index];
        const lineText = String(line.text || '').trim();
        if (!lineText) continue;
        if (hasMultipleLines) {
          applyLine(line);
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

        let started = await this.playNarrationAligned(lineText, lang, token, hooks, alignedTtsOptions);
        if (!started && token === this.narrationToken) {
          started = await speakLineWithPlugin(lineText);
        }
        if (!started && allowWebFallback && token === this.narrationToken) {
          started = await speakLineWebWithRetry(lineText);
        }
        startedAny = startedAny || started;

        if (index < lines.length - 1 && token === this.narrationToken) {
          await waitMs(130);
        }
      }
      return startedAny;
    } finally {
      if (token === this.narrationToken) {
        this.stopPlanMascotTalk({ settle: true });
      }
      restoreBubble();
    }
  }
}

customElements.define('page-home', PageHome);
