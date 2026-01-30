angular.module('starter').controller('tourCtrl', function($scope, $rootScope, $ionicSlideBoxDelegate, $stateParams, AuthService, $ionicLoading, $ionicSideMenuDelegate, genService) {

  $scope.cSlide=0;

console.log("# xxx.yyy # tourCtrl.js load #");
  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) // por aquí pasará cada vez que se tenga que recargar(cacheada o no, ojo (si es cacheado no 'refresca pantalla', por ejemplo al cambiar de opción de menu (solo si se cambia) y al pulsar el botón de login)
  {

    $rootScope.viewTitle="";
    $scope.cSlide=0;

    console.log("*Desactiva canDragContent*");
	  $ionicSideMenuDelegate.canDragContent(false);
  });




  $scope.$on( "$ionicView.afterEnter", function( scopes, states ) // por aquí pasará cada vez que se tenga que recargar(cacheada o no, ojo (si es cacheado no 'refresca pantalla', por ejemplo al cambiar de opción de menu (solo si se cambia) y al pulsar el botón de login)
  {
    $rootScope.viewTitle="";
    $scope.cSlide=0;
  });




  $scope.$on( "$ionicView.beforeLeave", function( scopes, states ) 
  {

    if (!$rootScope.noFirstTime)
      $rootScope.RGPDModal.show();

  	console.log("*Activa canDragContent*");  	
  	$ionicSideMenuDelegate.canDragContent(true);
  });

  $scope.pagerClick=function(index){
    console.log("pagerClick")
    console.log(index)
    $ionicSlideBoxDelegate.slide(index);
  };

  genService.logEvent("Tour");

  $ionicLoading.hide();

  $scope.userInfo=AuthService.getUserInfo();

  var firstTime=window.localStorage.getItem("firstTime")

})

