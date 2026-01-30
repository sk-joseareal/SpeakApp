angular.module('starter').controller('expressionsCtrl', function($scope,$rootScope,$stateParams,backendService,$ionicLoading,$ionicSlideBoxDelegate,$ionicScrollDelegate,$ionicPosition,$timeout,adsService, $ionicHistory, genService) {

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
$scope.cacheKey="expressions";

  genService.logEvent("Expressions");

  adsService.showInterstitial(AdMob);

  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) 
  {
    $rootScope.viewTitle=$rootScope.i18n[$rootScope.loc]["expr_title"]; 
    genService.viewTrack(JSON.stringify({name:$ionicHistory.currentStateName(),params:$stateParams}));
  });

  $scope.test="Cargando ..."

  var isAndroid=ionic.Platform.isAndroid()


  $scope.Expressions =[];
  console.log("* antes de getExpressions *");
  $ionicLoading.show();
  $rootScope.forceCache=true; // Al quitar el 'boton' que habia en el item de 'recursos' para poner / quitar de offline, ha de forzar si no está (que es lo que hacia cuando no estaba offline)
  backendService.doGetCached($scope.cacheKey,'/v3/expressions',$scope.userInfo,function(result) {
    console.log("* dentro de getExpressions *");
    $ionicLoading.hide();
    console.log('* getExpressions returned value *');
    console.log(result);
    //console.log(result.courses);
    // result.error contiene el mensaje de error si lo hay
    $scope.test="";                                             // A.160708 Se cambia el orden de esta línea y la siguiente
    $scope.expressions = result.data.expressions;

    if ($rootScope.loc=="es")
      $scope.paginas=[["featured","Destacadas"]];      
    else
      $scope.paginas=[["featured","Featured"]];

    var n=result.data.expressions.letras.length;
    for (i=0;i<n;i++)
    {
      $scope.paginas.push([result.data.expressions.letras[i].letra,result.data.expressions.letras[i].letra]);
    }
    console.log($scope.paginas);
    //console.log($scope.paginas);

  });
  console.log("* después de getExpressions *");

  $scope.currentSlide=0;
  $scope.openItem=-1;

  
  $scope.wordClick=function(word){
    console.log("wordClick");
    console.log(word);
    backendService.Play(word,$scope.userInfo);
  };

  $scope.plusClick=function(index){
    console.log("* click *",index);
    if ($scope.openItem==index)
      $scope.openItem=-1;
    else
      $scope.openItem=index;
  }




  $scope.listaClick=function(e,index){
    console.log("* listaClick *");
    console.log(index);    
    $scope.currentSlide=index;
  }

  $scope.slideHasChanged=function(cual){
    console.log("slideHasChanged");
    console.log(cual);

//    $timeout( function() {
//      $ionicScrollDelegate.resize();
//    }, 50);

    var id="lstbtn"+cual;                                       
    var el=angular.element(document.getElementById(id));        
//    console.log(el);                                            

    $scope.currentSlide=cual;                                   
  
    // Esto en Android bloquea el scroller horizontal
    if (!isAndroid)
     $ionicScrollDelegate.scrollTop(true);  

    $scope.colocaLista(el,cual);                                

    $scope.openItem=-1;
  };



  $scope.colocaLista=function(el,index)
  {
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
