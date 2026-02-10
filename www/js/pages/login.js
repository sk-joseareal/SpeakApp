class PageLogin extends HTMLElement {
  connectedCallback() {
    this.classList.add('ion-page');
    this.innerHTML = `
      <ion-header translucent="true">
        <ion-toolbar>
          <ion-title>Login</ion-title>
          <ion-buttons slot="end">
            <ion-button fill="clear" size="small" id="login-close">Cerrar</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <div class="page-shell">
          <div class="card">
            <div class="pill">Acceso</div>
            <div class="login-panel" data-panel="login">
              <h3>Iniciar sesion</h3>
              <p class="muted">Introduce tus datos para continuar.</p>
              <div class="login-inputs">
                <label class="login-field" for="login-user">
                  <span class="login-label">Usuario</span>
                  <input class="chat-text-input login-text-input" autocomplete="username" name="username" id="login-user" type="email" inputmode="email" placeholder="tu usuario">
                </label>
                <label class="login-field" for="login-pass">
                  <span class="login-label">Contraseña</span>
                  <input class="chat-text-input login-text-input" autocomplete="current-password" name="password" id="login-pass" type="password" placeholder="********">
                </label>
              </div>
              <p id="login-error" style="display:none; margin:4px 0 0; color: var(--ion-color-danger, #eb445a); font-size:0.9rem;"></p>
              <ion-button expand="block" shape="round" id="login-enter">Entrar</ion-button>
              <div class="login-links">
                <button class="login-link-btn" type="button" id="login-register-link">Crear cuenta</button>
                <button class="login-link-btn" type="button" id="login-forgot-link">Recuperar contraseña</button>
              </div>
              <div class="diag-actions">
                <ion-button expand="block" fill="outline" id="login-google" class="login-social-btn">
                  <img class="login-social-icon" src="assets/social/google.png" alt="" slot="start" aria-hidden="true">
                  <span>Login con Google</span>
                </ion-button>
                <ion-button expand="block" fill="outline" id="login-fb" class="login-social-btn">
                  <img class="login-social-icon" src="assets/social/facebook.png" alt="" slot="start" aria-hidden="true">
                  <span>Login con Fb</span>
                </ion-button>
                <ion-button expand="block" fill="outline" id="login-apple" class="login-social-btn">
                  <img class="login-social-icon login-social-icon-apple" src="assets/social/apple.png" alt="" slot="start" aria-hidden="true">
                  <span>Login con Apple</span>
                </ion-button>
              </div>
            </div>
            <div class="login-panel" data-panel="register" hidden>
              <h3>Crear cuenta</h3>
              <p class="muted">Completa los datos para registrarte.</p>
              <div class="login-inputs">
                <label class="login-field" for="register-username">
                  <span class="login-label">Nombre de usuario</span>
                  <input class="chat-text-input login-text-input" autocomplete="username" name="register-username" id="register-username" type="text" placeholder="tu nombre">
                </label>
                <label class="login-field" for="register-email">
                  <span class="login-label">Email</span>
                  <input class="chat-text-input login-text-input" autocomplete="email" name="register-email" id="register-email" type="email" inputmode="email" placeholder="tu email">
                </label>
                <label class="login-field" for="register-pass">
                  <span class="login-label">Contraseña</span>
                  <input class="chat-text-input login-text-input" autocomplete="new-password" name="register-pass" id="register-pass" type="password" placeholder="********">
                </label>
                <label class="login-field" for="register-pass-confirm">
                  <span class="login-label">Confirmar contraseña</span>
                  <input class="chat-text-input login-text-input" autocomplete="new-password" name="register-pass-confirm" id="register-pass-confirm" type="password" placeholder="********">
                </label>
              </div>
              <ion-item lines="none" class="login-terms-item">
                <ion-checkbox slot="start" id="register-terms"></ion-checkbox>
                <ion-label>Acepto las condiciones de uso</ion-label>
              </ion-item>
              <p id="register-error" style="display:none; margin:4px 0 0; color: var(--ion-color-danger, #eb445a); font-size:0.9rem;"></p>
              <ion-button expand="block" shape="round" id="register-submit">Crear cuenta</ion-button>
              <div class="login-links">
                <button class="login-link-btn" type="button" id="register-back">Volver a iniciar sesion</button>
              </div>
            </div>
            <div class="login-panel" data-panel="recover" hidden>
              <h3>Recuperar contraseña</h3>
              <p class="muted">Te enviaremos un correo para restablecerla.</p>
              <div class="login-inputs">
                <label class="login-field" for="recover-email">
                  <span class="login-label">Email</span>
                  <input class="chat-text-input login-text-input" autocomplete="email" name="recover-email" id="recover-email" type="email" inputmode="email" placeholder="tu email">
                </label>
              </div>
              <p id="recover-error" style="display:none; margin:4px 0 0; color: var(--ion-color-danger, #eb445a); font-size:0.9rem;"></p>
              <ion-button expand="block" shape="round" id="recover-submit">Enviar instrucciones</ion-button>
              <div class="login-links">
                <button class="login-link-btn" type="button" id="recover-back">Volver a iniciar sesion</button>
              </div>
            </div>
          </div>
        </div>
      </ion-content>
    `;

    const loginErrorEl = () => this.querySelector('#login-error');
    const registerErrorEl = () => this.querySelector('#register-error');
    const recoverErrorEl = () => this.querySelector('#recover-error');
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

    const closeLogin = () => {
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
      recover: this.querySelector('[data-panel="recover"]')
    };

    const clearErrors = () => {
      setLoginError('');
      setRegisterError('');
      setRecoverError('');
    };

    const setPanel = (name) => {
      Object.entries(panels).forEach(([key, panel]) => {
        if (!panel) return;
        panel.hidden = key !== name;
      });
      clearErrors();
    };

    const presentInfo = async (message) => {
      const alert = document.createElement('ion-alert');
      alert.header = 'Atencion';
      alert.message = message;
      alert.buttons = ['Ok'];
      document.body.appendChild(alert);
      await alert.present();
      await alert.onDidDismiss();
      alert.remove();
    };

    const handleSocialError = (event) => {
      const detail = event && event.detail ? event.detail : {};
      const message = detail.message || detail.error || 'Error de login';
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

    const loginCI = async () => {
      console.log("> loginCI.");
      setLoginError('');

      const emailEl = this.querySelector('#login-user');
      const email = emailEl && emailEl.value ? String(emailEl.value) : '';

      const passEl = this.querySelector('#login-pass');
      const pass = passEl && passEl.value ? String(passEl.value) : '';

      if (!email || email.length < 3) {
        setLoginError('El usuario no es válido');
        return;
      }
      if (!pass || pass.length < 3) {
        setLoginError('La contraseña no es válida');
        return;
      } 

      const endpoint = "/v3/usr/login";
      const usrData = {
        email: email,
        pass: pass,
        locale: varGlobal.locale,
        uuid: window.uuid || localStorage.getItem('uuid') || 'n/a'
      };

      const result = await doPost(endpoint, null, usrData);
      console.log("-> loginCI result:", JSON.stringify(result));

      // Tenemos result.ok, si es false result.data.error contiene el error
      if (result.ok) {
        console.log("-> loginCI OK. Login correcto:", JSON.stringify(result.data));
        const user = result.data && result.data.user ? { ...result.data.user } : null;
        if (!user) {
          setLoginError('Login correcto, pero sin datos de usuario');
          return;
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
                const uri = await download(remote, localPath);
                user.image_local =
                  window.Capacitor && typeof window.Capacitor.convertFileSrc === 'function'
                    ? window.Capacitor.convertFileSrc(uri)
                    : uri;
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
          "Error de login";          
        setLoginError(message);
      }
      
      
      
    }

    const loginApple = async () => {
      console.log("> loginApple.");
      setLoginError('');
      if (typeof window.loginSocial !== 'function') {
        setLoginError('Login con Apple no disponible.');
        return;
      }
      if (!window.Capacitor?.Plugins?.Browser) {
        setLoginError('Login con Apple solo disponible en la app.');
        return;
      }
      try {
        await window.loginSocial('apple');
      } catch (err) {
        console.log('> loginApple error:', err);
        setLoginError('No se pudo abrir Apple.');
      }
    }

    const loginGoogle = async () => {
      console.log("> loginGoogle.");
      setLoginError('');
      if (typeof window.loginSocial !== 'function') {
        setLoginError('Login con Google no disponible.');
        return;
      }
      if (!window.Capacitor?.Plugins?.Browser) {
        setLoginError('Login con Google solo disponible en la app.');
        return;
      }
      try {
        await window.loginSocial('google');
      } catch (err) {
        console.log('> loginGoogle error:', err);
        setLoginError('No se pudo abrir Google.');
      }
    }

    const loginFb = async () => {
      console.log("> loginFb.");
      setLoginError('');
      if (typeof window.loginSocial !== 'function') {
        setLoginError('Login con Fb no disponible.');
        return;
      }
      if (!window.Capacitor?.Plugins?.Browser) {
        setLoginError('Login con Fb solo disponible en la app.');
        return;
      }
      try {
        await window.loginSocial('facebook');
      } catch (err) {
        console.log('> loginFb error:', err);
        setLoginError('No se pudo abrir Facebook.');
      }
    }

    let registerPending = false;
    let recoverPending = false;

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
        setRegisterError('Introduce los datos, por favor.');
        registerPending = false;
        if (registerBtn) registerBtn.disabled = false;
        return;
      }
      if (pass !== confirmation) {
        setRegisterError('La confirmacion no coincide con la contraseña.');
        registerPending = false;
        if (registerBtn) registerBtn.disabled = false;
        return;
      }
      if (!acceptterms) {
        setRegisterError('Debes aceptar las condiciones de uso.');
        registerPending = false;
        if (registerBtn) registerBtn.disabled = false;
        return;
      }

      const locale = (window.varGlobal && window.varGlobal.locale) || 'es';
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
          'Error creando la cuenta';
        setRegisterError(message);
        return;
      }
      await presentInfo('Gracias. Revisa tu email para activar tu cuenta.');
      setPanel('login');
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
        setRecoverError('Debes introducir tu email.');
        recoverPending = false;
        if (recoverBtn) recoverBtn.disabled = false;
        return;
      }
      const locale = (window.varGlobal && window.varGlobal.locale) || 'es';
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
          'No se pudo enviar el email';
        setRecoverError(message);
        return;
      }
      await presentInfo('Te hemos enviado un correo con instrucciones para restablecer tu contraseña.');
      setPanel('login');
    };

    this.querySelector('#login-enter')?.addEventListener('click', loginCI);
    this.querySelector('#login-apple')?.addEventListener('click', loginApple);
    this.querySelector('#login-google')?.addEventListener('click', loginGoogle);
    this.querySelector('#login-fb')?.addEventListener('click', loginFb);
    this.querySelector('#login-close')?.addEventListener('click', closeLogin);
    this.querySelector('#login-register-link')?.addEventListener('click', () => setPanel('register'));
    this.querySelector('#login-forgot-link')?.addEventListener('click', () => setPanel('recover'));
    this.querySelector('#register-back')?.addEventListener('click', () => setPanel('login'));
    this.querySelector('#recover-back')?.addEventListener('click', () => setPanel('login'));
    this.querySelector('#register-submit')?.addEventListener('click', registerAccount);
    this.querySelector('#recover-submit')?.addEventListener('click', recoverPassword);
    setPanel('login');

  }

  disconnectedCallback() {
    if (this._loginSocialErrorHandler) {
      window.removeEventListener('app:login-error', this._loginSocialErrorHandler);
    }
    if (this._loginSocialSuccessHandler) {
      window.removeEventListener('app:login-success', this._loginSocialSuccessHandler);
    }
  }
}

customElements.define('page-login', PageLogin);
