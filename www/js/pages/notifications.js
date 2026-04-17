import {
  completeNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  removeNotification
} from '../notifications-store.js';
import { getAppLocale } from '../state.js';
import { getNotificationsCopy, normalizeLocale as normalizeCopyLocale } from '../content/copy.js';

class PageNotifications extends HTMLElement {
  connectedCallback() {
    this.classList.add('ion-page');
    this.currentUiLocale = this.resolveUiLocale();
    this.currentCopy = getNotificationsCopy(this.currentUiLocale);
    this.innerHTML = `
      <ion-header translucent="true">
        <ion-toolbar>
          <ion-title>${this.currentCopy.title}</ion-title>
          <ion-buttons slot="end">
            <ion-button fill="clear" id="notify-close-btn">
              <ion-icon slot="icon-only" name="close"></ion-icon>
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content fullscreen>
        <div class="page-shell notify-shell">
          <div class="notify-title">${this.currentCopy.recentActivity}</div>
          <div class="notify-list" id="notify-list"></div>
          <div class="notify-empty" id="notify-empty" hidden>${this.currentCopy.empty}</div>
        </div>
      </ion-content>
    `;

    this.listEl = this.querySelector('#notify-list');
    this.emptyEl = this.querySelector('#notify-empty');
    this._notifyHandler = () => this.renderList();
    window.addEventListener('app:notifications-change', this._notifyHandler);
    this._localeHandler = () => this.handleLocaleChange();
    window.addEventListener('app:locale-change', this._localeHandler);

    const closeBtn = this.querySelector('#notify-close-btn');
    closeBtn?.addEventListener('click', () => {
      const modal = this.closest('ion-modal');
      modal?.dismiss();
    });

    this.listEl?.addEventListener('click', (event) => this.handleListClick(event));

    markAllNotificationsRead();
    this.renderList();
  }

  disconnectedCallback() {
    if (this._notifyHandler) {
      window.removeEventListener('app:notifications-change', this._notifyHandler);
      this._notifyHandler = null;
    }
    if (this._localeHandler) {
      window.removeEventListener('app:locale-change', this._localeHandler);
      this._localeHandler = null;
    }
  }

  resolveUiLocale() {
    const fromState = normalizeCopyLocale(getAppLocale());
    if (fromState) return fromState;
    return normalizeCopyLocale(window.varGlobal?.locale) || 'en';
  }

  handleLocaleChange() {
    const nextLocale = this.resolveUiLocale();
    if (nextLocale === this.currentUiLocale) return;
    this.currentUiLocale = nextLocale;
    this.currentCopy = getNotificationsCopy(nextLocale);
    const titleEl = this.querySelector('ion-title');
    if (titleEl) titleEl.textContent = this.currentCopy.title;
    const subtitleEl = this.querySelector('.notify-title');
    if (subtitleEl) subtitleEl.textContent = this.currentCopy.recentActivity;
    if (this.emptyEl) this.emptyEl.textContent = this.currentCopy.empty;
    this.renderList();
  }

  handleListClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    const button = target ? target.closest('button[data-action]') : null;
    const itemEl = button
      ? button.closest('.notify-item')
      : target
      ? target.closest('.notify-item')
      : null;
    if (!itemEl) return;
    const id = itemEl ? itemEl.dataset.id : '';
    if (!id) return;
    const action = button ? button.dataset.action : 'open';
    if (action === 'delete') {
      removeNotification(id);
      return;
    }
    if (action === 'open') {
      const items = getNotifications();
      const note = items.find((entry) => entry.id === id);
      if (!note) return;
      const shouldComplete = note.action && note.action.complete === true;
      if (shouldComplete) {
        completeNotification(id);
      } else {
        markNotificationRead(id);
      }
      this.applyNotificationAction(note.action);
    }
  }

  applyNotificationAction(action) {
    if (!action || typeof action !== 'object') return;
    const modal = this.closest('ion-modal');
    if (modal) {
      modal.dismiss().catch(() => {});
    }
    setTimeout(() => {
      if (action.profileTab) {
        window.r34lp0w3r = window.r34lp0w3r || {};
        window.r34lp0w3r.profileForceTab = action.profileTab;
      }
      if (action.tab) {
        const tabs = document.querySelector('ion-tabs');
        if (tabs && typeof tabs.select === 'function') {
          tabs.select(action.tab).catch(() => {});
        }
      }
      if (action.hash) {
        window.location.hash = action.hash;
      }
      if (action.callback && typeof window[action.callback] === 'function') {
        try {
          window[action.callback](action);
        } catch (err) {
          console.error('[notifications] error en callback', err);
        }
      }
    }, 80);
  }

  renderList() {
    if (!this.listEl || !this.emptyEl) return;
    const copy = this.currentCopy || getNotificationsCopy('en');
    const items = getNotifications();
    if (!items.length) {
      this.listEl.innerHTML = '';
      this.emptyEl.hidden = false;
      return;
    }
    this.emptyEl.hidden = true;
    this.listEl.innerHTML = items
      .map((item) => {
        const icon = resolveNotifyIcon(item);
        const tone = resolveNotifyTone(item);
        const iconClass = tone ? `notify-icon ${tone}` : 'notify-icon';
        const statusLabel = item.status === 'unread' ? copy.statusNew : copy.statusRead;
        const meta = `${statusLabel} · ${formatElapsed(item.created_at, copy)}`;
        const hasAction = item.action && item.action.label;
        const actionLabel = hasAction ? item.action.label : '';
        const readClass = item.status !== 'unread' ? 'is-read' : '';
        const iconMarkup = item.image
          ? `<img class="notify-thumb" src="${escapeHtml(item.image)}" alt="">`
          : `<ion-icon name="${escapeHtml(icon)}"></ion-icon>`;
        return `
          <div class="notify-item ${readClass}" data-id="${escapeHtml(item.id)}">
            <div class="${iconClass}">
              ${iconMarkup}
            </div>
            <div class="notify-content">
              <div class="notify-text">${escapeHtml(item.title)}</div>
              ${item.text ? `<div class="notify-meta">${escapeHtml(item.text)}</div>` : ''}
              <div class="notify-meta">${escapeHtml(meta)}</div>
              <div class="notify-actions">
                ${hasAction ? `<button class="notify-action-btn" type="button" data-action="open">${escapeHtml(
                  actionLabel
                )}</button>` : ''}
                <button class="notify-action-btn danger" type="button" data-action="delete">${escapeHtml(copy.deleteAction)}</button>
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  }
}

const resolveNotifyIcon = (item) => {
  if (item && item.icon) return item.icon;
  switch (item?.type) {
    case 'reward':
      return 'diamond-outline';
    case 'review':
      return 'book-outline';
    case 'reminder':
      return 'timer-outline';
    case 'practice':
      return 'mic-outline';
    case 'chat':
      return 'sparkles-outline';
    case 'talk':
      return 'chatbubble-ellipses-outline';
    default:
      return 'notifications-outline';
  }
};

const resolveNotifyTone = (item) => {
  if (item && (item.tone === 'good' || item.tone === 'warn')) return item.tone;
  switch (item?.type) {
    case 'reward':
    case 'chat':
      return 'good';
    case 'reminder':
    case 'review':
      return 'warn';
    default:
      return '';
  }
};

const formatElapsed = (ts, copy) => {
  const value = Number(ts);
  const safeCopy = copy || getNotificationsCopy('en');
  if (!value) return safeCopy.elapsedNow;
  const diff = Math.max(0, Date.now() - value);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return safeCopy.elapsedNow;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return safeCopy.elapsedMinutes.replace('{n}', String(minutes));
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return safeCopy.elapsedHours.replace('{n}', String(hours));
  const days = Math.floor(hours / 24);
  return safeCopy.elapsedDays.replace('{n}', String(days));
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');

customElements.define('page-notifications', PageNotifications);
