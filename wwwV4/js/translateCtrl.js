angular.module('starter').controller('translateCtrl', function($scope,$rootScope,$state,$stateParams,backendService,$ionicLoading,adsService, $ionicHistory, genService) {

  genService.logEvent("Translate");

  adsService.showInterstitial(AdMob);

  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) 
  {
    $rootScope.viewTitle=$rootScope.i18n[$rootScope.loc]["tran_title"];  
    genService.viewTrack(JSON.stringify({name:$ionicHistory.currentStateName(),params:$stateParams}));    
    
    $rootScope.errorValue=null;
  });  

  if ($rootScope.loc=="en")
    $scope.dirs=["Spanish -> English","English -> Spanish"];
  else  
    $scope.dirs=["Español -> Inglés","Inglés -> Español"];
  $scope.result=null;

  $scope.direction=0;
  $scope.dir=0;
  $scope.datos={}; //Aquí se usa $scope.datos.frmText






  var transHist=window.localStorage.getItem("transHist");
  if (!transHist)
  {
    window.localStorage.setItem("transHist",JSON.stringify([]))
  } 
  $scope.transHist=JSON.parse(window.localStorage.getItem("transHist"));

  $scope.swapClick=function(){
    console.log("* swapClick *");
    if ($scope.direction==0)
    {
      console.log("arriba");
      $scope.direction=1;
      $scope.dir=1;
    }  
    else
    {
      console.log("abajo");
      $scope.direction=0;
      $scope.dir=0;
    }
    console.log($scope.dir);
  }

  $scope.checkText=function(text){
    //console.log("* checkVerb *");
    if (text==undefined || text.length<3)
      return true;
    else
      return false; 
  }

  $scope.traduce=function(text){
    console.log("* traduce *");
    console.log(text);


    console.log("* antes de getTranslation *");
    $ionicLoading.show();

    if ($scope.dir==0)
      var d="ES/EN"
    else
      var d="EN/ES"

    //backendService.getTranslation(text,$scope.dir,function(result) {
    backendService.doGet('/v3/translate/'+d+'/'+encodeURIComponent(text),$scope.userInfo,function(result) {
      console.log("* dentro de getTranslation *");
      $ionicLoading.hide();
      console.log('* getTranslation returned value *');
      console.log(result);
      // result.error contiene el mensaje de error si lo hay
      $scope.result=result.data.response;

      c=-1;
      var n=$scope.transHist.length;
      i=-1;
      for(i=0;i<n;i++)   
      {
        if ($scope.transHist[i].text==text) 
          c=i;
      }

      if (c==-1)
      {
        var newItem={"dir":$scope.dir, "text":text, "translation":$scope.result};
        $scope.transHist.unshift(newItem);
        window.localStorage.setItem("transHist",JSON.stringify($scope.transHist));
        //$scope.transHist=JSON.parse(window.localStorage.getItem("transHist"));
      }

    });
    console.log("* después de getTranslation *");
  }


  $scope.play=function(){
    console.log("* translateCtrl:play *");
    backendService.Play($scope.result,$scope.userInfo);
  }

  $scope.itemClick=function(index){
      console.log("* itemClick *");
      var item=$scope.transHist[index];
      console.log(item);
      $scope.dir=item.dir;
      $scope.direction=item.dir;
      $scope.datos.frmText=item.text;
      $scope.result=item.translation;

      $rootScope.errorValue=null;
  }

  $scope.deleteItemClick=function(index){
      console.log("* deleteItemClick *");
      $scope.transHist.splice(index, 1);
      window.localStorage.setItem("transHist",JSON.stringify($scope.transHist));
  }

  $scope.deleteClick=function(){
      console.log("* deleteClick *");
      $scope.transHist=[];      
      window.localStorage.setItem("transHist",JSON.stringify($scope.transHist));

  }


if ($stateParams.dir) // La URL incluye la dirección y el texto
{
  $scope.dir=$stateParams.dir;
  $scope.datos.frmText=$stateParams.text;
  $scope.traduce($stateParams.text);
}



})
