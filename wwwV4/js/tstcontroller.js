console.log("006.030 >###> js/tstcontroller.js >>>")

angular.module('starter').controller('TstController', function($scope, $rootScope, $state, $stateParams, $ionicSideMenuDelegate, adsService, genService) {

  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) {

console.log("");
console.log("/////////////////////////////");
console.log("TstController ");
console.log("/////////////////////////////");
console.log("");
  
  });


  $scope.$on( "$ionicView.willOpen", function( scopes, states ) {

console.log("");
console.log("/////////////////////////////");
console.log("TstController ");
console.log("/////////////////////////////");
console.log("");
  
  });

  $scope.$on( "ionWillOpen", function( scopes, states ) {

console.log("");
console.log("/////////////////////////////");
console.log("TstController ");
console.log("/////////////////////////////");
console.log("");
  
  });


console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$");

$rootScope.$on('$stateChangeStart',function(event, toState, toParams, fromState, fromParams){
      console.log("$$$$$$$$ rootScope : stateChangeStart $$$$$$$$$");
    });

$scope.$on('$stateChangeStart',function(event, toState, toParams, fromState, fromParams){
      console.log("$$$$$$$$ scope : stateChangeStart $$$$$$$$$");
    });



})

console.log("006.030 >###> js/tstcontroller.js <<<")