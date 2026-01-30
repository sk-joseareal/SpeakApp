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
            <h3>Iniciar sesión</h3>
            <br>
            <ion-list lines="full">
              <ion-item>
                <ion-input autocomplete="username" name="username" id="login-user" type="email" inputmode="email" label="Usuario" label-placement="stacked" placeholder="tu usuario"></ion-input>
              </ion-item>
              <ion-item>
                <ion-input autocomplete="current-password" name="password" id="login-pass" type="password" label="Contraseña" label-placement="stacked" placeholder="********"></ion-input>
              </ion-item>
            </ion-list>
            <p id="login-error" style="display:none; margin:8px 0 0; color: var(--ion-color-danger, #eb445a); font-size:0.9rem;"></p>
            <br>
            <ion-button expand="block" shape="round" id="login-enter">Entrar</ion-button>

            <div class="diag-actions" style="margin-top:12px;">
              <ion-button expand="block" fill="outline" id="login-fb">Login con Fb</ion-button>
              <ion-button expand="block" fill="outline" id="login-google">Login con Google</ion-button>
              <ion-button expand="block" fill="outline" id="login-apple">Login con Apple</ion-button>
            </div>
          </div>
        </div>
      </ion-content>
    `;

    const loginErrorEl = () => this.querySelector('#login-error');    
    const setLoginError = (message) => {
      const el = loginErrorEl();
      if (!el) return;
      if (message) {
        el.textContent = message;
        el.style.display = 'block';
      } else {
        el.textContent = '';
        el.style.display = 'none';
      }
    };

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

        let remoteimage = '';
        if (user.image) {
          remoteimage = user.image.replace('sk.audios.dev', 'sk.assets').replace('original/', '');
        }

        if (remoteimage) {
          if (window.Capacitor?.Plugins?.Filesystem) {
            const localPath = `avatars/${user.id}.jpg`;
            user.image_path = localPath;
            try {
              await window.Capacitor.Plugins.Filesystem.mkdir({ path: 'avatars', directory: 'DATA', recursive: true });
            } catch (err) {
              // Si ya existe, puedes ignorar; si falla por otra cosa, igual cae al fallback abajo
              console.warn('> No se ha podido crear la carpeta avatars:', err);
            }
            try {
              const uri = await download(remoteimage, localPath);
              user.image_local =
                window.Capacitor && typeof window.Capacitor.convertFileSrc === 'function'
                  ? window.Capacitor.convertFileSrc(uri)
                  : uri;
            } catch (err) {
              console.warn('> Error descargando avatar:', err);
              user.image_local = remoteimage;
            }
          } else {
            user.image_local = remoteimage;
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
      console.log("> loginApple (pendiente).");
      alert("loginApple (pendiente)");
    }

    const loginGoogle = async () => {
      console.log("> loginGoogle (pendiente).");
      alert("loginGoogle (pendiente)");
    }

    const loginFb = async () => {
      console.log("> loginFb (pendiente).");
      alert("loginFb (pendiente)");
    }

    const closeLogin = () => {
      const modal = this.closest('ion-modal');
      if (modal) {
        modal.dismiss();
        return;
      }
      window.location.hash = '#/diagnostics';
    };

    this.querySelector('#login-enter')?.addEventListener('click', loginCI);
    this.querySelector('#login-apple')?.addEventListener('click', loginApple);
    this.querySelector('#login-google')?.addEventListener('click', loginGoogle);
    this.querySelector('#login-fb')?.addEventListener('click', loginFb);
    this.querySelector('#login-close')?.addEventListener('click', closeLogin);



  }
}

customElements.define('page-login', PageLogin);
