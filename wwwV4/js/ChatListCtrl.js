angular.module('starter').controller('ChatListCtrl', function($scope, $rootScope, $state, $stateParams, AuthService, ChatService, varGlobal, chat, $timeout, $ionicScrollDelegate, $ionicPopover, $ionicListDelegate, $ionicLoading,$ionicPopup, $ionicActionSheet, adsService, $ionicHistory, genService) {

  genService.logEvent("ChatList");

//  adsService.showInterstitial(AdMob);



  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) {
    console.log("*ChatListCtrl*");

    console.log($rootScope.channels);
    
    genService.viewTrack(JSON.stringify({name:$ionicHistory.currentStateName(),params:$stateParams}));

    if(chat.pusher==undefined)
      ChatService.Init();
    console.log("<<< inListChat=true >>>");  
    $rootScope.inListChat=true;  
    $rootScope.inChat=false;

    // Si sólo hay un canal, ir a él directamente
    console.log($rootScope.channels.length);
    if ($rootScope.channels.length==1)
    {
      console.log($rootScope.channels[0]);
        $ionicHistory.nextViewOptions({
          disableAnimate: true ,
          disableBack: true
        });

      $state.go("app.chats",{ channel: $rootScope.channels[0].name });
    }
  
  });

  $scope.$on('$ionicView.beforeEnter', function(){
    $rootScope.viewTitle=$rootScope.i18n[$rootScope.loc]["chats"];    
  });

  $scope.$on('$ionicView.beforeLeave', function(){
    console.log("<<< inListChat=false >>>");
    $rootScope.inListChat=false;
  });


//$rootScope.currentChannel=chat.publicChannelName;  

//  $ionicPopover.fromTemplateUrl('my-popover1.html', {
//    scope: $rootScope,
//    animation: 'slide-in-up'
//  }).then(function(popover) {
//    $rootScope.popover = popover;
//  });


  $scope.showOptions=function(item){
    console.log("* showOptions *");
    console.log(item);

    if ($rootScope.loc=="en")
      var isEng=true
    else
      var isEng=false

    var channel=item.name;

    if (item.muted)
      var siltxt= (isEng) ? "Unmute" : "No silenciar"
    else
      var siltxt= (isEng) ? "Mute" : "Silenciar"
      

    if (item.type==1) // Oficial
    {
      var buttons= [
        { text: siltxt },
      ]      
    }
    else
    {

      var p=channel.indexOf("_");
      var u1=parseInt(channel.substring(8,p));
      var u2=parseInt(channel.substring(p+1,100));
      if (u1==chat.currentUser.id)
        var user2_id=u2;
      else
        var user2_id=u1;    



      if ($scope.userInfo.ignored[user2_id])
        var txt1=(isEng) ? "Unblock user" : "Desbloquear usuario"
      else
        var txt1=(isEng) ? "Block user" : "Bloquear usuario"

//      if ($scope.userInfo.friends[user2_id])
//        var txt2=(isEng) ? "Unmark as favorite" : "Desmarcar como favorito"
//      else
//        var txt2=(isEng) ? "Mark as favorite" : "Marcar como favorito"


      var buttons= [
        { text: siltxt },
        { text: (isEng) ? 'User info' : 'Información usuario' },
        { text: txt1 },
//        { text: txt2 }
      ]
    }

    if (item.type==1) //Oficial
      destruc="";
    else
    {
      if (item.state==1) //Conectado
        destruc=(isEng) ? "Close" : "Cerrar";
      else
        destruc=(isEng) ? "Delete" : "Eliminar";
    }

    var hideSheet = $ionicActionSheet.show({
      buttons: buttons,
      destructiveText: destruc,
      titleText: item.caption,
      cancelText: (isEng) ? 'Cancel' : 'Cancelar',
      cancel: function() {
          console.log("* cancel *");
      },
      buttonClicked: function(index2) {
        console.log("* buttonClicked *");
        console.log(index2);
        if (index2==0)
          {
            for(i=0;i<$rootScope.channels.length;i++)
            {
              if ($rootScope.channels[i].name==item.name)
                $rootScope.channels[i].muted=!$rootScope.channels[i].muted;
            }
          }
        if (index2==1)
        {
          $state.go("app.settings",{ id: user2_id });
        }

        if (index2==2)
        {
          console.log("*bloquear*");
          $rootScope.ignoreUser(user2_id);
        }

        if (index2==3)
        {
          console.log("favorito*");
          if ($scope.userInfo.friends[user2_id])
          {
            var txt1 = ( $rootScope.loc=="en" ) ? "Warning" : "Atención";
            var txt2 = ($rootScope.loc=="en") ? "Remove from favorites (not yet implemented)." : "Quitar de favoritos (sin implementar).";
            var myPopup = $ionicPopup.show( { template: '', title: txt1, subTitle: txt2, scope: $rootScope, buttons: [ { text: 'Ok' } ] } );
          }
          else
          {
            var txt1 = ( $rootScope.loc=="en" ) ? "Warning" : "Atención";
            var txt2 = ($rootScope.loc=="en") ? "Add to favorites (not yet implemented)." : "Añadir a favoritos (sin implementar).";
            var myPopup = $ionicPopup.show( { template: '', title: txt1, subTitle: txt2, scope: $rootScope, buttons: [ { text: 'Ok' } ] } );
          }
        }
 
        return true;
      },
      destructiveButtonClicked: function() {
        console.log("* destructiveButtonClicked *");
        $rootScope.closePrivate(channel);
        // Si es desconectar, se lanza la petición de desconexión al backend (en su momento se recibirá el mensaje de desconexión del canal y se procederá en consecuencia)
        // Si es eliminar, se elimina el canal de la lista de canales y de la lista de mensajes
        return true;
      }
    });

  }




})


