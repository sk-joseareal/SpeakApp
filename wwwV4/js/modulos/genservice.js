
angular.module('starter.genservice', [])

.factory("genService", function ( varGlobal, $rootScope, $state, $location, $http, $ionicLoading, AuthService, $ionicPopup ) {
  return {

    registerSpotLightLinks: function() {
      console.log("********************************");
      console.log("********************************");
      console.log("**** registerSpotLightLinks ****"); 
      window.plugins.indexAppContent.onItemPressed = function(payload) {             
         console.log("* Spotlight item pressed *"); 
         console.log(JSON.stringify(payload));
         console.log(payload.identifier); 
         console.log("**************************");
         $location.path(payload.identifier);
      }
      console.log("********************************");
      console.log("********************************")
    },


    origPrice: function() {

      var p = window.subsPrice;     

      // Si hay comas se pasan a puntos
      pp=p.replace(",",".");
      // Se elimina todo lo que no sean digitos o punto
      var ns=pp.replace(/[^0-9.]/g,"")

      var nn=Number(ns);

      var incPorc=100-window.subsDiscount; 

      var priceOrig = nn*100/(incPorc);
      var priceOrig=priceOrig.toFixed(2);      

      if (p.indexOf(",")=="-1")
        var conComa=false;
      else
        var conComa=true;

      var last=p.substring(p.length-1); // Sufijo ?
      var first= p.substring(0,1); // Prefijo ?
      if (isNaN(parseInt(last))) // Si no es un número el sufijo, asumimos que es el carácter de moneda
        var ret=priceOrig.toString()+" "+last;
      else // Si no es sufijo, asumimos que es prefijo el caracter de moneda
        var ret=first+" "+priceOrig.toString();

      if (conComa)
        ret=ret.replace(".",",");
      else
        ret=ret.replace(",",".");

      return ret;
    },

    deviceId: function() 
    {
      let dId = "";
        if ( r34lp0w3r.platform )
          dId = dId + " " + r34lp0w3r.platform;
        if ( window.appInfo && window.appInfo.version )
          dId = dId + " " + window.appInfo.version;
        if ( window.appInfo && window.appInfo.build )
          dId = dId + " " + window.appInfo.build;
        if ( $rootScope.userInfo && $rootScope.userInfo.id )
          dId = dId + " " + $rootScope.userInfo.id
      return dId.trim();
    },

    getPlatform: function() {
      return r34lp0w3r.platform.toLowerCase()
    },
    getVersion: function() {
      if( !( typeof device == "undefined" ) && device.version )
        return parseInt( device.version )
      else
        return 0
    },

    allCached: function(){
        var ac=true;
        var ks=Object.keys($rootScope.endpoints);
        for (xxx=0;xxx<ks.length;xxx++)
        {
          var key="__"+ks[xxx];
          if (!(key in window.localStorage))
          {
            ac=false; break;
          }
        }
        return ac;
    },

    //    loadAll: function(processAll,checkUpdates){
    //
    //    },
    dbgAlert: function(text)
    {
      console.log(text);
      if (varGlobal.debugMode)
        alert(text);
    },
    dbgAlertPurch: function(text)
    {
      console.log(text);
      if (varGlobal.debugModePurch)
        alert(text);
    },

    contentNewCheck: function(key,entity_id,fecha)
    {
      console.log("* contentNewCheck *");
      console.log(key);
      console.log(entity_id);
      console.log(fecha);

      if ($rootScope.userInfo)
        var user_id=$rootScope.userInfo.id;
      else
        var user_id=-1;

      console.log(user_id);

      var _contentTrack=JSON.parse(window.localStorage.getItem("_contentTrack"));

      if (!_contentTrack)
        return true;

      if (!_contentTrack[key][user_id])
        return true;

      if (!_contentTrack[key][user_id][entity_id])
        return true;

      var d=new Date(parseInt(_contentTrack[key][user_id][entity_id]));
      var dd=d.toISOString().substring(0,19);
      console.log(dd);

      if (dd>fecha)
        return false;
      else
        return true;
    },

    contentTrack: function(t,id){
      console.log("* contentTrack *");

      if ($rootScope.userInfo)
        var user_id=$rootScope.userInfo.id;
      else
        var user_id=-1;
      if (t=="lesson")
      {
        var key="lessons";
      }
      else
      {
        var key="tests";
      }

      // recuperar / inicializar _contentTrack
      var _contentTrack=JSON.parse(window.localStorage.getItem("_contentTrack"));
      if (!_contentTrack)
        _contentTrack={"lessons":{},"tests":{}};

      if (!_contentTrack[key][user_id])
        _contentTrack[key][user_id]={}

      var now=new Date();
      _contentTrack[key][user_id][id]=now.getTime().toString();

      window.localStorage.setItem("_contentTrack",JSON.stringify(_contentTrack));

      console.log(_contentTrack);

    },

    viewTrack: function(viewInfo){
      localStorage.setItem("_lastPos",viewInfo); 
      varGlobal.viewCount=varGlobal.viewCount+1;
      //      if (!("appRated" in window.localStorage) && varGlobal.viewCount==varGlobal.rateCount)
      //        this.rateApp();
      //      else
        console.log("viewCount: "+varGlobal.viewCount);
    },

    rateApp: function(){

      if (!$rootScope.isOnLine)
        return;

      if ($rootScope.loc=="es")
      {
        var txt1='Por favor, danos tu opinión sobre Curso de Inglés.';
        var txt2='Valora Curso de Inglés';
        var txt3='Si, ¡voy a valorar!';
        var txt4='Recuérdamelo más tarde';
        var txt5='Tengo comentarios';
        var urla="market://details?id=com.sokinternet.cursoingles";
        //var urli='itms-apps://itunes.apple.com/es/app/curso-ingles/id549780021?l=es&ls=1&mt=8';
        //var urli='itms-apps://itunes.apple.com/WebObjects/MZStore.woa/wa/viewContentsUserReviews?id=549780021&onlyLatestVersion=false&pageNumber=0&sortOrdering=1&type=Purple+Software&l=es';
        var urli='itms-apps://itunes.apple.com/xy/app/foo/id549780021?action=write-review';
      }
      else
        if ($rootScope.loc=="br")
        {
          var txt1='Por favor, dê s aua opinião sobr eo Curso de inglês';
          var txt2='Classifique o Curso de inglês';
          var txt3='Sim, vou classificá-lo!';
          var txt4='Lembre-me mais tarde';
          var txt5='Tenho comentários';
          var urla="market://details?id=com.sokinternet.cursoingles";
          //var urli='itms-apps://itunes.apple.com/br/app/curso-ingles/id549780021?l=br&ls=1&mt=8';
          //var urli='itms-apps://itunes.apple.com/WebObjects/MZStore.woa/wa/viewContentsUserReviews?id=549780021&onlyLatestVersion=false&pageNumber=0&sortOrdering=1&type=Purple+Software&l=br';          
          var urli='itms-apps://itunes.apple.com/xy/app/foo/id549780021?action=write-review';
        }
        else
        {
          var txt1='Please give us your feedback about English Course.';
          var txt2='Rate English Course';
          var txt3='Yes, go to rating!';
          var txt4='Remind me later';
          var txt5='I have feedback';
          var urla="market://details?id=com.sokinternet.cursoingles&hl=en&lr=lang_en"; 
          //var urli='itms-apps://itunes.apple.com/us/app/curso-ingles/id549780021?l=en&ls=1&mt=8';
          //var urli='itms-apps://itunes.apple.com/WebObjects/MZStore.woa/wa/viewContentsUserReviews?id=549780021&onlyLatestVersion=false&pageNumber=0&sortOrdering=1&type=Purple+Software&l=en';
          var urli='itms-apps://itunes.apple.com/xy/app/foo/id549780021?action=write-review';
        }
 
      navigator.notification.confirm(
      txt1,
      function( button ) {
        // yes = 1, no = 2, later = 3
        if (button == '1') // Rate Now
        {
          if ( r34lp0w3r.platform == "ios" ) {
            cordova.InAppBrowser.open( urli, '_system', 'hidden=yes,location=yes' ) 
          }
          else if ( r34lp0w3r.platform == "android" )
          {
            cordova.InAppBrowser.open( urla, '_system', 'hidden=yes,location=yes' ) 
          } 
          varGlobal.rateCount =-1
          window.localStorage.setItem( "appRated", "true" )
        } 
        else if ( button == '2' ) // Later
        { 
          varGlobal.viewCount = 0
        } 
        else if ( button == '3' ) // Feedback
        { 
          if ( $rootScope.loc == "es" )
            var txtSubject = "Tengo comentarios"
          else
            if ( $rootScope.loc == "br" )
              var txtSubject = "Tenho comentários"
            else
              var txtSubject = "I have feedback"                            
          var dId = ""
          if ( r34lp0w3r.platform )
            dId = dId + r34lp0w3r.platform + " "
          if (device.version)
            dId = dId + device.version + " "
          dId = dId + "CDI " + varGlobal.version + " "
          if (device.manufacturer)
            dId = dId + device.manufacturer + " "
          if (device.model)
            dId = dId + device.model + " "
          dId = dId.trim()

          mt="mailto:"+$rootScope.i18n[$rootScope.loc].contact_mail+"?subject="+txtSubject+" ("+dId+")";
          console.log("-------------------------------------")
          console.log(mt)
          console.log("-------------------------------------")
          cordova.InAppBrowser.open( mt, '_system', 'hidden=yes,location=yes' )              
          //window.open(mt, '_system', 'location=no')
          varGlobal.rateCount =-1
        }
      }, txt2, [txt3, txt4, txt5]);

    },

    lzw_encode: function(s)
    {
      var dict = {};
      var data = (s + "").split("");
      var out = [];
      var currChar;
      var phrase = data[0];
      var code = 256;
      for (var i=1; i<data.length; i++) {
          currChar=data[i];
          if (dict[phrase + currChar] != null) {
              phrase += currChar;
          }
          else {
              out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
              dict[phrase + currChar] = code;
              code++;
              phrase=currChar;
          }
      }
      out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
      for (var i=0; i<out.length; i++) {
          out[i] = String.fromCharCode(out[i]);
      }
      return out.join("");
    },


    lzw_encode_old: function(s) 
    {
      var dict = {};
      var data = (s + "").split("");
      var out = [];
      var currChar;
      var phrase = data[0];
      var code = 256;
      for (var i=1; i<data.length; i++) {
        currChar=data[i];
        if (dict[phrase + currChar] != null) {
            phrase += currChar;
        }
        else {
            out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
            dict[phrase + currChar] = code;
            code++;
            phrase=currChar;
        }
      }
      out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
      for (var i=0; i<out.length; i++) {
        out[i] = String.fromCharCode(out[i]);
      }
      return out.join("");
    },

    lzw_decode: function(s)
    {
      var dict = {};
      var data = (s + "").split("");
      var currChar = data[0];
      var oldPhrase = currChar;
      var out = [currChar];
      var code = 256;
      var phrase;
      for (var i=1; i<data.length; i++) {
          var currCode = data[i].charCodeAt(0);
          if (currCode < 256) {
              phrase = data[i];
          }
          else {
             phrase = dict[currCode] ? dict[currCode] : (oldPhrase + currChar);
          }
          out.push(phrase);
          currChar = phrase.charAt(0);
          dict[code] = oldPhrase + currChar;
          code++;
          oldPhrase = phrase;
      }
      return out.join("");
    },
    lzw_decode_old: function(s) 
    {
      var dict = {};
      var data = (s + "").split("");
      var currChar = data[0];
      var oldPhrase = currChar;
      var out = [currChar];
      var code = 256;
      var phrase;
      for (var i=1; i<data.length; i++) {
        var currCode = data[i].charCodeAt(0);
        if (currCode < 256) {
            phrase = data[i];
        }
        else {
           phrase = dict[currCode] ? dict[currCode] : (oldPhrase + currChar);
        }
        out.push(phrase);
        currChar = phrase.charAt(0);
        dict[code] = oldPhrase + currChar;
        code++;
        oldPhrase = phrase;
      }
      return out.join("");
    },
    setCache: function(onOff)
    {
      if (localStorage.getItem("_cacheState"))
      {
        var value=localStorage.getItem("_cacheState");
        if (value=="on")
          varGlobal.cacheOn=true;
        else
          varGlobal.cacheOn=false;
      }
      else
        varGlobal.cacheOn=onOff;
    },
    getCache: function()
    {
      return varGlobal.cacheOn;
    },
    setChatEnabled: function()
    {
      if ($rootScope.premium)
      {
        $rootScope.chatEnabled=true;      
      }
      else
      {        
        var value=localStorage.getItem("_oldusr");
        if (value=="true")
        {
          $rootScope.chatEnabled=true;
        }
        else
        {
          $rootScope.chatEnabled=false;
        }
      }
      var val=$rootScope.chatEnabled;

  if(!$rootScope.$$phase) {
    $rootScope.$apply(function() 
    {
      $rootScope.chatEnabled=val;
    });   
  }
  else
  {
    $rootScope.chatEnabled=val;
  }

    },
    setPremium: function(onOff)
    {
      if (localStorage.getItem("_premiumState"))
      {
        var value=localStorage.getItem("_premiumState");
        if (value=="on")
          $rootScope.premium=true;
        else
          $rootScope.premium=false;
      }
      else
        $rootScope.premium=onOff;
    },
    checkItem: function(key)
    {
      return (key in window.localStorage);
    },
    setItem: function(key,value){

        var enc_val=LZString.compress(value);

        window.localStorage.setItem(key,enc_val);


        this.setTrk(key ,enc_val.length, new Date().getTime() );

    },
    getItem: function(key){
      enc_val=window.localStorage.getItem(key);
      value=LZString.decompress(enc_val);
      return value;
      //return window.localStorage.getItem(key);
    },

    getTrk: function(key){
      var trk=JSON.parse(window.localStorage.getItem("_cacheTrack"));
      if (!trk)
      {
        trk={};
        var size=0;
        var updated=0;
      }
      else
      {
        var size=trk[key].size;
        var updated=trk[key].updated;
      }
      return { size: size, updated: updated };
    },

    setTrk: function(key,size,updated){
      var trk=JSON.parse(window.localStorage.getItem("_cacheTrack"));
      if (!trk)
        trk={};
      trk[key]={size: size, updated: updated};
      window.localStorage.setItem("_cacheTrack",JSON.stringify(trk));
    },

    toTmp: function(key){
      var val=window.localStorage.getItem(key);

      window.localStorage.setItem("__cacheTmp",val);

      var trk=this.getTrk(key);
      this.setTrk("__cacheTmp",trk.size,trk.updated);   

    },
    fromTmp: function(key){
      var val=window.localStorage.getItem("__cacheTmp");
      window.localStorage.setItem(key,val);

      var trk=this.getTrk("__cacheTmp");
      this.setTrk(key,trk.size,trk.updated);

    },
    removeItem: function(key){
      window.localStorage.removeItem(key); 
    },

    logEvent: function (event) {
      if (window.ga) window.ga.trackView(event)
      if (window.FirebasePlugin)
      {
        window.FirebasePlugin.logEvent(event, { uuid: uuid })
        window.FirebasePlugin.setScreenName(event)
      }
    },


    finishPurchase: function( result ) {

      console.log("- genService.finishPurchase() - result.register_ok:", result.register_ok )

      if ( result.register_ok )
      {

        localStorage.setItem( "_purchase_id",            result.purchase_id            );
        localStorage.setItem( "_purchase_expires",       result.purchase_expires       );
        localStorage.setItem( "_purchase_expires_human", result.purchase_expires_human );

        console.log( "- genService.finishPurchase() - _purchase_id ...........: '" + result.purchase_id            + "'" );
        console.log( "- genService.finishPurchase() - _purchase_expires ......: "  + result.purchase_expires             );
        console.log( "- genService.finishPurchase() - _purchase_expires_human : '" + result.purchase_expires_human + "'" );

        // Esto se supone que actualiza $rootScope.premium y el interface
        const userInfo = AuthService.getUserInfo();
        window.upd();

        if ( $rootScope.showPopup )
        {
          $rootScope.showPopup = false;
          //window.upd();
          $rootScope.purchasThanksModal.show();
        }

      }
      else
      {

        $ionicLoading.hide()
        $rootScope.showPopup = false
        var myPopup = $ionicPopup.show( { template: '', title: "Warning", subTitle: "Error registering Purchase.", scope: $rootScope, buttons: [ { text: 'Ok' } ] } )

      }
       
      if ( !$rootScope.loadingContent ) $ionicLoading.hide();



    },



    finishPurchase_OLD: function( transaction ) {

      console.log("- PURCHASE - finishPurchase")

      var config = { headers: { "X-Testing" : "testing" } }
      config.headers["X-Platform"] = $rootScope.deviceId

      params = {}

      params.version = "v2"

      params.transaction = transaction

      if ($rootScope.install_referrer)
        params.install_referrer = $rootScope.install_referrer

      if ( $rootScope.validatorSource )
        params.validatorSource = $rootScope.validatorSource
      else
        params.validatorSource = "none"

      console.log( "- PURCHASE - finishPurchase - params:", JSON.stringify(params) )

      // window.user_id lo asigna antes de llamar a store.order o store.refresh

      $http.post( varGlobal.apiURL + "/check-purchase/" + window.user_id, params, config ).then(
        function okCallback( response )
        {

          console.log("- PURCHASE - finishPurchase : okCallback -")       

          if ( response.data.ok == "False" )
          {
            $ionicLoading.hide()
            $rootScope.showPopup = false
            if ( response.data.error != "" )
              var myPopup = $ionicPopup.show( { template: '', title: "Warning", subTitle: response.data.error, scope: $rootScope, buttons: [ { text: 'Ok' } ] } )
          }
          else
          {

            localStorage.setItem( "_purchase_id",            response.data.datos[ "original_transaction_id" ] )
            localStorage.setItem( "_purchase_expires",       response.data.datos[ "expires_date"            ] )
            localStorage.setItem( "_purchase_expires_human", response.data.datos[ "expires_date_human"      ] )

            console.log( "- PURCHASE - finishPurchase : okCallback - _purchase_id ...........: '" + response.data.datos[ "original_transaction_id"  ] + "'" )
            console.log( "- PURCHASE - finishPurchase : okCallback - _purchase_expires ......: "  + response.data.datos[ "expires_date"             ]       )
            console.log( "- PURCHASE - finishPurchase : okCallback - _purchase_expires_human : '" + response.data.datos[ "expires_date_human"       ] + "'" )

            if ( $rootScope.showPopup )
            {
              $rootScope.showPopup = false
               window.upd()
              $rootScope.purchasThanksModal.show()
            }

          }

          if ( !$rootScope.loadingContent )
            $ionicLoading.hide()
      
        },
        function errorCallback(response)
        {
          $ionicLoading.hide()
          console.log( "- PURCHASE - finishPurchase : errorCallback -" )
          console.log( "- PURCHASE - finishPurchase : errorCallback - response.data:", response.data )
          console.log( "- PURCHASE - finishPurchase : errorCallback - response.status:", response.status ) 
        }
      )
    }

  }
})

