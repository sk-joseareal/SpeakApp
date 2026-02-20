import { hasLoginTabsLock } from '../state.js';

class TabsPage extends HTMLElement {
  connectedCallback() {
    this.classList.add('ion-page');
    const TAB_STORAGE_KEY = 'appv5:active-tab';
    const allowedTabs = ['home', 'freeride', 'tu', 'premium'];
    this.innerHTML = `
      <ion-tabs no-router>
        <ion-tab tab="home">
          <page-home></page-home>
        </ion-tab>
        <ion-tab tab="freeride">
          <page-free-ride></page-free-ride>
        </ion-tab>
        <ion-tab tab="tu">
          <page-profile></page-profile>
        </ion-tab>
        <ion-tab tab="premium">
          <page-premium></page-premium>
        </ion-tab>
        <ion-tab-bar slot="bottom" class="app-tab-bar">
          <ion-tab-button tab="home">
            <ion-icon name="mic-outline"></ion-icon>
            <ion-label>Routes</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="freeride">
            <ion-icon name="paper-plane-outline"></ion-icon>
            <ion-label>Free ride</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="tu">
            <ion-icon name="person-circle-outline"></ion-icon>
            <ion-label>You</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="premium">
            <img class="tab-mascot-icon" src="assets/mascot/mascot-cat.png" alt="">
            <ion-label>Talk</ion-label>
          </ion-tab-button>
        </ion-tab-bar>
      </ion-tabs>
    `;

    const tabsEl = this.querySelector('ion-tabs');
    const tabBarEl = this.querySelector('ion-tab-bar');
    let forcingTab = false;

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

    const isLoggedIn = () => {
      const user = window.user;
      return Boolean(user && user.id !== undefined && user.id !== null);
    };

    const isTabsLocked = () => hasLoginTabsLock() && !isLoggedIn();

    const openLoginModal = async (locked) => {
      if (typeof window.openLoginModal !== 'function') return;
      await window.openLoginModal({ locked: Boolean(locked) });
    };

    const forceTab = (tab) => {
      if (!tabsEl || typeof tabsEl.select !== 'function') return;
      forcingTab = true;
      tabsEl
        .select(tab)
        .catch(() => {})
        .finally(() => {
          setTimeout(() => {
            forcingTab = false;
          }, 0);
        });
    };

    const applyTabButtonLock = (locked) => {
      const buttons = Array.from(this.querySelectorAll('ion-tab-button[tab]'));
      buttons.forEach((button) => {
        const tab = button.getAttribute('tab');
        const disabled = Boolean(locked && tab !== 'tu');
        button.disabled = disabled;
        button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
      });
    };

    const enforceLoginTabsLock = (openLogin = true) => {
      const locked = isTabsLocked();
      applyTabButtonLock(locked);
      if (!locked) return;
      writeStoredTab('tu');
      forceTab('tu');
      if (openLogin) {
        openLoginModal(true).catch((err) => {
          console.error('[tabs] error abriendo login bloqueado', err);
        });
      }
    };

    this._tabBarClickHandler = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const tabButton = target ? target.closest('ion-tab-button[tab]') : null;
      if (!tabButton) return;
      const tab = tabButton.getAttribute('tab');
      if (!tab || !allowedTabs.includes(tab)) return;

      if (isTabsLocked() && tab !== 'tu') {
        event.preventDefault();
        event.stopPropagation();
        forceTab('tu');
        openLoginModal(true).catch((err) => {
          console.error('[tabs] error abriendo login bloqueado', err);
        });
        return;
      }

      if (tab === 'tu' && !isLoggedIn()) {
        openLoginModal(isTabsLocked()).catch((err) => {
          console.error('[tabs] error abriendo login', err);
        });
      }
    };
    tabBarEl?.addEventListener('click', this._tabBarClickHandler, true);

    this._tabChangeHandler = (event) => {
      const tab = event && event.detail ? event.detail.tab : null;
      if (!tab || !allowedTabs.includes(tab)) return;
      if (forcingTab) return;

      if (isTabsLocked() && tab !== 'tu') {
        forceTab('tu');
        openLoginModal(true).catch((err) => {
          console.error('[tabs] error abriendo login bloqueado', err);
        });
        return;
      }

      writeStoredTab(tab);
    };
    tabsEl?.addEventListener('ionTabsDidChange', this._tabChangeHandler);

    this._tabsLockChangeHandler = () => {
      enforceLoginTabsLock(false);
    };
    window.addEventListener('app:tabs-lock-change', this._tabsLockChangeHandler);

    this._userChangeHandler = () => {
      enforceLoginTabsLock(false);
    };
    window.addEventListener('app:user-change', this._userChangeHandler);

    if (isTabsLocked()) {
      setTimeout(() => enforceLoginTabsLock(true), 0);
      return;
    }

    const storedTab = readStoredTab();
    if (storedTab && allowedTabs.includes(storedTab)) {
      setTimeout(() => {
        forceTab(storedTab);
      }, 0);
    }
  }

  disconnectedCallback() {
    const tabBarEl = this.querySelector('ion-tab-bar');
    if (tabBarEl && this._tabBarClickHandler) {
      tabBarEl.removeEventListener('click', this._tabBarClickHandler, true);
    }

    const tabsEl = this.querySelector('ion-tabs');
    if (tabsEl && this._tabChangeHandler) {
      tabsEl.removeEventListener('ionTabsDidChange', this._tabChangeHandler);
    }

    if (this._tabsLockChangeHandler) {
      window.removeEventListener('app:tabs-lock-change', this._tabsLockChangeHandler);
    }

    if (this._userChangeHandler) {
      window.removeEventListener('app:user-change', this._userChangeHandler);
    }
  }
}

customElements.define('tabs-page', TabsPage);
