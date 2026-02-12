import { ensureTrainingData, getRoutes, setSelection } from '../data/training-data.js';

class PageProfile extends HTMLElement {
  connectedCallback() {
    this.classList.add('ion-page');
    if (!this.activeTab) {
      let storedTab = '';
      if (window.r34lp0w3r && window.r34lp0w3r.profileActiveTab) {
        storedTab = window.r34lp0w3r.profileActiveTab;
      } else {
        try {
          storedTab = localStorage.getItem('appv5:profile-tab') || '';
        } catch (err) {
          storedTab = '';
        }
      }
      this.activeTab = storedTab === 'review' || storedTab === 'prefs' ? storedTab : 'prefs';
    }
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
    if (this._metaHandler) {
      window.removeEventListener('app:meta-change', this._metaHandler);
    }
  }

  render() {
    const persistProfileTab = (tab) => {
      if (!tab) return;
      if (!window.r34lp0w3r) window.r34lp0w3r = {};
      window.r34lp0w3r.profileActiveTab = tab;
      try {
        localStorage.setItem('appv5:profile-tab', tab);
      } catch (err) {
        // no-op
      }
    };
    const readStoredTab = () => {
      if (window.r34lp0w3r && window.r34lp0w3r.profileActiveTab) {
        return window.r34lp0w3r.profileActiveTab;
      }
      try {
        return localStorage.getItem('appv5:profile-tab') || '';
      } catch (err) {
        return '';
      }
    };
    if (window.r34lp0w3r && window.r34lp0w3r.profileForceTab) {
      this.activeTab = window.r34lp0w3r.profileForceTab;
      persistProfileTab(this.activeTab);
      window.r34lp0w3r.profileForceTab = null;
    } else {
      const storedTab = readStoredTab();
      if (storedTab === 'review' || storedTab === 'prefs') {
        this.activeTab = storedTab;
      }
    }
    if (this.activeTab !== 'review' && this.activeTab !== 'prefs') {
      this.activeTab = 'prefs';
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
    const prefsActive = this.activeTab === 'prefs';
    const reviewActive = this.activeTab === 'review';
    const showFooterLinks = loggedIn && prefsActive;
    const showAppMeta = !loggedIn || prefsActive;
    const formatExpiry = (value) => {
      if (!value) return 'n/a';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      const locale = (window.varGlobal && window.varGlobal.locale) || 'es';
      const lang = String(locale || 'es').toLowerCase();
      const fmtLocale = lang.startsWith('en')
        ? 'en-US'
        : lang.startsWith('br') || lang.startsWith('pt')
          ? 'pt-BR'
          : 'es-ES';
      try {
        return new Intl.DateTimeFormat(fmtLocale, {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        }).format(date);
      } catch (err) {
        return typeof date.toLocaleDateString === 'function'
          ? date.toLocaleDateString()
          : date.toISOString().split('T')[0];
      }
    };
    const formatAppMeta = (meta) => {
      const info = meta && typeof meta === 'object' ? meta : {};
      const version =
        info.version || info.appVersion || info.versionName || info.versionString || '';
      const build = info.build || info.appBuild || info.buildNumber || info.versionCode || '';
      if (version && build) return `v${version} (${build})`;
      if (version) return `v${version}`;
      if (build) return `build ${build}`;
      return 'v n/d';
    };
    const resetProfileState = (nextUser) => {
      if (!nextUser || nextUser.id === undefined || nextUser.id === null) {
        this.profileFormState = null;
        this.profileFormSeed = null;
        this._profileSeedId = null;
        this.profileSaveMessage = '';
        this.profileSaveError = false;
        return null;
      }
      let firstName = nextUser.first_name || '';
      let lastName = nextUser.last_name || '';
      if (!firstName && !lastName && nextUser.name) {
        const parts = String(nextUser.name).trim().split(/\s+/);
        firstName = parts.shift() || '';
        lastName = parts.join(' ');
      }
      const seed = {
        first_name: firstName,
        last_name: lastName,
        email: nextUser.email || '',
        expires_date: nextUser.expires_date || '',
        birthdate: nextUser.birthdate || '1901-01-01',
        lc: nextUser.lc || nextUser.locale || 'en-gb',
        sex: typeof nextUser.sex === 'number' ? nextUser.sex : 1
      };
      this.profileFormSeed = seed;
      this.profileFormState = {
        ...seed,
        password: '',
        passwordConfirm: ''
      };
      this._profileSeedId = String(nextUser.id);
      this.profileSaveMessage = '';
      this.profileSaveError = false;
      return this.profileFormState;
    };
    if (!loggedIn) {
      resetProfileState(null);
    } else if (!this.profileFormState || this._profileSeedId !== userId) {
      resetProfileState(user);
    }
    const profileSeed = this.profileFormSeed || {
      first_name: '',
      last_name: '',
      email: '',
      expires_date: '',
      birthdate: '1901-01-01',
      lc: 'en-gb',
      sex: 1
    };
    const profileState = this.profileFormState || {
      ...profileSeed,
      password: '',
      passwordConfirm: ''
    };
    const hasProfileChanges = () => {
      if (!loggedIn) return false;
      const first = String(profileState.first_name || '').trim();
      const last = String(profileState.last_name || '').trim();
      const baseFirst = String(profileSeed.first_name || '').trim();
      const baseLast = String(profileSeed.last_name || '').trim();
      if (first !== baseFirst || last !== baseLast) return true;
      if (profileState.password || profileState.passwordConfirm) return true;
      return false;
    };
    const getPasswordError = () => {
      const pass = String(profileState.password || '');
      const confirm = String(profileState.passwordConfirm || '');
      if (!pass && !confirm) return '';
      if (!pass || !confirm) return 'Completa las dos contraseñas.';
      if (pass !== confirm) return 'Las contraseñas no coinciden.';
      return '';
    };
    const profileNote = this.profileSaveMessage || '';
    const profileNoteError = this.profileSaveError === true;
    const appMetaLabel = formatAppMeta(window.appMeta);

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
            <div class="profile-links" id="profile-links-login" ${loggedIn ? 'hidden' : ''}>
              <button class="profile-link-btn" type="button" data-action="contact">Contacto</button>
              <button class="profile-link-btn" type="button" data-action="legal">Avisos legales</button>
            </div>
          </div>
          <div class="profile-panel" id="profile-content-panel" ${loggedIn ? '' : 'hidden'}>
            <div class="card profile-overview">
              <div class="profile-progress">
                <div class="profile-progress-circle ${globalTone}">${globalPercent}</div>
                <div class="profile-progress-label">Pronunciacion</div>
              </div>
            </div>
            <div class="profile-tabs">
              <button class="profile-tab-btn ${prefsActive ? 'active' : ''}" type="button" data-tab="prefs">
                Perfil
              </button>
              <button class="profile-tab-btn ${reviewActive ? 'active' : ''}" type="button" data-tab="review">
                Review
              </button>
            </div>
            <div class="profile-tab-panel" ${prefsActive ? '' : 'hidden'}>
              <div class="card profile-settings">
                <div class="profile-avatar-block">
                  <div class="profile-avatar-wrap">
                    <img
                      class="profile-avatar-large"
                      id="profile-avatar-img"
                      src="${escapeHtml(getUserAvatar(user) || 'https://s3.amazonaws.com/sk.CursoIngles/no-avatar.gif')}"
                      alt="Avatar perfil"
                    >
                  </div>
                  <div class="profile-avatar-actions">
                    <ion-button size="small" fill="outline" id="profile-avatar-upload">Cambiar foto</ion-button>
                    <ion-button size="small" fill="outline" color="medium" id="profile-avatar-delete">Eliminar</ion-button>
                  </div>
                  <input type="file" accept="image/jpeg,image/png,image/gif" id="profile-avatar-input" hidden>
                </div>
                <div class="profile-form">
                  <div class="profile-form-row">
                    <label class="profile-field">
                      <span class="profile-label">Nombre</span>
                      <input
                        class="profile-input"
                        type="text"
                        id="profile-first-name"
                        value="${escapeHtml(profileState.first_name || '')}"
                      >
                    </label>
                    <label class="profile-field">
                      <span class="profile-label">Apellidos</span>
                      <input
                        class="profile-input"
                        type="text"
                        id="profile-last-name"
                        value="${escapeHtml(profileState.last_name || '')}"
                      >
                    </label>
                  </div>
                  <div class="profile-form-row">
                    <label class="profile-field">
                      <span class="profile-label">Contraseña</span>
                      <input
                        class="profile-input"
                        type="password"
                        id="profile-password"
                        autocomplete="new-password"
                        placeholder="Nueva contraseña"
                      >
                    </label>
                    <label class="profile-field">
                      <span class="profile-label">Repetir contraseña</span>
                      <input
                        class="profile-input"
                        type="password"
                        id="profile-password-confirm"
                        autocomplete="new-password"
                        placeholder="Repite la contraseña"
                      >
                    </label>
                  </div>
                  <div class="profile-form-row">
                    <label class="profile-field">
                      <span class="profile-label">Email</span>
                      <input
                        class="profile-input"
                        type="email"
                        id="profile-email"
                        value="${escapeHtml(profileState.email || '')}"
                        readonly
                      >
                    </label>
                    <label class="profile-field">
                      <span class="profile-label">Suscripción hasta</span>
                      <input
                        class="profile-input"
                        type="text"
                        id="profile-expiry"
                        value="${escapeHtml(formatExpiry(profileState.expires_date))}"
                        readonly
                      >
                    </label>
                  </div>
                </div>
                <div class="profile-save-row">
                  <ion-button expand="block" shape="round" id="profile-save-btn">Guardar cambios</ion-button>
                  <p class="profile-save-note ${profileNoteError ? 'error' : ''}" id="profile-save-note">${
                    profileNote ? escapeHtml(profileNote) : ''
                  }</p>
                </div>
              </div>
            </div>
            <div class="profile-tab-panel" ${reviewActive ? '' : 'hidden'}>
              ${reviewFiltersMarkup}
              <h3 class="profile-section-title">Palabras a revisar</h3>
              ${reviewWordsMarkup}
              <h3 class="profile-section-title" style="margin-top:16px;">Frases a revisar</h3>
              ${reviewPhrasesMarkup}
            </div>
          </div>
          <div class="profile-links profile-links--footer" id="profile-links-footer" ${showFooterLinks ? '' : 'hidden'}>
            <button class="profile-link-btn" type="button" data-action="contact">Contacto</button>
            <button class="profile-link-btn" type="button" data-action="legal">Avisos legales</button>
          </div>
          <div class="profile-app-meta" id="profile-app-meta" ${showAppMeta ? '' : 'hidden'}>${escapeHtml(
            appMetaLabel
          )}</div>
        </div>
      </ion-content>
    `;

    const loginBtn = this.querySelector('#profile-login-btn');
    const logoutBtn = this.querySelector('#profile-logout-btn');
    const userInfoEl = this.querySelector('#profile-user-info');
    const userNameEl = this.querySelector('#profile-user-name');
    const userAvatarEl = this.querySelector('#profile-user-avatar');
    const rewardsEl = this.querySelector('#profile-reward-badges');
    const linksLogin = this.querySelector('#profile-links-login');
    const linksFooter = this.querySelector('#profile-links-footer');
    const appMetaEl = this.querySelector('#profile-app-meta');
    const avatarInput = this.querySelector('#profile-avatar-input');
    const avatarUploadBtn = this.querySelector('#profile-avatar-upload');
    const avatarDeleteBtn = this.querySelector('#profile-avatar-delete');
    const profileFirstName = this.querySelector('#profile-first-name');
    const profileLastName = this.querySelector('#profile-last-name');
    const profilePassword = this.querySelector('#profile-password');
    const profilePasswordConfirm = this.querySelector('#profile-password-confirm');
    const profileSaveBtn = this.querySelector('#profile-save-btn');
    const profileSaveNote = this.querySelector('#profile-save-note');

    const updateProfileState = (nextUser) => {
      const nextUserId =
        nextUser && nextUser.id !== undefined && nextUser.id !== null ? String(nextUser.id) : '';
      const isLoggedIn = Boolean(nextUserId);
      const loginPanel = this.querySelector('#profile-login-panel');
      const contentPanel = this.querySelector('#profile-content-panel');
      if (loginPanel) loginPanel.hidden = isLoggedIn;
      if (contentPanel) contentPanel.hidden = !isLoggedIn;
      if (linksLogin) linksLogin.hidden = isLoggedIn;
      const shouldShowFooterLinks = isLoggedIn && this.activeTab === 'prefs';
      const shouldShowAppMeta = !isLoggedIn || this.activeTab === 'prefs';
      if (linksFooter) linksFooter.hidden = !shouldShowFooterLinks;
      if (appMetaEl) appMetaEl.hidden = !shouldShowAppMeta;
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

    const updateProfileNote = () => {
      if (!profileSaveNote) return;
      const passwordError = getPasswordError();
      if (this.profileSaveMessage) {
        profileSaveNote.textContent = this.profileSaveMessage;
        profileSaveNote.classList.toggle('error', this.profileSaveError === true);
        return;
      }
      if (passwordError) {
        profileSaveNote.textContent = passwordError;
        profileSaveNote.classList.add('error');
        return;
      }
      profileSaveNote.textContent = '';
      profileSaveNote.classList.remove('error');
    };

    const updateSaveState = () => {
      if (!profileSaveBtn) return;
      const passwordError = getPasswordError();
      const dirty = hasProfileChanges();
      profileSaveBtn.disabled = !dirty || !!passwordError || this.profileSavePending === true;
      updateProfileNote();
    };

    const markProfileDirty = () => {
      this.profileSaveMessage = '';
      this.profileSaveError = false;
      updateSaveState();
    };

    const setProfileMessage = (message, isError) => {
      this.profileSaveMessage = message;
      this.profileSaveError = !!isError;
      updateSaveState();
    };

    const avatarConfig = {
      maxBytes: 500000,
      types: {
        'image/jpeg': 'jpeg',
        'image/png': 'png',
        'image/gif': 'gif'
      },
      exts: ['jpg', 'jpeg', 'png', 'gif']
    };

    const getAvatarExt = (file) => {
      if (file && file.type && avatarConfig.types[file.type]) {
        return avatarConfig.types[file.type];
      }
      if (file && file.name && file.name.includes('.')) {
        return file.name.split('.').pop().toLowerCase();
      }
      return 'jpeg';
    };

    const validateAvatarFile = (file) => {
      if (!file) {
        return { ok: false, message: 'No se pudo leer el archivo.' };
      }
      if (file.type) {
        if (!avatarConfig.types[file.type]) {
          return { ok: false, message: 'Formato no permitido. Usa JPG, PNG o GIF.' };
        }
      } else {
        const ext = getAvatarExt(file);
        if (!avatarConfig.exts.includes(ext)) {
          return { ok: false, message: 'Formato no permitido. Usa JPG, PNG o GIF.' };
        }
      }
      if (file.size && file.size > avatarConfig.maxBytes) {
        return { ok: false, message: 'Archivo demasiado grande. Max 500 KB.' };
      }
      return { ok: true, message: '' };
    };

    const applyProfileField = (field, value) => {
      if (!this.profileFormState) return;
      this.profileFormState[field] = value;
      markProfileDirty();
    };

    profileFirstName?.addEventListener('input', (event) => {
      applyProfileField('first_name', event.target.value);
    });
    profileLastName?.addEventListener('input', (event) => {
      applyProfileField('last_name', event.target.value);
    });
    profilePassword?.addEventListener('input', (event) => {
      applyProfileField('password', event.target.value);
    });
    profilePasswordConfirm?.addEventListener('input', (event) => {
      applyProfileField('passwordConfirm', event.target.value);
    });

    const clearLocalAvatar = async (targetUser) => {
      const fs = window.Capacitor?.Plugins?.Filesystem;
      if (!fs || !targetUser || targetUser.id === undefined || targetUser.id === null) return;
      const path = targetUser.image_path || `avatars/${targetUser.id}.jpg`;
      try {
        await fs.deleteFile({ path, directory: 'DATA' });
      } catch (err) {
        // no-op
      }
    };

    const updateLocalUser = (nextUser) => {
      if (typeof window.setUser === 'function') {
        window.setUser(nextUser);
      } else {
        window.user = nextUser;
        try {
          localStorage.setItem('appv5:user', JSON.stringify(nextUser));
        } catch (err) {
          console.error('[profile] error guardando usuario', err);
        }
        window.dispatchEvent(new CustomEvent('app:user-change', { detail: nextUser }));
      }
      return nextUser;
    };

    const submitProfileUpdate = async () => {
      if (!user || !profileSaveBtn) return;
      const passwordError = getPasswordError();
      if (passwordError) {
        setProfileMessage(passwordError, true);
        return;
      }
      if (!hasProfileChanges()) {
        setProfileMessage('', false);
        return;
      }
      this.profileSavePending = true;
      updateSaveState();
      const firstName = String(profileState.first_name || '').trim();
      const lastName = String(profileState.last_name || '').trim();
      const payload = {
        first_name: firstName,
        last_name: lastName,
        name: `${firstName} ${lastName}`.trim(),
        birthdate: profileSeed.birthdate || '1901-01-01',
        sex: profileSeed.sex,
        lc: profileSeed.lc,
        locale: (window.varGlobal && window.varGlobal.locale) || 'es'
      };
      if (profileState.password) {
        payload.password = String(profileState.password);
      }
      const result = await doPost('/v3/usr/updateprofile', user, payload);
      this.profileSavePending = false;
      if (!result.ok) {
        const message =
          (result && result.data && result.data.error) ||
          (result && result.error) ||
          'No se pudo actualizar el perfil.';
        setProfileMessage(message, true);
        updateSaveState();
        return;
      }
      const nextUser = {
        ...user,
        first_name: firstName,
        last_name: lastName,
        name: `${firstName} ${lastName}`.trim()
      };
      resetProfileState(nextUser);
      setProfileMessage('Perfil actualizado.', false);
      updateLocalUser(nextUser);
      updateSaveState();
    };

    profileSaveBtn?.addEventListener('click', () => {
      submitProfileUpdate().catch((err) => {
        console.error('[profile] error guardando perfil', err);
        setProfileMessage('No se pudo actualizar el perfil.', true);
      });
    });

    const uploadAvatar = async (file) => {
      if (!user || !file) return;
      const validation = validateAvatarFile(file);
      if (!validation.ok) {
        setProfileMessage(validation.message, true);
        return;
      }
      this.profileSavePending = true;
      updateSaveState();
      const apiURL =
        (window.varGlobal && window.varGlobal.apiURL) ||
        (window.env === 'PRO' ? window.apiPRO : window.apiDEV) ||
        '';
      const timestamp = Math.round(Date.now() / 1000);
      const query = new URLSearchParams({
        timestamp: String(timestamp),
        user_id: String(user.id),
        token: String(user.token || '')
      }).toString();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('user_id', user.id);
      formData.append('token', user.token || '');
      formData.append('timestamp', timestamp);
      try {
        const response = await fetch(`${apiURL}/v3/fileupload?${query}`, {
          method: 'POST',
          headers: {
            Authorization: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            'X-Platform': deviceId()
          },
          body: formData
        });
        const text = await response.text();
        let payload = null;
        if (text) {
          try {
            payload = JSON.parse(text);
          } catch (err) {
            payload = null;
          }
        }
        if (!response.ok || (payload && payload.error)) {
          const message = (payload && payload.error) || 'No se pudo subir el avatar.';
          setProfileMessage(message, true);
          this.profileSavePending = false;
          updateSaveState();
          return;
        }
        const imageUrl = payload && payload.image_url ? String(payload.image_url) : '';
        const avatarFileName =
          payload && payload.avatar_file_name ? String(payload.avatar_file_name) : '';
        const ext = getAvatarExt(file);
        const baseAvatar =
          imageUrl ||
          `https://s3.amazonaws.com/sk.assets/avatars/${user.id}/avatarv4.${ext}`;
        const cacheBust = baseAvatar.includes('?') ? '&ts=' : '?ts=';
        const nextAvatar = `${baseAvatar}${cacheBust}${Date.now()}`;
        const resolvedAvatarFileName = avatarFileName || nextAvatar.split('/').pop().split('?')[0];
        const nextUser = {
          ...user,
          image: nextAvatar,
          avatar_file_name: resolvedAvatarFileName,
          image_local: '',
          image_path: ''
        };
        await clearLocalAvatar(user);
        if (typeof refreshUserAvatarLocal === 'function') {
          refreshUserAvatarLocal(nextUser, { force: true });
        }
        resetProfileState(nextUser);
        setProfileMessage('Avatar actualizado.', false);
        updateLocalUser(nextUser);
      } catch (err) {
        console.error('[profile] error subiendo avatar', err);
        setProfileMessage('No se pudo subir el avatar.', true);
      } finally {
        this.profileSavePending = false;
        updateSaveState();
      }
    };

    const deleteAvatar = async () => {
      if (!user) return;
      this.profileSavePending = true;
      updateSaveState();
      const apiURL =
        (window.varGlobal && window.varGlobal.apiURL) ||
        (window.env === 'PRO' ? window.apiPRO : window.apiDEV) ||
        '';
      const timestamp = Math.round(Date.now() / 1000);
      const query = new URLSearchParams({
        timestamp: String(timestamp),
        user_id: String(user.id),
        token: String(user.token || '')
      }).toString();
      const payload = {
        user_id: user.id,
        token: user.token || '',
        timestamp
      };
      try {
        const response = await fetch(`${apiURL}/v3/deleteUserImage?${query}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            'X-Platform': deviceId()
          },
          body: JSON.stringify(payload)
        });
        const text = await response.text();
        let resPayload = null;
        if (text) {
          try {
            resPayload = JSON.parse(text);
          } catch (err) {
            resPayload = null;
          }
        }
        if (!response.ok || (resPayload && resPayload.error)) {
          const message = (resPayload && resPayload.error) || 'No se pudo eliminar el avatar.';
          setProfileMessage(message, true);
          this.profileSavePending = false;
          updateSaveState();
          return;
        }
        const placeholder = 'https://s3.amazonaws.com/sk.CursoIngles/no-avatar.gif';
        const nextUser = {
          ...user,
          avatar_file_name: '',
          image: placeholder,
          image_local: '',
          image_path: ''
        };
        await clearLocalAvatar(nextUser);
        resetProfileState(nextUser);
        setProfileMessage('Avatar eliminado.', false);
        updateLocalUser(nextUser);
      } catch (err) {
        console.error('[profile] error eliminando avatar', err);
        setProfileMessage('No se pudo eliminar el avatar.', true);
      } finally {
        this.profileSavePending = false;
        updateSaveState();
      }
    };

    avatarUploadBtn?.addEventListener('click', () => {
      if (avatarInput) avatarInput.click();
    });

    avatarInput?.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
      if (!file) return;
      const validation = validateAvatarFile(file);
      if (!validation.ok) {
        setProfileMessage(validation.message, true);
        event.target.value = '';
        return;
      }
      uploadAvatar(file);
      event.target.value = '';
    });

    avatarDeleteBtn?.addEventListener('click', () => {
      deleteAvatar();
    });

    const linkButtons = Array.from(this.querySelectorAll('.profile-link-btn'));
    linkButtons.forEach((button) => {
      const action = button.dataset.action;
      const fnName = action === 'contact' ? 'sendMail' : action === 'legal' ? 'goWebLegal' : '';
      const fn = fnName ? window[fnName] : null;
      if (typeof fn !== 'function') {
        button.disabled = true;
        return;
      }
      button.addEventListener('click', () => {
        try {
          fn();
        } catch (err) {
          console.error('[profile] error ejecutando accion', err);
        }
      });
    });

    const tabButtons = Array.from(this.querySelectorAll('.profile-tab-btn'));
    tabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const tab = button.dataset.tab;
        if (!tab || tab === this.activeTab) return;
        this.activeTab = tab;
        persistProfileTab(tab);
        this.render();
      });
    });

    updateSaveState();

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

    const applyAppMeta = (meta) => {
      if (!appMetaEl) return;
      appMetaEl.textContent = formatAppMeta(meta);
    };
    applyAppMeta(window.appMeta);
    const appPlugin = window.Capacitor?.Plugins?.App;
    if (appPlugin && typeof appPlugin.getInfo === 'function') {
      appPlugin
        .getInfo()
        .then((info) => {
          if (!info || typeof info !== 'object') return;
          window.appMeta = { ...(window.appMeta || {}), ...info };
          applyAppMeta(window.appMeta);
        })
        .catch(() => {});
    }
    if (this._metaHandler) {
      window.removeEventListener('app:meta-change', this._metaHandler);
    }
    this._metaHandler = (event) => {
      const meta = event && event.detail ? event.detail : window.appMeta;
      applyAppMeta(meta);
    };
    window.addEventListener('app:meta-change', this._metaHandler);
  }
}

customElements.define('page-profile', PageProfile);
