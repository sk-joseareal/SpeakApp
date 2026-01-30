
angular.module('starter.backendservice', [])

.factory("backendService", function($http,varGlobal,$ionicLoading,$ionicPopup,$rootScope,$location,adsService,$state,$ionicHistory,genService,AuthService,$cordovaFileTransfer,UnitsService,$ionicLoading,$timeout) {
    return {
        pushStarted: false,
        VocabsList: [],


        tick: function(par_items) {
            console.log("* globalTick "+$rootScope.globalTick+" *");

            if (typeof par_items === 'undefined')
            {
              var flag_todos=true;
              var items={};
            }
            else
            {
              var flag_todos=false;
              var items=par_items;
            }

            if (varGlobal.cacheOn && $rootScope.isOnLine && !$rootScope.loadingContent)
            {
              if (!$rootScope.allCached)
                this.cacheAll(false); // Solo procesar si no están en caché
              else
              {
                if (flag_todos)
                  this.cacheAll(true); // Procesar aunque estén en caché (para comprobar updates)
                else
                  this.cacheAll(true,items)
              }
              // ---> OJO: Si varGlobal.cacheOn no es true, no cachea aunque haya update.  

              this.recordProgress();            
            }

        },

        recordProgress: function(){

          $rootScope.userInfo=AuthService.getUserInfo();  
          if (!$rootScope.userInfo)
            return;
          
          var pendProgress=window.localStorage.getItem("_pendProgress"+$rootScope.userInfo.id);

          if (!pendProgress)
            return;

          pendProgress=JSON.parse(pendProgress);
          console.log("---");
          console.log(JSON.stringify(pendProgress));
          console.log("---");          

          console.log("* antes de recordProgress *");
          $ionicLoading.show();
          this.doPost('/v4/recordProgress', $rootScope.userInfo, pendProgress, function(result) {

            if (!$rootScope.loadingContent)
              $ionicLoading.hide();
            console.log('* recorProgress returned value *');
            console.log(result);

            if (varGlobal.cacheOn) 
            {        
              if (result.ok) // Si ha ido bien, se ha de eliminar la entrada de localStorage
                window.localStorage.removeItem("_pendProgress"+$rootScope.userInfo.id);
            }    

          });
          console.log("* después de recorProgress *");

        },

        cacheAll: function(check,par_items){

          if (!$rootScope.endpoints) // Si llama antes de que los endpoints estén inicializados (demasiado pronto)
            return;

          if (typeof par_items === 'undefined')
          {
            var flag_todos=true;
            var items={};
          }
          else
          {
            var flag_todos=false;
            var items=par_items;
          }

          this.muestraTexto("cacheAll()");

          $ionicLoading.show();

          console.log("-->");

          $rootScope.userInfo=AuthService.getUserInfo();

          $rootScope.dwnCnt=0; // Contador para la descarga de imágenes

          $rootScope.loadingContent=true;

          var ks=Object.keys($rootScope.endpoints);
          var downCounter=0;
          var downTotal=ks.length;
          for (var currentKey=0;currentKey<ks.length;currentKey++)
          {
            key=ks[currentKey];

            if ( (check || !("__"+key in window.localStorage)) && (flag_todos || items[key]) ) 
            {
                       
              endpoint=$rootScope.endpoints[key]; 
              $rootScope.forceCache=true;
              console.log("* antes de getCached ["+key+"] *");    

              $rootScope.loadingItem["__"+key]=1;

              $ionicLoading.show();
              // Ojo al parámetro true que hay después del callback -> Que haga checkUpdates

              this.doGetCached("#"+key,endpoint,$rootScope.userInfo,function(result) {
                var key=result.cacheId;
                var res=( result.ok ? 0 : 2);

                console.log("* dentro de getCached ["+key+"] *");

                console.log("* getCached ["+key+"] returned value *");
                console.log(result);
                console.log("* *");
                
                downCounter++;
                if (downCounter==downTotal) { 
                  $rootScope.allCached=genService.allCached(); 
                  $rootScope.loadingContent=false;                 
                  if (!$rootScope.loadingContent)
                    $ionicLoading.hide(); 

                  console.log("cacheAll() end.");
                } 
                    
                $rootScope.loadingItem[key]=res;


                if ( key=="__vocabularies" && r34lp0w3r.platform != "browser" ) 
                {
                  // Tabla con las imágenes de vocabularios
                  var files=[];
                  for(xx=0;xx<result.data.vocabs.length;xx++)
                  {
                    ///console.log(result.data.vocabs[xx].name);
                    for (yy=0;yy<result.data.vocabs[xx].vocabularies.length;yy++)
                    {
                      //console.log(" "+result.data.vocabs[xx].vocabularies[yy].name);
                      for (zz=0;zz<result.data.vocabs[xx].vocabularies[yy].words.length;zz++)
                      { 
                        var word=result.data.vocabs[xx].vocabularies[yy].words[zz];
                        if (word.image_file_name)
                        {
                          // https://s3.amazonaws.com/sk.audios.dev/images/722/original/Fotolia_76475468_XS.jpg
                          // var file="https://s3.amazonaws.com/sk.audios.dev/images/"+word.id+"/original/"+word.image_file_name;
                          // https://s3.amazonaws.com/sk.CursoIngles/vocabimages/vocab100.png
                          var file="https://s3.amazonaws.com/sk.CursoIngles/vocabimages/vocab"+word.id+".png"
                          files.push({"id":word.id, "file":file});
                          //console.log("  "+word.name+" "+file)
                        }
                      }
                    }
                  }

                  // Descargar las imágenes
                  $rootScope.dwnCnt = 0;
                  $rootScope.dwnTot = files.length;

                  files.forEach(function(f, xx) {
                    var src = f.file;
                    var dstFileName = "vocab" + f.id + ".png";

                    console.log((xx + 1) + " Descarga de src: " + src + " dst: " + dstFileName);

                    console.log("⛓️ Intentando descargar:", src);

                    fetch(src)
                      .then(function(response) {
                        console.log("📥 Respuesta HTTP", response.status, response.statusText);
                        if (!response.ok) throw new Error("Network error");
                        return response.blob();
                      })
                      .then(function(blob) {
                        return new Promise(function(resolve, reject) {
                          const reader = new FileReader();
                          reader.onloadend = function() {
                            const base64 = reader.result.split(",")[1]; // quitamos "data:image/png;base64,"
                            resolve(base64);
                          };
                          reader.onerror = reject;
                          reader.readAsDataURL(blob);
                        });
                      })
                      .then(function(base64Data) {
                        return window.Capacitor.Plugins.Filesystem.writeFile({
                          path: dstFileName,
                          data: base64Data,
                          directory: "DATA",
                          recursive: true
                        });
                      })
                      .then(function(result) {
                        $rootScope.dwnCnt++;
                        console.log(">>> FileTransfer -> Success");
                        console.log(">>> " + $rootScope.dwnCnt + " <<<");
                        console.log(JSON.stringify(result));
                      })
                      .catch(function(error) {
                        $rootScope.dwnCnt++;
                        console.log(">>> FileTransfer -> Error");
                        console.log(">>> " + $rootScope.dwnCnt + " <<<");

                        if (error instanceof Error) {
                          console.error("❌ ERROR DETALLADO:", error.message, error.stack);
                        } else {
                          console.error("❌ ERROR RAW:", JSON.stringify(error));
                        }
                      });
                  });

                }
               
                if ( key.substring(0,8)=="__course" && key.substring(0,9)!="__courses" )
                {
                  var course_id=parseInt(key.substring(8,100));
                  UnitsService.setUnits(course_id,result.data.lessons);
                }


              },true);
              console.log("* después de getCached ["+key+"] *");

            }
            else
            {
              downCounter++;
              if (downCounter==downTotal) { $rootScope.allCached=genService.allCached(); $rootScope.loadingContent=false; }
            }


          }
          console.log("<--");


        },

        checkPush: function(){
          return this.pushStarted;
        },

        setVocabs: function (vocabs) {
          this.VocabsList=vocabs;
        },

        getVocabulary: function(vocab_id,vocabulary_id) {
          var words=[];
          var n=this.VocabsList.length;
          for(i=0;i<n;i++) 
          {
            if (this.VocabsList[i].id == vocab_id)
            {
              var m=this.VocabsList[i].vocabularies.length;
              for (j=0;j<m;j++)
              {
                if (this.VocabsList[i].vocabularies[j].id==vocabulary_id)
                {
                  name=this.VocabsList[i].vocabularies[j].name;
                  translation=this.VocabsList[i].vocabularies[j].translation;
                  words=this.VocabsList[i].vocabularies[j].words;
                }
              }
            }
          }
          vocabulary=[];
          vocabulary.name=name;
          vocabulary.translation=translation;
          vocabulary.words=words;
          return vocabulary;
        },

        Play: function(txt,userInfo,nospin,cb,locale,gender) {

          var nospin = nospin || false;
          var cb = cb || null;
          var locale = locale || false;
          var gender = gender || "Female";

          var text=txt;
          if (text.slice(-1)==".") text=text.substring(0, text.length - 1);
         
          text=text.replace(new RegExp("/", 'g'), " ");

          if (locale)
          {
            lc=locale;
          }
          else
          {
            if (userInfo) {
              var lc = userInfo.lc;
              if (!lc)
                var lc = "en-us";
            }
            else
              var lc = "en-us";

            if (lc == "en-us")
              locale = "en-US";
            else
              locale = "en-GB";
          }

          var speed = 0.75;

          if( r34lp0w3r.platform == 'ios' )
          {
            speed = 1.5;          
            if ( text.toLowerCase() == "i" )
              text = "eye";
          }

          console.log(">###> backendService.Play() *",text,locale,speed);

          if ( r34lp0w3r.platform === 'browser' )
          {
            // Usar window.speechSynthesis

            if ( locale=="en-GB" && voices_GB.length > 0 )
              var quevoz = r34lp0w3r.voices_GB[0][0];
            else
              if ( r34lp0w3r.voices_US.length > 0 )
                var quevoz = window.r34lp0w3r.voices_US[0][0];
              else
                var quevoz=-1;
        
            if (quevoz==-1)
            {
              // Mostrar un popup y no reproducir.
              var txt1 = ( $rootScope.loc=="en" ) ? "Text" : "Texto"
              var myPopup = $ionicPopup.show( { template: '', title: txt1, subTitle: text, scope: $rootScope, buttons: [ { text: 'Ok' } ] } )
            }
            else
            {
              // Play
              window.utterances = []; // Lo de usar la tabla para almacenar la variable es por un bug que hace que no suene a veces si no se hace esto, algo relacionado con garbage collection.
              var utterThis = new SpeechSynthesisUtterance(text);              
              utterThis.voice = window.speechSynthesis.getVoices()[quevoz];
              if (cb) 
              { 
                console.log("*CON CALLBACK*"); 
                utterThis.onend = function (event) { console.log('*CALLBACK*'); cb(); };
              }    
              utterances.push(utterThis);
              speechSynthesis.speak(utterThis);  
            }

            // si locale=="en-GB" y hay alguna de en-GB, usarla
            // si no, si hay alguna de en-US, usarla
            // si no, si hay alguna, usarla
            // si no, texto.
  
          }
          else
          {
            if  ( !window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.TextToSpeech )
            {
              var myPopup = $ionicPopup.show({ template: '', title: "", subTitle: "Falta TextToSpeech", scope: $rootScope, buttons: [ { text: 'Ok' } ] });
              return;
            }

            if (!nospin) $ionicLoading.show();
            (async () => {
              try {
                const tts = (window.Capacitor && window.Capacitor.Plugins)
                  ? window.Capacitor.Plugins.TextToSpeech
                  : undefined;
                if (!tts) {
                  return;
                }
                await tts.speak({
                  text: text,
                  lang: locale,
                  rate: 1.0,
                  pitch: 1.0,
                  volume: 1.0
                });
                if (!nospin) $ionicLoading.hide();
              } catch (err) {
                console.error('>###> Error usando TTS:', err);
                if (!nospin) $ionicLoading.hide(); 
              }
            })();

          }

        },  

        Stop: function() {
          if (Capacitor.getPlatform() === 'web')
            return;

          (async () => {
            try {
              const tts = (window.Capacitor && window.Capacitor.Plugins)
                ? window.Capacitor.Plugins.TextToSpeech
                : undefined;
              if (!tts)
                return;
              await tts.speak( { text: "" } );
            } catch (err) {
              console.log('>###> Error usando TTS en backendservice:',err)
            }
          })();

        },          

        PlayRaw: function(txt,userInfo) {
          var text=txt;
          console.log("* play *");
          console.log(text)

          if (userInfo)
          {
            var lc=userInfo.lc;
            if (!lc)
              var lc="en-us";
          }
          else
            var lc="en-us";

          if (lc=="en-us")
            locale="en-US";
          else
            locale="en-GB";

          $ionicLoading.show();

          var speed = 0.75;
          if( window.cordova )
            if ( r34lp0w3r.platform == 'ios' )
            {
              speed = 1.5;
              if ( text.toLowerCase() == "i" )
                text = "eye";            
            }
          TTS.speak({
            text: text,
            locale: locale,
            rate: speed
          }, function () {                 
              if (!$rootScope.loadingContent)
                $ionicLoading.hide();                
              console.log('TTS success.');
          }, function (reason) {               
              if (!$rootScope.loadingContent)
                $ionicLoading.hide();                
              console.log('TTS failed: '+reason);
          });

        },            

        doPost: function(endpoint,userInfo,data,callback)
        {

          console.log("# backendService : doPOST #");

          $rootScope.error_login="";

          if (!data)
            data={};

          // Si endpoint contiene ya un '?', se pone el timestamp con '&', si no con '?'
          if (endpoint.indexOf("?")>-1)
            var char="&"
          else
            var char="?"


          var timestamp=Math.round(+new Date()/1000);

          // Timestamp
          data["timestamp"]=timestamp;
          // user_id & user_token
          if (userInfo)
          {
            var user_id=userInfo.id;
            var token=userInfo.token;            
            data["user_id"]=user_id;
            data["token"]=token;
          }

          console.log("* endpoint *");          
          console.log(endpoint);
          console.log("* data *");
          console.log(JSON.stringify(data));

          if (userInfo)
            var hash = CryptoJS.HmacSHA256(endpoint.toLowerCase()+"?timestamp="+timestamp+"&user_id="+user_id+"&token="+token, varGlobal.auth_key);
          else
            var hash = CryptoJS.HmacSHA256(endpoint.toLowerCase()+"?timestamp="+timestamp, varGlobal.auth_key);
          var signature = CryptoJS.enc.Base64.stringify(hash);

          console.log("* signature *");
          console.log(signature)

          if (varGlobal.authOn)
            var config = { headers: { "Authorization" : signature } };
          else
            var config = { headers: { "X-Testing" : "testing" } };
          config.headers["X-Platform"]=$rootScope.deviceId;;

          $rootScope.errorValue2="";
          $http.post(varGlobal.apiURL+endpoint,data,config).then(
            function successCallback(response) {           
              if (!$rootScope.loadingContent)
                $ionicLoading.hide();

              if (response.data.error) 
              {
                $rootScope.logout();
 
                if(endpoint=="/v3/passreset" || endpoint=="/v3/usr/login" || endpoint=="/v3/usr/create")
                {
                  $rootScope.error_login=response.data.error;
                }
                else
                {
//////////////////////////                

                  console.log("==========================");                  
                  console.log(response.data.error_code);
                  console.log("==========================");
                  var muestrapopup=false;
                  if (response.data.error_code && response.data.error_code=="2") // Falta el email y es login mediante de Facebook
                  {                    
                    if ($rootScope.loc=="es")
                    {
                      var txt1="Problema de login";
                      var txt2="Necesitamos tu dirección de correo por seguridad.";
                    }
                    else
                      if ($rootScope.loc=="br") 
                      {
                        var txt1="Problema de login";
                        var txt2="Precisamos de seu endereço de e-mail por razões de segurança.";
                      }
                      else
                      {
                        var txt1="Login issue";
                        var txt2="Sorry, we need your mail address for security reasons.";                                          
                      }                  
                  }                  
                  else
                  {
                    muestrapopup=true;
                    if ($rootScope.loc=="es")
                    {
                      var txt1="Problema de conexión";
                      var txt2="Lo sentimos, pero algo no ha ido bien.";
                    }
                    else
                      if ($rootScope.loc=="br") 
                      {
                        var txt1="Problema de conexão";
                        var txt2="Sentimos muito, algo deu errado.";                      
                      }
                      else
                      {
                        var txt1="Connection issue";
                        var txt2="Sorry, something wasn't right.";                      
                      }
                    $ionicHistory.nextViewOptions({disableBack: true});
                    $state.go('app.settings');                    
                  }               
                  // Si el error es tipo 2, lo ignora   
                  if (muestrapopup)
                    var myPopup = $ionicPopup.show({ template: '', title: txt1, subTitle: txt2, scope: $rootScope, buttons: [ { text: 'Ok' } ] });

                }

//////////////////////////                
              } 
              else  
              {
                response.ok=true;
                callback(response);
              }
            },
            function errorCallback(response) {             
              if (!$rootScope.loadingContent)
                $ionicLoading.hide();              
              if (endpoint=="/v4/recordProgress")
              {
                response.ok=false;                
                callback(response);
                return;
              }
              if (endpoint=="/v3/usr/login")
              {
                if ($rootScope.loc=="es")                      
                  $rootScope.error_login="Ha ocurrido un error conectando con el servidor, comprueba que tienes conexión a internet.";
                else
                  if ($rootScope.loc=="br")
                    $rootScope.error_login="Ocorreu um erro de conexão com o servidor. Verifique sua conexão de internet.";
                  else
                    $rootScope.error_login="An error happened connecting to the server, please check your internet connection.";    
              }
              else
                $rootScope.error_login="";
              console.log("#error ("+endpoint+") #"); 
              console.log(JSON.stringify(response));
            }
          );
        },


        doGet: function(endpoint,userInfo,callback)
        {

          console.log("# backendService : doGet #");

          // Timestamp
          // Si endpoint contiene ya un '?', se pone el timestamp con '&', si no con '?'
          if (endpoint.indexOf("?")>-1)
            var char="&"
          else
            var char="?"          
          var endpoint=endpoint+char+'timestamp='+Math.round(+new Date()/1000)
          // user_id & user_token
          if (userInfo)
          {
            endpoint=endpoint+'&user_id='+userInfo.id+'&token='+userInfo.token
          }

          console.log("* endpoint *");          
          console.log(endpoint);

          var hash = CryptoJS.HmacSHA256(endpoint.toLowerCase(), varGlobal.auth_key);
          var signature = CryptoJS.enc.Base64.stringify(hash);

          console.log("* signature *");
          console.log(signature)

          if (varGlobal.authOn)
            var config = { headers: { "Authorization" : signature } };
          else
            var config = { headers: { "X-Testing" : "testing" } };
          config.headers["X-Platform"]=$rootScope.deviceId;;
          console.log("* config *");
          console.log(config);

          $rootScope.errorValue=null;
          $http.get(varGlobal.apiURL+endpoint,config).then(
            function successCallback(response) {
              console.log("   $$$ SUCCESS $$$");      
           
              if (response.data.error) {

              $rootScope.errorValue="Error: "+response.data.error; 
              console.log("#error ("+endpoint+") #"); 
              console.log(response);             
              if (!$rootScope.loadingContent)
                $ionicLoading.hide();

                $rootScope.logout(); 
                $ionicHistory.nextViewOptions({disableBack: true}); 

                if ($rootScope.loc=="es")
                  var txt1="Problema de autentificación"
                else
                  if ($rootScope.loc=="br")
                    var txt1="Problema de autenticação";
                  else
                    var txt1="Authentification issue";

                if ($rootScope.loc=="es")                
                  var txt2="Ha sucedido un problema conectando con el backend, por favor idéntificate de nuevo.";
                else
                  if ($rootScope.loc=="br")                  
                    var txt2="O back-end reportou um problema. Volte a fazer login.";
                  else
                    var txt2="The backend reported a problem, please log in again.";

                if (!$rootScope.loadingContent)
                  $ionicLoading.hide();
                var myPopup = $ionicPopup.show({ template: '', title: txt1, subTitle: txt2, scope: $rootScope, buttons: [ { text: 'Ok' } ] }); 
                $state.go('app.settings');  
              } 
              else  
                callback(response);
            }, //this.okHandler(callback),
            function errorCallback(response) {
              console.log("   $$$ ERROR $$$");      

              if ($rootScope.loc=="es")                      
                $rootScope.errorValue="Ha ocurrido un error conectando con el servidor, comprueba que tienes conexión a internet.";
              else
                if ($rootScope.loc=="br")
                  $rootScope.errorValue="Ocorreu um erro de conexão com o servidor. Verifique sua conexão de internet.";
                else
                  $rootScope.errorValue="An error happened connecting to the server, please check your internet connection.";   

              console.log("#error ("+endpoint+") #"); 
              console.log(response);

              if (!$rootScope.loadingContent)
                $ionicLoading.hide();
            }
          );
        },

        okHandler: function(callback){
          return function(response){
            console.log("- - - - - - - okHandler - - - - - -"); 
            console.log(response.data);
            callback(response);
          }
        },

        muestraTexto: function( texto )
        {
          console.log(texto);
        },




        doGetCached: function(cacheId,endpoint,userInfo,callback,optCheckUpdates)
        {        
          if (typeof optCheckUpdates === 'undefined') 
          {
            if (varGlobal.cacheOn)
              var checkUpdates=false;
            else
              var checkUpdates=varGlobal.checkUpdates;
          }
          else
          {
            var checkUpdates=optCheckUpdates;
          }

          if (cacheId.substring(0,1)=="#") // con callback de error, sin variable global de error <- cacheAll()
          {
            cacheId=cacheId.substring(1,1000);
            var alternateError=true
          }
          else 
            var alternateError=false;

          var forceCache=$rootScope.forceCache;
          $rootScope.forceCache=false;
          console.log("# backendService : doGetCached #");

          $rootScope.errorValue=null;

          cacheId="__"+cacheId;

          if (varGlobal.cacheOn)
            console.log("### El caché está On ###");
          else
            console.log("### El cache NO está On ###");

          // Timestamp
          var endpoint=endpoint+'?timestamp='+Math.round(+new Date()/1000)
          // user_id & user_token
          if (userInfo)
          {
            endpoint=endpoint+'&user_id='+userInfo.id+'&token='+userInfo.token
          }

          var cachedResponse=null;
          if (genService.checkItem(cacheId))
          {
            var alreadyCached=true;
            console.log("### El item está en caché: ["+cacheId+"] ###");

            var trk=genService.getTrk(cacheId);
            var updated=trk.updated;

            var cachedResponse={};
            cachedResponse.data=JSON.parse(genService.getItem(cacheId));

            // Si está en modo offline (premium) y está cacheado y con checkupdates desactivado, devuelve el cache directamente
            // Si el cache es off (no premium) tanto si checkupdates esta en on como en off, tiene que continuar (acceder al backend). 
            if (varGlobal.cacheOn && !checkUpdates) 
            { 
              console.log("### NO COMPRUEBA UPDATES ###");
              cachedResponse.cacheId=cacheId;                      
              cachedResponse.ok=true;
              callback(cachedResponse);
              return;
            }

          }
          else
          {
            var alreadyCached=false;
            console.log("### El item no está en caché: ["+cacheId+"] ###");
            var updated=0;
          }
          var endpoint=endpoint+'&updated='+Math.round(updated/1000);

          console.log("* cacheId *");
          console.log(cacheId);
          console.log("* endpoint *");          
          console.log(varGlobal.apiURL);
          console.log(endpoint);

          var hash = CryptoJS.HmacSHA256(endpoint.toLowerCase(), varGlobal.auth_key);
          var signature = CryptoJS.enc.Base64.stringify(hash);

          console.log("* signature *");
          console.log(signature)

          if (varGlobal.authOn)
            var config = { headers: { "Authorization" : signature } };
          else
            var config = { headers: { "X-Testing" : "testing" } };
          config.headers["X-Platform"] = $rootScope.deviceId;;

          $http.get(varGlobal.apiURL+endpoint,config).then(
            function successCallback(response){ 
              console.log("*success*");
              console.log(response);

              // Si ya estaba en cache, si devuelve error continua con el contenido del cache, si no devuelve error, si devuelve updated==true, sustituir el cache, si no, seguir con el contenido del cache.

              if (response.data.error)
              {
                if (varGlobal.cacheOn && alreadyCached) // Solo se usa el cache cuando no puede acceder al backend si esta en modo offline (premium)
                {
                  resp=cachedResponse;
                  resp.data.updated=false;
                }
                else
                {
                  $rootScope.logout(); 
                  $ionicHistory.nextViewOptions({disableBack: true}); 
                  if ($rootScope.loc=="es")
                  {
                    var txt1="Problema de conexión";
                    var txt2="Ha ocurrido un error conectando con el servidor, comprueba que tienes conexión a internet.";                    
                  }
                  else
                    if ($rootScope.loc=="br")
                    {
                      var txt1="Problema de conexão";
                      var txt2="Ocorreu um erro de conexão com o servidor. Verifique sua conexão de internet.";                      
                    }
                    else
                    {
                      var txt1="Connection issue";
                      var txt2="An error happened connecting to the server, please check your internet connection.";                         
                    }

                  if (!$rootScope.loadingContent)
                    $ionicLoading.hide();
                  var myPopup = $ionicPopup.show({ template: '', title: txt1, subTitle: txt2, scope: $rootScope, buttons: [ { text: 'Ok' } ] }); 
                  $state.go('app.settings'); 
                  return; 
                }
              } else
                resp=response;

              if (varGlobal.cacheOn && resp.data.updated) // Si ya estaba en caché, lo actualiza independientemente de forceCache
              {
                console.log("### HA IDO BIEN : CACHEA ###");
                if (cacheId=="__conjugations")
                {
                  var totSize=0;
                  var verbs=[];

                  for (xx=0;xx<resp.data.conjugations.length;xx++)
                  {
                    verb=resp.data.conjugations[xx].verb;
                    conj=JSON.stringify({ cnj: { datos: resp.data.conjugations[xx].conj.datos } });
                    genService.setItem("__conjugation_"+verb,conj);
                    verbs.push(verb)
                    totSize=totSize+conj.length
                  }  
                  genService.setItem(cacheId,JSON.stringify({ data: verbs , size: totSize })); 
                }
                else
                {           
                  if (cacheId.substring(0,7)=="__tests" && cacheId!="__testslist")
                  {
                    var list=[];
                    var totSize=0;
                    for (var idx=0; idx<resp.data.tests.length;idx++)
                    {
                      //console.log(resp.data.tests[idx].test_id);
                      var test_id=resp.data.tests[idx].test_id;
                      var key="__test"+test_id;
                      var val=JSON.stringify(resp.data.tests[idx].datos);
                      genService.setItem(key,val);
                      list.push(test_id);
                      totSize=totSize+val.length;
                    }
                    genService.setItem(cacheId,JSON.stringify({ data: list , size: totSize })); 
                  }                                                               
                  else
                  {              
                    if (forceCache || alreadyCached)
                    {
                      if (alreadyCached)
                        console.log("### ACTUALIZA CACHE ###");
                      var cId=cacheId;
                    }
                    else
                      var cId="__cacheTmp";
                    console.log(cId);                    
                    genService.setItem(cId,JSON.stringify(resp.data));
                  }
                }

              } 
              else 
              { 
                console.log("### HA IDO BIEN : NO CACHEA ###")
                if (!resp.data.updated)
                {
                  if (cachedResponse)
                  {
                    console.log("### TOMA EL VALOR DE CACHE ###")
                    resp=cachedResponse;
                    resp.data.updated=false;
                  }
                }
              }  
              console.log(resp);              
              $rootScope.errorValue=null;
              resp.cacheId=cacheId;              
              resp.ok=true;              
              callback(resp);
            },
            function errorCallback(response)           
            {
              console.log("#error ("+endpoint+") #"); 
              console.log(endpoint);
              console.log(JSON.stringify(response));
              if (!$rootScope.loadingContent)              
                $ionicLoading.hide();              
              if (alternateError) // Llamado desde cacheAll()
              {
                response.cacheId=cacheId;    
                response.ok=false;          
                callback(response);         
              }
              else
              {
                if (varGlobal.cacheOn && alreadyCached) // Si no esta en modo offline (premium) aunque esté en cache ha de mostrar el error si ha petado
                {
                  console.log("### DEVUELVE EL VALOR DE CACHE ###");
                  resp=cachedResponse;
                  resp.data.updated=false;
                  resp.ok=true;          
                  callback(resp);     
                }
                else
                {
                  if ($rootScope.loc=="es")                      
                    $rootScope.errorValue="Ha ocurrido un error conectando con el servidor, comprueba que tienes conexión a internet.";
                  else
                    if ($rootScope.loc=="br")
                      $rootScope.errorValue="Ocorreu um erro de conexão com o servidor. Verifique sua conexão de internet.";
                    else
                      $rootScope.errorValue="An error happened connecting to the server, please check your internet connection.";                    
                }
              }
              
            }
          );
        }        

    }
})
