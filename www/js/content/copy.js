const SUPPORTED_LOCALES = new Set(['es', 'en']);

export const LOCALE_META = {
  es: {
    code: 'es',
    label: 'Spanish',
    flag: 'assets/flags/spain.png',
    alt: 'Spanish',
    ttsLang: 'es-ES'
  },
  en: {
    code: 'en',
    label: 'English',
    flag: 'assets/flags/eeuu.png',
    alt: 'English',
    ttsLang: 'en-US'
  }
};

const APP_COPY = {
  es: {
    tabs: {
      training: 'Training',
      lab: 'Lab',
      reference: 'Referencia',
      you: 'You',
      chat: 'Chat'
    },
    reference: {
      title: 'Referencia',
      subtitle: 'Explora cursos, unidades y lecciones para consultar contenido.',
      selectedLesson: 'Lección seleccionada',
      noContent: 'No hay contenido para esta lección.',
      noData: 'No hay contenido de referencia disponible.',
      loading: 'Cargando referencia...',
      toggleLanguage: 'Cambiar idioma a {lang}',
      lessonListEmpty: 'Esta unidad no tiene lecciones.',
      chooseLesson: 'Selecciona una lección para ver su contenido.',
      testsTitle: 'Comprueba lo que recuerdas',
      testsSubtitle: 'Responde a los tests relacionados con esta lección y su unidad.',
      lessonTests: 'Tests de la lección',
      unitTests: 'Tests de la unidad',
      testsLoading: 'Cargando tests...',
      testsLoadError: 'No se pudieron cargar los tests de referencia.',
      testsEmpty: 'No hay tests disponibles para esta lección o unidad.',
      testsDisabled: 'Activa los tests de referencia en Diagnósticos para verlos aquí.',
      testsQuestions: '{n} preguntas',
      testsQuestionLabel: 'Pregunta {n}',
      testsWordBank: 'Banco de palabras',
      testsTapWords: 'Toca las palabras en orden para formar la respuesta.',
      testsAnswerPlaceholder: 'Respuesta',
      testsCheck: 'Corregir',
      testsReset: 'Reset',
      testsCorrect: 'Correcto',
      testsIncorrect: 'Incorrecto',
      testsResult: 'Resultado',
      testsYourAnswer: 'Tu respuesta',
      testsCorrectAnswer: 'Respuesta correcta',
      testsExplanation: 'Explicación',
      testsNoAnswer: 'Sin respuesta',
      testsSelectedTest: 'Test seleccionado',
      testsPickOne: 'Selecciona un test para empezar.'
    },
    notifications: {
      title: 'Notificaciones',
      recentActivity: 'Actividad reciente',
      empty: 'No hay notificaciones todavia.',
      statusNew: 'Nueva',
      statusRead: 'Leida',
      deleteAction: 'Eliminar',
      openAction: 'Abrir',
      elapsedNow: 'Hace un momento',
      elapsedMinutes: 'Hace {n} min',
      elapsedHours: 'Hace {n} h',
      elapsedDays: 'Hace {n} d',
      pushDefaultTitle: 'Nueva notificacion',
      defaultTitle: 'Notificacion',
      demo: {
        weakWordsTitle: 'Tienes {n} palabras flojas',
        weakWordsText: 'Ve a Review y mejora tu pronunciacion.',
        weakWordsAction: 'Revisar',
        badgeTitle: 'Nuevo badge desbloqueado',
        badgeText: 'Racha de 3 dias completada.',
        badgeAction: 'Ver perfil',
        practiceTitle: 'Mini practica lista',
        practiceText: 'Solo 2 minutos para hoy.',
        practiceAction: 'Practicar',
        coachTitle: 'Coach listo para ti',
        coachText: 'Pregunta algo al coach.',
        coachAction: 'Abrir coach',
        reminderTitle: 'Recordatorio',
        reminderText: 'Practica 5 minutos hoy.',
        reminderAction: 'Ir a Home',
        infoTitle: 'Novedad',
        infoText: 'Hay nuevos ejercicios disponibles.'
      }
    },
    login: {
      title: 'Login',
      close: 'Cerrar',
      socialGoogle: 'Login con Google',
      socialFacebook: 'Login con Fb',
      socialApple: 'Login con Apple',
      createWithEmail: 'Crear cuenta con tu email',
      userLabel: 'Usuario',
      userPlaceholder: 'tu usuario',
      passLabel: 'Contraseña',
      passPlaceholder: '********',
      enter: 'Entrar',
      forgotPassword: 'Recuperar contraseña',
      registerTitle: 'Crear cuenta',
      registerSubtitle: 'Completa los datos para registrarte.',
      registerUserLabel: 'Nombre de usuario',
      registerUserPlaceholder: 'tu nombre',
      registerEmailLabel: 'Email',
      registerEmailPlaceholder: 'tu email',
      registerPassLabel: 'Contraseña',
      registerPassPlaceholder: '********',
      registerPassConfirmLabel: 'Confirmar contraseña',
      registerPassConfirmPlaceholder: '********',
      registerTerms: 'Acepto las condiciones de uso',
      registerSubmit: 'Crear cuenta',
      registerBack: 'Volver a iniciar sesion',
      recoverTitle: 'Recuperar contraseña',
      recoverSubtitle: 'Te enviaremos un correo para restablecerla.',
      recoverEmailLabel: 'Email',
      recoverEmailPlaceholder: 'tu email',
      recoverSubmit: 'Enviar instrucciones',
      recoverBack: 'Volver a iniciar sesion',
      alertHeader: 'Atencion',
      alertOk: 'Ok',
      errors: {
        loginGeneric: 'Error de login',
        loginInvalidUser: 'El usuario no es válido',
        loginInvalidPassword: 'La contraseña no es válida',
        loginNoUserData: 'Login correcto, pero sin datos de usuario',
        socialAppleUnavailable: 'Login con Apple no disponible.',
        socialAppleOnlyApp: 'Login con Apple solo disponible en la app.',
        socialAppleOpenFailed: 'No se pudo abrir Apple.',
        socialGoogleUnavailable: 'Login con Google no disponible.',
        socialGoogleOnlyApp: 'Login con Google solo disponible en la app.',
        socialGoogleOpenFailed: 'No se pudo abrir Google.',
        socialFacebookUnavailable: 'Login con Fb no disponible.',
        socialFacebookOnlyApp: 'Login con Fb solo disponible en la app.',
        socialFacebookOpenFailed: 'No se pudo abrir Facebook.',
        registerMissingFields: 'Introduce los datos, por favor.',
        registerPasswordMismatch: 'La confirmacion no coincide con la contraseña.',
        registerTermsRequired: 'Debes aceptar las condiciones de uso.',
        registerFailed: 'Error creando la cuenta',
        recoverEmailRequired: 'Debes introducir tu email.',
        recoverFailed: 'No se pudo enviar el email'
      },
      info: {
        registerSuccess: 'Gracias. Revisa tu email para activar tu cuenta.',
        recoverSuccess: 'Te hemos enviado un correo con instrucciones para restablecer tu contraseña.'
      }
    },
    onboarding: {
      brand: 'SPEAK English',
      skip: 'Saltar',
      cta: "Let's go!",
      toggleLanguage: 'Cambiar idioma a {lang}',
      slides: {
        intro: {
          title: 'SAY like a Native',
          messageHtml:
            'Hola, vamos a enseñarte a <strong>entrenar tu pronunciación</strong> y a hablar inglés con naturalidad.',
          points: ['Y tu inglés sonará mejor', 'Tu confianza aumentará']
        },
        level: {
          title: 'SAY like a Native',
          messageHtml: 'Este es tu plan para mejorar pronunciación paso a paso en 48 días.',
          points: [
            'Sesiones cortas cada día',
            'Escucha, repite y grábate',
            'Mejora con feedback inmediato'
          ]
        },
        topics: {
          title: 'SAY like a Native',
          messageHtml: '¿Cuál es tu lengua materna?'
        }
      }
    },
    home: {
      planTitle: 'Tu plan',
      planMessage:
        'Este es tu plan para sonar como nativo.<br>Toca esta tarjeta para escucharlo otra vez.',
      toggleLanguage: 'Cambiar idioma a {lang}'
    },
    freeRide: {
      tabLabel: 'Free ride',
      title: 'Lab',
      subtitle: 'Escribe tu frase o texto y practica pronunciacion libre.',
      inputLabel: 'Tu frase',
      inputPlaceholder: 'Ejemplo: I would like to order a coffee, please.',
      emptyPhrase: 'Escribe una frase para practicar.',
      toggleLanguage: 'Cambiar idioma a {lang}',
      playPhrase: 'Escuchar frase',
      sayLabel: 'Habla',
      endLabel: 'Fin',
      yourVoiceLabel: 'Tu voz',
      feedbackHint: 'Practica la frase',
      feedbackNative: 'Suena como un nativo',
      feedbackGood: 'Bien. Sigue practicando',
      feedbackAlmost: 'Casi correcto',
      feedbackKeep: 'Sigue practicando',
      transcribing: 'Transcribiendo...'
    },
    speak: {
      practiceSound: 'Practica el sonido',
      practiceWords: 'Practica las palabras',
      practicePhrase: 'Practica la frase',
      transcribing: 'Transcribiendo...',
      feedbackNative: 'Suena como un nativo',
      feedbackGood: 'Bien. Sigue practicando',
      feedbackAlmost: 'Casi correcto',
      feedbackKeep: 'Sigue practicando',
      summaryTitleTemplates: {
        good: ['Muy bien! aprendiste {{session}}', 'Excelente! completaste {{session}}'],
        okay: ['Buen trabajo! sigue practicando {{session}}', 'Vas bien! repasa {{session}}'],
        bad: ['No pasa nada, practica {{session}}', 'Sigue intentandolo con {{session}}']
      },
      summaryPhrases: {
        good: ['Suena como un nativo', 'Gran trabajo'],
        okay: ['Casi correcto', 'Sigue practicando'],
        bad: ['Sigue practicando', 'Intentalo de nuevo']
      },
      summaryLabelPrefix: 'GANAS',
      summaryBadgeUnlocked: 'Badge desbloqueado: {route}',
      summaryContinue: 'Continuar'
    },
    chat: {
      modeCatbot: 'Catbot',
      modeChatbot: 'Chatbot',
      modeCommunity: 'Comunidad',
      communityTabPublic: 'Publico',
      communityTabChats: 'Chats',
      coachCatbotTitle: 'Coach de pronunciacion',
      coachCatbotSubtitle: 'Graba tu frase, escucha tu audio y recibe una respuesta simulada.',
      coachChatbotTitle: 'Coach de IA',
      coachChatbotSubtitle: 'Interactua libremente con el tutor de Ingles.',
      coachCommunityTitle: 'Comunidad',
      coachCommunitySubtitle: 'Entra en la sala publica y habla con otros estudiantes.',
      loadingUser: 'Cargando estado de usuario...',
      loginRequired: 'Debes iniciar sesion para usar el coach de chat.',
      loginCta: 'Iniciar sesion',
      planLocked: 'Tu plan no incluye el coach de chat.',
      planUpgrade: 'Actualiza tu plan para desbloquear esta funcionalidad.',
      inputPlaceholder: 'Escribe tu mensaje...',
      inputPlaceholderCommunity: 'Escribe al canal publico...',
      inputPlaceholderCommunityDm: 'Escribe un mensaje directo...',
      record: 'Grabar',
      stop: 'Detener',
      cancel: 'Cancelar',
      play: 'Reproducir',
      listen: 'Escuchar',
      repeat: 'Repetir',
      retrySend: 'Reintentar',
      send: 'Enviar',
      hintDefault: 'Pulsa "Grabar" y luego "Detener" para crear tu frase.',
      hintDailyLimitWithCount: 'Limite diario alcanzado: {used} / {limit} tokens. Vuelve manana.',
      hintDailyLimit: 'Limite diario del chatbot alcanzado. Vuelve manana.',
      hintListening: 'Escuchando: "{preview}"',
      hintNoAudio: 'No se detecto audio. Pulsa "Grabar" para intentarlo de nuevo.',
      hintRecordingTranscribing: 'Grabando... habla en ingles y pulsa "Detener".',
      hintRecordingSimulated: 'Grabando... pulsa "Detener" (transcripcion simulada).',
      hintRecordingGeneric: 'Grabando... pulsa "Detener" cuando termines.',
      hintTranscribing: 'Transcribiendo...',
      hintProcessing: 'Procesando audio...',
      hintRecordAgain: 'Puedes grabar otra frase cuando quieras.',
      serverUnavailable: 'El servidor no esta disponible ahora. Prueba mas tarde.',
      realtimeDisconnected: 'Conexion en tiempo real no disponible. Reintentando...',
      realtimeDisconnectedToast: 'Chat desconectado. Espera unos segundos y prueba de nuevo.',
      communityRealtimeDisconnected: 'Chat publico desconectado. Reintentando...',
      communityHistoryLoading: 'Cargando mensajes del canal publico...',
      communityHistoryEmpty: 'Aun no hay mensajes en el canal publico.',
      communityHistoryError: 'No se pudo cargar el canal publico.',
      communitySendError: 'No se pudo enviar el mensaje al canal publico.',
      communityRoomsLoading: 'Cargando chats privados...',
      communityRoomsError: 'No se pudieron cargar los chats privados.',
      communityDmSendError: 'No se pudo enviar el mensaje privado.',
      communityDmOpenError: 'No se pudo abrir el chat privado.',
      communityPresenceTemplate: '{n} online',
      communityYou: 'Tu',
      communityChatsTitle: 'Tus chats',
      communityOnlineUsersTitle: 'Usuarios online',
      communityNoChats: 'Todavia no tienes chats privados.',
      communityNoOnlineUsers: 'No hay otros usuarios online ahora.',
      communitySelectChat: 'Selecciona un chat o inicia uno desde la lista.',
      communityStartChat: 'Abrir chat',
      communityPublicBadge: 'Sala publica',
      communityDmBadge: 'Mensaje directo',
      communityNoPeerName: 'Usuario',
      transcriptReady: 'Transcripcion lista',
      transcriptSimulated: 'Transcripcion simulada',
      transcriptionUnavailable: 'Transcripcion real no disponible.',
      transcriptionFailed: 'No se pudo transcribir.',
      microphoneUnavailable: 'Microfono no disponible.',
      microphoneAccessFailed: 'No se pudo acceder al microfono.',
      typingAria: 'Escribiendo...',
      introChatbot: 'Hi!, i am your English teacher, how can i help you?',
      introCatbot: 'Hi! Record a phrase in English and I will answer with a suggestion.',
      introCommunity: 'Bienvenido al canal publico. Saluda cuando quieras.',
      introCommunityDm: 'Selecciona un chat privado para empezar.',
      sampleTranscripts: [
        'I would like to order a coffee, please.',
        'Can you help me find the train station?',
        'I am practicing my pronunciation today.',
        'Could you repeat that a little slower?',
        'I have a meeting at three o clock.',
        'What do you recommend for dinner?'
      ],
      botTemplates: [
        'Bien. Intenta marcar las palabras clave: "{text}"',
        'Buen trabajo. Ahora dilo un poco mas despacio: "{text}"',
        'Buen inicio. Enlaza mejor las palabras: "{text}"',
        'Prueba esta version con una "t" mas suave: "{text}"',
        'Repitamos con vocales mas claras: "{text}"'
      ]
    },
    profile: {
      accessPill: 'Acceso',
      loginTitle: 'Inicia sesion',
      loginSubtitle: 'Debes iniciar sesion para ver tu perfil.',
      loginCta: 'Iniciar sesion',
      contact: 'Contacto',
      legal: 'Avisos legales',
      progressLabel: 'Progreso',
      toggleLanguageAria: 'Cambiar idioma a {lang}',
      badgesTitle: 'Badges',
      badgesEmpty: 'Aún no has desbloqueado badges.',
      tabPrefs: 'Perfil',
      tabReview: 'Review',
      changePhoto: 'Cambiar foto',
      deletePhoto: 'Eliminar',
      firstName: 'Nombre',
      lastName: 'Apellidos',
      password: 'Contraseña',
      passwordNewPlaceholder: 'Nueva contraseña',
      passwordRepeat: 'Repetir contraseña',
      passwordRepeatPlaceholder: 'Repite la contraseña',
      email: 'Email',
      subscriptionUntil: 'Suscripción hasta',
      saveChanges: 'Guardar cambios',
      reviewWordsTitle: 'Palabras a revisar',
      reviewPhrasesTitle: 'Frases a revisar',
      reviewRed: 'Rojo',
      reviewYellow: 'Amarillo',
      reviewToneRedLabel: 'rojo',
      reviewToneYellowLabel: 'amarillo',
      reviewWordsEmpty: 'Aún no hay palabras en {tone}.',
      reviewPhrasesEmpty: 'No hay frases en {tone}.',
      userFallbackName: 'Usuario',
      avatarAltDefault: 'Avatar',
      avatarAltWithName: 'Avatar {name}',
      profileAvatarAlt: 'Avatar perfil',
      appMetaNA: 'v n/d',
      expiryNA: 'n/a',
      passwordBothRequired: 'Completa las dos contraseñas.',
      passwordMismatch: 'Las contraseñas no coinciden.',
      fileReadError: 'No se pudo leer el archivo.',
      fileFormatError: 'Formato no permitido. Usa JPG, PNG o GIF.',
      fileTooLarge: 'Archivo demasiado grande. Max 500 KB.',
      profileUpdateFailed: 'No se pudo actualizar el perfil.',
      profileUpdated: 'Perfil actualizado.',
      avatarUploadFailed: 'No se pudo subir el avatar.',
      avatarUpdated: 'Avatar actualizado.',
      avatarDeleteFailed: 'No se pudo eliminar el avatar.',
      avatarDeleted: 'Avatar eliminado.',
      genericActionError: 'No se pudo completar la accion.'
    }
  },
  en: {
    tabs: {
      training: 'Training',
      lab: 'Lab',
      reference: 'Reference',
      you: 'You',
      chat: 'Chat'
    },
    reference: {
      title: 'Reference',
      subtitle: 'Browse courses, units, and lessons to review content.',
      selectedLesson: 'Selected lesson',
      noContent: 'No content available for this lesson.',
      noData: 'No reference content available.',
      loading: 'Loading reference...',
      toggleLanguage: 'Switch language to {lang}',
      lessonListEmpty: 'This unit has no lessons.',
      chooseLesson: 'Select a lesson to view its content.',
      testsTitle: 'Check what you remember',
      testsSubtitle: 'Answer the tests linked to this lesson and unit.',
      lessonTests: 'Lesson tests',
      unitTests: 'Unit tests',
      testsLoading: 'Loading tests...',
      testsLoadError: 'Reference tests could not be loaded.',
      testsEmpty: 'No tests are available for this lesson or unit.',
      testsDisabled: 'Enable reference tests in Diagnostics to show them here.',
      testsQuestions: '{n} questions',
      testsQuestionLabel: 'Question {n}',
      testsWordBank: 'Word bank',
      testsTapWords: 'Tap the words in order to build the answer.',
      testsAnswerPlaceholder: 'Answer',
      testsCheck: 'Check answers',
      testsReset: 'Reset',
      testsCorrect: 'Correct',
      testsIncorrect: 'Incorrect',
      testsResult: 'Result',
      testsYourAnswer: 'Your answer',
      testsCorrectAnswer: 'Correct answer',
      testsExplanation: 'Explanation',
      testsNoAnswer: 'No answer',
      testsSelectedTest: 'Selected test',
      testsPickOne: 'Select a test to get started.'
    },
    notifications: {
      title: 'Notifications',
      recentActivity: 'Recent activity',
      empty: 'No notifications yet.',
      statusNew: 'New',
      statusRead: 'Read',
      deleteAction: 'Delete',
      openAction: 'Open',
      elapsedNow: 'Just now',
      elapsedMinutes: '{n} min ago',
      elapsedHours: '{n} h ago',
      elapsedDays: '{n} d ago',
      pushDefaultTitle: 'New notification',
      defaultTitle: 'Notification',
      demo: {
        weakWordsTitle: 'You have {n} weak words',
        weakWordsText: 'Go to Review and improve pronunciation.',
        weakWordsAction: 'Review',
        badgeTitle: 'New badge unlocked',
        badgeText: '3-day streak completed.',
        badgeAction: 'View profile',
        practiceTitle: 'Mini practice ready',
        practiceText: 'Just 2 minutes for today.',
        practiceAction: 'Practice',
        coachTitle: 'Coach is ready',
        coachText: 'Ask the coach something.',
        coachAction: 'Open coach',
        reminderTitle: 'Reminder',
        reminderText: 'Practice 5 minutes today.',
        reminderAction: 'Go to Home',
        infoTitle: 'Update',
        infoText: 'New exercises are available.'
      }
    },
    login: {
      title: 'Login',
      close: 'Close',
      socialGoogle: 'Login with Google',
      socialFacebook: 'Login with Facebook',
      socialApple: 'Login with Apple',
      createWithEmail: 'Create account with email',
      userLabel: 'User',
      userPlaceholder: 'your user',
      passLabel: 'Password',
      passPlaceholder: '********',
      enter: 'Enter',
      forgotPassword: 'Recover password',
      registerTitle: 'Create account',
      registerSubtitle: 'Complete your details to register.',
      registerUserLabel: 'Username',
      registerUserPlaceholder: 'your name',
      registerEmailLabel: 'Email',
      registerEmailPlaceholder: 'your email',
      registerPassLabel: 'Password',
      registerPassPlaceholder: '********',
      registerPassConfirmLabel: 'Confirm password',
      registerPassConfirmPlaceholder: '********',
      registerTerms: 'I accept the terms of use',
      registerSubmit: 'Create account',
      registerBack: 'Back to login',
      recoverTitle: 'Recover password',
      recoverSubtitle: 'We will send you an email to reset it.',
      recoverEmailLabel: 'Email',
      recoverEmailPlaceholder: 'your email',
      recoverSubmit: 'Send instructions',
      recoverBack: 'Back to login',
      alertHeader: 'Notice',
      alertOk: 'Ok',
      errors: {
        loginGeneric: 'Login error',
        loginInvalidUser: 'User is not valid',
        loginInvalidPassword: 'Password is not valid',
        loginNoUserData: 'Login ok, but without user data',
        socialAppleUnavailable: 'Apple login is not available.',
        socialAppleOnlyApp: 'Apple login is only available in the app.',
        socialAppleOpenFailed: 'Could not open Apple.',
        socialGoogleUnavailable: 'Google login is not available.',
        socialGoogleOnlyApp: 'Google login is only available in the app.',
        socialGoogleOpenFailed: 'Could not open Google.',
        socialFacebookUnavailable: 'Facebook login is not available.',
        socialFacebookOnlyApp: 'Facebook login is only available in the app.',
        socialFacebookOpenFailed: 'Could not open Facebook.',
        registerMissingFields: 'Please complete all fields.',
        registerPasswordMismatch: 'Confirmation does not match password.',
        registerTermsRequired: 'You must accept the terms of use.',
        registerFailed: 'Error creating account',
        recoverEmailRequired: 'You must enter your email.',
        recoverFailed: 'Could not send email'
      },
      info: {
        registerSuccess: 'Thanks. Check your email to activate your account.',
        recoverSuccess: 'We sent you an email with reset instructions.'
      }
    },
    onboarding: {
      brand: 'SPEAK English',
      skip: 'Skip',
      cta: "Let's go!",
      toggleLanguage: 'Switch language to {lang}',
      slides: {
        intro: {
          title: 'SAY like a Native',
          messageHtml:
            'Hi, we are going to teach you to <strong>train your pronunciation</strong> and speak English naturally.',
          points: ['Your English will sound better', 'Your confidence will grow']
        },
        level: {
          title: 'SAY like a Native',
          messageHtml: 'This is your step-by-step plan to improve pronunciation in 48 days.',
          points: [
            'Short daily sessions',
            'Listen, repeat, and record yourself',
            'Improve with instant feedback'
          ]
        },
        topics: {
          title: 'SAY like a Native',
          messageHtml: 'What is your native language?'
        }
      }
    },
    home: {
      planTitle: 'Your plan',
      planMessage:
        'This is your plan to sound like a native.<br>Tap this card to hear it again.',
      toggleLanguage: 'Switch language to {lang}'
    },
    freeRide: {
      tabLabel: 'Free ride',
      title: 'Lab',
      subtitle: 'Write your own phrase or longer text and practice freely.',
      inputLabel: 'Your phrase',
      inputPlaceholder: 'Example: I would like to order a coffee, please.',
      emptyPhrase: 'Write a phrase to practice.',
      toggleLanguage: 'Switch language to {lang}',
      playPhrase: 'Play phrase',
      sayLabel: 'Say',
      endLabel: 'End',
      yourVoiceLabel: 'Your voice',
      feedbackHint: 'Practice the phrase',
      feedbackNative: 'You sound like a native',
      feedbackGood: 'Good! Continue practicing',
      feedbackAlmost: 'Almost Correct!',
      feedbackKeep: 'Keep practicing',
      transcribing: 'Transcribing...'
    },
    speak: {
      practiceSound: 'Practice the sound',
      practiceWords: 'Practice the words',
      practicePhrase: 'Practice the phrase',
      transcribing: 'Transcribing...',
      feedbackNative: 'You sound like a native',
      feedbackGood: 'Good! Continue practicing',
      feedbackAlmost: 'Almost Correct!',
      feedbackKeep: 'Keep practicing',
      summaryTitleTemplates: {
        good: ['Great! You learned {{session}}', 'Excellent! You completed {{session}}'],
        okay: ['Good work! Keep practicing {{session}}', 'You are doing well! Review {{session}}'],
        bad: ['No worries, keep practicing {{session}}', 'Keep trying with {{session}}']
      },
      summaryPhrases: {
        good: ['You sound like a native', 'Great job!'],
        okay: ['Almost correct!', 'Keep practicing'],
        bad: ['Keep practicing', 'Try again']
      },
      summaryLabelPrefix: 'YOU WIN',
      summaryBadgeUnlocked: 'Badge unlocked: {route}',
      summaryContinue: 'Continue'
    },
    chat: {
      modeCatbot: 'Catbot',
      modeChatbot: 'Chatbot',
      modeCommunity: 'Community',
      communityTabPublic: 'Public',
      communityTabChats: 'Chats',
      coachCatbotTitle: 'Pronunciation coach',
      coachCatbotSubtitle: 'Record your phrase, listen to your audio, and get a simulated reply.',
      coachChatbotTitle: 'AI coach',
      coachChatbotSubtitle: 'Chat freely with your English tutor.',
      coachCommunityTitle: 'Community',
      coachCommunitySubtitle: 'Join the public room and talk with other learners.',
      loadingUser: 'Loading user state...',
      loginRequired: 'You need to sign in to use the chat coach.',
      loginCta: 'Sign in',
      planLocked: 'Your plan does not include the chat coach.',
      planUpgrade: 'Upgrade your plan to unlock this feature.',
      inputPlaceholder: 'Type your message...',
      inputPlaceholderCommunity: 'Write to the public room...',
      inputPlaceholderCommunityDm: 'Write a direct message...',
      record: 'Record',
      stop: 'Stop',
      cancel: 'Cancel',
      play: 'Play',
      listen: 'Listen',
      repeat: 'Repeat',
      retrySend: 'Retry',
      send: 'Send',
      hintDefault: 'Tap "Record" and then "Stop" to create your phrase.',
      hintDailyLimitWithCount: 'Daily limit reached: {used} / {limit} tokens. Come back tomorrow.',
      hintDailyLimit: 'Chatbot daily limit reached. Come back tomorrow.',
      hintListening: 'Listening: "{preview}"',
      hintNoAudio: 'No audio detected. Tap "Record" to try again.',
      hintRecordingTranscribing: 'Recording... speak in English and tap "Stop".',
      hintRecordingSimulated: 'Recording... tap "Stop" (simulated transcript).',
      hintRecordingGeneric: 'Recording... tap "Stop" when you finish.',
      hintTranscribing: 'Transcribing...',
      hintProcessing: 'Processing audio...',
      hintRecordAgain: 'You can record another phrase whenever you want.',
      serverUnavailable: 'The server is not available right now. Please try again later.',
      realtimeDisconnected: 'Realtime connection unavailable. Reconnecting...',
      realtimeDisconnectedToast: 'Chat disconnected. Wait a few seconds and try again.',
      communityRealtimeDisconnected: 'Public chat disconnected. Reconnecting...',
      communityHistoryLoading: 'Loading public room messages...',
      communityHistoryEmpty: 'There are no messages in the public room yet.',
      communityHistoryError: 'Could not load the public room.',
      communitySendError: 'Could not send the message to the public room.',
      communityRoomsLoading: 'Loading direct chats...',
      communityRoomsError: 'Could not load direct chats.',
      communityDmSendError: 'Could not send the direct message.',
      communityDmOpenError: 'Could not open the direct chat.',
      communityPresenceTemplate: '{n} online',
      communityYou: 'You',
      communityChatsTitle: 'Your chats',
      communityOnlineUsersTitle: 'Online users',
      communityNoChats: 'You do not have any direct chats yet.',
      communityNoOnlineUsers: 'There are no other users online right now.',
      communitySelectChat: 'Select a chat or start one from the list.',
      communityStartChat: 'Open chat',
      communityPublicBadge: 'Public room',
      communityDmBadge: 'Direct message',
      communityNoPeerName: 'User',
      transcriptReady: 'Transcript ready',
      transcriptSimulated: 'Simulated transcript',
      transcriptionUnavailable: 'Real transcription is not available.',
      transcriptionFailed: 'Could not transcribe.',
      microphoneUnavailable: 'Microphone is not available.',
      microphoneAccessFailed: 'Could not access the microphone.',
      typingAria: 'Typing...',
      introChatbot: 'Hi!, i am your English teacher, how can i help you?',
      introCatbot: 'Hi! Record a phrase in English and I will answer with a suggestion.',
      introCommunity: 'Welcome to the public room. Say hi when you want.',
      introCommunityDm: 'Select a direct chat to get started.',
      sampleTranscripts: [
        'I would like to order a coffee, please.',
        'Can you help me find the train station?',
        'I am practicing my pronunciation today.',
        'Could you repeat that a little slower?',
        'I have a meeting at three o clock.',
        'What do you recommend for dinner?'
      ],
      botTemplates: [
        'Nice! Try stressing the key words: "{text}"',
        'Good job. Now say it a bit slower: "{text}"',
        'Great start. Focus on linking the words: "{text}"',
        'Try this version with a softer "t": "{text}"',
        'Let\'s repeat with clear vowel sounds: "{text}"'
      ]
    },
    profile: {
      accessPill: 'Access',
      loginTitle: 'Sign in',
      loginSubtitle: 'You need to sign in to view your profile.',
      loginCta: 'Sign in',
      contact: 'Contact',
      legal: 'Legal',
      progressLabel: 'Progress',
      toggleLanguageAria: 'Switch language to {lang}',
      badgesTitle: 'Badges',
      badgesEmpty: 'You have not unlocked badges yet.',
      tabPrefs: 'Profile',
      tabReview: 'Review',
      changePhoto: 'Change photo',
      deletePhoto: 'Delete',
      firstName: 'First name',
      lastName: 'Last name',
      password: 'Password',
      passwordNewPlaceholder: 'New password',
      passwordRepeat: 'Repeat password',
      passwordRepeatPlaceholder: 'Repeat password',
      email: 'Email',
      subscriptionUntil: 'Subscription until',
      saveChanges: 'Save changes',
      reviewWordsTitle: 'Words to review',
      reviewPhrasesTitle: 'Phrases to review',
      reviewRed: 'Red',
      reviewYellow: 'Yellow',
      reviewToneRedLabel: 'red',
      reviewToneYellowLabel: 'yellow',
      reviewWordsEmpty: 'There are no words in {tone} yet.',
      reviewPhrasesEmpty: 'There are no phrases in {tone}.',
      userFallbackName: 'User',
      avatarAltDefault: 'Avatar',
      avatarAltWithName: 'Avatar {name}',
      profileAvatarAlt: 'Profile avatar',
      appMetaNA: 'v n/a',
      expiryNA: 'n/a',
      passwordBothRequired: 'Please complete both password fields.',
      passwordMismatch: 'Passwords do not match.',
      fileReadError: 'Could not read the file.',
      fileFormatError: 'Unsupported format. Use JPG, PNG or GIF.',
      fileTooLarge: 'File too large. Max 500 KB.',
      profileUpdateFailed: 'Could not update profile.',
      profileUpdated: 'Profile updated.',
      avatarUploadFailed: 'Could not upload avatar.',
      avatarUpdated: 'Avatar updated.',
      avatarDeleteFailed: 'Could not delete avatar.',
      avatarDeleted: 'Avatar deleted.',
      genericActionError: 'Could not complete the action.'
    }
  }
};

export const normalizeLocale = (locale) => {
  const normalized = String(locale || '').trim().toLowerCase();
  return SUPPORTED_LOCALES.has(normalized) ? normalized : '';
};

export const resolveLocale = (locale, fallback = 'en') => {
  const normalized = normalizeLocale(locale);
  if (normalized) return normalized;
  const fallbackLocale = normalizeLocale(fallback);
  return fallbackLocale || 'en';
};

export const getLocaleMeta = (locale) => {
  const resolved = resolveLocale(locale);
  return LOCALE_META[resolved] || LOCALE_META.en;
};

export const getNextLocaleCode = (locale) => {
  const resolved = resolveLocale(locale);
  return resolved === 'en' ? 'es' : 'en';
};

export const getCopyBundle = (locale) => {
  const resolved = resolveLocale(locale);
  return APP_COPY[resolved] || APP_COPY.en;
};

export const getOnboardingCopy = (locale) => getCopyBundle(locale).onboarding;

export const getHomeCopy = (locale) => getCopyBundle(locale).home;

export const getFreeRideCopy = (locale) => getCopyBundle(locale).freeRide;

export const getSpeakCopy = (locale) => getCopyBundle(locale).speak;

const formatCopyTemplate = (template, params = {}) =>
  String(template || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) =>
    params[key] === undefined || params[key] === null ? '' : String(params[key])
  );

const withComputedChatCopy = (chatCopy) => {
  const source = chatCopy && typeof chatCopy === 'object' ? chatCopy : {};
  const out = { ...source };
  const dailyTemplate = String(source.hintDailyLimitWithCount || '');
  const listeningTemplate = String(source.hintListening || '');
  const presenceTemplate = String(source.communityPresenceTemplate || '');
  out.hintDailyLimitWithCount =
    typeof source.hintDailyLimitWithCount === 'function'
      ? source.hintDailyLimitWithCount
      : (used, limit) =>
          formatCopyTemplate(dailyTemplate, {
            used,
            limit
          });
  out.hintListening =
    typeof source.hintListening === 'function'
      ? source.hintListening
      : (preview) =>
          formatCopyTemplate(listeningTemplate, {
            preview
          });
  out.communityPresenceCount =
    typeof source.communityPresenceCount === 'function'
      ? source.communityPresenceCount
      : (n) =>
          formatCopyTemplate(presenceTemplate, {
            n
          });
  return out;
};

export const getChatCopy = (locale) => withComputedChatCopy(getCopyBundle(locale).chat);

export const getProfileCopy = (locale) => getCopyBundle(locale).profile;

export const getTabsCopy = (locale) => getCopyBundle(locale).tabs;

export const getNotificationsCopy = (locale) => getCopyBundle(locale).notifications;

export const getLoginCopy = (locale) => getCopyBundle(locale).login;

export const getReferenceCopy = (locale) => getCopyBundle(locale).reference;
