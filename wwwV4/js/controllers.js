console.log("003.001 >###> js/controllers.js >>>")

angular.module( 'starter.controllers', [] )

.controller( 'AppCtrl', function(
  $scope, $rootScope, $ionicModal, $timeout, $state, $ionicSideMenuDelegate, $location, $ionicLoading, 
  genService, backendService, AuthService, ChatService, adsService, chat, 
  $ionicScrollDelegate, $q, $ionicPopup, varGlobal, 
  $sce, $http, $ionicViewSwitcher, $ionicHistory ) 
{

  console.log( "# 019 # AppCtrl #" )

  $rootScope.viewTitle = "English Course"

  // A este callback se llega desde la url que pone un listener en r34lp0w3r_capacitor.js
  // Al efectuarse en el backend la redirección tras validar la llamada desde la red social
  // Cuando el Usuario dá acceso desde el navegador (o no).
  $scope.$on('loginDataReceived', function (event, info_url) {

    console.log("* loginDataReceived: Login recibido:", info_url);

    const url = new URL(info_url);

    const params = url.searchParams;

    if ( params.get( 'error' ) ) {
      console.log( '* loginDataReceived: El usuario canceló el login o hubo un error:', params.get( 'error' ) );
      const error = params.get('error');
      if (error == "datos_incompletos")
        $scope.error = $rootScope.loc == "es" ? "Información incompleta." : "Incomplete data received from provider." 
      else
        $scope.error = error;
      return;
    }

    const loginDataRaw = params.get('loginData');
    const loginData = JSON.parse(loginDataRaw);

    console.log( "* loginDataReceived:", JSON.stringify( loginData ) );

    var userInfo = loginData.user;

    if ( userInfo.avatar_file_name != "" )
      userInfo[ "image" ] = "https://s3.amazonaws.com/sk.audios.dev/avatars/" + userInfo.id + "/original/" + userInfo.avatar_file_name;
    else
      userInfo[ "image" ] = "https://s3.amazonaws.com/sk.CursoIngles/no-avatar.gif";

    userInfo[ "style" ] = "height: 48px; width: 48px; padding: 4px; margin: 12px 0 4px 0; border-radius: 48px; background-image: linear-gradient(-90deg, #ededed 50%, rgba(0, 0, 0, 0) 50%, rgba(0, 0, 0, 0)), linear-gradient(270deg, #fa6745 50%, #ededed 50%, #ededed);";
    var str = new Date().getTime();
    userInfo[ "chatImage" ] = userInfo[ "image" ] + "?" + str;

    window.localStorage.setItem( "userInfo", JSON.stringify( userInfo ) );

    var d =new Date(userInfo.expires_date);
    genService.dbgAlert(JSON.stringify(userInfo.expires_date));
    localStorage.setItem( "_purchase_id", "???" );
    localStorage.setItem( "_purchase_expires", d.getTime().toString() );
    localStorage.setItem( "_purchase_expires_human", d.toISOString() ); //.substring( 0, 10 )
    localStorage.setItem( "_oldusr", userInfo.oldusr );
    window.upd();

    AuthService.setUserInfo(userInfo);

    ChatService.Destroy();
    // Si no es bannedcomplete, prepare+init        
    if ($rootScope.chatEnabled)
    {              
      ChatService.Prepare(userInfo);
      ChatService.Init();
    }
    $state.go($state.current, null, {reload: true}); // Esto si el view está definido como cache-view="false", lo recarga, si no, no lo recarga pero pasa por "$ionicView.enter" en su controller.
    $scope.closeLogin();

    if ( $scope.loginData.where ) // Si no viene de chat o chat2 (enviar en el chat / abrir privado)
    {          
      if ( $scope.loginData.where=="purchase" || $scope.loginData.where == "purchaseSection" )
      {
        if ( !$rootScope.premium ) // Se acaba de loguear, si es premium ya no necesita acceder al pop up para hacerse premium.
          if ( $scope.loginData.where == "purchase" )
            $rootScope.goPremium();
          else
            $rootScope.goPremium( "fullLesson" );
        else
        {
          // Cerrar el pop-up intermedio con el botón de Subscribirse / ver Rewarded Video si es que viene de allí.
          $rootScope.premiumOpts.hide();          
        }
      }
      else
      {          
        $ionicHistory.nextViewOptions( { disableBack: true } );
        $state.go( $scope.loginData.where );
      }
    }

  });


  $scope.$on('pollotes', function (event, token) {

    console.log("* pushTokenReceived: Token recibido:", token);

    const uuid = window.localStorage.getItem( 'uuid' );
    
    if (!uuid)
    {
      console.log("* pushTokenReceived: No tenemos uuid, se ignora.");
      return;
    }

    const regid = window.localStorage.getItem( 'PUSH_regid' );

    if ( regid && ( regid === token ) )
    {
      console.log("* pushTokenReceived: El token no ha cambiado, se ignora.");
      return;
    }

    $ionicLoading.show();

    var endpoint=varGlobal.apiURL+'/regID?uuid='+encodeURIComponent(uuid)+'&regid='+encodeURIComponent(token);
    var config={headers:{"X-Platform":$rootScope.deviceId}};

    $http.get(endpoint,config).then(
      function okCallback(response) {
        if (!$rootScope.loadingContent)
          $ionicLoading.hide();
        console.log("# 025 #regID OK #");
        adsService.init(response.data.adConfig)
        // Si todo sale bien.
        window.localStorage.setItem( "PUSH_regid", token );
      },
      function errorCallback(response) {
        if (!$rootScope.loadingContent)
          $ionicLoading.hide();
        console.log("# 025 # regid ERROR #");
        console.log("# 025 # error ("+endpoint+") #");
        console.log("# 025 # "); console.log(response); console.log("#");
      }
    );    

  });


  $scope.$on('listener_gotPremium', function ( event, result ) {

    console.log( "* listener_gotPremium( result ) *", JSON.stringify( result ) );
    genService.finishPurchase( result )

  });



  window.suffixForImages = new Date().getTime().toString()

  window.miconvertFileSrc = function(url) {

    if ( !url ) {
      return url
    }
    if ( url.indexOf( '/' ) === 0 ) {
      return window.WEBVIEW_SERVER_URL + '/_app_file_' + url
    }
    if ( url.indexOf( 'file://' ) === 0 ) {
      return window.WEBVIEW_SERVER_URL + url.replace( 'file://', '/_app_file_' )
    }
    if ( url.indexOf( 'content://' ) ===0 ) {
      return window.WEBVIEW_SERVER_URL + url.replace( 'content:/', '/_app_content_' )
    }
    return url
  
  }


  // Actualizado para Capacitor, este se usa para las imágenes del vocabulario.
  window.imagenLocal = function(img, callback) {
    if (!window.Capacitor || !Capacitor.Plugins || !Capacitor.Plugins.Filesystem) {
      console.warn('* imagenLocal: Capacitor Filesystem plugin not available. *');
      callback(null);
      return;
    }
    Capacitor.Plugins.Filesystem.getUri({
      directory: 'DATA',
      path: img,
    }).then(function(result) {
      const webviewPath = Capacitor.convertFileSrc(result.uri);
      console.log("✅ imagenLocal:", webviewPath);
      callback(webviewPath);
    }).catch(function(err) {
      console.warn("❌ imagenLocal error:", err);
      callback(null); // había un typo: 'wcallback' → 'callback'
    });
  };




  // loaded
  // beforeEnter
  // beforeLeave
  // enter
  // leave
  // afterEnter
  // afterLeave

  $scope.$on( "$ionicView.loaded", function( scopes, states ) 
  {
    console.log( "# 019.a # AppCtrl:loaded #" )
  })

  //Esto es lo que hace que al cambiar de logueado a no logueado y viceversa se actualice en consecuencia el panel lateral izquierdo
  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) // por aquí pasará cada vez que se tenga que recargar(cacheada o no, ojo (si es cacheado no 'refresca pantalla', por ejemplo al cambiar de opción de menu (solo si se cambia) y al pulsar el botón de login)
  {
    console.log("# 019.b # AppCtrl:beforeEnter * states.fromCache: ["+states.fromCache+"] *");
    //
    $scope.userInfo=AuthService.getUserInfo(); // Si esto cambia, se refrescará en consecuencia la parte del view (el menú) de 'userInfo'. (por tanto la opción login pasará a ser logout o viceversa si entra aquí despues de hacer login o logout.)
  });

  $scope.$on( "$ionicView.beforeLeave", function( scopes, states ) 
  {
    console.log( "# 019.c # AppCtrl:beforeLeave #" )
    $rootScope.errorValue = null
  })

  $rootScope.pltfrm = genService.getPlatform()
  $rootScope.vrsn = genService.getVersion()
  if ( $rootScope.pltfrm == "ios" && $rootScope.vrsn >= 13 )
    $rootScope.iosrecent=true
  else
    $rootScope.iosrecent=false

  $scope.goRoute=function(where,aux){
    console.log( "" )
    console.log( "* goRoute *" )
    console.log( "* '" + where) + "'"
    console.log( "* '" + JSON.stringify(aux) + "'" )
    console.log( "" )
    //  
    $state.go( where, aux )
  }

  $rootScope.damefoco = false

  $timeout(function() {
    if ( ( typeof Keyboard != "undefined" ) && ( typeof Keyboard.hide != "undefined" ) ) Keyboard.hide()
    $rootScope.$apply()
  })

  $rootScope.validatorSource=null;





  $rootScope.seeVideo=function(){
    if ($rootScope.RewardedReady)
      backendService.muestraTexto( "Hay Rewarded Video preparado" )
    else
      backendService.muestraTexto( "No hay Rewarded Video preparado" )
    adsService.showRewardedVideo()
  }








//////////////////////////////////////////////////////////// BÚSQUEDA 

$rootScope.srchIndex=[
[ "Learn", 0, "i", "learn.svg", "/app/learn"],							// Apartados
[ "Practice", 0, "i", "practice.svg", "/app/practice"],
[ "Resources", 0, "i", "resources.svg", "/app/resources"],
[ "Vocabulary", 0, "i", "resources.svg", "/app/vocabularies"],
[ "Expressions", 0, "i", "resources.svg", "/app/expressions"],
[ "Proverbs", 0, "i", "resources.svg", "/app/proverbs"],
[ "Quotes", 0, "i", "resources.svg", "/app/quotes"],
[ "Regular verbs", 0, "i", "resources.svg", "/app/regverbs"],
[ "Irregular verbs", 0, "i", "resources.svg", "/app/irregverbs"],
[ "Cheat sheets", 0, "i", "resources.svg", "/app/course/10002"],
[ "Traveling", 0, "i", "resources.svg", "/app/course/10000"],
[ "Chat", 0, "c", "icon-chat", "/app/chats/site-wide-chat-channel"],
[ "Translate", 0, "c", "icon-refresh", "/app/translate"],
[ "Say", 0, "c", "icon-chat", "/app/pronounce"],
[ "Conjugator", 0, "c", "icon-list", "/app/conjugate/"],
// Courses
[ "Nivel básico"            ,2 ,4     ],
[ "Nivel intermedio"        ,2 ,5     ],
[ "Nivel avanzado"          ,2 ,6     ],
[ "Inglés de negocios"      ,2 ,10    ],
[ "Vocabulario para viajar" ,2 ,10000 ],
// Units (lessons)
[ "Pronouns " ,3, 4 ,7 ],
[ "The Articles" ,3, 4 ,8 ],
[ "Prepositions " ,3, 4 ,9 ],
[ "Nouns " ,3, 4 ,10 ],
[ "Adjectives " ,3, 4 ,11 ],
[ "Verbs " ,3, 4 ,12 ],
[ "Sentence Structure" ,3, 4 ,13 ],
[ "Verb Tenses: Present" ,3, 4 ,32 ],
[ "Numbers, Dates, Time" ,3, 4 ,33 ],
[ "Christmas " ,3, 4 ,38 ],
[ "Reading Comprehension" ,3, 4 ,10047 ],
[ "Adverbs " ,3, 5 ,18 ],
[ "Relative and Indefinite Pronouns " ,3, 5 ,19 ],
[ "Conjunctions" ,3, 5 ,17 ],
[ "Comparative & Superlative " ,3, 5 ,20 ],
[ "The Gerund and Infinitive " ,3, 5 ,21 ],
[ "Questions " ,3, 5 ,22 ],
[ "Verb Tenses: Past" ,3, 5 ,23 ],
[ "Verb Tenses: Future " ,3, 5 ,24 ],
[ "Reading Comprehension" ,3, 5 ,10048 ],
[ "Verb Tenses: Present Perfect " ,3, 6 ,25 ],
[ "Verb Tenses: Past Perfect" ,3, 6 ,26 ],
[ "Verb Tenses: Future Perfect " ,3, 6 ,27 ],
[ "Conditionals " ,3, 6 ,34 ],
[ "Passive voice " ,3, 6 ,28 ],
[ "Direct and Reported Speech " ,3, 6 ,31 ],
[ "Collocations and Expressions" ,3, 6 ,10018 ],
[ "Linking Words" ,3, 6 ,10033 ],
[ "Phrasal Verbs" ,3, 6 ,10022 ],
[ "Word Formation" ,3, 6 ,52 ],
[ "Adjectives and Adverbs" ,3, 6 ,36 ],
[ "Pronouns & Determiners" ,3, 6 ,10028 ],
[ "Common Mistakes" ,3, 6 ,10034 ],
[ "Pronunciation" ,3, 6 ,10032 ],
[ "Reading Comprehension" ,3, 6 ,10049 ],
[ "Vocabulary & Expressions" ,3, 10 ,10023 ],
[ "Office" ,3, 10 ,10024 ],
[ "Finding work" ,3, 10 ,10025 ],
[ "Money" ,3, 10 ,10026 ],
[ "Travel Vocabulary" ,3, 10000 ,10021 ],
[ "Shopping" ,3, 10000 ,10027 ],
// Lesson (sections)
[ "Personal Pronouns" ,4, 4 ,7 ,29 ],
[ "Possessives" ,4, 4 ,7 ,20 ],
[ "Demonstrative Pronouns" ,4, 4 ,7 ,31 ],
[ "Reflexive Pronouns" ,4, 4 ,7 ,35 ],
[ "The Definite Article" ,4, 4 ,8 ,56 ],
[ "The Indefinite Article" ,4, 4 ,8 ,61 ],
[ "Prepositions" ,4, 4 ,9 ,62 ],
[ "Prepositions of Place" ,4, 4 ,9 ,63 ],
[ "Prepositions of Time" ,4, 4 ,9 ,65 ],
[ "Prepositions of Movement or Direction" ,4, 4 ,9 ,66 ],
[ "Nouns" ,4, 4 ,10 ,67 ],
[ "Proper Nouns" ,4, 4 ,10 ,68 ],
[ "Countable and Uncountable Nouns" ,4, 4 ,10 ,69 ],
[ "There Be" ,4, 4 ,10 ,70 ],
[ "Quantifiers" ,4, 4 ,10 ,71 ],
[ "Adjectives" ,4, 4 ,11 ,73 ],
[ "Verbs" ,4, 4 ,12 ,74 ],
[ "To Be" ,4, 4 ,12 ,102 ],
[ "Short Forms" ,4, 4 ,12 ,75 ],
[ "Have vs. Have got" ,4, 4 ,12 ,103 ],
[ "Modal Verbs" ,4, 4 ,12 ,60 ],
[ "Constructing Sentences" ,4, 4 ,13 ,79 ],
[ "Imperative Sentences" ,4, 4 ,13 ,80 ],
[ "Present Simple" ,4, 4 ,32 ,81 ],
[ "Present Continuous" ,4, 4 ,32 ,82 ],
[ "Continuous Verb Tenses" ,4, 4 ,32 ,76 ],
[ "Cardinal Numbers" ,4, 4 ,33 ,83 ],
[ "Ordinal Numbers" ,4, 4 ,33 ,203 ],
[ "The Date" ,4, 4 ,33 ,85 ],
[ "Time" ,4, 4 ,33 ,86 ],
[ "Christmas Vocabulary" ,4, 4 ,38 ,100 ],
[ "Christmas in New York City" ,4, 4 ,38 ,101 ],
[ "Family" ,4, 4 ,10047 ,267 ],
[ "School" ,4, 4 ,10047 ,268 ],
[ "Weather and Clothing" ,4, 4 ,10047 ,269 ],
[ "Sports" ,4, 4 ,10047 ,270 ],
[ "At the Supermarket" ,4, 4 ,10047 ,271 ],
[ "Adverbs: Form and Function" ,4, 5 ,18 ,30 ],
[ "Adverbs: Types and Positions" ,4, 5 ,18 ,32 ],
[ "Indefinite Pronouns" ,4, 5 ,19 ,33 ],
[ "Relative Pronouns" ,4, 5 ,19 ,34 ],
[ "Conjunctions" ,4, 5 ,17 ,27 ],
[ "Comparatives and Superlatives" ,4, 5 ,20 ,36 ],
[ "Adjectives Ending in '-ed' and '-ing'" ,4, 5 ,20 ,106 ],
[ "Intensifiers and Mitigators" ,4, 5 ,20 ,105 ],
[ "Comparative Adverbs" ,4, 5 ,20 ,128 ],
[ "Like vs. As" ,4, 5 ,20 ,39 ],
[ "The Gerund and Infinitive" ,4, 5 ,21 ,40 ],
[ "Constructing Questions" ,4, 5 ,22 ,41 ],
[ "Question Tags" ,4, 5 ,22 ,42 ],
[ "What vs. Which" ,4, 5 ,22 ,43 ],
[ "Past Simple" ,4, 5 ,23 ,44 ],
[ "Past Continuous" ,4, 5 ,23 ,45 ],
[ "Used to" ,4, 5 ,23 ,64 ],
[ "Future Simple" ,4, 5 ,24 ,46 ],
[ "Future Continuous" ,4, 5 ,24 ,47 ],
[ "The Home" ,4, 5 ,10048 ,272 ],
[ "Jobs" ,4, 5 ,10048 ,273 ],
[ "Traveling" ,4, 5 ,10048 ,274 ],
[ "At the Restaurant" ,4, 5 ,10048 ,275 ],
[ "At the Hotel" ,4, 5 ,10048 ,276 ],
[ "Present Perfect" ,4, 6 ,25 ,48 ],
[ "Present Perfect Continuous" ,4, 6 ,25 ,49 ],
[ "Present Perfect vs. Past Simple" ,4, 6 ,25 ,50 ],
[ "Already/Just/Still/Yet" ,4, 6 ,25 ,51 ],
[ "For/Since/Ago" ,4, 6 ,25 ,52 ],
[ "Modal Perfects" ,4, 6 ,25 ,215 ],
[ "Past Perfect" ,4, 6 ,26 ,206 ],
[ "Past Perfect Continuous" ,4, 6 ,26 ,54 ],
[ "Future Perfect" ,4, 6 ,27 ,55 ],
[ "Future Perfect Continuous" ,4, 6 ,27 ,57 ],
[ "Conditional Sentences" ,4, 6 ,34 ,87 ],
[ "The Passive Voice" ,4, 6 ,28 ,59 ],
[ "Direct and Reported Speech" ,4, 6 ,31 ,72 ],
[ "Say vs. Tell" ,4, 6 ,31 ,78 ],
[ "Do vs. Make" ,4, 6 ,10018 ,77 ],
[ "Delexical Verbs" ,4, 6 ,10018 ,210 ],
[ "Adding Information" ,4, 6 ,10033 ,237 ],
[ "Contrasting Information " ,4, 6 ,10033 ,243 ],
[ "Giving Reason" ,4, 6 ,10033 ,244 ],
[ "Sequencing and Summarizing" ,4, 6 ,10033 ,245 ],
[ "Phrasal and Prepositional Verbs" ,4, 6 ,10022 ,211 ],
[ "To Get" ,4, 6 ,10022 ,212 ],
[ "Prefixes and Suffixes" ,4, 6 ,52 ,141 ],
[ "So vs. Such" ,4, 6 ,36 ,91 ],
[ "Enough and Too" ,4, 6 ,36 ,199 ],
[ "Even" ,4, 6 ,36 ,230 ],
[ "Else" ,4, 6 ,36 ,232 ],
[ "Whatever, Wherever, Whenever...etc" ,4, 6 ,36 ,104 ],
[ "Either vs. Neither" ,4, 6 ,10028 ,220 ],
[ "Each vs. Every" ,4, 6 ,10028 ,222 ],
[ "Commonly Confused Words" ,4, 6 ,10034 ,251 ],
[ "Letters and Sounds" ,4, 6 ,10032 ,227 ],
[ "Vowels" ,4, 6 ,10032 ,246 ],
[ "Consonants" ,4, 6 ,10032 ,247 ],
[ "Silent Letters" ,4, 6 ,10032 ,248 ],
[ "Syllable Stress" ,4, 6 ,10032 ,228 ],
[ "Word or Sentence Stress" ,4, 6 ,10032 ,249 ],
[ "At the Doctor's Office" ,4, 6 ,10049 ,277 ],
[ "At the Bank" ,4, 6 ,10049 ,278 ],
[ "At the Market" ,4, 6 ,10049 ,279 ],
[ "A Mystery" ,4, 6 ,10049 ,280 ],
[ "At a Festival" ,4, 6 ,10049 ,281 ],
[ "Vocabulary and Useful Expressions" ,4, 10 ,10023 ,107 ],
[ "Business English Dialogues 1" ,4, 10 ,10023 ,114 ],
[ "Business English Dialogues 2" ,4, 10 ,10023 ,115 ],
[ "Speaking on the Telephone" ,4, 10 ,10024 ,108 ],
[ "Writing Emails" ,4, 10 ,10024 ,111 ],
[ "Computers" ,4, 10 ,10024 ,109 ],
[ "Ways to Find a Job" ,4, 10 ,10025 ,216 ],
[ "Curriculum Vitae" ,4, 10 ,10025 ,112 ],
[ "Interviews" ,4, 10 ,10025 ,113 ],
[ "Banking and Money" ,4, 10 ,10026 ,110 ],
[ "Greetings and Introductions" ,4, 10000 ,10021 ,92 ],
[ "At the Airport" ,4, 10000 ,10021 ,93 ],
[ "Directions and Transportation" ,4, 10000 ,10021 ,94 ],
[ "In a Hotel" ,4, 10000 ,10021 ,95 ],
[ "In a Restaurant" ,4, 10000 ,10021 ,96 ],
[ "Medical Emergencies" ,4, 10000 ,10021 ,99 ],
[ "In a Store" ,4, 10000 ,10027 ,97 ],
[ "Clothing Shop Assistant" ,4, 10000 ,10027 ,217 ],
[ "Greengrocer" ,4, 10000 ,10027 ,218 ],
[ "Personal Pronouns 2" ,1, 7 ,241 ],					// Tests
[ "Demonstrative Pronouns 2" ,1, 7 ,265 ],
[ "Possessives 2" ,1, 7 ,242 ],
[ "Reflexive Pronouns 2" ,1, 7 ,266 ],
[ "Personal Pronouns 1" ,1, 7 ,68 ],
[ "Possessives 1" ,1, 7 ,159 ],
[ "Demonstrative Pronouns 1" ,1, 7 ,142 ],
[ "Reflexive Pronouns 1" ,1, 7 ,98 ],
[ "Unit Test: Pronouns" ,1, 7 ,166 ],
[ "The Definite Article 2" ,1, 8 ,267 ],
[ "The Indefinite Article 2" ,1, 8 ,268 ],
[ "The Definite Article 1" ,1, 8 ,97 ],
[ "The Indefinite Article 1" ,1, 8 ,115 ],
[ "Unit Test: Articles" ,1, 8 ,82 ],
[ "Prepositions of Place 2" ,1, 9 ,270 ],
[ "Prepositions of Time 2" ,1, 9 ,271 ],
[ "Prepositions of Movement or Direction 2" ,1, 9 ,272 ],
[ "Unit Test: Prepositions" ,1, 9 ,192 ],
[ "Prepositions 2" ,1, 9 ,269 ],
[ "Prepositions 1" ,1, 9 ,107 ],
[ "Prepositions of Place 1" ,1, 9 ,140 ],
[ "Prepositions of Time 1" ,1, 9 ,88 ],
[ "Prepositions of Movement or Direction 1" ,1, 9 ,46 ],
[ "Unit Test: Nouns" ,1, 10 ,193 ],
[ "There Be 2" ,1, 10 ,274 ],
[ "Quantifiers 2" ,1, 10 ,275 ],
[ "Nouns 2" ,1, 10 ,286 ],
[ "Proper Nouns 2" ,1, 10 ,287 ],
[ "Countable and Uncountable Nouns 2" ,1, 10 ,288 ],
[ "Nouns 1" ,1, 10 ,69 ],
[ "Proper Nouns 1" ,1, 10 ,143 ],
[ "Countable/Uncountable Nouns 1" ,1, 10 ,87 ],
[ "There Be 1" ,1, 10 ,59 ],
[ "Quantifiers 1" ,1, 10 ,131 ],
[ "Adjectives 2" ,1, 11 ,273 ],
[ "Adjectives 1" ,1, 11 ,121 ],
[ "Unit Test: Verbs" ,1, 12 ,195 ],
[ "Verbs 2" ,1, 12 ,276 ],
[ "To Be 2" ,1, 12 ,277 ],
[ "Short Forms 2" ,1, 12 ,278 ],
[ "Have vs. Have got 2" ,1, 12 ,279 ],
[ "Verbs 1" ,1, 12 ,156 ],
[ "To Be 1" ,1, 12 ,51 ],
[ "Short Forms 1" ,1, 12 ,137 ],
[ "Have vs. Have got 1" ,1, 12 ,86 ],
[ "Modals 1" ,1, 12 ,112 ],
[ "Modals 2" ,1, 12 ,120 ],
[ "Constructing Sentences 2" ,1, 13 ,280 ],
[ "Imperative Sentences 2" ,1, 13 ,281 ],
[ "Unit Test: Sentence Structure" ,1, 13 ,194 ],
[ "Constructing Sentences 1" ,1, 13 ,135 ],
[ "Imperative Sentences 1" ,1, 13 ,101 ],
[ "Present Simple 2" ,1, 32 ,243 ],
[ "Present Continuous 2" ,1, 32 ,244 ],
[ "Continuous Verb Tenses 2" ,1, 32 ,289 ],
[ "Present Simple 1" ,1, 32 ,106 ],
[ "Present Continuous 1" ,1, 32 ,117 ],
[ "Continuous Verb Tenses 1" ,1, 32 ,153 ],
[ "Unit Test: Present Tense" ,1, 32 ,168 ],
[ "Cardinal Numbers 2" ,1, 33 ,282 ],
[ "Ordinal Numbers 2" ,1, 33 ,283 ],
[ "The Date 2" ,1, 33 ,284 ],
[ "Time 2" ,1, 33 ,285 ],
[ "Cardinal Numbers 1" ,1, 33 ,90 ],
[ "Ordinal Numbers 1" ,1, 33 ,64 ],
[ "The Date 1" ,1, 33 ,165 ],
[ "Time 1" ,1, 33 ,96 ],
[ "Family" ,1, 10047 ,226 ],
[ "School" ,1, 10047 ,227 ],
[ "Weather and Clothing" ,1, 10047 ,228 ],
[ "Sports" ,1, 10047 ,229 ],
[ "At the Supermarket" ,1, 10047 ,230 ],
[ "Unit Test: Adverbs" ,1, 18 ,196 ],
[ "Adverbs: Form and Function" ,1, 18 ,48 ],
[ "Adverbs: Types and Positions" ,1, 18 ,148 ],
[ "Unit Test: Relative and Indefinite Pronouns" ,1, 19 ,197 ],
[ "Relative Pronouns 2" ,1, 19 ,245 ],
[ "Indefinite Pronouns" ,1, 19 ,110 ],
[ "Relative Pronouns 1" ,1, 19 ,35 ],
[ "Conjunctions" ,1, 17 ,138 ],
[ "Comparatives and Superlatives 2" ,1, 20 ,246 ],
[ "Unit Test: Comparative and Superlative" ,1, 20 ,198 ],
[ "Comparatives and Superlatives 1" ,1, 20 ,94 ],
[ "Adjectives Ending in '-ed' and '-ing'" ,1, 20 ,141 ],
[ "Intensifiers and Mitigators" ,1, 20 ,79 ],
[ "Comparative Adverbs" ,1, 20 ,99 ],
[ "Like vs. As" ,1, 20 ,111 ],
[ "Gerund vs. Infinitive" ,1, 21 ,167 ],
[ "Constructing Questions 2" ,1, 22 ,247 ],
[ "Unit Test: Questions" ,1, 22 ,199 ],
[ "Constructing Questions 1" ,1, 22 ,139 ],
[ "Question Tags" ,1, 22 ,105 ],
[ "What vs. Which" ,1, 22 ,129 ],
[ "Past Simple 2" ,1, 23 ,250 ],
[ "Past Continuous 2" ,1, 23 ,251 ],
[ "Past Simple 1" ,1, 23 ,155 ],
[ "Past Continuous 1" ,1, 23 ,122 ],
[ "Used to" ,1, 23 ,162 ],
[ "Unit Test: Past Tense" ,1, 23 ,145 ],
[ "Future Simple 2" ,1, 24 ,252 ],
[ "Future Continuous 2" ,1, 24 ,253 ],
[ "Unit Test: Future" ,1, 24 ,200 ],
[ "Future Simple 1" ,1, 24 ,154 ],
[ "Future Continuous 1" ,1, 24 ,74 ],
[ "The Home" ,1, 10048 ,231 ],
[ "Jobs" ,1, 10048 ,232 ],
[ "Traveling" ,1, 10048 ,233 ],
[ "At the Restaurant" ,1, 10048 ,234 ],
[ "At the Hotel" ,1, 10048 ,235 ],
[ "Modal Perfects 2" ,1, 25 ,260 ],
[ "Present Perfect 2" ,1, 25 ,254 ],
[ "Present Perfect Continuous 2" ,1, 25 ,255 ],
[ "Already/Just/Still/Yet 2" ,1, 25 ,256 ],
[ "Unit Test: Present Perfect" ,1, 25 ,201 ],
[ "For/Since/Ago 2" ,1, 25 ,257 ],
[ "Present Perfect vs. Past Simple 2" ,1, 25 ,224 ],
[ "Modal Perfects 1" ,1, 25 ,174 ],
[ "Present Perfect 1" ,1, 25 ,109 ],
[ "Present Perfect Continuous 1" ,1, 25 ,108 ],
[ "Present Perfect vs. Past Simple 1" ,1, 25 ,81 ],
[ "Already/Just/Still/Yet 1" ,1, 25 ,160 ],
[ "For/Since/Ago 1" ,1, 25 ,124 ],
[ "Past Perfect" ,1, 26 ,100 ],
[ "Past Perfect Continuous" ,1, 26 ,60 ],
[ "Unit Test: Past Perfect" ,1, 26 ,47 ],
[ "Future Perfect 2" ,1, 27 ,261 ],
[ "Future Perfect Continuous 2" ,1, 27 ,262 ],
[ "Unit Test: Future Perfect" ,1, 27 ,202 ],
[ "Future Perfect 1" ,1, 27 ,126 ],
[ "Future Perfect Continuous 1" ,1, 27 ,85 ],
[ "Conditional Sentences 2" ,1, 34 ,263 ],
[ "Conditional Sentences 1" ,1, 34 ,93 ],
[ "The Passive Voice" ,1, 28 ,150 ],
[ "Direct and Reported Speech 1" ,1, 31 ,67 ],
[ "Direct and Reported Speech 2" ,1, 31 ,61 ],
[ "Say vs. Tell" ,1, 31 ,50 ],
[ "Unit Test: Collocations and Expressions" ,1, 10018 ,203 ],
[ "Delexical Verbs 1" ,1, 10018 ,157 ],
[ "Do vs. Make" ,1, 10018 ,78 ],
[ "Adding Information" ,1, 10033 ,176 ],
[ "Contrasting Information" ,1, 10033 ,177 ],
[ "Giving Reason" ,1, 10033 ,178 ],
[ "Linking Words" ,1, 10033 ,180 ],
[ "Phrasal and Prepositional Verbs 2" ,1, 10022 ,225 ],
[ "Unit Test: Phrasal Verbs" ,1, 10022 ,204 ],
[ "Phrasal and Prepositional Verbs 3" ,1, 10022 ,264 ],
[ "Phrasal and Prepositional Verbs 1" ,1, 10022 ,102 ],
[ "To get" ,1, 10022 ,127 ],
[ "Prefixes and Suffixes" ,1, 52 ,125 ],
[ "Else" ,1, 36 ,182 ],
[ "Whatever, Wherever, Whenever...etc" ,1, 36 ,183 ],
[ "Unit Test: Adjectives and Adverbs" ,1, 36 ,205 ],
[ "Even" ,1, 36 ,181 ],
[ "Enough and Too 2" ,1, 36 ,258 ],
[ "So vs. Such" ,1, 36 ,103 ],
[ "Enough and Too 1" ,1, 36 ,119 ],
[ "Either vs. Neither 2" ,1, 10028 ,259 ],
[ "Unit Test: Pronouns and Determiners" ,1, 10028 ,206 ],
[ "Either vs. Neither 1" ,1, 10028 ,173 ],
[ "Each vs. Every" ,1, 10028 ,175 ],
[ "Commonly Confused Words" ,1, 10034 ,184 ],
[ "Letters and Sounds" ,1, 10032 ,185 ],
[ "Vowels" ,1, 10032 ,186 ],
[ "Consonants" ,1, 10032 ,187 ],
[ "Silent Letters" ,1, 10032 ,188 ],
[ "Syllable Stress" ,1, 10032 ,189 ],
[ "Word or Sentence Stress" ,1, 10032 ,190 ],
[ "Unit Test: Pronunciation" ,1, 10032 ,191 ],
[ "At the Doctor's Office" ,1, 10049 ,236 ],
[ "At the Bank" ,1, 10049 ,237 ],
[ "At the Market" ,1, 10049 ,238 ],
[ "A Mystery" ,1, 10049 ,239 ],
[ "At a Festival" ,1, 10049 ,240 ],
[ "Vocabulary and Useful Expressions" ,1, 10023 ,207 ],
[ "Speaking on the Telephone" ,1, 10024 ,208 ],
[ "Writing Emails" ,1, 10024 ,209 ],
[ "Computers" ,1, 10024 ,210 ],
[ "Ways to Find a Job" ,1, 10025 ,211 ],
[ "Curriculum Vitae" ,1, 10025 ,212 ],
[ "Interviews" ,1, 10025 ,213 ],
[ "Banking and Money" ,1, 10026 ,214 ],
[ "Greetings and Introductions" ,1, 10021 ,215 ],
[ "At the Airport" ,1, 10021 ,216 ],
[ "Directions and Transportation" ,1, 10021 ,217 ],
[ "In a Hotel" ,1, 10021 ,218 ],
[ "In a Restaurant" ,1, 10021 ,219 ],
[ "Medical Emergencies" ,1, 10021 ,220 ],
[ "In a Store" ,1, 10027 ,221 ],
[ "Clothing Shop Assistant" ,1, 10027 ,222 ],
[ "Greengrocer" ,1, 10027 ,223 ],
[ "That", 5, 5, 19, 34 ],			// Content
[ "Which", 5, 5, 19, 34 ],
[ "Who", 5, 5, 19, 34 ],
[ "Whom", 5, 5, 19, 34 ],
[ "Whose", 5, 5, 19, 34 ],
[ "When and where and why", 5, 5, 19, 34 ],
[ "Non-defining Relative Clauses", 5, 5, 19, 34 ],
[ "Defining Relative Clauses", 5, 5, 19, 34 ],
[ "El grado positivo", 5, 5, 20, 36 ],
[ "El grado superlativo", 5, 5, 20, 36 ],
[ "What", 5, 5, 22, 43 ],
[ "Which", 5, 5, 22, 43 ],
[ "Future: 'Will'", 5, 5, 24, 46 ],
[ "Future: 'Going to'", 5, 5, 24, 46 ],
[ "Already", 5, 6, 25, 51 ],
[ "Just", 5, 6, 25, 51 ],
[ "Still", 5, 6, 25, 51 ],
[ "Yet", 5, 6, 25, 51 ],
[ "For", 5, 6, 25, 52 ],
[ "Since", 5, 6, 25, 52 ],
[ "Ago", 5, 6, 25, 52 ],
[ "Can", 5, 4, 12, 60 ],
[ "Could", 5, 4, 12, 60 ],
[ "May", 5, 4, 12, 60 ],
[ "Might", 5, 4, 12, 60 ],
[ "Will", 5, 4, 12, 60 ],
[ "Shall", 5, 4, 12, 60 ],
[ "Should", 5, 4, 12, 60 ],
[ "Ought to", 5, 4, 12, 60 ],
[ "Must", 5, 4, 12, 60 ],
[ "Would", 5, 4, 12, 60 ],
[ "In / At / On", 5, 4, 9, 62 ],
[ "IN", 5, 4, 9, 62 ],
[ "AT", 5, 4, 9, 62 ],
[ "ON", 5, 4, 9, 62 ],
[ "BY", 5, 4, 9, 63 ],
[ "TO", 5, 4, 9, 66 ],
[ "UP", 5, 4, 9, 66 ],
[ "There is", 5, 4, 10, 70 ],
[ "There are", 5, 4, 10, 70 ],
[ "There v. It", 5, 4, 10, 70 ],
[ "Many", 5, 4, 10, 71 ],
[ "Much", 5, 4, 10, 71 ],
[ "Some", 5, 4, 10, 71 ],
[ "Any", 5, 4, 10, 71 ],
[ "No, None", 5, 4, 10, 71 ],
[ "A lot of/Lots of", 5, 4, 10, 71 ],
[ "Little/A little", 5, 4, 10, 71 ],
[ "Few/A few", 5, 4, 10, 71 ],
[ "To do", 5, 4, 12, 74 ],
[ "Do", 5, 6, 10018, 77 ],
[ "Make", 5, 6, 10018, 77 ],
[ "Expresiones", 5, 6, 10018, 77 ],
[ "Expresiones", 5, 6, 10018, 77 ],
[ "Say", 5, 6, 31, 78 ],
[ "Tell", 5, 6, 31, 78 ],
[ "Otros usos de 'tell':", 5, 6, 31, 78 ],
[ "So", 5, 6, 36, 91 ],
[ "Such", 5, 6, 36, 91 ],
[ "'We Wish You A Merry Christmas'", 5, 4, 38, 101 ],
[ "Le deseamos una Feliz Navidad", 5, 4, 38, 101 ],
[ "Have", 5, 6, 10018, 210 ],
[ "Take", 5, 6, 10018, 210 ],
[ "Make", 5, 6, 10018, 210 ],
[ "Give", 5, 6, 10018, 210 ],
[ "Go and Do", 5, 6, 10018, 210 ],
[ "Go", 5, 6, 10018, 210 ],
[ "Do", 5, 6, 10018, 210 ],
[ "Must have", 5, 6, 25, 215 ],
[ "May have / Might have", 5, 6, 25, 215 ],
[ "Can't have", 5, 6, 25, 215 ],
[ "Could have", 5, 6, 25, 215 ],
[ "Should have / Ought to have", 5, 6, 25, 215 ],
[ "Would have", 5, 6, 25, 215 ],
[ "Either", 5, 6, 10028, 220 ],
[ "Neither", 5, 6, 10028, 220 ],
[ "En función de pronombre", 5, 6, 10028, 220 ],
[ "En función de adverbio", 5, 6, 10028, 220 ],
[ "En función de determinante", 5, 6, 10028, 220 ],
[ "Each", 5, 6, 10028, 222 ],
[ "Every", 5, 6, 10028, 222 ],
[ "Agregar información", 5, 6, 10033, 237 ],
[ "And", 5, 6, 10033, 237 ],
[ "Also", 5, 6, 10033, 237 ],
[ "In addition", 5, 6, 10033, 237 ],
[ "As well as", 5, 6, 10033, 237 ],
[ "Too", 5, 6, 10033, 237 ],
[ "Besides", 5, 6, 10033, 237 ],
[ "Furthermore", 5, 6, 10033, 237 ],
[ "Moreover", 5, 6, 10033, 237 ],
[ "Ideas contrastantes", 5, 6, 10033, 243 ],
[ "Conditional Ideas", 5, 6, 10033, 243 ],
[ "But", 5, 6, 10033, 243 ],
[ "Yet", 5, 6, 10033, 243 ],
[ "However", 5, 6, 10033, 243 ],
[ "Although", 5, 6, 10033, 243 ],
[ "Though", 5, 6, 10033, 243 ],
[ "Even though", 5, 6, 10033, 243 ],
[ "Despite", 5, 6, 10033, 243 ],
[ "In spite of", 5, 6, 10033, 243 ],
[ "Nevertheless", 5, 6, 10033, 243 ],
[ "Nonetheless", 5, 6, 10033, 243 ],
[ "While", 5, 6, 10033, 243 ],
[ "Providing", 5, 6, 10033, 243 ],
[ "Provided that", 5, 6, 10033, 243 ],
[ "As/so long as", 5, 6, 10033, 243 ],
[ "Unless", 5, 6, 10033, 243 ],
[ "Only if", 5, 6, 10033, 243 ],
[ "Even if", 5, 6, 10033, 243 ],
[ "Whether or not", 5, 6, 10033, 243 ],
[ "Dar una razón o una causa", 5, 6, 10033, 244 ],
[ "Dar un resultado o un efecto", 5, 6, 10033, 244 ],
[ "Dar ejemplos", 5, 6, 10033, 244 ],
[ "Because", 5, 6, 10033, 244 ],
[ "Since", 5, 6, 10033, 244 ],
[ "As", 5, 6, 10033, 244 ],
[ "Due to", 5, 6, 10033, 244 ],
[ "Owing to", 5, 6, 10033, 244 ],
[ "As a result", 5, 6, 10033, 244 ],
[ "Therefore", 5, 6, 10033, 244 ],
[ "So", 5, 6, 10033, 244 ],
[ "Consequently", 5, 6, 10033, 244 ],
[ "As a consequence", 5, 6, 10033, 244 ],
[ "Accordingly", 5, 6, 10033, 244 ],
[ "For example", 5, 6, 10033, 244 ],
[ "Such as", 5, 6, 10033, 244 ],
[ "For instance", 5, 6, 10033, 244 ],
[ "Secuenciación de ideas", 5, 6, 10033, 245 ],
[ "Resumir ideas", 5, 6, 10033, 245 ],
[ "Firstly, secondly...lastly", 5, 6, 10033, 245 ],
[ "The following", 5, 6, 10033, 245 ],
[ "In conclusion", 5, 6, 10033, 245 ],
[ "To conclude", 5, 6, 10033, 245 ],
[ "In summary", 5, 6, 10033, 245 ],
[ "In short/brief", 5, 6, 10033, 245 ],  
// Summary
[ "Hay dos tipos de posesivos:", 6, 4, 7, 20 ],
[ "Hay 2 tipos de Pronombres Personales:", 6, 4, 7, 29 ],
[ "Hay 5 tipos de adverbios:", 6, 5, 18, 32 ],
[ "Cláusulas relativas", 6, 5, 19, 34 ],
[ "Hay 2 tipos de preguntas:", 6, 5, 22, 41 ],
[ "Las 3 preposiciones más comunes son:", 6, 4, 9, 62 ],
[ "Hay 6 tipos de adjetivos:", 6, 4, 11, 73 ],
[ "1. Adjetivos calificativos", 6, 4, 11, 73 ],
[ "2. Adjetivos demostrativos", 6, 4, 11, 73 ],
[ "3. Adjetivos cuantitativos", 6, 4, 11, 73 ],
[ "4. Adjetivos interrogativos", 6, 4, 11, 73 ],
[ "5. Adjetivos posesivos", 6, 4, 11, 73 ],
[ "6. Adjetivos numéricos", 6, 4, 11, 73 ],
[ "Conversation 1", 6, 10, 10024, 108 ],
[ "Conversation 2", 6, 10, 10024, 108 ],
[ "Common Abbreviations", 6, 10, 10024, 109 ],
[ "Dialogue", 6, 10, 10026, 110 ],
[ "Sample E-mail", 6, 10, 10024, 111 ],
[ "Sample Curriculum Vitae", 6, 10, 10025, 112 ],
[ "Sample Interview", 6, 10, 10025, 113 ],
[ "Dialogue in a Clothing Shop", 6, 10000, 10027, 217 ],
[ "Homophones", 6, 6, 10032, 227 ],
[ "Homographs", 6, 6, 10032, 227 ],
[ "Homonyms", 6, 6, 10032, 227 ],
[ "Vocales: Puras", 6, 6, 10032, 227 ],
[ "Vocales: Diptongos", 6, 6, 10032, 227 ],
[ "Consonantes", 6, 6, 10032, 227 ],
[ "Syllable Stress", 6, 6, 10032, 228 ]
]
//

//
var loc = "en"
var courseNames = { "en": { 4:"Basic level", 5:"Intermediate level", 6:"Advanced level", 10:"Business English", 10000:"Travel Vocabulary" }, "es": { 4:"Nivel básico", 5:"Nivel intermedio", 6:"Nivel avanzado", 10:"Inglés de negocios", 10000:"Vocabulario para viajar" } }
var verbs=[ " accept" , "account" , "achieve" , "act" , "add" , "admit" , "affect" , "agree" , "aim" , "allow" , "answer" , "appear" , "apply" , "argue" , "arrange" , "arrive" , "ask" , "attack" , "avoid" , "base" , "believe" , "belong" , "burn" , "call" , "care" , "carry" , "cause" , "change" , "charge" , "check" , "claim" , "clean" , "clear" , "climb" , "close" , "collect" , "commit" , "compare" , "complain" , "complete" , "concern" , "confirm" , "connect" , "consider" , "consist" , "contact" , "contain" , "continue" , "contribute" , "control" , "cook" , "copy" , "correct" , "count" , "cover" , "create" , "cross" , "cry" , "damage" , "dance" , "decide" , "deliver" , "demand" , "deny" , "depend" , "describe" , "design" , "destroy" , "develop" , "die" , "disappear" , "discover" , "discuss" , "divide" , "dress" , "drop" , "enable" , "encourage" , "enjoy" , "examine" , "exist" , "expect" , "experience" , "explain" , "express" , "extend" , "face" , "fail" , "fall" , "fasten" , "fill" , "finish" , "fit" , "fold" , "follow" , "force" , "form" , "gain" , "handle" , "happen" , "hate" , "head" , "help" , "hope" , "identify" , "imagine" , "improve" , "include" , "increase" , "indicate" , "influence" , "inform" , "intend" , "introduce" , "invite" , "involve" , "join" , "jump" , "kick" , "kill" , "knock" , "last" , "laugh" , "lead" , "learn" , "leave" , "like" , "limit" , "link" , "listen" , "live" , "look" , "love" , "manage" , "mark" , "matter" , "mean" , "measure" , "mention" , "mind" , "miss" , "move" , "need" , "notice" , "obtain" , "occur" , "offer" , "open" , "order" , "own" , "pass" , "perform" , "pick" , "place" , "plan" , "play" , "point" , "prefer" , "prepare" , "present" , "press" , "prevent" , "produce" , "promise" , "protect" , "prove" , "provide" , "publish" , "pull" , "push" , "put" , "raise" , "reach" , "realize" , "receive" , "recognize" , "record" , "reduce" , "refer" , "reflect" , "refuse" , "regard" , "relate" , "release" , "remain" , "remember" , "remove" , "repeat" , "replace" , "reply" , "report" , "represent" , "require" , "rest" , "result" , "return" , "reveal" , "roll" , "save" , "seem" , "separate" , "serve" , "set" , "settle" , "shake" , "share" , "shoot" , "shout" , "sit" , "smile" , "sort" , "sound" , "start" , "state" , "stay" , "stop" , "study" , "succeed" , "suffer" , "suggest" , "suit" , "supply" , "support" , "suppose" , "survive" , "take" , "talk" , "tend" , "test" , "thank" , "throw" , "touch" , "train" , "travel" , "treat" , "try" , "turn" , "understand" , "use" , "visit" , "vote" , "wait" , "walk" , "want" , "warn" , "wash" , "watch" , "wear" , "win" , "wish" , "wonder" , "work" , "worry" , "write" , "be" , "swear" , "do" , "blow" , "tell" , "arise" , "awake" , "beat" , "become" , "begin" , "bend" , "bet" , "bite" , "bleed" , "draw" , "break" , "bring" , "broadcast" , "build" , "burst" , "buy" , "catch" , "choose" , "come" , "cost" , "cut" , "deal" , "dig" , "dream" , "drink" , "drive" , "eat" , "feed" , "feel" , "fight" , "find" , "fly" , "forbid" , "forget" , "forgive" , "freeze" , "get" , "give" , "go" , "grow" , "hang" , "have" , "hear" , "hide" , "hit" , "hold" , "hurt" , "keep" , "kneel" , "know" , "lay" , "lend" , "let" , "lie" , "light" , "lose" , "make" , "meet" , "mistake" , "overtake" , "pay" , "read" , "ride" , "ring" , "rise" , "run" , "say" , "see" , "seek" , "sell" , "send" , "sew" , "shine" , "show" , "shrink" , "shut" , "sing" , "sink" , "sleep" , "smell" , "speak" , "spell" , "spend" , "split" , "spoil" , "spread" , "stand" , "steal" , "stick" , "sting" , "strike" , "strive" , "sweep" , "swim" , "swing" , "teach" , "tear" , "think" , "upset" , "wake" , "weep" , "withdraw " ]
//

$scope.srchTxt = "inicio"
$scope.OnSrchTxtChange = function(){
	$rootScope.stchTxt = angular.copy($scope.srchTxt)
}

$rootScope.srchResult = []
$rootScope.srchOn = false
$rootScope.srchTxt = ""

$rootScope.buscando = function( valor )
{
  console.log("["+valor+"]");  
  $rootScope.srchResult=[];
  if (valor.length>1)
  {
    for (var sidx=0; sidx<$rootScope.srchIndex.length; sidx++)
    {
      if ($rootScope.srchIndex[sidx][0].toLowerCase().indexOf(valor)!=-1)
      {
        var cat=$rootScope.srchIndex[sidx][1];
        if (cat==0)
          $rootScope.srchResult.push({asset:"c",img:"icon-list",cat: "Section",txt:$rootScope.srchIndex[sidx][0],url:"#"+$rootScope.srchIndex[sidx][4]});              
        else if (cat==1) // Tests
        {
          var txt=$rootScope.srchIndex[sidx][0];
          if (txt.includes("Unit"))
          	var que="Test"          	
          else
          {
          	var que="Exercise"
          }          	                     // "i"   "practice.svg"
          $rootScope.srchResult.push({asset:"c",img:"icon-pen",cat: que,txt:txt,url:"#/app/test/"+$rootScope.srchIndex[sidx][2]+"/"+$rootScope.srchIndex[sidx][3]});              
      	}
        else if (cat==2) // Courses           "i"   "learn.svg"               https://localhost:3000/#/app/course/4
          $rootScope.srchResult.push({asset:"c",img:"icon-list",cat: "Course",txt:$rootScope.srchIndex[sidx][0],url:"#/app/course/"+$rootScope.srchIndex[sidx][2]});
        else if (cat==3) // Units (lessons)      https://localhost:3000/#/app/course/4 <- Con algún modificador que haga que se coloque con la unidad abierta y arriba del todo.
          $rootScope.srchResult.push({asset:"c",img:"icon-list",cat: courseNames[loc][$rootScope.srchIndex[sidx][2]]+" Unit",txt:$rootScope.srchIndex[sidx][0],url:"#/app/course/"+$rootScope.srchIndex[sidx][2]+"/"+$rootScope.srchIndex[sidx][3] }); 
        else if (cat==4) // Lessons
          $rootScope.srchResult.push({asset:"c",img:"icon-list",cat: "Lesson",txt:$rootScope.srchIndex[sidx][0],url:"#/app/section/"+$rootScope.srchIndex[sidx][2]+"/"+$rootScope.srchIndex[sidx][3]+"/"+$rootScope.srchIndex[sidx][4]});
        else if (cat==5) // Contenido Lessons
          $rootScope.srchResult.push({asset:"c",img:"icon-list",cat: "Lesson (Content)",txt:$rootScope.srchIndex[sidx][0],url:"#/app/section/"+$rootScope.srchIndex[sidx][2]+"/"+$rootScope.srchIndex[sidx][3]+"/"+$rootScope.srchIndex[sidx][4]+"/content"});        
        else if (cat==6) // Sumario Lessons
          $rootScope.srchResult.push({asset:"c",img:"icon-list",cat: "Lesson (Summary)",txt:$rootScope.srchIndex[sidx][0],url:"#/app/section/"+$rootScope.srchIndex[sidx][2]+"/"+$rootScope.srchIndex[sidx][3]+"/"+$rootScope.srchIndex[sidx][4]});        
      }
    }
    // Translate
    $rootScope.srchResult.push({asset:"c",img:"icon-refresh",cat: "Translate",txt:"'"+valor+"'",url:"#/app/translate/0/"+valor});
    // Say                                      
    $rootScope.srchResult.push({asset:"c",img:"icon-chat",cat: "Say",txt:"'"+valor+"'",url:"#/app/pronounce/"+valor});
    // Conjugate
    if (verbs.indexOf(valor)!=-1)
      $rootScope.srchResult.push({asset:"c",img:"icon-list",cat: "Verb Conjugation",txt:valor,url:"#/app/conjugate/"+valor});
  }

  $timeout(function() {
    $rootScope.$apply();
    $rootScope.srchResult=$rootScope.srchResult;
  });
}
$rootScope.srchClick=function(){
  console.log("* srchClick * srchOn='"+$rootScope.srchOn+"' *");
  $rootScope.srchOn=!$rootScope.srchOn;
  console.log("* srchClick * srchOn='"+$rootScope.srchOn+"' *");
  if ($rootScope.srchOn)
  {
    $timeout(function() 
    {
      console.log("* srchClick * $scope.damefoco='"+$scope.damefoco+"' *");
      $scope.damefoco=!$scope.damefoco;    
      console.log("* srchClick * $scope.damefoco='"+$scope.damefoco+"' *");      
    },100)
  }
}
$rootScope.srchClear=function(){
  console.log("* srchClear *");

  $rootScope.srchResult=[];
  console.log("* srchClear * $scope.damefoco='"+$scope.damefoco+"' *");
  $scope.damefoco=!$scope.damefoco; // La variable que tiene asignado el input en la directiva 'focus-me': focus-me="damefoco"
  console.log("* srchClear * $scope.damefoco='"+$scope.damefoco+"' *");
}
$rootScope.srchClose=function(){
  $rootScope.srchOn=false;
}

////////////////////////////////////////////////////////////



  $rootScope.doBuy=function() {

    console.log( "* doBuy * $rootScope.subsID:", $rootScope.subsID );

    //alert("* doBuy *")    

    if ( r34lp0w3r.platform == 'browser' )
    {
      var txt1 = ( $rootScope.loc=="en" ) ? "Warning" : "Atención"
      var txt2 = ($rootScope.loc=="en") ? "No store on browser." : "Store no disponible en web."
      var myPopup = $ionicPopup.show( { template: '', title: txt1, subTitle: txt2, scope: $rootScope, buttons: [ { text: 'Ok' } ] } )            
      return;
    }

    $rootScope.userInfo = AuthService.getUserInfo();
    if ($rootScope.userInfo)
      user_id = $rootScope.userInfo.id;
    else
      user_id = 999999999;
    window.user_id = user_id;

    $rootScope.showPopup = true //Para que solo muestre un popup
    $rootScope.validatorSource = "order";

    IAPbuyProduct( $rootScope.subsID );

  }




  $rootScope.doRestore = function()
  {
    console.log( "* doRestore *" )
    if ( r34lp0w3r.platform == 'browser' )
    {
      var txt1 = ( $rootScope.loc=="en" ) ? "Warning" : "Atención"
      var txt2 = ($rootScope.loc=="en") ? "No store on browser." : "Store no disponible en web."
      var myPopup = $ionicPopup.show( { template: '', title: txt1, subTitle: txt2, scope: $rootScope, buttons: [ { text: 'Ok' } ] } )            
      return
    }
    if ( $rootScope.storeError )
    {
      var txt1 = ( $rootScope.loc=="en" ) ? "Warning" : "Atención"
      var txt2 = ($rootScope.loc=="en") ? "Store not available." : "Store no disponible."
      var myPopup = $ionicPopup.show( { template: '', title: txt1, subTitle: txt2, scope: $rootScope, buttons: [ { text: 'Ok' } ] } )
      return
    }
    var userInfo = AuthService.getUserInfo();
    if (userInfo)
      user_id = userInfo.id;
    else
      user_id = 999999999;
    window.user_id = user_id;
    $ionicLoading.show();
    $rootScope.showPopup = true; // Para que solo muestre un popup
    $rootScope.validatorSource = "restore";
    IAPrestorePurchases();
  }





  $rootScope.sendMail = function() {

    console.log("* $rootScope.sendMail() *")

    const loc = $rootScope.loc;
    const txtSubject =
      loc === "es" ? "Tengo comentarios" :
      loc === "br" ? "Tenho comentários" :
      "I have feedback";

    const email = $rootScope.i18n[loc].contact_mail;
    const subject = encodeURIComponent(txtSubject + " (" + genService.deviceId() + ")");
    const mailtoURL = `mailto:${email}?subject=${subject}`;

    window.location.href = mailtoURL;
  };

  


  $rootScope.inCache = function( keyId )
  {
    return ( keyId in window.localStorage )
  }

  $rootScope.forceCache = false

  $rootScope.siempreTrue = true

  $rootScope.cacheImage = ""

  $rootScope.debug = false

  var courses = window.localStorage.getItem( "_courses" )
  if ( !courses )
    window.localStorage.setItem( "_courses", JSON.stringify( varGlobal.courses ) )
  else
    varGlobal.courses = JSON.parse( courses )

  var scores = window.localStorage.getItem( "_scores" )
  if (!scores)
    window.localStorage.setItem("_scores",JSON.stringify(varGlobal.scores));
  else
    varGlobal.scores=JSON.parse(scores);


  $rootScope.findUserById = function(user_id)
  {
    var c=-1;
    for(i=0;i<$rootScope.chatlist[chat.publicChannelName].length;i++)
    {
      if ($rootScope.chatlist[chat.publicChannelName][i].id==user_id)
        c=i;
    }
    return c;
  }


  $scope.onLine=function(us)
  {

    if (!$rootScope.isOnLine) 
    {
      return -2;
    }

    if (typeof us=="undefined") 
    {   
      return -1          
    }
    else
    {
      var ol=0;
      for (i=0;i<us.length;i++)
      {
        if (!us[i].hidden)
          ol++;
      }

      return ol;
    }    
  }


$rootScope.refreshAvatar=function()
{

  window.suffixForImages = new Date().getTime().toString()
  var avatar = window.imagenLocal( "avatar.gif" )
  var tmp = window.imagenLocal( "tmp.gif" )

  if( !$rootScope.$$phase ) {
    $rootScope.$apply( function() {
      $rootScope.cacheImage = avatar + "?" + new Date().getTime()
      $rootScope.tmpImage = tmp + "?" + new Date().getTime()
      console.log( "--- refreshAvatar - cacheImage ---", $rootScope.cacheImage )
    })
  }
  else
  {
    $rootScope.cacheImage = avatar + "?" + new Date().getTime()
    $rootScope.tmpImage = tmp + "?" + new Date().getTime()
    console.log( "--- refreshAvatar - cacheImage ---", $rootScope.cacheImage )    
  }
  
}


$scope.chatClick=function(donde)
{
  console.log("* chatClick ("+donde+") *");
  if (!$scope.userInfo)
  {
    console.log("* NOT LOGGED *");
    $scope.login("chatclick");
  }
  else
  { 
    var seguir=false;
    if ($rootScope.premium)
    {
      console.log("* PREMIUM *");
      seguir=true;
    }
    else
    {
      if (!$scope.userInfo.oldusr)
        $scope.goPremium();
      else
      {
        console.log("* OLD *");
        seguir=true;
      }
    }
    if (seguir)
    {
      if (donde=="upr") // Botón superior derecho
        $ionicSideMenuDelegate.toggleRight();
      else // Botón de ir al chat
        $state.go("app.chatlist");
    }
  }
}


  $scope.flashClick=function(cual)
  {
    console.log("* flashClick *");
    console.log(cual);    

    if ($rootScope.flash01) 
    {
      if (cual!=2) // El botón de la derecha no sirve para hacer dismiss del primer flash
      {
        $rootScope.flash01=false;
        localStorage.setItem("_flash01",true);
        $rootScope.flash02=true;
      }
      return //Ojo, si lo quitas, continua y no funcionará
    }
    if ($rootScope.flash02)
    {
      if (cual!=1) // El botón de la izquierda no sirve para hacer dismiss del segundo flash
      {
        $rootScope.flash02=false;
        localStorage.setItem("_flash02",true);        
      }
    }
    if ($rootScope.flash03)
    {
      if (cual!=1) // El botón de la izquierda no sirve para hacer dismiss del tercer flash
      { 
        $rootScope.flash03=false;
        localStorage.setItem("_flash03",true);        
      }

    }
    if ($rootScope.flash01 || $rootScope.flash02 || $rootScope.flash03)
      $rootScope.flashCls="bar-stable item-flash"
    else
      $rootScope.flashCls="bar-stable"

    if (cual==2)
      $scope.chatClick('upr');

  }




  // $ionicSideMenuDelegate se añade para poder cerrar el menu 'programaticamente' en el logout
  $scope.cierraMenu = function() {
    $ionicSideMenuDelegate.toggleLeft();
  };




  $rootScope.UTCconv=function(tstamp)
  {
    if (tstamp=="")
      return "";
    if (tstamp.length==5) // Ya tiene el formato "99:99"
      return tstamp;

    //    return "*"+tstamp.substring(11,16)+"*";
    var datetime=tstamp.split("T");
    var date=datetime[0].split("-");
    var time=datetime[1].split(":");
    time[2]=time[2].split(".")[0];
    var d=new Date(date[0],date[1],date[2],time[0],time[1],time[2]);
    var off=(new Date().getTimezoneOffset()/60)*(-1)
    d.setHours(d.getHours()+off);

    var hoy = new Date().getUTCDate();
    var stmp=d.getUTCDate();

    if (hoy!=stmp) 
    {
      if ($scope.loc=="es")
        return stmp.toString()+" "+["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][date[1]-1];          
      else
        if ($scope.loc=="br")
          return stmp.toString()+" "+["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][date[1]-1];      
        else
          return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][date[1]-1]+" "+stmp.toString();      
    }
    else
      return d.toString().substring(16,21);

  }


  $rootScope.version=varGlobal.version;


/////
window.chipiDisabled=false;
window.chipi=function(txt)
{
  window.vienedechipi=true;
  if (window.chipiDisabled && !window.lesson_loc_es)
  {
    console.log("* chipi * '"+txt+"' * disabled *");  
    return
  }
  console.log("* chipi * '"+txt+"' * enabled *");  
  angular.element(document.getElementById('secciones')).scope().Klander(txt);
}
/////


window.upd = function() {

  console.log(" *** window.upd ***")
  if (!$rootScope.loadingContent)
    $ionicLoading.hide()
  
  // Tomar fecha en ms de localstorage
  var purchase_expires=localStorage.getItem("_purchase_expires")
  if (!purchase_expires)
  {
    var purchaseExpires=null
    var isok=false
  }
  else
  {
    var time = new Date().getTime()
    var hoy = new Date(time)
    var exp = new Date(parseInt(purchase_expires))
    console.log("---")
    console.log(hoy)
    console.log(exp)
    console.log("---")
    var purchaseExpires=exp.toISOString().substring(0,10)
    var isok=(exp>=hoy)
    console.log(isok)
    console.log("---")
  }
  if(!$rootScope.$$phase) {
    $rootScope.$apply(function() {     
      
      $rootScope.purchaseStatus = isok
      $rootScope.purchaseExpires = purchaseExpires
      adsService.setAds(!isok)
      genService.setCache(isok)
      genService.setPremium(isok)
      genService.setChatEnabled()

      if (genService.getCache() && !$rootScope.loadingContent && !$rootScope.allCached)
      {
        genService.dbgAlert("- cacheAll -")
        backendService.cacheAll(true); // Cachear todo aunque ya esté en caché
      }
      genService.dbgAlert("xxx1")
    })
  }
  else
  {
    $rootScope.purchaseStatus=isok
    $rootScope.purchaseExpires=purchaseExpires
    adsService.setAds(!isok)
    genService.setCache(isok)
    genService.setPremium(isok)
    genService.setChatEnabled()

    if (genService.getCache() && !$rootScope.loadingContent && !$rootScope.allCached)
    {
      genService.dbgAlert("- cacheAll -")
      backendService.cacheAll(true) // Cachear todo aunque ya esté en caché
    }    
  }
}


$rootScope.purchaseStatus=false
$rootScope.purchaseExpires=""





////////////////////////////////////////////////////////////
$rootScope.ulduser=false;
$rootScope.messages={};
$rootScope.channels=[];
$rootScope.chatlist={};
$rootScope.currentChannel="";
$rootScope.inChat=false;
$rootScope.chatState="???";
$rootScope.mainBadge=0;



window.chat_stateChange=function(state){

if (state.current=="connected" && $rootScope.chatState!="???") // Reconexion -> Refrescar contenido timeline
{
  
  var canal=chat.publicChannelName;
    
  $rootScope.messages[canal]=[];
  //    console.log("* antes de getLastChats *");
  $rootScope.userInfo=AuthService.getUserInfo();
  $ionicLoading.show();
  
  ChatService.doPOST('/v4/getLastChats',{"user_id":chat.currentUser.id,"channel":canal},$rootScope.userInfo,function(result) {      

    if (!$rootScope.loadingContent)
      $ionicLoading.hide();

      var n=result.data.length;
      for (i=n-1;i>=0;i--)
      {
        var r=result.data[i];
        var d={};
        d.message_id=r.message_id;
        d.created_at=r.created_at;
        d.body=r.body;
        var actor={};
        actor.id=r.user_id;
        actor.displayName=r.display_name;
        actor.image=r.image;
        actor.style=r.style;
        d.actor=actor;
        $rootScope.textIn(canal,d);
      }            
    });

  }

  if(!$rootScope.$$phase) {
    $rootScope.$apply(function() {     
      $rootScope.chatState=state.current;
    });   
  }
  else
    $rootScope.chatState=state.current;

}



window.chat_presenceSubscription = function( canal, data ) {

  const m=chat.pusher.channels.channels[ "presence-" + canal ].members;
  const me=m.me;
  const members=m.members;

  $rootScope.chatlist[canal]=[];

  var keys = Object.keys( members );
  for ( i=0; i < keys.length; i++ ) 
  {
    var member=members[ keys[ i ] ];
    //console.log( member );
    if ( !member.hidden &&  member.id != me.id )
    {
      $rootScope.chatlist[ canal ].push( ChatService.userRaw( member ) );
    }
  }

}


window.chat_memberAdded=function( canal, data ) {
  
  if ( data.info.hidden ) return;

  var exists = $rootScope.chatlist[ canal ].some(item => item.id === data.id);
  if ( exists ) return;
    
  $rootScope.$apply(function() {       
    $rootScope.chatlist[ canal ].push( ChatService.userRaw( data.info ) );
  });

}


window.chat_memberRemoved = function( canal, data ){

  var c = $rootScope.chatlist[ canal ].findIndex(item => item.id === data.id);
  
  if (c === -1) {
    return
  }  

  $rootScope.$apply(function() {     
    $rootScope.chatlist[ canal ].splice( c, 1 );
  })
      
  var user2_id = data.id
  var user2_name = data.name
  
  var idx = ChatService.getUserById( user2_id )
  if ( idx != -1 ) // Existe un privado con ese usuario
  {
    var chan1="private-"+chat.currentUser.id+"_"+user2_id
    var chan2="private-"+user2_id+"_"+chat.currentUser.id
    
    for( y = 0; y < $rootScope.channels.length; y++ )
    {
      // console.log("* item "+y+" *")
      if ( $rootScope.channels[ y ].name == chan1 || $rootScope.channels[ y ].name == chan2 ) 
      {
        // console.log("* Privado con ese usuario: "+$rootScope.channels[y].name)
        var channel = $rootScope.channels[ y ].name

        if ( chat.pusher.channel( channel ) != undefined ) {
          // console.log("* canal subscrito, se dessubscribe *")
          chat.pusher.unsubscribe( channel )
        }

        $rootScope.$apply(function() { 

          $rootScope.channels[ y ].state = 0

          if  ( $rootScope.inChat && $rootScope.currentChannel == channel )
          {
            // console.log("* Es el canal abierto, se añade estilo de canal desconectado *")
            var element = angular.element( document.getElementsByClassName( 'header-item title' ) )
            element.addClass( 'canal_desconectado' )
          }
          else
          {
              // console.log("* No es el canal abierto, se muestra popup *")
              if ( ionic.Platform.isIOS() || ionic.Platform.isAndroid() )
              {
                var dummy = 0;
              }
              else
              {
                if ($rootScope.loc=="es")
                  var txt="Se ha cerrado el chat"
                else
                  if ($rootScope.loc=="br")
                    var txt="Bate-papo foi fechado"
                  else
                    var txt="Chat closed"
                var myPopup = $ionicPopup.show({ template: '', title: user2_name, subTitle: txt, scope: $scope, buttons: [ { text: 'Ok' } ] })
                $timeout(function() { myPopup.close(); }, 1500)
              }       
          }

        })
    
      }
    }
  }
}

window.chat_channelSubscription = function(canal)
{

  var user2_name = ""
  
  if (chat.oficial[canal] == undefined)
  {
    var type = 2 // Privado
    var caption = canal
    var img = "assets/no-avatar.gif"
    var name = canal

    var p = canal.indexOf("_")
    var u1 = parseInt( canal.substring(8,p))
    var u2 = parseInt( canal.substring(p+1,100))

    if ( chat.currentUser.id == u1 )
      user2_id=u2
    else
      user2_id=u1

    var c = -1
    for( i = 0; i < $rootScope.chatlist[ chat.publicChannelName ].length; i++ )
    {
      if ( $rootScope.chatlist[ chat.publicChannelName ][ i ].id == user2_id )
        c = i
    }
    $rootScope.chatlist[canal] = []
    if ( c > -1 ) // Ha encontrado el user2 en la lista de usuarios del público
    {
      info = $rootScope.chatlist[ chat.publicChannelName ][ c ]
      $rootScope.chatlist[ canal ].push( info )
      caption = info.name
      img = info.img
      user2_name = info.name
    }
  }
  else
  {
    var type = 1 // Oficial
    var caption = chat.oficial[ canal ].caption
    var img = chat.oficial[ canal ].img
    var name = canal
  }

  // Si el canal ya existe (reconexión), lo que se hace es cambiar el state a 1, si no, se crea.
  c = -1
  for ( i = 0; i < $rootScope.channels.length; i++ )
  {
    if ( $rootScope.channels[ i ].name == name )
      c = i
  }  
  if ( c == -1 ) // No existe, se crea
  {
    //badge inicializado
    $rootScope.channels.push( { name:name, type:type, state:1, badge:0, muted:false, caption:caption, img:img, lastChat:"", lastUser: "", lastUpdated:"" } )
    $rootScope.messages[ canal ] = []
    c = $rootScope.channels.length - 1

    // console.log("* antes de getLastChats *")
    $rootScope.userInfo = AuthService.getUserInfo()
    $ionicLoading.show()
    // ChatService.getLastChats(canal,function(result) {
    ChatService.doPOST( '/v4/getLastChats', { "user_id":chat.currentUser.id, "channel":canal }, $rootScope.userInfo, function(result) 
    {      

      if (!$rootScope.loadingContent)
        $ionicLoading.hide();

      var n=result.data.length;
      for (i=n-1;i>=0;i--)
      {
        var r=result.data[i];
        var d={};
        d.message_id=r.message_id;
        d.created_at=r.created_at;
        d.body=r.body;
        var actor={};
        actor.id=r.user_id;
        actor.displayName=r.display_name;
        actor.image=r.image;
        actor.style=r.style;
        d.actor=actor;
        $rootScope.textIn(canal,d);
      }
      // CONEXIÓN     
      if (type!=1)
      {          
        if ($rootScope.inChat && $rootScope.currentChannel==canal) // Es el actual, el que está viendo el usuario
        {
          var element = angular.element(document.getElementsByClassName('header-item title'))
          element.removeClass('canal_desconectado')
        }
        else
        { 

          if (type==2)
          {
            var u2=$rootScope.findUserById(user2_id)
            if (u2==-1)
            {
              console.log("* El usuario no esta en linea *")
            }
            else								
            {
              if ($rootScope.chatlist[chat.publicChannelName][u2].estado==-1) // El propio usuario habia iniciado el privado
              {
                $rootScope.chatlist[chat.publicChannelName][u2].estado=0;
                if ($ionicSideMenuDelegate.isOpenRight())
                  $ionicSideMenuDelegate.toggleRight();
                $state.go("app.chats",{ channel: name });           
              }
              else
              {
                // Si no va, pone badge a -1 para que al recibir un mensaje del otro usuario abra el canal
                $rootScope.channels[c].badge=-1;
              }
            }
          }
        }
      }      
    });

  }
  else
  { 
    // RECONEXIÓN
    if ($rootScope.inChat && $rootScope.currentChannel==canal) // Es el actual, el que está viendo el usuario
    {
      var element = angular.element(document.getElementsByClassName('header-item title')); 
      element.removeClass('canal_desconectado');
    }
    else
    {

      if (type==2)
      {
        var u2=$rootScope.findUserById(user2_id);
        if (u2==-1)
        {
          console.log("* El usuario no esta en linea *");
        }
        else
        {
          if ($rootScope.chatlist[chat.publicChannelName][u2].estado==-1) // El propio usuario ha iniciado el privado
          {
            $rootScope.chatlist[chat.publicChannelName][u2].estado=0;
            if ($ionicSideMenuDelegate.isOpenRight())
              $ionicSideMenuDelegate.toggleRight();
            $state.go("app.chats",{ channel: name });   
          }
          else
          {
            $rootScope.channels[c].badge=-1;
          }
        }
      }

    }

    if(!$rootScope.$$phase) 
    {
      $rootScope.$apply(function() 
      {     
        $rootScope.channels[c].state=1; // Conectado
      });   
    }
    else
      $rootScope.channels[c].state=1; // Conectado

  }

}

  window.scrollBottom=function()
  {
    console.log("@AQUI1@");
    console.log($rootScope.inChat);
    console.log($rootScope.currentChannel);
    if ($rootScope.inChat)
    {
      $ionicScrollDelegate.$getByHandle('mainScroll').scrollBottom(true);
    }
  }





window.chat_chatMessage=function(canal,data){
 
  $rootScope.userInfo=AuthService.getUserInfo();
  if ($rootScope.userInfo && $rootScope.userInfo.ignored[data.actor.id]!=undefined)
  {
    console.log("* user ignored, message ignored *");
    return;
  }

  var d={};
  d.message_id=data.id;
  d.created_at=data.published;
  d.body=data.text;
  d.actor=data.actor;
 
  $rootScope.$apply(function() {     
    $rootScope.textIn(canal,d);
  });   

  if ($rootScope.chatlist[canal])
    var n_e=$rootScope.chatlist[canal].length;
  else
    var n_e=0;

  for(v_i=0;v_i<n_e;v_i++)
  { 
    if ($rootScope.chatlist[canal][v_i].id==d.actor.id)
        $rootScope.$apply(function() {    
          $rootScope.chatlist[canal][v_i].lastChat=d.body;
          $rootScope.chatlist[canal][v_i].lastUpdated=d.created_at;
          // Badge de usuario: si no estamos en la pantalla de chat o estamos pero no es la de este canal y el canal de este mensaje no es el publico (es de un privado)
          // -> Incrementar
          if ((!$rootScope.inChat || $rootScope.currentChannel!=canal) && canal!=chat.publicChannelName)
          {     
            c=-1;
            for(j=0;j<$rootScope.chatlist[chat.publicChannelName].length;j++)
            {
              if ($rootScope.chatlist[chat.publicChannelName][j].id==d.actor.id) {
                c=j;
              }
            }
            if (c>-1)
              $rootScope.chatlist[chat.publicChannelName][c].badge++;
          } 
        });
  }


  var cidx=-1;
  
  var muted=false;

  // Actualizar lastUser y lastChat en el canal y badge si corresponde
  for(i=0;i<$rootScope.channels.length;i++)
  {
    if ($rootScope.channels[i].name==canal)
    {          
      cidx=i;
    }

  }


        muted=$rootScope.channels[cidx].muted;
        $rootScope.$apply(function() {
//          
          $rootScope.channels[cidx].lastUser=d.actor.displayName;
          $rootScope.channels[cidx].lastChat=d.body;   
          $rootScope.channels[cidx].lastUpdated=d.created_at;       
//
          // Badge del canal
          if (!$rootScope.inChat || $rootScope.currentChannel!=canal) // Si no esta en el chat o esta en otro
          {
            if ($rootScope.channels[cidx].type==2 && $rootScope.channels[cidx].badge==-1)
            {
              $rootScope.channels[cidx].badge=0;
              var name=$rootScope.channels[cidx].name
              if ($ionicSideMenuDelegate.isOpenRight())
                $ionicSideMenuDelegate.toggleRight();
              $state.go("app.chats",{ channel: name });         
            }  
            if ($rootScope.channels[cidx].badge<0)
              $rootScope.channels[cidx].badge=0;
            $rootScope.channels[cidx].badge++;
            $rootScope.mainBadge++;
          }
          else
          {
            // Esta en el chat y en el canal del que se ha recibido el mensaje
            $rootScope.channels[cidx].badge=0; // Por si estaba a -1 (pendiente de recibir el primer mensaje) y justo habia abierto el canal
          }
        });



  
  //console.log("STEP005");  

  // Scroll a abajo del todo, si está en el view de chats y en este canal
  if ($rootScope.inChat && $rootScope.currentChannel==canal)
  {
    console.log("@AQUI2@");
    $ionicScrollDelegate.$getByHandle('mainScroll').scrollBottom(true);    
  }



  if ($rootScope.inChat && $rootScope.currentChannel==canal && !window.paused)
  {
    // No avisar al usuario, está en la pantala de chat y en el chat al que pertenece el mensaje y NO está en background.
    // (Si lo está, si que tiene que avisar)
  }
  else
  {
    if (muted)
      console.log("*** muted ***");
    else
    {
      if ($rootScope.currentUser) // Si no está logueado, no reproducir el sonido
      {
        console.log("*** mp3 start ***");
        if (ionic.Platform.isAndroid())
          var mp3File="file:///android_asset/www/assets/ping.mp3";
        else
          var mp3File="assets/ping.mp3";
        var media = new Media(mp3File); media.play();
        console.log("*** mp3 end ***");
      }


      if (window.paused)
      {
        // El mensaje se ha de mostrar mediante una notificación local
        // Se ha de incrementar el badge de la app
        console.log("*** in background ***");
        // Esto se hacia con el plugin backgroundMode { text: d.actor.displayName+" : "+d.body }
      }
      else
      {
        console.log("*** in foreground ***");
      }

      // Toast
      if ($rootScope.currentUser) // Sólo si está logueado
      {
        if ( r34lp0w3r.platform != "browser" )
        {
          var myPopup = $ionicPopup.show({ template: '', title: d.body, subTitle: d.actor.displayName, scope: $scope, buttons: [ { text: 'Ok' } ] });
          $timeout(function() { myPopup.close(); }, 1500);      
        }
      }

    }
  }

}




  window.chat_privateChat=function(data){

    if ( !chat.currentUser || (data.user1!=chat.currentUser.id && data.user2!=chat.currentUser.id))
    {
      return;
    }

    var channel=data.private_channel;

    if (chat.pusher.channel(channel)!=undefined)
    {
      return;
    }

    chat.pusher.subscribe(channel);

    chat.pusher.channel(channel).bind('pusher:subscription_succeeded', chat_channelSubscription(channel));
    chat.pusher.channel(channel).bind('chat_message', function(data) { chat_chatMessage(channel,data) });
  }


  window.chat_destroy_privateChat=function(data){

    if ( !chat.currentUser || (data.user1!=chat.currentUser.id && data.user2!=chat.currentUser.id))
    {
      return;
    }

    var channel=data.private_channel;

    if (chat.pusher.channel(channel)==undefined)
    {
      //    console.log("* el canal no está subscrito, se ignora *");
      return;
    }
    chat.pusher.unsubscribe(channel);

    if (data.user1==chat.currentUser.id)
      var user2_id=data.user2;
    else
      var user2_id=data.user1;
    var user2_name="";
    var idx=ChatService.getUserById(user2_id);
    if (idx!=-1)
      user2_name=$rootScope.chatlist[chat.publicChannelName][idx].name;

    for(i=0;i<$rootScope.channels.length;i++)
    {
      if ($rootScope.channels[i].name==channel)
      {


        if(!$rootScope.$$phase) {
          $rootScope.$apply(function() {     
              $rootScope.channels[i].state=0 // Desconectado
          });   
        }
        else
              $rootScope.channels[i].state=0 // Desconectado

      }      

    }
    // DESCONEXION
    if ($rootScope.inChat && $rootScope.currentChannel==channel)
    {
      var element = angular.element(document.getElementsByClassName('header-item title'))
      element.addClass('canal_desconectado')    
    }
    else
    {
        if ( r34lp0w3r.platform != "browser" )
        {
          if ($rootScope.loc=="es")
            var txt="Se ha cerrado el chat"
          else
            if ($rootScope.loc=="br")
              var txt="Bate-papo foi fechado"
            else
              var txt="Chat closed"
          var myPopup = $ionicPopup.show({ template: '', title: user2_name, subTitle: txt, scope: $scope, buttons: [ { text: 'Ok' } ] })
          $timeout(function() { myPopup.close(); }, 1500)
        }       
    }

  }


  window.chat_userIgnore=function(canal,data){

    var onoff=(data.onoff=="1");
    if (onoff)
    {
      var txt1="ignoro";
      var txt2="ignora";
      var value=true;
    }
    else
    {
      var txt1="dejo de ignorar";
      var txt2="deja de ignorar"
      var value=false;
    }


    if (parseInt(data.user1)==chat.currentUser.id)
      var user2_id=parseInt(data.user2);
    else
      var user2_id=parseInt(data.user1);
    var user2_name="";
    var idx=ChatService.getUserById(user2_id);
    if (idx!=-1)
      user2_name=$rootScope.chatlist[chat.publicChannelName][idx].name;  


    if (parseInt(data.user1)==chat.currentUser.id) // Yo ignoro / designoro a data.user2
    {

      if ($scope.userInfo.ignored[user2_id]==undefined)
        $scope.userInfo.ignored[user2_id]=true;
      else
      {
        if ($scope.userInfo.ignored[user2_id]!=undefined)
        {
          delete $scope.userInfo.ignored[user2_id]
        }
      }
      $scope.$apply(function() { 
      for (i=0;i<$rootScope.channels.length;i++)
      {
        channel=$rootScope.channels[i].name;
        for (j=0;j<$rootScope.chatlist[channel].length;j++)
        {
          if ($rootScope.chatlist[channel][j].id==user2_id)
            $rootScope.chatlist[channel][j].ignored=value;
        }
      }

      });
    }
    else
    {
      if (value)
      {
        if ($scope.userInfo.ignoringMe[user2_id]==undefined)
          $scope.userInfo.ignoringMe[user2_id]=true;
      }
      else
      {
        if ($scope.userInfo.ignoringMe[user2_id]!=undefined)
          delete $scope.userInfo.ignoringMe[user2_id]
      }

      $scope.$apply(function() { 
      ///  
      for (i=0;i<$rootScope.channels.length;i++)
      {
        channel=$rootScope.channels[i].name;
        for (j=0;j<$rootScope.chatlist[channel].length;j++)
        {
          if ($rootScope.chatlist[channel][j].id==user2_id)
            $rootScope.chatlist[channel][j].ignoringMe=value;
        }
      }
      ///
      });

    }

    AuthService.updateUI($scope.userInfo);
    $scope.userInfo=AuthService.getUserInfo();

  }


  window.chat_userKick=function(canal,data){
    console.log("");
    console.log("* Pusher : userKick *");
    console.log(canal);
    console.log(data);
    console.log("");
    ///
    console.log(chat.currentUser);
    var user_id=data.user_id;  
    console.log(user_id.substring(0,4));

    if (user_id.substring(0,4)=="nli_")
    {
      var ip=user_id.substr(4).replace(/_/g,'.'); ;
      console.log(ip)
      if (ip==chat.currentUser.ip)
        kick(data.moderator);
      else
        console.log("* ignorado *");
    }
    else
      if (chat.currentUser.id==parseInt(user_id))
        kick(data.moderator);
      else
        console.log("* ignorado *");

  }


  window.chat_userPing=function(canal,data) {
    console.log("");
    console.log("* Pusher : userPing *")
    console.log(canal)
    console.log(data)
    console.log("")
    ///
    console.log(chat.currentUser)
    var user_id=data.user2
    console.log(user_id.substring(0,4))

    if (user_id.substring(0,4)=="nli_")
    {
      var ip=user_id.substr(4).replace(/_/g,'.')
      console.log(ip)
      if (ip==chat.currentUser.ip)
        ping(data.user1)
      else
        console.log("* ignorado *")
    }
    else
      if (chat.currentUser.id==parseInt(user_id))
        ping(data.user1)
      else
        console.log("* ignorado *")

  }


  window.ping=function(user2_id){
    console.log("***** PING -> PONG *****");

    var info={};
    info.channel=chat.publicChannelName;
    info.user_id=chat.currentUser.id.toString();
    info.user=user2_id.toString();
    info.lastActivity=chat.lastActivity;
    info.pingpong=0;

    console.log(info);

    $rootScope.userInfo=AuthService.getUserInfo();
    $ionicLoading.show();
    ChatService.doPOST("/v4/pingUser",info,$rootScope.userInfo,function(result) {
      console.log("* dentro de pingUser *");
      if (!$rootScope.loadingContent)
        $ionicLoading.hide();
      console.log('* pingUser returned value *');
      console.log(result);

    });
    console.log("* después de pingUser *");

  }


  window.kick=function(moderator){
    console.log("***** KICK *****");
    console.log(moderator);
    $rootScope.logout(); 
    $ionicHistory.nextViewOptions({disableBack: true}); 

    if ($rootScope.loc=="es")
    {
      var txt1="Desconexion";
      var txt2=moderator+" te ha desconectado..";
    }
    else
      if ($rootScope.loc=="br")
      {                    
        var txt1="Desconexão";
        var txt2=moderator+" desconectou você…";                    
      }                  
      else
      {
        var txt1="Disconnection";
        var txt2=moderator+" has disconnected you.";
      }

    var myPopup = $ionicPopup.show({ template: '', title: txt1, subTitle: txt2, scope: $rootScope, buttons: [ { text: 'Ok' } ] }); 
    $state.go('app.settings');  

  }


  $rootScope.textIn=function(canal,data){

    var time=data.created_at;

    var l=$rootScope.messages[canal].length-1;

    if (l>-1 && $rootScope.messages[canal][l].userId == data.actor.id)
    {
      $rootScope.messages[canal][l].text=$rootScope.messages[canal][l].text+"\n"+data.body;
      $rootScope.messages[canal][l].time=time;
      $rootScope.messages[canal][l].lastUpdated=data.created_at;
    }
    else
    {
      if ($rootScope.messages[canal].length>=50)
      {
        $rootScope.messages[canal].shift();
      }
       
      $rootScope.messages[canal].push({
        message_id: data.message_id,
        userId: data.actor.id,
        userName: data.actor.displayName,
        image: data.actor.image,
        text: data.body,
        time: time,
        lastUpdated: data.created_at
      });         
    }

    if ( (chat.oficial[canal] == undefined) && $scope.userInfo)
    {
      window.localStorage.setItem("messages-"+$scope.userInfo.id+"-"+canal,JSON.stringify($rootScope.messages[canal]))
      window.localStorage.setItem("chatlist-"+$scope.userInfo.id+"-"+canal,JSON.stringify($rootScope.chatlist[canal]))
    }

    // Last chat / last user en el canal
    for (k=0;k<$rootScope.channels.length;k++)
    {          
      if ($rootScope.channels[k].name==canal)
        {
          $rootScope.channels[k].lastUser=data.actor.displayName;
          $rootScope.channels[k].lastChat=data.body;
          $rootScope.channels[k].lastUpdated=data.created_at;
        }
    }

  }




  $rootScope.openModal = function(channel,event) {

    console.log("* openModal *");
    console.log(channel);
    $rootScope.selected_channel=channel;

    $rootScope.popover.show(event);
  };
  $rootScope.closeModal = function() {
    $rootScope.popover.hide();
  };



  $rootScope.openPrivate=function(user2_id)
  {
    console.log("* openPrivate *");
    console.log(user2_id)
    //    console.log(optFav);

    $scope.userInfo=AuthService.getUserInfo();

    if (!$scope.userInfo)
    {
    
      $scope.login('chat2');
      return;
    
      if ($rootScope.loc=="es")
        var txt="No estás logueado";
      else
        if ($rootScope.loc=="br")
          var txt="Não conectado";
        else
          var txt="Not logged in";

      var myPopup = $ionicPopup.show({ template: '', title: "Warning", subTitle: txt, scope: $scope, buttons: [ { text: 'Ok' } ] });
      return;
    }

    if ($scope.userInfo.banned)
    {
      var txt=($rootScope.loc=="en") ? "Estás baneado" : "You are banned" ;
      var myPopup = $ionicPopup.show({ template: '', title: "Warning", subTitle: txt, scope: $scope, buttons: [ { text: 'Ok' } ] });
      return;
    }

    if ($scope.userInfo.ignoringMe[user2_id]!==undefined)
    {
      if ($rootScope.loc=="es")
      {
        var txt="El usuario te ha bloqueado";
        var txt2="Atención";
      }
      else
        if ($rootScope.loc=="br")
        {
          var txt="O usuário bloqueou você";
          var txt2="Advertência";
        }
        else
        {
          var txt="User has blocked you";
          var txt2="Warning";
        }
      var myPopup = $ionicPopup.show({ template: '', title: txt2, subTitle: txt, scope: $scope, buttons: [ { text: 'Ok' } ] });
      return;
    }

    if (chat.currentUser.id>user2_id)
      var channel="private-"+chat.currentUser.id+"_"+user2_id;
    else
      var channel="private-"+user2_id+"_"+chat.currentUser.id;
    console.log(channel);

    console.log("---------");

    if ($rootScope.chatlist[channel]!=undefined) // Si el canal ya existe, si esta abierto (state==1), ir, si está cerrado (state==0) -> reconectar
    {
      var state=0;
      for(i=0;i<$rootScope.channels.length;i++)
      {
        if ($rootScope.channels[i].name==channel)
          state=$rootScope.channels[i].state;
      }
      if (state==1) 
      {
        if ($ionicSideMenuDelegate.isOpenRight())
          $ionicSideMenuDelegate.toggleRight();
        $state.go("app.chats",{ channel: channel });
        return;          
      }
      else // Existe y está en estado 0 (cerrado) -> Comprobar si el usuario está online, si lo está, abrir, si no ir al chat
      {
        c=-1;
        for(i=0;i<$rootScope.chatlist[chat.publicChannelName].length;i++)
        {
          if ($rootScope.chatlist[chat.publicChannelName][i].id==user2_id)
            c=i;
        }
        if (c==-1) // El usuario no está en linea, ir al chat
        {
          if ($ionicSideMenuDelegate.isOpenRight())
            $ionicSideMenuDelegate.toggleRight();
          $state.go("app.chats",{ channel: channel });          
          return;
        }
      }
    }

    // No existe, crearlo

    var info={};
    info.user1=chat.currentUser.id.toString();
    info.user1_name=chat.currentUser.name;
    info.user2=user2_id.toString();
    info.private_channel=channel;

    $rootScope.userInfo=AuthService.getUserInfo();
    $ionicLoading.show();

    ChatService.doPOST("/v4/createPrivate",info,$rootScope.userInfo,function(result) {
      console.log("* dentro de createPrivate *");
      if (!$rootScope.loadingContent)
        $ionicLoading.hide();
      console.log('* createPrivate returned value *');
      console.log(result);
            
      var u2=$rootScope.findUserById(user2_id);
      if (u2!=-1)
        $rootScope.chatlist[chat.publicChannelName][u2].estado=-1;
    });
    console.log("* después de createPrivate *");

  }




  $rootScope.showInfo=function(user2_id){
    console.log("* showInfo *");
    console.log(user2_id)
    
    $ionicHistory.nextViewOptions({
      disableAnimate: true //,
    });

    $ionicSideMenuDelegate.toggleRight();   

    $state.go("app.settings",{ id: user2_id });
  }


  $rootScope.goChat=function(item)
  {
    console.log("*> goChat <*");
    console.log(item);

    if (!$rootScope.inListChat)
    {
      $ionicHistory.nextViewOptions({ disableAnimate: true });          
      $ionicSideMenuDelegate.toggleRight();  
    }

    $state.go("app.chats",{ channel: item.name });

  }


  $rootScope.closePrivate=function(channel){
    console.log("* closePrivate *");
    console.log(channel)

    user2_id=ChatService.getUserIdFromChannel(channel);
    console.log(user2_id);

    console.log("---------");

    // Si esta abierto (state==1), cerrar, si está cerrado (state==0) -> eliminar
    var state=0;
    for(i=0;i<$rootScope.channels.length;i++)
    {
      if ($rootScope.channels[i].name==channel)
        state=$rootScope.channels[i].state;
    }
    if (state==0) // Eliminar
    {
      delete $rootScope.chatlist[channel];
      delete $rootScope.messages[channel];
      //eliminar de localStorage "messages+"-"+$scope.userInfo.id+"-"+channel
      console.log("%%%%%%%%%%");
      console.log("Remove "+"messages-"+$scope.userInfo.id+"-"+channel);
      localStorage.removeItem("messages-"+$scope.userInfo.id+"-"+channel);
      console.log("Remove "+"chatlist-"+$scope.userInfo.id+"-"+channel);
      localStorage.removeItem("chatlist-"+$scope.userInfo.id+"-"+channel);
      console.log("%%%%%%%%%%");
      c=-1;
      for (i=0;i<$rootScope.channels.length;i++)
      {
        if ($rootScope.channels[i].name==channel)
          c=i;
      }
      if (c>-1)
      {
        if ($rootScope.channels[c].badge>0)
        {
          // Restar los mensajes pendientes de leer del badge global
          $rootScope.mainBadge=$rootScope.mainBadge-$rootScope.channels[c].badge;
          // Inicializar el badge del usuario en la lista de usuarios del público
          for(k=0;k<$rootScope.chatlist[chat.publicChannelName].length;k++)
          {
            if ($rootScope.chatlist[chat.publicChannelName][k].id==user2_id)
            {
              $rootScope.chatlist[chat.publicChannelName][k].badge=0;
            }
          }
        }
        $rootScope.channels.splice(c,1);
      }

      return;          
    }
    // No era 0, cerrar (desconectar)

    var info={};
    info.user1=chat.currentUser.id.toString();
    info.user1_name=chat.currentUser.name;
    info.user2=user2_id.toString();
    info.private_channel=channel;

    $rootScope.userInfo=AuthService.getUserInfo();
    $ionicLoading.show();

    ChatService.doPOST("/v4/destroyPrivate",info,$rootScope.userInfo,function(result) {      
      console.log("* dentro de destroyPrivate *");
      if (!$rootScope.loadingContent)
        $ionicLoading.hide();
      console.log('* destroyPrivate returned value *');
      console.log(result);
    });
    console.log("* después de destroyPrivate *");    

  }

  $rootScope.ignoreUser=function(user2_id){
    console.log("--- ignoreUser ---");

    var info={};
    info.user1=chat.currentUser.id.toString();
    info.user2=user2_id.toString();
    if ($scope.userInfo.ignored[user2_id])
      info.onoff="0";
    else
      info.onoff="1";
    info.channel=chat.publicChannelName;
    console.log(info);  

    $rootScope.userInfo=AuthService.getUserInfo();
    $ionicLoading.show();

    ChatService.doPOST("/v4/ignoreUser",info,$rootScope.userInfo,function(result) {
      console.log("* dentro de ignoreUser *");
      if (!$rootScope.loadingContent)
        $ionicLoading.hide();
      console.log('* ignoreUser returned value *');
      console.log(result);
    });
    console.log("* después de ignoreUser *");    

  }



  $scope.prueba=ChatService.prueba;
  $scope.$watch('ChatService.prueba', function (newVal, oldVal) {
    if(newVal) { 
      $scope.prueba = newVal;
    }
  },true);

  $scope.activeUsers=chat.activeUsers;
  $scope.$watch('chat.activeUsers', function (newVal, oldVal) {
    if(newVal) { 
      $scope.activeUsers = newVal;
    }
  },true);



  $scope.cambiar=function(){
    console.log("* cambiar *");
    console.log(" * $scope.prueba");
    console.log(" ["+$scope.prueba+"]");
    console.log(" ["+ChatService.prueba+"]");
    $scope.prueba=ChatService.prueba;
    $scope.activeUsers=chat.activeUsers;
  }

  $scope.go=function(where,aux){
    console.log("* goHref *");  
    console.log(where);
    console.log(aux);
    if (aux==10002)
      $state.go("app.single",{courseId:10002});
    else
      if (aux==10000)
        $state.go("app.single",{courseId:10000});
      else  
        $state.go(where);
  }


  $scope.botonMenu = function(donde) {
    console.log(donde)

    $ionicHistory.nextViewOptions({
      disableBack: true
    })
    $state.go('app.conjugate')
  }

  $scope.userInfo = AuthService.getUserInfo(); 

  // Inicialización AdMob
  var anuncio = false;
  if (window.adsOn)
  {
    if ( $scope.userInfo )
    {
      console.log( "* AppCtrl * Logueado. * $rootScope.premium:" + $rootScope.premium );
      if ( $rootScope.premium )
      {
        console.log( "* AppCtrl * Premium. *" );
        anuncio = false;
      }
      else
      {
        console.log( "* AppCtrl * No Premium. *" );
        anuncio = true;
      }
    }
    else
    {
      console.log( "* AppCtrl * Sin loguear *" );
      anuncio = true;
    }
  }
  if ( anuncio )
  {
    if ( window.AdMob )
    {
      var firstTime = window.localStorage.getItem( "firstTime" );
      if ( firstTime == "NO" )
      {

        (async function initAsync() {
          try {
            await adsService.showBanner();
            console.log("* AppCtrl * Primera llamada a adsService.showBanner() *")
          } catch (err) {
            console.log("* AppCtrl * Error en la primera llamada a adsService.showBanner() *", err);
          }
        })();

      }
      else
      {
        window.localStorage.setItem("firstTime","NO") // Las siguientes veces, si que ha de crear el anuncio, la primera va a ir al Tour.
      }
    } 
    else
    {
      console.log("* AppCtrl * No existe AdMob: No se llama a adsService.showBanner() *")
    }
  }



  $rootScope.chatEnabled=false
  if ( $rootScope.premium || ($scope.userInfo && $scope.userInfo.oldusr) )
    $rootScope.chatEnabled=true


  // Esto asigna chat.userInfo
  if ($scope.userInfo)
    AuthService.setUserInfo($scope.userInfo);

  ChatService.Prepare($scope.userInfo);
  ChatService.Init();

  // Form data for the login modal
  $scope.loginData = {};
  $scope.registerData = {};  
  $scope.recoverData = {};

  // Create the login modal that we will use later
  $ionicModal.fromTemplateUrl('views/login.html', {
    scope: $scope
  }).then(function(modal) {
    $scope.modal = modal;
  });

  $ionicModal.fromTemplateUrl('views/register.html', {
    scope: $scope
  }).then(function(modal) {
    $scope.modal2 = modal;
  });

  $ionicModal.fromTemplateUrl('views/legal2.html', {
    scope: $scope
  }).then(function(modal) {
    $scope.modal3 = modal;
  });
  
  $ionicModal.fromTemplateUrl('views/recover.html', {
    scope: $scope
  }).then(function(modal) {
    $scope.modalrec = modal;
  });

  $ionicModal.fromTemplateUrl('views/purchase.html', {
    scope: $rootScope,
    animation: 'scale-in'
  }).then(function(modal) {
    $rootScope.purchaseModal = modal;
  });

  $ionicModal.fromTemplateUrl('views/purchase2.html', {
    scope: $rootScope,
    animation: 'slide-in-left'
  }).then(function(modal) {
    $rootScope.purchaseModal2 = modal;
  });

  $rootScope.closePurchase = async function() {	
    $rootScope.purchaseModal.hide();
    console.log("* closePurchase *");
    if ( AdMob && window.adsOn ) await adsService.showBanner();
  };

  $rootScope.closePurchase2 = function() {	
    $rootScope.purchaseModal2.hide();
    console.log("* closePurchase2 *");
  };



$rootScope.goPremium = async function( donde ) {

  if ( AdMob && window.adsOn ) await adsService.hideBanner();

  console.log("* goPremium * window.appInfo.id:", window.appInfo.id );

  $ionicLoading.show();  
  if ( $rootScope.userInfo )
    user_id = $rootScope.userInfo.id;
  else
    user_id = 999999999;
  var endpoint=varGlobal.apiURL + '/v6/promotion?user_id=' + user_id;
  console.log( "* goPremium *", endpoint );

  $http.get( endpoint, { headers: { 'x-app-ver': genService.deviceId() } } ).then(
    function okCallback(response) {
      $ionicLoading.hide(); 
      console.log( "* goPremium * getPromotion OK *" ); 
      
      var datos=response.data.promotion;

      console.log( "* goPremium * response.data.promotion:", JSON.stringify( datos ) );

      window.subsStoreID[ "android" ] = datos.andStoreID;
      window.subsStoreID[ "ios" ] = datos.iosStoreID;
      
      window.subsID = window.subsStoreID[ r34lp0w3r.platform ];

      console.log( "* goPremium * window.subsID:", window.subsID );

      goPremiumGO( donde );
    }, 
    async function errorCallback(response) {
      if ( AdMob && window.adsOn ) await adsService.showBanner();
      $ionicLoading.hide(); 
      console.log("* getPromotion ERROR *"); 
      console.log("#error ("+endpoint+") #"); 
      console.log("@@@@@"), console.log(response); console.log("@@@@@"); 
      goPremiumErr();
    }
  )

}


goPremiumGO=function(donde)
{
  console.log( "* goPremiumGO * r34lp0w3r.platform:", r34lp0w3r.platform );
  console.log( "* goPremiumGO * window.subsID:", window.subsID );
  console.log( "* goPremiumGO * window.subsStorePrice:", JSON.stringify(window.subsStorePrice) );
  console.log( "* goPremiumGO * window.subsDefaultID[ " + r34lp0w3r.platform + " ]:", window.subsDefaultID[ r34lp0w3r.platform ] );
  
  // En window.subsID tenemos el id de la oferta que se ha de comprar, obtenido en goPremium() desde el backend
  // En window.subsStorePrice tenemos los precios de la tienda, obtenidos en app.js en la función initInAppPurchases()
  // En window.subsDefaultID tenemos el id de la oferta por defecto, que se define en inicio.js
  
  // --> Comprobar si tenemos el precio
  if ( !(window.subsID in window.subsStorePrice) )
  {

    // --> Si no tenemos precio del id, probar con la oferta por defecto
    window.subsID = window.subsDefaultID[ r34lp0w3r.platform ];
    if ( !( window.subsID in window.subsStorePrice ) )
    {
      goPremiumErr();
      return;
    }

    // Sigue adelante con la oferta por defecto, por que tiene el precio
    // La oferta por defecto es una subscripción anual sin descuento
  }

  console.log( "* goPremiumGO * window.subsID:", window.subsID )

  if ( r34lp0w3r.platform == 'ios' )
    $rootScope.is_ios = true;
  else
    $rootScope.is_ios = false;

  window.subsPrice = window.subsStorePrice[window.subsID];

  console.log( "* goPremiumGO * window.subsPrice:", window.subsPrice )

  $rootScope.purchaseModalTxt ="";
  if (donde=="fullLesson" || donde=="fullLesson2")
  {
    if ($rootScope.loc=="es")
      $rootScope.purchaseModalTxt=$sce.trustAsHtml("<p>Además podrás usarla<br>sin conexión a Internet.</p><p><b>Y podrás disfrutar del contenido<br>completo de las lecciones.</b></p>");
    else
      $rootScope.purchaseModalTxt=$sce.trustAsHtml("<p>Besides you will be able to use it<br>without Internet connection.</p><p><b>And enjoy the complete<br>lesson content.</b></p>");
  }
  else
    if (donde="lessonAudios")
    {
      if ($rootScope.loc=="es")    
        $rootScope.purchaseModalTxt = $sce.trustAsHtml("<br><p>Además podrás disfrutar de los audios<br> de las lecciones en alta calidad <br>sin conexión a Internet.</p>");    
      else
        $rootScope.purchaseModalTxt = $sce.trustAsHtml("<br><p>Besides you will be able to enjoy<br> high quality lesson audio <br>without Internet connection.</p>");    
    }
    else
    {
      if ($rootScope.loc=="es")    
        $rootScope.purchaseModalTxt=$sce.trustAsHtml("<p>Además podrás usarla<br>sin conexión a Internet.</p>");    
      else
        $rootScope.purchaseModalTxt=$sce.trustAsHtml("<p>Besides you will be able to use it<br>without Internet connection.</p>");    
    }

$rootScope.subsID = window.subsID;
$rootScope.subsStorePrice = window.subsStorePrice;
//$rootScope.subsDiscount = window.subsDiscount;
//$rootScope.subsOfferTxt = window.subsOfferTxt;
//$rootScope.subsPeriodTxt = window.subsPeriodTxt;


  if (donde=="fullLesson2") // Sólo cambia la animación
  {
    //alert("purchaseModal2")
  	$rootScope.purchaseModal2.show();  	
  }
  else
  {
    //alert("purchaseModal")
   	$rootScope.purchaseModal.show();
  }

}

goPremiumErr=function()
{
    var l=$rootScope.loc;
    if (l=="es") var txt1="Problema obteniendo datos de la Store"; else if (l=="br") var txt1="Problema de conexão obtendo dados da Store"; else var txt1="Connection issue retrieving Store data";      
    if (l=="es") var txt2="Lo sentimos, algo no fue bien. Comprueba tu conexión con Internet."; else if (l=="br") var txt2="Sentimos muito, algo deu errado. Verifique sua conexão de internet."; 
    else
        var txt2="Sorry, something wasn't right. Please check your internet connection.";  
    var myPopup = $ionicPopup.show({ template: '', title: txt1, subTitle: txt2, scope: $rootScope, buttons: [ { text: 'Ok' } ] }); 
}



$ionicModal.fromTemplateUrl('views/purchase_thx.html', {
  scope: $rootScope,
  animation: 'scale-in'
}).then(function(modal) {
  $rootScope.purchasThanksModal = modal;
});
$rootScope.closePurchaseThanks = function() {
  console.log("* closePurchaseThanks *");
  $rootScope.purchasThanksModal.hide();
};

$ionicModal.fromTemplateUrl('views/purchase_exp.html', {
  scope: $rootScope,
  animation: 'scale-in'
}).then(function(modal) {
  $rootScope.purchasExplainModal = modal;
});
$rootScope.closePurchaseExplain = function() {
  console.log("* closePurchaseExplain *");
  $rootScope.purchasExplainModal.hide();
};

$ionicModal.fromTemplateUrl('views/premium_opts.html', {
  scope: $rootScope,
  animation: 'scale-in' //'slide-in-left' 
}).then(function(modal) {
  $rootScope.premiumOpts = modal;
});
$rootScope.closePremiumOpts = async function() {
  console.log("* closePremiumOpts *");
  $rootScope.premiumOpts.hide();
  if ( AdMob && window.adsOn ) await adsService.showBanner();  
};

$ionicModal.fromTemplateUrl('views/show_error.html', {
  scope: $rootScope,
  animation: 'scale-in'
}).then(function(modal) {
  $rootScope.showErrorModal = modal;
});
$rootScope.closeShowError = function() {
  console.log("* closeShowError *");
  $rootScope.showErrorModal.hide();
};

$ionicModal.fromTemplateUrl('views/RGPD.html', {
  scope: $rootScope,
  animation: 'scale-in'
}).then(function(modal) {
  $rootScope.RGPDModal = modal;
});
$rootScope.closeRGPDModal = async function() {
  console.log("* closeRGPDModal *");
  $rootScope.RGPDModal.hide();
  if ( AdMob ) await adsService.showBanner();
};
$rootScope.tglPersonal=function(param)
{
  $rootScope.personalAds=param;
  window.localStorage.setItem("_personalAds",($rootScope.personalAds)? "on" : "off");
}




  // Triggered in the login modal to close it
  $scope.closeLogin = function() {
    $scope.modal.hide();
  };

  $scope.closeRegister = function() {
    $rootScope.error_login="";
    $scope.modal2.hide();
  };

  $scope.closeRecover = function() {
    $rootScope.error_login="";
    $scope.modalrec.hide();
  };


  $scope.closeLegal = function() {
    console.log("* closeLegal *");
    $scope.modal3.hide();
  };


  $scope.toggleAccept = function() {
    console.log("* toggleAccept *");
    console.log($scope.registerData.acceptterms);
  };


  
  $scope.goLegal = function() {
    console.log("* goLegal *");   
    $state.go("app.legal");
  };

  // Open the login modal
  $rootScope.login = function(where) {

window.focusControl=false;  

    console.log("--- ENTRA EN LOGIN ---");
    console.log(where);
    if (where=="purchase" || where=="purchaseSection")
      $scope.isPurchase=true;
    else
      $scope.isPurchase=false;
    if (where=="chat" || where=="chat2")
    {
      if (where=="chat2") // Abrir privado
        $ionicSideMenuDelegate.toggleRight();
      $scope.isChat=true;
      $scope.loginData.where=null;
    }  
    else
    {
      $scope.isChat=false;
      $scope.loginData.where=where;
    }
    if (!$scope.isPurchase && !$scope.isChat)
      $scope.isOther=true;
    else
      $scope.isOther=false;
    $scope.error="";
    $rootScope.srchOn=false; // Desactivar búsqueda si está activada
    $scope.modal.show();    
  };


  $scope.goSettings = function() {
    $ionicHistory.nextViewOptions({
      disableAnimate: true,
      disableBack: true
    });
    $state.go('app.settings');
  };

  $scope.goLearn = function() {
    $ionicHistory.nextViewOptions({
      disableAnimate: true,
      disableBack: true
    });
    $state.go('app.learn');
  };







  $scope.forgotPass= function()
  {
    console.log("* forgotPass *",$scope.recoverData.email);

    if ($scope.recoverData.email==undefined || $scope.recoverData.email=="")
    {
      if ($rootScope.loc=="es")
        $scope.error="Debes introducir tu email."
      else
        if ($rootScope.loc=="br")
          $scope.error="Você debe digitar seu endereço de email."        
        else
          $scope.error="You must enter your email address."                  
      return
    }

    $scope.error=""

    console.log("* antes de passRecover *");
    $ionicLoading.show();
    var data={ "email":$scope.recoverData.email, "lang":$rootScope.loc };
    backendService.doPost('/v3/passreset',null,data,function(result) {

      console.log("* dentro de passRecover *");    
      if (!$rootScope.loadingContent)
        $ionicLoading.hide();
      console.log('* passRecover returned value *');
      console.log(result);
      $scope.error=result.data.error;

      if ($scope.error=="")
      { 

        if ($rootScope.loc=="es")
        {
          var txt1="Te hemos enviado un correo electrónico con las instrucciones para restablecer tu contraseña";
          var txt2="Atención";          
        }
        else
          if ($rootScope.loc=="br")
          {
            var txt1="Enviamos um email para que você redefina a sua senha.";
            var txt2="Advertência";
          }
          else
          {
            var txt1="We've sent you an email with instructions to reset your password.";
            var txt2="Warning";
          }

        var myPopup = $ionicPopup.show({ template: '', title: txt2, subTitle: txt1, scope: $scope, buttons: [ { text: 'Ok' } ] });
        $scope.modalrec.hide();
      }
    });
    console.log("* después de passRecover *");

  }


  $scope.goWebLegal = function()
  {
    console.log("* goWebLegal *");
    
    const url = ($rootScope.loc === 'es')
      ? 'https://www.curso-ingles.com/var/datos-legales'
      : 'https://www.curso-ingles.com/en/support/legal-data';

    if (Capacitor.isNativePlatform()) {
      window.open(url, '_system'); // funciona en apps nativas
    } else {
      window.open(url, '_blank');  // para navegador
    }
        
  }

  $scope.goWebPolicy = function()
  {
    console.log("* goWebPolicy *");

    const url = ($rootScope.loc === 'es')
      ? 'https://www.curso-ingles.com/var/politica-de-privacidad'
      : 'https://www.curso-ingles.com/en/support/privacy-policy';

    if (Capacitor.isNativePlatform()) {
      window.open(url, '_system'); // funciona en apps nativas
    } else {
      window.open(url, '_blank');  // para navegador
    }
    
   }


  $scope.registerPopup = function()
  {
    console.log("* registerPopup *");

    console.log($ionicSideMenuDelegate.isOpenLeft());  
    if ($ionicSideMenuDelegate.isOpenLeft()) $ionicSideMenuDelegate.toggleLeft();  
  
    $scope.error="";
    $rootScope.error_login="";
    $rootScope.srchOn=false; // Desactivar búsqueda si está activada    
    $scope.modal2.show();
  }
    

  $scope.forgotPassPopup = function()
  {
    console.log("* forgotPassPopup *");
    
    console.log($ionicSideMenuDelegate.isOpenLeft());  
    if ($ionicSideMenuDelegate.isOpenLeft()) $ionicSideMenuDelegate.toggleLeft();  
  
    $scope.error="";
    $rootScope.error_login="";
    $rootScope.srchOn=false; // Desactivar búsqueda si está activada    
    $scope.modalrec.show();
  }



  $scope.legalPopup = function()
  {
    console.log("* legalPopup *");
    
    $scope.modal3.show();
  } 


  $scope.doRegister= function() {

    console.log("* doRegister *");

    console.log($scope.registerData.username);
    console.log($scope.registerData.email);
    console.log($scope.registerData.password);
    console.log($scope.registerData.confirmation);
    console.log($scope.registerData.acceptterms);

    if ($scope.registerData.password==undefined || $scope.registerData.confirmation==undefined || $scope.registerData.username==undefined || $scope.registerData.email==undefined)
    {
      console.log("Faltan datos.")
      if ($rootScope.loc=="es")
        $scope.regerror="Introduce los datos, por favor.";
      else
        if ($rootScope.loc=="br")
          $scope.regerror="Digite as suas informações.";
        else
          $scope.regerror="Please enter your information.";
      return
    }

    if ($scope.registerData.password && $scope.registerData.confirmation && $scope.registerData.password!=$scope.registerData.confirmation)
    {
      console.log("No coincide la confirmación.")
      if ($rootScope.loc=="es")
        $scope.regerror="La confirmación no coincide con la contraseña.";
      else
        if ($rootScope.loc=="br")
          $scope.regerror="A confirmação não corresponde à senha.";
        else
          $scope.regerror="Confirmation doesn't match password.";
      return
    }
    
    if (!$scope.registerData.acceptterms)
    {
      console.log("Condiciones de uso no aceptadas.")
      if ($rootScope.loc=="es")
        $scope.regerror="Debes aceptar las condiciones de uso.";
      else
        if ($rootScope.loc=="br")
          $scope.regerror="Você debe aceitar os termos de uso.";
        else
          $scope.regerror="You must accept the terms of use.";
      return
    }
    
    $scope.regerror=""

    console.log("* antes de doRegister *");
    $ionicLoading.show();

    $scope.registerData.lang=$rootScope.loc;
    $scope.registerData.locale=$rootScope.loc;
    backendService.doPost('/v3/usr/create',null,$scope.registerData,function(result) {
      
      console.log("* dentro de doRegister *");
      
      if (!$rootScope.loadingContent)
        $ionicLoading.hide();
      console.log('* doRegister returned value *');
      console.log(result);
      $scope.regerror=result.data.error;

      if ($scope.regerror=="")
      { 
        if ($rootScope.loc=="es")
        {
          var txt="¡Gracias! Por favor, revisa tu email para activar tu cuenta.";
          var txt2="Atención";
        }
        else
          if ($rootScope.loc=="br")
          {
            var txt="Obrigado! Verifique seu email para ativar a conta.";
            var txt2="Advertência";            
          }
          else
          {
            var txt="Thank You! Please check your email to activate your account.";
            var txt2="Warning";            
          }
        var myPopup = $ionicPopup.show({ template: '', title: txt2, subTitle: txt, scope: $scope, buttons: [ { text: 'Ok' } ] });
        $scope.modal2.hide();
      }


    });
    console.log("* después de doRegister *");

  }



  $rootScope.logout = function() {

    console.log("*logout*");

    console.log($state.current.name);

    $rootScope.userInfo=AuthService.getUserInfo();
    if ($rootScope.userInfo)
    {
      var pendProgress=window.localStorage.getItem("_pendProgress"+$rootScope.userInfo.id);
      if (pendProgress)
        window.localStorage.removeItem("_pendProgress"+$rootScope.userInfo.id);
    }

    window.localStorage.removeItem("userInfo");

    AuthService.setUserInfo( { id:-1, token:"iz3r9sIlw70+", name:"", email:"", chatImage:"", style:"", current_course_image:"", current_course_background:"", current_course_progress:0, moderator:false, hidden:false, ip:"192.168.1.999" } )
    
    localStorage.removeItem("_purchase_id");
    localStorage.removeItem("_purchase_expires");
    localStorage.removeItem("_purchase_expires_human");
    localStorage.removeItem("_oldusr");

    window.upd();

    $state.go($state.current, null, {reload: true}); // Para que pase en el menú el 'logout' a 'login'

    ChatService.Destroy()
    ChatService.Prepare(null)
    ChatService.Init()

    $ionicScrollDelegate.scrollTop(true)
  }



  $scope.logout2 = function() {

    console.log("*logout2*")
    
    AuthService.setUserInfo({
      id : -1,
      token : "iz3r9sIlw70+",
      name : "",
      email : "",
      chatImage : "",
      sttyle : "",
      current_course_image : "",
      current_course_background : "",
      current_course_progress : 0,
      moderator : false,
      hidden : false,
      ip : "192.168.1.999"
    })
    // $state.go($state.current, null, {reload: true}); // Para que pase en el menú el 'logout' a 'login'
    $state.go('app.learn',null)
    $ionicSideMenuDelegate.toggleLeft()
  }



  $scope.tabOption=0;
  $scope.rightTabClick = function(index){
    console.log("* rightTabClick *",index);
    $scope.tabOption = index;
    $scope.$apply();
  }

  // Perform the login action when the user submits the login form
  $scope.doLogin = function() {
    console.log('Doing login');
    console.log($scope.loginData);

    $scope.error="";
 
    console.log("* antes de doLogin *");
    $ionicLoading.show();

    if ($rootScope.debug)
    {
      var endPoint='/v3/usr/loginsocial';
      var usrData={}
      usrData.typeUser=$scope.loginData.typeUser;      
      usrData.social_id=$scope.loginData.social_id;
      usrData.locale=$rootScope.loc;
    }    
    else
    {
      var endPoint='/v3/usr/login';
      var usrData={ email : $scope.loginData.username, pass : $scope.loginData.password, locale:$rootScope.loc };
    }
    var uuid=window.localStorage.getItem("uuid");
    usrData.uuid=uuid;
    backendService.doPost(endPoint,null,usrData,function(result) {
      console.log("* dentro de doLogin *");
      if (!$rootScope.loadingContent)
        $ionicLoading.hide();
      console.log('* doLogin returned value *');
      console.log(result);

      if (result.data.error=="")
      {
        var userInfo=result.data.user;

        if ($rootScope.debug) // loginsocial
        {  
          if (userInfo.avatar_file_name!="")
            userInfo["image"]="https://s3.amazonaws.com/sk.audios.dev/avatars/"+userInfo.id+"/original/"+userInfo.avatar_file_name;
          else
            userInfo["image"]="https://s3.amazonaws.com/sk.CursoIngles/no-avatar.gif"
        }

        userInfo["style"]="height: 48px; width: 48px; padding: 4px; margin: 12px 0 4px 0; border-radius: 48px; background-image: linear-gradient(-90deg, #ededed 50%, rgba(0, 0, 0, 0) 50%, rgba(0, 0, 0, 0)), linear-gradient(270deg, #fa6745 50%, #ededed 50%, #ededed);";
        var str=new Date().getTime();
        userInfo["chatImage"]=userInfo["image"]+"?"+str;

        window.localStorage.setItem("userInfo",JSON.stringify(userInfo))

        var d =new Date(userInfo.expires_date);
        genService.dbgAlert(JSON.stringify(userInfo.expires_date));        
        localStorage.setItem("_purchase_id","???");
        localStorage.setItem("_purchase_expires",d.getTime().toString());
        localStorage.setItem("_purchase_expires_human",d.toISOString() ); //.substring(0,10)
        localStorage.setItem("_oldusr",userInfo.oldusr);
        window.upd();

        AuthService.setUserInfo(userInfo);

        ChatService.Destroy();
        // Si no es bannedcomplete, prepare+init        
        if ($rootScope.chatEnabled)
        {        
          ChatService.Prepare(userInfo);
          ChatService.Init();
        }

        $state.go($state.current, null, {reload: true}); // Esto si el view está definido como cache-view="false", lo recarga, si no, no lo recarga pero pasa por "$ionicView.enter" en su controller.
        $scope.closeLogin();

        if ($scope.loginData.where) // Si no viene de chat o chat2 (enviar en el chat / abrir privado)
        {          
          if ($scope.loginData.where=="purchase" || $scope.loginData.where=="purchaseSection")
          {
          //  $ionicHistory.nextViewOptions({ disableBack: true });
          //  $state.go("app.subscription");
          if (!$rootScope.premium) // Se acaba de loguear, si es premium ya no necesita acceder al pop up para hacerse premium.
            if ($scope.loginData.where=="purchase" )
              $rootScope.goPremium();
            else
              $rootScope.goPremium("fullLesson");             
          else
          {
          	// Cerrar el pop-up intermedio con el botón de Subscribirse / ver Rewarded Video si es que viene de allí.
          	$rootScope.premiumOpts.hide();
          }
          }
          else
          {          
            $ionicHistory.nextViewOptions({ disableBack: true });
            $state.go($scope.loginData.where);
          }
        }

      }
      else
      {
        $scope.error=result.data.error;
      }

    });

  }
  

  $rootScope.isOnline=function(channel)
  {
console.log("")
console.log("  *** isOnline >>")
console.log("  "+chat.currentUser.id);
console.log("  ["+channel.name+"]")    
    var name=channel.name;
    var n1=name.search("-");
    var n2=name.search("_");

    var u1=parseInt(name.substr(n1+1,n2-n1-1));
    var u2=parseInt(name.substr(n2+1,1000));
console.log("  "+u1);
console.log("  "+u2);

    if (u2==chat.currentUser.id)
    {
      console.log("* swap *");
      u2=u1;
    }
    else
      console.log("* no swap *");

    var c=-1;
    if ($rootScope.chatlist[chat.publicChannelName])
    {
      for(nn=0;nn<$rootScope.chatlist[chat.publicChannelName].length;nn++)
      {
        if ($rootScope.chatlist[chat.publicChannelName][nn].id==u2)
          c=nn;
      }
    }
console.log("  "+c);
console.log("  <<< isOnline **")
console.log("")

    if (c==-1)
      return "";
    else
      return "on line";
  }
   
})

























.controller('questionCtrl', function($scope, $stateParams, AuthService, PlayListsService, ChatService, varGlobal) {
  console.log($stateParams.questionId);


  $scope.questionId=$stateParams.questionId;


})



///////////////////////////////////////////////////////////////////////////////////////////////////
.controller('resourcesCtrl', function($scope, $ionicSideMenuDelegate, $location) {

  $scope.go = function(where){
    $location.path(where);
  }


})

;


console.log("003.001 >###> js/controllers.js <<<")