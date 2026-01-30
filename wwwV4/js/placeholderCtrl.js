angular.module('starter').controller('placeholderCtrl', function($scope, $rootScope, $state, $stateParams, adsService, genService) {

  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) {

  	// Al llamarlo con $state.go, le pasa el parametro {title: xxxx} dónde xxxx es un string de los que están localizados.
    $rootScope.viewTitle=$rootScope.i18n[$rootScope.loc][$stateParams["title"]]
  
  });

})


