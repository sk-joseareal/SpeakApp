class PageSpeak extends HTMLElement {
  connectedCallback() {
    this.classList.add('ion-page');
    this.innerHTML = `
      <ion-header translucent="true">
        <ion-toolbar>
          <ion-title>Speak</ion-title>
          <ion-buttons slot="end">
            <ion-button fill="clear">
              <ion-icon slot="icon-only" name="settings-outline"></ion-icon>
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content fullscreen>
        <div class="page-shell">
          <div class="banner">
            <div>
              <h4>Tema actual: Trabajo</h4>
              <p>Tu nivel: Inicial · Idioma: Inglés</p>
            </div>
            <ion-button size="small" fill="clear">
              <ion-icon slot="icon-only" name="ellipsis-horizontal-outline"></ion-icon>
            </ion-button>
          </div>

          <div class="avatar-block">
            <div class="avatar"></div>
          </div>

          <div class="word-card">
            <div class="score-row">
              <div class="pill">1 / 1</div>
              <ion-icon name="settings-outline"></ion-icon>
            </div>
            <div class="word-title">
              <span>confidence</span>
              <ion-icon name="flag-outline"></ion-icon>
            </div>
            <p class="muted">/ˈkɒn.fɪ.dəns/ · 55% match</p>
            <div class="chip-row">
              <span class="chip">Escuchar</span>
              <span class="chip">Repetir</span>
              <span class="chip">Feedback</span>
            </div>
            <div class="score-row">
              <ion-button expand="block" fill="outline">Listen</ion-button>
              <ion-button expand="block" style="margin-left:8px;">Say the word</ion-button>
            </div>
          </div>
        </div>
      </ion-content>
    `;
  }
}

customElements.define('page-speak', PageSpeak);
