
// Marcar carga de helpers
console.log(">#C00#> 006.001 _r34lp0w3r_.js >>>");



// Refuerzo temprano: superponer WebView en Android para evitar doble padding en headers
(function ensureStatusBarOverlayEarly() {
  try {
    const c = window.Capacitor;
    const sb = c?.Plugins?.StatusBar;
    if (c && typeof c.getPlatform === 'function' && c.getPlatform() === 'android' && sb) {
      sb.setOverlaysWebView({ overlay: true });
      try {
        document.documentElement.style.setProperty('--ion-safe-area-top', '0px');
        document.documentElement.style.setProperty('--ion-statusbar-padding', '0px');
      } catch (err) {
        console.log('>#[SB] early css var error', err);
      }
    }
  } catch (e) {
    console.log('>#[SB] early overlay error', e);
  }
})();

// Sustituto para el plugin cordova-plugin-media
window.Media = function(src, successCallback, errorCallback, statusCallback) {
  const audio = new Audio(src);
  audio.preload = 'auto';

  let timer = null;
  let isPlaying = false;

  const self = this;

  // Métodos Cordova-like
  this.play = function() {
    audio.play().then(() => {
      isPlaying = true;
      successCallback && successCallback();
      statusCallback && statusCallback(Media.MEDIA_RUNNING);
      startTimer();
    }).catch(err => {
      errorCallback && errorCallback(err);
      statusCallback && statusCallback(Media.MEDIA_ERROR);
    });
  };

  this.pause = function() {
    audio.pause();
    isPlaying = false;
    statusCallback && statusCallback(Media.MEDIA_PAUSED);
  };

  this.stop = function() {
    audio.pause();
    audio.currentTime = 0;
    isPlaying = false;
    stopTimer();
    statusCallback && statusCallback(Media.MEDIA_STOPPED);
  };

  this.seekTo = function(ms) {
    audio.currentTime = ms / 1000;
  };

  this.getDuration = function() {
    return audio.duration * 1000; // en ms
  };

  this.getCurrentPosition = function(success, error) {
    if (isNaN(audio.currentTime)) {
      error && error("Position not available");
    } else {
      success && success(audio.currentTime * 1000); // en ms
    }
  };

  this.setVolume = function(vol) {
    audio.volume = vol;
  };

  this.release = function() {
    stopTimer();
    audio.src = '';
  };

  function startTimer() {
    stopTimer();
    timer = setInterval(() => {
      statusCallback && statusCallback(Media.MEDIA_RUNNING);
    }, 1000);
  }

  function stopTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  // Eventos internos
  audio.addEventListener('ended', () => {
    isPlaying = false;
    stopTimer();
    statusCallback && statusCallback(Media.MEDIA_STOPPED);
    successCallback && successCallback();
  });

  audio.addEventListener('error', (e) => {
    errorCallback && errorCallback(e);
    statusCallback && statusCallback(Media.MEDIA_ERROR);
  });
};

// Constantes de estado como en Cordova
window.Media.MEDIA_NONE = 0;
window.Media.MEDIA_STARTING = 1;
window.Media.MEDIA_RUNNING = 2;
window.Media.MEDIA_PAUSED = 3;
window.Media.MEDIA_STOPPED = 4;
window.Media.MEDIA_ERROR = 9;




/// -----------------------------------------------------------------------------------

Rlog = function(miString) {
  let div = document.getElementById('r34lp0w3r-log');
  if (!div) return;

  if (typeof miString === 'undefined') {
    div.innerText = '';
  } else {
    console.log(miString);
    div.innerText += (div.innerText ? '\n' : '') + miString;
  }
}

async function r34lp0w3r_eval(comando) {
  const logs = [];
  const originalLog = console.log;

  console.log = function() {
    var args = Array.prototype.slice.call(arguments);
    logs.push(args.map(function(a) {
      return (typeof a === 'object') ? JSON.stringify(a, null, 2) : String(a);
    }).join(' '));
    originalLog.apply(console, args);
  };

  function wrapCodigoUsuario(codigo) {
    const lines = codigo.trim().split('\n');
    const ultima = lines[lines.length - 1].trim();
    const puedeSerExpression = !/^\s*(let|const|var|if|for|while|function|class|return|\{|\})\b/.test(ultima);

    if (puedeSerExpression) {
      lines[lines.length - 1] = 'return ' + ultima + ';';
    }

    return lines.join('\n');
  }

  try {
    var wrapped = wrapCodigoUsuario(comando);

    var fn = new Function(`
      "use strict";
      return (async () => {
        ${wrapped}
      })();
    `);

    var result = await fn();

    var output = '';
    if (logs.length > 0) output += logs.join('\n') + '\n';

    if (typeof result !== 'undefined') {
      output += (typeof result === 'object')
        ? JSON.stringify(result, null, 2)
        : String(result);
    }
    return output.trim();

  } catch (e) {
    return "❌ Error: " + e.message;
  } finally {
    console.log = originalLog;
  }
}

async function r34lp0w3r_eval_old(comando) {
  const logs = [];
  const originalLog = console.log;

  console.log = function() {
    var args = Array.prototype.slice.call(arguments);
    logs.push(args.map(function(a) {
      return (typeof a === 'object') ? JSON.stringify(a, null, 2) : String(a);
    }).join(' '));
    originalLog.apply(console, args);
  };

  function wrapCodigoUsuario(codigo) {
    const lines = codigo.trim().split('\n');
    const ultima = lines[lines.length - 1].trim();
    const puedeSerExpression = !/^\s*(let|const|var|if|for|while|function|class|return|\{|\})\b/.test(ultima);

    if (puedeSerExpression) {
      lines[lines.length - 1] = 'return ' + ultima + ';';
    }

    return lines.join('\n');
  }

  try {
    var wrapped = wrapCodigoUsuario(comando);

    var fn = new Function('"use strict";\n' + wrapped);

    var result = fn();

    var output = '';
    if (logs.length > 0) output += logs.join('\n') + '\n';

    if (typeof result !== 'undefined') {
      output += (typeof result === 'object')
        ? JSON.stringify(result, null, 2)
        : String(result);
    }
    return output.trim();

  } catch (e) {
    return "❌ Error: " + e.message;
  } finally {
    console.log = originalLog;
  }
}
window.r34lp0w3r_eval=r34lp0w3r_eval

async function doR34lp0wer_eval() {
  const input = document.getElementById('r34lp0w3r-input').value;
  Rlog()
  try {
    const result = await r34lp0w3r_eval(input);
    Rlog(result);
  } catch (err) {
    Rlog('❌ Error: ' + err.message);
  }
}

function mostrarR34lp0w3r() {
  Rlog()
  Rlog(">#C00#> mostrarR34lp0w3r.")
  let texto
  if (window.r34lp0w3r) {
    texto = `<pre id="r34lp0w3r-json" style="color:#ff0000; text-align:left; margin: 20px auto; max-width: 500px; background:rgba(0,0,0,0.05); border-radius: 4px; padding: 12px;">${JSON.stringify(window.r34lp0w3r, null, 2)}</pre>`;
    Rlog(">#C00#> window.r34lp0w3r:",JSON.stringify(window.r34lp0w3r))
  } else {
    texto = "No se detectó window.r34lp0w3r."
    Rlog(">#C00#> No se detectó window.r34lp0w3r.")
  }
}

/// -----------------------------------------------------------------------------------

/// ----------------------------------------------------------------------------------- Plugin StatusBar

function setStatusBarBlue() { 
  console.log(">#C00.02#> setStatusBarBlue().");
  console.log(">#C00.02#> window.Capacitor.Plugins.StatusBar.setBackgroundColor({ color: '#043c5d' })");
  window.Capacitor.Plugins.StatusBar.setBackgroundColor({ color: '#043c5d' });
}
function setStatusBarTransparent() {
  console.log(">#C00.02#> setStatusBarTransparent().");
  console.log(">#C00.02#> window.Capacitor.Plugins.StatusBar.setBackgroundColor({ color: '#00000000'})");
  window.Capacitor.Plugins.StatusBar.setBackgroundColor({ color: '#00000000' });
  
}
function setStatusBarOverlayOn() {
  console.log(">#C00.02#> setStausBarOverlayOn().");
  console.log(">#C00.02#> window.Capacitor.Plugins.StatusBar.setOverlaysWebView({ overlay: true }).");
  window.Capacitor.Plugins.StatusBar.setOverlaysWebView({ overlay: true });
}
function setStatusBarOverlayOff() {
  console.log(">#C00.02#> setStausBarOverlayOff().");
  console.log(">#C00.02#> window.Capacitor.Plugins.StatusBar.setOverlaysWebView({ overlay: false }).");
  window.Capacitor.Plugins.StatusBar.setOverlaysWebView({ overlay: false });
}
function setStatusBarLight() {
  console.log(">#C00.02#> setStatusBarLight().");
  // Establece el modo claro (texto oscuro sobre fondo claro)
  console.log(">#C00.02#> window.Capacitor.Plugins.StatusBar.setStyle({ style: 'LIGHT' })");
  window.Capacitor.Plugins.StatusBar.setStyle({ style: 'LIGHT' });
}
function setStatusBarDark() {
  console.log(">#C00.02#> setStatusBarDark().");
  // Establece el modo oscuro (texto claro sobre fondo oscuro)
  console.log(">#C00.02#> window.Capacitor.Plugins.StatusBar.setStyle({ style: 'DARK' })");
  window.Capacitor.Plugins.StatusBar.setStyle({ style: 'DARK' });
}
function setStatusBarHide() {
  console.log(">#C00.02#> setStatusBarHide().");
  // Oculta la status bar
  console.log(">#C00.02#> window.Capacitor.Plugins.StatusBar.hide()");
  window.Capacitor.Plugins.StatusBar.hide();
}
function setStatusBarShow() {
  console.log(">#C00.02#> setStatusBarShow().");
  // Muestra la status bar
  console.log(">#C00.02#> window.Capacitor.Plugins.StatusBar.show()");
  window.Capacitor.Plugins.StatusBar.show();
}
function arreglaStatusBar() {
  console.log(">#C00.02#> arreglaStatusBar().");
  if ( !window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.StatusBar )
    console.log(">#C00.02#> arreglaStatusBar(): Falta el plugin Status Bar.");
  else      
  {
  //  console.log(">#C00.02#> window.Capacitor.Plugins.StatusBar.setBackgroundColor({ color: '#043c5d' })");
  //  window.Capacitor.Plugins.StatusBar.setBackgroundColor({ color: '#043c5d' }); 
    console.log(">#C00.02#> window.Capacitor.Plugins.StatusBar.setStyle(set{ style: 'DARK' })");
    window.Capacitor.Plugins.StatusBar.setStyle({ style: 'LIGHT' });
  }
}

/// ----------------------------------------------------------------------------------- Logins Sociales

// Guardar el proveedor activo
let currentProvider = null;

const dispatchLoginEvent = (type, detail) => {
  try {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  } catch (err) {
    console.log('>#C02#> loginSocial: error disparando evento', type, err);
  }
};

const notifyLoginError = (error, message) => {
  const detail = {
    provider: currentProvider || '',
    error: error || '',
    message: message || error || ''
  };
  dispatchLoginEvent('app:login-error', detail);
};

const notifyLoginSuccess = (user) => {
  dispatchLoginEvent('app:login-success', {
    provider: currentProvider || '',
    user
  });
};

function procesarLoginDesdeCallback(url) {
  try {
    Rlog()
    Rlog(">#C02#> loginSocial: procesarLoginDesdeCallback, >>> URL: " + url);
    const parsed = new URL(url);
    const params = parsed.searchParams;
    if (params.get('error')) {
      const error = params.get('error');
      Rlog('>#C02#> loginSocial: Error recibido en callback: ' + error);
      notifyLoginError(error, error === 'datos_incompletos' ? 'Información incompleta.' : error);
      return;
    }
    Rlog('>#C02#> loginSocial: procesarLoginDesdeCallback: >>> LOGIN OK.');
    // for (const [key, value] of params) {
    //   Rlog('>#C02#> loginSocial: procesarLoginDesdeCallback: >>> ' + key + " : " + value);
    // }
    const loginDataRaw = params.get('loginData');
    if (!loginDataRaw) {
      notifyLoginError('missing_login_data', 'Login sin datos.');
      return;
    }
    let loginData = null;
    try {
      loginData = JSON.parse(loginDataRaw);
    } catch (err) {
      notifyLoginError('invalid_login_data', 'Login inválido.');
      return;
    }
    Rlog('>#C02#> loginSocial: procesarLoginDesdeCallback: >>> loginData:' + JSON.stringify(loginData));
    const user = loginData && loginData.user ? { ...loginData.user } : null;
    if (!user) {
      notifyLoginError('missing_user', 'Login sin usuario.');
      return;
    }

    if (!user.image) {
      if (user.avatar_file_name) {
        user.image = `https://s3.amazonaws.com/sk.audios.dev/avatars/${user.id}/original/${user.avatar_file_name}`;
      } else {
        user.image = 'https://s3.amazonaws.com/sk.CursoIngles/no-avatar.gif';
      }
    }

    if (typeof window.setUser === 'function') {
      window.setUser(user);
    } else {
      window.user = user;
      try {
        localStorage.setItem('appv5:user', JSON.stringify(user));
      } catch (err) {
        console.error('[user] error guardando localStorage', err);
      }
      try {
        window.dispatchEvent(new CustomEvent('app:user-change', { detail: user }));
      } catch (err) {
        console.error('[user] error notificando cambio', err);
      }
    }

    if (typeof refreshUserAvatarLocal === 'function') {
      refreshUserAvatarLocal(user);
    }
    notifyLoginSuccess(user);
  } catch (err) {
    Rlog('>#C02#> loginSocial: procesarLoginDesdeCallback: Error procesando callback: ' + JSON.stringify(err));
    notifyLoginError('callback_error', 'Error procesando login.');
  }
}

// En Facebook, si no pones: '?auth_type=reauthenticate', solo te muestra cada vez el ultimo usuario de FB con el que te logueaste, y cancelar.
// Si lo pones, peor: se limita a obligar al usuario a poner de nuevo la contraseña de esa cuenta.
// En Google, si no pones el '&prompt=select_account', hace 'autologin' (Al menos en iOS, en Android en las pruebas no lo hacía).
// Si lo pones te salen las cuentas con las que te has logueado antes, y eliges una o te permite intentar con una nueva.
const oauthProviders = {
  facebook: {
    auth_url: 'https://www.facebook.com/v18.0/dialog/oauth',
    client_id: '220670288122109',
    scope: 'email,public_profile',
    redirect_uri: 'https://api.curso-ingles.com/auth/facebook/callback',
    response_type: 'code'
  },
  google: {
    auth_url: 'https://accounts.google.com/o/oauth2/v2/auth',
    client_id: '183304928018-ombqtp6vmrvm5f12cfvmeievbm9o2ec1.apps.googleusercontent.com',
    scope: 'openid email profile',
    redirect_uri: 'https://api.curso-ingles.com/auth/google/callback',
    response_type: 'code',
    extra: '&prompt=select_account'
  },
  apple: {
    auth_url: 'https://appleid.apple.com/auth/authorize',
    client_id: 'com.sokinternet.testing.loginapple', // 'Apple Service ID'
    scope: 'name email',
    redirect_uri: 'https://api.curso-ingles.com/auth/apple/callback',
    response_type: 'code',
    extra: '&response_mode=form_post'
  }
};

loginSocial = async function (provider) {
  console.log(">###> loginSocial.")
  const cfg = oauthProviders[provider];
  if (!cfg) return console.log('>###> loginSocial: Proveedor no soportado.');
  currentProvider = provider;


  //  const state = Math.random().toString(36).substring(2);
  const stateObj = {
    locale: window.r34lp0w3r.locale || 'es',
    csrf: Math.random().toString(36).substring(2)
  };
  const state = btoa(JSON.stringify(stateObj));


  const authUrl = cfg.auth_url +
    `?client_id=${encodeURIComponent(cfg.client_id)}` +
    `&redirect_uri=${encodeURIComponent(cfg.redirect_uri)}` +
    `&response_type=${cfg.response_type}` +
    `&scope=${encodeURIComponent(cfg.scope)}` +
    `&state=${encodeURIComponent(state)}` +
    (cfg.extra || '');
  console.log(">###> loginSocial. authUrl:", authUrl);
  try {
    //await window.Capacitor.Plugins.Browser.open({ url: authUrl });
    console.log('>#C02#> loginSocial: Abriendo navegador. url:',authUrl);
    /*
    window.open(authUrl, '_system');
    */
    await window.Capacitor.Plugins.Browser.open({
      url: authUrl,
      //windowName: '_blank', // opcional
      //presentationStyle: 'fullscreen', // opcional
      //openWithSystemBrowser: true // ✅ ESTO es la clave para que abra un Safari externo, no otro WebView dentro de la propia app.
    });

  } catch (err) {
    console.log('>#C02#> loginSocial: Error al abrir navegador:', err);
  }
}

if (!window.loginCallbackFromBrowser) {
  window.loginCallbackFromBrowser = function(infoUrl) {
    procesarLoginDesdeCallback(infoUrl);
  };
}

/// ----------------------------------------------------------------------------------- Plugin AdMob
if (window.Capacitor)
  window.AdMob = Capacitor.Plugins.AdMob;
else
  window.AdMob = false;

async function AdMobInit(test=true) {
  
  console.log(">#C03#> AdMobInit. test:", test);

  // Inicializamos AdMob
  await AdMob.initialize({
    requestTrackingAuthorization: true,
    testingDevices: [],
    initializeForTesting: test
  });

  // Nos aseguramos de no registrar varias veces
  if (window.__admobListenersRegistered) {
    console.log(">#C03#> AdMobInit: Los listeners ya estaban registrados.");
    return;
  }
  window.__admobListenersRegistered = true;

  // Lista de eventos disponibles
  const admobEvents = [

    "onAdLoaded",
    "onAdFailedToLoad",
    "adDidPresentFullScreenContent",
    "didFailToPresentFullScreenContentWithError",

    "adDidDismissFullScreenContent",

    "bannerAdSizeChanged",
    "bannerAdClosed",
    "bannerAdFailedToLoad", // <-
    "bannerAdOpened",
    "bannerAdLoaded",       // <-
    "bannerAdImpression",

    "interstitialAdLoaded",         // <-
    "interstitialAdFailedToLoad",   // <-
    "interstitialAdShowed",
    "interstitialAdFailedToShow",
    "interstitialAdDismissed",      // <-

    "onRewardedVideoAdLoaded",
    "onRewardedVideoAdFailedToLoad",
    "onRewardedVideoAdShowed",
    "onRewardedVideoAdFailedToShow",
    "onRewardedVideoAdDismissed",
    "onRewardedVideoAdReward",
  
    "onRewardedInterstitialAdLoaded",
    "onRewardedInterstitialAdFailedToLoad",
    "onRewardedInterstitialAdShowed",
    "onRewardedInterstitialAdFailedToShow",
    "onRewardedInterstitialAdDismissed",
    "onRewardedInterstitialAdReward"

  ];

  // Registro de todos los eventos
  admobEvents.forEach(function(eventName) {
    AdMob.addListener(eventName, function(data) {
      console.log(">#C03#> Evento de AdMob:", eventName, "data:", JSON.stringify(data));
    });
  });

  console.log(">#C03#> AdMobInit: Listeners de AdMob registrados correctamente.");
}

async function AdMobShowContentForm() {
  console.log(">#C03#> AdMobShowContentForm.")
  // Solicita información de consentimiento
  console.log(">#C03#> AdMobShowContentForm: requestConsentInfo().")
  const consentInfo = await AdMob.requestConsentInfo();
  console.log(">#C03#> AdMobShowContentForm. consentInfo:",JSON.parse(consentInfo))
  // Verifica si el formulario de consentimiento está disponible y es requerido
  if (consentInfo.isConsentFormAvailable && consentInfo.status === AdmobConsentStatus.REQUIRED) {
    console.log(">#C03#> AdMobShowContentForm: showConsentForm().")
    // Muestra el formulario de consentimiento
    await AdMob.showConsentForm();
  }
  else
  {
    console.log(">#C03#> AdMobShowContentForm: No se muestra el Consent Form.")
  }
}


async function AdMobShowBanner(test=true)
{
  console.log(">#C03#> AdMobShowBanner. test:",test)
  const platform = window.r34lp0w3r.platform;
  let adId;
  if (test)
    adId = platform === 'ios' ? 'ca-app-pub-3940256099942544/2934735716' : 'ca-app-pub-3940256099942544/6300978111';
  else
    adId = platform === 'ios' ? 'ca-app-pub-7994364056975402/9924846977' : 'ca-app-pub-7994364056975402/2301384119';
  res = await AdMob.showBanner({ adId: adId, adSize: 'SMART_BANNER', position: 'BOTTOM_CENTER', margin: 0, });
}

async function AdMobHideBanner()
{
  console.log(">#C03#> AdMobHideBanner.")
  res = await AdMob.hideBanner();
}

async function AdMobPrepareInterstitial(test=true)
{
  console.log(">#C03#> AdMobPrepareInterstitial test:",test)
  const platform = window.r34lp0w3r.platform;
  let adId;
  if (test)
  {
    adId = platform === 'ios' ? 'ca-app-pub-3940256099942544/4411468910' : 'ca-app-pub-3940256099942544/1033173712'
  }
  else
  {
    adId = platform === 'ios' ? 'ca-app-pub-7994364056975402/1167775318' : 'ca-app-pub-7994364056975402/4260842519';   
  }
  try {
    await AdMob.prepareInterstitial({ adId: adId });
    console.log('>#C03#> Interstitial cargado y listo para mostrar.');
  } catch (err) {
    console.log('>#C03#> No se pudo cargar el Interstitial:', err);
  }
}

async function AdMobShowInterstitial()
{
  console.log(">#C03#> AdMobShowInterstitial.")
  await AdMob.showInterstitial();
}

async function AdMobPrepareRewardInterstitialAd(test=true)
{
  console.log(">#C03#> AdMobPrepareRewardInterstitialAd. test:",test)
  let adId;
  if (test)
  {
    adId = r34lp0w3r.platform === 'ios' ? 'ca-app-pub-3940256099942544/6978759866' : 'ca-app-pub-3940256099942544/5354046379';
  }
  else
  {
    adId = r34lp0w3r.platform === 'ios' ? 'ca-app-pub-???????????????????????????' : 'ca-app-pub-???????????????????????????';
  }    
  try {
    await AdMob.prepareRewardInterstitialAd({ adId: adId });
    console.log('>#C03#> RewardedInterstitial cargado y listo para mostrar.');
  } catch (err) {
    console.log('>#C03#> No se pudo cargar el RewardedInterstitial:', err);
  }
}

async function AdMobShowRewardInterstitialAd()
{
  console.log(">#C03#> AdMobShowRewardInterstitialAd.")
  await AdMob.showRewardInterstitialAd();
}

async function AdMobPrepareRewardVideoAd(test=true)
{
  console.log(">#C03#> AdMobPrepareRewardVideoAd. test:",test)
  let adId
  if (test)
  {
    adId = r34lp0w3r.platform === 'ios' ? 'ca-app-pub-3940256099942544/1712485313' : 'ca-app-pub-3940256099942544/5224354917';
  }
  else
  {
    adId = r34lp0w3r.platform === 'ios' ? 'ca-app-pub-7994364056975402/6919906777' : 'ca-app-pub-7994364056975402/1092865027';
  }
  try {
    await AdMob.prepareRewardVideoAd({ adId: adId });
    console.log('>#C03#> Rewarded cargado y listo para mostrar.');
  } catch (err) {
    console.log('>#C03#> No se pudo cargar el Rewarded:', err);
  }
}

async function AdMobShowRewardVideoAd()
{
  console.log(">#C03#> AdMobShowRewardVideoAd.")
  res =await AdMob.showRewardVideoAd();
}

/// -----------------------------------------------------------------------------------

function logFullObject(label, obj, depth = 2, prefix = '') {
  if (depth < 0 || typeof obj !== 'object' || obj === null) {
    console.log(`${prefix} ${label}:`, obj);
    return;
  }
  console.log(`${prefix} ${label} (tipo ${Array.isArray(obj) ? 'array' : typeof obj}):`);
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      const type = typeof value;
      if (type === 'object' && value !== null) {
        logFullObject(`${prefix} ${label}.${key}`, value, depth - 1, prefix + '  ');
      } else {
        console.log(`${prefix} ${label}.${key}:`, value);
      }
    }
  }
}



async function PushNotificationsInit()
{
  console.log(">#C04#> PushNotificationsInit.")

  const Push = Capacitor.Plugins.PushNotifications;

  // Permiso (obligatorio en Android 13+)
  console.log(">#C04#> PushNotificationsInit: requestPermissions().");
  Push.requestPermissions().then(function(result) {
    if (result.receive === 'granted') {
      console.log('>#C04#> PushNotifications: requestPermissions(): Permiso concedido.');
      Push.register();
    } else {
      console.log('>#C04#> PushNotifications: requestPermissions(): Permiso denegado.');
    }
  });

  // Nos aseguramos de no registrar varias veces
  if (window.__pushListenersRegistered) {
    console.log(">#C04#> PushNotificationsInit: Los listeners ya estaban registrados.");
    return;
  }
  window.__pushListenersRegistered = true;  

  Push.addListener('registration', function(token) {
    logFullObject(">#C04#> PushNotifications: registration. token:",token);
    window.__fcmToken = token.value;
    Rlog(">#C04#> PushNotifications: registration. token:" + JSON.stringify(token));

    // Registrarlo en el backend
    if (window.pushTokenReceived) {
      console.log("|||||||||||||||| window.pushTokenReceived(token.value) ||||||||||||||||");
      // Implementado en index.js
      window.pushTokenReceived(token.value);
    }

  });

  Push.addListener('registrationError', function(err) {
    logFullObject(">#C04#> PushNotifications: registrationError. err:",err)
  });

  Push.addListener('pushNotificationReceived', function(notification) {
    logFullObject(">#C04#> PushNotifications: pushNotificationReceived. notification:",notification)
    Rlog()
    Rlog(">#C04#> pushNotificationReceived: notification:" + JSON.stringify(notification))
  });

  Push.addListener('pushNotificationActionPerformed', function(action) {
    logFullObject(">#C04#> PushNotifications: pushNotificationActionPerformed. action:",action)
    Rlog()
    Rlog(">#C04#> pushNotificationActionPerformed: action:" + JSON.stringify(notification))    
  });

  console.log(">#C04#> PushNotificationsInit: Listeners de PushNotifications registrados correctamente.");

  // Implementados en AppDelegate.swift

  window.addEventListener('apnsToken', function(e) {
    console.log('>#C04#> apnsToken: 📲 Token APNs obtenido desde nativo:', e.detail.token);
    window.__APNsToken = e.detail.token;
    // Registrarlo en el backend
    if (window.pushTokenReceived) {
      console.log("|||||||||||||||| window.pushTokenReceived(e.detail.token) ||||||||||||||||");
      // Implementado en index.js
      window.pushTokenReceived(e.detail.token);
    }
  });

  window.addEventListener('fcmToken', function(e) {
    console.log('>#C04#> fcmToken: 📲 Token fcm obtenido desde nativo:', e.detail.token);
    window.__fcmToken = e.detail.token;    
  });

  window.addEventListener('pushNotificationTap', function(e) {
    console.log('>#C04#> pushNotificationTap: 📥 Notificación recibida al abrir (nativo):', JSON.stringify(e.detail));
  });

  console.log(">#C04#> PushNotificationsInit: Listeners apnsToken, fcmToken y pushNotificationTap registrados correctamente.");

}

async function enviarPush(type,delay = 0) {
  console.log(">#C04#> enviarPush.")
  const destination = 'speak';
  const token = ( type == "apns" ? window.__APNsToken : window.__fcmToken ) 
  console.log(">#C04#> enviarPush. type: " + type + " token: " + token + " delay: " + delay + " destination: " + destination);
  try {
    const response = await fetch('https://api.curso-ingles.com/send_push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type,
        token,
        delay,
        destination
      })
    });
    const data = await response.json();
    console.log(">#C04#> enviarPush: Respuesta del backend:", data);
  } catch (err) {
    console.error(">#C04#> enviarPush: Error al llamar a /send_apns:", err);
  }
}

async function enviarPushFCM10() { enviarPush("fcm",10); }
async function enviarPushAPNS10() { enviarPush("apns",10); }

/// -----------------------------------------------------------------------------------

// 'Acorta por abajo' el WebView.
async function resizeWebView(offset)
{
  console.log(`>#C00#> Capacitor.Plugins.P4w4Plugin.resizeWebView({ offset: ${offset} }.`);
  await Capacitor.Plugins.P4w4Plugin.resizeWebView({ offset: offset });
}

// 'Acorta por arriba' el WebView.
async function offsetTopWebView(offset)
{
  console.log(`>#C00#> Capacitor.Plugins.P4w4Plugin,offsetTopWebView({ offset: ${offset} }.`);
  await Capacitor.Plugins.P4w4Plugin.offsetTopWebView({ offset: offset });
}


async function getStatusBarHeight()
{
  const info = await Capacitor.Plugins.P4w4Plugin.getStatusBarHeight();

  console.log(">>> typeof info:",typeof info)
  console.log(">>> info:",info)
  console.log(">>> Object.keys(info):",Object.keys(info))
  console.log(">>> typeof info.height:",typeof info.height)
  console.log(">>> info.height:",info.height)

}

async function escondeStatusBar()
{
  if ( !window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.P4w4Plugin )
    console.log("escondeStatusBar: Falta el plugin P4w4Plugin.");
  else
  {
    const info = await Capacitor.Plugins.P4w4Plugin.getStatusBarHeight();
    await Capacitor.Plugins.P4w4Plugin.offsetTopWebView({ offset: info.height });
  }
}

async function setStartupHtml(file)
{
  await Capacitor.Plugins.P4w4Plugin.setStartupHtml({file:file});
}

async function reloadWebView()
{
  await Capacitor.Plugins.P4w4Plugin.reloadWebView();
}

async function restartApp()
{
  await Capacitor.Plugins.P4w4Plugin.restartApp();
}

/// -----------------------------------------------------------------------------------

// Inicializa el sistema de compras dentro de la aplicación.
// Debe ser llamada DESPUÉS del evento 'deviceready'.
function InAppPurchasesInit() {
    console.log(">#C05# A> InAppPurchasesInit() - INICIO");

    // Crear una referencia local a la tienda.
    const store = window.CdvPurchase.store;

    // Activar logs de depuración del propio plugin.
    store.verbosity = store.DEBUG;

    // 1. DEFINIR LOS PRODUCTOS
    // Lista de todos los productos que la app venderá.
    // Los 'id' deben coincidir EXACTAMENTE con los configurados en App Store Connect y Google Play.

    const applePlatform = CdvPurchase.Platform.APPLE_APPSTORE; // Esto se resolverá a "ios-appstore"
    const googlePlatform = CdvPurchase.Platform.GOOGLE_PLAY;

    console.log(">#C05# Plataforma para registrar productos:", applePlatform);
    console.log(">#C05# Plataforma para registrar productos:", googlePlatform);

    const PRODUCTS = [

      // iOS - testing
      { id: 'premium_month',                          type: store.PAID_SUBSCRIPTION, platform: applePlatform },
      { id: 'premium_anual',                          type: store.PAID_SUBSCRIPTION, platform: applePlatform },
      { id: 'com.sokinternet.testing.forever',        type: store.NON_CONSUMABLE,    platform: applePlatform },

      // iOS - cursoingles
      { id: 'subsyear0',                              type: store.PAID_SUBSCRIPTION, platform: applePlatform },
      { id: 'com.sokinternet.cursoingles.subsyear25', type: store.PAID_SUBSCRIPTION, platform: applePlatform },
      { id: 'com.sokinternet.cursoingles.subsyear50', type: store.PAID_SUBSCRIPTION, platform: applePlatform },
      { id: 'com.sokinternet.cursoingles.subsyear',   type: store.PAID_SUBSCRIPTION, platform: applePlatform },
      { id: 'com.sokinternet.cursoingles.subsmonth',  type: store.PAID_SUBSCRIPTION, platform: applePlatform },
      { id: 'com.sokinternet.cursoingles.forever',    type: store.NON_CONSUMABLE,    platform: applePlatform },

      // Android testing
      { id: 'premium_month',    type: store.PAID_SUBSCRIPTION, platform: googlePlatform },
      { id: 'premium_anual',    type: store.PAID_SUBSCRIPTION, platform: googlePlatform },

      // Android cursoingles
      { id: 'infinite_gas',     type: store.PAID_SUBSCRIPTION, platform: googlePlatform },
      { id: 'premium_year0',    type: store.PAID_SUBSCRIPTION, platform: googlePlatform },
      { id: 'premium_year25',   type: store.PAID_SUBSCRIPTION, platform: googlePlatform },
      { id: 'premium_year50',   type: store.PAID_SUBSCRIPTION, platform: googlePlatform },
      { id: 'premium_year',     type: store.PAID_SUBSCRIPTION, platform: googlePlatform },
      { id: 'premium_year75_2', type: store.PAID_SUBSCRIPTION, platform: googlePlatform },
      { id: 'premium_year50_2', type: store.PAID_SUBSCRIPTION, platform: googlePlatform },
      { id: 'premium_year25_2', type: store.PAID_SUBSCRIPTION, platform: googlePlatform },
      { id: 'premium_year0_2',  type: store.PAID_SUBSCRIPTION, platform: googlePlatform },
      { id: 'premium_month',    type: store.PAID_SUBSCRIPTION, platform: googlePlatform },

      // Android testing + cursoingles
      { id: 'premium_forever',  type: store.NON_CONSUMABLE,    platform: googlePlatform },      

    ];

    // 2. CONFIGURAR LISTENERS 
    console.log(">#C05# E> Registrando listeners...");
    store.when('product').updated(IAPPurchaseUpdated); // También lo lanza para receipts
    store.when('product').initiated(IAPPPurchaseInitiated); // Acaba de empezar el order()
    store.when('product').approved(IAPPurchaseApproved); // Compra aprobada (Ambas plataformas)

    store.when('product').verified(IAPPurchaseVerified); // Compra verificada (iOS): al llamar a verify() en IAPPurchaseApproved se llama a la función que se define en xxxxxx y cuando esa vuelve se lanza el verified.

    store.validator = IAPPurchaseVerify;

    //store.when('product').cancelled(IAPPurchaseCancelled); // El usuario ha cancelado la compra
    store.ready(IAPStoreReady);
    store.error(IAPStoreError);

    console.log(">#C05# F> Listeners registrados correctamente.");

    console.log(">#C05# FBis> CdvPurchase.Platform: " + JSON.stringify(CdvPurchase.Platform));

    // 3. REGISTRAR LOS PRODUCTOS EN LA TIENDA
    // Le decimos al plugin qué productos debe buscar en las tiendas de Apple/Google.
    console.log(">#C05# G> Registrando productos en la tienda:",JSON.stringify(PRODUCTS));
    store.register(PRODUCTS);
    console.log(">#C05# H> Comando de registro enviado.");


    // 4. INICIALIZAR LA TIENDA
    // Este comando inicia la comunicación con los servidores de la App Store / Google Play
    // para obtener la información de los productos registrados.
    // Disparará los listeners 'product.updated' que configuramos antes.
    console.log(">#C05# I> Iniciando la comunicación con la tienda (store.initialize([platforms]))...");
    store.initialize([applePlatform,googlePlatform]) 

    console.log(">#C05# J> InAppPurchasesInit() - FIN");
}



function logLongString(label, str, chunkSize = 500) {
  const totalChunks = Math.ceil(str.length / chunkSize);
  for (let i = 0; i < totalChunks; i++) {
    const chunk = str.slice(i * chunkSize, (i + 1) * chunkSize);
    console.log(`${label} [${i + 1}/${totalChunks}]: ${chunk}`);
  }
}

// Eso se asigna así: store.validator = IAPPurchaseVerify (sólo se lanzará en iOS)
// OJO: se lanza también para recibos antiguos al refrescar la store: Será un 'recibo general', y esos se tienen que ignorar.
IAPPurchaseVerify = async function(body, callback) {

  console.log(">#V05# IAPPurchaseVerify: body:",JSON.stringify(body));
  /*
  {
    "id":"com.sokinternet.testing",
    "type":"application",
    "products":
      [
        {
          "className":"Product",
          "title":"Year Premium","description":"Unlimited full year access.","platform":"ios-appstore","type":"paid subscription","id":"premium_anual","group":"21704713",
          "offers":[{"className":"Offer","id":"$","pricingPhases":[{"price":"1,99€","priceMicros":1990000,"currency":"EUR","billingPeriod":"P1Y","paymentMode":"PayAsYouGo","recurrenceMode":"INFINITE_RECURRING"}],"productId":"premium_anual","productType":"paid subscription","productGroup":"21704713","platform":"ios-appstore","offerType":"Default"}],
          "raw":{"id":"premium_anual","description":"Unlimited full year access.","introPrice":null,"introPricePaymentMode":null,"billingPeriodUnit":"Year","countryCode":"ES","introPricePeriodUnit":null,"discounts":[],"title":"Year Premium","price":"1,99€","billingPeriod":1,"group":"21704713","priceMicros":1990000,"currency":"EUR","introPricePeriod":null,"introPriceMicros":null,"type":"paid subscription","platform":"ios-appstore"},
          "countryCode":"ES"
        },
        {
          "className":"Product",
          "title":"Month Premium","description":"Full Month access.","platform":"ios-appstore","type":"paid subscription","id":"premium_month","group":"21704713",          
          "offers":[{"className":"Offer","id":"$","pricingPhases":[{"price":"0,99€","priceMicros":990000,"currency":"EUR","billingPeriod":"P1M","paymentMode":"PayAsYouGo","recurrenceMode":"INFINITE_RECURRING"}],"productId":"premium_month","productType":"paid subscription","productGroup":"21704713","platform":"ios-appstore","offerType":"Default"}],
          "raw":{"id":"premium_month","description":"Full Month access.","introPrice":null,"introPricePaymentMode":null,"billingPeriodUnit":"Month","countryCode":"ES","introPricePeriodUnit":null,"discounts":[],"title":"Month Premium","price":"0,99€","billingPeriod":1,"group":"21704713","priceMicros":990000,"currency":"EUR","introPricePeriod":null,"introPriceMicros":null,"type":"paid subscription","platform":"ios-appstore"},
          "countryCode":"ES"
        }
      ],
    "transaction":
      {
        "type":"ios-appstore",
        "id":"2000000943844642",
        "appStoreReceipt":"MIIlmgYJKoZIhvcNAQcCoIIlizCCJYcCAQExDzANBglghkgBZQMEAgEFADCCFNAGCSqGSIb3DQEHAaCCFMEEghS9MYIUuTAKAgEIAgEBBAIWADAKAgEUAgEBBAIMADALAgEBAgEBBAMCAQAwCwIBAwIBAQQDDAExMAsCAQsCAQEEAwIBADALAgEPAgEBBAMCAQAwCwIBEAIBAQQDAgEAMAsCARkCAQEEAwIBAzAMAgEKAgEBBAQWAjQrMAwCAQ4CAQEEBAICAMIwDQIBDQIBAQQFAgMCwRQwDQIBEwIBAQQFDAMxLjAwDgIBCQIBAQQGAgRQMzA1MBgCAQQCAQIEEKm3VMJqKEghZY5oPjfJ1zAwGwIBAAIBAQQTDBFQcm9kdWN0aW9uU2FuZGJveDAcAgEFAgEBBBRP3AbNCbgBdC9ejyEcexfLY+7H7DAeAgEMAgEBBBYWFDIwMjUtMDYtMTlUMTE6MTM6MzJaMB4CARICAQEEFhYUMjAxMy0wOC0wMVQwNzowMDowMFowIQIBAgIBAQQZDBdjb20uc29raW50ZXJuZXQudGVzdGluZzBTAgEHAgEBBEuBK5AkJ645lqVO33wLogMJGx+k4ZeFdVxNx6NaRKM3/72ELfLrlwlEL2MYK4vZAG3xNHkyURJbvJto/5q4f1Toa8O4mPySIOWRgjQwagIBBgIBAQRioBqPi66fTaOAStEUZSJJUuOyZczPs9ikxFgh4UTEKuvoxkNulnoWEBz3/A9x0Y5cj/OskXjwDPK3Tayb/cHKOtnfmstl5wd/FC54VJX3kuTsBOao6xqhUSxGKBGY1b+XHuwwggGIAgERAgEBBIIBfjGCAXowCwICBq0CAQEEAgwAMAsCAgawAgEBBAIWADALAgIGsgIBAQQCDAAwCwICBrMCAQEEAgwAMAsCAga0AgEBBAIMADALAgIGtQIBAQQCDAAwCwICBrYCAQEEAgwAMAwCAgalAgEBBAMCAQEwDAICBqsCAQEEAwIBAzAMAgIGrgIBAQQDAgEAMAwCAgaxAgEBBAMCAQAwDAICBrcCAQEEAwIBADAMAgIGugIBAQQDAgEAMBICAgavAgEBBAkCBwca/U+ujtAwGAICBqYCAQEEDwwNcHJlbWl1bV9tb250aDAbAgIGpwIBAQQSDBAyMDAwMDAwOTQzNzc4NjAwMBsCAgapAgEBBBIMEDIwMDAwMDA5NDM3Nzg2MDAwHwICBqgCAQEEFhYUMjAyNS0wNi0xOVQwNjoyODowOFowHwICBqoCAQEEFhYUMjAyNS0wNi0xOVQwNjoyODowOFowHwICBqwCAQEEFhYUMjAyNS0wNi0xOVQwNjozMzowOFowggGIAgERAgEBBIIBfjGCAXowCwICBq0CAQEEAgwAMAsCAgawAgEBBAIWADALAgIGsgIBAQQCDAAwCwICBrMCAQEEAgwAMAsCAga0AgEBBAIMADALAgIGtQIBAQQCDAAwCwICBrYCAQEEAgwAMAwCAgalAgEBBAMCAQEwDAICBqsCAQEEAwIBAzAMAgIGrgIBAQQDAgEAMAwCAgaxAgEBBAMCAQAwDAICBrcCAQEEAwIBADAMAgIGugIBAQQDAgEAMBICAgavAgEBBAkCBwca/U+ujtIwGAICBqYCAQEEDwwNcHJlbWl1bV9tb250aDAbAgIGpwIBAQQSDBAyMDAwMDAwOTQzNzgyOTUwMBsCAgapAgEBBBIMEDIwMDAwMDA5NDM3Nzg2MDAwHwICBqgCAQEEFhYUMjAyNS0wNi0xOVQwNjozMzowOFowHwICBqoCAQEEFhYUMjAyNS0wNi0xOVQwNjoyODowOFowHwICBqwCAQEEFhYUMjAyNS0wNi0xOVQwNjozODowOFowggGIAgERAgEBBIIBfjGCAXowCwICBq0CAQEEAgwAMAsCAgawAgEBBAIWADALAgIGsgIB
  */

  // 1. Asegurarse de que hay un recibo
  const receipt = body && body.transaction && body.transaction.appStoreReceipt;
  let productId = undefined;
  if (body && Array.isArray(body.products) && body.products[0]) {
      productId = body.products[0].id;
  }

  if (!receipt || !productId) {
    console.log(">#V05# IAPPurchaseVerify: No hay receipt. o productId. No se puede validar nada. Se devuelve error.");
    callback({ ok: false, error: "Missing receipt or productId" });
    return;
  }

  console.log(">#V05# IAPPurchaseVerify: productID: " + productId + " Envío al backend.");

  logLongString('>#V05# IAPPurchaseVerify: receipt:', receipt);

  console.log( ">#V05# IAPPurchaseVerify: body:", JSON.stringify(body) );

// body: 
//  {
//      "id":"com.sokinternet.testing",
//      "type":"application","products":[{"className":"Product","title":"Year Premium","description":"Unlimited full year access.","platform":"ios-appstore","type":"paid subscription","id":"premium_anual","group":"21704713","offers":[{"className":"Offer","id":"$","pricingPhases":[{"price":"1,99 €","priceMicros":1990000,"currency":"EUR","billingPeriod":"P1Y","paymentMode":"PayAsYouGo","recurrenceMode":"INFINITE_RECURRING"}],"productId":"premium_anual","productType":"paid subscription","productGroup":"21704713","platform":"ios-appstore","offerType":"Default"}],"raw":{"id":"premium_anual","description":"Unlimited full year access.","introPrice":null,"introPricePaymentMode":null,"billingPeriodUnit":"Year","countryCode":"ES","introPricePeriodUnit":null,"discounts":[],"title":"Year Premium","price":"1,99 €","billingPeriod":1,"group":"21704713","priceMicros":1990000,"currency":"EUR","introPricePeriod":null,"introPriceMicros":null,"type":"paid subscription","platform":"ios-appstore"},"countryCode":"ES"},{"className":"Product","title":"Month Premium","description":"Full Month access.","platform":"ios-appstore","type":"paid subscription","id":"premium_month","group":"21704713","offers":[{"className":"Offer","id":"$","pricingPhases":[{"price":"0,99 €","priceMicros":990000,"currency":"EUR","billingPeriod":"P1M","paymentMode":"PayAsYouGo","recurrenceMode":"INFINITE_RECURRING"}],"productId":"premium_month","productType":"paid subscription","productGroup":"21704713","platform":"ios-appstore","offerType":"Default"}],"raw":{"id":"premium_month","description":"Full Month access.","introPrice":null,"introPricePaymentMode":null,"billingPeriodUnit":"Month","countryCode":"ES","introPricePeriodUnit":null,"discounts":[],"title":"Month Premium","price":"0,99 €","billingPeriod":1,"group":"21704713","priceMicros":990000,"currency":"EUR","introPricePeriod":null,"introPriceMicros":null,"type":"paid subscription","platform":"ios-appstore"},"countryCode":"ES"}],"transaction":{"type":"ios-appstore","id":"2000000959252222","appStoreReceipt":"MII5tQYJKoZIhvcNAQcCoII5pjCCOaICAQExDzANBglghkgBZQMEAgEFADCCKOsGCSqGSIb3DQEHAaCCKNwEgijYMYIo1DAKAgEIAgEBBAIWADAKAgEUAgEBBAIMADALAgEBAgEBBAMCAQAwCwIBAwIBAQQDDAExMAsCAQsCAQEEAwIBADALAgEPAgEBBAMCAQAwCwIBEAIBAQQDAgEAMAsCARkCAQEEAwIBAzAMAgEKAgEBBAQWAjQrMAwCAQ4CAQEEBAICAMIwDQIBDQIBAQQFAgMCwRQwDQIBEwIBAQQFDAMxLjAwDgIBCQIBAQQGAgRQMzA1MBgCAQQCAQIEEOhbwCor78ROfHLe3yXKt9swGwIBAAIBAQQTDBFQcm9kdWN0aW9uU2FuZGJveDAcAgEFAgEBBBQTYsC/v5P9XC5g+s3wOSUgMrVr4TAeAgEMAgEBBBYWFDIwMjUtMDctMTBUMTY6NTA6MTRaMB4CARICAQEEFhYUMjAxMy0wOC0wMVQwNzowMDowMFowIQIBAgIBAQQZDBdjb20uc29raW50ZXJuZXQudGVzdGluZzBdAgEHAgEBBFW0bm4RcmofhoxTCmwfGdfihR0C0OgEbmMsZh6cG5aXpW2RK+C58dp/pUrgVvJ9wNQGQ9DysbpNZS/ERX3QISu83A6nVh/WYcjuYGTp4tmF398P8VfKMF8CAQYCAQEEV2IyTlLspgdsA/uLG5jyDS9TyunYUfQieZhIAA4ZVDAbnz90o2sMwA/daKCsYZQUnYTqpECmdCeD6+dfOAQUPrzijAXbk+prJe4CxM9Scd/p+l9xXyt+szCCAYgCARECAQEEggF+MYIBejALAgIGrQIBAQQCDAAwCwICBrACAQEEAhYAMAsCAgayAgEBBAIMADALAgIGswIBAQQCDAAwCwICBrQCAQEEAgwAMAsCAga1AgEBBAIMADALAgIGtgIBAQQCDAAwDAICBqUCAQEEAwIBATAMAgIGqwIBAQQDAgEDMAwCAgauAgEBBAMCAQAwDAICBrECAQEEAwIBADAMAgIGtwIBAQQDAgEAMAwCAga6AgEBBAMCAQAwEgICBq8CAQEECQIHBxr9T66O0DAYAgIGpgIBAQQPDA1wcmVtaXVtX21vbnRoMBsCAganAgEBBBIMEDIwMDAwMDA5NDM3Nzg2MDAwGwICBqkCAQEEEgwQMjAwMDAwMDk0Mzc3ODYwMDAfAgIGqAIBAQQWFhQyMDI1LTA2LTE5VDA2OjI4OjA4WjAfAgIGqgIBAQQWFhQyMDI1LTA2LTE5VDA2OjI4OjA4WjAfAgIGrAIBAQQWFhQyMDI1LTA2LTE5VDA2OjMzOjA4WjCCAYgCARECAQEEggF+MYIBejALAgIGrQIBAQQCDAAwCwICBrACAQEEAhYAMAsCAgayAgEBBAIMADALAgIGswIBAQQCDAAwCwICBrQCAQEEAgwAMAsCAga1AgEBBAIMADALAgIGtgIBAQQCDAAwDAICBqUCAQEEAwIBATAMAgIGqwIBAQQDAgEDMAwCAgauAgEBBAMCAQAwDAICBrECAQEEAwIBADAMAgIGtwIBAQQDAgEAMAwCAga6AgEBBAMCAQAwEgICBq8CAQEECQIHBxr9T66O0jAYAgIGpgIBAQQPDA1wcmVtaXVtX21vbnRoMBsCAganAgEBBBIMEDIwMDAwMDA5NDM3ODI5NTAwGwICBqkCAQEEEgwQMjAwMDAwMDk0Mzc3ODYwMDAfAgIGqAIBAQQWFhQyMDI1LTA2LTE5VDA2OjMzOjA4WjAfAgIGqgIBAQQWFhQyMDI1LTA2LTE5VDA2OjI4OjA4WjAfAgIGrAIBAQQWFhQyMDI1LTA2LTE5VDA2OjM4OjA4WjCCAYgCARECAQEEggF+MYIBejALAgIGrQIBAQQCDAAwCwICBrACAQEEAhYAMAsCAgayAgEB


  // 2. ENVÍO AL BACKEND
  try {

    const url =  ( window.env === 'PRO' ? window.apiPRO : window.apiDEV ) + '/iap/verify-ios';

    body.userId = window.user_id;

    const res = await fetch( url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const response = await res.json();

    // El backend debe devolver algo como { ok: true, data: { ... } }
    callback(response); // ✅ activa 'verified' si ok === true

    var result;

    if ( response.ok )
    {
      console.log( '>#V05# IAPPurchaseVerify: Compra validada correctamente: response.ok:', response.ok );
      console.log( '>#V05# IAPPurchaseVerify: Compra validada correctamente: response.data.id:', response.data.id );
      Object.keys( response.data.transaction ).forEach( k => {
        if ( k == "appStoreReceipt" )
          console.log( '>#V05# IAPPurchaseVerify: Compra validada correctamente: response.data.transaction' + k + ':', response.data.transaction[k].substring( 0, 20 ) + "..." );
        else
          console.log( '>#V05# IAPPurchaseVerify: Compra validada correctamente: response.data.transaction' + k + ':', response.data.transaction[k] );
      });

      // >#V05# IAPPurchaseVerify: Compra validada correctamente: response.ok: true
      // >#V05# IAPPurchaseVerify: Compra validada correctamente: response.data.id: 2000000959262715
      // >#V05# IAPPurchaseVerify: Compra validada correctamente: response.data.transaction.type: ios-appstore
      // >#V05# IAPPurchaseVerify: Compra validada correctamente: response.data.transaction.id: appstore.application
      // >#V05# IAPPurchaseVerify: Compra validada correctamente: response.data.transaction.appStoreReceipt: MIJGHwYJKoZIhvcNAQcC...
      // >#V05# IAPPurchaseVerify: Compra validada correctamente: response.data.transaction.validatedBy: server
      // >#V05# IAPPurchaseVerify: Compra validada correctamente: response.data.transaction.originalTransactionId: 2000000943778600
      // >#V05# IAPPurchaseVerify: Compra validada correctamente: response.data.transaction.expiresDateMs: 1752169213000

      // {
      //   "ok": true,
      //   "data": {
      //     "id": "2000000959257319",
      //     "transaction": {
      //       "appStoreReceipt": "...",
      //       "validatedBy": "server",
      //       "originalTransactionId": "2000000959257319",
      //       "expiresDateMs": "1752147633829"
      //     }
      //   }
      // }

      // const now = Date.now();
      // const durationMs = 365 * 24 * 60 * 60 * 1000; // Por ejemplo, 1 año de suscripción
      // const expires = new Date(now + durationMs);

      if ( response.ok )
      {
        const t = response.data.transaction;
        const productId = (body && Array.isArray(body.products) && body.products[0] && body.products[0].id) || undefined;
        const productType = (body && Array.isArray(body.products) && body.products[0] && body.products[0].type) || '';
        const isSubscription = /subscription/i.test(productType);
        const FOREVER_TS = new Date('2099-12-31T23:59:59Z').getTime();
        const expiresMs = t && t.expiresDateMs ? parseInt(t.expiresDateMs) : undefined;

        if (isSubscription && expiresMs) {
          result = {
            register_ok: true,
            purchase_id: t.originalTransactionId || response.data.id || productId,
            purchase_expires: expiresMs,
            purchase_expires_human: new Date(expiresMs).toISOString() //.split("T")[0] // formato YYYY-MM-DD
          };
        } else {
          result = {
            register_ok: true,
            purchase_id: t && (t.originalTransactionId || t.id) || response.data.id || productId,
            purchase_expires: FOREVER_TS,
            purchase_expires_human: new Date(FOREVER_TS).toISOString()
          };
        }
      }
      else
      {
        result = {
          register_ok: false
        }        
      }
    }
    else
    {
      console.log( '>#V05# IAPPurchaseVerify: Compra NO validada correctamente: ' + JSON.stringify( data.details ) );

      result = {
        register_ok: false,
      };
    }

    console.log( '>#V05# IAPPurchaseVerify: Informando a la App ( window.trigger_gotPremium( result ) ).' );
    // Lógica de la App
    if ( window._trigger_gotPremium ) {
      console.log( "|||||||||||||||| window._trigger_gotPremium( result ) ||||||||||||||||" );
      // Implementado en index.js
      window._trigger_gotPremium( result );
    }
    else
    {
      console.log( "|||||||||||||||| NO se encontró window._trigger_gotPremium ||||||||||||||||" );
    }

  } catch (err) {
    console.log( '>#V05# IAPPurchaseVerify: Error verificando recibo.' );
    console.log( '>#V05# IAPPurchaseVerify: - message:', err.message );
    console.log( '>#V05# IAPPurchaseVerify: - stack:', err.stack );
    console.log( '>#V05# IAPPurchaseVerify: - name:', err.name );
    console.log( '>#V05# IAPPurchaseVerify: - full error:', err );
    callback({ ok: false, error: err.message }); // ❌ activa 'unverified'
  }

  console.log(">#V05# IAPPurchaseVerify: Llamando al callback con OK: llamará a verified().");

  try {
    const transaction = body && body.transaction;
    const txId = body && body.transaction && body.transaction.id;
    console.log(">#V05# IAPPurchaseVerify: transaction.id = " + txId);

    // Fuerza a decirle al plugin que la verificación ha ido bien.
    callback({
      ok: true,
      data: {
        id: transaction.id,
        transaction: transaction
      }
    });

    console.log(">#V05# IAPPurchaseVerify: payload para el callback:" + JSON.stringify(payload));

    callback(payload);
  } catch (e) {

    console.log(">#V05# IAPPurchaseVerify: ERROR al preparar el payload:", e);

    callback({ ok: false, error: 'EXCEPTION:' + e.message });

  }






};

IAPPurchaseVerified = async function(item) {

  console.log(">#V05# LISTENER IAPPurchaseVerified: item:",JSON.stringify(item));

  console.log(">#V05# LISTENER IAPPurchaseVerified: Llamando a item.finish().");
  item.finish()

}



// Listeners de IAP ------------------------------------------

// Listener general para cuando la información de CUALQUIER producto se actualiza.
// Se dispara después de 'store.initialize()' para cada producto registrado y válido.
function IAPPurchaseUpdated(item) {

  console.log(">#V05# LISTENER IAPPurchaseUpdated: item:",JSON.stringify(item));
  const className = (item && typeof item === 'object' && 'platform' in item) ? item.className : undefined;
  const platform = (item && typeof item === 'object' && 'platform' in item) ? item.platform : undefined;
  console.log(">#V05# LISTENER IAPPurchaseUpdated: className:",className,"platform:",platform);

  /* Android - Product
  {
    "className": "Product",
    "title": "Premium Month",
    "description": "",
    "platform": "android-playstore",
    "type": "paid subscription",
    "id": "premium_month",
    "offers": [
      {
        "className": "Offer",
        "id": "premium_month@montly",
        "pricingPhases": [
          {
            "price": "€1.19",
            "priceMicros": 1190000,
            "currency": "EUR",
            "billingPeriod": "P1M",
            "billingCycles": 0,
            "recurrenceMode": "INFINITE_RECURRING",
            "paymentMode": "PayAsYouGo"
          }
        ],
        "productId": "premium_month",
        "productType": "paid subscription",
        "platform": "android-playstore",
        "type": "subs",
        "tags": [],
        "token": "Aezw0sk4eGYv78oihNgPfOqJkdvYGoGbZWfulF+5j2m19SBV5+xaBwjCfrw8MtpXr7CszOus7SzbqZ8="
      }
    ]
  }
  */
  /* iOS - Product
  {
    "className": "Product",
    "title": "Year Premium",
    "description": "Unlimited full year access.",
    "platform": "ios-appstore",
    "type": "paid subscription",
    "id": "premium_anual",
    "group": "21704713",
    "offers": [
      {
        "className": "Offer",
        "id": "$",
        "pricingPhases": [
          {
            "price": "1,99 €",
            "priceMicros": 1990000,
            "currency": "EUR",
            "billingPeriod": "P1Y",
            "paymentMode": "PayAsYouGo",
            "recurrenceMode": "INFINITE_RECURRING"
          }
        ],
        "productId": "premium_anual",
        "productType": "paid subscription",
        "productGroup": "21704713",
        "platform": "ios-appstore",
        "offerType": "Default"
      }
    ],
    "raw": {
      "id": "premium_anual",
      "description": "Unlimited full year access.",
      "introPrice": null,
      "introPricePaymentMode": null,
      "billingPeriodUnit": "Year",
      "countryCode": "ES",
      "introPricePeriodUnit": null,
      "discounts": [],
      "title": "Year Premium",
      "price": "1,99 €",
      "billingPeriod": 1,
      "group": "21704713",
      "priceMicros": 1990000,
      "currency": "EUR",
      "introPricePeriod": null,
      "introPriceMicros": null
    },
    "countryCode": "ES"
  }  
  */

  if (className === 'Product') {

    const platform = item.platform;
    const productId = item.id;
    let token;
    // En Android parece que las ofertas tienen token y en iOS no.
    if (item.offers.length>0)
    {
      if ('token' in item.offers[0] ) token = item.offers[0].token;
      var prodPrice = item.offers[0].pricingPhases[0].price      
      if ( prodPrice && prodPrice.length>0 )
      {
        // Asegura que window.subsStorePrice existe
        if (!window.subsStorePrice) {
          window.subsStorePrice = {};
        }

        // Guarda el precio
        window.subsStorePrice[ productId ] = prodPrice;

        //alert( "LISTENER IAPPurchaseUpdated: Producto: platform: " + platform + " productId: " + productId + "prodPrice: " + prodPrice );
      }
      console.log( ">#V05# LISTENER IAPPurchaseUpdated: Producto: platform:", platform, "productId:", productId, "offers[0].token:", token, "item.offers[0].pricingPhases[0].price:", prodPrice );      
    }

  }

  /* Android - Receipt
  {
    "className": "Receipt",
    "transactions": [
      {
        "className": "Transaction",
        "transactionId": "GPA.3377-0876-2409-33983",
        "state": "approved",
        "products": [{"id": "premium_month"}],
        "platform": "android-playstore",
        "nativePurchase": {
          "orderId": "GPA.3377-0876-2409-33983",
          "packageName": "com.sokinternet.testing",
          "productId": "premium_month",
          "purchaseTime": 1750156743664,
          "purchaseState": 0,
          "purchaseToken": "hhomamnibiadhfgdpjkfhfod.AO-J1OxN3kT4vV0xQBO-IwDBG5KIzbhGyZ36Tc3aIfhHMJToPl6xwGvPs6_dB4Wd3e7OxX8uP35VQnAIvo5KNHJQ4u8UdTdilVM4rLN3kqPS2HHP71SgEb4",
          "quantity": 1,
          "autoRenewing": true,
          "acknowledged": true,
          "productIds": ["premium_month"],
          "getPurchaseState": 1,
          "developerPayload": "",
          "accountId": "",
          "profileId": "",
          "signature": "nJhUn1uvGyOuzEMzDITVI+d+uBUqYtHHPhk3gdkwUiqJpEOIjJd/ru5fWFXofhnxYO7In3gXUpQLFcMDQA9C7QYiYiPiFrB9ujFiML6Y8bc2K11PmnZVlJR88ZaLfPaHpl8T9uOzjYJkf5Ack4AJP2kcgJ09ME9l/NOwrAg6bJ5CboksHi1QUEcKkCHo2T+TzbX5tHwZf99AxElIOORPAt/5wlQWHV8bmRr5SG0Wfy0G0cnk+b2D/ZjUr/bNJZj3ftOrPAAfpIyrlAegLdJz6oY6lk2pqTc1zrOfneKouC7FVLAUGl/uNuGumWGl01DGZS81J0RQoRqZEBPe3+fyAA==",
          "receipt": "{\"orderId\":\"GPA.3377-0876-2409-33983\",\"packageName\":\"com.sokinternet.testing\",\"productId\":\"premium_month\",\"purchaseTime\":1750156743664,\"purchaseState\":0,\"purchaseToken\":\"hhomamnibiadhfgdpjkfhfod.AO-J1OxN3kT4vV0xQBO-IwDBG5KIzbhGyZ36Tc3aIfhHMJToPl6xwGvPs6_dB4Wd3e7OxX8uP35VQnAIvo5KNHJQ4u8UdTdilVM4rLN3kqPS2HHP71SgEb4\",\"quantity\":1,\"autoRenewing\":true,\"acknowledged\":true}"
        },
        "purchaseId": "hhomamnibiadhfgdpjkfhfod.AO-J1OxN3kT4vV0xQBO-IwDBG5KIzbhGyZ36Tc3aIfhHMJToPl6xwGvPs6_dB4Wd3e7OxX8uP35VQnAIvo5KNHJQ4u8UdTdilVM4rLN3kqPS2HHP71SgEb4",
        "purchaseDate": "2025-06-17T10:39:03.664Z",
        "isPending": false,
        "isAcknowledged": true,
        "renewalIntent": "Renew"
      }
    ],
    "platform": "android-playstore",
    "purchaseToken": "hhomamnibiadhfgdpjkfhfod.AO-J1OxN3kT4vV0xQBO-IwDBG5KIzbhGyZ36Tc3aIfhHMJToPl6xwGvPs6_dB4Wd3e7OxX8uP35VQnAIvo5KNHJQ4u8UdTdilVM4rLN3kqPS2HHP71SgEb4",
    "orderId": "GPA.3377-0876-2409-33983"
  }
  */
  /* iOS - Receipt (Parece que este viene siempre aun que no se haya llegado a comprar nunca)
  {
    "className": "Receipt",
    "transactions": [],
    "platform": "ios-appstore"
  }  
  */

  else if (className === 'Receipt') {

    let purchaseToken, orderId; // Del propio Receipt
    let productId, isAcknowledged, state; // De la última transacción

    if (platform == "android-playstore")
    {
      purchaseToken = item.purchaseToken;
      orderId = item.orderId;
      // ????????????????????????
      /*
      validatePurchaseOnServer({
        productId,
        purchaseToken: token,
        platform: "android",
      }).then(() function() {
        console.log("✅ Restauración validada:", productId);
        // No se hace finish aquí si ya está acknowledged
      }).catch( function(err) { console.log("❌ Error en restauración:", err) } );
      */
    } 
    else // ios-appstore
    {

    }
    console.log(">#V05# LISTENER IAPPurchaseUpdated: Recibo: platform:", platform, "purchaseToken:", purchaseToken, "orderId:", orderId );
    console.log(">#V05# LISTENER IAPPurchaseUpdated: Recibo: transactions.length:", item.transactions.length);
    if (item.transactions.length>0)
    {
      var idx = 0;
      item.transactions.forEach(function(transaction) {
        var productId, isAcknowledged, state;

        if (
          transaction &&
          Array.isArray(transaction.products) &&
          transaction.products[0]
        ) {
          productId = transaction.products[0].id;
        } else {
          productId = undefined;
        }

        isAcknowledged = transaction.isAcknowledged;
        state = transaction.state;

        console.log(
          ">#V05# LISTENER IAPPurchaseUpdated: Recibo.transactions[" + idx + "]: productId:",
          productId,
          "isAcknowledged:",
          isAcknowledged,
          "state:",
          state
        );

        idx += 1;
      });
    }

  }

  else {
    console.log(">#V05# LISTENER IAPPurchaseUpdated: ❓ Objeto inesperado (className no es Product ni Receipt).");
  }

}

// Se acaba de lanzar la order()
function IAPPPurchaseInitiated(item) {

  console.log(">#V05# LISTENER IAPPPurchaseInitiated: item: " + JSON.stringify(item));

}

// Listener general para cuando una compra es APROBADA por la tienda.
async function IAPPurchaseApproved(item) {

  console.log(">#V05# LISTENER IAPPurchaseApproved: item: " + JSON.stringify(item));

  // Aquí la tienda (App Store o Play Store) dan por correcta la compra.
  // Es el momento de ponerle Premium al usuario.

  // Pero nosotros lo hacemos tras registrarla en el backend.




  /* Android Sandbox
  {
    "className": "Transaction",
    "transactionId": "GPA.3339-1025-0076-66574",
    "state": "approved",
    "products": [
      {
        "id": "premium_month"
      }
    ],
    "platform": "android-playstore",
    "nativePurchase": {
      "orderId": "GPA.3339-1025-0076-66574",
      "packageName": "com.sokinternet.testing",
      "productId": "premium_month",
      "purchaseTime": 1750234097034,
      "purchaseState": 0,
      "purchaseToken": "klicimplbdcahahijanklmjk.AO-J1Owe-XS6990brrbJfzywIAuiH-RcXqA-UXzYX8GwcRF_P_Mc8JGkKxfpIjM6G3sbTk4g4YK-0I9PLW37fB7ZDPukK5rJlcW5l8eMn-qbWMSvWSMErzk",
      "quantity": 1,
      "autoRenewing": true,
      "acknowledged": false,
      "productIds": [
        "premium_month"
      ],
      "getPurchaseState": 1,
      "developerPayload": "",
      "accountId": "",
      "profileId": "",
      "signature": "1shEO1PhAfXEil8RGnEwwtGk0VXQcgTcuIQezLuhLpc8MgloEWxziBZlVjxN4idDSvZM8Me62HuIDN8vnyae7ERVBlJUf5MfehpbM4z6YKO5Go9x7QGKUQbd6Fnu1wAil3tIB0g4ak2huGungofROLmc6LZcdDnMdjvNjaDaRoPrKDYbJOvMGlUu/6VuvHf8bGfnpTtMYJyfZlyBoz/Up3yzro4AssTGcDCjQTqAvTzndU2pzwEh5kXBBC9JBaw9jHSux+K8SOpYuqd7giETMjSCfOvgqy6X1RopsIcYNechJgN61idix4tYCXnLJzVaMTo/bHknQk33p86e7UWRhg==",
      "receipt": "{\"orderId\":\"GPA.3339-1025-0076-66574\",\"packageName\":\"com.sokinternet.testing\",\"productId\":\"premium_month\",\"purchaseTime\":1750234097034,\"purchaseState\":0,\"purchaseToken\":\"klicimplbdcahahijanklmjk.AO-J1Owe-XS6990brrbJfzywIAuiH-RcXqA-UXzYX8GwcRF_P_Mc8JGkKxfpIjM6G3sbTk4g4YK-0I9PLW37fB7ZDPukK5rJlcW5l8eMn-qbWMSvWSMErzk\",\"quantity\":1,\"autoRenewing\":true,\"acknowledged\":false}"
    },
    "purchaseId": "klicimplbdcahahijanklmjk.AO-J1Owe-XS6990brrbJfzywIAuiH-RcXqA-UXzYX8GwcRF_P_Mc8JGkKxfpIjM6G3sbTk4g4YK-0I9PLW37fB7ZDPukK5rJlcW5l8eMn-qbWMSvWSMErzk",
    "purchaseDate": "2025-06-18T08:08:17.034Z",
    "isPending": false,
    "isAcknowledged": false,
    "renewalIntent": "Renew"
  }
  */

  //
  // En Android la transaction ya contiene el recibo. Se puede validar ya en el backend, y se puede llamar a finish().
  //
  if (item.platform === "android-playstore")
  {



//// Llamada a finish() -------------------

    console.log(">#V05# LISTENER IAPPurchaseApproved: Llamando a item.finish().");
    // Una vez verificado (o para pruebas), finaliza la transacción.
    // Esto le dice a la tienda que has procesado la compra. Si no lo haces,
    // la tienda seguirá intentando notificar a la app sobre esta compra 
    // -> La proxima vez que se abra la app, volverá a provocar approved con la transactión y llamará a esta función.
    item.finish();


//// Verificación en backend --------------

    const url = ( window.env === 'PRO' ? window.apiPRO : window.apiDEV ) + '/iap/verify';
    const userId = window.user_id;

    const packageName = item.nativePurchase.packageName;
    const transactionId = item.transactionId;
    const productId = item.products[0].id;
    const token = item.nativePurchase.purchaseToken;

    // Determinar si el producto es suscripción o no‑consumible
    let isSubscription = true;
    try {
      const st = window.CdvPurchase && window.CdvPurchase.store;
      const prod = st && st.get && st.get(productId);
      if (prod && prod.type) {
        isSubscription = /subscription/i.test(prod.type);
      }
    } catch (e) {
      // Si falla, mantener true por compatibilidad (suscripción por defecto)
    }

    console.log(">#V05# LISTENER IAPPurchaseApproved: platform: " + item.platform + " userId:" + userId + " packageName:" + packageName + " transactionId: " + transactionId + " productId: " + productId + " token:" + token );

    // verificar el recibo de la compra en el backend (en realidad, registrarlo).

    // Android
    const response = await fetch( url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId,                         // El id del usuario que ha efectuado la compra.
        packageName: packageName,               // El nombre de tu paquete Android.
        transactionId: transactionId,           // El Orden number que muestra al usuario en los emails y en la Store.
        productId: productId,                   // El ID del producto comprado.
        purchaseToken: token,                   // El token que devuelve Google al hacer la compra.
        isSubscription: isSubscription,         // true si es suscripción, false si es producto único.
        transaction: item                       // La transacción entera.
      })
    });
    const data = await response.json();
    var result;
    if (data.success) {
      console.log('>#V05# LISTENER IAPPurchaseApproved: Compra validada correctamente: ' + JSON.stringify(data.details));
      //  data.details:
      //  {
      //    "status":"VALID",
      //    "expiryTimeMillis":"1752147633829",
      //    "autoRenewing":true,
      //    "raw":
      //      {
      //        "startTimeMillis":"1752147333829",
      //        "expiryTimeMillis":"1752147633829",
      //        "autoRenewing":true,
      //        "priceCurrencyCode":"EUR",
      //        "priceAmountMicros":"1190000",
      //        "countryCode":"ES",
      //        "developerPayload":"",
      //        "paymentState":1,
      //        "orderId":"GPA.3357-9001-7300-75789",
      //        "purchaseType":0,
      //        "acknowledgementState":1,
      //        "kind":"androidpublisher#subscriptionPurchase"
      //      }
      //  }
      
      // const now = Date.now();
      // const durationMs = 365 * 24 * 60 * 60 * 1000; // Por ejemplo, 1 año de suscripción
      // const expires = new Date(now + durationMs);
      // result = {
      //   register_ok: true,
      //   purchase_id: product.id,
      //   purchase_expires: expires.getTime(), // timestamp en milisegundos
      //   purchase_expires_human: expires.toISOString().split("T")[0], // formato YYYY-MM-DD
      // };

      const raw = (data.details && data.details.raw) || {};
      // Para suscripciones usamos expiryTimeMillis; para no‑consumibles asignamos una fecha muy futura
      const FOREVER_TS = new Date('2099-12-31T23:59:59Z').getTime();
      if (isSubscription && raw.expiryTimeMillis) {
        result = {
          register_ok: data.details.status === "VALID",
          purchase_id: (raw.orderId || transactionId || productId),
          purchase_expires: parseInt(raw.expiryTimeMillis),
          purchase_expires_human: new Date(parseInt(raw.expiryTimeMillis)).toISOString().split("T")[0] // Fecha legible YYYY-MM-DD
        }
      } else {
        result = {
          register_ok: true,
          purchase_id: (raw.orderId || transactionId || productId),
          purchase_expires: FOREVER_TS,
          purchase_expires_human: new Date(FOREVER_TS).toISOString().split("T")[0]
        }
      }

    } else {
      console.error('>#V05# LISTENER IAPPurchaseApproved: Compra NO validada correctamente:' + JSON.stringify(data.error));

      result = {
        register_ok: false,
      };

    }

    console.log('>#V05# LISTENER IAPPurchaseApproved: Informando a la App ( window._trigger_gotPremium( result ) ).');
    // Lógica de la App
    if (window._trigger_gotPremium) {
      console.log("|||||||||||||||| window._trigger_gotPremium( result ) ||||||||||||||||");
      // Implementado en inicio.js
      window._trigger_gotPremium( result );
    } else {
      console.log("|||||||||||||||| NO se encontró window._trigger_gotPremium ||||||||||||||||");
    }


  }


  /* iOS Sandbox
  {
    "className": "Transaction",
    "transactionId": "2000000943778600",
    "state": "approved",
    "products": [
      {
        "id": "premium_month",
        "offerId": ""
      }
    ],
    "platform": "ios-appstore",
    "purchaseDate": "2025-06-19T06:28:08.000Z"
  }
  */
  //
  // En iOS, se llama a verify(), llamará a la función de verificación que se define con: store.validator = IAPPurchaseVerify
  // que es la que recibe el recibo y un callback(), Esa función lo pasa al backend (es lo que se ha de verificar) y llama al callback con el resultado 
  // ( que si contiene { ok: true }) lanza store("product").verified y su listener llama a finish()
  //
  else if (item.platform === "ios-appstore")
  {
    console.log(">#V05# LISTENER IAPPurchaseApproved: platform: " + item.platform + " Llamando a transaction.verify().")
    item.verify();
  }


  else
  {
    console.log(">#V05# LISTENER IAPPurchaseApproved: platform: " + item.platform + " Plataforma desconocida.")
  }




}

// Compra cancelada (Sólo iOS, en Android se llama a error con message USER_CANCELED)
// function IAPPurchaseCancelled(item) {
// 
//   console.log(">#V05# LISTENER IAPPurchaseCancelled: item:" + JSON.stringify(item));
// 
// }

// Listener para store.ready()
function IAPStoreReady() {
  console.log(">#V05# LISTENER 'window.CdvPurchase.store.ready'.");
  console.log(">#V05# LISTENER 'window.CdvPurchase.store.ready': window.CdvPurchase.store.products:" + JSON.stringify(window.CdvPurchase.store.products));
  window.CdvPurchase.store.products.forEach( function(product) {
    if (product.owned) {
      console.log(">#V05# LISTENER 'window.CdvPurchase.store.ready': Propietario del producto:", product.id);
    }
  });
}

// Listener para manejar errores globales de la tienda.
function IAPStoreError(error) {
  console.log(">#V05# LISTENER 'window.CdvPurchase.store.error': error.message:", error.message);
  if (error.message === "USER_CANCELED") // Android, en iOS se llama a IAPPurchaseCancelled desde store.when('product').cancelled()
    console.log(">#V05# LISTENER 'window.CdvPurchase.store.error': Compra cancelada por el usuario.");
  if (error.message === "ITEM_ALREADY_OWNED")
    console.log(">#V05# LISTENER 'window.CdvPurchase.store.error': Producto ya poseido.");
}

// Botones de IAP --------------------------------------------

// Lista de productos
function IAPgetProducts() {

  /*
  [
    {
      "className": "Product",
      "title": "Premium Month",
      "description": "",
      "platform": "android-playstore",
      "type": "paid subscription",
      "id": "premium_month",
      "offers": [
        {
          "className": "Offer",
          "id": "premium_month@montly",
          "pricingPhases": [
            {
              "price": "€1.19",
              "priceMicros": 1190000,
              "currency": "EUR",
              "billingPeriod": "P1M",
              "billingCycles": 0,
              "recurrenceMode": "INFINITE_RECURRING",
              "paymentMode": "PayAsYouGo"
            }
          ],
          "productId": "premium_month",
          "productType": "paid subscription",
          "platform": "android-playstore",
          "type": "subs",
          "tags": [],
          "token": "Aezw0sk4eGYv78oihNgPfOqJkdvYGoGbZWfulF+5j2m19SBV5+xaBwjCfrw8MtpXr7CszOus7SzbqZ8="
        }
      ]
    },
    {
      "className": "Product",
      "title": "Premium Anual",
      "description": "",
      "platform": "android-playstore",
      "type": "paid subscription",
      "id": "premium_anual",
      "offers": [
        {
          "className": "Offer",
          "id": "premium_anual@premiumanual",
          "pricingPhases": [
            {
              "price": "€2.39",
              "priceMicros": 2390000,
              "currency": "EUR",
              "billingPeriod": "P1M",
              "billingCycles": 0,
              "recurrenceMode": "INFINITE_RECURRING",
              "paymentMode": "PayAsYouGo"
            }
          ],
          "productId": "premium_anual",
          "productType": "paid subscription",
          "platform": "android-playstore",
          "type": "subs",
          "tags": [],
          "token": "Aezw0smW5d7ONlvzIL/N5KjJr+438kMe3/WzM3t2zYXN0tFJQtY8dduwK4uoWStDgf3omSw9Q9UImTGvLoacmOrIfQ=="
        }
      ]
    }
  ]
  */

  Rlog()
  // Rlog(">#V05# IAPgetProducts. window.CdvPurchase.store.products:" + JSON.stringify(window.CdvPurchase.store.products));

  console.log( ">#V05# IAPgetProducts. window.CdvPurchase.store.products:" );
  window.CdvPurchase.store.products.forEach( function( product ) {
    console.log( ">#V05# IAPgetProducts. -> " + product.id );
    Rlog( ">#V05# IAPgetProducts. -> " + product.id )
  } );

};

// Lanzar compra
function IAPbuyProduct(productId) {
    Rlog()
    Rlog(">#V05#> IAPbuyProduct(): Comprar el producto: " + productId);
    const product = window.CdvPurchase.store.get(productId);
    Rlog(">#V05#> IAPbuyProduct(): typeof product: " + (typeof product))
    if (!product) {
        Rlog('>#V05#> IAPbuyProduct(): !product: El producto no se ha encontrado.');
        return;
    }
    if (!product.canPurchase) {
        Rlog('>#V05#> IAPbuyProduct(): !product.canPurchase: Este producto no está disponible para la compra en este momento.');
        return;
    }
    const offer = product && product.offers && product.offers[0];
    if (!offer)
    {
        Rlog(">#V05#> IAPbuyProduct(): Error: La 'oferta' no se ha encontrado.");
        return;      
    }
    Rlog(">#V05#> IAPbuyProduct(): window.CdvPurchase.store.order(offer): " + JSON.stringify(offer));
    window.CdvPurchase.store.order(offer);
}



// Comprobar posesión
function IAPcheckOwned(productId)
{

  /*
  {
    "className": "Product",
    "title": "Premium Month",
    "description": "",
    "platform": "android-playstore",
    "type": "paid subscription",
    "id": "premium_month",
    "offers": [
      {
        "className": "Offer",
        "id": "premium_month@montly",
        "pricingPhases": [
          {
            "price": "€1.19",
            "priceMicros": 1190000,
            "currency": "EUR",
            "billingPeriod": "P1M",
            "billingCycles": 0,
            "recurrenceMode": "INFINITE_RECURRING",
            "paymentMode": "PayAsYouGo"
          }
        ],
        "productId": "premium_month",
        "productType": "paid subscription",
        "platform": "android-playstore",
        "type": "subs",
        "tags": [],
        "token": "Aezw0sk4eGYv78oihNgPfOqJkdvYGoGbZWfulF+5j2m19SBV5+xaBwjCfrw8MtpXr7CszOus7SzbqZ8="
      }
    ]
  }
  */

  Rlog()
  Rlog(">#V05#> IAPcheckOwned(): " + productId);
  const product = window.CdvPurchase.store.get(productId);
  Rlog(">#V05#> IAPcheckOwned(): typeof product" + ( typeof product ))
  if (!product) {
      Rlog('>#V05#> IAPcheckOwned(): Error: El producto no se ha encontrado.')
      return;
  }
  Rlog('>#V05#> IAPcheckOwned(): store.owned(produc). product:' + JSON.stringify(product));
  Rlog(">#V05#> IAPcheckOwned(): store.owned(product):" + ( window.CdvPurchase.store.owned(product)))

}

// Restaurar compras
function IAPrestorePurchases() {
    Rlog()
    Rlog(">#V05#> IAPrestorePurchases: window.CdvPurchase.store.restorePurchases().");
    window.CdvPurchase.store.restorePurchases();
}

// Refrescar store
function IAPUpdate() {
    Rlog()
    Rlog(">#V05#> IAPRefresh: window.CdvPurchase.store.update().");
    window.CdvPurchase.store.update();
}

async function testBackend(platform) {

  Rlog()
  Rlog(">#V05# testBackend")

  let item;
  if (platform == "android-playstore")
    item = {"className":"Transaction","transactionId":"GPA.3357-3762-0146-41549","state":"approved","products":[{"id":"premium_month"}],"platform":"android-playstore","nativePurchase":{"orderId":"GPA.3357-3762-0146-41549","packageName":"com.sokinternet.testing","productId":"premium_month","purchaseTime":1750245802935,"purchaseState":0,"purchaseToken":"hmfainpchpojhmhmcleohafh.AO-J1Oz-KQSKw1_VqmgsSkvbltOFDGsm826JXdd3Z9pm8LVQPVAwvbKIy8yEI-a76QbubMzNaKoab1BNpM-sAIZGgkhT1N0_xbvIJ_TjV9bH8A8RsnFu8_I","quantity":1,"autoRenewing":true,"acknowledged":false,"productIds":["premium_month"],"getPurchaseState":1,"developerPayload":"","accountId":"","profileId":"","signature":"PHfAuXZIF5miv7jrQ+s8ciJoky5nmMVUXNhvpgV/eISZwydSp5jW4BaZY/BIxgUywEv/LhzAgG02pUDDf7EZqyVqgtBGoKy1JRADWmeOyf3fjzm0C0Hp5qIkd8jRHCWboeoWRP3U9bYTS8k/jpxPouMMMRYWVRfJyTh3fGf1A41P4o9PGnVydhBGAcPQzZcOYvdJQDbAkg4vxH9U0o6By+1Wcc3ci1C1XGDDAcPxU36u+VFxs/UfZleL+4DuDUOhTnE0m6obdks/vIOlTAQibJWD3jQ9AO2azac/JSfE8mSeMoauXFrV1BcT3KG+qn+K5bZ+JXIB8RKF4p0eWYTb4A==","receipt":"{\"orderId\":\"GPA.3357-3762-0146-41549\",\"packageName\":\"com.sokinternet.testing\",\"productId\":\"premium_month\",\"purchaseTime\":1750245802935,\"purchaseState\":0,\"purchaseToken\":\"hmfainpchpojhmhmcleohafh.AO-J1Oz-KQSKw1_VqmgsSkvbltOFDGsm826JXdd3Z9pm8LVQPVAwvbKIy8yEI-a76QbubMzNaKoab1BNpM-sAIZGgkhT1N0_xbvIJ_TjV9bH8A8RsnFu8_I\",\"quantity\":1,\"autoRenewing\":true,\"acknowledged\":false}"},"purchaseId":"hmfainpchpojhmhmcleohafh.AO-J1Oz-KQSKw1_VqmgsSkvbltOFDGsm826JXdd3Z9pm8LVQPVAwvbKIy8yEI-a76QbubMzNaKoab1BNpM-sAIZGgkhT1N0_xbvIJ_TjV9bH8A8RsnFu8_I","purchaseDate":"2025-06-18T11:23:22.935Z","isPending":false,"isAcknowledged":false,"renewalIntent":"Renew"}

  // Copiado de IAPPurchaseApproved
  if (item.platform === "android-playstore")
  {
    const url = ( window.env === 'PRO' ? window.apiPRO : window.apiDEV ) + '/iap/verify';
    const userId = window.user_id;

    const packageName = item.nativePurchase.packageName;
    const transactionId = item.transactionId;
    const productId = item.products[0].id;
    const token = item.nativePurchase.purchaseToken;

    // Determinar si el producto es suscripción o no‑consumible
    let isSubscription = true;
    try {
      const st = window.CdvPurchase && window.CdvPurchase.store;
      const prod = st && st.get && st.get(productId);
      if (prod && prod.type) {
        isSubscription = /subscription/i.test(prod.type);
      }
    } catch (e) { }

    Rlog(">#V05# testBackend: " + item.platform + "userId:" + userId + " packageName:" + packageName + " transactionId: " + transactionId + " productId: " + productId + " token:" + token );

    // Android
    const response = await fetch( url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId,                         // El id del usuario que ha efectuado la compra.
        packageName: packageName,               // El nombre de tu paquete Android.
        transactionId: transactionId,           // El Orden number que muestra al usuario en los emails y en la Store.
        productId: productId,                   // El ID del producto comprado.
        purchaseToken: token,                   // El token que devuelve Google al hacer la compra.
        isSubscription: isSubscription,         // true si es suscripción, false si es producto único.
        transaction: item                       // La transacción entera.
      })
    });
    const data = await response.json();
    if (data.success) {
      Rlog('>#V05# testBackend: Compra validada correctamente: ' + JSON.stringify(data.details));      
    } else {
      Rlog('>#V05# testBackend: Error al validar la compra: ' + JSON.stringify(data.error));
    }
  }

}

/// ----------------------------------------------------------------------------------- Para el plugin de Cordova

document.addEventListener('deviceready', function () {

  console.log(">#C00#> deviceready >>>");

  if ( window.CdvPurchase && window.CdvPurchase.store ) {
    console.log( ">#C00#> deviceready : Plugin de compras cargado." );
    InAppPurchasesInit();
  } else {
    console.log( ">#C00#> deviceready : Plugin de compras NO cargado. plugins Capacitor: " );
  }

  // Forzar overlay de StatusBar en Android para evitar doble padding del header.
  // A veces Android coloca el WebView debajo de la barra y se suma el safe-area.
  // Con esto superponemos el WebView a la barra y alineamos el toolbar.
  try {
    if (window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'android') {
      const sb = window.Capacitor.Plugins?.StatusBar;
      if (sb) {
        sb.setOverlaysWebView({ overlay: true });
        sb.setBackgroundColor({ color: '#f4f6fb' }); // fondo claro de la app
        sb.setStyle({ style: 'LIGHT' }); // iconos oscuros
        sb.getInfo()
          .then((info) => console.log('>#[SB] info', info))
          .catch(() => {});
        // Ajustar padding de safe-area en el DOM cuando se superpone la barra
        try {
          document.documentElement.style.setProperty('--ion-safe-area-top', '0px');
          document.documentElement.style.setProperty('--ion-statusbar-padding', '0px');
        } catch (err) {
          console.log('>#[SB] css var error', err);
        }
        // Segundo intento con pequeño retardo, por si el primero se pierde durante la carga
        setTimeout(() => {
          try {
            sb.setOverlaysWebView({ overlay: true });
            sb.getInfo()
              .then((info) => console.log('>#[SB] info (retry)', info))
              .catch(() => {});
          } catch (e) {
            console.log('>#[SB] retry error', e);
          }
        }, 150);
      }
    }
  } catch (err) {
    console.log('>#[SB] error forzando overlay/status', err);
  }

});

/// ----------------------------------------------------------------------------------- Para los plugins de Capacitor

window.apiDEV = 'https://apidev.curso-ingles.com';
window.apiPRO = 'https://api.curso-ingles.com'; 
window.env = 'PRO'; // 'PRO' o 'DEV'  

window.varGlobal = {
  apiURL: window.env === 'PRO' ? window.apiPRO : window.apiDEV,
  auth_key: '3fD8i03kNCqxj/2hyDR2Ngytgez0DFXjimBYF5HjfHf3Td2kU5lXVSqBv1S\\nxZ9rj7UZ6lGMUdspSqPIGArs8w',
  locale: "es"
};

const USER_STORAGE_KEY = 'appv5:user';
window.user = window.user || null;

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('[user] error leyendo localStorage', err);
    return null;
  }
};

const writeStoredUser = (user) => {
  try {
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  } catch (err) {
    console.error('[user] error guardando localStorage', err);
  }
};

const notifyUserChange = (user) => {
  try {
    window.dispatchEvent(new CustomEvent('app:user-change', { detail: user }));
  } catch (err) {
    console.error('[user] error notificando cambio', err);
  }
};

window.setUser = (user) => {
  window.user = user || null;
  writeStoredUser(window.user);
  notifyUserChange(window.user);
};

window.loadUser = () => {
  const stored = readStoredUser();
  if (stored) {
    window.user = stored;
  } else if (!window.user) {
    window.user = null;
  }
  notifyUserChange(window.user);
  if (window.user) {
    refreshUserAvatarLocal(window.user);
  }
  return window.user;
};

const getUserAvatarRemoteCandidates = (user) => {
  if (!user || !user.image) return [];
  const raw = String(user.image);
  const candidates = [];
  const isS3 = raw.includes('s3.amazonaws.com/');
  const hasAudios = raw.includes('sk.audios.dev');
  const hasAssets = raw.includes('sk.assets');
  if (isS3 && (hasAudios || hasAssets) && raw.includes('/avatars/')) {
    let assetsUrl = raw;
    let originalUrl = raw;
    if (hasAudios) {
      assetsUrl = raw.replace('sk.audios.dev', 'sk.assets').replace('/original/', '/');
      originalUrl = raw;
    } else {
      assetsUrl = raw;
      originalUrl = raw.replace('sk.assets', 'sk.audios.dev');
      if (!originalUrl.includes('/original/')) {
        originalUrl = originalUrl.replace(/\/avatars\/([^/]+)\//, '/avatars/$1/original/');
      }
    }
    [assetsUrl, originalUrl].forEach((url) => {
      if (url && !candidates.includes(url)) candidates.push(url);
    });
  } else {
    candidates.push(raw);
  }
  return candidates;
};

const getUserAvatarRemote = (user) => {
  const candidates = getUserAvatarRemoteCandidates(user);
  return candidates[0] || '';
};

window.getUserAvatarRemoteCandidates = getUserAvatarRemoteCandidates;

const getUserAvatarPath = (user) => {
  if (!user) return '';
  if (user.image_path) return user.image_path;
  if (user.id !== undefined && user.id !== null) {
    return `avatars/${user.id}.jpg`;
  }
  if (typeof user.image_local === 'string') {
    const match = user.image_local.match(/\/avatars\/[^/?#]+/);
    if (match) return match[0].replace(/^\//, '');
  }
  return '';
};

const refreshUserAvatarLocal = async (user) => {
  const fs = window.Capacitor?.Plugins?.Filesystem;
  if (!fs || !user) return;

  const directory = 'DATA';
  const path = getUserAvatarPath(user);
  if (!path) return;

  try {
    await fs.stat({ path, directory });
    const { uri } = await fs.getUri({ path, directory });
    const local =
      window.Capacitor && typeof window.Capacitor.convertFileSrc === 'function'
        ? window.Capacitor.convertFileSrc(uri)
        : uri;
    if (local && (user.image_local !== local || user.image_path !== path)) {
      user.image_local = local;
      user.image_path = path;
      window.setUser(user);
    }
    return;
  } catch (err) {
    // no-op
  }

  const remotes = getUserAvatarRemoteCandidates(user);
  if (!remotes.length) return;
  if (window.navigator && window.navigator.onLine === false) return;

  try {
    await fs.mkdir({ path: 'avatars', directory, recursive: true });
  } catch (err) {
    // no-op
  }

  let downloaded = false;
  for (const remote of remotes) {
    try {
      const uri = await download(remote, path, directory);
      const local =
        window.Capacitor && typeof window.Capacitor.convertFileSrc === 'function'
          ? window.Capacitor.convertFileSrc(uri)
          : uri;
      if (local) {
        user.image_local = local;
        user.image_path = path;
        window.setUser(user);
      }
      downloaded = true;
      break;
    } catch (err) {
      // try next candidate
    }
  }
  if (!downloaded) {
    const fallbackRemote = remotes[0];
    if (fallbackRemote && (user.image_local !== fallbackRemote || user.image_path !== path)) {
      user.image_local = fallbackRemote;
      user.image_path = path;
      window.setUser(user);
    }
  }
};

window.loadUser();

async function download(url, path, directory = 'DATA') {
  console.log('>#[FS] download:', url, '->', directory + '/' + path);
  const fs = window.Capacitor?.Plugins?.Filesystem;
  if (!fs) throw new Error('Filesystem plugin no disponible');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const blob = await res.blob();
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  await fs.writeFile({ path, data: base64, directory, recursive: true });
  const { uri } = await fs.getUri({ path, directory });
  return uri; // usa Capacitor.convertFileSrc(uri) para mostrarlo en <img>
}


async function sendMail() {

  console.log(">#C02#> sendMail.");

  const platform = window.r34lp0w3r?.platform || 'unknown';
  const uuid = window.uuid || localStorage.getItem('uuid') || 'n/a';  

  const txtSubject = "I have commentaries."
  const email = "contact@sokinternet.com";
  const subject = encodeURIComponent(txtSubject + " (" + platform + ") (" + uuid + ")");
  const mailtoURL = `mailto:${email}?subject=${subject}`;

  console.log(">#C02#> sendMail (window.location.href='" + mailtoURL + "').");
  window.location.href = mailtoURL;

}

async function goWebLegal() {

  console.log(">#C02#> goWebLegal.");
  
  const url = "https://www.curso-ingles.com/en/support/legal-data";
  if (window.Capacitor) {
    console.log(">#C02#> goWebLegal (window.open(" + url + ", '_system')).");
    window.open(url, '_system'); // funciona en apps nativas
  } else {
    console.log(">#C02#> goWebLegal (window.open(" + url + ", '_blank')).");
    window.open(url, '_blank');  // para navegador
  }

}

function deviceId() {
  return "XXXX-XXXX-XXXX-XXXX";
}

async function doPost( endpoint, userInfo, data ) {
  console.log(">#C02#> doPost.");

  if (!data) data={};

  // Si endpoint contiene ya un '?', se pone el timestamp con '&', si no con '?'
  if (endpoint.indexOf("?")>-1)
    var char="&";
  else
    var char="?";

  // Timestamp
  const timestamp = Math.round(+new Date()/1000);
  data["timestamp"] = timestamp;
  // user_id & user_token
  if (userInfo)
  {
    let user_id = userInfo.id;
    let token = userInfo.token;
    data["user_id"] = userInfo.id;
    data["token"] = userInfo.token;
  }

  console.log(">#C02#> doPost. endpoint:", endpoint);          
  console.log(">#C02#> doPost. data: ",JSON.stringify(data));

  /*
  if (userInfo)
    var hash = CryptoJS.HmacSHA256(endpoint.toLowerCase()+"?timestamp="+timestamp+"&user_id="+user_id+"&token="+token, varGlobal.auth_key);
  else
    var hash = CryptoJS.HmacSHA256(endpoint.toLowerCase()+"?timestamp="+timestamp, varGlobal.auth_key);
  */
  var hash = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
  console.log(">#C02#> doPost. hash:", hash);  

  //var signature = CryptoJS.enc.Base64.stringify(hash);  
  var signature = hash;
  console.log(">#C02#> doPost. signature:", signature);

  const headers = {
    "Content-Type": "application/json",
    "Authorization": signature,
    "X-Platform": deviceId()
  };

  const url = varGlobal.apiURL + endpoint;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(data)
    });

    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (err) {
        payload = text;
      }
    }

    const result = {
      ok: response.ok,
      status: response.status,
      data: payload
    };

    if (result.ok) {
      if (result.data.error) {
        console.log(">#C02#> doPost. error in data:", JSON.stringify(result.data.error));
        result.ok = false;
      } else {
        console.log(">#C02#> doPost. success:", JSON.stringify(result));
      }
    } else {
      console.log(">#C02#> doPost. error:", JSON.stringify(result));
    }

    return result;
  } catch (err) {
    console.log(">#C02#> doPost. error:", err);
    return {
      ok: false,
      status: 0,
      error: err && err.message ? err.message : String(err)
    };
  }

}


document.addEventListener('DOMContentLoaded', async function() {

  console.log(">#C00#> DOMContentLoaded >>>");

//arreglaStatusBar(); // Solo en iOS tiene efecto
//escondeStatusBar();


  const plugins = window.Capacitor && window.Capacitor.Plugins || {};
  console.log('>#C00#> Plugins disponibles:', JSON.stringify(Object.keys(plugins)));

  // Mostrar información del dispositivo (Viene del inicializador nativo de la app)
  mostrarR34lp0w3r();

  //
  ///// PushNotifications
  if (plugins.PushNotifications)
    PushNotificationsInit()
  else
    console.log('>#C04#> PushNotifications no disponible.');
  /////
  //

  //
  ///// Registrar los listeners de Capacitor.App
  if (plugins.App && typeof plugins.App.addListener === 'function') {
    console.log(">#C02#> Plugin App (loginSocial): 📲 Registrando listener appUrlOpen.");

    // Registrar el listener para appUrlOpen para manejar URLs con esquema app://
    plugins.App.addListener('appUrlOpen', async function(info) {
      console.log(">#C02#> Plugin App (loginSocial): 📥 appUrlOpen ACTIVADO con URL:", info.url);

      try {
        await plugins.Browser.close();
      } catch (err) {
        console.log('>#C02#> Plugin App (loginSocial): No se pudo cerrar Browser:', err);
      }

      const url = new URL(info.url);

      if (!url.href.startsWith('app://callback')) {
        console.log('>#C02#> Plugin App (loginSocial): Ignorando URL no esperada:', url.href);
        return;
      }

      // Implementado en index.js
      if (window.loginCallbackFromBrowser) {
        console.log("|||||||||||||||| window.loginCallbackFromBrowser(info.url) ||||||||||||||||")
        window.loginCallbackFromBrowser(info.url);
        return;
      }
      procesarLoginDesdeCallback(info.url);
    });

    // Registrar el listener appStateChange para pause y resume
    console.log(">#C02#> Plugin App: 📲 Registrando listener appStateChange.");
    plugins.App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        console.log('--- Capacitor.Plugins.App.appStateChange: App resumed ---');
        // Implementado en index.js
        if (window._trigger_resume) {
          console.log("|||||||||||||||| window._trigger_resume ||||||||||||||||")
          window._trigger_resume();
        }        
      } else {
        console.log('--- Capacitor.Plugins.App.appStateChange: App paused ---');
        // Implementado en index.js
        if (window._trigger_pause) {
          console.log("|||||||||||||||| window._trigger_pause ||||||||||||||||")
          window._trigger_pause();
        }
      }
    });
  } else {
    console.log('>#C02#> loginSocial: Plugin App no disponible o sin método addListener.');
  }
  /////
  //

  //
  ///// Registrar los listeners de Capacitor.Network
  if (plugins.Network && typeof plugins.Network.addListener === 'function') {
    console.log(">#C02#> Plugin Network: 📲 Registrando listener networkStatusChange.");
    plugins.Network.addListener('networkStatusChange', status => {
      if (status.connected) {
        console.log('--- Capacitor.Plugins.Network.networkStatusChange: App connected ---');
        // Implementado en index.js
        if (window._trigger_online) {
          console.log("|||||||||||||||| window._online ||||||||||||||||")
          window._trigger_online();
        }
      } else {
        console.log('--- Capacitor.Plugins.Network.networkStatusChange: App disconnected ---');
        // Implementado en index.js
        if (window._trigger_offline) {
          console.log("|||||||||||||||| window._trigger_offline ||||||||||||||||")
          window._trigger_offline();
        }
      }
    });
  } else {
    console.log('>#C02#> loginSocial: Plugin Network no disponible o sin método addListener.');
  }
  /////
  //


  //
  ///// SplashScreen
  setTimeout(() => {    
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SplashScreen) {
      window.Capacitor.Plugins.SplashScreen.hide();
      console.log('>#C00.03#> Ocultando el splash.');
    } else {
      console.log('>#C00.03#> SplashScreen plugin no disponible.');
    }
  }, 500); // espera para que se note
  /////
  //


  //
  ///// eventos de Cordova.Plugins.Keyboard
  const Keyboard = plugins.Keyboard;
  if (Keyboard) {
    Keyboard.addListener('keyboardWillShow', async (info) => {
      console.log(">#C00.04#> Cordova.Plugins.Keyboard.keyboardWillShow(info). info:",JSON.stringify(info));
    })

    Keyboard.addListener('keyboardDidShow', async info => {
      console.log(">#C00.04#> Cordova.Plugins.Keyboard.keyboardDidShow(info). info:",JSON.stringify(info));

      if ( r34lp0w3r.platform == "ios" ) return;
        
      console.log(`>#C00.04#> Redimensionando WebView ${info.keyboardHeight} px.`)

      // Se supone que no debería, pero viene en dp:
      const keyboardHeightPx = Math.round(info.keyboardHeight * window.devicePixelRatio);
      await Capacitor.Plugins.P4w4Plugin.resizeWebView({ offset: keyboardHeightPx });

      // Si viniera en px (Como dice la documentación)
      // await Capacitor.Plugins.P4w4Plugin.resizeWebView({ offset: info.keyboardHeight })

      window.__keyboardHeight = keyboardHeightPx
    })
    Keyboard.addListener('keyboardWillHide', async info => {
      console.log(">#C00.04#> Cordova.Plugins.Keyboard.keyboardWillHide(info). info:",JSON.stringify(info));
      console.log(`>#C00.04#> Redimensionando WebView -${window.__keyboardHeight} px.`)

      if ( r34lp0w3r.platform == "ios" ) return; // Si es Android, reducir el WebView para dejar espacio al teclado

      await Capacitor.Plugins.P4w4Plugin.resizeWebView({ offset: -window.__keyboardHeight })      
    })

    Keyboard.addListener('keyboardDidHide', async info => {
      console.log(">#C00.04#> Cordova.Plugins.Keyboard.keyboardDidHide(info). info:",JSON.stringify(info));
    })
  }
  /////
  //


  //
  ///// Sólo para browser  
  ///// Lanzar evento deviceready() -> Aqui arriba hay un listener y en index.js está el de app.deviceready(), que también se disparará
  if ( !window.Capacitor )
  {
    (function () {
      
      //const yaLanzado = window._devicereadyLanzado || false;

      //const cordovaReal = typeof cordova === 'object' && typeof cordova.plugins === 'object';

      //if (!cordovaReal && !yaLanzado) {

        console.log(">>>>>")
        console.log(">>>>>")
        console.log('>>>>> [WEB] Lanzando evento deviceready() manualmente');
        console.log(">>>>>")
        console.log(">>>>>")

        //window._devicereadyLanzado = true;

        window.addEventListener('load', function () {
          setTimeout(() => {
            const evt = document.createEvent('Event');
            evt.initEvent('deviceready', true, true);
            document.dispatchEvent(evt);
          }, 100);
        });

      //}

    })();
  }
  /////
  //


  // Eliminar el número badge (notificaciones push) en iOS
  /////
  window.resetBadgeCount = function() {
    if (r34lp0w3r.platform === "ios") {
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.P4w4Plugin ) {
        console.log(">#C00.05#> window.Capacitor.Plugins.P4w4Plugin.resetBadgeCount().");
        window.Capacitor.Plugins.P4w4Plugin.resetBadgeCount();
      } else {
        console.log(">#C00.05#> No existe window.Capacitor.Plugins.P4w4Plugin.resetBadgeCount().");
      }
    }
  }
  /////
  //

  // En v5 se encarga init.js de lo que hacia la app angular.
  //app.initialize()

  console.log(">#C00#> DOMContentLoaded <<<");

})
console.log(">#C00#> 006.001 _r34lp0w3r_.js <<<")
