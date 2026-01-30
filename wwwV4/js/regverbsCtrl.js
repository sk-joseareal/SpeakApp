angular.module('starter').controller('regverbsCtrl', function($scope, $rootScope, $state, $ionicSideMenuDelegate, $location, $ionicLoading, backendService ,$ionicSlideBoxDelegate,$ionicScrollDelegate,$ionicPosition,adsService, $ionicHistory, $stateParams, genService) {

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
$scope.cacheKey="regverbs";

  genService.logEvent("RegularVerbs");

  adsService.showInterstitial(AdMob);

  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) 
  {
    $rootScope.viewTitle=$rootScope.i18n[$rootScope.loc]["regv_title"];       
    genService.viewTrack(JSON.stringify({name:$ionicHistory.currentStateName(),params:$stateParams}));  
  });

  $scope.test="Cargando ..."

  $scope.regverbs =[];
  console.log("* antes de getRegVerbs *");
  $ionicLoading.show();
  $rootScope.forceCache=true; // Al quitar el 'boton' que habia en el item de 'recursos' para poner / quitar de offline, ha de forzar si no está (que es lo que hacia cuando no estaba offline)
  backendService.doGetCached($scope.cacheKey,'/v3/regverbs',$scope.userInfo,function(result) {
    console.log("* dentro de getRegVerbs *");
    $ionicLoading.hide();
    console.log('* getRegVerbs returned value *');
    console.log(result);
    //console.log(result.courses);
    // result.error contiene el mensaje de error si lo hay
    $scope.test="";
    $scope.regverbs=result.data.regverbs;
    
    if ($rootScope.loc=="es")
      $scope.paginas=[["featured","Destacadas"]];
    else      
      $scope.paginas=[["featured","Featured"]];

    var n=result.data.regverbs.letras.length;
    for (i=0;i<n;i++)
    {
      $scope.paginas.push([result.data.regverbs.letras[i].letra,result.data.regverbs.letras[i].letra]);
    }
    //console.log($scope.paginas);

  });
  console.log("* después de getRegVerbs *");

  $scope.currentSlide=0;
  
  $scope.pagerClick=function(index){
    $scope.openItem=-1;
    $scope.currentSlide=index;                                  // A.160708: Añadido
    $ionicSlideBoxDelegate.slide(index);
  };

  $scope.wordClick=function(word){
    console.log("wordClick");
    console.log(word);
    backendService.Play(word,$scope.userInfo);
  };

  $scope.conjugate=function(verb){
    console.log("conjugate");
    console.log(verb);
    $state.go("app.conjugateverb",{ "verb": verb }); 
//$state.go("tab.hotel_details", { "id": id })
//    $state.go("/conjugate/"+verb); 
  };




  $scope.openItem=-1;
  $scope.plusClick=function(index){
    console.log("* click *",index);
    if ($scope.openItem==index)
      $scope.openItem=-1;
    else
      $scope.openItem=index;
  }






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

    $scope.openItem=-1;
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


/*

  $scope.listaClick=function(e,index){                          // A.160708: Añadido
    console.log("* listaClick *");                              //
    console.log(index);                                         //
    var el=angular.element(e.currentTarget)                     //
    $scope.colocaLista(el,index)                                // JAR.160708: Añadido
    $scope.currentSlide=index;                                  //
  }

  $scope.slideHasChanged=function(cual){
    console.log("slideHasChanged");
    console.log(cual);
    var id="lstbtn"+cual;                                       // A.160708: Añadido
    var el=angular.element(document.getElementById(id));        //
    console.log(el);                                            //
    $scope.currentSlide=cual;                                   //    
    $scope.openItem=-1;
    $ionicScrollDelegate.scrollTop(true);    
    $scope.colocaLista(el,cual);                                //
  };

  $scope.colocaLista=function(el,index)                         // JAR.160708: Añadido
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

*/

})
