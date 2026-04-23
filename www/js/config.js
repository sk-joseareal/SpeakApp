// Configuración básica para endpoints y entorno
(function () {
  window.env = window.env || 'PRO'; // 'PRO' o 'DEV'
  window.apiPRO = window.apiPRO || 'https://api.curso-ingles.com';
  window.apiDEV = window.apiDEV || 'https://apidev.curso-ingles.com';
  const apiBase = window.env === 'PRO' ? window.apiPRO : window.apiDEV;

  // Identificador de usuario si la app lo establece en runtime
  window.user_id = window.user_id || null;

  window.appMeta = window.appMeta || {
    version: window.APP_VERSION || '5.0.1',
    build: window.APP_BUILD || '999005002'
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
    window.realtimeConfig.key = window.PUSHER_APP_KEY || 'key-46c523695ec48aaf02ae4f75';
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
  if (window.realtimeConfig.communityDmDeliveredEndpoint === undefined) {
    window.realtimeConfig.communityDmDeliveredEndpoint =
      window.REALTIME_COMMUNITY_DM_DELIVERED_ENDPOINT ||
      'https://realtime.curso-ingles.com/realtime/community/rooms/dm/delivered';
  }
  if (window.realtimeConfig.communityDmRequestsEndpoint === undefined) {
    window.realtimeConfig.communityDmRequestsEndpoint =
      window.REALTIME_COMMUNITY_DM_REQUESTS_ENDPOINT ||
      'https://realtime.curso-ingles.com/realtime/community/rooms/dm/requests';
  }
  if (window.realtimeConfig.communityDmRequestAcceptEndpoint === undefined) {
    window.realtimeConfig.communityDmRequestAcceptEndpoint =
      window.REALTIME_COMMUNITY_DM_REQUEST_ACCEPT_ENDPOINT ||
      'https://realtime.curso-ingles.com/realtime/community/rooms/dm/requests/accept';
  }
  if (window.realtimeConfig.communityDmRequestDeclineEndpoint === undefined) {
    window.realtimeConfig.communityDmRequestDeclineEndpoint =
      window.REALTIME_COMMUNITY_DM_REQUEST_DECLINE_ENDPOINT ||
      'https://realtime.curso-ingles.com/realtime/community/rooms/dm/requests/decline';
  }
  if (window.realtimeConfig.communityDmRequestBlockEndpoint === undefined) {
    window.realtimeConfig.communityDmRequestBlockEndpoint =
      window.REALTIME_COMMUNITY_DM_REQUEST_BLOCK_ENDPOINT ||
      'https://realtime.curso-ingles.com/realtime/community/rooms/dm/requests/block';
  }
  if (window.realtimeConfig.communityDmSettingsEndpoint === undefined) {
    window.realtimeConfig.communityDmSettingsEndpoint =
      window.REALTIME_COMMUNITY_DM_SETTINGS_ENDPOINT ||
      'https://realtime.curso-ingles.com/realtime/community/rooms/dm/settings';
  }
  if (window.realtimeConfig.communityDmBlocksEndpoint === undefined) {
    window.realtimeConfig.communityDmBlocksEndpoint =
      window.REALTIME_COMMUNITY_DM_BLOCKS_ENDPOINT ||
      'https://realtime.curso-ingles.com/realtime/community/rooms/dm/blocks';
  }
  if (window.realtimeConfig.communityDmUnblockEndpoint === undefined) {
    window.realtimeConfig.communityDmUnblockEndpoint =
      window.REALTIME_COMMUNITY_DM_UNBLOCK_ENDPOINT ||
      'https://realtime.curso-ingles.com/realtime/community/rooms/dm/blocks/unblock';
  }
  if (window.realtimeConfig.pushRegisterEndpoint === undefined) {
    window.realtimeConfig.pushRegisterEndpoint =
      window.REALTIME_PUSH_REGISTER_ENDPOINT ||
      'https://realtime.curso-ingles.com/realtime/push/register';
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
  if (window.realtimeConfig.openaiModerationEndpoint === undefined) {
    window.realtimeConfig.openaiModerationEndpoint =
      window.REALTIME_OPENAI_MODERATION_ENDPOINT ||
      'https://realtime.curso-ingles.com/realtime/openai/moderation';
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
  if (window.realtimeConfig.authToken === undefined) {
    window.realtimeConfig.authToken =
      window.REALTIME_AUTH_TOKEN ||
      'ca6c8ad7c431233c1d891f2bd9eebc1dbb0de269c690de994e2313b8c7e7a50';
  }
  if (window.realtimeConfig.monitorToken === undefined) {
    window.realtimeConfig.monitorToken = window.REALTIME_MONITOR_TOKEN || '';
  }
  if (window.realtimeConfig.enabledTransports === undefined) {
    window.realtimeConfig.enabledTransports = ['ws'];
  }
  if (window.realtimeConfig.channelType === undefined) {
    window.realtimeConfig.channelType = 'private';
  }
  if (window.realtimeConfig.channelPrefix === undefined) {
    window.realtimeConfig.channelPrefix = 'coach';
  }

  window.trainingStateConfig = window.trainingStateConfig || {};
  if (window.trainingStateConfig.syncEndpoint === undefined) {
    window.trainingStateConfig.syncEndpoint =
      window.TRAINING_STATE_SYNC_ENDPOINT ||
      `${apiBase}/v5/training/state/sync`;
  }
  if (window.trainingStateConfig.summaryEndpoint === undefined) {
    window.trainingStateConfig.summaryEndpoint =
      window.TRAINING_STATE_SUMMARY_ENDPOINT ||
      `${apiBase}/v5/training/state/summary`;
  }
  if (window.trainingStateConfig.snapshotEndpoint === undefined) {
    window.trainingStateConfig.snapshotEndpoint =
      window.TRAINING_STATE_SNAPSHOT_ENDPOINT ||
      `${apiBase}/v5/training/state`;
  }

  window.contentConfig = window.contentConfig || {};
  if (window.contentConfig.trainingDataEndpoint === undefined) {
    window.contentConfig.trainingDataEndpoint =
      window.CONTENT_TRAINING_DATA_ENDPOINT ||
      window.SPEAK_CONTENT_URL ||
      'https://content.curso-ingles.com/content/training-data';
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

  window.referenceToolsConfig = window.referenceToolsConfig || {};
  if (window.referenceToolsConfig.translatorEndpoint === undefined) {
    window.referenceToolsConfig.translatorEndpoint =
      window.REFERENCE_TRANSLATOR_ENDPOINT ||
      'https://api.curso-ingles.com/api/v4/tools/translator';
  }

  window.speakSummaryConfig = window.speakSummaryConfig || {};
  if (!window.speakSummaryConfig.range) {
    window.speakSummaryConfig.range = { min: 55, max: 98 };
  }
  if (!window.speakSummaryConfig.rewards) {
    window.speakSummaryConfig.rewards = [
      { icon: 'diamond', label: 'diamonds', min: 1, max: 3 }
    ];
  }

  // Keep realtime bootstrap synchronous and deterministic.
  // The chat layer relies on these values being stable from first render.
  window.realtimeConfigReady = Promise.resolve(window.realtimeConfig);
})();
