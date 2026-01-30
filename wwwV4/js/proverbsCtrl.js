angular.module('starter').controller('proverbsCtrl', function($scope, $rootScope, $state, $ionicSideMenuDelegate, $location, $ionicLoading, backendService ,$ionicSlideBoxDelegate, $ionicScrollDelegate ,$ionicPosition, adsService, $ionicHistory, $stateParams, genService) {

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
$scope.cacheKey="proverbs";


  genService.logEvent("Proverbs")

  adsService.showInterstitial(AdMob);

  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) 
  {
    $rootScope.viewTitle=$rootScope.i18n[$rootScope.loc]["prov_title"]; 
    genService.viewTrack(JSON.stringify({name:$ionicHistory.currentStateName(),params:$stateParams}));    
  });  
  
  $scope.test="Cargando ..."




  $scope.proverbs =[];
  console.log("* antes de getProverbs *");
  $ionicLoading.show();
  $rootScope.forceCache=true; // Al quitar el 'boton' que habia en el item de 'recursos' para poner / quitar de offline, ha de forzar si no está (que es lo que hacia cuando no estaba offline)  
  backendService.doGetCached($scope.cacheKey,'/v3/proverbs',$scope.userInfo,function(result) {
    console.log("* dentro de getProverbs *");
    $ionicLoading.hide();
    console.log('* getProverbs returned value *');
    console.log(result);
    //console.log(result.courses);
    // result.error contiene el mensaje de error si lo hay
    $scope.test="";
    $scope.proverbs=result.data.proverbs;

    if ($rootScope.loc=="es")
      $scope.paginas=[["featured","Destacadas"]];      
    else
      $scope.paginas=[["featured","Featured"]];

    var n=result.data.proverbs.letras.length;
    for (i=0;i<n;i++)
    {
      $scope.paginas.push([result.data.proverbs.letras[i].letra,result.data.proverbs.letras[i].letra]);
    }
    //console.log($scope.paginas);

  });
  console.log("* después de getProverbs *");

  $scope.currentSlide=0;

  $scope.play=function(text){
    console.log("$scope.play");
    console.log(text);
    backendService.Play(text,$scope.userInfo);
  };







  var isAndroid=ionic.Platform.isAndroid();

  $scope.listaClick=function(e,index){                          // A.160708: Añadido
    console.log("* listaClick *");
    console.log(index);    
    var el=angular.element(e.currentTarget)
//    $scope.colocaLista(el,index)
    $scope.currentSlide=index;
  }

  $scope.slideHasChanged=function(cual){                        // A.160708: Añadido
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
    if (isAndroid)
    {
        //console.log(JSON.stringify(el));
        //console.log(index);
        //console.log("-position-");
        //console.log(JSON.stringify($ionicPosition.position(el)));
        //console.log("-offset-");
        //console.log(JSON.stringify($ionicPosition.offset(el)));
        //console.log("-scrollPosition-");
        //console.log(JSON.stringify($ionicScrollDelegate.$getByHandle('miScroller').getScrollPosition()));
        var oldPos=$ionicPosition.position(el).left;
        //console.log("oldPos: "+oldPos);
        var itemWidth=el.prop('offsetWidth');    
        //console.log("itemWidth: "+itemWidth);
        var parentWidth=el.parent().prop('clientWidth');
        //console.log("parentWidth: "+parentWidth);    
        var newPos=(parentWidth-itemWidth)/2 // <- Con parentwidth relativo, (no los 2000 px si no los 309)
        //console.log("newPos: "+newPos);
        var delta=oldPos-newPos;
        //console.log("delta: "+delta);
        var oldScrollPos=$ionicScrollDelegate.$getByHandle('miScroller').getScrollPosition().left;
        //console.log("oldScrollPos: "+oldScrollPos);
        var newScrollPos=oldScrollPos+delta;
        //console.log(newScrollPos);
        //console.log("")
        $ionicScrollDelegate.$getByHandle('miScroller').scrollTo(oldPos-newPos, 0, true)
        //$ionicScrollDelegate.$getByHandle('miScroller').scrollTo(50, 0, true)
        //$ionicScrollDelegate.$getByHandle('miScroller').scrollBy(50, 0, false);
    }
    else
    {
        var itemTop=$ionicPosition.position(el).top;
        var oldPos=$ionicPosition.position(el).left;
        var itemWidth=el.prop('offsetWidth');    
        var parentWidth=el.parent().prop('clientWidth');
        var newPos=(parentWidth-itemWidth)/2 // <- Con parentwidth relativo, (no los 2000 px si no los 309)
        var delta=oldPos-newPos;
        var oldScrollPos=$ionicScrollDelegate.$getByHandle('miScroller').getScrollPosition().left;
        var newScrollPos=oldScrollPos+delta;
        $ionicScrollDelegate.$getByHandle('miScroller').scrollTo(newScrollPos, 0, true)
    }
  }







})
