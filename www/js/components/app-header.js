/**
 * Shared app header HTML renderer.
 * Returns an ion-header string ready to be injected into a page's innerHTML.
 *
 * @param {object} options
 * @param {string} options.title         - Tab title shown on the left
 * @param {string} options.rewardBadgesId - ID for the reward badges container
 * @param {string} options.locale        - Active locale code shown on the globe button (e.g. 'ES')
 */
export function renderAppHeader({ title, rewardBadgesId, locale }) {
  const localeLabel = String(locale || '').trim().toUpperCase();
  return `
    <ion-header translucent="true">
      <ion-toolbar class="secret-title-area">
        <ion-title></ion-title>
        <div slot="start" class="app-toolbar-title secret-title">${title}</div>
        <div class="app-header-actions" slot="end">
          <div class="reward-badges" id="${rewardBadgesId}"></div>
          <ion-button fill="clear" size="small" class="app-notify-btn">
            <ion-icon slot="icon-only" name="notifications-outline"></ion-icon>
          </ion-button>
          <button class="app-locale-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
            <span class="app-locale-label">${localeLabel}</span>
          </button>
        </div>
      </ion-toolbar>
    </ion-header>
  `;
}
