import { getAppLocale, hasLoginTabsLock } from '../state.js';
import { getTabsCopy, normalizeLocale as normalizeCopyLocale } from '../content/copy.js';

class TabsPage extends HTMLElement {
  connectedCallback() {
    this.classList.add('ion-page');
    const TAB_STORAGE_KEY = 'appv5:active-tab';
    const REFERENCE_TAB_ENABLED_KEY = 'appv5:reference-tab-enabled';
    const COMMUNITY_CHAT_UNREAD_STORAGE_PREFIX = 'appv5:chat-community-unread:';
    const normalizeTab = (tab) => String(tab || '').trim().toLowerCase();
    const normalizeReferenceTabEnabled = (value) => {
      if (typeof value === 'boolean') return value;
      const normalized = String(value || '')
        .trim()
        .toLowerCase();
      if (!normalized) return false;
      return ['1', 'true', 'on', 'yes'].includes(normalized);
    };
    const isReferenceTabEnabled = () => {
      if (
        window.r34lp0w3r &&
        Object.prototype.hasOwnProperty.call(window.r34lp0w3r, 'referenceTabEnabled')
      ) {
        return normalizeReferenceTabEnabled(window.r34lp0w3r.referenceTabEnabled);
      }
      try {
        return normalizeReferenceTabEnabled(localStorage.getItem(REFERENCE_TAB_ENABLED_KEY));
      } catch (err) {
        return false;
      }
    };
    const getAllowedTabs = () =>
      isReferenceTabEnabled()
        ? ['home', 'freeride', 'reference', 'tu', 'chat']
        : ['home', 'freeride', 'tu', 'chat'];
    const isAllowedTab = (tab) => getAllowedTabs().includes(tab);
    const resolveUiLocale = () => {
      const fromState = normalizeCopyLocale(getAppLocale());
      if (fromState) return fromState;
      return normalizeCopyLocale(window.varGlobal?.locale) || 'en';
    };
    const readTabsCopy = () => getTabsCopy(resolveUiLocale());
    const tabsCopy = readTabsCopy();
    this.innerHTML = `
      <ion-tabs no-router>
        <ion-tab tab="home">
          <page-home></page-home>
        </ion-tab>
        <ion-tab tab="freeride">
          <page-free-ride></page-free-ride>
        </ion-tab>
        <ion-tab tab="reference">
          <page-reference></page-reference>
        </ion-tab>
        <ion-tab tab="tu">
          <page-profile></page-profile>
        </ion-tab>
        <ion-tab tab="chat">
          <page-chat></page-chat>
        </ion-tab>
        <ion-tab-bar slot="bottom" class="app-tab-bar">
          <ion-tab-button tab="home">
            <ion-icon name="barbell-outline"></ion-icon>
            <ion-label data-tab-label="home">${tabsCopy.training}</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="freeride">
            <ion-icon name="flask-outline"></ion-icon>
            <ion-label data-tab-label="freeride">${tabsCopy.lab}</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="reference">
            <ion-icon name="book-outline"></ion-icon>
            <ion-label data-tab-label="reference">${tabsCopy.reference}</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="tu">
            <ion-icon name="person-circle-outline"></ion-icon>
            <ion-label data-tab-label="tu">${tabsCopy.you}</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="chat" class="app-tab-button-chat">
            <ion-icon name="chatbubbles-outline"></ion-icon>
            <ion-label data-tab-label="chat">${tabsCopy.chat}</ion-label>
          </ion-tab-button>
        </ion-tab-bar>
      </ion-tabs>
    `;

    const tabsEl = this.querySelector('ion-tabs');
    const tabBarEl = this.querySelector('ion-tab-bar');
    const applyTabLabels = () => {
      const copy = readTabsCopy();
      const homeLabel = this.querySelector('[data-tab-label="home"]');
      const freeRideLabel = this.querySelector('[data-tab-label="freeride"]');
      const referenceLabel = this.querySelector('[data-tab-label="reference"]');
      const youLabel = this.querySelector('[data-tab-label="tu"]');
      const chatLabel = this.querySelector('[data-tab-label="chat"]');
      if (homeLabel) homeLabel.textContent = copy.training;
      if (freeRideLabel) freeRideLabel.textContent = copy.lab;
      if (referenceLabel) referenceLabel.textContent = copy.reference;
      if (youLabel) youLabel.textContent = copy.you;
      if (chatLabel) chatLabel.textContent = copy.chat;
    };
    let forcingTab = false;
    let wasLoggedIn = false;

    const getCurrentUserId = () => {
      const user = window.user;
      return user && user.id !== undefined && user.id !== null ? String(user.id) : '';
    };

    const readChatUnreadState = () => {
      const currentUserId = getCurrentUserId();
      if (!currentUserId) return { count: 0, showTabDot: false };
      try {
        const raw = localStorage.getItem(`${COMMUNITY_CHAT_UNREAD_STORAGE_PREFIX}${currentUserId}`);
        if (!raw) return { count: 0, showTabDot: false };
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            count: Math.max(0, Math.round(Number(parsed.count) || 0)),
            showTabDot: parsed.showTabDot === true
          };
        }
        return {
          count: Math.max(0, Math.round(Number(raw) || 0)),
          showTabDot: Math.max(0, Math.round(Number(raw) || 0)) > 0
        };
      } catch (err) {
        return { count: 0, showTabDot: false };
      }
    };

    const applyChatUnreadBadge = (state = readChatUnreadState()) => {
      const chatButton = this.querySelector('ion-tab-button[tab="chat"]');
      if (!chatButton) return;
      const unread = Math.max(0, Math.round(Number(state && state.count) || 0));
      const showTabDot = Boolean(state && state.showTabDot);
      chatButton.classList.toggle('has-unread', showTabDot);
      if (showTabDot && unread > 0) {
        chatButton.setAttribute('data-unread-count', String(unread));
      } else {
        chatButton.removeAttribute('data-unread-count');
      }
    };

    const readStoredTab = () => {
      try {
        return localStorage.getItem(TAB_STORAGE_KEY);
      } catch (err) {
        return null;
      }
    };

    const writeStoredTab = (tab) => {
      const normalized = normalizeTab(tab);
      if (!isAllowedTab(normalized)) return;
      try {
        localStorage.setItem(TAB_STORAGE_KEY, normalized);
      } catch (err) {
        // no-op
      }
    };

    const applyReferenceTabVisibility = () => {
      const enabled = isReferenceTabEnabled();
      const referenceButton = this.querySelector('ion-tab-button[tab="reference"]');
      if (referenceButton) {
        referenceButton.hidden = !enabled;
      }
      const referenceTab = this.querySelector('ion-tab[tab="reference"]');
      if (referenceTab) {
        referenceTab.hidden = !enabled;
      }
      if (!enabled) {
        const selectedFromAttr = normalizeTab(tabsEl?.getAttribute('selected-tab') || '');
        const selectedFromProp =
          tabsEl && typeof tabsEl.selectedTab === 'string' ? normalizeTab(tabsEl.selectedTab) : '';
        const selected = selectedFromProp || selectedFromAttr;
        if (selected === 'reference') {
          writeStoredTab('home');
          forceTab('home');
        }
      }
    };

    const isLoggedIn = () => {
      const user = window.user;
      return Boolean(user && user.id !== undefined && user.id !== null);
    };
    wasLoggedIn = isLoggedIn();

    const isTabsLocked = () => hasLoginTabsLock() && !isLoggedIn();

    const openLoginModal = async (locked) => {
      if (typeof window.openLoginModal !== 'function') return;
      await window.openLoginModal({ locked: Boolean(locked) });
    };

    const forceTab = (tab) => {
      if (!tabsEl || typeof tabsEl.select !== 'function') return;
      const normalizedTab = normalizeTab(tab);
      forcingTab = true;
      tabsEl
        .select(normalizedTab)
        .then(() => {
          if (!normalizedTab || !isAllowedTab(normalizedTab)) return;
          window.dispatchEvent(
            new CustomEvent('app:tab-change', {
              detail: { tab: normalizedTab }
            })
          );
        })
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
      const rawTab = tabButton.getAttribute('tab');
      const tab = normalizeTab(rawTab);
      if (!tab || !isAllowedTab(tab)) return;

      if (tab === 'reference' && !isReferenceTabEnabled()) {
        event.preventDefault();
        event.stopPropagation();
        writeStoredTab('home');
        forceTab('home');
        return;
      }

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

      window.dispatchEvent(
        new CustomEvent('app:tab-user-click', {
          detail: { tab }
        })
      );
    };
    tabBarEl?.addEventListener('click', this._tabBarClickHandler, true);

    this._tabChangeHandler = (event) => {
      const tab = normalizeTab(event && event.detail ? event.detail.tab : null);
      if (!tab || !isAllowedTab(tab)) return;
      if (forcingTab) return;

      if (tab === 'reference' && !isReferenceTabEnabled()) {
        writeStoredTab('home');
        forceTab('home');
        return;
      }

      if (isTabsLocked() && tab !== 'tu') {
        forceTab('tu');
        openLoginModal(true).catch((err) => {
          console.error('[tabs] error abriendo login bloqueado', err);
        });
        return;
      }

      writeStoredTab(tab);
      window.dispatchEvent(
        new CustomEvent('app:tab-change', {
          detail: { tab }
        })
      );
    };
    tabsEl?.addEventListener('ionTabsDidChange', this._tabChangeHandler);

    this._tabsLockChangeHandler = () => {
      enforceLoginTabsLock(false);
    };
    window.addEventListener('app:tabs-lock-change', this._tabsLockChangeHandler);

    this._userChangeHandler = () => {
      const nowLoggedIn = isLoggedIn();
      const justLoggedIn = !wasLoggedIn && nowLoggedIn;
      wasLoggedIn = nowLoggedIn;
      applyReferenceTabVisibility();
      applyChatUnreadBadge();
      enforceLoginTabsLock(false);
      if (justLoggedIn) {
        writeStoredTab('home');
        forceTab('home');
      }
    };
    window.addEventListener('app:user-change', this._userChangeHandler);
    this._localeChangeHandler = () => applyTabLabels();
    window.addEventListener('app:locale-change', this._localeChangeHandler);
    this._referenceTabToggleHandler = () => {
      applyReferenceTabVisibility();
      const storedTab = normalizeTab(readStoredTab());
      if (storedTab && !isAllowedTab(storedTab)) {
        writeStoredTab('home');
      }
    };
    window.addEventListener('app:reference-tab-enabled-change', this._referenceTabToggleHandler);
    this._chatUnreadChangeHandler = (event) => {
      const currentUserId = getCurrentUserId();
      const detail = event && event.detail ? event.detail : {};
      const detailUserId =
        detail.userId !== undefined && detail.userId !== null ? String(detail.userId) : '';
      if (detailUserId && currentUserId && detailUserId !== currentUserId) return;
      applyChatUnreadBadge(detail);
    };
    window.addEventListener('app:chat-unread-change', this._chatUnreadChangeHandler);

    applyReferenceTabVisibility();
    applyChatUnreadBadge();

    if (isTabsLocked()) {
      setTimeout(() => enforceLoginTabsLock(false), 0);
      return;
    }

    const storedTab = readStoredTab();
    const normalizedStoredTab = normalizeTab(storedTab);
    if (normalizedStoredTab && isAllowedTab(normalizedStoredTab)) {
      setTimeout(() => {
        forceTab(normalizedStoredTab);
      }, 0);
    } else if (normalizedStoredTab && !isAllowedTab(normalizedStoredTab)) {
      writeStoredTab('home');
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

    if (this._localeChangeHandler) {
      window.removeEventListener('app:locale-change', this._localeChangeHandler);
    }

    if (this._referenceTabToggleHandler) {
      window.removeEventListener('app:reference-tab-enabled-change', this._referenceTabToggleHandler);
    }

    if (this._chatUnreadChangeHandler) {
      window.removeEventListener('app:chat-unread-change', this._chatUnreadChangeHandler);
    }
  }
}

customElements.define('tabs-page', TabsPage);
