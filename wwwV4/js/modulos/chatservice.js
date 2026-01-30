
angular.module('starter.chatservice', [])

.factory('ChatService', function (varGlobal,loc,chat, $http, $rootScope, AuthService, genService, $ionicLoading, $ionicPopup) { // Esta 'factory' accede al 'value' varGlobal y al 'value' 'chat'
    return {
        Prepare: function(userInfo){
          $rootScope.messages={};
          $rootScope.channels=[];
          $rootScope.chatlist={};
          if (userInfo){        
            // Si existen en localStorage variables que empiecen por 'messages-'+userInfo.id, se han de crear items de $rootScope.channels, $rootScope.chatlist y $rootScope.messages          
            console.log("%%%%%%");
            var pfx="messages-"+userInfo.id;
            for (var i = 0; i < localStorage.length; i++){
                var name=localStorage.key(i);
                if (name.substring(0,pfx.length)==pfx)
                {      
                  console.log(">"+name);
                  var channel=name.substring(pfx.length+1)
                  console.log(channel);
                  var name2="chatlist-"+userInfo.id+"-"+channel
                  console.log(name2);
                  if (name2 in localStorage) // Puede pasar que exista la entrada de localStorage 'messages-100008-private-697037_100008' pero no la 'chatlist-100008-private-697037_100008'
                  {
                    // Añadir messages
                    $rootScope.messages[channel]=JSON.parse(window.localStorage.getItem(name))
                    if ($rootScope.messages[channel].length<1)
                    {
                      var lastChat="";
                      var lastUser="";
                      var lastUpdated="";
                    }
                    else
                    {
                      var lastmessage=$rootScope.messages[channel][$rootScope.messages[channel].length-1];
                      var lastChat=lastmessage.text;
                      var lastUser=lastmessage.userName;
                      var lastUpdated=lastmessage.lastUpdated;
                    }
                    // Añadir chatlist
                    $rootScope.chatlist[channel]=JSON.parse(window.localStorage.getItem(name2))
                    // Añadir channel
                    var caption=$rootScope.chatlist[channel][0].name;
                    var img=$rootScope.chatlist[channel][0].img;
                    console.log(caption)
                    //badge inicializado
                    // A los que se recuperan de localStorage se les inicializa el campo lastUser para que aparezcan en la lista de chats, incluso si no ha llegado a haber conversación
                    // -> Creados desde 'añadir a favoritos'
                    $rootScope.channels.push({name:channel,type:2,state:0,badge:0, muted:false,caption:caption,img:img, lastChat:lastChat, lastUser:caption, lastUpdated:lastUpdated});                                      
                  }
                  else
                  {
                    // Elimina la entrada desaparejada
                    console.log("* eliminar de localStorage: ["+name+"]")
                    localStorage.removeItem(name);
                  }
                }
            } 
            console.log("%%%%%%");
          }      
          $rootScope.currentChannel="";
          $rootScope.inListChat=false;
          $rootScope.inChat=false;
          $rootScope.chatState="???";          
          $rootScope.mainBadge=0;
        },

        Init: function(){                 
          console.log("");
          console.log("### ChatService:Init ###");
          var d=new Date();
          chat.lastActivity=d.toGMTString();
  
          chat.publicChannelName="site-wide-chat-channel";              
          chat.privatesChannelName="private_chat";
          chat.oficial={};
          var loc=localStorage.getItem("locale");
          if (loc=="es")
            var cap="Estudiantes";
          else
            if (loc=="br")
              var cap="Estudantes"
            else
              var cap="Students";
          chat.oficial[chat.publicChannelName]={caption:cap,img:"assets/oficial.png"};
          var user_info = chat.currentUser;
          console.log("=====>");
          console.log(JSON.stringify(chat.currentUser));
          console.log("");
          user_info.origen=chat.page;
          user_info.premium=$rootScope.premium;    
          user_info.ver=genService.deviceId()

          if (chat.currentUser.id!=-1)
          {
            
            //chat.pusher = new Pusher('b74ebb075eea8a8e3ab0', { encrypted: true, authEndpoint: varGlobal.chatURL+'/chats/auth', authTransport: 'jsonp', auth : { params : user_info }} );
            chat.pusher = new Pusher('b74ebb075eea8a8e3ab0', { encrypted: true, authEndpoint: varGlobal.apiPRO + '/chats/auth_v2', auth : { params : user_info } } );

            chat.pusher.connection.bind('state_change', chat_stateChange); // Definido en appCtrl como window.chat_stateChange
            
            chat.presenceChannel = chat.pusher.subscribe("presence-"+chat.publicChannelName);

            chat.presenceChannel.bind('pusher:subscription_succeeded', function(data){ chat_presenceSubscription(chat.publicChannelName,data) });
            chat.presenceChannel.bind('pusher:member_added', function(data) { chat_memberAdded(chat.publicChannelName,data) });
            chat.presenceChannel.bind('pusher:member_removed', function(data) { chat_memberRemoved(chat.publicChannelName,data) });

            chat.publicChannel = chat.pusher.subscribe(chat.publicChannelName);
            chat.publicChannel.bind('pusher:subscription_succeeded', chat_channelSubscription(chat.publicChannelName));  
            chat.publicChannel.bind('chat_message', function(data) { chat_chatMessage(chat.publicChannelName,data) });            
            chat.publicChannel.bind('user_ignore', function(data) { chat_userIgnore(chat.publicChannelName,data) });
            chat.publicChannel.bind('member_kicked', function(data) { chat_userKick(chat.publicChannelName,data) });
            chat.publicChannel.bind('ping', function(data) { chat_userPing(chat.publicChannelName,data) });
            chat.publicChannel.bind('private_chat', function(data) { chat_privateChat(data) });
            chat.publicChannel.bind('destroy_private_chat', function(data) { chat_destroy_privateChat(data) });         
          }
          else
          {
            $rootScope.chatState="connected";

            var canal=chat.publicChannelName;

            var type=1; // Oficial
            var caption=chat.oficial[canal].caption;
            var img=chat.oficial[canal].img
            var name=canal;

            $rootScope.channels=[];

            // Que contenga algo en lastUser garantiza que aparezca en la lista de chats
            $rootScope.channels.push({name:name,type:type,state:1,badge:0, muted:false,caption:caption,img:img, lastChat:"", lastUser: "Public", lastUpdated:""});

            if (typeof $rootScope.messages[canal] == "undefined")
            {
              console.log("*** INICIALIZA ***")
              $rootScope.messages[canal]=[];
            }
            else
              console.log("*** NO INICIALIZA ***");
                        


            if(!$rootScope.$$phase) {
              $rootScope.$apply(function() {     
                  $rootScope.channels[0].state=1; // Conectado
              });   
            }
            else
              $rootScope.channels[0].state=1; // Conectado

          }

        },

        Destroy: function(){
          console.log("");
          console.log("### ChatService : Destroy ###");
          
          for (i=0;i<$rootScope.channels.length;i++)
          {
            if ($rootScope.channels[i].type==2) //Privado
              $rootScope.channels[i].state=0; //Desconectado
          }

          if (chat.pusher!=undefined)
          {

            var channels=chat.pusher.allChannels();
            Object.keys(channels).forEach(function(key,index) {
              var k=channels[index];
              console.log("### ChatService: channel ("+index+") ["+k.name+"]");
              var channel=chat.pusher.channel(k.name);
              channel.unbind_all();
              channel.disconnect();
            });

            console.log("### ChatService: disconnect() ###");
            chat.pusher.disconnect();
            delete chat.pusher;            
          }

        },

        getUserById: function(user_id)
        {
          c=-1;
          for(i=0;i<$rootScope.chatlist[chat.publicChannelName].length;i++)
          {
            if ($rootScope.chatlist[chat.publicChannelName][i].id==user_id)
              c=i;
          }
          return c;
        },

        getUserIdFromChannel: function(channel)
        {
          var p=channel.indexOf("_");
          var u1=parseInt(channel.substring(8,p));
          var u2=parseInt(channel.substring(p+1,100));
          if (u1==chat.currentUser.id)
            var user2_id=u2;
          else
            var user2_id=u1;       
          return user2_id;
        },


        userRaw: function( info )
        {                     
          info.lastChat = "";
          info.lastUpdated = "";
          info.badge = 0;
          info.estado = 0;

          if ( info.progress_image )
          {
            if ( info.progress_image.substring( 0, 6 ) == "assets" )
            { 
              // assets/course4.png
              var progress_course=parseInt( info.progress_image.substring( 13, 100 ).split(".")[0] );
            }
            else
            {
              // https://s3.amazonaws.com/sk.CursoIngles/courseicons/00004.png
              var progress_course = parseInt( info.progress_image.substring( 52, 57 ) );
            }
            info.progress_image = "assets/course" + progress_course + ".png";
          }

          if (info.img && info.img.substring( 0, 7 ) == "/assets" )
            info.img = info.img.substring( 1, 1000 );

          // Llamar para cada usuario se podria optimizar, la lista de amigos podria venir como parametro.
          var userInfo = AuthService.getUserInfo();
          if ( !userInfo )
          {
            info.friend = false;
            info.ignored = false;
            info.ignoringMe = false;
          }
          else
          {
            if ( userInfo.friends[ info.id ] )
              info.friend = true;
            else
              info.friend = false;
            if ( userInfo.ignored[ info.id ] )
              info.ignored = true;
            else
              info.ignored = false;
            if ( userInfo.ignoringMe[ info.id ] )
              info.ignoringMe = true;
            else
              info.ignoringMe = false;
          }

          return info;
        },

        removeUser: function (info){
          var c=this.findUser(info.id);
          if (c)
            chat.activeUsers.splice(c,1);
        },

        findUser: function(id){
          ret=null;
          var n=chat.activeUsers.length;
          for (i=0;i<n;i++)
          {
            if (chat.activeUsers[i].id==id)
              ret=i;
          }
          return ret;
        },

        IncrementaContador: function () {
          varGlobal.contador++;
          console.log("*Hola*",varGlobal.contador);
        },

        GetActiveUsers: function () {
          return chat.activeUsers;
        },

        SetActiveUsers: function (users) {
          this.activeUsers=users;
        },

        activeUsers: [],

        prueba: "inicial",

        setPrueba: function(texto){
          this.prueba=texto;
        },

        doPOST: function(endpoint,data,userInfo,callback,errorPopUp) {

          console.log("# chatService : doPOST #");

          //console.log(data);
          //console.log(userInfo);          

          if (!data)
            data={}

          // Timestamp
          var timestamp=Math.round(+new Date()/1000);
          data["timestamp"]=timestamp;

          if (userInfo)
          {
            data["user_id"]=userInfo.id;
            data["token"]=userInfo.token;
          }       

          console.log("* endpoint *");          
          console.log(endpoint);

          console.log("* data *");
          console.log(data);

          if (userInfo)
            var hash = CryptoJS.HmacSHA256(endpoint.toLowerCase()+"?timestamp="+timestamp+"&user_id="+userInfo.id+"&token="+userInfo.token, varGlobal.auth_key);
          else
            var hash = CryptoJS.HmacSHA256(endpoint.toLowerCase()+"?timestamp="+timestamp, varGlobal.auth_key);
          var signature = CryptoJS.enc.Base64.stringify(hash);

          console.log("* signature *");
          console.log(signature)

          if (varGlobal.authOn)
            var config = { headers: { "Authorization" : signature }, "rejectUnauthorized": false };
          else
            var config = { headers: { "X-Testing" : "testing" } };
          config.headers["X-Platform"]=$rootScope.deviceId;

          console.log("* config *");
          console.log(config);

          $http.post( varGlobal.apiPRO + endpoint, data, config ).then(
            function successCallback(response){
              console.log("# OK #");
              callback(response);
            } // callback
            ,
            function errorCallback(response) {
              console.log("# NO OK #");
              if (!$rootScope.loadingContent)
                $ionicLoading.hide();
              console.log("# request ("+varGlobal.aiPRO+") ("+endpoint+") ("+JSON.stringify(data)+") ("+JSON.stringify(config)+") #"); 
              console.log("# response # >>>>>");
              if ((typeof response)=="string")
                console.log(response);
              else
                console.log(JSON.stringify(response));
              console.log("<<<<< # response #");
              if (errorPopUp)
              {
                if ($rootScope.loc=="es")
                  var txt1="Problema de conexión";
                else 
                  if ($rootScope.loc=="br") 
                    var txt1="Problema de conexão";
                  else
                    var txt1="Connection issue";
                    
                if ($rootScope.loc=="es")
                  var txt2="Lo sentimos, algo no fue bien. Comprueba tu conexión con Internet.";
                else
                  if ($rootScope.loc=="br")  
                    var txt2="Sentimos muito, algo deu errado. Verifique sua conexão de internet.";
                  else
                    var txt2="Sorry, something wasn't right. Please check your internet connection.";

                var myPopup = $ionicPopup.show({ template: '', title: txt1, subTitle: txt2, scope: $rootScope, buttons: [ { text: 'Ok' } ] });    
              }
            });
        
          },

          getUserList: function() {
            console.log("* getUSerList *");

            var canal=chat.publicChannelName;
            $rootScope.chatlist[canal]=[];

            var endpoint="/chats/userlist";
            var config="";
            $http.get( varGlobal.apiPRO + endpoint, config ).then(function okCallback(response){ 
              console.log("#ok#");
              members=response.data.activeUsers; 
              console.log(members);
              for (i=0;i<members.length;i++){
                var info=members[i];

                if (info.progress_image.substring(0,6)=="assets")
                { 
                  // assets/course4.png
                  var progress_course=parseInt( info.progress_image.substring(13,100).split(".")[0] );
                }
                else
                {
                  // https://s3.amazonaws.com/sk.CursoIngles/courseicons/00004.png
                  var progress_course=parseInt( info.progress_image.substring(51,56) );
                }
                info.progress_image="assets/course"+progress_course+".png";

                var hidden=false;
                if (typeof(info.hidden)=="string")
                  hidden=(info.hidden=="true");
                else
                  hidden=info.hidden;

                premium=info.premium;

                info.hidden=hidden;
                info.premium=premium;
                info.lastChat="";
                info.lastUpdated="";
                info.badge=0;
                info.estado=0;
                info.img=info.avatar;
                if (info.img && info.img.substring(0,7)=="/assets")
                  info.img=info.img.substring(1,1000);            
                info.friend=false;
                info.ignored=false;
                info.ignoringMe=false;
                info.id=info.email;
                info.mail=info.email;
                info.style=info.estilo;
                //console.log(info);
                $rootScope.chatlist[canal].push(info);
              }  


            },function errorCallback(response) {console.log("#error ("+endpoint+") #"); console.log("@@@@@"), console.log(JSON.stringify(response)); console.log("@@@@@"); });

          }

    }
})
// <<< .factory 'ChatService'


