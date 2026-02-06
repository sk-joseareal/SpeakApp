import {
  ensureTrainingData,
  getRoutes,
  getSelection,
  resolveSelection,
  setSelection
} from '../data/training-data.js';

class PageHome extends HTMLElement {
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
    this._rewardsHandler = () => this.updateHeaderRewards();
    window.addEventListener('app:speak-stores-change', this._rewardsHandler);
    this._debugHandler = () => this.render();
    window.addEventListener('app:speak-debug', this._debugHandler);
    this.render();
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
  }

  render() {
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
              <h2>Say It Like a Native</h2>
              <p>Cargando rutas...</p>
            </div>
          </div>
        </ion-content>
      `;
      ensureTrainingData().then(() => this.render());
      this.updateHeaderUser(window.user);
      this.updateHeaderRewards();
      return;
    }

    const { route: activeRoute, module: activeModule } = resolveSelection(getSelection());
    if (!activeRoute || !activeModule) return;

    if (!this.expandedRouteId || !routes.some((item) => item.id === this.expandedRouteId)) {
      this.expandedRouteId = activeRoute.id;
    }
    const expandedRoute = routes.find((item) => item.id === this.expandedRouteId) || activeRoute;

    const getFeedbackConfig = () => {
      const config = window.r34lp0w3r && window.r34lp0w3r.speakFeedback;
      return {
        toneScale: config && Array.isArray(config.toneScale) ? config.toneScale : []
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

    const routeProgressList = routes.map((route) => getRoutePercent(route));
    const isDebug = Boolean(window.r34lp0w3r && window.r34lp0w3r.speakDebug);
    const routeUnlockList = routes.map((_, idx) => {
      if (isDebug) return true;
      if (idx === 0) return true;
      const prev = routeProgressList[idx - 1];
      return prev && prev.tone === 'good';
    });

    const expandedRouteIndex = routes.findIndex((item) => item.id === expandedRoute.id);
    const expandedRouteUnlocked =
      expandedRouteIndex === 0 || routeUnlockList[expandedRouteIndex] === true;

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
        const routeProgress = routeProgressList[routeIndex];
        const routeUnlocked = routeUnlockList[routeIndex];
        const routePercentMarkup =
          routeProgress && routeProgress.started
            ? `<span class="route-progress ${routeProgress.tone}">${routeProgress.percent}%</span>`
            : '';
        const modulesMarkup = route.modules
          .map((module) => {
            const isActive = route.id === activeRoute.id && module.id === activeModule.id;
            const progress = getModulePercent(module);
            const moduleClass = progress.started ? '' : 'module-item-neutral';
            const lockedClass = routeUnlocked ? '' : 'module-item-locked';
            const progressMarkup = progress.started
              ? `<span class="module-progress ${progress.tone}">${progress.percent}%</span>`
              : '';

            return `
              <div class="module-item ${moduleClass} ${lockedClass} ${isActive ? 'is-active' : ''}">
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
                    <ion-icon name="chevron-forward"></ion-icon>
                  </div>
                </button>
              </div>
            `;
          })
          .join('');

        return `
          <div class="route-item ${isRouteOpen ? 'is-open' : ''}">
            <button class="route-header" type="button" data-route-id="${route.id}">
              <span>${route.title}</span>
              <div class="route-header-meta">
                ${routePercentMarkup}
                <ion-icon name="chevron-down"></ion-icon>
              </div>
            </button>
            ${route.note ? `<div class="route-note">${route.note}</div>` : ''}
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
            <h2>Say It Like a Native</h2>
            <p>Tu camino para sonar natural, paso a paso.</p>
          </div>

          <div class="journey-welcome">
            <div class="journey-mascot">
              <div class="mascot-cat"></div>
              <div class="journey-bubble">
                \u00a1Hola! Este es tu camino donde conseguir\u00e1s sonar como un nativo.
              </div>
            </div>
            <div class="journey-start">
              <div class="journey-start-pill">${expandedRoute.title}</div>
              <button class="journey-start-btn ${expandedRouteUnlocked ? '' : 'is-locked'}" type="button">
                Start
              </button>
            </div>
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
      const firstModule = expandedRoute.modules[0];
      const firstSession = firstModule.sessions[0];
      setSelection({
        routeId: expandedRoute.id,
        moduleId: firstModule.id,
        sessionId: firstSession.id
      });
      const tabs = document.querySelector('ion-tabs');
      if (tabs && typeof tabs.select === 'function') {
        tabs.select('listas');
      }
    });

    const routeButtons = Array.from(this.querySelectorAll('.route-header'));
    routeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const routeId = button.dataset.routeId;
        if (!routeId) return;
        this.expandedRouteId = routeId;
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
        this.expandedRouteId = routeId;
        const route = routes.find((item) => item.id === routeId);
        const module = route && route.modules.find((item) => item.id === moduleId);
        if (!module) return;
        const firstSession = module.sessions[0];
        setSelection({
          routeId,
          moduleId,
          sessionId: firstSession.id
        });
        this.render();
        const tabs = document.querySelector('ion-tabs');
        if (tabs && typeof tabs.select === 'function') {
          tabs.select('listas');
        }
      });
    });

    this.querySelector('#home-logout-btn')?.addEventListener('click', this._logoutUser);
    this.updateHeaderUser(window.user);
    this.updateHeaderRewards();
  }
}

customElements.define('page-home', PageHome);
