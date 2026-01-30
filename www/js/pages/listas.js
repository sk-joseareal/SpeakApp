class PageListas extends HTMLElement {
  connectedCallback() {
    this.classList.add('ion-page');
    this.innerHTML = `
      <ion-header translucent="true">
        <ion-toolbar>
          <ion-title>Listas</ion-title>
          <ion-buttons slot="end">
            <ion-button fill="outline" size="small">
              <ion-icon slot="start" name="add-outline"></ion-icon>
              Nueva
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content fullscreen>
        <div class="list-filters">
          <span class="filter-chip active">Viajar</span>
          <span class="filter-chip">Business</span>
          <span class="filter-chip">Diarios</span>
        </div>
        <div class="list-card">
          <div class="thumb">A</div>
          <div>
            <h4>Inglés</h4>
            <p>1182 cartas</p>
          </div>
          <ion-button fill="outline" size="small">Repetir</ion-button>
        </div>
        <div class="list-card">
          <div class="thumb">A</div>
          <div>
            <h4>4350 palabras inglés</h4>
            <p>4350 cartas</p>
          </div>
          <ion-button fill="outline" size="small">Repetir</ion-button>
        </div>
        <div class="list-card">
          <div class="thumb">A</div>
          <div>
            <h4>Inglés 2</h4>
            <p>510 cartas</p>
          </div>
          <ion-button fill="outline" size="small">Speak</ion-button>
        </div>
        <div class="list-card">
          <div class="thumb">A</div>
          <div>
            <h4>500 palabras en inglés</h4>
            <p>502 cartas</p>
          </div>
          <ion-button fill="outline" size="small">Speak</ion-button>
        </div>
        <div class="list-card">
          <div class="thumb">A</div>
          <div>
            <h4>550+ Phrasal verbs</h4>
            <p>3745 cartas</p>
          </div>
          <ion-button fill="outline" size="small">Speak</ion-button>
        </div>
      </ion-content>
    `;
  }
}

customElements.define('page-listas', PageListas);
