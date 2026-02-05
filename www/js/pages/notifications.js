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
            <div class="notify-list">
              <div class="notify-item">
                <div class="notify-icon good">
                  <ion-icon name="sparkles-outline"></ion-icon>
                </div>
                <div>
                  <div class="notify-text">Has desbloqueado Training 2.</div>
                  <div class="notify-meta">Hace 2 h</div>
                </div>
              </div>
              <div class="notify-item">
                <div class="notify-icon">
                  <ion-icon name="diamond-outline"></ion-icon>
                </div>
                <div>
                  <div class="notify-text">Nuevo premio: 3 diamonds.</div>
                  <div class="notify-meta">Hace 1 dia</div>
                </div>
              </div>
              <div class="notify-item">
                <div class="notify-icon warn">
                  <ion-icon name="timer-outline"></ion-icon>
                </div>
                <div>
                  <div class="notify-text">Recordatorio: practica 5 minutos hoy.</div>
                  <div class="notify-meta">Ayer</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ion-content>
    `;

    const closeBtn = this.querySelector('#notify-close-btn');
    closeBtn?.addEventListener('click', () => {
      const modal = this.closest('ion-modal');
      modal?.dismiss();
    });
  }
}

customElements.define('page-notifications', PageNotifications);
