// Configuración básica para endpoints y entorno
(function () {
  window.env = window.env || 'PRO'; // 'PRO' o 'DEV'
  window.apiPRO = window.apiPRO || 'https://api.curso-ingles.com';
  window.apiDEV = window.apiDEV || 'https://apidev.curso-ingles.com';

  // Identificador de usuario si la app lo establece en runtime
  window.user_id = window.user_id || null;

  window.appMeta = window.appMeta || {
    version: window.APP_VERSION || '1.0.1',
    build: window.APP_BUILD || '20'
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
  if (window.realtimeConfig.communityPublicMessagesEndpoint === undefined) {
    window.realtimeConfig.communityPublicMessagesEndpoint =
      window.REALTIME_COMMUNITY_PUBLIC_MESSAGES_ENDPOINT ||
      'https://realtime.curso-ingles.com/realtime/community/public/messages';
  }
  if (window.realtimeConfig.communityPublicPresenceEndpoint === undefined) {
    window.realtimeConfig.communityPublicPresenceEndpoint =
      window.REALTIME_COMMUNITY_PUBLIC_PRESENCE_ENDPOINT ||
      'https://realtime.curso-ingles.com/realtime/community/public/presence';
  }
  if (window.realtimeConfig.communityRoomsEndpoint === undefined) {
    window.realtimeConfig.communityRoomsEndpoint =
      window.REALTIME_COMMUNITY_ROOMS_ENDPOINT ||
      'https://realtime.curso-ingles.com/realtime/community/rooms';
  }
  if (window.realtimeConfig.communityMessagesEndpoint === undefined) {
    window.realtimeConfig.communityMessagesEndpoint =
      window.REALTIME_COMMUNITY_MESSAGES_ENDPOINT ||
      'https://realtime.curso-ingles.com/realtime/community/messages';
  }
  if (window.realtimeConfig.communityDmRoomEndpoint === undefined) {
    window.realtimeConfig.communityDmRoomEndpoint =
      window.REALTIME_COMMUNITY_DM_ROOM_ENDPOINT ||
      'https://realtime.curso-ingles.com/realtime/community/rooms/dm';
  }
  if (window.realtimeConfig.communityDmReadEndpoint === undefined) {
    window.realtimeConfig.communityDmReadEndpoint =
      window.REALTIME_COMMUNITY_DM_READ_ENDPOINT ||
      'https://realtime.curso-ingles.com/realtime/community/rooms/dm/read';
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
  if (window.realtimeConfig.ttsUsageDailyEndpoint === undefined) {
    window.realtimeConfig.ttsUsageDailyEndpoint =
      window.REALTIME_TTS_USAGE_DAILY_ENDPOINT ||
      'https://realtime.curso-ingles.com/realtime/tts/usage/daily';
  }
  if (window.realtimeConfig.ttsUsageLimitEndpoint === undefined) {
    window.realtimeConfig.ttsUsageLimitEndpoint =
      window.REALTIME_TTS_USAGE_LIMIT_ENDPOINT ||
      'https://realtime.curso-ingles.com/realtime/tts/usage/limit';
  }
  if (window.realtimeConfig.pronunciationUsageDailyEndpoint === undefined) {
    window.realtimeConfig.pronunciationUsageDailyEndpoint =
      window.REALTIME_PRONUNCIATION_USAGE_DAILY_ENDPOINT ||
      'https://realtime.curso-ingles.com/realtime/pronunciation/usage/daily';
  }
  if (window.realtimeConfig.pronunciationUsageLimitEndpoint === undefined) {
    window.realtimeConfig.pronunciationUsageLimitEndpoint =
      window.REALTIME_PRONUNCIATION_USAGE_LIMIT_ENDPOINT ||
      'https://realtime.curso-ingles.com/realtime/pronunciation/usage/limit';
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

  window.contentConfig = window.contentConfig || {};
  if (window.contentConfig.trainingDataEndpoint === undefined) {
    window.contentConfig.trainingDataEndpoint =
      window.CONTENT_TRAINING_DATA_ENDPOINT ||
      window.SPEAK_CONTENT_URL ||
      'https://content.speakapp.curso-ingles.com/content/training-data';
  }
  if (window.contentConfig.trainingDataToken === undefined) {
    window.contentConfig.trainingDataToken = window.CONTENT_TRAINING_DATA_TOKEN || '';
  }
  if (window.contentConfig.allowLocalFallback === undefined) {
    const fallbackRaw = window.CONTENT_ALLOW_LOCAL_FALLBACK;
    if (typeof fallbackRaw === 'string') {
      window.contentConfig.allowLocalFallback =
        fallbackRaw.toLowerCase() === '1' ||
        fallbackRaw.toLowerCase() === 'true' ||
        fallbackRaw.toLowerCase() === 'yes';
    } else if (typeof fallbackRaw === 'boolean') {
      window.contentConfig.allowLocalFallback = fallbackRaw;
    } else {
      // Remote-first, but fallback to bundled local JSON if remote fails.
      window.contentConfig.allowLocalFallback = true;
    }
  }
  if (window.contentConfig.referenceTestsUrl === undefined) {
    window.contentConfig.referenceTestsUrl =
      window.REFERENCE_TESTS_URL || '/lessons/contenido_tests_es_en.json';
  }

  window.speakSummaryConfig = window.speakSummaryConfig || {};
  if (!window.speakSummaryConfig.range) {
    window.speakSummaryConfig.range = { min: 55, max: 98 };
  }
  if (!window.speakSummaryConfig.phrases) {
    window.speakSummaryConfig.phrases = {
      en: {
        good: ['You sound like a native', 'Great job!'],
        okay: ['Almost correct!', 'Keep practicing'],
        bad: ['Keep practicing', 'Try again']
      },
      es: {
        good: ['Suena como un nativo', 'Gran trabajo'],
        okay: ['Casi correcto', 'Sigue practicando'],
        bad: ['Sigue practicando', 'Intentalo de nuevo']
      }
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
    window.speakSummaryConfig.labelPrefix = {
      en: 'YOU WIN',
      es: 'GANAS'
    };
  }
})();
