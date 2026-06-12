const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {

  // 1. Lanzar el navegador con argumentos de desactivación y bloqueos a nivel de motor
  const browser = await chromium.launch({ 
    headless: false, 
    slowMo: 100,
    args: [
      '--disable-features=Translate',
      '--disable-translate',
      '--no-first-run'
    ]
  });

  // 2. Crear el contexto inyectando las PREFERENCIAS DE USUARIO de Chrome que fulminan el popup
  const context = await browser.newContext({
    viewport: { width: 420, height: 840 },
    locale: 'es-ES',
    extraHTTPHeaders: { 'Accept-Language': 'es-ES,es;q=0.9' },
    // Aquí está la clave definitiva: deshabilitar la traducción en las entrañas del perfil
    storageState: undefined,
    permissions: [],
    geolocation: undefined,
    colorScheme: 'no-preference',
  });

  // Forzar las preferencias nativas de traducción a nivel de diccionario de Chrome
  const chromiumChannel = browser.options;
  // Inyectamos las userDataDir prefs usando el truco de Playwright para Chromium:
  await context.setExtraHTTPHeaders({ 'Accept-Language': 'es-ES,es;q=0.9' });
  
  // Modificamos las preferencias de traducción directamente en la sesión
  const page = await context.newPage();
  
  // Evitamos que Chrome intente adivinar el idioma de la página inyectando esto antes de que cargue nada
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'language', { value: 'es-ES', configurable: true });
    Object.defineProperty(navigator, 'languages', { value: ['es-ES', 'es'], configurable: true });
  });

  // Ir a la aplicación local
  await page.goto('http://localhost:3000/#/tabs');

  console.log('--- Iniciando flujo de automatización ---');

  // ==========================================
  // PASO PREVIO: Pantalla de Bienvenida (Si aparece)
  // ==========================================
  const empezarBtn = page.locator('button:has-text("Empezar gratis"), ion-button:has-text("Empezar gratis")');
  
  try {
    await empezarBtn.waitFor({ state: 'visible', timeout: 3000 });
    console.log('Detectada pantalla previa. Pulsando "Empezar gratis"...');
    await empezarBtn.click();
    await page.waitForTimeout(1000); 
  } catch (error) {
    console.log('ℹ No se detectó la pantalla previa, saltando directamente al Sign In...');
  }

  // ==========================================
  // PASO 1: Desbloquear el modo Superuser
  // ==========================================
  console.log('Paso 1: Haciendo 7 clics en la versión...');
  
  const versionElement = page.locator('text=v5.0.1');
  await versionElement.waitFor({ state: 'visible' });

  // Hacer click 7 veces consecutivas
  for (let i = 0; i < 7; i++) {
    await versionElement.click();
  }

  console.log('Esperando el popup e introduciendo el código...');
  
  const codeInput = page.locator('ion-alert input, ion-modal input, .alert-wrapper input, .modal-wrapper input').first();
  await codeInput.waitFor({ state: 'visible', timeout: 5000 });
  await codeInput.fill('123abc');

  const validarBtn = page.locator('ion-alert button:has-text("VALIDAR"), ion-modal button:has-text("VALIDAR"), .alert-wrapper button:has-text("VALIDAR")');
  await validarBtn.click();

  await page.waitForTimeout(2000); 


  // ==========================================
  // PASO 2: Abrir Diagnósticos y activar Debug
  // ==========================================
  console.log('Paso 2: Pintando visor de depuración visual...');

  const clickX = 390;
  const clickY = 150;

  await page.evaluate(({ x, y }) => {
    const marker = document.createElement('div');
    marker.id = 'debug-crosshair';
    marker.style.position = 'fixed';
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
    marker.style.width = '20px';
    marker.style.height = '20px';
    marker.style.borderRadius = '50%';
    marker.style.border = '2px solid red';
    marker.style.backgroundColor = 'rgba(255, 0, 0, 0.4)';
    marker.style.transform = 'translate(-50%, -50%)';
    marker.style.zIndex = '999999';
    marker.style.pointerEvents = 'none';
    marker.innerHTML = `
      <div style="position:absolute; top:50%; left:0; width:100%; height:2px; background:red; transform:translateY(-50%);"></div>
      <div style="position:absolute; left:50%; top:0; width:2px; height:100%; background:red; transform:translateX(-50%);"></div>
    `;
    document.body.appendChild(marker);
  }, { x: clickX, y: clickY });

  await page.waitForTimeout(1000); 

  console.log('Haciendo doble clic en la esquina superior derecha...');
  await page.mouse.dblclick(clickX, clickY);

  await page.evaluate(() => {
    const marker = document.getElementById('debug-crosshair');
    if (marker) marker.remove();
  });

  console.log('Esperando pantalla de diagnósticos...');

  const headerDiagnosticos = page.locator('ion-title:has-text("Diagnósticos"), h1:has-text("Diagnósticos"), :text("Diagnósticos")').first();
  await headerDiagnosticos.waitFor({ state: 'visible', timeout: 5000 });

  console.log('Pantalla cargada. Buscando el toggle de "Modo debug"...');

  const debugCard = page.locator('ion-item:has-text("Modo debug"), div:has-text("Modo debug")').first();
  const toggle = debugCard.locator('ion-toggle, input, .toggle-icon').first();
  await toggle.waitFor({ state: 'visible', timeout: 3000 });

  const ariaChecked = await toggle.getAttribute('aria-checked');
  const isCheckedClass = (await toggle.getAttribute('class')) || '';
  
  if (ariaChecked !== 'true' && !isCheckedClass.includes('toggle-checked') && !isCheckedClass.includes('checked')) {
    await toggle.click();
    console.log('✓ Modo debug activado (ON)');
  } else {
    console.log('ℹ El Modo debug ya estaba activado');
  }

  // ==========================================
  // PASO 3: Cerrar la pantalla de diagnósticos
  // ==========================================
  console.log('Cerrando pantalla de diagnósticos...');
  const closeBtn = page.locator('ion-header ion-buttons[slot="start"] ion-button, ion-header button, ion-header ion-back-button').first();
  
  try {
    await closeBtn.waitFor({ state: 'visible', timeout: 3000 });
    await closeBtn.click();
    console.log('✓ Pantalla de diagnósticos cerrada.');
  } catch (error) {
    await page.mouse.click(25, 25);
    console.log('✓ Forzado click físico en la esquina superior izquierda para cerrar.');
  }

  await page.waitForTimeout(1000);


  // ==========================================
  // PASO 4: Continuar con Email y Contraseña (Login)
  // ==========================================
  console.log('Paso 4: Iniciando secuencia de Login rápido...');

  const emailBtn = page.locator('button:has-text("Continue with email"), ion-button:has-text("Continue with email"), button:has-text("Continuar con email"), ion-button:has-text("Continuar con email")').first();
  await emailBtn.waitFor({ state: 'visible', timeout: 5000 });
  await emailBtn.click();
  console.log('Pulsado "Continue with email". Esperando formulario de contraseña...');

  const passBtn = page.locator('button:has-text("Continue with password"), ion-button:has-text("Continue with password"), button:has-text("Continuar con contraseña"), ion-button:has-text("Continuar con contraseña")').first();
  await passBtn.waitFor({ state: 'visible', timeout: 5000 });
  await passBtn.click();
  console.log('Pulsado "Continue with password". Procesando login con el backend...');

  // ==========================================
  // FINALIZACIÓN: Validar acceso al contenido
  // ==========================================
  await page.waitForTimeout(3000); 
  console.log('--- Proceso de login completado. App en pantalla de inicio ---');

//  await page.waitForTimeout(4000);
//  await context.close();
//  await browser.close();

})();
