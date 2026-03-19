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
    this.innerHTML = `
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
          <div class="card">
            <div class="login-panel" data-panel="login">
              <div class="login-social-stack">
                <ion-button expand="block" fill="outline" id="login-google" class="login-social-btn">
                  <img class="login-social-icon" src="assets/social/google.png" alt="" slot="start" aria-hidden="true">
                  <span>${copy.socialGoogle}</span>
                </ion-button>
                <ion-button expand="block" fill="outline" id="login-fb" class="login-social-btn">
                  <img class="login-social-icon" src="assets/social/facebook.png" alt="" slot="start" aria-hidden="true">
                  <span>${copy.socialFacebook}</span>
                </ion-button>
                <ion-button expand="block" fill="outline" id="login-apple" class="login-social-btn">
                  <img class="login-social-icon login-social-icon-apple" src="assets/social/apple.png" alt="" slot="start" aria-hidden="true">
                  <span>${copy.socialApple}</span>
                </ion-button>
              </div>
              <button class="login-link-btn login-create-email-btn login-magic-cta" type="button" id="login-magic-link">${copy.magicLoginLink}</button>
              <button class="login-link-btn login-create-email-btn" type="button" id="login-register-link">${copy.createWithEmail}</button>
              <div class="login-email-block">
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
                <p id="login-error" style="display:none; margin:4px 0 0; color: var(--ion-color-danger, #eb445a); font-size:0.9rem;"></p>
                <ion-button expand="block" shape="round" id="login-enter">${copy.enter}</ion-button>
                <div class="login-links login-links-bottom">
                  <button class="login-link-btn" type="button" id="login-forgot-link">${copy.forgotPassword}</button>
                </div>
              </div>
            </div>
            <div class="login-panel" data-panel="register" hidden>
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
              <ion-item lines="none" class="login-terms-item">
                <ion-checkbox slot="start" id="register-terms"></ion-checkbox>
                <ion-label>${copy.registerTerms}</ion-label>
              </ion-item>
              <p id="register-error" style="display:none; margin:4px 0 0; color: var(--ion-color-danger, #eb445a); font-size:0.9rem;"></p>
              <ion-button expand="block" shape="round" id="register-submit">${copy.registerSubmit}</ion-button>
              <div class="login-links">
                <button class="login-link-btn" type="button" id="register-back">${copy.registerBack}</button>
              </div>
            </div>
            <div class="login-panel" data-panel="magic" hidden>
              <div id="magic-form">
                <h3>${copy.magicTitle}</h3>
                <p class="muted">${copy.magicSubtitle}</p>
                <div class="login-inputs">
                  <label class="login-field" for="magic-email">
                    <span class="login-label">${copy.magicEmailLabel}</span>
                    <input class="chat-text-input login-text-input" autocomplete="email" name="magic-email" id="magic-email" type="email" inputmode="email" placeholder="${copy.magicEmailPlaceholder}">
                  </label>
                </div>
                <p id="magic-error" style="display:none; margin:4px 0 0; color: var(--ion-color-danger, #eb445a); font-size:0.9rem;"></p>
                <ion-button expand="block" shape="round" id="magic-submit">${copy.magicSubmit}</ion-button>
                <div class="login-links">
                  <button class="login-link-btn" type="button" id="magic-back">${copy.magicBack}</button>
                </div>
              </div>
              <div id="magic-sent" hidden>
                <h3>${copy.magicSentTitle}</h3>
                <p class="muted">${copy.magicSentMessage}</p>
                <div class="login-links">
                  <button class="login-link-btn" type="button" id="magic-resend">${copy.magicResend}</button>
                  <button class="login-link-btn" type="button" id="magic-back-from-sent">${copy.magicBack}</button>
                </div>
              </div>
            </div>
            <div class="login-panel" data-panel="recover" hidden>
              <h3>${copy.recoverTitle}</h3>
              <p class="muted">${copy.recoverSubtitle}</p>
              <div class="login-inputs">
                <label class="login-field" for="recover-email">
                  <span class="login-label">${copy.recoverEmailLabel}</span>
                  <input class="chat-text-input login-text-input" autocomplete="email" name="recover-email" id="recover-email" type="email" inputmode="email" placeholder="${copy.recoverEmailPlaceholder}">
                </label>
              </div>
              <p id="recover-error" style="display:none; margin:4px 0 0; color: var(--ion-color-danger, #eb445a); font-size:0.9rem;"></p>
              <ion-button expand="block" shape="round" id="recover-submit">${copy.recoverSubmit}</ion-button>
              <div class="login-links">
                <button class="login-link-btn" type="button" id="recover-back">${copy.recoverBack}</button>
              </div>
            </div>
          </div>
        </div>
      </ion-content>
    `;

    const loginErrorEl = () => this.querySelector('#login-error');
    const registerErrorEl = () => this.querySelector('#register-error');
    const recoverErrorEl = () => this.querySelector('#recover-error');
    const magicErrorEl = () => this.querySelector('#magic-error');
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
    const setMagicError = (message) => setError(magicErrorEl(), message);

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
      window.location.hash = '#/diagnostics';
    };

    const panels = {
      login: this.querySelector('[data-panel="login"]'),
      register: this.querySelector('[data-panel="register"]'),
      recover: this.querySelector('[data-panel="recover"]'),
      magic: this.querySelector('[data-panel="magic"]')
    };

    const clearErrors = () => {
      setLoginError('');
      setRegisterError('');
      setRecoverError('');
      setMagicError('');
    };

    const resetMagicPanel = () => {
      const form = this.querySelector('#magic-form');
      const sent = this.querySelector('#magic-sent');
      if (form) form.hidden = false;
      if (sent) sent.hidden = true;
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

    const requestMagicLink = async () => {
      if (magicLinkPending) return;
      magicLinkPending = true;
      const submitBtn = this.querySelector('#magic-submit');
      if (submitBtn) submitBtn.disabled = true;
      setMagicError('');

      const emailEl = this.querySelector('#magic-email');
      const email = emailEl && emailEl.value ? String(emailEl.value).trim() : '';
      if (!email) {
        setMagicError(copy.errors.magicEmailRequired);
        magicLinkPending = false;
        if (submitBtn) submitBtn.disabled = false;
        return;
      }

      const cap = window.Capacitor;
      const capPlatform = (cap && typeof cap.getPlatform === 'function') ? cap.getPlatform() : 'web';
      const platform = (capPlatform === 'ios' || capPlatform === 'android') ? 'mobile' : 'web';
      const locale = resolveUiLocale();
      const result = await doPost('/auth/magic', null, { email, platform, locale, lang: locale });

      magicLinkPending = false;
      if (submitBtn) submitBtn.disabled = false;

      if (!result.ok || (result.data && result.data.error)) {
        const message = (result.data && result.data.error) || copy.errors.magicFailed;
        setMagicError(message);
        return;
      }

      const form = this.querySelector('#magic-form');
      const sent = this.querySelector('#magic-sent');
      if (form) form.hidden = true;
      if (sent) sent.hidden = false;
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
    setPanel('login');
    syncLockedLoginUi();

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
