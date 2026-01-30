console.log("002.006 >###> js/modulos/adsservice.js >>>")

angular.module('starter.adsservice', [])

.factory("adsService", function (varGlobal,$rootScope) {

  return {

    adConfig: { rate:50, period:500, max:5 } ,
    adCount : 0,
    firstTime : null,
    lastTime : null,


    init: async function(conf) {

      if ( !window.AdMob )
      {
        console.log( "* adsService.init: no AdMob *" );
        return
      }

      if (conf)
      {
        console.log("* adsService.init (con conf) *");
        // guardar la configuración en localStorage
        window.localStorage.setItem( "adConfig", JSON.stringify( conf ) );
        this.adConfig = conf;
      }
      else
      {
        console.log( "* adsService.init (sin conf) *" );
        // Coger la configuración de localStorage
        var adCnf = window.localStorage.getItem( "adConfig" );
        if ( adCnf )
        {
          this.adConfig = JSON.parse( adCnf );
        }
      }
      if (window.adsOn)
      {
        try {
          await AdMob.prepareInterstitial({ adId: window.admobid.interstitial });
          console.log('* adsService.init: Interstitial cargado y listo para mostrar.');
        } catch (err) {
          console.log('* adsService.init: No se pudo cargar el Interstitial:', err);
        }
      }
    },


    setConfig: function( cfg ) {
      if ( !window.AdMob )
      {
        console.log( "* adsService.setConfig: no AdMob *" );
        return
      }
      console.log("* adsService.setConfig *");
      this.adConfig = cfg;
    },


    setAds: async function( onOff ) {
      if ( !window.AdMob )
      {
        console.log( "* adsService.setAds: no AdMob *" );
        return
      }
      console.log("* adsService.setAds *");
      if ( localStorage.getItem( "_adsState" ) )
      {
        var value = localStorage.getItem( "_adsState" );
        if ( value == "on" )
          window.adsOn = true;
        else
          window.adsOn = false;
      }
      else
        window.adsOn = onOff;

      if ( window.adsOn )
        await this.showBanner();
      else
        await this.hideBanner();
        
    },


    showBanner: async function () {
      if ( !window.AdMob )
      {
        console.log( "* adsService.showBanner: no AdMob *" );
        return
      }      
      console.log("* adsService.showBanner * window.admobid.banner:", window.admobid.banner);
      window.bannerOn = false;
      try {
        await AdMob.showBanner( { adId: window.admobid.banner, adSize: 'SMART_BANNER', position: 'BOTTOM_CENTER', margin: 0, additionalParameters: $rootScope.personalAds ? {} : { npa: '1' } } );
        console.log( '* adsService.showBanner * Banner mostrado.' );
        window.bannerOn = true;
      } catch ( err ) {
        var found = false;
        for (var key in err) {
          if (Object.prototype.hasOwnProperty.call(err, key)) {
            console.error('* adsService.showBanner * Error mostrando banner: ' + key + ': ' + err[key]);
            found = true;
          }
        }
        if (!found) {
          console.error('* adsService.showBanner * Error mostrando banner :' + (err && (err.message || err.toString())));
        }
        window.bannerOn = false;
      }        
    },



    hideBanner: async function () {
      if ( !window.AdMob )
      {
        console.log( "* adsService.hideBanner: no AdMob *" );
        return
      }
      console.log(" * adsService.hideBanner *" );
      try {
        if ( window.bannerOn )
        {
          res = await AdMob.hideBanner();
          console.log( "* adsService.hideBanner * Banner ocultado." );
          window.bannerOn = false;
        }
        else
        {
          console.log("* adsService.hideBanner * El banner ya estaba marcado como oculto.");
        }        
      } catch ( err ) {
        console.log("* adsService.hideBanner * Error ocultando banner:", JSON.stringify( err ) );
      }
    },


    showInterstitial: async function (AdMob) {
      if ( !window.AdMob )
      {
        console.log( "* adsService.showInterstitial: no AdMob *" );
        return
      }      
      console.log("* adsService.showInterstitial *");
      if (AdMob)
        console.log("* AdMob ok *")
      else
      {
        console.log("* AdMob no ok *")
        return
      }
      if (window.adsOn)
      {
        console.log( "* window.adsOn === true *" );

        if ( !$rootScope.InterstitialReady )
        {
          console.log( "* adsService.showInterstitial * No hay Interstitial preparado *" );
          return;
        }
        var ahora = Math.floor( Date.now() / 1000 );
        console.log( "* adConfig *" );
        console.log( JSON.stringify( this.adConfig ) );
        console.log( "* adCount   :", this.adCount );
        console.log( "* firstTime :", this.firstTime );
        console.log( "* lastTime  :", this.lastTime );
        console.log( "* ahora     :", ahora );              
        if ( this.adConfig.max == 0 )
        {
          console.log( "* adsService.showInterstitial * Sin anuncios, max=0." );
          return
        }
        if ( !this.lastTime ) // Aun no se ha mostrado ninguno    <- Inicializando lastTime y firstTime a 0, se cubre este caso eliminando este if
          {
            // Mostrarlo
            console.log( "* adsService.showInterstitial * Primer anuncio: " + JSON.stringify( this.adConfig ) );
            await AdMob.showInterstitial();
            this.adCount = 1;
            this.lastTime = ahora;
            this.firstTime = ahora;
          }
        else // Ya se ha mostrado alguno
        {
          // Tienen que haber pasado (como minimo) rate segundos desde el último, si no, no hay que hacer nada
          if ( ( ahora-this.lastTime) > this.adConfig.rate ) // Hace mas de rate segundos desde que se mostró el último anuncio
            {
              // Si estamos dentro del intervalo (now-firstTime<=period) hay que comprobar que no se hayan mostrado todos los que se pueden mostrar (this.adCount<max)
              if ( ( ahora - this.firstTime ) <= this.adConfig.period )
                {
                  if ( this.adCount < this.adConfig.max )
                    {
                      // Mostrarlo
                      console.log( "* adsService.showInterstitial * Anuncio " + ( this.adCount + 1 ) );
                      await AdMob.showInterstitial();
                      this.adCount++;
                      this.lastTime = ahora;
                    }
                  else
                  {
                    console.log( "* adsService.showInterstitial * Maximo de auncios por periodo agotado. *" );
                  }
                }
              // Si se ha excedido el intervalo, es el primer anuncio del intervalo nuevo (con period == 0 se excede siempre)
              else
                {
                  // Mostrarlo
                  console.log("* adsService.showInterstitial * Primer anuncio del periodo. *" );
                  await AdMob.showInterstitial();
                  this.adCount=1;
                  this.lastTime=ahora;
                  this.firstTime=ahora;
                }
            }
          else
          {
            console.log( "* adsService.showInterstitial * Todavia no toca mostrar anuncio. (" + ( ahora - this.lastTime ) + " segundos desde el último) *" );
          }
        }
      }
      else
      {
        console.log("* adsService.showInterstitial * window.adsOn === false *");
      }
    }


  }

})

console.log("002.006 >###> js/modulos/adsservice.js <<<")

