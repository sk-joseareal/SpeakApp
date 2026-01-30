
angular.module( 'starter.authservice', [])

.factory( "AuthService", function( chat, $rootScope, $cordovaFileTransfer, $cordovaFile, varGlobal, $ionicLoading, adsService ) {
  return {
    
    userInfo:null,



    getUserInfo: function() {
      if ( !this.userInfo ) // Si hay datos guardados en localStorage, se usan
      {
        var userInfo = window.localStorage.getItem( "userInfo" )

        if ( !userInfo )
        {
          console.log("* no habia userInfo en localStorage *");
        }
        else
        {
          console.log("* habia userInfo en localStorage *")
          this.userInfo = JSON.parse( userInfo )

          // Estaba justo despues de declarar la función.
          // window.upd()

          /////
          // Tomar fecha en ms de localstorage
          var purchase_expires = localStorage.getItem( "_purchase_expires" )
          if ( !purchase_expires )
          {
            var purchaseExpires = null
            var isok = false

            console.log( "* isok *", isok, "purchaseExpires:", purchaseExpires, "hoy:", hoy );

          }
          else
          {
            var time = new Date().getTime()
            var hoy = new Date( time )
            var exp = new Date( parseInt( purchase_expires ) )
            var purchaseExpires = exp.toISOString() //.substring(0,10)
            var isok = ( exp >= hoy )

            console.log( "* isok :", isok, "* new Date( parseInt( localStorage.getItem( '_purchase_expires' ) ) ) :", exp, "* new Date( time ) :", hoy );

          }
    
          $rootScope.purchaseStatus = isok
          $rootScope.purchaseExpires = purchaseExpires

          // adsService.setAds(!isok);
          if ( localStorage.getItem( "_adsState" ) )
          {
            var value = localStorage.getItem( "_adsState" )
            if ( value == "on" )
            {
              window.adsOn = true;
            }
            else
            {            
              window.adsOn = false;
            }
          }
          else
          {
            window.adsOn = !isok;
          }
          
          if ( AdMob && window.adsOn ) 
            adsService.showBanner().catch(() => { console.log("* Error mostrando banner *") });
          else
            adsService.hideBanner().catch(() => { console.log("* Error ocultando banner *") });
            
      
          // genService.setCache(isok)
          if ( localStorage.getItem( "_cacheState" ) )
          {
            var value = localStorage.getItem( "_cacheState" )
            if ( value == "on" )
              varGlobal.cacheOn = true
            else
              varGlobal.cacheOn = false
          }
          else
            varGlobal.cacheOn = isok
            
          // genService.setPremium(isok)
          if ( localStorage.getItem( "_premiumState" ) )
          {
            var value = localStorage.getItem( "_premiumState" )
            if (value == "on" )
              $rootScope.premium = true
            else
              $rootScope.premium = false
          }
          else
            $rootScope.premium = isok
          
        }

      }
      
      window.user_id = (this.userInfo && this.userInfo.id) || 999999999;
            
      return this.userInfo
    },


    getUserId: function() { // como getUserInfo pero sin upd()
      if ( !this.userInfo ) // Si hay datos guardados en localStorage, se usan
      {
        var userInfo = window.localStorage.getItem( "userInfo" )
        if ( userInfo )
        {
          return JSON.parse( userInfo ).id
        }
      }
      else
        return this.userInfo.id
    },    
    


    setUserInfo: function( ui ) {

      console.log( "" )
      console.log( "* setUserInfo *" )
      console.log( JSON.stringify( ui ) )
      console.log( "" )

      if ( ui.email.includes( "sokinternet.com" ) || ui.email.includes( "p4w4.com" ) )
        window.viewDBG = true
      else
        window.viewDBG = false

      if ( ui.id == -1 )
      {
        this.userInfo=null
      }
      else
      {
        if ( window.ga )
          window.ga.setUserId( ui.id )
        if ( window.FirebasePlugin )
          window.FirebasePlugin.setUserId( ui.id.toString() )
        
        this.userInfo = ui

        var str = new Date().getTime()
        this.userInfo.image = ui.image + "?" + str

        this.userInfo.ignored = {}
        this.userInfo.ignoringMe = {}

        var bu = new Date(this.userInfo.banneduntil)
        var hoy = new Date()
        this.userInfo.banned = ( bu >= hoy )
        
        if ( !this.userInfo.banned && this.userInfo.bannedip )
          this.userInfo.banned = true
        
        this.cacheAvatar( this.userInfo.image.replace(/^http:\/\//i, 'https://') )
      }
      if (this.userInfo && this.userInfo.banned)
      {
        chat.currentUser = {
          id : -1,
          name : "",
          email : "",
          avatar : "",
          estilo : "",
          progress_image : "",
          progress_color : "",
          progress_value : 0,       
          moderator : false,
          hidden : false,
          premium : false,
          ip : "???"
        }
        window.user_id = 999999999
      }
      else
      { 
        var hdeg = {0:90,5:108,10:126,15:144,20:162,25:180,30:198,35:216,40:234,45:252,50:-90,55:-72,60:-54,65:-36,70:-18,75:0,80:18,85:36,90:54,95:72,100:90}
        var sect_bckg = "#ededed"

        // Ajustar progreso al intervalo mas cercano de 5 en 5 (0, 5, 10, 15 ... 90, 95, 100)
        var prog = Math.ceil( ui.current_course_progress / 5 ) * 5
        var sect_fgnd = ui.current_course_background

        if ( prog < 50 )
        {
          var dg1 = 90 // dg1 fijo
          var dg2 = hdeg[prog] // dg2 variable
          var sect_bck2 = sect_bckg // La primera mitad del círculo es del color de fondo         
        }
        else
        {
          var dg1 = hdeg[ prog ] // dg1 variable
          var dg2 = 270 // dg2 fijo          
          var sect_bck2 = sect_fgnd // La primera mitad del círculo es el color del progreso
        }

        //                                                        sect_bckg2                                                                     sect_fgnd    sect_bckg    sect_bckg 
        //               "background-image: linear-gradient(90deg, #ededed 50%, rgba(0, 0, 0, 0) 50%, rgba(0, 0, 0, 0)), linear-gradient(144deg, #f6c02b 50%, #ededed 50%, #ededed);"
        var prog_style = "background-image: linear-gradient(" + dg1 + "deg," + sect_bck2 + " 50%, rgba(0, 0, 0, 0) 50%, rgba(0, 0, 0, 0)), linear-gradient(" + dg2 + "deg," + sect_fgnd + " 50%," + sect_bckg + " 50%," + sect_bckg + ");"
                   
        chat.currentUser = {
          id : ui.id,
          name : ui.name,
          email : ui.email,
          avatar : ui.chatImage,
          estilo : "height: 48px; width: 48px; padding: 4px; margin: 12px 0 4px 0; border-radius: 48px;"+prog_style, //ui.style,
          progress_image : ui.current_course_image,
          progress_color : ui.current_course_background,
          progress_value : ui.current_course_progress,
          moderator : false,
          hidden : false,
          premium : false,
          ip : "???"
        }
        window.user_id = ui.id
      }
    },


    updateUI: function( ui ) {
      this.userInfo = ui
    },


    updateUserInfo: function( ui ) {
      chat.currentUser.name=ui.name
      chat.currentUser.email=ui.email
      this.userInfo.first_name=ui.first_name
      this.userInfo.last_name=ui.last_name
      this.userInfo.name=ui.name
      this.userInfo.email=ui.email
      this.userInfo.birthdate=ui.birthdate
      this.userInfo.sex=ui.sex
      this.userInfo.lc=ui.lc
    },


    changeCurrentCourse: function( course_id ) { // Era 'changeCurrentUser' y recibia un objeto (cu)
      var c=varGlobal.courses[course_id] 
      this.userInfo.current_course=course_id               // cu.current_course;
      this.userInfo.current_course_name=c.name             // cu.current_course_name;
      this.userInfo.current_course_name_en=c.name_en       // cu.current_course_name_en;
      this.userInfo.current_course_name_br=c.name_br
      this.userInfo.current_course_background=c.background // cu.current_course_background;
      this.userInfo.current_course_image=c.imageURL        // cu.current_course_image;
      this.userInfo.current_course_progress=c.progress     // cu.current_course_progress;
    },


    updateUserAvatar: function( avatar ) {
      chat.currentUser.avatar = avatar.replace(/^http:\/\//i, 'https://') + "?" + new Date().getTime()
      this.userInfo.image = chat.currentUser.avatar
      this.cacheAvatar( this.userInfo.image )
    },


    setUserProgress: function( cp, lp, tp ) {
      this.userInfo.course_progress = cp
      this.userInfo.lesson_progress = lp   
      if (tp)
        this.userInfo.test_progress = tp

      console.log(" setUserProgress -----------------")
      console.log(cp)
      console.log(lp)
      console.log("                 -----------------")

      window.localStorage.setItem( "userInfo", JSON.stringify( this.userInfo ) )
    },






    cacheAvatar: function( url )
    {
    ///  
      /////

      console.log( "\n\n\n--- cacheAvatar >>>>>" )      
      console.log( "--- cacheAvatar - url ...:", url )

      $rootScope.cacheImage = url;
      console.log( "--- cacheAvatar - ASIGNA 00 cacheImage", $rootScope.cacheImage )

      if ( r34lp0w3r.platform == "browser" )
      {
        console.log( "--- cacheAvatar - Browser: nada." )
        console.log( "--- cacheAvatar <<<<<\n\n\n" )        
      }
      else
      {

        if (!window.Capacitor || !Capacitor.Plugins || !Capacitor.Plugins.Filesystem) {
          console.warn('--- cacheAvatar Capacitor Filesystem plugin not available. *');
          return;
        }

        console.log("--- cacheAvatar ⛓️ Descargando avatar desde:", url);

        fetch(url)
          .then(function(response) {
            console.log("--- cacheAvatar 📥 Respuesta HTTP", response.status, response.statusText);
            if (!response.ok) throw new Error("Network error");
            return response.blob();
          })
          .then(function(blob) {
            return new Promise(function(resolve, reject) {
              const reader = new FileReader();
              reader.onloadend = function() {
                const base64 = reader.result.split(",")[1];
                resolve(base64);
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          })
          .then(function(base64Data) {
            // Guardar como avatar.gif
            return Capacitor.Plugins.Filesystem.writeFile({
              path: "avatar.gif",
              data: base64Data,
              directory: "DATA",
              recursive: true
            }).then(function(result1) {
              console.log("--- cacheAvatar ✅ Guardado avatar.gif:", JSON.stringify(result1));

              // Guardar como tmp.gif también
              return Capacitor.Plugins.Filesystem.writeFile({
                path: "tmp.gif",
                data: base64Data,
                directory: "DATA",
                recursive: true
              }).then(function(result2) {
                console.log("--- cacheAvatar ✅ Guardado tmp.gif:", JSON.stringify(result2));

                // Actualizar variables globales
                Capacitor.Plugins.Filesystem.getUri({ path: "avatar.gif", directory: "DATA" })
                  .then(function(result) {
                    const rand = '?r=' + Math.floor(Math.random() * 999999);
                    $rootScope.cacheImage = Capacitor.convertFileSrc(result.uri) + rand;
                    if (!$scope.$$phase) $scope.$apply();
                  });

                Capacitor.Plugins.Filesystem.getUri({ path: "tmp.gif", directory: "DATA" })
                  .then(function(result) {
                    const rand = '?r=' + Math.floor(Math.random() * 999999);
                    $rootScope.tmpImage = Capacitor.convertFileSrc(result.uri) + rand;
                    if (!$scope.$$phase) $scope.$apply();
                  });

                console.log("--- cacheAvatar 🟢 Avatar descargado y configurado");
                console.log( "--- cacheAvatar <<<<<\n\n\n" )
              });
            });
          })
          .catch(function(error) {
            console.error("--- cacheAvatar ❌ Error al descargar avatar:");
            if (error instanceof Error) {
              console.error(error.message, error.stack);
            } else {
              console.error(JSON.stringify(error));
            }
            console.log( "--- cacheAvatar <<<<<\n\n\n" )
          });

        
      }

      /////
    ///
    }

  }

})

