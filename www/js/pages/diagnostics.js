import { ensureInitialHash } from '../nav.js';
import { clearNotifications, generateDemoNotifications, getNotifications } from '../notifications-store.js';
import { clearOnboardingDone } from '../state.js';

class PageDiagnostics extends HTMLElement {
  connectedCallback() {
    
    this.classList.add('ion-page');

    const platform = window.r34lp0w3r?.platform || 'unknown';
    const uuid = window.uuid || localStorage.getItem('uuid') || 'n/a';
    const cacheKeys = Object.keys(localStorage || {}).length;
    let plugins = [];
    try {
      plugins = collectPlugins();
    } catch (e) {
      console.error('[diag] error en collectPlugins()', e);
      plugins = [];
    }

    this.innerHTML = `
      <ion-header translucent="true">
        <ion-toolbar>
          <ion-buttons slot="start">
            <ion-button fill="clear" id="diag-back">
              <ion-icon slot="icon-only" name="chevron-back"></ion-icon>
            </ion-button>
          </ion-buttons>
          <ion-title>Diagnósticos</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content fullscreen>
        <div class="page-shell">
          <div class="card placeholder-card">
            <div class="diag-debug-toggle">
              <div class="diag-debug-text">
                <div class="diag-debug-title">Modo debug</div>
                <div class="diag-debug-sub">Muestra caja con esperado / transcrito / porcentaje y overrrides en Speak.</div>
                <div class="diag-debug-sub">Permite acceder a cualquier ruta.</div>
              </div>
              <ion-toggle id="diag-debug-toggle"></ion-toggle>
            </div>
            <div id="diag-user" style="display:none; margin-bottom:12px;">
              <div class="pill">Usuario</div>
              <p>ID: <strong id="diag-user-id"></strong></p>
              <p>Nombre: <strong id="diag-user-name"></strong></p>
              <p>Avatar: <strong id="diag-user-avatar"></strong></p>
              <p>Premium hasta: <strong id="diag-user-premium-expiry"></strong></p>
              <p>Premium real: <strong id="diag-user-premium-state"></strong></p>
              <div class="diag-debug-toggle" style="margin-top: 10px;">
                <div class="diag-debug-text">
                  <div class="diag-debug-title">Premium (override)</div>
                  <div class="diag-debug-sub">Fuerza acceso Premium para pruebas.</div>
                </div>
                <ion-toggle id="diag-premium-toggle"></ion-toggle>
              </div>
              <div class="diag-avatar-wrap">
                <img id="diag-user-avatar-img" src="" alt="Avatar" class="diag-avatar">
              </div>
              <hr>
            </div>
            <div class="pill">Build V5</div>
            <hr>
            <h3>Estado</h3>
            <p>Plataforma: <strong>${platform}</strong></p>
            <p>UUID: <strong>${uuid}</strong></p>
            <p>Entradas en localStorage: <strong>${cacheKeys}</strong></p>
            <h4 style="margin-top:12px;">Plugins activos</h4>
            <ul class="diag-list">
              ${plugins
                .map(
                  (p) =>
                    `<li data-diag-idx="${p.idx}"><span>${p.source}:${p.name}</span><span class="muted">${formatVersion(p.version)}</span></li>`
                )
                .join('')}
            </ul>

            <h4 style="margin-top:16px;">Status bar</h4>
            <div class="diag-actions">
              <ion-button size="small" fill="outline" id="sb-blue">Fondo azul</ion-button>
              <ion-button size="small" fill="outline" id="sb-transparent">Fondo transparente</ion-button>
              <ion-button size="small" fill="outline" id="sb-light">Iconos oscuros</ion-button>
              <ion-button size="small" fill="outline" id="sb-dark">Iconos claros</ion-button>
            </div>

            <h4 style="margin-top:16px;">Notificaciones Push</h4>
            <p>Token fcm: <strong>${window.__fcmToken ? window.__fcmToken : 'n/a'}</strong></p>
            <p>Token APNs: <strong>${window.__APNsToken ? window.__APNsToken : 'n/a' }</strong></p>
            <div class="diag-actions">
              <ion-button size="small" fill="outline" id="pn-bell">Probar campana</ion-button>
              <ion-button size="small" fill="outline" id="pn-10s">Recibir en 10 segundos</ion-button>
            </div>

            <h4 style="margin-top:16px;">AdMob</h4>
            <div class="diag-actions">
              <ion-button size="small" fill="outline" id="admob-form">Formulario autorización</ion-button>
              <ion-button size="small" fill="outline" id="admob-init">Inicializar</ion-button>
              <ion-button size="small" fill="outline" id="admob-banner-show">Mostrar banner</ion-button>
              <ion-button size="small" fill="outline" id="admob-banner-hide">Ocultar banner</ion-button>
              <ion-button size="small" fill="outline" id="admob-interstitial-prepare">Preparar intersticial</ion-button>
              <ion-button size="small" fill="outline" id="admob-interstitial-show">Mostrar intersticial</ion-button>
            </div>

            <h4 style="margin-top:16px;">Varios</h4>
            <div class="diag-actions">
              <ion-button size="small" fill="outline" id="var-sendmail">Contact</ion-button>
              <ion-button size="small" fill="outline" id="var-goweblegal">Legal web</ion-button>
            </div>

            <h4 style="margin-top:16px;">Onboarding</h4>
            <div class="diag-actions">
              <ion-button size="small" fill="outline" id="diag-onboarding-repeat">Repetir onboarding</ion-button>
            </div>

            <h4 style="margin-top:16px;">Speak stores</h4>
            <div class="diag-actions">
              <ion-button size="small" fill="outline" id="diag-speak-refresh">Refrescar</ion-button>
              <ion-button size="small" fill="outline" id="diag-speak-seed">Init demo</ion-button>
              <ion-button size="small" fill="outline" id="diag-speak-reset">Limpiar</ion-button>
            </div>
            <div class="diag-speak-block">
              <div class="pill">Words</div>
              <pre class="diag-json" id="diag-speak-words"></pre>
            </div>
            <div class="diag-speak-block">
              <div class="pill">Phrase</div>
              <pre class="diag-json" id="diag-speak-phrase"></pre>
            </div>
            <div class="diag-speak-block">
              <div class="pill">Rewards</div>
              <pre class="diag-json" id="diag-speak-rewards"></pre>
            </div>

            <h4 style="margin-top:16px;">Talk timelines</h4>
            <div class="diag-actions">
              <ion-button size="small" fill="outline" id="diag-talk-refresh">Refrescar</ion-button>
              <ion-button size="small" fill="outline" id="diag-talk-reset">Init</ion-button>
            </div>
            <div class="diag-speak-block">
              <div class="pill">Catbot</div>
              <pre class="diag-json" id="diag-talk-catbot"></pre>
            </div>
            <div class="diag-speak-block">
              <div class="pill">Chatbot</div>
              <pre class="diag-json" id="diag-talk-chatbot"></pre>
            </div>

            <h4 style="margin-top:16px;">Notificaciones demo</h4>
            <div class="diag-actions">
              <ion-button size="small" fill="outline" id="diag-notify-generate">Generar</ion-button>
              <ion-button size="small" fill="outline" id="diag-notify-open">Abrir</ion-button>
              <ion-button size="small" fill="outline" id="diag-notify-clear">Limpiar</ion-button>
            </div>
            <div class="notify-list diag-notify-list" id="diag-notify-list"></div>
            <div class="notify-empty" id="diag-notify-empty" hidden>No hay notificaciones demo.</div>

            <h4 style="margin-top:16px;">Login</h4>
            <div class="diag-actions">
              <ion-button size="small" fill="outline" id="diag-login">Abrir login</ion-button>
              <ion-button size="small" fill="outline" id="diag-logout" style="display:none;">Logout</ion-button>
            </div>

          </div>
        </div>
      </ion-content>
    `;

    /*
    this.innerHTML = `
      <ion-header>
        <ion-toolbar>
          <ion-title>Diagnósticos</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content fullscreen>
        <div class="page-shell">
          <p>Diagnósticos en construcción.</p>
        </div>
      </ion-content>
    `;
    */

    resolveVersionsAsync(plugins, this);

    const PREMIUM_OVERRIDE_KEY = 'appv5:premium-override';

    const debugToggle = this.querySelector('#diag-debug-toggle');
    if (debugToggle) {
      const applyDebug = (enabled) => {
        if (typeof window.setSpeakDebug === 'function') {
          window.setSpeakDebug(enabled);
          return;
        }
        window.r34lp0w3r = window.r34lp0w3r || {};
        window.r34lp0w3r.speakDebug = !!enabled;
        try {
          if (enabled) {
            localStorage.setItem('appv5:speak-debug', '1');
          } else {
            localStorage.removeItem('appv5:speak-debug');
          }
        } catch (err) {
          console.error('[diag] error guardando debug', err);
        }
        window.dispatchEvent(new CustomEvent('app:speak-debug', { detail: !!enabled }));
      };

      debugToggle.checked = !!(window.r34lp0w3r && window.r34lp0w3r.speakDebug);
      debugToggle.addEventListener('ionChange', (event) => {
        const checked = event && event.detail ? event.detail.checked : debugToggle.checked;
        applyDebug(checked);
      });
    }

    const readPremiumOverride = () => {
      if (window.r34lp0w3r && window.r34lp0w3r.premiumOverride === true) {
        return true;
      }
      try {
        const raw = localStorage.getItem(PREMIUM_OVERRIDE_KEY);
        if (raw === '1') {
          window.r34lp0w3r = window.r34lp0w3r || {};
          window.r34lp0w3r.premiumOverride = true;
          return true;
        }
        if (raw === '0') {
          localStorage.removeItem(PREMIUM_OVERRIDE_KEY);
        }
      } catch (err) {
        // no-op
      }
      return null;
    };

    const setPremiumOverride = (enabled) => {
      window.r34lp0w3r = window.r34lp0w3r || {};
      if (enabled) {
        window.r34lp0w3r.premiumOverride = true;
      } else {
        delete window.r34lp0w3r.premiumOverride;
      }
      try {
        if (enabled) {
          localStorage.setItem(PREMIUM_OVERRIDE_KEY, '1');
        } else {
          localStorage.removeItem(PREMIUM_OVERRIDE_KEY);
        }
      } catch (err) {
        // no-op
      }
      window.dispatchEvent(new CustomEvent('app:premium-override', { detail: !!enabled }));
    };

    const formatExpiry = (value) => {
      if (!value) return 'n/a';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return date.toISOString();
    };

    const isPremiumByExpiry = (user) => {
      if (!user || !user.expires_date) return false;
      const date = new Date(user.expires_date);
      if (Number.isNaN(date.getTime())) return false;
      return date.getTime() > Date.now();
    };

    const premiumToggle = this.querySelector('#diag-premium-toggle');
    if (premiumToggle) {
      const override = readPremiumOverride();
      if (override !== null) {
        premiumToggle.checked = override;
      }
      premiumToggle.addEventListener('ionChange', (event) => {
        const checked = event && event.detail ? event.detail.checked : premiumToggle.checked;
        setPremiumOverride(checked);
      });
    }

    const resolveAvatarSrc = (user) => {
      if (!user) return '';
      const local = user.image_local;
      if (local && typeof local === 'string') return local;
      return user.image || '';
    };

    const setAvatarImg = (imgEl, user) => {
      if (!imgEl) return;
      const initial = resolveAvatarSrc(user);
      const remote = user && user.image ? String(user.image) : '';
      imgEl.dataset.fallback = '';
      imgEl.onerror = null;
      imgEl.onload = null;
      if (!initial) {
        imgEl.src = '';
        return;
      }
      imgEl.onerror = () => {
        if (!remote || imgEl.dataset.fallback === '1' || imgEl.src === remote) return;
        imgEl.dataset.fallback = '1';
        imgEl.src = remote;
      };
      imgEl.src = initial;
    };

    const updateUserPanel = (user) => {
      const panel = this.querySelector('#diag-user');
      if (!panel) return;
      const loginBtn = this.querySelector('#diag-login');
      const logoutBtn = this.querySelector('#diag-logout');
      if (user) {
        const idEl = this.querySelector('#diag-user-id');
        const nameEl = this.querySelector('#diag-user-name');
        const avatarEl = this.querySelector('#diag-user-avatar');
        const avatarImgEl = this.querySelector('#diag-user-avatar-img');
        const premiumExpiryEl = this.querySelector('#diag-user-premium-expiry');
        const premiumStateEl = this.querySelector('#diag-user-premium-state');
        const override = readPremiumOverride();
        const premiumReal = isPremiumByExpiry(user);
        if (avatarEl) avatarEl.textContent = user.avatar || 'n/a';
        if (idEl) idEl.textContent = user.id || 'n/a';
        if (nameEl) nameEl.textContent = user.name || 'n/a';
        const avatarSrc = resolveAvatarSrc(user);
        if (avatarEl) avatarEl.textContent = avatarSrc || 'n/a';
        setAvatarImg(avatarImgEl, user);
        if (premiumExpiryEl) {
          premiumExpiryEl.textContent = formatExpiry(user.expires_date);
        }
        if (premiumStateEl) {
          premiumStateEl.textContent = premiumReal ? 'si' : 'no';
        }
        if (premiumToggle) {
          premiumToggle.disabled = false;
          premiumToggle.checked = override === true;
        }
        panel.style.display = 'block';
        if (loginBtn) loginBtn.disabled = true;
        if (logoutBtn) logoutBtn.style.display = '';
      } else {
        panel.style.display = 'none';
        if (premiumToggle) premiumToggle.disabled = true;
        if (loginBtn) loginBtn.disabled = false;
        if (logoutBtn) logoutBtn.style.display = 'none';
      }
    };

    updateUserPanel(window.user);
    this._userHandler = (event) => {
      updateUserPanel(event.detail);
      updateTalkPanels();
    };
    window.addEventListener('app:user-change', this._userHandler);

    const wordsEl = this.querySelector('#diag-speak-words');
    const phraseEl = this.querySelector('#diag-speak-phrase');
    const rewardsEl = this.querySelector('#diag-speak-rewards');
    const talkCatEl = this.querySelector('#diag-talk-catbot');
    const talkBotEl = this.querySelector('#diag-talk-chatbot');
    const notifyListEl = this.querySelector('#diag-notify-list');
    const notifyEmptyEl = this.querySelector('#diag-notify-empty');
    const TALK_STORAGE_PREFIX = 'appv5:talk-timelines:';

    const getTalkStorageKey = () => {
      const user = window.user;
      const userId = user && user.id !== undefined && user.id !== null ? String(user.id) : 'anon';
      return `${TALK_STORAGE_PREFIX}${userId}`;
    };

    const formatJson = (value) => {
      try {
        return JSON.stringify(value || {}, null, 2);
      } catch (err) {
        return '{}';
      }
    };

    const updateSpeakPanels = () => {
      const words = window.r34lp0w3r && window.r34lp0w3r.speakWordScores ? window.r34lp0w3r.speakWordScores : {};
      const phrase = window.r34lp0w3r && window.r34lp0w3r.speakPhraseScores ? window.r34lp0w3r.speakPhraseScores : {};
      const rewards = window.r34lp0w3r && window.r34lp0w3r.speakSessionRewards ? window.r34lp0w3r.speakSessionRewards : {};
      if (wordsEl) wordsEl.textContent = formatJson(words);
      if (phraseEl) phraseEl.textContent = formatJson(phrase);
      if (rewardsEl) rewardsEl.textContent = formatJson(rewards);
    };

    const readTalkTimelines = () => {
      try {
        const raw = localStorage.getItem(getTalkStorageKey());
        if (!raw) return { catbot: [], chatbot: [] };
        const parsed = JSON.parse(raw);
        return {
          catbot: Array.isArray(parsed.catbot) ? parsed.catbot : [],
          chatbot: Array.isArray(parsed.chatbot) ? parsed.chatbot : []
        };
      } catch (err) {
        return { catbot: [], chatbot: [] };
      }
    };

    const updateTalkPanels = () => {
      const data = readTalkTimelines();
      if (talkCatEl) talkCatEl.textContent = formatJson(data.catbot);
      if (talkBotEl) talkBotEl.textContent = formatJson(data.chatbot);
    };

    const escapeHtml = (value) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const formatElapsed = (ts) => {
      const value = Number(ts);
      if (!value) return 'Hace un momento';
      const diff = Math.max(0, Date.now() - value);
      const seconds = Math.floor(diff / 1000);
      if (seconds < 60) return 'Hace un momento';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `Hace ${minutes} min`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `Hace ${hours} h`;
      const days = Math.floor(hours / 24);
      return `Hace ${days} d`;
    };

    const renderNotifyList = () => {
      if (!notifyListEl || !notifyEmptyEl) return;
      const items = getNotifications();
      if (!items.length) {
        notifyListEl.innerHTML = '';
        notifyEmptyEl.hidden = false;
        return;
      }
      notifyEmptyEl.hidden = true;
      notifyListEl.innerHTML = items
        .map((item) => {
          const meta = `${item.status === 'unread' ? 'Nueva' : 'Leida'} · ${formatElapsed(item.created_at)}`;
          const tone = item.tone === 'good' || item.tone === 'warn' ? item.tone : '';
          const icon = escapeHtml(item.icon || 'notifications-outline');
          return `
            <div class="notify-item">
              <div class="notify-icon ${tone}">
                <ion-icon name="${icon}"></ion-icon>
              </div>
              <div class="notify-content">
                <div class="notify-text">${escapeHtml(item.title)}</div>
                ${item.text ? `<div class="notify-meta">${escapeHtml(item.text)}</div>` : ''}
                <div class="notify-meta">${escapeHtml(meta)}</div>
              </div>
            </div>
          `;
        })
        .join('');
    };

    const resetTalkTimelines = () => {
      try {
        localStorage.setItem(getTalkStorageKey(), JSON.stringify({ catbot: [], chatbot: [] }));
      } catch (err) {
        // no-op
      }
      window.dispatchEvent(new CustomEvent('app:talk-timelines-reset'));
      updateTalkPanels();
    };

    const seedSpeakStores = () => {
      window.r34lp0w3r = window.r34lp0w3r || {};
      window.r34lp0w3r.speakWordScores = {
        'session-p': {
          PEN: { percent: 72, transcript: 'pen' },
          PAPER: { percent: 82, transcript: 'paper' }
        }
      };
      window.r34lp0w3r.speakPhraseScores = {
        'session-p': { percent: 68, transcript: 'The pink pen is on the paper.' }
      };
      window.r34lp0w3r.speakSessionRewards = {
        'session-p': { rewardQty: 2, rewardLabel: 'diamonds', rewardIcon: 'diamond' }
      };
      if (typeof window.persistSpeakStores === 'function') {
        window.persistSpeakStores();
      }
      if (typeof window.notifySpeakStoresChange === 'function') {
        window.notifySpeakStoresChange();
      }
      updateSpeakPanels();
    };

    const resetSpeakStores = () => {
      if (typeof window.resetSpeakStores === 'function') {
        window.resetSpeakStores();
      } else {
        window.r34lp0w3r = window.r34lp0w3r || {};
        window.r34lp0w3r.speakWordScores = {};
        window.r34lp0w3r.speakPhraseScores = {};
        window.r34lp0w3r.speakSessionRewards = {};
        if (typeof window.persistSpeakStores === 'function') {
          window.persistSpeakStores();
        }
        window.dispatchEvent(new CustomEvent('app:speak-stores-change'));
      }
      updateSpeakPanels();
    };

    this._speakStoresHandler = updateSpeakPanels;
    window.addEventListener('app:speak-stores-change', this._speakStoresHandler);
    this._notifyHandler = renderNotifyList;
    window.addEventListener('app:notifications-change', this._notifyHandler);
    updateSpeakPanels();
    updateTalkPanels();
    renderNotifyList();

    this.querySelector('#diag-back')?.addEventListener('click', () => {
      ensureInitialHash();
      window.location.hash = '#/tabs';
    });


    const bind = (id, fnName, hasPlugin) => {
      const btn = this.querySelector(id);
      const fn = window[fnName];
      if (!btn) return;
      if (!hasPlugin || typeof fn !== 'function') {
        btn.disabled = true;
        btn.innerHTML += ' (no plugin)';
        return;
      }
      btn.addEventListener('click', () => {
        try {
          fn();
        } catch (e) {
          console.error(`[diag] error ejecutando ${fnName}`, e);
        }
      });
    };    

    // Controles de StatusBar
    const hasStatusBarPlugin =
      !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar);
    bind('#sb-blue', 'setStatusBarBlue', hasStatusBarPlugin);
    bind('#sb-transparent', 'setStatusBarTransparent', hasStatusBarPlugin);
    bind('#sb-light', 'setStatusBarLight', hasStatusBarPlugin);
    bind('#sb-dark', 'setStatusBarDark', hasStatusBarPlugin);

    // Controles de Notificaciones Push
    const hasPushPlugin =
      !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications);
    bind('#pn-bell', 'playPushForegroundBell', true);
    bind('#pn-10s', platform == 'ios' ? 'enviarPushAPNS10' : 'enviarPushFCM10', hasPushPlugin);

    // Controles de AdMob
    const hasAdMobPlugin =
      !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob);
    bind('#admob-form', 'AdMobShowContentForm', hasAdMobPlugin);
    bind('#admob-init', 'AdMobInit', hasAdMobPlugin);
    bind('#admob-banner-show', 'AdMobShowBanner', hasAdMobPlugin);
    bind('#admob-banner-hide', 'AdMobHideBanner', hasAdMobPlugin);
    bind('#admob-interstitial-prepare', 'AdMobPrepareInterstitial', hasAdMobPlugin);
    bind('#admob-interstitial-show', 'AdMobShowInterstitial', hasAdMobPlugin);

    // Varios
    bind('#var-sendmail', 'sendMail', true);
    bind('#var-goweblegal', 'goWebLegal', true);

    this.querySelector('#diag-onboarding-repeat')?.addEventListener('click', () => {
      clearOnboardingDone();
      window.location.hash = '#/onboarding';
    });

    // Login
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

    this.querySelector('#diag-login')?.addEventListener('click', () => {
      openLoginModal().catch((err) => {
        console.error('[diag] error abriendo login', err);
      });
    });
    this.querySelector('#diag-logout')?.addEventListener('click', () => {
      if (typeof window.setUser === 'function') {
        window.setUser(null);
      } else {
        window.user = null;
        try {
          localStorage.removeItem('appv5:user');
        } catch (err) {
          console.error('[user] error borrando localStorage', err);
        }
        window.dispatchEvent(new CustomEvent('app:user-change', { detail: null }));
      }
    });

    this.querySelector('#diag-speak-refresh')?.addEventListener('click', () => {
      updateSpeakPanels();
    });
    this.querySelector('#diag-speak-seed')?.addEventListener('click', () => {
      seedSpeakStores();
    });
    this.querySelector('#diag-speak-reset')?.addEventListener('click', () => {
      resetSpeakStores();
    });
    this.querySelector('#diag-talk-refresh')?.addEventListener('click', () => {
      updateTalkPanels();
    });
    this.querySelector('#diag-talk-reset')?.addEventListener('click', () => {
      resetTalkTimelines();
    });
    this.querySelector('#diag-notify-generate')?.addEventListener('click', () => {
      generateDemoNotifications();
    });
    this.querySelector('#diag-notify-clear')?.addEventListener('click', () => {
      clearNotifications();
    });
    this.querySelector('#diag-notify-open')?.addEventListener('click', () => {
      if (typeof window.openNotificationsModal === 'function') {
        window.openNotificationsModal();
      }
    });

  }

  disconnectedCallback() {
    if (this._userHandler) {
      window.removeEventListener('app:user-change', this._userHandler);
      this._userHandler = null;
    }
    if (this._speakStoresHandler) {
      window.removeEventListener('app:speak-stores-change', this._speakStoresHandler);
      this._speakStoresHandler = null;
    }
    if (this._notifyHandler) {
      window.removeEventListener('app:notifications-change', this._notifyHandler);
      this._notifyHandler = null;
    }
  }
}
 
customElements.define('page-diagnostics', PageDiagnostics);

function collectPlugins() {
  const list = [];
  const caps = safeObj(() => window.Capacitor && window.Capacitor.Plugins);
  const cordovaPlugs = safeObj(() => window.cordova && window.cordova.plugins);

  const seen = new Set();
  const pushUnique = (source, name, plugin) => {
    const key = `${source}:${name}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push({ idx: list.length, source, name, version: getVersion(plugin) });
  };

  safeKeys(caps).forEach((key) => {
    const plugin = caps[key];
    pushUnique('Capacitor', key, plugin);
  });

  safeKeys(cordovaPlugs).forEach((key) => {
    const plugin = cordovaPlugs[key];
    pushUnique('Cordova', key, plugin);
  });

  // Algunos plugins de Cordova viven en window.plugins o cordova.plugin (singular)
  const cordovaAlt = safeObj(() => window.cordova && window.cordova.plugin);
  safeKeys(cordovaAlt).forEach((key) => {
    const plugin = cordovaAlt[key];
    pushUnique('Cordova', key, plugin);
  });

  const winPlugins = safeObj(() => window.plugins);
  safeKeys(winPlugins).forEach((key) => {
    const plugin = winPlugins[key];
    pushUnique('Cordova', key, plugin);
  });

  // Detecciones manuales de globals típicos (ej. cordova-plugin-purchase)
  if (window.CdvPurchase) pushUnique('Global', 'CdvPurchase', window.CdvPurchase);
  if (window.store) pushUnique('Global', 'store', window.store);

  return list.sort((a, b) => a.name.localeCompare(b.name));
}

function safeObj(fn) {
  try {
    return fn() || {};
  } catch (e) {
    console.error('[diag] error leyendo objeto de plugins', e);
    return {};
  }
}

function safeKeys(obj) {
  try {
    return Object.keys(obj || {});
  } catch (e) {
    console.error('[diag] error iterando plugins', e);
    return [];
  }
}

function getVersion(plugin) {
  if (!plugin) return 'versión n/d';
  try {
    if (typeof plugin.getVersion === 'function') {
      return plugin.getVersion();
    }
    if (typeof plugin.getInfo === 'function') {
      return plugin.getInfo();
    }
    if (plugin.version) return plugin.version;
    if (plugin.pluginVersion) return plugin.pluginVersion;
    if (plugin.sdkVersion) return plugin.sdkVersion;
  } catch (e) {
    return 'versión n/d';
  }
  return 'versión n/d';
}

function formatVersion(version) {
  if (version && typeof version.then === 'function') return 'resolviendo...';
  if (version && typeof version === 'object') return normalizeVersionObject(version);
  return version || 'versión n/d';
}

function resolveVersionsAsync(plugins, root) {
  plugins.forEach((p) => {
    const target = root.querySelector(`li[data-diag-idx="${p.idx}"] span.muted`);
    if (!target) return;

    if (p.version && typeof p.version.then === 'function') {
      p.version
        .then((val) => {
          target.textContent = formatVersion(val);
        })
        .catch(() => {
          target.textContent = 'versión n/d';
        });
    } else {
      target.textContent = formatVersion(p.version);
    }
  });
}

function normalizeVersionObject(obj) {
  // Intentamos extraer un valor reconocible
  const preferredKeys = ['version', 'versionName', 'versionCode', 'versionString', 'appVersion', 'appBuild', 'build', 'bundleVersion'];
  for (const k of preferredKeys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k) && obj[k]) {
      return String(obj[k]);
    }
  }
  return JSON.stringify(obj);
}
