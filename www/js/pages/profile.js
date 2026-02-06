import { ensureTrainingData, getRoutes, setSelection } from '../data/training-data.js';

class PageProfile extends HTMLElement {
  connectedCallback() {
    this.classList.add('ion-page');
    if (!this.activeTab) this.activeTab = 'review';
    if (!this.reviewTone) {
      const storedTone = window.r34lp0w3r && window.r34lp0w3r.profileReviewTone;
      this.reviewTone = storedTone === 'okay' ? 'okay' : 'bad';
    }
    this._logoutUser = () => {
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
    this.render();
    this._userHandler = () => this.render();
    this._storesHandler = () => this.render();
    window.addEventListener('app:user-change', this._userHandler);
    window.addEventListener('app:speak-stores-change', this._storesHandler);
  }

  disconnectedCallback() {
    if (this._userHandler) {
      window.removeEventListener('app:user-change', this._userHandler);
    }
    if (this._storesHandler) {
      window.removeEventListener('app:speak-stores-change', this._storesHandler);
    }
  }

  render() {
    if (window.r34lp0w3r && window.r34lp0w3r.profileForceTab) {
      this.activeTab = window.r34lp0w3r.profileForceTab;
      window.r34lp0w3r.profileForceTab = null;
    }
    const storedReviewTone = window.r34lp0w3r && window.r34lp0w3r.profileReviewTone;
    if (storedReviewTone === 'okay' || storedReviewTone === 'bad') {
      this.reviewTone = storedReviewTone;
    }

    const routes = getRoutes();
    if (!routes.length && !this._loadingData) {
      this._loadingData = true;
      ensureTrainingData().then(() => {
        this._loadingData = false;
        this.render();
      });
    }

    const getUserDisplayName = (user) => {
      if (!user) return '';
      return user.name || user.first_name || user.email || user.social_id || '';
    };

    const getUserAvatar = (user) => {
      if (!user) return '';
      return user.image_local || user.image || '';
    };

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

    const escapeHtml = (value) =>
      String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const wordScoresStore =
      window.r34lp0w3r && window.r34lp0w3r.speakWordScores ? window.r34lp0w3r.speakWordScores : {};
    const phraseScoresStore =
      window.r34lp0w3r && window.r34lp0w3r.speakPhraseScores ? window.r34lp0w3r.speakPhraseScores : {};

    const reviewTone = this.reviewTone === 'okay' ? 'okay' : 'bad';
    const reviewToneLabel = reviewTone === 'okay' ? 'amarillo' : 'rojo';

    const sessionLookup = new Map();
    routes.forEach((routeItem) => {
      const modules = routeItem && Array.isArray(routeItem.modules) ? routeItem.modules : [];
      modules.forEach((moduleItem) => {
        const sessions = moduleItem && Array.isArray(moduleItem.sessions) ? moduleItem.sessions : [];
        sessions.forEach((sessionItem) => {
          sessionLookup.set(sessionItem.id, {
            routeId: routeItem.id,
            moduleId: moduleItem.id,
            session: sessionItem
          });
        });
      });
    });

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
    const hasAnyRoute = routeProgressList.some((entry) => entry.started);
    const globalPercent = hasAnyRoute
      ? Math.round(
          routeProgressList.reduce((sum, entry) => sum + (entry.started ? entry.percent : 0), 0) /
            (routes.length || 1)
        )
      : 0;
    const globalTone = hasAnyRoute ? getScoreTone(globalPercent) : 'neutral';

    const reviewWordsMap = new Map();
    Object.entries(wordScoresStore).forEach(([sessionId, sessionScores]) => {
      if (!sessionScores || typeof sessionScores !== 'object') return;
      Object.entries(sessionScores).forEach(([word, entry]) => {
        const percent = entry && typeof entry.percent === 'number' ? entry.percent : null;
        if (percent === null) return;
        const tone = getScoreTone(percent);
        if (tone !== reviewTone) return;
        const key = word.toLowerCase();
        const existing = reviewWordsMap.get(key);
        if (!existing || percent < existing.percent) {
          reviewWordsMap.set(key, { word, percent, sessionId });
        }
      });
    });
    const reviewWordEntries = Array.from(reviewWordsMap.values()).sort((a, b) =>
      a.word.localeCompare(b.word)
    );

    const reviewPhraseEntries = [];
    Object.entries(phraseScoresStore).forEach(([sessionId, entry]) => {
      const percent = entry && typeof entry.percent === 'number' ? entry.percent : null;
      if (percent === null) return;
      const tone = getScoreTone(percent);
      if (tone !== reviewTone) return;
      const sessionInfo = sessionLookup.get(sessionId);
      const phrase =
        sessionInfo &&
        sessionInfo.session &&
        sessionInfo.session.speak &&
        sessionInfo.session.speak.sentence
          ? sessionInfo.session.speak.sentence.sentence
          : '';
      if (!phrase) return;
      reviewPhraseEntries.push({ phrase, percent, sessionId });
    });
    reviewPhraseEntries.sort((a, b) => a.phrase.localeCompare(b.phrase));

    const user = window.user;
    const userId = user && user.id !== undefined && user.id !== null ? String(user.id) : '';
    const loggedIn = Boolean(userId);
    const reviewActive = this.activeTab === 'review';

    const reviewFiltersMarkup = `
      <div class="review-filters">
        <button class="review-filter-btn ${reviewTone === 'bad' ? 'active' : ''}" type="button" data-tone="bad">
          <span class="review-dot bad"></span>
          <span>Rojo</span>
        </button>
        <button class="review-filter-btn ${reviewTone === 'okay' ? 'active' : ''}" type="button" data-tone="okay">
          <span class="review-dot okay"></span>
          <span>Amarillo</span>
        </button>
      </div>
    `;

    const reviewWordsMarkup = reviewWordEntries.length
      ? `<div class="review-words">${reviewWordEntries
          .map(
            (entry) =>
              `<button class="review-word review-entry ${reviewTone}" type="button" data-type="word" data-word="${escapeHtml(entry.word)}" data-session-id="${escapeHtml(entry.sessionId)}">${escapeHtml(entry.word)}</button>`
          )
          .join('')}</div>`
      : `<div class="review-empty">Aún no hay palabras en ${reviewToneLabel}.</div>`;

    const reviewPhrasesMarkup = reviewPhraseEntries.length
      ? `<div class="review-phrases">${reviewPhraseEntries
          .map(
            (entry) =>
              `<button class="review-word review-phrase review-entry ${reviewTone}" type="button" data-type="phrase" data-session-id="${escapeHtml(entry.sessionId)}">${escapeHtml(entry.phrase)}</button>`
          )
          .join('')}</div>`
      : `<div class="review-empty">No hay frases en ${reviewToneLabel}.</div>`;

    this.innerHTML = `
      <ion-header translucent="true">
        <ion-toolbar class="secret-title">
          <div class="app-header-actions" slot="end">
            <div class="app-user-info" id="profile-user-info" hidden>
              <img class="app-user-avatar" id="profile-user-avatar" alt="Avatar">
              <span class="app-user-name" id="profile-user-name"></span>
            </div>
            <div class="reward-badges" id="profile-reward-badges"></div>
            <ion-button fill="clear" size="small" class="app-notify-btn">
              <ion-icon slot="icon-only" name="notifications-outline"></ion-icon>
            </ion-button>
            <ion-button fill="clear" size="small" class="app-logout-btn" id="profile-logout-btn" hidden>
              <ion-icon slot="icon-only" name="log-out-outline"></ion-icon>
            </ion-button>
          </div>
        </ion-toolbar>
      </ion-header>
      <ion-content fullscreen class="secret-content">
        <div class="page-shell profile-shell">
          <div class="card placeholder-card" id="profile-login-panel" ${loggedIn ? 'hidden' : ''}>
            <div class="pill">Acceso</div>
            <h3>Inicia sesion</h3>
            <p class="muted">Debes iniciar sesion para ver tu perfil.</p>
            <ion-button expand="block" shape="round" id="profile-login-btn">Iniciar sesion</ion-button>
          </div>
          <div class="profile-panel" id="profile-content-panel" ${loggedIn ? '' : 'hidden'}>
            <div class="card profile-overview">
              <div class="profile-progress">
                <div class="profile-progress-circle ${globalTone}">${globalPercent}</div>
                <div class="profile-progress-label">Pronunciacion</div>
              </div>
            </div>
            <div class="profile-tabs">
              <button class="profile-tab-btn ${reviewActive ? 'active' : ''}" type="button" data-tab="review">
                Review
              </button>
              <button class="profile-tab-btn ${!reviewActive ? 'active' : ''}" type="button" data-tab="prefs">
                Preferences
              </button>
            </div>
            <div class="profile-tab-panel" ${reviewActive ? '' : 'hidden'}>
              ${reviewFiltersMarkup}
              <h3 class="profile-section-title">Palabras a revisar</h3>
              ${reviewWordsMarkup}
              <h3 class="profile-section-title" style="margin-top:16px;">Frases a revisar</h3>
              ${reviewPhrasesMarkup}
            </div>
            <div class="profile-tab-panel" ${reviewActive ? 'hidden' : ''}>
              <h3 class="profile-section-title">Preferences</h3>
              <div class="profile-placeholder">Preferencias en construccion.</div>
            </div>
          </div>
        </div>
      </ion-content>
    `;

    const loginBtn = this.querySelector('#profile-login-btn');
    const logoutBtn = this.querySelector('#profile-logout-btn');
    const userInfoEl = this.querySelector('#profile-user-info');
    const userNameEl = this.querySelector('#profile-user-name');
    const userAvatarEl = this.querySelector('#profile-user-avatar');
    const rewardsEl = this.querySelector('#profile-reward-badges');

    const updateProfileState = (nextUser) => {
      const nextUserId =
        nextUser && nextUser.id !== undefined && nextUser.id !== null ? String(nextUser.id) : '';
      const isLoggedIn = Boolean(nextUserId);
      const loginPanel = this.querySelector('#profile-login-panel');
      const contentPanel = this.querySelector('#profile-content-panel');
      if (loginPanel) loginPanel.hidden = isLoggedIn;
      if (contentPanel) contentPanel.hidden = !isLoggedIn;
      if (logoutBtn) logoutBtn.hidden = !isLoggedIn;
      if (userInfoEl) userInfoEl.hidden = !isLoggedIn;
      if (!isLoggedIn || !nextUser) {
        if (userNameEl) userNameEl.textContent = '';
        if (userAvatarEl) {
          userAvatarEl.src = '';
          userAvatarEl.hidden = true;
        }
        return;
      }
      const name = getUserDisplayName(nextUser);
      const avatar = getUserAvatar(nextUser);
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

    loginBtn?.addEventListener('click', () => {
      openLoginModal().catch((err) => {
        console.error('[profile] error abriendo login', err);
      });
    });

    logoutBtn?.addEventListener('click', this._logoutUser);

    const tabButtons = Array.from(this.querySelectorAll('.profile-tab-btn'));
    tabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const tab = button.dataset.tab;
        if (!tab || tab === this.activeTab) return;
        this.activeTab = tab;
        this.render();
      });
    });

    const filterButtons = Array.from(this.querySelectorAll('.review-filter-btn'));
    filterButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const tone = button.dataset.tone;
        if (!tone || tone === this.reviewTone) return;
        this.reviewTone = tone === 'okay' ? 'okay' : 'bad';
        if (!window.r34lp0w3r) window.r34lp0w3r = {};
        window.r34lp0w3r.profileReviewTone = this.reviewTone;
        this.render();
      });
    });

    const findSessionLocation = (sessionId) => {
      if (!sessionId) return null;
      const entry = sessionLookup.get(sessionId);
      return entry ? { routeId: entry.routeId, moduleId: entry.moduleId, sessionId } : null;
    };

    const reviewButtons = Array.from(this.querySelectorAll('.review-entry'));
    reviewButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const type = button.dataset.type;
        const sessionId = button.dataset.sessionId;
        const location = findSessionLocation(sessionId);
        if (!location) return;
        if (!window.r34lp0w3r) window.r34lp0w3r = {};
        if (type === 'phrase') {
          window.r34lp0w3r.speakStartStep = 'sentence';
          window.r34lp0w3r.speakStartWord = null;
        } else {
          const word = button.dataset.word;
          if (!word) return;
          window.r34lp0w3r.speakStartStep = 'spelling';
          window.r34lp0w3r.speakStartWord = word;
        }
        window.r34lp0w3r.speakReturnToReview = true;
        window.r34lp0w3r.speakReturnSessionId = sessionId;
        window.r34lp0w3r.profileForceTab = 'review';
        window.r34lp0w3r.profileReviewTone = this.reviewTone;
        setSelection(location);
        const tabs = document.querySelector('ion-tabs');
        if (tabs && typeof tabs.select === 'function') {
          tabs.select('speak');
        }
      });
    });

    updateProfileState(user);
    updateHeaderRewards();
  }
}

customElements.define('page-profile', PageProfile);
