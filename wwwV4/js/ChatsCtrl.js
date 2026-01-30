angular.module('starter').controller('ChatsCtrl', function($scope, $rootScope, $state, $stateParams, AuthService, ChatService, varGlobal, chat, $timeout, $ionicScrollDelegate, $ionicPopover, $ionicListDelegate, $ionicLoading,$ionicPopup, $ionicHistory, adsService, genService) {

  genService.logEvent('Chat ' + $stateParams.channel);
  
  console.log("* ChatsCtrl *");

  if ($rootScope.loc=="es")
  {
    $scope.txt1='La conversación ha sido cerrada.';
    $scope.txt2='Abrir';
    $scope.txt3='El usuario no está conectado.';
    $scope.txt4='Conectando ...';
  }
  else
    if ($rootScope.loc=="br")
    {
      $scope.txt1='Bate-papo foi fechado.';
      $scope.txt2='Abrir';
      $scope.txt3='Usuário não conectado.';
      $scope.txt4='Conectando ...';
    }
    else
    {
      $scope.txt1="Chat closed.";
      $scope.txt2="Open";
      $scope.txt3='User is not connected.';
      $scope.txt4='Connecting ...';
    }

  console.log("<<< inChat=true 1>>>");
  $rootScope.inChat=true;

  window.focusControl=true;  

  $scope.dbg=function(){
    console.log("* dbg *");
    console.log($rootScope.messages);
  }


$scope.recarga=function(){
  if (window.paused)
    console.log("* paused: no recarga *");
  else
  {
    console.log("* recarga *");

    ChatService.getUserList();

    var canal=chat.publicChannelName;
    console.log("* antes de getLastChats *");
    $rootScope.userInfo=AuthService.getUserInfo();
    $ionicLoading.show();
    ChatService.doPOST('/v4/getLastChats',{"user_id":chat.currentUser.id,"channel":canal},$rootScope.userInfo,function(result) {      
      console.log("* dentro de getLastChats *");
      $ionicLoading.hide();
      console.log('* getLastChats returned value *');
      console.log(canal);
      console.log(result);
      //console.log("------------------");
      //console.log($rootScope.messages[canal].length);
      //console.log($rootScope.messages[canal]);
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

        var l=$rootScope.messages[canal].length-1;
        var esta=false;
        for(ii=0;ii<=l;ii++)
        {
          if ($rootScope.messages[canal][ii].userId==r.user_id && $rootScope.messages[canal][ii].text.includes(d.body))
            esta=true;
          //console.log(" ",$rootScope.messages[canal][ii].message_id,esta)
        }
        //console.log(esta,d.message_id,d.body);

        if (!esta) 
        {
          //console.log("* el mensaje no esta *");
          //console.log(d.body);
          $rootScope.textIn(canal,d);
        }
        else
        {
          //console.log(d.body);
          //console.log("* El mensaje esta *");
        }


      }
      //console.log("------------------");

    });
    console.log("* después de getLastChats *");

    $timeout(function() { $ionicScrollDelegate.$getByHandle('mainScroll').scrollBottom(true); }, 500); 

  }

  $scope.temporizador=$timeout($scope.recarga,15000);
}


/////
  $scope.assign=function()
  {
    console.log("<<< inChat=true 2>>>");
    $rootScope.inChat=true;
    $rootScope.currentChannel=$scope.channel;  
    $scope.user2_id=null; // Lo asigna en el bucle a continuación

    for (i=0;i<$rootScope.channels.length;i++)
    {
      if ($rootScope.channels[i].name==$scope.channel)
      {
        $scope.channelName=$rootScope.channels[i].caption;
        $scope.channelIdx=i;
        // Inicializar badge canal
        if ($rootScope.channels[i].badge>0)
        {
          $rootScope.mainBadge=$rootScope.mainBadge-$rootScope.channels[i].badge;
          $rootScope.channels[i].badge=0;
        }
        if ($rootScope.channels[i].type==2) //privado
        {
          // Inicializar badge usuarios
          var p=$scope.channel.indexOf("_");
          var u1=parseInt($scope.channel.substring(8,p));
          var u2=parseInt($scope.channel.substring(p+1,100));
          if (u1==chat.currentUser.id)
            var user2_id=u2;
          else
            var user2_id=u1;
          console.log(user2_id);

          if ($rootScope.chatlist[chat.publicChannelName]) // Si existe el canal publico en chatlist (si no ha llegado a conectarse, no existe)
          {
            c=-1;
            for(j=0;j<$rootScope.chatlist[chat.publicChannelName].length;j++)
            {
              if ($rootScope.chatlist[chat.publicChannelName][j].id==user2_id)
                c=j;
            }
            if (c>-1)
              $rootScope.chatlist[chat.publicChannelName][c].badge=0;
          }

          $scope.user2_id=user2_id;
        }
      }
    }

    console.log("-------- assign ---------------")
    console.log($scope.channelName);
    console.log($rootScope.currentChannel);
    console.log($scope.channelIdx);
    console.log("-------------------------------")
  }
  /////  



  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) // por aquí pasará cada vez que se tenga que recargar(cacheada o no, ojo (si es cacheado no 'refresca pantalla', por ejemplo al cambiar de opción de menu (solo si se cambia) y al pulsar el botón de login)
  {
    console.log("*** chatsCtrl : beforeEnter ***")

    if ( AdMob && window.adsOn ) {
      (async () => {
        await adsService.hideBanner();
      })();
    }

    console.log($stateParams.channel);
    
    $scope.assign(); // Parece redundante por que ya se llama en el propio controller

    console.log(" @@@@@@@@@")
    console.log($scope.channelIdx);
    console.log($rootScope.channels[$scope.channelIdx].state)
    console.log(" @@@@@@@@@")

    if ($rootScope.channels[$scope.channelIdx].state==0)
    {                                                          
      //var element = angular.element(document.querySelectorAll('header-item')); // 'ion-side-menu-content ion-header-bar'
      var element = angular.element(document.getElementsByClassName('header-item title')); 
      console.log(element)
      element.addClass('canal_desconectado')
    }

    $ionicScrollDelegate.$getByHandle('mainScroll').scrollBottom(true)

    $rootScope.viewTitle=$scope.channelName

  })




  $scope.$on('$ionicView.beforeLeave', function(){
    // ws - Desconexión
    //  ws.close();
  })



  $scope.$on('$ionicView.enter', function(){
      
    console.log("*** chatsCtrl : enter ***")

    // Para que no se cierre el teclado al pulsar el enter que incorpora.
    // Si le das al botón send si que se cierra, por que el teclado pierde el focus
    // (Por tanto el botón se podria quitar estando esto)
    document.getElementById('focusMe').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // Evita salto de línea
        document.getElementById('sendButton').click(); // Simula el click
      }
    });

    // ws - Conexión
    $scope.timerID = null
    ws_chat = function()
    {
      function handleMessage(data) 
      {
        console.log("\n* ws: message: ",data)
        console.log("")
      }
      function handleOpen(data)
      {
        if($scope.timerID){ /* a setInterval has been fired */
           $scope.clearInterval($scope.timerID)
           $scope.timerID = null
        }
        console.log("\n* ws: open: ",data)
        console.log("")
        ws.send(JSON.stringify({"cmd":"login","user":chat.currentUser}))
      }
      function handleError(err) {
        console.log("\n* ws: error: "  ,err)  
        console.log("")
        //$scope.clearInterval(window.timerID)
        //$scope.timerID=setTimeout(function(){ws_chat()}, 5000)
      }
      function handleClose(e) {
        console.log("\n* ws: close: "  ,e)
        console.log("")
        //$scope.clearInterval(window.timerID)
        //$scope.timerID=setTimeout(function(){ws_chat()}, 5000)
      }
      ///
      ws = new WebSocket("wss://comm1.curso-ingles.com")
      ws.onmessage = handleMessage
      ws.onopen = handleOpen
      ws.onerror = handleError
      ws.onclose = handleClose
    }

    if ($stateParams.channel==chat.publicChannelName)
    {
      var _flash03=window.localStorage.getItem("_flash03")
      if (!_flash03)  
      {
        setTimeout(function () {
          console.log("* Activa flash03 *")
          if(!$scope.$$phase) {
            $scope.$apply(function() {
              $rootScope.flash03 = true
            })
          }
          else
          {
            $rootScope.flash03 = true
          }
        }, 500)
      }
    }

  })


  $scope.$on('$ionicView.afterEnter', function(){

    console.log("*** chatsCtrl : afterEnter ***")
    console.log("<<< inChat=true 3>>>")
    $rootScope.inChat=true

    if (!$scope.userInfo)
    {
      $scope.recarga()
    }

  })



  $scope.$on('$ionicView.beforeLeave', function(){
    console.log("*** chatsCtrl : beforeLeave ***")

    if ( AdMob && window.adsOn ) {
      (async () => {
        await adsService.showBanner();
      })();
    }

    $rootScope.flash03 = false
    console.log("* Desactiva flash03 *")

    console.log("<<<* inChat=false *>>>")
    $rootScope.inChat=false
    
    if ($rootScope.channels[$scope.channelIdx].state==0)
    {
      var element = angular.element(document.getElementsByClassName('header-item title'))
      console.log(element)
      element.removeClass('canal_desconectado')
    }
    /////////////////////////////////////////// OJO //////////////    
    //$rootScope.currentChannel=""
    
    $timeout.cancel($scope.temporizador)

  })

  $scope.channel=$stateParams.channel

  $scope.assign() // Si no se llama a assign, no se ven los titulos de los chats (parece redundante por que ya se le llama en beforeEnter)

  $scope.data = {}


  $scope.send2=function()
  {
    console.log("* send2 *")
  }


  $scope.sendMessage = function() {

    console.log("* sendMessage *")
    
    focus('focusMe')

    var d=new Date()
    chat.lastActivity=d.toGMTString()

    if (!$scope.data.message || $scope.data.message.length<2)
      return

    if (!$scope.userInfo)
    {
      return
    }

    if ($scope.userInfo.banned)
    {
      if ($rootScope.loc=="en")      
        var myPopup = $ionicPopup.show({ template: '', title: "Warning", subTitle: "You are banned.", scope: $scope, buttons: [ { text: 'Ok' } ] })
      else
        var myPopup = $ionicPopup.show({ template: '', title: "Atención", subTitle: "Estás baneado.", scope: $scope, buttons: [ { text: 'Ok' } ] })

      return
    }
    
    console.log($scope.userInfo.ignoringMe)
    console.log($scope.user2_id)
    if ($scope.userInfo.ignoringMe[$scope.user2_id])
    { 
      if ($rootScope.loc=="es")
      {
        var txt="El usuario te ha bloqueado"
        var txt2="Atención"
      }
      else
        if ($rootScope.loc=="br")
        {
          var txt="O usuário bloqueou você"
          var txt2="Advertência"
        }
        else
        {
          var txt="User has blocked you"
          var txt2="Warning"
        }
      var myPopup = $ionicPopup.show({ template: '', title: txt1, subTitle: txt2, scope: $rootScope, buttons: [ { text: 'Ok' } ] })
      return
    }

    var chatInfo = {
      channel: $rootScope.currentChannel,
      user_id : chat.currentUser.id,
      nickname : chat.currentUser.name,
      email : chat.currentUser.email,
      image: chat.currentUser.avatar,
      style: chat.currentUser.estilo,
      text : $scope.data.message,
      token : $scope.userInfo.token
    }

    $ionicLoading.show()
    ChatService.doPOST('/v4/sendMessage',chatInfo,$scope.userInfo,function(result) {
      console.log("* dentro de sendMessage *")
      //stopSpinner()
      $ionicLoading.hide()
      console.log('* sendMessage returned value *')
      console.log(result)
    },true)
    console.log("* después de sendMessage *")

    delete $scope.data.message

  }

  // El del icono de la derecha del titulo
  $scope.userClick = function(user2_id)
  {
    console.log("* userClick *")

    window.focusControl = false

    if ( (typeof Keyboard != "undefined") && (typeof Keyboard.hide != "undefined") ) Keyboard.hide()

    console.log(user2_id)

    $timeout(function() {
      $state.go("app.settings",{ id: user2_id })
    }, 100)

  }


  // El del item del timeline
  $scope.userClick2=function(user2_id)
  {
    console.log("* userClick2 *")
    if ($scope.channels[$scope.channelIdx].type!=1 || !$scope.userInfo) // Si es un privado o no está logueado, no hace nada
    {
      console.log("* privado o no logueado -> Nada. *")
      return
    }

    window.focusControl=false

    if ( (typeof Keyboard != "undefined") && (typeof Keyboard.hide != "undefined")  ) Keyboard.hide()

    console.log(user2_id)

    $rootScope.openPrivate(user2_id)

  }

  $scope.reopen=function()
  {
    $rootScope.openPrivate($scope.user2_id)
  }

  $scope.onLine=function(){
    var ret=false
    //console.log("*onLine*")
    if ($rootScope.chatlist[chat.publicChannelName])
    {
      for(i=0;i<$rootScope.chatlist[chat.publicChannelName].length;i++)
      {
        if ($rootScope.chatlist[chat.publicChannelName][i].id==$scope.user2_id)
          ret=true
      }
    }
    return ret
  }

})

