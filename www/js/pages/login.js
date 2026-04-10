import { getAppLocale } from '../state.js';
import { getLoginCopy, normalizeLocale as normalizeCopyLocale } from '../content/copy.js';

class PageLogin extends HTMLElement {
  connectedCallback() {
    this.classList.add('ion-page');
    const resolveUiLocale = () => {
      const fromState = normalizeCopyLocale(getAppLocale());
      if (fromState) return fromState;
      return normalizeCopyLocale(window.varGlobal?.locale) || 'en';
    };
    const uiLocale = resolveUiLocale();
    const copy = getLoginCopy(uiLocale);
    const embedded = this.hasAttribute('embedded');
    const flat = embedded && this.hasAttribute('flat');
    const renderActionButton = (id, label, tone = 'secondary') =>
      flat
        ? `<button class="login-${tone}-btn" type="button" id="${id}">${label}</button>`
        : `<ion-button expand="block" shape="round" id="${id}">${label}</ion-button>`;
    const renderSocialButton = (id, iconClass, iconSrc, label) =>
      flat
        ? `
            <button class="login-social-btn login-social-btn--flat" type="button" id="${id}">
              <img class="login-social-icon ${iconClass}" src="${iconSrc}" alt="" aria-hidden="true">
              <span>${label}</span>
            </button>
          `
        : `
            <ion-button expand="block" shape="round" id="${id}" class="login-social-btn">
              <img class="login-social-icon ${iconClass}" src="${iconSrc}" alt="" slot="start" aria-hidden="true">
              <span>${label}</span>
            </ion-button>
          `;
    this.innerHTML = `
      ${embedded ? '' : `
      <ion-header translucent="true">
        <ion-toolbar>
          <ion-title>${copy.title}</ion-title>
          <ion-buttons slot="end">
            <ion-button fill="clear" size="small" id="login-close">${copy.close}</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <div class="page-shell">
      `}
          <div class="${flat ? 'login-embedded-flat' : `card card--plain ${embedded ? 'login-embedded-card' : ''}`}">
            <div class="login-panel" data-panel="login">
              <button class="login-link-btn login-create-email-btn login-magic-cta" type="button" id="login-magic-link">${copy.magicLoginLink}</button>
              <div class="login-social-stack">
                ${renderSocialButton('login-google', '', 'assets/social/google.png', copy.socialGoogle)}
                ${renderSocialButton('login-fb', '', 'assets/social/facebook.png', copy.socialFacebook)}
                ${renderSocialButton('login-apple', 'login-social-icon-apple', 'assets/social/apple.png', copy.socialApple)}
              </div>
              <button class="login-link-btn login-create-email-btn" type="button" id="login-register-link">${copy.createWithEmail}</button>
              <div class="login-email-block">
                ${
                  flat
                    ? `
                      <div class="login-inputs login-inputs--flat">
                        <label class="login-input-shell" for="login-user">
                          <span class="login-input-icon" aria-hidden="true">
                            <ion-icon name="person-outline"></ion-icon>
                          </span>
                          <input
                            class="chat-text-input login-text-input login-text-input--shell"
                            autocomplete="username"
                            name="username"
                            id="login-user"
                            type="email"
                            inputmode="email"
                            placeholder="${copy.userLabel}"
                            aria-label="${copy.userLabel}"
                          >
                        </label>
                        <label class="login-input-shell" for="login-pass">
                          <span class="login-input-icon" aria-hidden="true">
                            <ion-icon name="lock-closed-outline"></ion-icon>
                          </span>
                          <input
                            class="chat-text-input login-text-input login-text-input--shell"
                            autocomplete="current-password"
                            name="password"
                            id="login-pass"
                            type="password"
                            placeholder="${copy.passLabel}"
                            aria-label="${copy.passLabel}"
                          >
                          <button class="login-input-toggle" type="button" id="login-pass-toggle" aria-label="${copy.passLabel}">
                            <ion-icon name="eye-outline"></ion-icon>
                          </button>
                        </label>
                      </div>
                    `
                    : `
                      <div class="login-inputs">
                        <label class="login-field" for="login-user">
                          <span class="login-label">${copy.userLabel}</span>
                          <input class="chat-text-input login-text-input" autocomplete="username" name="username" id="login-user" type="email" inputmode="email" placeholder="${copy.userPlaceholder}">
                        </label>
                        <label class="login-field" for="login-pass">
                          <span class="login-label">${copy.passLabel}</span>
                          <input class="chat-text-input login-text-input" autocomplete="current-password" name="password" id="login-pass" type="password" placeholder="${copy.passPlaceholder}">
                        </label>
                      </div>
                    `
                }
                <p id="login-error" style="display:none; margin:4px 0 0; color: var(--ion-color-danger, #eb445a); font-size:0.9rem;"></p>
                ${renderActionButton('login-enter', copy.enter)}
                <button class="login-link-btn login-create-email-btn" type="button" id="login-forgot-secondary">${copy.forgotPassword}</button>
              </div>
            </div>
            <div class="login-panel" data-panel="register" hidden>
              ${
                flat
                  ? `
                    <div class="login-panel-header">
                      <h3>${copy.registerTitle}</h3>
                      <button class="login-back-top" type="button" id="register-back">${copy.recoverBack}</button>
                    </div>
                    <div class="login-inputs login-inputs--flat">
                      <label class="login-input-shell" for="register-username">
                        <span class="login-input-icon" aria-hidden="true">
                          <ion-icon name="person-outline"></ion-icon>
                        </span>
                        <input
                          class="chat-text-input login-text-input login-text-input--shell"
                          autocomplete="username"
                          name="register-username"
                          id="register-username"
                          type="text"
                          placeholder="${copy.registerUserLabel}"
                          aria-label="${copy.registerUserLabel}"
                        >
                      </label>
                      <label class="login-input-shell" for="register-email">
                        <span class="login-input-icon" aria-hidden="true">
                          <ion-icon name="mail-outline"></ion-icon>
                        </span>
                        <input
                          class="chat-text-input login-text-input login-text-input--shell"
                          autocomplete="email"
                          name="register-email"
                          id="register-email"
                          type="email"
                          inputmode="email"
                          placeholder="${copy.registerEmailLabel}"
                          aria-label="${copy.registerEmailLabel}"
                        >
                      </label>
                      <label class="login-input-shell" for="register-pass">
                        <span class="login-input-icon" aria-hidden="true">
                          <ion-icon name="lock-closed-outline"></ion-icon>
                        </span>
                        <input
                          class="chat-text-input login-text-input login-text-input--shell"
                          autocomplete="new-password"
                          name="register-pass"
                          id="register-pass"
                          type="password"
                          placeholder="${copy.registerPassLabel}"
                          aria-label="${copy.registerPassLabel}"
                        >
                        <button class="login-input-toggle" type="button" id="register-pass-toggle" aria-label="${copy.registerPassLabel}">
                          <ion-icon name="eye-outline"></ion-icon>
                        </button>
                      </label>
                      <label class="login-input-shell" for="register-pass-confirm">
                        <span class="login-input-icon" aria-hidden="true">
                          <ion-icon name="lock-closed-outline"></ion-icon>
                        </span>
                        <input
                          class="chat-text-input login-text-input login-text-input--shell"
                          autocomplete="new-password"
                          name="register-pass-confirm"
                          id="register-pass-confirm"
                          type="password"
                          placeholder="${copy.registerPassConfirmLabel}"
                          aria-label="${copy.registerPassConfirmLabel}"
                        >
                        <button class="login-input-toggle" type="button" id="register-pass-confirm-toggle" aria-label="${copy.registerPassConfirmLabel}">
                          <ion-icon name="eye-outline"></ion-icon>
                        </button>
                      </label>
                    </div>
                  `
                  : `
                    <h3>${copy.registerTitle}</h3>
                    <p class="muted">${copy.registerSubtitle}</p>
                    <div class="login-inputs">
                      <label class="login-field" for="register-username">
                        <span class="login-label">${copy.registerUserLabel}</span>
                        <input class="chat-text-input login-text-input" autocomplete="username" name="register-username" id="register-username" type="text" placeholder="${copy.registerUserPlaceholder}">
                      </label>
                      <label class="login-field" for="register-email">
                        <span class="login-label">${copy.registerEmailLabel}</span>
                        <input class="chat-text-input login-text-input" autocomplete="email" name="register-email" id="register-email" type="email" inputmode="email" placeholder="${copy.registerEmailPlaceholder}">
                      </label>
                      <label class="login-field" for="register-pass">
                        <span class="login-label">${copy.registerPassLabel}</span>
                        <input class="chat-text-input login-text-input" autocomplete="new-password" name="register-pass" id="register-pass" type="password" placeholder="${copy.registerPassPlaceholder}">
                      </label>
                      <label class="login-field" for="register-pass-confirm">
                        <span class="login-label">${copy.registerPassConfirmLabel}</span>
                        <input class="chat-text-input login-text-input" autocomplete="new-password" name="register-pass-confirm" id="register-pass-confirm" type="password" placeholder="${copy.registerPassConfirmPlaceholder}">
                      </label>
                    </div>
                  `
              }
              ${
                flat
                  ? `
                    <label class="login-terms-inline" for="register-terms">
                      <ion-checkbox id="register-terms"></ion-checkbox>
                      <span>${copy.registerTerms}</span>
                    </label>
                  `
                  : `
                    <ion-item lines="none" class="login-terms-item">
                      <ion-checkbox id="register-terms" label-placement="end">${copy.registerTerms}</ion-checkbox>
                    </ion-item>
                  `
              }
              <p id="register-error" style="display:none; margin:4px 0 0; color: var(--ion-color-danger, #eb445a); font-size:0.9rem;"></p>
              ${renderActionButton('register-submit', copy.registerSubmit, 'primary')}
              ${flat ? '' : `<div class="login-links"><button class="login-link-btn" type="button" id="register-back">${copy.registerBack}</button></div>`}
            </div>
            <div class="login-panel" data-panel="magic" hidden>
              <div id="magic-form">
                <div class="login-panel-header">
                  <h3>${copy.magicTitle}</h3>
                  <button class="login-back-top" type="button" id="magic-back">${copy.magicBack}</button>
                </div>
                <p class="muted">${copy.magicSubtitle}</p>
                ${
                  flat
                    ? `
                      <div class="login-inputs login-inputs--flat">
                        <label class="login-input-shell" for="magic-email">
                          <span class="login-input-icon" aria-hidden="true">
                            <ion-icon name="mail-outline"></ion-icon>
                          </span>
                          <input
                            class="chat-text-input login-text-input login-text-input--shell"
                            autocomplete="email"
                            name="magic-email"
                            id="magic-email"
                            type="email"
                            inputmode="email"
                            placeholder="${copy.magicEmailLabel}"
                            aria-label="${copy.magicEmailLabel}"
                          >
                        </label>
                      </div>
                    `
                    : `
                      <div class="login-inputs">
                        <label class="login-field" for="magic-email">
                          <span class="login-label">${copy.magicEmailLabel}</span>
                          <input class="chat-text-input login-text-input" autocomplete="email" name="magic-email" id="magic-email" type="email" inputmode="email" placeholder="${copy.magicEmailPlaceholder}">
                        </label>
                      </div>
                    `
                }
                <p id="magic-error" style="display:none; margin:4px 0 0; color: var(--ion-color-danger, #eb445a); font-size:0.9rem;"></p>
                ${renderActionButton('magic-submit', copy.magicSubmit, flat ? 'primary' : 'secondary')}
              </div>
              <div id="magic-sent" hidden>
                <h3>${copy.magicSentTitle}</h3>
                <p class="muted">${copy.magicSentMessage}<br><strong id="magic-sent-email"></strong></p>
                <div style="margin-top:14px">
                  <span class="login-label">${copy.magicOtpLabel}</span>
                  <div id="otp-digits" style="display:flex;gap:8px;justify-content:center;margin-top:10px">
                    <input class="otp-digit" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" maxlength="6" data-idx="0" style="width:44px;height:52px;text-align:center;font-size:22px;font-family:monospace;font-weight:700;border:2px solid var(--ion-color-medium,#92949c);border-radius:8px;background:transparent;color:inherit;outline:none">
                    <input class="otp-digit" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" data-idx="1" style="width:44px;height:52px;text-align:center;font-size:22px;font-family:monospace;font-weight:700;border:2px solid var(--ion-color-medium,#92949c);border-radius:8px;background:transparent;color:inherit;outline:none">
                    <input class="otp-digit" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" data-idx="2" style="width:44px;height:52px;text-align:center;font-size:22px;font-family:monospace;font-weight:700;border:2px solid var(--ion-color-medium,#92949c);border-radius:8px;background:transparent;color:inherit;outline:none">
                    <input class="otp-digit" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" data-idx="3" style="width:44px;height:52px;text-align:center;font-size:22px;font-family:monospace;font-weight:700;border:2px solid var(--ion-color-medium,#92949c);border-radius:8px;background:transparent;color:inherit;outline:none">
                    <input class="otp-digit" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" data-idx="4" style="width:44px;height:52px;text-align:center;font-size:22px;font-family:monospace;font-weight:700;border:2px solid var(--ion-color-medium,#92949c);border-radius:8px;background:transparent;color:inherit;outline:none">
                    <input class="otp-digit" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" data-idx="5" style="width:44px;height:52px;text-align:center;font-size:22px;font-family:monospace;font-weight:700;border:2px solid var(--ion-color-medium,#92949c);border-radius:8px;background:transparent;color:inherit;outline:none">
                  </div>
                </div>
                <p id="magic-otp-error" style="display:none; margin:8px 0 0; color: var(--ion-color-danger, #eb445a); font-size:0.9rem; text-align:center;"></p>
                <div class="login-links" style="margin-top:8px">
                  <button class="login-link-btn" type="button" id="magic-resend">${copy.magicResend}</button>
                  <button class="login-link-btn" type="button" id="magic-back-from-sent">${copy.magicBack}</button>
                </div>
              </div>
            </div>
            <div class="login-panel" data-panel="recover" hidden>
              <div class="login-panel-header">
                <h3>${copy.recoverTitle}</h3>
                <button class="login-back-top" type="button" id="recover-back">${copy.recoverBack}</button>
              </div>
              <p class="muted">${copy.recoverSubtitle}</p>
              ${
                flat
                  ? `
                    <div class="login-inputs login-inputs--flat">
                      <label class="login-input-shell" for="recover-email">
                        <span class="login-input-icon" aria-hidden="true">
                          <ion-icon name="mail-outline"></ion-icon>
                        </span>
                        <input
                          class="chat-text-input login-text-input login-text-input--shell"
                          autocomplete="email"
                          name="recover-email"
                          id="recover-email"
                          type="email"
                          inputmode="email"
                          placeholder="${copy.recoverEmailLabel}"
                          aria-label="${copy.recoverEmailLabel}"
                        >
                      </label>
                    </div>
                  `
                  : `
                    <div class="login-inputs">
                      <label class="login-field" for="recover-email">
                        <span class="login-label">${copy.recoverEmailLabel}</span>
                        <input class="chat-text-input login-text-input" autocomplete="email" name="recover-email" id="recover-email" type="email" inputmode="email" placeholder="${copy.recoverEmailPlaceholder}">
                      </label>
                    </div>
                  `
              }
              <p id="recover-error" style="display:none; margin:4px 0 0; color: var(--ion-color-danger, #eb445a); font-size:0.9rem;"></p>
              ${renderActionButton('recover-submit', copy.recoverSubmit, flat ? 'primary' : 'secondary')}
            </div>
          </div>
        ${embedded ? '' : '</div></ion-content>'}
    `;

    const loginErrorEl = () => this.querySelector('#login-error');
    const registerErrorEl = () => this.querySelector('#register-error');
    const recoverErrorEl = () => this.querySelector('#recover-error');
    const magicErrorEl    = () => this.querySelector('#magic-error');
    const magicOtpErrorEl = () => this.querySelector('#magic-otp-error');
    const setError = (el, message) => {
      if (!el) return;
      if (message) {
        el.textContent = message;
        el.style.display = 'block';
      } else {
        el.textContent = '';
        el.style.display = 'none';
      }
    };
    const setLoginError = (message) => setError(loginErrorEl(), message);
    const setRegisterError = (message) => setError(registerErrorEl(), message);
    const setRecoverError = (message) => setError(recoverErrorEl(), message);
    const setMagicError    = (message) => setError(magicErrorEl(), message);
    const setMagicOtpError = (message) => setError(magicOtpErrorEl(), message);

    const isLoginLocked = () => {
      const modal = this.closest('ion-modal');
      if (!modal || modal.dataset.locked !== 'true') return false;
      const user = window.user;
      return !(user && user.id !== undefined && user.id !== null);
    };

    const syncLockedLoginUi = () => {
      const closeBtn = this.querySelector('#login-close');
      if (!closeBtn) return;
      const locked = isLoginLocked();
      closeBtn.hidden = locked;
      closeBtn.disabled = locked;
    };

    const closeLogin = () => {
      if (isLoginLocked()) {
        return;
      }
      const modal = this.closest('ion-modal');
      if (modal) {
        modal.dismiss();
        return;
      }
      // embedded in profile — user-change event handles the UI update
    };

    const panels = {
      login: this.querySelector('[data-panel="login"]'),
      register: this.querySelector('[data-panel="register"]'),
      recover: this.querySelector('[data-panel="recover"]'),
      magic: this.querySelector('[data-panel="magic"]')
    };

    const getOtpInputs  = () => Array.from(this.querySelectorAll('.otp-digit'));
    const getOtpValue   = () => getOtpInputs().map(i => i.value).join('');
    const clearOtpInputs = () => {
      getOtpInputs().forEach(i => { i.value = ''; i.style.borderColor = ''; });
    };
    const focusOtpInput = (idx) => {
      const inputs = getOtpInputs();
      if (inputs[idx]) { inputs[idx].focus(); inputs[idx].select(); }
    };

    const clearErrors = () => {
      setLoginError('');
      setRegisterError('');
      setRecoverError('');
      setMagicError('');
      setMagicOtpError('');
    };

    const resetMagicPanel = () => {
      const form = this.querySelector('#magic-form');
      const sent = this.querySelector('#magic-sent');
      if (form) form.hidden = false;
      if (sent) sent.hidden = true;
      clearOtpInputs();
      setMagicOtpError('');
      magicLastUid = '';
    };

    const setPanel = (name) => {
      Object.entries(panels).forEach(([key, panel]) => {
        if (!panel) return;
        panel.hidden = key !== name;
      });
      clearErrors();
      if (name !== 'magic') resetMagicPanel();
    };

    const presentInfo = async (message) => {
      const alert = document.createElement('ion-alert');
      alert.header = copy.alertHeader;
      alert.message = message;
      alert.buttons = [copy.alertOk];
      document.body.appendChild(alert);
      await alert.present();
      await alert.onDidDismiss();
      alert.remove();
    };

    const handleSocialError = (event) => {
      const detail = event && event.detail ? event.detail : {};
      const message = detail.message || detail.error || copy.errors.loginGeneric;
      setLoginError(message);
    };

    const handleSocialSuccess = () => {
      setLoginError('');
      closeLogin();
    };

    this._loginSocialErrorHandler = handleSocialError;
    this._loginSocialSuccessHandler = handleSocialSuccess;
    window.addEventListener('app:login-error', handleSocialError);
    window.addEventListener('app:login-success', handleSocialSuccess);
    this._modalLockChangeHandler = () => syncLockedLoginUi();
    this._userChangeHandler = () => syncLockedLoginUi();
    window.addEventListener('app:login-modal-lock-change', this._modalLockChangeHandler);
    window.addEventListener('app:user-change', this._userChangeHandler);

    const loginCI = async () => {
      console.log("> loginCI.");
      setLoginError('');

      const emailEl = this.querySelector('#login-user');
      const email = emailEl && emailEl.value ? String(emailEl.value) : '';

      const passEl = this.querySelector('#login-pass');
      const pass = passEl && passEl.value ? String(passEl.value) : '';

      if (!email || email.length < 3) {
        setLoginError(copy.errors.loginInvalidUser);
        return;
      }
      if (!pass || pass.length < 3) {
        setLoginError(copy.errors.loginInvalidPassword);
        return;
      } 

      const endpoint = "/v3/usr/login";
      const usrData = {
        email: email,
        pass: pass,
        locale: resolveUiLocale(),
        uuid: window.uuid || localStorage.getItem('uuid') || 'n/a'
      };

      const result = await doPost(endpoint, null, usrData);
      console.log("-> loginCI result:", JSON.stringify(result));

      // Tenemos result.ok, si es false result.data.error contiene el error
      if (result.ok) {
        console.log("-> loginCI OK. Login correcto:", JSON.stringify(result.data));
        const user = result.data && result.data.user ? { ...result.data.user } : null;
        if (!user) {
          setLoginError(copy.errors.loginNoUserData);
          return;
        }

        if (typeof window.applyAvatarCacheBust === 'function') {
          window.applyAvatarCacheBust(user);
        }

        const remotes =
          typeof window.getUserAvatarRemoteCandidates === 'function'
            ? window.getUserAvatarRemoteCandidates(user)
            : (user.image ? [String(user.image)] : []);

        if (remotes.length) {
          if (window.Capacitor?.Plugins?.Filesystem) {
            const localPath = `avatars/${user.id}.jpg`;
            user.image_path = localPath;
            try {
              await window.Capacitor.Plugins.Filesystem.mkdir({ path: 'avatars', directory: 'DATA', recursive: true });
            } catch (err) {
              // Si ya existe, puedes ignorar; si falla por otra cosa, igual cae al fallback abajo
              console.warn('> No se ha podido crear la carpeta avatars:', err);
            }
            let downloaded = false;
            for (const remote of remotes) {
              try {
                const uri = await download(remote, localPath, 'DATA', { noCache: true });
                const local =
                  window.Capacitor && typeof window.Capacitor.convertFileSrc === 'function'
                    ? window.Capacitor.convertFileSrc(uri)
                    : uri;
                user.image_local =
                  typeof window.addLocalCacheBust === 'function' ? window.addLocalCacheBust(local) : local;
                downloaded = true;
                break;
              } catch (err) {
                console.warn('> Error descargando avatar:', err);
              }
            }
            if (!downloaded) {
              user.image_local = remotes[0];
            }
          } else {
            user.image_local = remotes[0];
          }
        }

        console.log('> user.image_local final:', user.image_local || 'n/a');
        if (typeof window.setUser === 'function') {
          window.setUser(user);
        } else {
          window.user = user;
          try {
            localStorage.setItem('appv5:user', JSON.stringify(user));
          } catch (err) {
            console.error('[user] error guardando localStorage', err);
          }
          window.dispatchEvent(new CustomEvent('app:user-change', { detail: user }));
        }
        setLoginError('');
        // Si el login es correcto, cerramos el modal
        closeLogin();
      } else {
        console.log("-> loginCI ERROR. Login fallido:", result.error);
        const message =
          (result && result.data && result.data.error) ||
          (result && result.error) ||
          copy.errors.loginGeneric;
        setLoginError(message);
      }
      
      
      
    }

    const maybeSubmitLogin = (event) => {
      if (event.key !== 'Enter') return;
      const loginPanel = panels.login;
      if (loginPanel && loginPanel.hidden) return;
      event.preventDefault();
      loginCI();
    };

    const loginUserInput = this.querySelector('#login-user');
    const loginPassInput = this.querySelector('#login-pass');
    loginUserInput?.addEventListener('keydown', maybeSubmitLogin);
    loginPassInput?.addEventListener('keydown', maybeSubmitLogin);

    const loginApple = async () => {
      console.log("> loginApple.");
      setLoginError('');
      if (typeof window.loginSocial !== 'function') {
        setLoginError(copy.errors.socialAppleUnavailable);
        return;
      }
      if (!window.Capacitor?.Plugins?.Browser) {
        setLoginError(copy.errors.socialAppleOnlyApp);
        return;
      }
      try {
        await window.loginSocial('apple');
      } catch (err) {
        console.log('> loginApple error:', err);
        setLoginError(copy.errors.socialAppleOpenFailed);
      }
    }

    const loginGoogle = async () => {
      console.log("> loginGoogle.");
      setLoginError('');
      if (typeof window.loginSocial !== 'function') {
        setLoginError(copy.errors.socialGoogleUnavailable);
        return;
      }
      if (!window.Capacitor?.Plugins?.Browser) {
        setLoginError(copy.errors.socialGoogleOnlyApp);
        return;
      }
      try {
        await window.loginSocial('google');
      } catch (err) {
        console.log('> loginGoogle error:', err);
        setLoginError(copy.errors.socialGoogleOpenFailed);
      }
    }

    const loginFb = async () => {
      console.log("> loginFb.");
      setLoginError('');
      if (typeof window.loginSocial !== 'function') {
        setLoginError(copy.errors.socialFacebookUnavailable);
        return;
      }
      if (!window.Capacitor?.Plugins?.Browser) {
        setLoginError(copy.errors.socialFacebookOnlyApp);
        return;
      }
      try {
        await window.loginSocial('facebook');
      } catch (err) {
        console.log('> loginFb error:', err);
        setLoginError(copy.errors.socialFacebookOpenFailed);
      }
    }

    let registerPending = false;
    let recoverPending = false;
    let magicLinkPending = false;
    let magicLastUid     = '';
    let otpPending       = false;

    const registerAccount = async () => {
      if (registerPending) return;
      registerPending = true;
      const registerBtn = this.querySelector('#register-submit');
      if (registerBtn) registerBtn.disabled = true;
      setRegisterError('');
      const usernameEl = this.querySelector('#register-username');
      const emailEl = this.querySelector('#register-email');
      const passEl = this.querySelector('#register-pass');
      const confirmEl = this.querySelector('#register-pass-confirm');
      const termsEl = this.querySelector('#register-terms');
      const username = usernameEl && usernameEl.value ? String(usernameEl.value).trim() : '';
      const email = emailEl && emailEl.value ? String(emailEl.value).trim() : '';
      const pass = passEl && passEl.value ? String(passEl.value) : '';
      const confirmation = confirmEl && confirmEl.value ? String(confirmEl.value) : '';
      const acceptterms = !!(termsEl && termsEl.checked);

      if (!username || !email || !pass || !confirmation) {
        setRegisterError(copy.errors.registerMissingFields);
        registerPending = false;
        if (registerBtn) registerBtn.disabled = false;
        return;
      }
      if (pass !== confirmation) {
        setRegisterError(copy.errors.registerPasswordMismatch);
        registerPending = false;
        if (registerBtn) registerBtn.disabled = false;
        return;
      }
      if (!acceptterms) {
        setRegisterError(copy.errors.registerTermsRequired);
        registerPending = false;
        if (registerBtn) registerBtn.disabled = false;
        return;
      }

      const locale = resolveUiLocale();
      const payload = {
        username,
        email,
        password: pass,
        confirmation,
        acceptterms,
        lang: locale,
        locale
      };

      const result = await doPost('/v3/usr/create', null, payload);
      registerPending = false;
      if (registerBtn) registerBtn.disabled = false;
      if (!result.ok) {
        const message =
          (result && result.data && result.data.error) ||
          (result && result.error) ||
          copy.errors.registerFailed;
        setRegisterError(message);
        return;
      }
      await presentInfo(copy.info.registerSuccess);
      setPanel('login');
    };

    const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

    const requestMagicLink = async () => {
      if (magicLinkPending) return;
      magicLinkPending = true;
      const submitBtn = this.querySelector('#magic-submit');
      if (submitBtn) submitBtn.disabled = true;
      setMagicError('');

      const emailEl = this.querySelector('#magic-email');
      const email = emailEl && emailEl.value ? String(emailEl.value).trim().toLowerCase() : '';
      if (emailEl) emailEl.value = email; // normaliza visualmente
      if (!email) {
        setMagicError(copy.errors.magicEmailRequired);
        magicLinkPending = false;
        if (submitBtn) submitBtn.disabled = false;
        return;
      }
      if (!isValidEmail(email)) {
        setMagicError(copy.errors.magicEmailInvalid);
        magicLinkPending = false;
        if (submitBtn) submitBtn.disabled = false;
        return;
      }

      const locale = resolveUiLocale();
      const result = await doPost('/auth/magic', null, { email, locale, lang: locale });

      magicLinkPending = false;
      if (submitBtn) submitBtn.disabled = false;

      if (!result.ok || (result.data && result.data.error)) {
        const message = (result.data && result.data.error) || copy.errors.magicFailed;
        setMagicError(message);
        return;
      }

      magicLastUid = (result.data && result.data.uid) ? String(result.data.uid) : '';
      const form = this.querySelector('#magic-form');
      const sent = this.querySelector('#magic-sent');
      const sentEmail = this.querySelector('#magic-sent-email');
      if (sentEmail) sentEmail.textContent = email;
      if (form) form.hidden = true;
      if (sent) sent.hidden = false;
    };

    const submitOtp = async () => {
      if (otpPending) return;
      getOtpInputs().forEach(i => i.blur());
      const otp = getOtpValue();
      if (otp.length !== 6) {
        setMagicOtpError(copy.errors.magicOtpRequired);
        focusOtpInput(otp.length < 6 ? otp.length : 0);
        return;
      }
      otpPending = true;
      setMagicOtpError('');

      const result = await doPost('/auth/magic/otp-exchange', null, { otp, uid: magicLastUid });

      otpPending = false;

      if (!result.ok || (result.data && result.data.error)) {
        const message = (result.data && result.data.error) || copy.errors.magicOtpFailed;
        setMagicOtpError(message);
        clearOtpInputs();
        focusOtpInput(0);
        return;
      }

      const user = result.data && result.data.user ? { ...result.data.user } : null;
      if (!user) {
        setMagicOtpError(copy.errors.magicOtpFailed);
        clearOtpInputs();
        focusOtpInput(0);
        return;
      }
      if (typeof window.setUser === 'function') {
        window.setUser(user);
      } else {
        window.user = user;
        try { localStorage.setItem('appv5:user', JSON.stringify(user)); } catch (_) {}
        window.dispatchEvent(new CustomEvent('app:user-change', { detail: user }));
      }
      closeLogin();
    };

    const recoverPassword = async () => {
      if (recoverPending) return;
      recoverPending = true;
      const recoverBtn = this.querySelector('#recover-submit');
      if (recoverBtn) recoverBtn.disabled = true;
      setRecoverError('');
      const emailEl = this.querySelector('#recover-email');
      const email = emailEl && emailEl.value ? String(emailEl.value).trim() : '';
      if (!email) {
        setRecoverError(copy.errors.recoverEmailRequired);
        recoverPending = false;
        if (recoverBtn) recoverBtn.disabled = false;
        return;
      }
      const locale = resolveUiLocale();
      const payload = {
        email,
        lang: locale,
        locale
      };
      const result = await doPost('/v3/passreset', null, payload);
      recoverPending = false;
      if (recoverBtn) recoverBtn.disabled = false;
      if (!result.ok) {
        const message =
          (result && result.data && result.data.error) ||
          (result && result.error) ||
          copy.errors.recoverFailed;
        setRecoverError(message);
        return;
      }
      await presentInfo(copy.info.recoverSuccess);
      setPanel('login');
    };

    this.querySelector('#login-enter')?.addEventListener('click', loginCI);
    this.querySelector('#login-apple')?.addEventListener('click', loginApple);
    this.querySelector('#login-google')?.addEventListener('click', loginGoogle);
    this.querySelector('#login-fb')?.addEventListener('click', loginFb);
    this.querySelector('#login-close')?.addEventListener('click', closeLogin);
    this.querySelector('#login-magic-link')?.addEventListener('click', () => setPanel('magic'));
    this.querySelector('#login-register-link')?.addEventListener('click', () => setPanel('register'));
    this.querySelector('#login-forgot-link')?.addEventListener('click', () => setPanel('recover'));
    this.querySelector('#login-forgot-secondary')?.addEventListener('click', () => setPanel('recover'));
    this.querySelector('#register-back')?.addEventListener('click', () => setPanel('login'));
    this.querySelector('#recover-back')?.addEventListener('click', () => setPanel('login'));
    this.querySelector('#magic-back')?.addEventListener('click', () => setPanel('login'));
    this.querySelector('#magic-back-from-sent')?.addEventListener('click', () => setPanel('login'));
    this.querySelector('#magic-resend')?.addEventListener('click', () => {
      resetMagicPanel();
      requestMagicLink();
    });
    this.querySelector('#register-submit')?.addEventListener('click', registerAccount);
    this.querySelector('#recover-submit')?.addEventListener('click', recoverPassword);
    this.querySelector('#magic-submit')?.addEventListener('click', requestMagicLink);
    this.querySelector('#magic-email')?.addEventListener('blur', (e) => {
      e.target.value = e.target.value.trim().toLowerCase();
    });
    this.querySelector('#login-pass-toggle')?.addEventListener('click', () => {
      const passEl = this.querySelector('#login-pass');
      const iconEl = this.querySelector('#login-pass-toggle ion-icon');
      if (!passEl) return;
      const showing = passEl.getAttribute('type') === 'text';
      passEl.setAttribute('type', showing ? 'password' : 'text');
      if (iconEl) {
        iconEl.setAttribute('name', showing ? 'eye-outline' : 'eye-off-outline');
      }
    });
    this.querySelector('#register-pass-toggle')?.addEventListener('click', () => {
      const passEl = this.querySelector('#register-pass');
      const iconEl = this.querySelector('#register-pass-toggle ion-icon');
      if (!passEl) return;
      const showing = passEl.getAttribute('type') === 'text';
      passEl.setAttribute('type', showing ? 'password' : 'text');
      if (iconEl) {
        iconEl.setAttribute('name', showing ? 'eye-outline' : 'eye-off-outline');
      }
    });
    this.querySelector('#register-pass-confirm-toggle')?.addEventListener('click', () => {
      const passEl = this.querySelector('#register-pass-confirm');
      const iconEl = this.querySelector('#register-pass-confirm-toggle ion-icon');
      if (!passEl) return;
      const showing = passEl.getAttribute('type') === 'text';
      passEl.setAttribute('type', showing ? 'password' : 'text');
      if (iconEl) {
        iconEl.setAttribute('name', showing ? 'eye-outline' : 'eye-off-outline');
      }
    });

    // OTP: 6-digit box navigation
    const otpContainer = this.querySelector('#otp-digits');
    if (otpContainer) {
      otpContainer.addEventListener('input', (e) => {
        const input = e.target;
        if (!input.classList.contains('otp-digit')) return;
        const idx = parseInt(input.dataset.idx, 10);
        const inputs = getOtpInputs();
        const raw = input.value.replace(/\D/g, '');
        if (raw.length > 1) {
          // iOS autocomplete o paste llena el primer input con el código completo
          const digits = raw.split('').slice(0, 6);
          digits.forEach((d, i) => { if (inputs[i]) inputs[i].value = d; });
          // Corregir el primer input que puede tener el valor completo antes de truncar
          if (inputs[0]) inputs[0].value = digits[0] || '';
          focusOtpInput(Math.min(digits.length - 1, 5));
          if (getOtpValue().length === 6) submitOtp();
          return;
        }
        input.value = raw;
        if (raw && idx < 5) focusOtpInput(idx + 1);
        if (raw && idx === 5 && getOtpValue().length === 6) submitOtp();
      });

      otpContainer.addEventListener('keydown', (e) => {
        const input = e.target;
        if (!input.classList.contains('otp-digit')) return;
        const idx = parseInt(input.dataset.idx, 10);
        if (e.key === 'Backspace') {
          e.preventDefault();
          if (input.value) { input.value = ''; } else if (idx > 0) { focusOtpInput(idx - 1); }
        }
        if (e.key === 'ArrowLeft'  && idx > 0) focusOtpInput(idx - 1);
        if (e.key === 'ArrowRight' && idx < 5) focusOtpInput(idx + 1);
      });

      otpContainer.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
        if (!pasted) return;
        const inputs = getOtpInputs();
        pasted.split('').slice(0, 6).forEach((d, i) => { if (inputs[i]) inputs[i].value = d; });
        focusOtpInput(Math.min(pasted.length - 1, 5));
        if (pasted.length >= 6) submitOtp();
      });

      otpContainer.addEventListener('focus', (e) => {
        if (!e.target.classList.contains('otp-digit')) return;
        e.target.style.borderColor = 'var(--ion-color-primary, #4a90d9)';
        e.target.select();
      }, true);

      otpContainer.addEventListener('blur', (e) => {
        if (!e.target.classList.contains('otp-digit')) return;
        e.target.style.borderColor = '';
      }, true);
    }
    setPanel('login');
    syncLockedLoginUi();

    // Dev autologin: ?autologin=1
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('autologin') === '1') {
      const emailEl = this.querySelector('#login-user');
      const passEl = this.querySelector('#login-pass');
      if (emailEl) emailEl.value = 'johndoe@sokinternet.com';
      if (passEl) passEl.value = 'testing';
      setTimeout(() => loginCI(), 300);
    }

  }

  disconnectedCallback() {
    if (this._loginSocialErrorHandler) {
      window.removeEventListener('app:login-error', this._loginSocialErrorHandler);
    }
    if (this._loginSocialSuccessHandler) {
      window.removeEventListener('app:login-success', this._loginSocialSuccessHandler);
    }
    if (this._modalLockChangeHandler) {
      window.removeEventListener('app:login-modal-lock-change', this._modalLockChangeHandler);
    }
    if (this._userChangeHandler) {
      window.removeEventListener('app:user-change', this._userChangeHandler);
    }
  }
}

customElements.define('page-login', PageLogin);
