import {
  ensureTrainingData,
  getRoutes,
  getSelection,
  resolveSelection,
  setSelection
} from '../data/training-data.js';

class PageListas extends HTMLElement {
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
    this.handleSelectionChange = () => this.render();
    window.addEventListener('training:selection-change', this.handleSelectionChange);
    this.updateHeaderUser = (user) => {
      const infoEl = this.querySelector('#training-user-info');
      const nameEl = this.querySelector('#training-user-name');
      const avatarEl = this.querySelector('#training-user-avatar');
      const logoutBtn = this.querySelector('#training-logout-btn');
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
      const container = this.querySelector('#training-reward-badges');
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
    this._storesHandler = () => this.render();
    window.addEventListener('app:speak-stores-change', this._storesHandler);
    this.render();
  }

  disconnectedCallback() {
    if (this.handleSelectionChange) {
      window.removeEventListener('training:selection-change', this.handleSelectionChange);
    }
    if (this._userHandler) {
      window.removeEventListener('app:user-change', this._userHandler);
    }
    if (this._storesHandler) {
      window.removeEventListener('app:speak-stores-change', this._storesHandler);
    }
  }

  render() {
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

    const getWordScoresStore = () =>
      (window.r34lp0w3r && window.r34lp0w3r.speakWordScores) || {};
    const getPhraseScoresStore = () =>
      (window.r34lp0w3r && window.r34lp0w3r.speakPhraseScores) || {};
    const getRewardStore = () =>
      (window.r34lp0w3r && window.r34lp0w3r.speakSessionRewards) || {};

    const hasSessionAttempts = (session) => {
      const wordScores = getWordScoresStore()[session.id] || {};
      const hasWord = Object.values(wordScores).some(
        (entry) => entry && typeof entry.percent === 'number'
      );
      const phrase = getPhraseScoresStore()[session.id];
      const hasPhrase = phrase && typeof phrase.percent === 'number';
      return hasWord || hasPhrase;
    };

    const getCorrectCount = (session) => {
      const words = session && session.speak && session.speak.spelling && Array.isArray(session.speak.spelling.words)
        ? session.speak.spelling.words
        : [];
      const sessionScores = getWordScoresStore()[session.id] || {};
      const threshold = getGoodThreshold();
      const wordCorrect = words.reduce((sum, word) => {
        const stored = sessionScores[word];
        const value = stored && typeof stored.percent === 'number' ? stored.percent : null;
        return sum + (value !== null && value >= threshold ? 1 : 0);
      }, 0);
      const phrase = getPhraseScoresStore()[session.id];
      const phraseCorrect =
        phrase && typeof phrase.percent === 'number' && phrase.percent >= threshold ? 1 : 0;
      return { correct: wordCorrect + phraseCorrect, total: words.length + 1 };
    };

    const getWordsPercent = (session) => {
      const words = session && session.speak && session.speak.spelling && Array.isArray(session.speak.spelling.words)
        ? session.speak.spelling.words
        : [];
      if (!words.length) return 0;
      const sessionScores = getWordScoresStore()[session.id] || {};
      const total = words.reduce((sum, word) => {
        const stored = sessionScores[word];
        const value = stored && typeof stored.percent === 'number' ? stored.percent : 0;
        return sum + value;
      }, 0);
      return Math.round(total / words.length);
    };

    const getPhrasePercent = (sessionId) => {
      const stored = getPhraseScoresStore()[sessionId];
      if (stored && typeof stored.percent === 'number') return stored.percent;
      return 0;
    };

    const getSessionPercent = (session) => {
      const wordsPercent = getWordsPercent(session);
      const phrasePercent = getPhrasePercent(session.id);
      return Math.round((wordsPercent + phrasePercent) / 2);
    };

    const getModulePercent = (module) => {
      const sessions = module && Array.isArray(module.sessions) ? module.sessions : [];
      if (!sessions.length) return { started: false, percent: null, tone: 'neutral' };
      const started = sessions.some((sessionItem) => hasSessionAttempts(sessionItem));
      if (!started) return { started: false, percent: null, tone: 'neutral' };
      const total = sessions.reduce((sum, sessionItem) => sum + getSessionPercent(sessionItem), 0);
      const percent = Math.round(total / sessions.length);
      return { started: true, percent, tone: getScoreTone(percent) };
    };

    const getRoutePercent = (routeItem) => {
      const modules = routeItem && Array.isArray(routeItem.modules) ? routeItem.modules : [];
      if (!modules.length) return { started: false, percent: null, tone: 'neutral' };
      const moduleProgress = modules.map((moduleItem) => getModulePercent(moduleItem));
      const started = moduleProgress.some((entry) => entry.started);
      if (!started) return { started: false, percent: null, tone: 'neutral' };
      const total = moduleProgress.reduce(
        (sum, entry) => sum + (entry.started ? entry.percent : 0),
        0
      );
      const percent = Math.round(total / modules.length);
      return { started: true, percent, tone: getScoreTone(percent) };
    };

    const routes = getRoutes();
    if (!routes.length) {
      this.innerHTML = `
        <ion-header translucent="true">
          <ion-toolbar class="secret-title">
            <div class="app-header-actions" slot="end">
              <div class="app-user-info" id="training-user-info" hidden>
                <img class="app-user-avatar" id="training-user-avatar" alt="Avatar">
                <span class="app-user-name" id="training-user-name"></span>
              </div>
              <div class="reward-badges" id="training-reward-badges"></div>
              <ion-button fill="clear" size="small" class="app-notify-btn">
                <ion-icon slot="icon-only" name="notifications-outline"></ion-icon>
              </ion-button>
              <ion-button fill="clear" size="small" class="app-logout-btn" id="training-logout-btn" hidden>
                <ion-icon slot="icon-only" name="log-out-outline"></ion-icon>
              </ion-button>
            </div>
          </ion-toolbar>
        </ion-header>
        <ion-content fullscreen class="training-content secret-content">
          <div class="training-shell">
            <div class="training-hero">
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

    const { route, module, session } = resolveSelection(getSelection());
    if (!route || !module || !session) return;

    const routeProgressList = routes.map((routeItem) => getRoutePercent(routeItem));
    const routeUnlockList = routes.map((_, idx) => {
      if (idx === 0) return true;
      const prev = routeProgressList[idx - 1];
      return prev && prev.tone === 'good';
    });
    const routeIndex = routes.findIndex((item) => item.id === route.id);
    const routeUnlocked = routeIndex === 0 || routeUnlockList[routeIndex] === true;

    if (!routeUnlocked) {
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

    const routeOptions = routes
      .map((routeItem, idx) => {
        const progress = routeProgressList[idx];
        const label =
          progress && progress.started ? `${routeItem.title} · ${progress.percent}%` : routeItem.title;
        const disabled = routeUnlockList[idx] ? '' : 'disabled="true"';
        return `<ion-select-option value="${routeItem.id}" ${disabled}>${label}</ion-select-option>`;
      })
      .join('');

    const moduleOptions = route.modules
      .map((moduleItem) => {
        const progress = getModulePercent(moduleItem);
        const label =
          progress && progress.started ? `${moduleItem.title} · ${progress.percent}%` : moduleItem.title;
        return `<ion-select-option value="${moduleItem.id}">${label}</ion-select-option>`;
      })
      .join('');

    const rows = module.sessions
      .map((item) => {
        const sessionProgress = getCorrectCount(item);
        const progressText = `${sessionProgress.correct}/${sessionProgress.total}`;
        const started = hasSessionAttempts(item);
        const sessionPercent = started ? getSessionPercent(item) : null;
        const labelText = started && sessionPercent !== null ? getScoreLabel(sessionPercent) : '';
        const tone = started && sessionPercent !== null ? getScoreTone(sessionPercent) : 'neutral';
        const toneClass =
          tone === 'good' ? 'good' : tone === 'okay' ? 'warn' : tone === 'bad' ? 'bad' : 'neutral';
        const scoreText = started && sessionPercent !== null ? `${sessionPercent}%` : '';
        const reward = getRewardStore()[item.id];
        const rewardIcon = reward && reward.rewardIcon ? reward.rewardIcon : 'diamond';
        const rewardQty = reward && typeof reward.rewardQty === 'number' ? reward.rewardQty : null;
        const rewardMarkup =
          rewardQty !== null && started
            ? `<div class="training-row-reward">
              <ion-icon name="${rewardIcon}"></ion-icon>
              <span>${rewardQty}</span>
            </div>`
            : '';
        const isActive = item.id === session.id;
        const iconClass = toneClass !== 'neutral' ? `training-row-icon-${toneClass}` : '';
        return `
          <div class="training-row ${isActive ? 'is-active' : ''}" data-session-id="${item.id}">
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
      .join('');

    this.innerHTML = `
      <ion-header translucent="true">
        <ion-toolbar class="secret-title">
          <div class="app-header-actions" slot="end">
            <div class="app-user-info" id="training-user-info" hidden>
              <img class="app-user-avatar" id="training-user-avatar" alt="Avatar">
              <span class="app-user-name" id="training-user-name"></span>
            </div>
            <div class="reward-badges" id="training-reward-badges"></div>
            <ion-button fill="clear" size="small" class="app-notify-btn">
              <ion-icon slot="icon-only" name="notifications-outline"></ion-icon>
            </ion-button>
            <ion-button fill="clear" size="small" class="app-logout-btn" id="training-logout-btn" hidden>
              <ion-icon slot="icon-only" name="log-out-outline"></ion-icon>
            </ion-button>
          </div>
        </ion-toolbar>
      </ion-header>
      <ion-content fullscreen class="training-content secret-content">
        <div class="training-shell">
          <div class="training-hero">
            <h2>Say It Like a Native</h2>
            <p>Entrena sonidos paso a paso y gana recompensas.</p>
          </div>
          <div class="training-filters">
            <ion-select
              class="training-pill active training-select"
              id="training-route-select"
              interface="action-sheet"
              value="${route.id}"
            >
              ${routeOptions}
            </ion-select>
            <ion-select
              class="training-pill training-select"
              id="training-module-select"
              interface="action-sheet"
              value="${module.id}"
            >
              ${moduleOptions}
            </ion-select>
          </div>
          <div class="training-list">
            ${rows}
          </div>
        </div>
      </ion-content>
    `;

    const rowsEl = Array.from(this.querySelectorAll('.training-row'));
    rowsEl.forEach((row) => {
      row.addEventListener('click', () => {
        const sessionId = row.dataset.sessionId;
        const selectedSession = module.sessions.find((item) => item.id === sessionId);
        if (!selectedSession) return;
        setSelection({
          routeId: route.id,
          moduleId: module.id,
          sessionId: selectedSession.id
        });
        const tabs = document.querySelector('ion-tabs');
        if (tabs && typeof tabs.select === 'function') {
          tabs.select('speak');
        }
      });
    });

    const routeSelect = this.querySelector('#training-route-select');
    if (routeSelect) {
      routeSelect.interfaceOptions = { header: 'Ruta' };
      routeSelect.addEventListener('ionChange', (event) => {
        const routeId = event.detail ? event.detail.value : null;
        if (!routeId) return;
        const nextRoute = routes.find((item) => item.id === routeId);
        if (!nextRoute) return;
        const idx = routes.findIndex((item) => item.id === routeId);
        if (idx > 0 && !routeUnlockList[idx]) {
          routeSelect.value = route.id;
          return;
        }
        const nextModule = nextRoute.modules[0];
        const nextSession = nextModule.sessions[0];
        setSelection({
          routeId: nextRoute.id,
          moduleId: nextModule.id,
          sessionId: nextSession.id
        });
      });
    }

    const moduleSelect = this.querySelector('#training-module-select');
    if (moduleSelect) {
      moduleSelect.interfaceOptions = { header: 'Modulo' };
      moduleSelect.addEventListener('ionChange', (event) => {
        const moduleId = event.detail ? event.detail.value : null;
        if (!moduleId) return;
        const nextModule = route.modules.find((item) => item.id === moduleId);
        if (!nextModule) return;
        const nextSession = nextModule.sessions[0];
        setSelection({
          routeId: route.id,
          moduleId: nextModule.id,
          sessionId: nextSession.id
        });
      });
    }

    this.querySelector('#training-logout-btn')?.addEventListener('click', this._logoutUser);
    this.updateHeaderUser(window.user);
    this.updateHeaderRewards();
  }
}

customElements.define('page-listas', PageListas);
