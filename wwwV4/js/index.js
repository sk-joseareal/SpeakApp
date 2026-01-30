console.log("001.001 >###> js/index.js >>>")

window.version = "4.16.0.2509301100.m1MBP"

console.log("# 00a # Inicio de index.js #")

window.env	    = "PRO";
window.testAds      = false;
window.viewDBG      = false; // Se activa al hacer login con una cuenta de determinados dominios.
window.factoryClean = false;
window.apiPRO       = "https://api.curso-ingles.com";
window.apiDEV       = "https://apidev.curso-ingles.com";
window.uuid         = "???";
window.autoSpeech   = true;

console.log("# 00b # Definición del polyfill String.repeat #")

// Para Android <=5
String.prototype.repeat = function( num )
{
  return new Array( num + 1 ).join( this );
}

console.log("# 00d # Definición del módulo 'starter' de Angular #")

angular.module('starter', ['ionic', 'starter.rutas', 'starter.genservice', 'starter.backendservice', 'starter.authservice', 'starter.chatservice', 'starter.adsservice', 'starter.controllers', 'ngCordova', 'ti-segmented-control', 'ngDraggable', 'ngFileUpload'])
.constant('$ionicLoadingConfig', {
  template: '<ion-spinner icon="bubbles"></ion-spinner>',
  showBackdrop: false
})
// Cambiando la variable que tenga asignada (p.ej. 'damefoco'), se le da el focus al input que tenga la directiva:  focus-me="damefoco" 
.directive('focusMe', function($timeout) {
  return {
    link: function(scope, element, attrs) {
      scope.$watch(attrs.focusMe, function(newVal,oldVal) {
        $timeout(function() 
        {
          console.log("* focusMe >>> * ");
          console.log("* focusMe * attrs.focusMe ... : '"+attrs.focusMe+"' *");
          console.log("* focusMe * newVal .......... : '"+newVal+"' *");
          console.log("* focusMe * oldVal .......... : '"+oldVal+"' *");
          console.log("* focusMe * ................. : '"+Object.keys(scope));
          console.log("* focusMe * scope.$id ....... : '"+scope.$id+"' *");
          console.log("* focusMe * scope.$parent.$id : '"+scope.$parent.$id+"' *");
          console.log("* focusMe * element ......... : '"+JSON.stringify(element)+"' *");
          console.log("* <<< focusMe *");
          element[0].focus();
        },100);
      });
    }
  };
})
// Esta directiva lo que hace es que cuando estés en un view de segundo nivel o superior (con backbutton) no muestre el 'hamburguer' 
// y sin embargo siga funcionando el swipe de mostrar los menus laterales -> Para que funcione el swipe en menu.html se pone 
// <ion-side-menus enable-menu-with-back-views="true">
// Al estar en 'true' el swype funciona, pero muestra el 'hamburguer' al lado del backbutton.
.directive('menuToggle', function() {        
  return {
    restrict: 'AC',
    link: function($scope, $element, $attr) {
      $scope.$on('$ionicView.beforeEnter', function(ev, viewData) {
        if (viewData.enableBack) {
            $element.addClass('hide');
        }
      });
    }
  };
})
.directive('autoFocus', function($timeout) {
  return {
    restrict: 'AC',
    link: function(_scope, _element) {
      $timeout(function(){
        console.log(">FOCUS<");
          _element[0].focus();
      }, 0);
    }
  };
})
.directive('focusOnShow', function($timeout) {
  return {
    restrict: 'A',
    link: function($scope, $element, $attr) {
      if ($attr.ngShow){
        $scope.$watch($attr.ngShow, function(newValue){
          if(newValue){
            $timeout(function(){
              $element[0].focus();
            }, 10);
          }
        })      
      }
      if ($attr.ngHide){
        $scope.$watch($attr.ngHide, function(newValue){
          if(!newValue){
            $timeout(function(){
              $element[0].focus();
            }, 10);
          }
        })      
      }
    }
  };
})
.directive('constantFocus', function(){
  return {
    restrict: 'A',
    link: function(scope, element, attrs){
      console.log("!");
      element[0].addEventListener('focusout', function(e){
        window.focusControl && element[0].focus();
      });
    }
  };
})
.directive("iconClose1", function($timeout){
  return {
    restrict: 'AC',
    //template: "<p>Hecho con una directiva<p>",
    link: function(_scope, _element) {
      _element.bind('click',function(e) {
        e.preventDefault();
        var p = $(this).parent();
        var el=$('input',p)[0];
        if (!el)
        {
          var el=$('textarea',p)[0];
        }
        if(el)
        {
          $(el).val("");
          $timeout(function(){                
              $(el).focus();
          },0);        
        }
      });
    }    
  };
})
.filter('to_trusted', ['$sce', function($sce){
  return function(text) {
    return $sce.trustAsHtml(text);
  };
}])
.value('varGlobal',{version: version, 

  debugMode: false,
  debugModePurch: false,
  platform: "",
  adsOn: window.adsOn,
  cacheOn: false,
  checkUpdates: false,
  viewCount: 0,
  rateCount: 20,
  authOn: true,
  learnPass: 0,
  grammarPass: 0,
  courses: {
        4: { id: 4,      name: "Nivel básico",            name_en: "Basic level",        background: "#fac545", imageURL: "assets/course4.png"     },
        5: { id: 5,      name: "Nivel intermedio",        name_en: "Intermediate level", background: "#fa9245", imageURL: "assets/course5.png"     },
        6: { id: 6,      name: "Nivel avanzado",          name_en: "Advanced level",     background: "#fa6745", imageURL: "assets/course6.png"     },
    10000: { id: 10000,  name: "Vocabulario para viajar", name_en: "Travel vocabulary",  background: "#9bcecf", imageURL: "assets/course10000.png" },
    10002: { id: 10002,  name: "Chuletas",                name_en: "Cheat Sheets",       background: "#fac545", imageURL: "assets/course10002.png" }
  },
  currentCourse: { 'id' : 0 }, 
  scores:[
    { minimum_mark:   0, maximum_mark:  59, name: "D",  description: "Prueba perdida.", course_id: 4, quiz_recommendation: "Has perdido la prueba. ¡Te aconsejamos revisar la lección!", description_en: "", quiz_recommendation_en: "Falta traducir 1" },
    { minimum_mark:  60, maximum_mark:  69, name: "C",  description: "Regular a malo",  course_id: 4, quiz_recommendation: "Para mejorar tu nota te aconsejamos revisar la lección!",    description_en: "", quiz_recommendation_en: "Falta traducir 2" },
    { minimum_mark:  70, maximum_mark:  79, name: "C+", description: "Regular",         course_id: 4, quiz_recommendation: "Para mejorar tu nota te aconsejamos revisar la lección!",    description_en: "", quiz_recommendation_en: "Falta traducir 3" },
    { minimum_mark:  80, maximum_mark:  89, name: "B",  description: "Bien",            course_id: 5, quiz_recommendation: "Para mejorar tu nota te aconsejamos revisar la lección!",    description_en: "", quiz_recommendation_en: "Falta traducir 4" },
    { minimum_mark:  90, maximum_mark:  99, name: "B+", description: "Casi perfecto",   course_id: 6, quiz_recommendation: "Para mejorar tu nota te aconsejamos revisar la lección!",    description_en: "", quiz_recommendation_en: "Falta traducir 5" },
    { minimum_mark: 100, maximum_mark: 100, name: "A",  description: "Perfecto",        course_id: 6, quiz_recommendation: "¡Te recomendamos pasar a la siguiente lección!",             description_en: "", quiz_recommendation_en: "Falta traducir 6" },
  ],

  env: window.env,

  apiPRO: apiPRO,
  apiDEV: apiDEV,

  apiURL: apiPRO,

  auth_key: "3fD8i03kNCqxj/2hyDR2Ngytgez0DFXjimBYF5HjfHf3Td2kU5lXVSqBv1S\\nxZ9rj7UZ6lGMUdspSqPIGArs8w",

  prueba: "esto es la prueba" } )

.value( 'loc', "en" )

.value( 'locale', { es: { txt01: "texto1", txt02: "texto2" } , en: { txt01: "text1", txt02: "text2" } }  )

.value('chat',{
    currentUser : { id : -1, name : "", email : "", avatar : "", estilo : "", 
    progress_image : "", progress_color : "", progress_value : 0, 
    moderator : false, hidden : false, premium : false, ip : "1.2.3.4" },
    page : "chatmobile",
    locale: "en",
    activeUsers : [],
    channels: {},
    privateChannels: {}
  }
)
/* 
.config($compileProvider)
{
  // fix "Failed to load webpage with error: unsupported URL"
$compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|sms|tel|geo|ftp|mailto|file|ghttps?|ms-appx-web|ms-appx|x-wmapp0|ionic):/);
}
*/
.config(function($ionicConfigProvider) {
  $ionicConfigProvider.form.checkbox("circle");
})


.run( function ( $ionicPlatform, $http, varGlobal, $ionicLoading, $rootScope, $location, $ionicPopup, adsService, ChatService, backendService, genService, AuthService, UnitsService, $timeout ) {

  console.log("# 00x.000 # starter.run #")
  
$rootScope.flash01 = false;
$rootScope.flash02 = false;
$rootScope.flash03 = false;

  // Listeners desde r34lp0w3r_capacitor.js ---------------------------------------------------------------
  // Los listeners de ionic están en controller.js

  console.log("# 00x.000 # starter.run # registering window.loginCallbackFromBrowser *");
  window.loginCallbackFromBrowser = function( info_url ) {
    console.log("<<<<<<<<<<<<<< window.loginCallbackFromBrowser >>>>>>>>>>>>>");
    $rootScope.$apply(() => {
      console.log("<<<<<<<<<<<<<< $rootScope.$broadcast( 'loginDataReceived', info_url ) >>>>>>>>>>>>>");
      $rootScope.$broadcast( 'loginDataReceived', info_url );
    });
  };

  console.log("# 00x.000 # starter.run # registering window.pushTokenReceived *");
  window.pushTokenReceived = function( token ) {
    console.log("<<<<<<<<<<<<<< window.pushTokenReceived >>>>>>>>>>>>>");
    $rootScope.$apply(() => {
      console.log("<<<<<<<<<<<<<< $rootScope.$broadcast( 'pollotes', token ) >>>>>>>>>>>>>");
      $rootScope.$broadcast( 'pollotes', token );
    });  
  }

  console.log("# 00x.000 # starter.run # registering window._trigger_gotPremium *");
  window._trigger_gotPremium = function( result ) {
    console.log("<<<<<<<<<<<<<< window._trigger_gotPremium >>>>>>>>>>>>>");
    $rootScope.$apply(() => {
      console.log("<<<<<<<<<<<<<< $rootScope.$broadcast( 'listener_gotPremium', result ) >>>>>>>>>>>>>");
      $rootScope.$broadcast( 'listener_gotPremium', result );
    });    
  }





  window.paused=false
  window._trigger_pause = function() {
    console.log("<<<<<<<<<<<<<< window._trigger_pause >>>>>>>>>>>>>");
    console.log("")
    console.log("###########")
    console.log("## PAUSE ##")
    console.log("###########")
    console.log("")
    ChatService.Destroy()
    window.paused=true
  }
  window._trigger_resume = function() {
    console.log("<<<<<<<<<<<<<< window._trigger_resume >>>>>>>>>>>>>");
    console.log("")
    console.log("############")
    console.log("## RESUME ##")
    console.log("############")
    console.log("")
    // En iOS elimina el badge de los mensajes push
    resetBadgeCount()
    ChatService.Init()
    window.paused=false
  }






  $rootScope.isOnLine=true
  window._trigger_offline = function() {
    console.log("<<<<<<<<<<<<<< window._trigger_offline >>>>>>>>>>>>>");
    console.log("")
    console.log("#############")
    console.log("## OFFLINE ##")
    console.log("#############")
    console.log("")
    $rootScope.isOnLine=false
  }
  window._trigger_online = function() {
    console.log("<<<<<<<<<<<<<< window._trigger_online >>>>>>>>>>>>>");
    console.log("")
    console.log("############")
    console.log("## ONLINE ##")
    console.log("############")
    console.log("")  
    $rootScope.isOnLine=true

    $rootScope.userInfo=AuthService.getUserInfo();  
    if ($rootScope.userInfo)
    {    
      var key="_pendProgress"+$rootScope.userInfo.id
      if (localStorage[key])
      {        
        backendService.recordProgress()
      }
    }
    if (varGlobal.cacheOn && !$rootScope.allCached)
      backendService.cacheAll(false); // Solo procesar si no están en caché
  }














  console.log("# 012 # LISTENERS END #")
















  // ------------------------------------------------------------------------------------------------------


  // Esto estaba en controllers.js
  $rootScope.goURL=function(url)
  {
    console.log("goURL: "+url)
    $location.path(url.substr(1))
  }

  // Esto estaba en controllers.js
  console.log("# 00x.001 # set ENV START #");

  // Si hay valor en _forceENV (Establecido en la pantalla oculta), se toma de ahi
  // Si no lo hay, se toma de window.env
  var env=window.localStorage.getItem("_forceENV")
  console.log("# 00x.001 # _forceENV: ["+env+"] #")
  if (!env || env=="null")
    varGlobal.env=window.env;
  else
    varGlobal.env=env;
  if (varGlobal.env=="PRO")
  {
    varGlobal.apiURL=varGlobal.apiPRO;
  }
  else
  {
    varGlobal.apiURL=varGlobal.apiDEV;
  }
  console.log( "# 00x.001 # set ENV # [" + varGlobal.env + "] #" );

  console.log( "# 00x.001 # set ENV END #" );

  if ( r34lp0w3r.platform == "browser" )
    $rootScope.showSocialLogin = false
  else
    $rootScope.showSocialLogin = true

  if ( r34lp0w3r.platform ==  "ios" )
    $rootScope.restoreBtn = true
  else
    $rootScope.restoreBtn = false

  $rootScope.autoSpeech = window.autoSpeech;

  $rootScope.notFirstTime = true;
  $rootScope.platform = r34lp0w3r.platform;

  var value = localStorage.getItem( "_personalAds" );
  $rootScope.personalAds = value;
  if ( !value ) // No Existe la clave
  {
    window.localStorage.setItem("_personalAds","on");
    $rootScope.personalAds=true;
  }
  else
    $rootScope.personalAds=( value =="on" );
    $rootScope.$on('$stateChangeSuccess', function() {
    // Esto se ejecuta cada vez que se cambia de 'ruta'
    $rootScope.srchOn=false;
  });

  ///// Status de los mp3 de las lecciones
  $rootScope.loadingStatus = {};
  $rootScope.loadingStatus["audios"] = {};
  ///
  [4,5,6,10,10000].map( function(curso) {
    var key = "_loadingStatus" + curso;
    var val = window.localStorage.getItem(key);
    if (val)
      var valor = val.split(",").map(function (c) { return parseInt(c) });
    else
      var valor = [0, 0, 0];
    $rootScope.loadingStatus["audios"][curso] = valor;
  });
  ///
  $rootScope.loadingFiles = {};
  $rootScope.loadingFiles[4] = [];
  $rootScope.loadingFiles[4] = [];
  $rootScope.loadingFiles[5] = [];
  $rootScope.loadingFiles[6] = [];
  $rootScope.loadingFiles[10] = [];
  $rootScope.loadingFiles[10000] = [];
  /////////////////////////////////////////

  // Para browser, que no entra en $ionicPlatform.ready();
  $rootScope.loc="en"; 
    
  $rootScope.i18n={ 
    es: {
      start:"Inicio", learn: "Aprender", practice:"Practicar", resources:"Practicar" , resources2:"Recursos", chats:"Chat", translate:"Traducir", say:"Decir", conjugate:"Conjugar", share:"Comparte la app con tus amigos", register:"Registrarse", recover:"Recuperar Contraseña", close:"Cerrar", loading:"Cargando",
      ci:"Curso Inglés", notlogged:"No estás logueado", login:"Acceder", loginwith:"Iniciar sesión con", start:"Empezar", legal:"Avisos legales", contact:"Contacto", contact_mail:"contact@curso-ingles.com", credits:"Créditos", chatnorms:"Normas del chat", help:"Ayuda", subs:"Recuperar subscripción", subs2:"Subscrito hasta", subs3:"Subscription", exit:"Salir", lang:"Lenguaje", es:"Español", en:"Inglés", br:"Portugués",
      sett_title:"Info Usuario", progress:"Avances",  activity:"Actividad",  record:"Logros", nodata:"No tienes datos registrados todavía.", courses:"Cursos",  username:"Usuario", password:"Contraseña", enter:"Entrar", logfb:"Inicia con Facebook",  loggp:"Inicia con Google +", logapple:"Inicia con Apple",  forgot:"¿Olvidaste tu contraseña?", noacc1:"¿No tienes cuenta?", noacc2: "Regístrate gratis", noacc3: "Registra tus avances ", noacc4: "Acceder", accept1: "Acepto las", accept2: "Condiciones de uso", accept3: "y la", accept4: "Política de Privacidad",
      prof_title:"Perfil", yourdata:"Tus datos", name:"Nombre", surnames:"Apellidos", birthdate:"Fecha de nacimiento", email:"Email", confirmmation:"Confirmación", sex:"Sexo", audioacc:"Acento audio", male:"Hombre", female:"Mujer", american:"EE.UU.", british:"Británico", update:"Actualizar", type0:"Introduce tu", repeat:"Repite tu", selectimg:"Selecciona la imágen", type1:"Introduce tus",
      lear_title:"Aprender", lesson:"Resumen", full_lesson:"Lección", samples:"Ejemplos", nores:"No hay recursos para esta lección.",
      prac_title:"Practicar", 
      gram_title:"Ejercicios gramática", gram_desc:"Encuentra ejercicios relacionados con las lecciones y unidades en cada curso.", of:"de", questions:"preguntas", correctans:"Respuesta correcta", yourgrade:"Tu nota es la siguiente", answers:"Tus respuestas", review:"Revisar lección", savetest:"Registrar nota", restart:"Repetir", dologin:"¿Quieres registrar tus avances?, haz login", solve:"Corregir", continue:"Siguiente", yourans:"Introduce tu respuesta", continue2:"Continuar", droptext: "Mueve aquí las palabras", gram_cd: "Ejercicios relacionados con las lecciones de este curso",
      song_title:"Canciones en inglés", song_desc:"Mejora tu comprensión auditiva con estas canciones y sus letras en inglés.", songsearch:"Buscar por artista o lección", artist:"Artista",
      game_title:"Juegos", game_desc:"Juegos para practicar inglés.",
      options:"Opciones", send:"Enviar", type:"Introduce el texto", 
      tran_title:"Traductor", translate:"Traducir", history:"Historial de búsquedas", clean:"Limpiar",
      pron_title:"Pronunciar", text:"Texto", pron_input:"Introduce aquí el texto en inglés", pronhistory:"Historial de pronunciación",
      conj_title:"Conjugador", verbconj:"Buscar el verbo a conjugar", conjugate:"Conjugar", verb:"Verbo en inglés", tense:"Tiempo verbal", results:"Results", notfound:"Lo sentimos pero no sabemos conjugar este verbo todavía. Lo miramos!",
      reso_title:"Recursos", syntax:"Sintaxis",
      voca_title:"Vocabulario", expr_title:"Expresiones", prov_title:"Refranes", quot_title:"Citas", regv_title:"Verbos regulares", irrv_title:"Verbos irregulares", phrv_title:"Phrasal verbs", chea_title:"Chuletas", fore_title:"En el extranjero",
      voca_sub:"Listas de vocabulario por tema.", expr_sub:"Expresiones más comunes del inglés.", prov_sub:"Algunos de los refranes más populares.", quot_sub:"Algunas de las citas más conocidas del inglés.", regv_sub:"Encuentra la conjugación de más de 200 verbos.", irrv_sub:"Encuentra los verbos irregulares", phrv_sub:"Información sobre los phrasal verbs más importantes.", conj_sub:"Conjuga verbos en inglés con esta herramienta.", chea_sub:"Listas y tablas para una referencia fácil de la gramática.", fore_sub:"Vocabulario útil para viajar",
      walk01:"Aquí tienes el menú principal", walk02:"Aquí encontrarás  las salas de chats", walk03:"Aquí puedes encontrar los usuarios que están en línea",
      err01:"Lo sentimos, algo no fue bien. Comprueba tu conexión con Internet.", err02: "¡Vaya!", err03: "Parece que algo no va bien", err04: "con la conexión a Internet.", err05: "Para ver este contenido", err06:"debes tener", err07:"conexión a Internet.", err08:"Usar app sin conexión",
      gopremium:"Quitar anuncios", usrpremium:"Usuario Premium", gopremium2: "Ver contenido premium", seevideo: "Desbloquear lección temporalmente", buy:"¡Oferta lanzamiento", buy2: "sólo" ,
      search:"Buscar", exercise:"Ejercicio",
      persAds:"Anuncios Personalizados",personalAds:"Ver anuncios personalizados",sendFeedback:"Enviar comentarios",
      down_title:"Descargas",downloads:"Descargas"
    }, 
    en: {
      start:"Start", learn: "Learn", practice:"Practice", resources:"Practice", resources2:"Resources", chats:"Chat", translate:"Translate", say:"Say", conjugate:"Conjugate", share:"Share the app with your friends", register:"Register", recover:"Recover Password", close:"Close", loading:"Loading",
      ci:"English Course", notlogged:"Not logged in",     login:"Log in", loginwith:"Log in with", start:"Start",  legal:"Legal notice", contact:"Contact", contact_mail:"contact@curso-ingles.com",   credits:"Credits", chatnorms:"Chat Norms", help:"Help",  subs:"Restore subscription", subs2:"Subscribed until", subs3:"Subscription", exit:"Log out",  lang:"Language",  es:"Spanish", en:"English", br:"Portuguese",
      sett_title:"User Info",    progress:"Progress", activity:"Activity", record:"Record", nodata:"No recorded progress yet."           , courses:"Courses", username:"User",    password:"Password",   enter:"Enter",  logfb:"Log in with Facebook", loggp:"Log in with Google +", logapple:"Sign in with Apple", forgot:"Forgot your password?", noacc1:"No account yet?", noacc2:"Sign up for free", noacc3:"Register your progress", noacc4:"Log in", accept1: "I agree to the", accept2: "Terms & Conditions", accept3: "and", accept4: "Privacy Policy",
      prof_title:"Profile", yourdata:"Your data", name:"Name", surnames:"Surnames", birthdate:"Date of birth", email:"Email", confirmmation:"Confirmation", sex:"Sex", audioacc:"Audio accent", male:"Male", female:"Female", american:"American", british:"British", update:"Update", type0:"Type your", repeat:"Repeat your", selectimg:"Choose image", type1:"Type your",
      lear_title:"Learn", lesson:"Summary", full_lesson:"Lesson", samples:"Examples", nores:"No resources for this lesson.",
      prac_title:"Practice", 
      gram_title:"Grammar exercises", gram_desc:"Find exercises related to the lessons and units in each course.", of:"of", questions:"questions", correctans:"Correct answer", yourgrade:"This is your grade", answers:"Answers", review:"Review lesson", savetest:"Save result", restart:"Start over", dologin:"Want to save your result? Log in", solve:"Solve", continue:"Next", continue2:"Continue", yourans:"Type your answer", droptext: "Drop words here", gram_cd: "Exercises related to the lessons in this course",
      song_title:"Songs", song_desc:"Improve your listening skills by watching music videos with the lyrics in English.", songsearch:"Search by artist or lesson", artist:"Artist",
      game_title:"Games", game_desc: "Games for practicing English.",
      options:"Options", send:"Send", type:"Type text",
      tran_title:"Translator", translate:"Translate", history:"Search history", clean:"Clean",
      pron_title:"Pronounce", text:"Text", pron_input:"Type text here", pronhistory:"Pronunciation history",
      conj_title:"Conjugation tool", verbconj:"Find the verb to conjugate", conjugate:"Conjugate", verb:"English verb", tense:"Verb tense", results:"Results", notfound:"Sorry, but we do not know how to conjugate this verb just yet. We will look into it.",
      reso_title:"Resources", syntax:"Syntax",
      voca_title:"Vocabulary", expr_title:"Expressions", prov_title:"Proverbs", quot_title:"Quotes", regv_title:"Regular verbs", irrv_title:"Irregular verbs", phrv_title:"Phrasal verbs", chea_title:"Cheat sheets", fore_title:"Traveling",
      voca_sub:"Lists of vocabulary by theme.", expr_sub:"Popular sayings used to express common sense ideas.", prov_sub:"Proverbs are popular sayings used to express common sense ideas.", quot_sub:"Included here are some popular quotes in English.", regv_sub:"Find the conjugation of over 200 regular verbs.", irrv_sub:"Conjugation of over 100 common irregular verbs.", phrv_sub:"Information about important phrasal verbs.", conj_sub:"Conjugate verbs in English with this tool.", chea_sub:"Lists and tables for easy grammar reference.", fore_sub:"Useful vocabulary for travel",
      walk01:"Here you have the main menu", walk02:"Here you will find the chat room", walk03:"Here you can find the users who are online",
      err01:"Sorry, something wasn't right. Please check your internet connection.", err02: "Ups!", err03: "It seems that something is wrong", err04: "with the Internet connection.", err05: "To see this information", err06:"you must be", err07:"connected to Internet.", err08:"Use app offline",
      gopremium:"Remove ads", usrpremium:"Premium User", gopremium2: "See Premium content", seevideo: "Temporally unlock lesson", buy:"Special launch offer", buy2: "just" ,
      search:"Search", exercise:"Exercise",
      persAds:"Personalized ads",personalAds:"See personalized ads",sendFeedback:"Send feedback",
      down_title:"Downloads",downloads:"Downloads"
    },
    br: {
      start:"Início", learn: "Aprender", practice:"Praticar", resources:"Praticar", resources2:"Recursos", chats:"Bate-papo", translate:"Traduzir", say:"Dizer", conjugate:"Conjugar", share:"Compartilhe o aplicativo com seus amigos", register:"Registrar-se", recover:"Recuperar Contrasenha", close:"Fechar", loading:"Carregando",        
      ci:"Curso de Inglês", notlogged:"Não conectado",     login:"Login", loginwith:"Login com", start:"Início",  legal:"Aviso legal", contact:"Contato", contact_mail:"contact@curso-ingles.com",   credits:"Créditos", chatnorms:"Regras do bate-papo", help:"Ajuda",  subs:"Restaurar assinatura", subs2:"Assinante até", subs3:"subscrição", exit:"Sair",  lang:"Idioma",  es:"Espanhol", en:"Inglês", br: "Português",
      sett_title:"Informações do usuário",    progress:"Progresso", activity:"Atividade", record:"Registro", nodata:"Nenhum progreso registrado até agora.", courses:"Cursos", username:"Usuário",    password:"Senha",   enter:"Entrar",  logfb:"Fazer login com o Facebook", loggp:"Fazer login com o Google +", logapple:"Fazer login com o Apple", forgot:"Esqueceu sua senha?", noacc1:"Ainda não tem uma conta?", noacc2:"Registre-se grátis", noacc3:"Registre o seu progresso", noacc4:"Fazer login", accept1:"Aceito os", accept2:"Termos e Condições", accept3:"e", accept4:"Política de privacidade",
      prof_title:"Perfil", yourdata:"Seus dados", name:"Nome", surnames:"Sobrenome", birthdate:"Data de nascimento", email:"E-mail", confirmmation:"Confirmação", sex:"Sexo", audioacc:"Áudio de pronúncia", male:"Homem", female:"Mulher", american:"Americano", british:"Britânico", update:"Atualizar", type0:"Digite sua", repeat:"Repita sua", selectimg:"Escolha a imagem", type1:"Digite os seus",
      lear_title:"Aprender", lesson:"Resumo", full_lesson:"Liçao", samples:"Exemples", nores:"Nenhum recurso para esta lição.",
      prac_title:"Praticar",
      gram_title:"Exercícios de gramática", gram_desc:"Procuar exercícios relacionados com as lições e unidades de cada curso.", of:"de", questions:"perguntas", correctans:"Resposta correta", yourgrade:"Essa é a sua nota", answers:"Respostas", review:"Lição de revisão", savetest:"Salvar resultado", restart:"Repita", dologin:"Deseja salvar o seu resultado?Fazer login", solve:"Resolver", continue:"Próximo", continue2:"Continuar", yourans:"Digite sua resposta", droptext: "Move aqui as palavras", gram_cd: "Exercícios relacionados ao conteúdo do curso",
      song_title:"Músicas", song_desc:"Melhore sua habilidades auditivas assistindo a vídeos musicais com as letras em inglês.", songsearch:"Pesquise por artista ou lição", artist:"Artista",
      game_title:"Jogos", game_desc:"Jogos para praticar o inglês.",
      options:"Opções", send:"Enviar", type:"Digite o texto",
      tran_title:"Tradutor", translate:"Traduzir", history:"Pesquisar histórico", clean:"Limpar",
      pron_title:"Pronunciar", text:"Texto", pron_input:"Digite seu texto aqui", pronhistory:"Histórico de pronúncia",
      conj_title:"Ferramenta de conjugação", verbconj:"Procure o verbo a conjugar", conjugate:"Conjugar", verb:"Verbo em inglês", tense:"Tempo verbal", results:"Resultados", notfound:"Sentimos muito, mas ainda não sabemos como conjugar este verbo. Vamos verificá-lo.",
      reso_title:"Recursos", syntax:"Sintaxe",voca_title:"Vocabulário", expr_title:"Expressões", prov_title:"Provérbios", quot_title:"Citações", regv_title:"Verbos regulares", irrv_title:"Verbos irregulares", phrv_title:"Verbos frasais", chea_title:"Folha de consulta", fore_title:"Viagens",
      voca_sub:"Listas de vocabulário por tema.", expr_sub:"Provérbios populares usados para expressar senso comum.", prov_sub:"Os provérbios são ditos populares usados para expressar senso comum.", quot_sub:"Aqui estão reunidas alguma citações populares em inglês.", regv_sub:"Procure a conjugação de mais de 200 verbos regulares.", irrv_sub:"Conjugação de mais de 100 verbos irregulares comuns.", phrv_sub:"Informações sobre verbos frasais importantes.", conj_sub:"Conjugue verbos em inglês com esta ferramenta.", chea_sub:"Listas e tabelas para uma referência fácil da gramática..", fore_sub:"Vocabulário útil para viajar",
      walk01:"Aqui está o menu principal", walk02:"Aqui, você encontrará a sala de bate-papo", walk03:"Aqui, você pode encontrar os usuários que estão on-line",
      err01:"Sentimos muito, algo deu errado.Verifique sua conexão de Internet.", err02:"Opa!", err03:"Parece que há algo errado", err04:"com a conexão de internet.", err05: "Para visualizar este conteúdo,", err06:"você deve ter uma conexão", err07:"com a Internet.", err08:"Usar app offline",
      gopremium:"Eliminar publicidade", usrpremium:"Usuário Premium", gopremium2:"Ver conteúdo Premium", seevideo: "Destrava temporariamente a lição", buy:"Oferta de lançamento", buy2: "somente",
      search:"Procure", exercise:"exercício",
      persAds:"Anúncios personalizados",personalAds:"Veja anúncios personalizados",sendFeedback:"Enviar comentários",
      down_title:"Descargas",downloads:"Descargas"
    }
  };  

  // Todo esto estaba dentro de $ionicPlatform.ready()

  var platform = r34lp0w3r.platform;
  if (platform=="ios")
    platform="IOS";
  else
    if (platform=="android")
      platform="AND";
    else
      if (platform=="browser")
        platform="BRW";
      else
        platform="???";
  varGlobal.platform=platform;

  if (localStorage.getItem("debugMode")) varGlobal.debugMode=true;
  if (localStorage.getItem("debugModePurch")) varGlobal.debugModePurch=true;
  if (localStorage.getItem("checkUpdates")) varGlobal.checkUpdates=true; else varGlobal.checkUpdates=false;

  $rootScope.deviceId=genService.deviceId();
  $rootScope.endpoints={
    'courseslist':'/v3/courses.json',
    'course4':'/v3/courses/4/lessons',
    'course5':'/v3/courses/5/lessons',
    'course6':'/v3/courses/6/lessons',
    'testslist':'/v3/practicetests',
    'tests4':'/v3/practice_tests_course/4',
    'tests5':'/v3/practice_tests_course/5',
    'tests6':'/v3/practice_tests_course/6',
    'tests10':'/v3/practice_tests_course/10',
    'tests10000':'/v3/practice_tests_course/10000',
    'vocabularies':'/v3/vocabs',
    'expressions':'/v3/expressions',
    'proverbs':'/v3/proverbs',
    'quotes':'/v3/quotes',
    'regverbs':'/v3/regverbs',
    'irregverbs':'/v3/irregverbs',
    'phrasverbs':'/v3/phrasalverbs',
    'conjugations':'/v4/conjugations',
    'course10':'/v3/courses/10/lessons',   
    'course10002':'/v3/courses/10002/lessons',    
    'course10000':'/v3/courses/10000/lessons'  
  };   

  var ks=Object.keys($rootScope.endpoints);
  for (var currentKey=0;currentKey<ks.length;currentKey++)
  {
    key="__"+ks[currentKey];
    if ( key.substring(0,8)=="__course" && key.substring(0,9)!="__courses" && key in window.localStorage)
    {
      var data=JSON.parse(genService.getItem(key)); 
      var course_id=parseInt(key.substring(8,100));
      UnitsService.setUnits(course_id,data.lessons);
    }
  }

  $rootScope.loadingItem={};
  var ks=Object.keys($rootScope.endpoints);
  for (var x=0;x<ks.length;x++){
    key=ks[x]; 
    $rootScope.loadingItem["__"+key]=0;
  } 
  $rootScope.loadingContent=false; //Indica si está en el bucle de genService.loadAll().
  $rootScope.allCached=genService.allCached(); // Indica si todas las secciones están cacheadas.   

  let admobid;
  if ( window.testAds ) // Se establece en index.js
    admobid = { banner:'ca-app-pub-3940256099942544/6300978111', interstitial:'ca-app-pub-3940256099942544/1033173712', rewarded:'ca-app-pub-3940256099942544/5224354917' }
  else
    if( r34lp0w3r.platform === "android" ) 
      admobid = { banner:'ca-app-pub-7994364056975402/2301384119', interstitial:'ca-app-pub-7994364056975402/4260842519', rewarded:'ca-app-pub-7994364056975402/1092865027' }
    else if( r34lp0w3r.platform === "ios" )
      admobid = { banner:'ca-app-pub-7994364056975402/9924846977', interstitial:'ca-app-pub-7994364056975402/1167775318', rewarded:'ca-app-pub-7994364056975402/6919906777' }
    else // Si no es 'android' ni 'ios' (Supuestamente imposible), se ponen los de test.
      admobid = { banner:'ca-app-pub-3940256099942544/6300978111', interstitial:'ca-app-pub-3940256099942544/1033173712', rewarded:'ca-app-pub-3940256099942544/5224354917' }
  window.admobid = admobid;

  adsService.init(); // Tomará la configuración de localStorage si los hay, si no dejará la configuración por defecto.

  start_step_async( step_locale,   { orden: "010.001", nombre: "LOCALE............." }, $rootScope );
  start_step_async( step_AdMob,    { orden: "010.002", nombre: "ADMOB.............." }, $rootScope );
  start_step_async( step_purchase, { orden: "010.003", nombre: "PURCHASE..........." }, $rootScope );

  $ionicPlatform.ready(function() {
    ionicPlatformReady(backendService,$rootScope,$timeout,varGlobal,genService,ChatService,AuthService,$ionicLoading);
  });
 
})
/// <<< .run



.factory('CoursesService', function (varGlobal) {
  return {

    setCoursesAndScores: function (courses,scores) { 
      var c={}
      for (i=0; i<courses.length;i++){
        c[courses[i].id]=courses[i];
        c[courses[i].id].imageURL="assets/course"+courses[i].id+".png"
      }
      varGlobal.courses=c;
      varGlobal.scores=scores;
      // grabar en localStorage
      window.localStorage.setItem("_courses",JSON.stringify(c));
      window.localStorage.setItem("_scores",JSON.stringify(scores));
    },

    getCourses: function() {
      return varGlobal.courses;
    },

    GetCourseById: function (id) {
      console.log("* GetCourseById *");
      console.log(id);
      console.log(varGlobal.courses);          
      return varGlobal.courses[id];
    }
  }
})

.factory('GrammarService', function () {
  return {
    Grammar: [],

    setGrammar: function (grammar) {
      this.Grammar=grammar;
    },

    getGrammar: function() {
      return this.Grammar;
    }
  }
})

.factory('UnitsService', function ($http,varGlobal) {
  return {
    UnitsList: {},

    setUnits: function (course_id,units) {     
      this.UnitsList[course_id]=units;
    },

    getUnits: function (course_id) {
      return this.UnitsList[course_id];
    },

    GetUnitById: function (unit_id) {
      for (var course_id in this.UnitsList) {      
        var n=this.UnitsList[course_id].length;
        for(i=0;i<n;i++) 
        {
          if (this.UnitsList[course_id][i].id == unit_id)
          {
            this.UnitsList[course_id][i].order=i;                  
            return this.UnitsList[course_id][i];
          }            
        }            
      }

    }

  }
})



// Cargar las voces de speechSynthesis
// Si no se hace, la primera vez que se usa no funciona
// Está versión las carga todas
function cargarVoices() {
  const voices = window.speechSynthesis.getVoices();
  r34lp0w3r.voices_US = [];
  r34lp0w3r.voices_GB = [];

  for (let i = 0; i < voices.length; i++) {
    const name = voices[i].name;
    const lang = voices[i].lang;
    const def = voices[i].default ? " (Default)" : "";

    if (lang === "en-US")
      r34lp0w3r.voices_US.push([i, name]);
    if (lang === "en-GB")
      r34lp0w3r.voices_GB.push([i, name]);
  }

  console.log(JSON.stringify({ voices_US: r34lp0w3r.voices_US }));
  console.log(JSON.stringify({ voices_GB: r34lp0w3r.voices_GB }));
}





// Se crea el objeto app.
// Se activa cuando se llama a app.initialize()
console.log("# 00e # creación del objeto app #")
var app = {

  // Application Constructor
  initialize: function() {
    console.log("# 000 # js/index.js: app.initialize()");
    this.bindEvents();
  },

  // Bind Event Listeners
  //
  // Bind any events that are required on startup. Common events are:
  // 'load', 'deviceready', 'offline', and 'online'.
  bindEvents: function() {      //Evento que se genera al finalizar la carga de Cordova
    console.log("# 001 # js/index.js: app.bindEvents() #");
    document.addEventListener('deviceready', this.onDeviceReady, false);  
  },

  onDeviceReady: function() 
  {
    // onDeviceReady lo llama cordova, que a su vez se carga en <script src="cordova/cordova_r34lp0w3r.js">
    // Lo llama después de cargar los plugins que haya en cordova_plugins_{browser|webview} según si está definido Capacitor o no
    // Si está dentro de Capacitor (iOS / Android), y por tanto se está ejecutando en un WebView (No Browser a pelo)
    // Tiene que sustituir el uso de algunos plugins de cordova por sus equivalentes de Capacitor

    console.log("# 002 # app.onDeviceReady() #");
    // El objeto que inyecta Capacitor (si se usa, en browser a pelo no estará)
    console.log("# 002 # app.onDeviceReady(): window.Capacitor:",typeof window.Capacitor); 
    // El objeto que inyecta Android al inicializarse. (Si es Capacitor+Android), si no -> WebView, lo creamos.
    console.log("# 002 # app.onDeviceReady(): window.r34lp0w3r:",typeof window.r34lp0w3r);    
    if (typeof window.r34lp0w3r === 'undefined') {
      window.r34lp0w3r = {};
    }
    r34lp0w3r.platform = window.Capacitor ? window.Capacitor.getPlatform() : "browser";

    if (r34lp0w3r.platform == 'browser')
    {
      console.log(">###> browser: inicializando window.speechSynthesis.getVoices()." )  
      // 1. Intentamos cargar directamente (por si ya están disponibles)
      cargarVoices();
      // 2. Pero también escuchamos el evento (por si aún no estaban listas)
      window.speechSynthesis.onvoiceschanged = cargarVoices;
    }

    console.log("# 003 # uuid START #");
    var uuid=window.localStorage.getItem("uuid");
    if (!uuid)
    {
      console.log("# 003 # Se crea el UUID #");
      var pId = r34lp0w3r.platform;
      if ( pId == "browser" )
        var pfx = "BRW";
      else
        if ( pId == "android" )
          var pfx = "PGA";
        else
          var pfx = "PGI";
      var uuid = pfx + '-xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) { var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8); return v.toString(16); } );
      window.localStorage.setItem( "uuid", uuid );
    } 
    else      
      console.log( "# 003 # se toma el UUID guardado #" );
    console.log( "# 003 # uuid=" + uuid );
    window.uuid = uuid;
    console.log( "# 003 # uuid END #" );

    if ( factoryClean )
    {
      if ( !window.localStorage.getItem( "_factory_" ) )
      {
        alert( "Se va a proceder a inicializar el almacenamiento de la app." );
        // Conservar sólo el uuid
        var uuid = window.localStorage.getItem( "uuid" );
        var clear_done = function() 
        {
          // Se conserva el uuid
          window.localStorage.setItem( "uuid",uuid );
          window.localStorage.setItem( "_factory_","true" );
          alert( "Almacenamiento inicializado correctamente." + "\n\n" + "Código de control:" + "\n" + uuid + "\n\n" + "Por favor, envie una captura de esta pantalla a" + "\n" + "contact@curso-ingles.com" );
          onDeviceReady2();
        }
        if ( r34lp0w3r.platform == "browser" )
        {
          window.localStorage.clear();  
          clear_done();
        }
        else
        {    
          var clear_success = function( status )
          {
            clear_done();            
          }
          var clear_error = function( status ) {
              alert( 'Error inicializando el almacenamiento: ' + status );
              clear_done();
          }
          if ( typeof window.clearData != "undefined" )
            window.ClearData.clear( clear_success, clear_error );
          else
          {
            console.log( "--- NO clear data plugin ---" );
            window.localStorage.clear();
            clear_done();
          }
        }
      }
      else
      {
        onDeviceReady2();
      }
    }
    else
    {
      onDeviceReady2();
    }

  },
    
  // Update DOM on a Received Event
  receivedEvent: function(id) { 
    // En id recive el id del elemento que contiene el texto que se ha de convertir de 'connecting' a 'connected'

    console.log("# 004 # app.receivedEvent()");

    var parentElement = document.getElementById(id);
    var listeningElement = parentElement.querySelector('.listening');
    var receivedElement = parentElement.querySelector('.received');

    listeningElement.setAttribute('style', 'display:none;');
    receivedElement.setAttribute('style', 'display:block;');

    console.log('# 004 # Received Event: ' + id);
  }

};


console.log("# 00f # Fin de index.js #")

console.log("001.001 >###> js/index.js <<<")
