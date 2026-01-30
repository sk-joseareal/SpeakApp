class PageProfile extends HTMLElement {
  connectedCallback() {
    this.classList.add('ion-page');
    this.innerHTML = `
      <ion-header translucent="true">
        <ion-toolbar>
          <ion-title>Tu</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content fullscreen>
        <div class="page-shell">
          <div class="card placeholder-card">
            <div class="pill">Placeholder</div>
            <h3>Perfil basico</h3>
            <p>Espacio para datos de usuario, progreso y ajustes rapidos.</p>
            <ion-button expand="block" fill="outline" shape="round">Conectar cuenta</ion-button>
          </div>
        </div>
      </ion-content>
    `;
  }
}

customElements.define('page-profile', PageProfile);
