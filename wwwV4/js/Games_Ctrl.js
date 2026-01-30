
angular.module('starter')
.controller('gamesCtrl', function($scope, $rootScope, $state, $ionicSideMenuDelegate, $location, $ionicLoading, backendService, adsService, $ionicHistory, $stateParams, genService) {

  genService.logEvent("Games");

  adsService.showInterstitial(AdMob);

  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) 
  {
    genService.viewTrack(JSON.stringify({name:$ionicHistory.currentStateName(),params:$stateParams})); 
  });


  $scope.$on( "$ionicView.beforeLeave", function( scopes, states ) 
  {
    $rootScope.errorValue=null;
  });



  $scope.test="Cargando ..."

  $scope.quotes =[];
  console.log("* antes de getGames *");
  $ionicLoading.show();
  backendService.doGet('/v3/games',$scope.userInfo,function(result) {
    console.log("* dentro de getGames *");
    $ionicLoading.hide();
    console.log('* getGames returned value *');
    console.log(result);
    //console.log(result.courses);
    // result.error contiene el mensaje de error si lo hay
    $scope.test="";
    $scope.games=result.data.games;


  });
  console.log("* después de getGames *");  

  $scope.goGame=function(index){
    console.log("* goGame *");
    console.log(index);
    var params = angular.toJson($scope.games[index]);
    $state.go("app.game",{ params: params });
  }

})  

.controller('gameCtrl', function($scope, $state, $stateParams, $sce, $ionicHistory, $window, genService) {


console.log("**********");
console.log(angular.element($window));
console.log("**********");

angular.element($window).bind('resize', function () {
    console.log(".....")

    var w=$window.innerWidth;
    var h=$window.innerHeight;
    console.log((w)+" x "+(h));
    
    
    var el=angular.element(document.getElementById("gameContainer"));
    console.log(el.prop('offsetWidth'));
    w=el.prop('offsetWidth')-20;


    var el=angular.element(document.getElementById("gameFrame"));
    el.css('width', (w)+'px');    
    el.css('height', (w*220/360)+'px');    

    console.log(".....")
});



  if (window.ga) window.ga.trackView('Game '+angular.fromJson($stateParams.params));
  if (typeof window.FirebasePlugin!="undefined") window.FirebasePlugin.logEvent('Game '+angular.fromJson($stateParams.params), {uuid: uuid});

//console.log("* game *");

  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) 
  {
    genService.viewTrack(JSON.stringify({name:$ionicHistory.currentStateName(),params:$stateParams}))
  });


  $scope.game = angular.fromJson($stateParams.params);
//console.log($scope.game);  

/*
  if (ionic.Platform.isIOS())
    $scope.frameWidth=340;
  else
    if (ionic.Platform.isAndroid())
      $scope.frameWidth=330;
    else
      $scope.frameWidth=360;
*/

var el=angular.element(document.getElementById("gameContainer"));
$scope.frameWidth=el.prop("offsetWidth")-20;


//console.log($scope.game.embed);

  $scope.embed=$sce.trustAsResourceUrl($scope.game.embed); //"https://play.famobi.com/flag-quiz/A-VH25S"
 

//  $scope.embed1=$sce.trustAsHtml('<div class="gameplayer" data-gid="576742227280283232" data-height="397" data-sub="cdn" data-width="530" id="eljuego" style="width: 530px; height: 397px;"><iframe width="530" height="397" seamless="true" webkitallowfullscreen="true" mozallowfullscreen="true" allowfullscreen="true" webkit-playsinline="true" frameborder="0" scrolling="no" name="gameplayer-576742227280283232" src="https://cdn.gameplayer.io/embed/576742227280283232/?ref=http%3A%2F%2Fwww.curso-ingles.com" style="margin: 0px; padding: 0px; border: 0px;"></iframe></div>')
//  $scope.embed2=$sce.trustAsHtml('(function(d, s, id) { var js, fjs = d.getElementsByTagName(s)[0]; if (d.getElementById(id)) return; js = d.createElement(s); js.id = id; js.src = "https://cdn.gameplayer.io/api/js/publisher.js"; fjs.parentNode.insertBefore(js, fjs);}(document, "script", "gameplayer-publisher"));')

//  $scope.embed3=$sce.trustAsHtml('<div class="gameplayer" data-gid="576742227280283232" data-height="297" data-sub="cdn" data-width="100%" id="eljuego" style="width: 100%; height: 297px;"><iframe width="100%" height="297" seamless="true" webkitallowfullscreen="true" mozallowfullscreen="true" allowfullscreen="true" webkit-playsinline="true" frameborder="0" scrolling="no" name="gameplayer-576742227280283232" src="https://cdn.gameplayer.io/embed/576742227280283232/?ref=http%3A%2F%2Fwww.curso-ingles.com" style="margin: 0px; padding: 0px; border: 0px;"></iframe></div><script>(function(d, s, id) { var js, fjs = d.getElementsByTagName(s)[0]; if (d.getElementById(id)) return; js = d.createElement(s); js.id = id; js.src = "https://cdn.gameplayer.io/api/js/publisher.js"; fjs.parentNode.insertBefore(js, fjs);}(document, "script", "gameplayer-publisher"));</script>');

//                   $scope.embed4='<div class="gameplayer" data-gid="576742227280283232" data-height="397" data-sub="cdn" data-width="530" id="eljuego"></div><script>(function(d, s, id) { var js, fjs = d.getElementsByTagName(s)[0]; if (d.getElementById(id)) return; js = d.createElement(s); js.id = id; js.src = "https://cdn.gameplayer.io/api/js/publisher.js"; fjs.parentNode.insertBefore(js, fjs);}(document, "script", "gameplayer-publisher"));</script>'



})
