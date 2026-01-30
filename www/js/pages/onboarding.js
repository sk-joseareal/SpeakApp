import { onboardingDone, setOnboardingDone } from '../state.js';
import { goToHome } from '../nav.js';

const onboardingSlides = [
  {
    id: 'intro',
    title: 'Welcome SPEAK English',
    subtitle: 'Mejora tu pronunciación',
    actions: ['Sign in', 'Register']
  },
  {
    id: 'level',
    title: 'Welcome SPEAK English',
    subtitle: '¿Cuál es tu nivel de inglés?',
    hint: 'Personalizaremos la experiencia a tu medida',
    options: [
      { label: 'Soy un principiante', code: 'A' },
      { label: 'Entiendo frases simples', code: 'B' },
      { label: 'Puedo mantener conversaciones', code: 'C' },
      { label: 'Hablo con fluidez', code: 'E' }
    ]
  },
  {
    id: 'topics',
    title: 'Welcome SPEAK English',
    subtitle: 'Elige un tema para empezar',
    hint: 'Podrás cambiarlo más adelante',
    topics: [
      { label: 'Viajar', icon: 'airplane-outline' },
      { label: 'Restaurante', icon: 'restaurant-outline' },
      { label: 'Cine', icon: 'film-outline' },
      { label: 'Salud', icon: 'medkit-outline' },
      { label: 'Compras', icon: 'cart-outline' },
      { label: 'Spa', icon: 'leaf-outline' },
      { label: 'Bancos', icon: 'card-outline' },
      { label: 'Cafés', icon: 'cafe-outline' },
      { label: 'Otro', icon: 'ellipsis-horizontal' }
    ]
  },
  {
    id: 'profile',
    title: 'Welcome SPEAK English',
    subtitle: 'Dinos algo sobre ti',
    hint: 'Edad · Franja · Nacionalidad'
  }
];

class PageOnboarding extends HTMLElement {
  constructor() {
    super();
    this.currentStep = 0;
    this.state = {
      level: null,
      topic: null
    };
  }

  connectedCallback() {
    this.classList.add('ion-page');
    this.render();
    this.cacheElements();
    this.bindEvents();
    this.updateSlide();
  }

  render() {
    this.innerHTML = `
      <ion-content fullscreen>
        <div class="onboarding-shell">
          <div class="onboarding-top">
            <div class="pill brand-pill">SPEAK English</div>
            <button class="ghost-btn" data-action="skip">Saltar</button>
          </div>
          <div class="onboarding-body" data-field="body"></div>
          <div class="onboarding-progress">
            <span class="dot" data-step-dot="0"></span>
            <span class="dot" data-step-dot="1"></span>
            <span class="dot" data-step-dot="2"></span>
            <span class="dot" data-step-dot="3"></span>
          </div>
          <div class="onboarding-actions">
            <ion-button expand="block" shape="round" size="large" data-action="next">
              Siguiente
            </ion-button>
          </div>
        </div>
      </ion-content>
    `;
  }

  cacheElements() {
    this.bodyEl = this.querySelector('[data-field="body"]');
    this.dots = Array.from(this.querySelectorAll('[data-step-dot]'));
    this.nextBtn = this.querySelector('[data-action="next"]');
    this.skipBtn = this.querySelector('[data-action="skip"]');
  }

  bindEvents() {
    this.nextBtn.addEventListener('click', () => {
      if (this.currentStep < onboardingSlides.length - 1) {
        this.currentStep += 1;
        this.updateSlide();
        return;
      }
      this.finish();
    });

    this.skipBtn.addEventListener('click', () => this.finish());
  }

  updateSlide() {
    const step = onboardingSlides[this.currentStep];
    this.bodyEl.innerHTML = this.renderBody(step);
    this.bindDynamicEvents(step);
    this.dots.forEach((dot, index) => dot.classList.toggle('active', index === this.currentStep));
    this.nextBtn.textContent = this.currentStep === onboardingSlides.length - 1 ? 'Empecemos' : 'Siguiente';
  }

  finish() {
    setOnboardingDone();
    goToHome('root');
  }

  renderBody(step) {
    if (step.id === 'intro') {
      return `
        <div class="onboarding-heading">
          <h1>${step.title}</h1>
          <h2>${step.subtitle}</h2>
        </div>
        <p class="onboarding-subtitle">Regístrate para empezar</p>
        <div class="cta-row">
          <ion-button expand="block" fill="outline">${step.actions[0]}</ion-button>
          <ion-button expand="block">${step.actions[1]}</ion-button>
        </div>
      `;
    }

    if (step.id === 'level') {
      const optionsMarkup = step.options
        .map(
          (opt) => `
            <div class="level-option" data-level="${opt.code}">
              <div>${opt.label}</div>
              <div class="badge">${opt.code}</div>
            </div>
          `
        )
        .join('');
      return `
        <div class="onboarding-heading">
          <h1>${step.title}</h1>
          <h2>${step.subtitle}</h2>
        </div>
        <p class="onboarding-subtitle">${step.hint}</p>
        <div class="level-options" data-list="levels">
          ${optionsMarkup}
        </div>
      `;
    }

    if (step.id === 'topics') {
      const topicMarkup = step.topics
        .map(
          (topic) => `
            <div class="topic-card" data-topic="${topic.label}">
              <ion-icon name="${topic.icon}"></ion-icon>
              <div>${topic.label}</div>
            </div>
          `
        )
        .join('');
      return `
        <div class="onboarding-heading">
          <h1>${step.title}</h1>
          <h2>${step.subtitle}</h2>
        </div>
        <p class="onboarding-subtitle">${step.hint}</p>
        <div class="topic-grid" data-list="topics">
          ${topicMarkup}
        </div>
      `;
    }

    return `
      <div class="onboarding-heading">
        <h1>${step.title}</h1>
        <h2>${step.subtitle}</h2>
      </div>
      <p class="onboarding-subtitle">${step.hint}</p>
      <div class="profile-bubbles">
        <div class="profile-bubble">Edad</div>
        <div class="profile-bubble">Franja</div>
        <div class="profile-bubble">Nacionalidad</div>
      </div>
      <ion-button expand="block" shape="round" color="primary" data-profile-start>Empecemos</ion-button>
    `;
  }

  bindDynamicEvents(step) {
    if (step.id === 'level') {
      const levelEls = Array.from(this.querySelectorAll('.level-option'));
      levelEls.forEach((el) => {
        el.addEventListener('click', () => {
          levelEls.forEach((item) => item.setAttribute('data-selected', 'false'));
          el.setAttribute('data-selected', 'true');
          this.state.level = el.dataset.level;
        });
      });
    }

    if (step.id === 'topics') {
      const topicEls = Array.from(this.querySelectorAll('.topic-card'));
      topicEls.forEach((el) => {
        el.addEventListener('click', () => {
          topicEls.forEach((item) => item.setAttribute('data-selected', 'false'));
          el.setAttribute('data-selected', 'true');
          this.state.topic = el.dataset.topic;
        });
      });
    }

    if (step.id === 'profile') {
      const startBtn = this.querySelector('[data-profile-start]');
      if (startBtn) {
        startBtn.addEventListener('click', () => this.finish());
      }
    }
  }
}

customElements.define('page-onboarding', PageOnboarding);
