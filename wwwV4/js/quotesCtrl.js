angular.module('starter').controller('quotesCtrl', function($scope, $rootScope, $state, $ionicSideMenuDelegate, $location, $ionicLoading, backendService ,$ionicSlideBoxDelegate, $ionicPosition, $ionicScrollDelegate, $timeout, adsService, $ionicHistory, $stateParams, genService) {

$scope.genService=genService;
$scope.checkItem=function(){
  return genService.checkItem("__"+$scope.cacheKey);
}
$scope.offLine=function()
{
  if (genService.checkItem("__"+$scope.cacheKey)) // Quitar de offline
  {
    genService.toTmp("__"+$scope.cacheKey);
    genService.removeItem("__"+$scope.cacheKey);    
  } 
  else // Poner offline
  {
    genService.fromTmp("__"+$scope.cacheKey);    
  }
}
$scope.cacheKey="quotes";

  genService.logEvent("Quotes");

  adsService.showInterstitial(AdMob);

  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) 
  {
    $rootScope.viewTitle=$rootScope.i18n[$rootScope.loc]["quot_title"];  
    genService.viewTrack(JSON.stringify({name:$ionicHistory.currentStateName(),params:$stateParams}));    
  });  
  
  $scope.test="Cargando ..."


$scope.test0=function(){
  console.log("*click*");
}

$scope.texto="*nada*";


  $scope.quotes =[];
  console.log("* antes de getQuotes *");
  $ionicLoading.show();
  $rootScope.forceCache=true; // Al quitar el 'boton' que habia en el item de 'recursos' para poner / quitar de offline, ha de forzar si no está (que es lo que hacia cuando no estaba offline)
  backendService.doGetCached($scope.cacheKey,'/v3/quotes',$scope.userInfo,function(result) {
    console.log("* dentro de getQuotes *");
    //stopSpinner();
    $ionicLoading.hide();
    console.log('* getQuotes returned value *');
    console.log(result);
    //console.log(result.courses);
    // result.error contiene el mensaje de error si lo hay
    $scope.test="";
    $scope.quotes=result.data.quotes;

    if ($rootScope.loc=="es")
      $scope.paginas=[["featured","Destacadas"]];
    else
      $scope.paginas=[["featured","Featured"]];

    var n=result.data.quotes.themes.length;
    for (i=0;i<n;i++)
    {
      if ($rootScope.loc=="es")
        $scope.paginas.push([result.data.quotes.themes[i].id,result.data.quotes.themes[i].name]);        
      else        
        $scope.paginas.push([result.data.quotes.themes[i].id,result.data.quotes.themes[i].name_en]);    
    }
    //console.log($scope.paginas);

  });
  console.log("* después de getQuotes *");  

  $scope.currentSlide=0;


  $scope.play=function(text){
    console.log("$scope.play");
    console.log(text);
    backendService.Play(text,$scope.userInfo);
  };








  var isAndroid=ionic.Platform.isAndroid();

  $scope.listaClick=function(e,index){                       
    console.log("* listaClick *");
    console.log(index);    
    $scope.currentSlide=index;
  }

  $scope.slideHasChanged=function(cual){                   
    console.log("* slideHasChanged *");
    console.log(cual);
    var id="lstbtn"+cual;

    var el=angular.element(document.getElementById(id));
    $scope.currentSlide=cual;

    if (!isAndroid)
      $ionicScrollDelegate.scrollTop(true);  
    $scope.colocaLista(el,cual);    

  }; 

  $scope.colocaLista=function(el,index){
    console.log("")
    console.log("* colocaLista *");

    var oldPos=$ionicPosition.position(el).left;
    var parentWidth=el.parent().prop('clientWidth');      
    var itemWidth=el.prop('offsetWidth');    
    var newPos=(parentWidth-itemWidth)/2 
    if (isAndroid)
    {
      $ionicScrollDelegate.$getByHandle('miScroller').scrollTo(oldPos-newPos, 0, true)
    }
    else
    {
      var delta=oldPos-newPos;
      var oldScrollPos=$ionicScrollDelegate.$getByHandle('miScroller').getScrollPosition().left;
      var newScrollPos=oldScrollPos+delta;
      $ionicScrollDelegate.$getByHandle('miScroller').scrollTo(newScrollPos, 0, true)
    }
  }






})  
