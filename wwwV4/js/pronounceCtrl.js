angular.module('starter').controller('pronounceCtrl', function($scope,$rootScope,$state,$stateParams,backendService,$ionicLoading,adsService, $ionicHistory, genService) {

  genService.logEvent("Pronounce");

  adsService.showInterstitial(AdMob);

  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) 
  {
    $rootScope.viewTitle=$rootScope.i18n[$rootScope.loc]["pron_title"];   
    genService.viewTrack(JSON.stringify({name:$ionicHistory.currentStateName(),params:$stateParams}));    
  });  
  
  $scope.datos={}; //Aquí se usa $scope.datos.frmText

  var pronHist=window.localStorage.getItem("pronHist");
  if (!pronHist)
  {
    window.localStorage.setItem("pronHist",JSON.stringify([]))
  } 
  $scope.pronHist=JSON.parse(window.localStorage.getItem("pronHist"));


  $scope.checkText=function(text){
    //console.log("* checkVerb *");
    if (text==undefined || text.length<3)
      return true;
    else
      return false; 
  }

  $scope.pronuncia=function(text){
    console.log("* pronuncia *");
    console.log(text);

    backendService.Play(text,$scope.userInfo);
 
    c=-1;
    var n=$scope.pronHist.length;
    i=-1;
    for(i=0;i<n;i++)   
    {
      if ($scope.pronHist[i].text==text) 
        c=i;
    }

    if (c==-1)
    {
      var newItem={"text":text};
      $scope.pronHist.unshift(newItem);
      window.localStorage.setItem("pronHist",JSON.stringify($scope.pronHist));
    }


  }


  $scope.play=function(){
    console.log("* translateCtrl:play *");
    backendService.Play($scope.result,$scope.userInfo);
  }



  $scope.itemClick=function(index){
      console.log("* itemClick *");
      var item=$scope.pronHist[index];
      $scope.datos.frmText=item.text;
      backendService.Play(item.text,$scope.userInfo);
  }

  $scope.deleteItemClick=function(index){
      console.log("* deleteItemClick *");
      $scope.pronHist.splice(index, 1);
      window.localStorage.setItem("pronHist",JSON.stringify($scope.pronHist));
  }

  $scope.deleteClick=function(){
      console.log("* deleteClick *");
      $scope.pronHist=[];      
      window.localStorage.setItem("pronHist",JSON.stringify($scope.pronHist));
  }


if ($stateParams.text) // La URL incluye el texto
{
  $scope.datos.frmText=$stateParams.text;
  $scope.pronuncia($stateParams.text);
}





})
