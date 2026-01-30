angular.module('starter').controller('vocabsCtrl', function($scope,$rootScope,backendService,$ionicLoading,adsService, $ionicHistory, $stateParams, genService) {

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
$scope.cacheKey="vocabularies";

  genService.logEvent("Vocabularies");

  adsService.showInterstitial(AdMob);

  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) 
  {
    $rootScope.viewTitle=$rootScope.i18n[$rootScope.loc]["voca_title"];    
    genService.viewTrack(JSON.stringify({name:$ionicHistory.currentStateName(),params:$stateParams}));
  });

  $scope.test="Cargando ..."

  $scope.Vocabs =[];
  console.log("* antes de getVocabs *");
  $ionicLoading.show();
  $rootScope.forceCache=true; // Al quitar el 'boton' que habia en el item de 'recursos' para poner / quitar de offline, ha de forzar si no está (que es lo que hacia cuando no estaba offline)

  backendService.doGetCached($scope.cacheKey,'/v3/vocabs',$scope.userInfo,function(result) {
    console.log("* dentro de getVocabs *");
    $ionicLoading.hide();
    console.log('* getVocabs returned value *');
    console.log(result);
    //console.log(result.courses);
    // result.error contiene el mensaje de error si lo hay
    $scope.Vocabs = result.data.vocabs;
    backendService.setVocabs(result.data.vocabs);
    $scope.test="";
  });
  console.log("* después de getVocabs *");

  $scope.openVocab=-1;

  $scope.itemClick = function(index) {
    console.log("* click *",index);
    if ($scope.openVocab==index)
      $scope.openVocab=-1;
    else
      $scope.openVocab=index;
  };


})

.controller('vocabularyCtrl', function($scope,$rootScope,$stateParams,backendService,genService) {

  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) 
  {
    if ( r34lp0w3r.platform != "browser" && genService.getCache() && genService.checkItem( "__vocabularies" ) )
      $scope.imgCached = true;
    else
      $scope.imgCached = false;
  });

  if (window.ga) window.ga.trackView('Vocabulary '+$stateParams.vocabularyId);
  if (typeof window.FirebasePlugin!="undefined") window.FirebasePlugin.logEvent('Vocabulary '+$stateParams.vocabularyId, {uuid: uuid});
   
  $scope.test="vocabularycrtl"

  var vocabId=$stateParams.vocabId;
  var vocabularyId=$stateParams.vocabularyId;

  $scope.vocabulary=backendService.getVocabulary(vocabId,vocabularyId);

  $rootScope.viewTitle=$scope.vocabulary.name;


  $scope.localImgCache = {};
  $scope.imgUrl = function(index) {
    var word = $scope.vocabulary.words[index];

    if (!word || !word.image_file_name)
      return null;

    var img = "vocab" + word.id + ".png";

    if ($scope.imgCached) {
      if ($scope.localImgCache[word.id]) {
        return $scope.localImgCache[word.id];
      } else {
        // cargar solo una vez
        window.imagenLocal(img, function(uri) {
          if (uri) {
            $scope.localImgCache[word.id] = uri;
            $scope.$applyAsync();
          }
        });
        return null; // mientras se carga
      }
    } else {
      if ($rootScope.isOnLine)
        return "https://s3.amazonaws.com/sk.CursoIngles/vocabimages/" + img;
      else
        return null;
    }
  };



   $scope.wordClick=function(cual){ 
    word=$scope.vocabulary.words[cual];
    backendService.Play(word.name,$scope.userInfo); 
   };

})
