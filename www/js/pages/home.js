class PageHome extends HTMLElement {
  connectedCallback() {
    this.classList.add('ion-page');
    this.innerHTML = `
      <ion-header translucent="true">
        <ion-toolbar>
          <ion-title class="secret-title">Home</ion-title>
          <ion-buttons slot="end">
            <ion-button fill="clear">
              <ion-icon slot="icon-only" name="notifications-outline"></ion-icon>
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content fullscreen class="secret-content">
        <div class="page-shell">
          <div class="banner">
            <div>
              <h4>Tema elegido: Trabajo</h4>
              <p>Tu nivel: Inicial · Idioma: Inglés</p>
            </div>
            <ion-button size="small" fill="outline">
              <ion-icon slot="icon-only" name="add-outline"></ion-icon>
            </ion-button>
          </div>

          <div class="avatar-block">
            <div class="avatar"></div>
          </div>

          <div class="message-card">
            <p class="muted">Hello, **</p>
            <p>Let's improve your pronunciation!</p>
            <p>Let's go!</p>
            <div class="carousel-dots">
              <span class="active"></span>
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </ion-content>
    `;
  }
}

customElements.define('page-home', PageHome);
