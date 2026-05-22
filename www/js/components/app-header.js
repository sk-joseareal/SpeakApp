/**
 * Shared app header HTML renderer.
 * The title bar can be toggled from Diagnostics. Keep the helper so pages can
 * continue calling it without branching their markup.
 *
 * @param {object} options
 */
import { getActiveLocale } from '../state.js';

const APP_TITLEBAR_ENABLED_KEY = 'appv5:app-titlebar-enabled';
const APP_NOTIFICATIONS_ENABLED_KEY = 'appv5:notifications-enabled';

const REWARD_BADGE_ORDER = [
  { icon: 'trophy', label: 'trophy', interactive: true },
  { icon: 'ribbon', label: 'ribbon', interactive: true },
  { icon: 'diamond', label: 'diamond', interactive: false }
];

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeLocaleLabel = (locale) => {
  const normalized = String(locale || '').trim().toLowerCase();
  const fallback = String(getActiveLocale() || window.varGlobal?.locale || 'en')
    .trim()
    .toLowerCase();
  const resolved = normalized || fallback || 'en';
  return resolved.split('-')[0].slice(0, 2).toUpperCase() || 'EN';
};

const getRewardTotals = () => {
  const store = window.r34lp0w3r && window.r34lp0w3r.speakSessionRewards;
  if (!store || typeof store !== 'object') return {};
  return Object.values(store).reduce((totals, entry) => {
    if (!entry || typeof entry !== 'object') return totals;
    const qty = Number(entry.rewardQty) || 0;
    const icon = String(entry.rewardIcon || '').trim().toLowerCase();
    if (!qty || !icon) return totals;
    totals[icon] = (totals[icon] || 0) + qty;
    return totals;
  }, {});
};

const renderRewardBadges = (rewardBadgesId) => {
  const totals = getRewardTotals();
  const badges = REWARD_BADGE_ORDER.map((badge) => {
    const qty = Number(totals[badge.icon]) || 0;
    if (!qty) return '';
    const interactive = badge.interactive ? ' is-interactive' : '';
    return `
      <div
        class="training-badge reward-badge${interactive}"
        data-reward-kind="${escapeHtml(badge.icon)}"
        data-reward-icon="${escapeHtml(badge.icon)}"
        data-reward-qty="${qty}"
        ${badge.interactive ? 'role="button" tabindex="0"' : ''}
      >
        <ion-icon name="${escapeHtml(badge.icon)}" role="img"></ion-icon>
        <span>${qty}</span>
      </div>
    `;
  })
    .filter(Boolean)
    .join('');

  if (!badges) return '';
  const idAttr = rewardBadgesId ? ` id="${escapeHtml(rewardBadgesId)}"` : '';
  return `<div class="reward-badges"${idAttr}>${badges}</div>`;
};

const renderLocaleButton = (locale) => {
  const label = normalizeLocaleLabel(locale);
  return `
    <button class="app-locale-btn" type="button" aria-label="${label}">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
        <path d="M2 12h20"></path>
      </svg>
      <span class="app-locale-label">${label}</span>
    </button>
  `;
};

const renderNotifyButton = () => `
  <ion-button fill="clear" size="small" class="app-notify-btn" aria-label="Notifications">
    <ion-icon slot="icon-only" name="notifications-outline" role="img"></ion-icon>
  </ion-button>
`;

export function isAppNotificationsEnabled() {
  const globalValue =
    window.r34lp0w3r &&
    Object.prototype.hasOwnProperty.call(window.r34lp0w3r, 'appNotificationsEnabled')
      ? window.r34lp0w3r.appNotificationsEnabled
      : undefined;
  if (typeof globalValue === 'boolean') return globalValue;
  try {
    const raw = localStorage.getItem(APP_NOTIFICATIONS_ENABLED_KEY);
    if (raw === null || raw === '') return false;
    const normalized = String(raw).trim().toLowerCase();
    return ['1', 'true', 'on', 'yes'].includes(normalized);
  } catch (_err) {
    return false;
  }
}

export function setAppNotificationsEnabled(enabled) {
  const nextEnabled = Boolean(enabled);
  window.r34lp0w3r = window.r34lp0w3r || {};
  window.r34lp0w3r.appNotificationsEnabled = nextEnabled;
  try {
    if (nextEnabled) {
      localStorage.setItem(APP_NOTIFICATIONS_ENABLED_KEY, '1');
    } else {
      localStorage.removeItem(APP_NOTIFICATIONS_ENABLED_KEY);
    }
  } catch (_err) {
    // no-op
  }
  document.body.classList.toggle('app-notifications-enabled', nextEnabled);
  window.dispatchEvent(
    new CustomEvent('app:notifications-enabled-change', {
      detail: { enabled: nextEnabled }
    })
  );
}

export function isAppTitlebarEnabled() {
  const globalValue =
    window.r34lp0w3r && Object.prototype.hasOwnProperty.call(window.r34lp0w3r, 'appTitlebarEnabled')
      ? window.r34lp0w3r.appTitlebarEnabled
      : undefined;
  if (typeof globalValue === 'boolean') return globalValue;
  try {
    const raw = localStorage.getItem(APP_TITLEBAR_ENABLED_KEY);
    if (raw === null || raw === '') return true;
    const normalized = String(raw).trim().toLowerCase();
    return ['1', 'true', 'on', 'yes'].includes(normalized);
  } catch (_err) {
    return true;
  }
}

export function setAppTitlebarEnabled(enabled) {
  const nextEnabled = Boolean(enabled);
  window.r34lp0w3r = window.r34lp0w3r || {};
  window.r34lp0w3r.appTitlebarEnabled = nextEnabled;
  try {
    localStorage.setItem(APP_TITLEBAR_ENABLED_KEY, nextEnabled ? '1' : '0');
  } catch (_err) {
    // no-op
  }
  document.body.classList.toggle('app-titlebar-enabled', nextEnabled);
  window.dispatchEvent(
    new CustomEvent('app:titlebar-enabled-change', {
      detail: { enabled: nextEnabled }
    })
  );
}

export function renderAppHeader(_options = {}) {
  const options = _options && typeof _options === 'object' ? _options : {};
  if (!isAppTitlebarEnabled() && !options.forceRender) return '';
  const title = String(options.title || '').trim();
  const showTitleSlot = Boolean(options.showTitleSlot);
  const locale = options.locale;
  const rewardBadgesId = String(options.rewardBadgesId || '').trim();
  const showNotifications = isAppNotificationsEnabled();
  return `
    <ion-header translucent="true" class="app-header-shell">
      <ion-toolbar class="secret-title-area toolbar-title-default">
        <ion-title></ion-title>
        ${(title || showTitleSlot) ? `<div slot="start" class="app-toolbar-title secret-title">${escapeHtml(title)}</div>` : ''}
        <div class="app-header-actions" slot="end">
          ${renderRewardBadges(rewardBadgesId)}
          ${showNotifications ? renderNotifyButton() : ''}
          ${renderLocaleButton(locale)}
        </div>
      </ion-toolbar>
    </ion-header>
  `;
}

export function updateAppHeaderRewards(root, rewardBadgesId = '') {
  const scope =
    root && typeof root.querySelector === 'function'
      ? root
      : document && typeof document.querySelector === 'function'
        ? document
        : null;
  if (!scope) return;
  const actionsEl = scope.querySelector('ion-header.app-header-shell .app-header-actions');
  if (!actionsEl) return;
  const previousBadgesEl = actionsEl.querySelector('.reward-badges');
  const nextBadgesHtml = renderRewardBadges(String(rewardBadgesId || '').trim());
  if (!nextBadgesHtml) {
    previousBadgesEl?.remove();
    return;
  }
  const tpl = document.createElement('template');
  tpl.innerHTML = nextBadgesHtml.trim();
  const nextBadgesEl = tpl.content.firstElementChild;
  if (!nextBadgesEl) return;
  if (previousBadgesEl) {
    previousBadgesEl.replaceWith(nextBadgesEl);
    return;
  }
  const notifyBtnEl = actionsEl.querySelector('.app-notify-btn');
  actionsEl.insertBefore(nextBadgesEl, notifyBtnEl || actionsEl.firstChild);
}
