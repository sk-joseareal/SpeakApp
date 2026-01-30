
angular.module('starter')
.controller('songsCtrl', function($scope, $state, $stateParams, $ionicSideMenuDelegate, $location, $ionicLoading, backendService ,$ionicSlideBoxDelegate, adsService, $ionicHistory, genService) {

  genService.logEvent("Songs");

  adsService.showInterstitial(AdMob);

  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) 
  {
    genService.viewTrack(JSON.stringify({name:$ionicHistory.currentStateName(),params:$stateParams}));
  });


  $scope.$on( "$ionicView.beforeLeave", function( scopes, states ) 
  {
    $rootScope.errorValue=null;
  });

  if ($stateParams.filter==undefined)
  {
    $scope.filter="featured";
    $scope.filter_human="Destacadas";
  }
  else
  {
    $scope.filter=$stateParams.filter;
    $scope.filter_human=filter;
  }


  $scope.test="Cargando ..."

  $scope.songs=[];
  $scope.artists=[];
  $scope.lessons=[];
  console.log("* antes de getSongs *");
  $ionicLoading.show();
  //backendService.getSongs($scope.filter,function(result) {
  backendService.doGet('/v3/songs/'+$scope.filter,$scope.userInfo,function(result) {
    console.log("* dentro de getSongs *");
    $ionicLoading.hide();
    console.log('* getSongs returned value *');
    console.log(result);
    //console.log(result.courses);
    // result.error contiene el mensaje de error si lo hay
    $scope.test="";
    $scope.songs=result.data.songs;
    $scope.artists=result.data.songs.artists;
    $scope.lessons=result.data.songs.lessons;

// Eliminar la primera ('already/just/still/yet') por que hace petar el backend.
//$scope.lessons.shift();    

    //console.log($scope.paginas);

  });
  console.log("* después de getSongs *");

  $scope.wordClick=function(word){
    console.log("wordClick");
    console.log(word);
  };


  $scope.openItem=-1;
  $scope.plusClick=function(index){
    console.log("* click *",index);
    if ($scope.openItem==index)
      $scope.openItem=-1;
    else
      $scope.openItem=index;
  }

  $scope.selectFilter=function(filter){
    if (filter==undefined)
      return;
    console.log("* selectFilter *");
    console.log(filter);
    /////////////////////////////////////////////
    $scope.test="Cargando ..."
    $scope.filter=filter;
    $scope.filter_human=filter;    
//    $scope.songs =[];
    console.log("* antes de getSongs *");

    // Sustituimos los "/" por "*"
    console.log($scope.filter)
    console.log(encodeURIComponent($scope.filter));  
    console.log("* *");

    //startSpinner();
    $ionicLoading.show();  
    var filt=$scope.filter;
    filt=filt.replace(new RegExp("/", 'g'), "*");
    filt=encodeURIComponent(filt);
    //backendService.getSongs(filt,function(result) {
    backendService.doGet('/v3/songs/'+filt,$scope.userInfo,function(result) {
      console.log("* dentro de getSongs *");
      $ionicLoading.hide();
      console.log('* getSongs returned value *');
      console.log(result);
      //console.log(result.courses);
      // result.error contiene el mensaje de error si lo hay
      $scope.test="";
      $scope.songs=result.data.songs;
      //console.log($scope.paginas);

    });
    console.log("* después de getSongs *");  
  }



  $scope.videoClick=function(index){
    var params = angular.toJson($scope.songs.songs[index]);
    $state.go("app.song",{ params: params });
  }

})

.controller('songCtrl', function($scope, $state, $stateParams, $sce, $ionicHistory) {

  if (window.ga) window.ga.trackView('Song '+angular.fromJson($stateParams.params));
  if (typeof window.FirebasePlugin!="undefined") window.FirebasePlugin.logEvent('Song '+angular.fromJson($stateParams.params), {uuid: uuid});

  console.log("* song *");

  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) 
  {
    localStorage.setItem("_lastPos",JSON.stringify({name:$ionicHistory.currentStateName(),params:$stateParams})); 
  });


  $scope.song = angular.fromJson($stateParams.params);
  console.log($scope.song);


  $scope.trustSrc=function(src){
    console.log(src);
    ret=$sce.trustAsResourceUrl(src);
    console.log(ret);
    return ret;
  }


  $scope.videoURL=function(video_id){
    console.log("* videoURL *");
    console.log(video_id);
    return "https://www.youtube.com/embed/"+video_id+"?feature=player_embedded";
  }

})

.controller('videolessonCtrl', function($scope, $rootScope, $state, $stateParams, $sce) {


  console.log("* videolesson *");
  $scope.videolesson = angular.fromJson($stateParams.params);
  console.log("--------------------------")
  console.log($scope.videolesson);
  console.log("--------------------------")

  $rootScope.viewTitle=$scope.videolesson.title;

  $scope.trustSrc=function(src){
    console.log("* trustSrc *");
    console.log(src);
    ret=$sce.trustAsResourceUrl(src);
    console.log(ret);
    return ret;
  }

  $scope.videoURL=function(video_id){
    console.log("* videoURL *");
    console.log(video_id);
    return "https://www.youtube.com/embed/"+video_id+"?feature=player_embedded";
  }

})
