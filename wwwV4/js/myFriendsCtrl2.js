angular.module('starter').controller('myFriendsCtrl2', function( $rootScope, $scope, $stateParams, Upload, chat, AuthService, ChatService, genService, adsService, backendService, CoursesService, varGlobal, $ionicPosition, $ionicLoading, $ionicModal, $ionicPopup, $ionicScrollDelegate, $http, $window, $cordovaFileTransfer, $cordovaFile, $timeout, $state, ) {

  $rootScope.viewTitle="Debug";
  
  $scope.appInfo = window.appInfo;
  
  $scope.purchase_id = localStorage.getItem( "_purchase_id" ) || "* no existe *";
  $scope.purchase_expires = localStorage.getItem( "_purchase_expires" ) || "* no existe *";
  $scope.purchase_expires_human = localStorage.getItem( "_purchase_expires_human" ) || "* no existe *";
  
  $scope.deviceId = genService.deviceId();

  $scope.IAPbuyProduct = window.IAPbuyProduct;
  $scope.IAPCheckOwned = window.IAPCheckOwned;

  $scope.laCompra = window.subsStoreID[ r34lp0w3r.platform ];
  $scope.losPrecios = window.subsStorePrice;

  if (window.r34lp0w3r)
    $scope.r34lp0w3r = window.r34lp0w3r
  else
    $scope.r34lp0w3r = "* No existe *";

  $scope.isWebView = (window.r34lp0w3r && window.r34lp0w3r.platform !== 'browser');

  $scope.setStatusBarBlue = function() {
    window.setStatusBarBlue();
  };

  $scope.setStatusBarTransparent = function() {
    window.setStatusBarTransparent();
  };

  $scope.setStatusBarLight = function() {
    window.setStatusBarLight();
  }

  $scope.setStatusBarDark = function() {
    window.setStatusBarDark();
  }

  $scope.setStatusBarOverlayOn = function() {
    window.setStatusBarOverlayOn();
  }

  $scope.setStatusBarOverlayOff = function() {
    window.setStatusBarOverlayOff();
  }

  $scope.setStatusBarShow = function() {
    window.setStatusBarShow();
  }
  $scope.setStatusBarHide = function() {
    window.setStatusBarHide();
  }


  $scope.statusOverlayState = false;
  $scope.tglStatusOverlay = function() {
    $scope.statusOverlayState = !$scope.statusOverlayState
  }

  $scope.statusOverlayStyle= false;
  $scope.tglStatusStyle = function() {
    $scope.statusStyle = !$scope.statusStyle
  }



$scope.ionicPopup_test = function() {
  var myPopup = $ionicPopup.show( { template: '', title: "Title", subTitle: "Subtitle", scope: $rootScope, buttons: [ { text: 'Ok' } ] } )  
}  



// Keyboard
// OJO, que no pete en browser, que no hay objeto Capacitor
if (
  window.Capacitor &&
  window.Capacitor.Plugins &&
  window.Capacitor.Plugins.Keyboard &&
  typeof window.Capacitor.Plugins.Keyboard.addListener === 'function'
) {
  window.Capacitor.Plugins.Keyboard.addListener('keyboardDidShow', info => {

    console.log('>###> window.Capacitor.Plugins.Keyboard.keyboardDidShow: info del teclado:', JSON.stringify(info));
    console.log('>###> window.Capacitor.Plugins.Keyboard.keyboardDidShow: Altura del teclado:', info.keyboardHeight);
    // document.body.classList.add('keyboard-visible');
  
  });
}

if (
  window.Capacitor &&
  window.Capacitor.Plugins &&
  window.Capacitor.Plugins.Keyboard &&
  typeof window.Capacitor.Plugins.Keyboard.addListener === 'function'
) {
  window.Capacitor.Plugins.Keyboard.addListener('keyboardDidHide', () => {

    console.log('>###> window.Capacitor.Plugins.Keyboard.keyboardDidHide.');
    // document.body.classList.remove('keyboard-visible');

  });
}



$scope.setResizeModeNative = function () {
  console.log(">###> window.Capacitor.Plugins.Keyboard.setResizeMode({ mode: 'native' }).");
  window.Capacitor.Plugins.Keyboard.setResizeMode({ mode: 'native' });
};
$scope.keyboardHide = function () {
  console.log('>###> window.Capacitor.Plugins.Keyboard.hide().');
  window.Capacitor.Plugins.Keyboard.hide();
};
$scope.keyboardShow = function () {
  console.log('>###> window.Capacitor.Plugins.Keyboard.show().');  
  window.Capacitor.Plugins.Keyboard.show(); // ⚠️ Solo funciona en iOS y si un input está enfocado
};






$scope.pruebaDiv = function() {
  if (document.getElementById('miDivTemp')) return;
  const nuevoDiv = Object.assign(document.createElement('div'), {id: 'miDivTemp',style: 'height:50px;width:100%;background:transparent;border: 2px solid red;'});
  console.log(">###> pruebaDiv.")
  // Inyectar dentro del <div class="scroll"> visible
  const scrollVisible = [...document.querySelectorAll('ion-content .scroll')].find(el => el.offsetParent !== null);
  if (scrollVisible) {
    scrollVisible.appendChild(nuevoDiv);
  }
};
$scope.pruebaDiv_superpuesto = function() {
  if (document.getElementById('miDivTemp')) return;
  console.log(">###> pruebaDiv_superpuesto.")
  document.body.appendChild(Object.assign(document.createElement('div'),{id: 'miDivTemp',style: 'position:fixed;bottom:0;left:0;width:100%;height:50px;background:transparent;border: 2px solid red;z-index:9999;'}));
};
$scope.quitarDiv = function() {
  console.log(">###> quitarDiv.")
  var el = document.getElementById('miDivTemp');
  if (el) el.remove();
};





$scope.shrinkPane = function(cuanto) {
  $timeout(function() {
    console.log(">###> shrinkPane():",cuanto)
    var pane = document.querySelector('.pane');
    pane.style.transition = 'height 0.3s ease';
    pane.style.height = 'calc(100% - ' + cuanto + ')';
    pane.scrollTop = pane.scrollHeight;

    var scroll=document.querySelector('.scroll')

    if (scroll) {
      scroll.style.setProperty(
        'transform',
        `translateY(${pane.clientHeight - scroll.clientHeight}px)`,
        'important'
      );
    }

  }, 0);
};

$scope.growPane = function() {
  console.log(">###> growPane().")
  $timeout(function() {
    var pane = document.querySelector('.pane');
    pane.style.transition = 'height 0.3s ease';
    pane.style.height = '100%';
    pane.scrollTop = pane.scrollHeight;
  }, 0);
};

$scope.resetScroll = function() {
  console.log(">###> resetScroll().")
  $timeout(function() {

    var pane = document.querySelector('.pane');
    var scroll=document.querySelector('.scroll');


    var offset = pane.clientHeight - scroll.clientHeight;
    offset = offset - 60;

    console.log( "pane.clientHeight:",pane.clientHeight )
    console.log( "scroll.clientHeight:",scroll.clientHeight )
    console.log("→ desplazamiento:", offset + "px")

    scroll.style.setProperty('transition', 'transform 0.3s ease', 'important');

    scroll.style.setProperty('transform', `translateY(${offset}px)`, 'important');



//scroll.style.setProperty('transform', `translateY(${pane.getBoundingClientRect().bottom - scroll.getBoundingClientRect().bottom}px)`, 'important');


  }, 0);

} 













$scope.pollas = '';
$scope.resultadoPollas = '';

$scope.ejecutarPollas = function () {
  const comando = $scope.pollas;

  console.log(">> ejecutarPollas() invocado");
  console.log(">> comando:", comando);

  r34lp0w3r_eval(comando).then(resultado => {
    $scope.resultadoPollas = resultado;
    if (!$scope.$$phase) $scope.$apply();
  });
};





















  $scope.pollas = '';
  $scope.resultadoPollas = '';

  $scope.ejecutarPollasOld = function () {
    const comando = $scope.pollas;

    console.log(">> ejecutarPollas() invocado");
    console.log(">> comando:", comando);

    const logs = [];
    const originalLog = console.log;
    console.log = function (...args) {
      logs.push(args.map(a =>
        typeof a === 'object' ? JSON.stringify(a) : String(a)
      ).join(' '));
      originalLog.apply(console, args);
    };

    (async () => {
      try {
        // Detectar si el código parece una expresión simple
        const isExpression = !/[=;{}]|^\s*(const|let|var|function|=>)/.test(comando.trim());
        const wrapped = isExpression ? `return (${comando})` : comando;

        const fn = new Function(`
          return (async () => {
            ${wrapped}
          })();
        `);

        const result = await fn();

        let output = '';
        if (logs.length > 0) output += logs.join('\n') + '\n';
        output += (typeof result === 'object')
          ? JSON.stringify(result, null, 2)
          : String(result);

        $scope.resultadoPollas = output;
        if (!$scope.$$phase) $scope.$apply();

      } catch (e) {
        console.log(">> error:", e);
        $scope.resultadoPollas = "❌ Error: " + e.message;
        if (!$scope.$$phase) $scope.$apply();
      } finally {
        console.log = originalLog;
      }
    })();

  };



$scope.setBodyStyle = function() {
  var body = document.body;

  body.style.position = 'relative';
  body.style.height = 'auto';
  body.style.minHeight = '100vh';
  body.style.overflow = 'auto';

  var bodyStyle = window.getComputedStyle(body);
  console.log('Style de body:');
  console.log('height:', bodyStyle.height);
  console.log('overflow:', bodyStyle.overflow);
  console.log('position:', bodyStyle.position);
  console.log('completo:', JSON.stringify(bodyStyle))
};










$scope.checkSpeechSynthesis = function() {
  
  // Nativo browser (no Android)
  //utterThis = new SpeechSynthesisUtterance("Bad Dog");
  //speechSynthesis.speak(utterThis);

  // TTS cordova (no va)
  //window.TTS.speak({
  //  text: 'Bad dog',
  //  locale: 'en-US',
  //  rate: 1.0
  //}, function () {
  //  console.log('Success');
  //}, function (reason) {
  //  console.error('Error', reason);
  //});

  Rlog();
  // Capacitor: npm install @capacitor-community/text-to-speech
  (async () => {
    try {
      const tts = window.Capacitor &&
                  window.Capacitor.Plugins &&
                  window.Capacitor.Plugins.TextToSpeech;
      if (!tts) {
        Rlog('Plugin TTS no disponible.');
        return;
      }
      Rlog("window.Capacitor.Plugins.TextToSpeech.speak({ text: 'Mad dog', lang: 'en-US', rate: 1.0, pitch: 1.0, volume: 1.0 })");
      await tts.speak({
        text: 'Mad dog',
        lang: 'en-US',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0
      });
      Rlog('✔️ TTS completado.');
    } catch (err) {
      Rlog('❌ Error usando TTS: ' + JSON.stringify(err));
    }
  })();

}













  $scope.premiumState = $rootScope.premium;
  $scope.tglPremium = function()
  {
    $scope.premiumState = !$scope.premiumState;
    if ( $scope.premiumState )
      localStorage.setItem( "_premiumState", "on" );
    else
      localStorage.setItem( "_premiumState", "off" );      
    genService.setPremium( $scope.premiumState );
    $scope.loadCache();
  }

  $scope.cacheState = genService.getCache();
  $scope.tglCache = function()
  {
    $scope.cacheState = !$scope.cacheState;    
    if ( $scope.cacheState )
      localStorage.setItem( "_cacheState", "on" );
    else
      localStorage.setItem( "_cacheState", "off" );
    genService.setCache( $scope.cacheState );    
    $scope.loadCache();
  }


  $scope.purchaseState = $rootScope.purchaseStatus;
  $scope.togglePurchase = function()
  {
    $scope.purchaseState =! $scope.purchaseState;
    if ( $scope.purchaseState )
    {
      //hoy + 1 año
      var ed = new Date( new Date().getTime() + 1000 * 60 * 60 * 24 * 365 );
      var purchase_id = "1234567890";
      var expires_date = ed.getTime().toString();
      var expires_date_human = ed.toISOString();
      localStorage.setItem( "_purchase_id", purchase_id );
      localStorage.setItem( "_purchase_expires", expires_date );
      localStorage.setItem( "_purchase_expires_human", expires_date_human );
    }        
    else
    {
      localStorage.removeItem( "_purchase_id" );
      localStorage.removeItem( "_purchase_expires" );
      localStorage.removeItem( "_purchase_expires_human" );    
    }
    $scope.purchase_id = localStorage.getItem( "_purchase_id" ) || "* no existe *";
    $scope.purchase_expires = localStorage.getItem( "_purchase_expires" ) || "* no existe *";
    $scope.purchase_expires_human = localStorage.getItem( "_purchase_expires_human" ) || "* no existe *";    
    $scope.loadCache(); 
    window.upd();
    $timeout( function() { 
        $scope.adsState = window.adsOn;
        $scope.premiumState = $rootScope.premium;
        $scope.cacheState = genService.getCache();
    }, 300); 
  }









  $scope.loadCache = function()
  {  

    var trk = JSON.parse( window.localStorage.getItem( "_cacheTrack" ) );
    if ( !trk )
      trk = {};

    $scope.cacheItems = [];
    $scope.cacheItems2 = [];

    $scope.totSize = 0;
    $scope.totSize2 = 0;
    for ( var i = 0; i < localStorage.length; i++ ){

      itm = {}
      name = localStorage.key( i );
      size = localStorage[ name ].length;
      itm.size = size;
      itm.updated = "???";
      itm.updated_human = "???";
      if ( trk[ name ] )
      {
        itm.size = trk[ name ].size;
        itm.updated = trk[ name ].updated;
        itm.updated_human = new Date( trk[ name ].updated ).toUTCString();
      }
      if ( name.substring( 0, 2 ) == "__" )
        {
          if ( name.substring( 0, 6 ) == "__test" && name != "__testslist" )
          {
            if ( name.substring( 0, 7 ) == "__tests" )
            {
              itm.name = name.substring( 2, 100 );
              val = JSON.parse( genService.getItem( name ) );
              size = parseInt( val.size );
              itm.size = size;
              $scope.cacheItems.push( itm );          
              $scope.totSize = $scope.totSize + itm.size;
            } 
            // Los tests individuales (_testXXXX) se ignoran
          }        
          else
          {
            if ( name.substring( 0, 13 ) == "__conjugation")
            {
              if( name.substring( 0, 14 ) == "__conjugations")
              {
                itm.name = name.substring( 2, 100);
                val = JSON.parse( genService.getItem( name ) );
                size = val.size;
                itm.size = size;
                $scope.cacheItems.push( itm );          
                $scope.totSize = $scope.totSize + itm.size;
              }// Los __conjugation_* se ignoran
            }
            else
            {
              itm.name = name.substring(2,100);
              $scope.cacheItems.push( itm );
              $scope.totSize = $scope.totSize + size;
            }

          }
        }
      else
      {
        itm.name = name;
        $scope.cacheItems2.push( itm );
        $scope.totSize2 = $scope.totSize2 + size;
      }
    }
  }




  // --- IAP products helper (show id and type in view)
  function mapCdvProducts() {
    try {
      var cp = $window.CdvPurchase || {};
      var list = [];
      if (Array.isArray(cp.products)) {
        list = cp.products;
      } else if (cp.store && Array.isArray(cp.store.products)) {
        list = cp.store.products;
      } else if (cp.products && typeof cp.products === 'object') {
        // Some versions expose products as an object keyed by id
        list = Object.keys(cp.products).map(function(k){ return cp.products[k]; });
      }
      // Normalize to only the fields we want in the UI
      return list.map(function(p){
        return { id: p && p.id, type: p && (p.type || p.productType) };
      });
    } catch (e) {
      return [];
    }
  }

  $scope.cdvProducts = [];
  $scope.refreshIapProducts = function() {
    $scope.cdvProducts = mapCdvProducts();
  };
  // Populate once the view has entered (after potential init)
  $scope.$on('$ionicView.afterEnter', function(){
    $scope.cdvProducts = mapCdvProducts();
  });




  $scope.goOldDebugView=function(event)
  {
    console.log("* goOldDebugView *");
    $state.go("app.myfriends");
  }

  console.log(">> controlador myFriendsCtrl2 cargado, scope:", $scope);

})
