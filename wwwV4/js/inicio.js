console.log("001.002 js/inicio.js >>>")

console.log("# 01a # Inicio de inicio.js #")



console.log("# 01b # Definición de onDeviceReady2 #")

window.onDeviceReady2=function() 
{
  console.log("# 00x # onDeviceReady2 #");

  if( r34lp0w3r.platform == 'ios' )
  {
    window.adsOn = false;
  }
  else
  {
    window.adsOn = true;
  }

  // Si existe, si está en "ON", pone a true, en otro caso ("OFF") a false.
  // Si no existe la dejará con el valor por defecto que se establece arriba del todo.
  if (!window.autoSpeech)
    if (localStorage.getItem("_autoSpeech") == "ON")
      window.autoSpeech = true;
    else
      window.autoSpeech = false;

  console.log("# 09b # angular.bootstrap() #");

  angular.bootstrap( document.body, ['starter'] );

}



console.log("# 01c # Definición de los inicializadores #")

logStr=function(def,str) { return "# "+def.orden+" # "+def.nombre+" # "+str+" #"; }
showPlugin=function(def,str) { console.log(logStr(def,str)); }
start_step=function(cual,def,$rootScope,varGlobal,AuthService,genService,$ionicLoading,$http,adsService,$ionicPopup,$timeout)
{
  showPlugin(def,"START")
  try 
  {
    res=cual(def,$rootScope,varGlobal,AuthService,genService,$ionicLoading,$http,adsService,$ionicPopup,$timeout);
    showPlugin(def, res[1])
  }
  catch(error)
  {
    // Si peta    
    el=error.stack.split("\n");
    showPlugin(def,"ERROR # "+el[0]);
    showPlugin(def,"ERROR # "+el[1].trim());
  }  
  showPlugin(def,"END")
}


start_step_async = async function( cual, def, $rootScope, varGlobal, AuthService, genService, $ionicLoading, $http, adsService, $ionicPopup, $timeout )
{
  showPlugin( def, "START" );
  try 
  {
    res = await cual( def, $rootScope, varGlobal, AuthService, genService, $ionicLoading, $http, adsService, $ionicPopup, $timeout );
    showPlugin( def, res[ 1 ] );
  }
  catch( error )
  {
    el = error.stack.split( "\n" );
    showPlugin( def,"ERROR # "+ el[ 0 ] );
    showPlugin( def,"ERROR # "+ el[ 1 ].trim() );
  }
}





step_locale = async function( def, $rootScope, varGlobal, AuthService, genService, $ionicLoading, $http, adsService, $ionicPopup, $timeout )
{
  if (!window.r34lp0w3r)
    window.r34lp0w3r = {};
  window.r34lp0w3r.locale = "en";
  $rootScope.loc = "en";
  // Asignar lo que haya en la variable de localStorage, si la variable no existe, consultar el setting del dispositivo y crearla
  var locale = window.localStorage.getItem( "locale" );
  if ( locale )
  {
    window.r34lp0w3r.locale = locale;
    $rootScope.loc = locale;
    showPlugin( def, "Tomado $rootScope.loc de 'locale' en localStorage." );
  }
  else
  {
    showPlugin( def, "No existe 'locale' en localStorage." );
    const langCode = ( navigator.language || navigator.userLanguage || 'en' ).split( '-' )[0];
    showPlugin( def, "langCode: " + langCode );
    window.r34lp0w3r.locale = langCode;
    $rootScope.loc = langCode;
    window.localStorage.setItem( "locale", langCode );
    showPlugin( def, "Creado 'locale' en localStorage." );
  }  
  showPlugin( def, "$rootScope.loc: " + $rootScope.loc );
  return [ true, "OK" ];
}

step_AdMob = async function( def, $rootScope, varGlobal, AuthService, genService, $ionicLoading, $http, adsService, $ionicPopup, $timeout )
{

  if ( !AdMob )
  {    
    showPlugin( def,"No existe AdMob." );
    return [ false, "NO" ];
  }

  await AdMob.initialize({
    requestTrackingAuthorization: true,
    testingDevices: [],
    initializeForTesting: window.testAds
  });

  // Banners --------------------------------------------------------------------------------
  // Callbacks
  $rootScope.BannerReady = false;
  AdMob.addListener( 'bannerAdFailedToLoad', ( info ) => { // Antes 'admob.banner.events.LOAD_FAIL'  
    console.log( '* AdMob: bannerAdFailedToLoad:', JSON.stringify( info ) );
    $rootScope.$$phase ? $rootScope.BannerReady = false : $rootScope.$apply(() => { $rootScope.BannerReady = false });        
  });
  AdMob.addListener( 'bannerAdLoaded', ( info ) => { // Antes 'admob.banner.events.LOAD'
    console.log( '* AdMob: bannerAdLoaded:', JSON.stringify( info ) );
    $rootScope.$$phase ? $rootScope.BannerReady = true : $rootScope.$apply(() => { $rootScope.BannerReady = true });
  });
  // ----------------------------------------------------------------------------------------

  // Interstitials --------------------------------------------------------------------------
  const interstitialOptions = {
    adId: window.admobid.interstitial,
    isTesting: false,
    // npa = "1" => Non-personalized ads
    // Only pass this if personalAds is false
    // npa is set via "additionalParameters"
    additionalParameters: $rootScope.personalAds ? {} : { npa: '1' }
  };
  await AdMob.prepareInterstitial(interstitialOptions);
  // Callbacks
  $rootScope.InterstitialReady = false;
  AdMob.addListener( 'interstitialAdFailedToLoad', ( info ) => { // Antes 'admob.interstitial.events.LOAD_FAIL'
    console.log( '* AdMob: interstitialAdFailedToLoad:', JSON.stringify( info ) );
    $rootScope.$$phase ? $rootScope.InterstitialReady = false : $rootScope.$apply(() => { $rootScope.InterstitialReady = false });        
  });    
  AdMob.addListener( 'interstitialAdLoaded', ( info ) => { // Antes 'admob.interstitial.events.LOAD'
    console.log( '* AdMob: interstitialAdLoaded:', JSON.stringify( info ) );
    $rootScope.$$phase ? $rootScope.InterstitialReady = true : $rootScope.$apply(() => { $rootScope.InterstitialReady = true });        
  });
  AdMob.addListener( 'interstitialAdDismissed', ( info ) => { // Antes 'admob.interstitial.events.CLOSE'
    console.log( '* AdMob: interstitialAdDismissed:', JSON.stringify( info ) );
    escondeStatusBar();
    $rootScope.$$phase ? $rootScope.InterstitialReady = false : $rootScope.$apply(() => { $rootScope.InterstitialReady = false });        
  });
  // ----------------------------------------------------------------------------------------

  // Rewarded videos ------------------------------------------------------------------------
  // Desactivados, Se configuraban con lo de adExtras {npa: 1} o sin segun $rootScope.personalAds
  // Habia un $rootScope.RewardedReady actualizado con los eventos de failedload y loaded correspondientes
  // En el close, se llamaba a AdMov.rewardvideo.prepare()
  // Y en el reward se ponia rewardedready a false, $rootScope.reward a true y también se llamaba a prepare()
  // ----------------------------------------------------------------------------------------

  return [ true, "OK" ];

}

step_purchase = async function( def, $rootScope )
{

  window.appInfo = null;

  var app = window.Capacitor && window.Capacitor.App || window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;

  if ( !app || !app.getInfo ) {
    return [false, "NO window.Capacitor.Plugins.App.getInfo()"];
  }

  let info;
  try {
    info = await app.getInfo();
  } catch (e) {
    console.warn( "Error al obtener el App ID:", e );
    return [ false, "ERROR GETINFO" ];
  }
  
  window.appInfo = info;

  showPlugin( def,"Bundle id: " + info.id );

  window.subsStoreID={};
  window.subsDefaultID={}
  window.subsStorePrice={};

  if ( info.id == "com.sokinternet.testing" )
  {
    var default_and = "premium_forever";
    var default_ios = "com.sokinternet.testing.forever";
  }
  else
  {
    var default_and = "premium_forever";
    var default_ios = "com.sokinternet.cursoingles.subsyear"; //"com.sokinternet.cursoingles.forever";
  }

  // Para usar si el id que devuelve el backend no tiene precio de la Store (y el default si)
  window.subsDefaultID[ "android" ] = default_and;
  window.subsDefaultID[ "ios"     ] = default_ios;

  window.subsStoreID[ "android" ] = default_and;
  window.subsStoreID[ "ios"     ] = default_ios;

  window.subsStorePrice[ default_and ] = "30 €"
  window.subsStorePrice[ default_ios ] = "30 €"

  return [ true, "OK" ]

}





console.log("# 01d # Definición de ionicPlatformReady #")

ionicPlatformReady=function(backendService,$rootScope,$timeout,varGlobal,genService,ChatService,AuthService,$ionicLoading)
{
  console.log( "# 010 # ionicPlatform.ready() #" )

  console.log( "# 010 # ionicPlatform.ready() # Se define globalTick *" );

  $rootScope.globalTick = 0;

  globalTick=function() {

    console.log("- globalTick (" + $rootScope.globalTick + ") -");

    if (!$rootScope.loadingContent) $ionicLoading.hide();
      
    var luc = window.localStorage.getItem("_lastUpdateCheck");
    if ( !luc ) var sigue = true; // No se habia hecho ninguno.
    else
    {
      luc = parseInt(luc);
      now =( new Date() ).getTime();
      var dif = now - luc;
      if ( dif > 86400000 )
        var sigue = true;
      else
      {
        var sigue = false;
        console.log( "* Aun no ha pasado un dia del ultimo checkUpdate [ " + ( new Date( luc ) ).toString() + " ] *" );
      }
    }

    if ( sigue && varGlobal.cacheOn && $rootScope.isOnLine && !$rootScope.loadingContent )
    {

      genService.dbgAlert("- getUpdates -")

      //////////////////////////////////////////////////////////
      console.log("* antes de getUpdates *");

      // Toma la fecha mas alta de todos los cachés que haya
      var updated = 0;
      var ks = Object.keys( $rootScope.endpoints);
      for ( var currentKey=0; currentKey < ks.length;currentKey++ );
      {
        key = ks[currentKey];
        cacheId = "__" + key;
        if ( genService.checkItem( cacheId ) )
        {
          var trk = genService.getTrk( cacheId );
          var u = trk.updated;
          if ( u > updated ) updated = u;
        }
      }      
      console.log( "* updated *", new Date( updated ) );

      $ionicLoading.show();
      $rootScope.userInfo = AuthService.getUserInfo();

      backendService.doGet( "/v4/getUpdates/" + Math.round( updated / 1000 ), $rootScope.userInfo,function( result ) {

        console.log("* dentro de getUpdates *");
        console.log('* getUpdates returned value *', JSON.stringify( result ) );

        var now = new Date();
        window.localStorage.setItem( "_lastUpdateCheck", now.getTime().toString() );

        backendService.tick( result.data.items );

        if ( !$rootScope.loadingContent ) $ionicLoading.hide();

      })

      console.log("* después de getUpdates *")
      //////////////////////////////////////////////////////////

      $rootScope.globalTick++;
      $timeout( globalTick, 60000 );
    }
    else
    {
      $rootScope.globalTick++;
      $timeout( globalTick, 30000 );
    }
  }
  
  console.log("* Se activa globalTick *")
  $timeout(globalTick, 30000)

}


console.log("# 01e # Fin de inicio.js #")

console.log("001.002 js/inicio.js <<<")
