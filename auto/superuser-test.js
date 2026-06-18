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

  // ==========================================
  // PASO 5: Navegar a sesiones del tab Training
  // ==========================================

  // Color a asignar a cada palabra en el paso de spelling.
  // Valores posibles: 'rojo' | 'amarillo' | 'verde' | 'azul'
  //   rojo     → tone bad   (0%)
  //   amarillo → tone okay  (~50%)
  //   verde    → tone good  (100%)
  //   azul     → reset      (quita el score)
  const colorPalabras = 'rojo';

  const colorToTone = { rojo: 'bad', amarillo: 'okay', verde: 'good', azul: 'reset' };

  // Lista de sesiones a abrir: ruta → módulo → sesión
  const sesiones = [
    { routeId: 'route1', moduleId: 'module-1',  sessionId: 'session-1'  },
    { routeId: 'route1', moduleId: 'module-1',  sessionId: 'session-2'  },
    { routeId: 'route1', moduleId: 'module-1',  sessionId: 'session-3'  },
    { routeId: 'route1', moduleId: 'module-1',  sessionId: 'session-4'  },
    { routeId: 'route1', moduleId: 'module-2',  sessionId: 'session-5'  },
    { routeId: 'route1', moduleId: 'module-2',  sessionId: 'session-6'  },
    { routeId: 'route1', moduleId: 'module-2',  sessionId: 'session-7'  },
    { routeId: 'route1', moduleId: 'module-2',  sessionId: 'session-8'  },
    { routeId: 'route1', moduleId: 'module-3',  sessionId: 'session-9'  },
    { routeId: 'route1', moduleId: 'module-3',  sessionId: 'session-10' },
    { routeId: 'route1', moduleId: 'module-3',  sessionId: 'session-11' },
    { routeId: 'route1', moduleId: 'module-3',  sessionId: 'session-12' },
    { routeId: 'route1', moduleId: 'module-4',  sessionId: 'session-13' },
    { routeId: 'route1', moduleId: 'module-4',  sessionId: 'session-14' },
    { routeId: 'route1', moduleId: 'module-4',  sessionId: 'session-15' },
    { routeId: 'route1', moduleId: 'module-4',  sessionId: 'session-16' },
    { routeId: 'route2', moduleId: 'module-5',  sessionId: 'session-17' },
    { routeId: 'route2', moduleId: 'module-5',  sessionId: 'session-18' },
    { routeId: 'route2', moduleId: 'module-5',  sessionId: 'session-19' },
    { routeId: 'route2', moduleId: 'module-5',  sessionId: 'session-20' },
    { routeId: 'route2', moduleId: 'module-6',  sessionId: 'session-21' },
    { routeId: 'route2', moduleId: 'module-6',  sessionId: 'session-22' },
    { routeId: 'route2', moduleId: 'module-6',  sessionId: 'session-23' },
    { routeId: 'route2', moduleId: 'module-6',  sessionId: 'session-24' },
    { routeId: 'route2', moduleId: 'module-7',  sessionId: 'session-25' },
    { routeId: 'route2', moduleId: 'module-7',  sessionId: 'session-26' },
    { routeId: 'route2', moduleId: 'module-7',  sessionId: 'session-27' },
    { routeId: 'route2', moduleId: 'module-7',  sessionId: 'session-28' },
    { routeId: 'route2', moduleId: 'module-8',  sessionId: 'session-29' },
    { routeId: 'route2', moduleId: 'module-8',  sessionId: 'session-30' },
    { routeId: 'route2', moduleId: 'module-8',  sessionId: 'session-31' },
    { routeId: 'route2', moduleId: 'module-8',  sessionId: 'session-32' },
    { routeId: 'route3', moduleId: 'module-9',  sessionId: 'session-33' },
    { routeId: 'route3', moduleId: 'module-9',  sessionId: 'session-34' },
    { routeId: 'route3', moduleId: 'module-9',  sessionId: 'session-35' },
    { routeId: 'route3', moduleId: 'module-9',  sessionId: 'session-36' },
    { routeId: 'route3', moduleId: 'module-10', sessionId: 'session-37' },
    { routeId: 'route3', moduleId: 'module-10', sessionId: 'session-38' },
    { routeId: 'route3', moduleId: 'module-10', sessionId: 'session-39' },
    { routeId: 'route3', moduleId: 'module-11', sessionId: 'session-40' },
    { routeId: 'route3', moduleId: 'module-11', sessionId: 'session-41' },
    { routeId: 'route3', moduleId: 'module-11', sessionId: 'session-42' },
    { routeId: 'route3', moduleId: 'module-11', sessionId: 'session-43' },
    { routeId: 'route3', moduleId: 'module-12', sessionId: 'session-44' },
    { routeId: 'route3', moduleId: 'module-12', sessionId: 'session-45' },
    { routeId: 'route3', moduleId: 'module-12', sessionId: 'session-46' },
    { routeId: 'route3', moduleId: 'module-12', sessionId: 'session-47' },
  ];

  console.log('Paso 5: Cambiando al tab Training...');
  const trainingTab = page.locator('ion-tab-button[tab="home"]');
  await trainingTab.waitFor({ state: 'visible', timeout: 5000 });
  await trainingTab.click();
  await page.waitForTimeout(1000);

  for (const { routeId, moduleId, sessionId } of sesiones) {
    console.log(`\nAbriendo ruta="${routeId}" módulo="${moduleId}" sesión="${sessionId}"...`);

    // -- Abrir la ruta si no está ya expandida --
    const routeHeader = page.locator(`button.route-header[data-route-id="${routeId}"]`);
    await routeHeader.waitFor({ state: 'visible', timeout: 5000 });

    const routeIsOpen = await page.evaluate((rId) => {
      const btn = document.querySelector(`button.route-header[data-route-id="${rId}"]`);
      return btn ? btn.closest('.route-item')?.classList.contains('is-open') : false;
    }, routeId);

    if (!routeIsOpen) {
      console.log(`  Expandiendo ruta "${routeId}"...`);
      await routeHeader.click();
      await page.waitForTimeout(500);
    } else {
      console.log(`  Ruta "${routeId}" ya estaba expandida.`);
    }

    // -- Abrir el módulo si no está ya expandido --
    const moduleHeader = page.locator(`button.module-header[data-route-id="${routeId}"][data-module-id="${moduleId}"]`);
    await moduleHeader.waitFor({ state: 'visible', timeout: 5000 });

    const moduleIsOpen = await page.evaluate(({ rId, mId }) => {
      const btn = document.querySelector(`button.module-header[data-route-id="${rId}"][data-module-id="${mId}"]`);
      return btn ? btn.closest('.module-item')?.classList.contains('is-open') : false;
    }, { rId: routeId, mId: moduleId });

    if (!moduleIsOpen) {
      console.log(`  Expandiendo módulo "${moduleId}"...`);
      await moduleHeader.click();
      await page.waitForTimeout(500);
    } else {
      console.log(`  Módulo "${moduleId}" ya estaba expandido.`);
    }

    // -- Hacer click en la sesión --
    const sessionRow = page.locator(`.training-row[data-route-id="${routeId}"][data-module-id="${moduleId}"][data-session-id="${sessionId}"]`);
    await sessionRow.waitFor({ state: 'visible', timeout: 5000 });
    console.log(`  Abriendo sesión "${sessionId}"...`);
    await sessionRow.click();
    await page.waitForTimeout(2500);

    console.log(`  ✓ Sesión abierta.`);

    // -- Activar panel debug dentro de la sesión (solo si no está ya abierto) --
    console.log('  Verificando panel debug de la sesión...');
    const debugToggle = page.locator('#speak-debug-toggle');
    await debugToggle.waitFor({ state: 'visible', timeout: 8000 });

    const debugAlreadyOpen = await page.locator('#speak-debug-next').isVisible();
    if (!debugAlreadyOpen) {
      console.log('  Abriendo panel debug...');
      await debugToggle.click();
      await page.waitForTimeout(1000);
    } else {
      console.log('  Panel debug ya estaba abierto.');
    }

    // -- Ir al paso 2 (spelling) con el botón '>' del panel debug --
    console.log('  Navegando al paso 2 (spelling)...');
    const nextInline = page.locator('#speak-debug-next');
    await nextInline.waitFor({ state: 'visible', timeout: 8000 });
    await nextInline.click();
    await page.waitForTimeout(1200);

    // -- Leer las palabras disponibles en el paso de spelling --
    const words = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.speak-word[data-word]'))
        .map(btn => btn.dataset.word)
        .filter(Boolean)
    );
    console.log(`  Palabras encontradas: ${words.join(', ')}`);

    const tone = colorToTone[colorPalabras] || 'good';

    for (const word of words) {
      console.log(`  Asignando "${colorPalabras}" (${tone}) a "${word}"...`);

      // Seleccionar la palabra
      const wordBtn = page.locator(`.speak-word[data-word="${word}"]`);
      await wordBtn.waitFor({ state: 'visible', timeout: 3000 });
      await wordBtn.click();
      await page.waitForTimeout(400);

      // Pulsar el botón de color en el panel debug
      const toneBtn = page.locator(`.speak-debug-tone[data-tone="${tone}"]`);
      await toneBtn.waitFor({ state: 'visible', timeout: 3000 });
      await toneBtn.click();
      await page.waitForTimeout(400);
    }

    console.log(`  ✓ Colores asignados a todas las palabras.`);

    // -- Ir al paso 3 (sentence) --
    console.log('  Navegando al paso 3 (sentence)...');
    await page.locator('#speak-debug-next').click();
    await page.waitForTimeout(800);

    // -- Asignar color a la frase (sentence) --
    console.log(`  Asignando "${colorPalabras}" (${tone}) a la frase...`);
    const sentenceToneBtn = page.locator(`.speak-debug-tone[data-tone="${tone}"]`);
    await sentenceToneBtn.waitFor({ state: 'visible', timeout: 3000 });
    await sentenceToneBtn.click();
    await page.waitForTimeout(400);

    // -- Ir a la pantalla de resultado --
    console.log('  Navegando a la pantalla de resultado...');
    await page.locator('#speak-debug-next').click();
    await page.waitForTimeout(1000);

    // -- Pulsar Continue en el resultado --
    console.log('  Pulsando Continue...');
    const continueBtn = page.locator('#speak-next-step');
    await continueBtn.waitFor({ state: 'visible', timeout: 5000 });
    await continueBtn.click();
    await page.waitForTimeout(1000);

    console.log(`  ✓ Sesión completada.`);
  }

  console.log('\n--- Flujo completado ---');

//  await page.waitForTimeout(4000);
//  await context.close();
//  await browser.close();

})();
