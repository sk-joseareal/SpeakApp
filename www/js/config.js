// Configuración básica para endpoints y entorno
(function () {
  window.env = window.env || 'PRO'; // 'PRO' o 'DEV'
  window.apiPRO = window.apiPRO || 'https://api.curso-ingles.com';
  window.apiDEV = window.apiDEV || 'https://apidev.curso-ingles.com';

  // Identificador de usuario si la app lo establece en runtime
  window.user_id = window.user_id || null;

  window.appMeta = window.appMeta || {
    version: window.APP_VERSION || '1.0.0',
    build: window.APP_BUILD || '8'
  };

  const emitAppMeta = () => {
    try {
      window.dispatchEvent(new CustomEvent('app:meta-change', { detail: window.appMeta }));
    } catch (err) {
      // no-op
    }
  };

  const setAppMeta = (next) => {
    if (!next || typeof next !== 'object') return;
    window.appMeta = { ...(window.appMeta || {}), ...next };
    emitAppMeta();
  };

  window.setAppMeta = window.setAppMeta || setAppMeta;

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
  if (window.realtimeConfig.chatbotUsageDailyEndpoint === undefined) {
    window.realtimeConfig.chatbotUsageDailyEndpoint =
      window.REALTIME_CHATBOT_USAGE_DAILY_ENDPOINT ||
      'https://realtime.curso-ingles.com/realtime/chatbot/usage/daily';
  }
  if (window.realtimeConfig.chatbotUsageLimitEndpoint === undefined) {
    window.realtimeConfig.chatbotUsageLimitEndpoint =
      window.REALTIME_CHATBOT_USAGE_LIMIT_ENDPOINT ||
      'https://realtime.curso-ingles.com/realtime/chatbot/usage/limit';
  }
  if (window.realtimeConfig.ttsAlignedEndpoint === undefined) {
    window.realtimeConfig.ttsAlignedEndpoint =
      window.REALTIME_TTS_ALIGNED_ENDPOINT ||
      'https://realtime.curso-ingles.com/realtime/tts/aligned';
  }
  if (window.realtimeConfig.stateEndpoint === undefined) {
    window.realtimeConfig.stateEndpoint =
      window.REALTIME_STATE_ENDPOINT || 'https://realtime.curso-ingles.com/realtime/state/sync';
  }
  if (window.realtimeConfig.stateSummaryEndpoint === undefined) {
    window.realtimeConfig.stateSummaryEndpoint =
      window.REALTIME_STATE_SUMMARY_ENDPOINT || 'https://realtime.curso-ingles.com/realtime/state/summary';
  }
  if (window.realtimeConfig.stateSnapshotEndpoint === undefined) {
    window.realtimeConfig.stateSnapshotEndpoint =
      window.REALTIME_STATE_SNAPSHOT_ENDPOINT || 'https://realtime.curso-ingles.com/realtime/state';
  }
  if (window.realtimeConfig.stateToken === undefined) {
    window.realtimeConfig.stateToken =
      window.REALTIME_STATE_TOKEN ||
      'ca6c8ad7c431233c1d891f2bd9eebc1dbb0de269c690de994e2313b8c7e7a50';
  }
  if (window.realtimeConfig.monitorToken === undefined) {
    window.realtimeConfig.monitorToken = window.REALTIME_MONITOR_TOKEN || '';
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

  window.speakSummaryConfig = window.speakSummaryConfig || {};
  if (!window.speakSummaryConfig.range) {
    window.speakSummaryConfig.range = { min: 55, max: 98 };
  }
  if (!window.speakSummaryConfig.phrases) {
    window.speakSummaryConfig.phrases = {
      good: ['You sound like a native', 'Great job!'],
      okay: ['Almost correct!', 'Keep practicing'],
      bad: ['Keep practicing', 'Try again']
    };
  }
  if (!window.speakSummaryConfig.rewards) {
    window.speakSummaryConfig.rewards = [
      { icon: 'diamond', label: 'diamonds', min: 1, max: 3 },
      { icon: 'trophy', label: 'trophies', min: 1, max: 1 },
      { icon: 'ribbon', label: 'ribbons', min: 1, max: 2 }
    ];
  }
  if (!window.speakSummaryConfig.labelPrefix) {
    window.speakSummaryConfig.labelPrefix = 'YOU WIN';
  }
})();
