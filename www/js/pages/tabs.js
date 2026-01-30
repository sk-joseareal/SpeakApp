class TabsPage extends HTMLElement {
  connectedCallback() {
    this.classList.add('ion-page');
    this.innerHTML = `
      <ion-tabs no-router>
        <ion-tab tab="home">
          <page-home></page-home>
        </ion-tab>
        <ion-tab tab="listas">
          <page-listas></page-listas>
        </ion-tab>
        <ion-tab tab="speak">
          <page-speak></page-speak>
        </ion-tab>
        <ion-tab tab="tu">
          <page-profile></page-profile>
        </ion-tab>
        <ion-tab tab="premium">
          <page-premium></page-premium>
        </ion-tab>
        <ion-tab-bar slot="bottom" class="app-tab-bar">
          <ion-tab-button tab="home">
            <ion-icon name="home-outline"></ion-icon>
            <ion-label>Home</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="listas">
            <ion-icon name="list-outline"></ion-icon>
            <ion-label>Listas</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="speak">
            <ion-icon name="mic-outline"></ion-icon>
            <ion-label>Speak</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="tu">
            <ion-icon name="person-circle-outline"></ion-icon>
            <ion-label>Tu</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="premium">
            <ion-icon name="sparkles-outline"></ion-icon>
            <ion-label>Premium</ion-label>
          </ion-tab-button>
        </ion-tab-bar>
      </ion-tabs>
    `;
  }
}

customElements.define('tabs-page', TabsPage);
