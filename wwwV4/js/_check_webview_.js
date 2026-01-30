
(function() {

  const userAgent = navigator.userAgent || '';
  const isAndroid = /Android/i.test(userAgent);
  const chromeMatch = userAgent.match(/Chrome\/(\d+)\./);
  let chromeVersion = 0;

  if (chromeMatch && chromeMatch[1]) {
    chromeVersion = parseInt(chromeMatch[1], 10);
  }

  const MIN_VERSION = 95;
  const AVISO_KEY = 'webview_aviso_mostrado';

  // Si ya se mostró el aviso, no lo volvemos a mostrar
  if (localStorage.getItem(AVISO_KEY)) {
    return;
  }

  const langCode = ( navigator.language || navigator.userLanguage || 'en' ).split( '-' )[0];


  // Solo aplicar el aviso si es Android
  if (
    isAndroid &&
    (!chromeVersion || chromeVersion < MIN_VERSION)
  ) {
    if ( langCode == "es" )
        alert(
          "Tu WebView del sistema (" +
          (chromeVersion ? "Chrome " + chromeVersion : "versión desconocida") +
          ") puede causar errores.\n\n" +
          "Por favor, actualiza Chrome o Android System WebView desde Google Play para evitar problemas."
        );
    else
        alert(
          "Your system WebView (" +
          (chromeVersion ? "Chrome " + chromeVersion : "unknown version") +
          ") can cause errors.\n\n" +
          "Please, update Chrome or the Android System WebView on Google Play to avoid problems."
        );

    // Guardamos en localStorage que ya se mostró
    localStorage.setItem(AVISO_KEY, '1');
  }

})();
