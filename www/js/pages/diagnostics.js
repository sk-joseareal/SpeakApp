import { ensureInitialHash } from '../nav.js';

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
          <ion-title>Diagnósticos</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content fullscreen>
        <div class="page-shell">
          <div class="card placeholder-card">
            <div id="diag-user" style="display:none; margin-bottom:12px;">
              <div class="pill">Usuario</div>
              <p>ID: <strong id="diag-user-id"></strong></p>
              <p>Nombre: <strong id="diag-user-name"></strong></p>
              <p>Avatar: <strong id="diag-user-avatar"></strong></p>
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

            <h4 style="margin-top:16px;">Login</h4>
            <div class="diag-actions">
              <ion-button size="small" fill="outline" id="diag-login">Abrir login</ion-button>
              <ion-button size="small" fill="outline" id="diag-logout" style="display:none;">Logout</ion-button>
            </div>

            <br>
            <ion-button expand="block" shape="round" id="diag-back">Volver</ion-button>
            <br>
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
        if (avatarEl) avatarEl.textContent = user.avatar || 'n/a';
        if (idEl) idEl.textContent = user.id || 'n/a';
        if (nameEl) nameEl.textContent = user.name || 'n/a';
        if (avatarEl) avatarEl.textContent = user.image_local || 'n/a';
        if (avatarImgEl) avatarImgEl.src = user.image_local || '';
        panel.style.display = 'block';
        if (loginBtn) loginBtn.disabled = true;
        if (logoutBtn) logoutBtn.style.display = '';
      } else {
        panel.style.display = 'none';
        if (loginBtn) loginBtn.disabled = false;
        if (logoutBtn) logoutBtn.style.display = 'none';
      }
    };

    updateUserPanel(window.user);
    this._userHandler = (event) => updateUserPanel(event.detail);
    window.addEventListener('app:user-change', this._userHandler);


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

  }

  disconnectedCallback() {
    if (this._userHandler) {
      window.removeEventListener('app:user-change', this._userHandler);
      this._userHandler = null;
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
