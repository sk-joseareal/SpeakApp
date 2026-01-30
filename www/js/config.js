// Configuración básica para endpoints y entorno
(function () {
  window.env = window.env || 'PRO'; // 'PRO' o 'DEV'
  window.apiPRO = window.apiPRO || 'https://api.curso-ingles.com';
  window.apiDEV = window.apiDEV || 'https://apidev.curso-ingles.com';

  // Identificador de usuario si la app lo establece en runtime
  window.user_id = window.user_id || null;

  window.realtimeConfig = window.realtimeConfig || {};
  if (window.realtimeConfig.key === undefined) {
    window.realtimeConfig.key = window.PUSHER_APP_KEY || 'dev-key-123456';
  }
  if (window.realtimeConfig.wsHost === undefined) {
    window.realtimeConfig.wsHost = window.REALTIME_HOST || 'realtime.curso-ingles.com';
  }
  if (window.realtimeConfig.wssPort === undefined) {
    window.realtimeConfig.wssPort = window.REALTIME_WSS_PORT || 443;
  }
  if (window.realtimeConfig.forceTLS === undefined) {
    const forceTLS = window.REALTIME_FORCE_TLS;
    if (forceTLS === undefined || forceTLS === null || forceTLS === '') {
      window.realtimeConfig.forceTLS = true;
    } else if (typeof forceTLS === 'string') {
      window.realtimeConfig.forceTLS = forceTLS.toLowerCase() !== 'false';
    } else {
      window.realtimeConfig.forceTLS = Boolean(forceTLS);
    }
  }
  if (window.realtimeConfig.authEndpoint === undefined) {
    window.realtimeConfig.authEndpoint =
      window.REALTIME_AUTH_ENDPOINT || 'https://realtime.curso-ingles.com/realtime/auth';
  }
  if (window.realtimeConfig.emitEndpoint === undefined) {
    window.realtimeConfig.emitEndpoint =
      window.REALTIME_EMIT_ENDPOINT || 'https://realtime.curso-ingles.com/realtime/emit';
  }
  if (window.realtimeConfig.enabledTransports === undefined) {
    window.realtimeConfig.enabledTransports = ['ws', 'wss'];
  }
  if (window.realtimeConfig.channelType === undefined) {
    window.realtimeConfig.channelType = 'private';
  }
  if (window.realtimeConfig.channelPrefix === undefined) {
    window.realtimeConfig.channelPrefix = 'coach';
  }
})();
