angular.module('starter').controller('resourcesCtrl', function($scope, $rootScope, $ionicSlideBoxDelegate, $ionicHistory, $stateParams, genService, $ionicLoading, backendService, genService) {

  $scope.genService=genService;
  $scope.checkItem=function(item){
    return genService.checkItem("__"+item);
  }

$scope.descarga=function(key)
{
  var cacheKey="__"+key;
  if (genService.checkItem(cacheKey)) // Quitar de offline
  {
  	if (key=="conjugations")
  	{  	
  		val=JSON.parse(genService.getItem("__"+key));  
  		verbs=val.data;
  		for (xx=0;xx<verbs.length;xx++)
  		{
  			verb=verbs[xx];
  			k="__conjugation_"+verb;
  			genService.removeItem(k);
  		}
  		genService.removeItem("__"+key);
  	}
  	else
  	{
	    genService.toTmp(cacheKey); 
    	genService.removeItem(cacheKey);        
    	$rootScope.forceCache=false;
  	}
  }
  else // Poner offline
  {
  	// Si hay $event.stopPropagation() en el ng-click, tiene que llamar a getCached() aquí.
    $rootScope.forceCache=true;

	var endpoint={'vocabularies':'/v3/vocabs',
				  'expressions':'/v3/expressions',
				  'proverbs':'/v3/proverbs',
				  'quotes':'/v3/quotes',
				  'regverbs':'/v3/regverbs',
				  'irregverbs':'/v3/irregverbs',
				  'phrasverbs':'/v3/phrasalverbs',
				  'conjugations':'/v4/conjugations',
				  'course10002':'/v3/courses/10002/lessons',
				  'course10000':'/v3/courses/10000/lessons'}[key];

	console.log("* antes de getCached *");
	$ionicLoading.show();
	backendService.doGetCached("#"+key,endpoint,$scope.userInfo,function(result) {
		console.log("* dentro de getCached *");
		$ionicLoading.hide();
		console.log('* getCached returned value *');
    console.log(result.ok);
	});
	console.log("* después de getCached *");
    
  	return

    // Si no hay $event.stopPropagation() en el ng-click, saltará al controller y alli hará el getCached()
    $rootScope.forceCache=true;
  }
}


  genService.logEvent("Resources");

  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) 
  {
    $rootScope.viewTitle=$rootScope.i18n[$rootScope.loc]["reso_title"];      
    genService.viewTrack(JSON.stringify({name:$ionicHistory.currentStateName(),params:$stateParams}));
  });


})

