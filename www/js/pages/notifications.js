import {
  completeNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  removeNotification
} from '../notifications-store.js';

class PageNotifications extends HTMLElement {
  connectedCallback() {
    this.classList.add('ion-page');
    this.innerHTML = `
      <ion-header translucent="true">
        <ion-toolbar>
          <ion-title>Notificaciones</ion-title>
          <ion-buttons slot="end">
            <ion-button fill="clear" id="notify-close-btn">
              <ion-icon slot="icon-only" name="close"></ion-icon>
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content fullscreen>
        <div class="page-shell notify-shell">
          <div class="card notify-card">
            <div class="notify-title">Actividad reciente</div>
            <div class="notify-list" id="notify-list"></div>
            <div class="notify-empty" id="notify-empty" hidden>No hay notificaciones todavia.</div>
          </div>
        </div>
      </ion-content>
    `;

    this.listEl = this.querySelector('#notify-list');
    this.emptyEl = this.querySelector('#notify-empty');
    this._notifyHandler = () => this.renderList();
    window.addEventListener('app:notifications-change', this._notifyHandler);

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
  }

  handleListClick(event) {
    const button = event.target && event.target.closest('button[data-action]');
    if (!button) return;
    const itemEl = button.closest('.notify-item');
    const id = itemEl ? itemEl.dataset.id : '';
    if (!id) return;
    const action = button.dataset.action;
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
          window[action.callback]();
        } catch (err) {
          console.error('[notifications] error en callback', err);
        }
      }
    }, 80);
  }

  renderList() {
    if (!this.listEl || !this.emptyEl) return;
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
        const statusLabel = item.status === 'unread' ? 'Nueva' : 'Leida';
        const meta = `${statusLabel} · ${formatElapsed(item.created_at)}`;
        const hasAction = item.action && item.action.label;
        const actionLabel = hasAction ? item.action.label : '';
        const readClass = item.status !== 'unread' ? 'is-read' : '';
        return `
          <div class="notify-item ${readClass}" data-id="${escapeHtml(item.id)}">
            <div class="${iconClass}">
              <ion-icon name="${escapeHtml(icon)}"></ion-icon>
            </div>
            <div class="notify-content">
              <div class="notify-text">${escapeHtml(item.title)}</div>
              ${item.text ? `<div class="notify-meta">${escapeHtml(item.text)}</div>` : ''}
              <div class="notify-meta">${escapeHtml(meta)}</div>
              <div class="notify-actions">
                ${hasAction ? `<button class="notify-action-btn" type="button" data-action="open">${escapeHtml(
                  actionLabel
                )}</button>` : ''}
                <button class="notify-action-btn danger" type="button" data-action="delete">Eliminar</button>
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
    case 'premium':
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
    case 'premium':
      return 'good';
    case 'reminder':
    case 'review':
      return 'warn';
    default:
      return '';
  }
};

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

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');

customElements.define('page-notifications', PageNotifications);
