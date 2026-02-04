class TabsPage extends HTMLElement {
  connectedCallback() {
    this.classList.add('ion-page');
    const TAB_STORAGE_KEY = 'appv5:active-tab';
    this.innerHTML = `
      <ion-tabs no-router>
        <ion-tab tab="home">
          <page-home></page-home>
        </ion-tab>
        <ion-tab tab="listas">
          <page-listas></page-listas>
        </ion-tab>
        <ion-tab tab="speak">
          <page-speak></page-speak>
        </ion-tab>
        <ion-tab tab="tu">
          <page-profile></page-profile>
        </ion-tab>
        <ion-tab tab="premium">
          <page-premium></page-premium>
        </ion-tab>
        <ion-tab-bar slot="bottom" class="app-tab-bar">
          <ion-tab-button tab="home">
            <ion-icon name="home-outline"></ion-icon>
            <ion-label>Inicio</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="listas">
            <ion-icon name="list-outline"></ion-icon>
            <ion-label>Training</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="speak">
            <ion-icon name="mic-outline"></ion-icon>
            <ion-label>Speak</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="tu">
            <ion-icon name="person-circle-outline"></ion-icon>
            <ion-label>Tu</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="premium">
            <ion-icon name="sparkles-outline"></ion-icon>
            <ion-label>Premium</ion-label>
          </ion-tab-button>
        </ion-tab-bar>
      </ion-tabs>
    `;

    const tabsEl = this.querySelector('ion-tabs');
    const allowedTabs = ['home', 'listas', 'speak', 'tu', 'premium'];
    const readStoredTab = () => {
      try {
        return localStorage.getItem(TAB_STORAGE_KEY);
      } catch (err) {
        return null;
      }
    };
    const writeStoredTab = (tab) => {
      try {
        localStorage.setItem(TAB_STORAGE_KEY, tab);
      } catch (err) {
        // no-op
      }
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

    const isLoggedIn = () => {
      const user = window.user;
      return Boolean(user && user.id !== undefined && user.id !== null);
    };

    const tuButton = this.querySelector('ion-tab-button[tab="tu"]');
    this._tuClickHandler = () => {
      if (isLoggedIn()) return;
      openLoginModal().catch((err) => {
        console.error('[tabs] error abriendo login', err);
      });
    };
    tuButton?.addEventListener('click', this._tuClickHandler);

    this._tabChangeHandler = (event) => {
      const tab = event && event.detail ? event.detail.tab : null;
      if (!tab || !allowedTabs.includes(tab)) return;
      writeStoredTab(tab);
    };
    tabsEl?.addEventListener('ionTabsDidChange', this._tabChangeHandler);

    const storedTab = readStoredTab();
    if (storedTab && allowedTabs.includes(storedTab) && tabsEl && typeof tabsEl.select === 'function') {
      setTimeout(() => {
        tabsEl.select(storedTab).catch(() => {});
      }, 0);
    }
  }

  disconnectedCallback() {
    const tuButton = this.querySelector('ion-tab-button[tab="tu"]');
    if (tuButton && this._tuClickHandler) {
      tuButton.removeEventListener('click', this._tuClickHandler);
    }
    const tabsEl = this.querySelector('ion-tabs');
    if (tabsEl && this._tabChangeHandler) {
      tabsEl.removeEventListener('ionTabsDidChange', this._tabChangeHandler);
    }
  }
}

customElements.define('tabs-page', TabsPage);
