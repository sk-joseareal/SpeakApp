angular.module('starter').controller('grammarCtrl', function($scope, $rootScope, $state, $ionicSideMenuDelegate, $location, $ionicLoading, backendService, varGlobal, GrammarService, adsService, $ionicHistory, $stateParams, genService) {



$scope.courseId=$stateParams.courseId;

$scope.icono=function(item)
{
  if (item.name.includes("Unit Test") || !item.clase)
    return 0;    
  else 
    if (item.clase==2) // Multi
      return 1;        
    else if (item.subclase>3) // Tap: 1.4, 1.5, 1.7
      return 2;
    else
      return 3;    

}


$scope.genService=genService;
$scope.checkItem=function(course_id)
{
  return genService.checkItem("__tests"+course_id);
}


$scope.offLine=function(course_id)
{
  if ($scope.checkItem(course_id))
    {
      var val=JSON.parse(genService.getItem("__tests"+course_id));
      var list=val.data;
      for (xx=0;xx<list.length;xx++)
      {
        k="__test"+list[xx]
        genService.removeItem(k);
      }
      genService.removeItem("__tests"+course_id);
    }
  else
  {

    $ionicLoading.show();
    $rootScope.forceCache=true;
    console.log("* antes de getPracticeTestsCourse *");
    backendService.doGetCached('#tests'+course_id,'/v3/practice_tests_course/'+course_id,$scope.userInfo,function(result) {

        console.log("* dentro de getPracticeTestsCourse *");

        console.log('* getPracticeTestsCourse returned value *');
        console.log(result);

        $ionicLoading.hide();
    });
    console.log("* después de getPracticeTestsCourse *");
  }
}

  genService.logEvent("Grammar");
  
  adsService.showInterstitial(AdMob);

  $scope.test="Cargando ..."

  $scope.$on('$ionicView.afterEnter', function(){
    console.log("* ENTRA EN grammar.html ($ionicView.afterEnter) *");

    $rootScope.viewTitle=$rootScope.i18n[$rootScope.loc]["gram_title"];   
    genService.viewTrack(JSON.stringify({name:$ionicHistory.currentStateName(),params:$stateParams}));

    $ionicLoading.show();

    if (varGlobal.grammarPass==0)
    {    

      $scope.allok=true;

      $rootScope.forceCache=true;

      console.log("* antes de getGrammar *");
      backendService.doGetCached('testslist','/v3/practicetests',$scope.userInfo,function(result) {

        $rootScope.forceCache=false;

// OJO, este es el 'caché' extra que hace que sólo se tenga que cargar una vez.
        varGlobal.grammarPass=1        

        console.log("* dentro de getGrammar *");
        $ionicLoading.hide();
        console.log('* getGrammar returned value *');

        console.log(result);


        if (!result.data)
        {
          $scope.allok=false;
          $scope.error=$rootScope.i18n[$rootScope.loc].err01;
          console.log("# error #");
        }
        else
        {
          $scope.allok=true;
          $scope.error=null;
          console.log ("# no error #");          

          $scope.test="";
          $scope.grammar=result.data.practicetests;

          GrammarService.setGrammar($scope.grammar)
          // Progress
          $scope.applyProgress();   
          // Mark new
          $scope.markNew();   
        }  

      });

    }
    else
    {

      $scope.allok=true;
      $scope.error=null;
      console.log ("# se toma del caché intermedio #");

      $scope.grammar=GrammarService.getGrammar();

      // Progress
      $scope.applyProgress();        
      // Mark new
      $scope.markNew();   

      $ionicLoading.hide();

    }






  });


  // Que no haya ningún item desplegado por defecto.

$scope.openItem=-1;


  $scope.plusClick=function(index){
    console.log("* click *",index);
    if ($scope.openItem==index)
      $scope.openItem=-1;
    else
      $scope.openItem=index;
  }
                      /* course_id,idx */
  $scope.goTest=function(lesson_id,test_id){
    console.log("* goTest *");
    console.log(lesson_id);
    console.log(test_id);

//    console.log(idx);
//    var tst=$scope.grammar.practicetests[course_id][idx];
//    console.log(tst);

//    $state.go("app.test",{ unitId: tst.lesson_id, testId: tst.id });
    $state.go("app.test",{ unitId: lesson_id, testId: test_id });
    //href="#/app/test/{{section.lesson_id}}/{{section.resources[1].id}}"
  }





  $scope.applyProgress=function(){

    console.log("*** applyProgress ***");

    // Progress

    var m=$scope.grammar.courses.length;
    for(j=0;j<m;j++)   
    {
      var course_id=$scope.grammar.courses[j].id
      //console.log(course_id);
      if ($scope.grammar.practicetests[course_id])
      {
        var n=$scope.grammar.practicetests[course_id].length;
        for(k=0;k<n;k++)   
        {
          var test_id=$scope.grammar.practicetests[course_id][k].id;
          //console.log(test_id);
          if ($scope.userInfo)
            var test_value=$scope.userInfo.test_progress[test_id];
          else 
            var test_value=null;
          //console.log(test_value);
          if (test_value)
            if (test_value==1)
              numeric_value=100;
            else
              numeric_value=40;
          else
            numeric_value=null;
          //console.log(numeric_value);

          $scope.grammar.practicetests[course_id][k].result=numeric_value;
        }
      }
    }

    console.log($scope.grammar);
  }



  $scope.markNew=function(){
    console.log("*** markNew ***");  
    // Mark new

    var m=$scope.grammar.courses.length;
    for(j=0;j<m;j++)   
    {
      var course_id=$scope.grammar.courses[j].id
      //console.log(course_id);
      if ($scope.grammar.practicetests[course_id])
      {
        var n=$scope.grammar.practicetests[course_id].length;
        for(k=0;k<n;k++)   
        {
          var test_id=$scope.grammar.practicetests[course_id][k].id;

if ($scope.grammar.practicetests[course_id][k].new_date)
{
  var nd=$scope.grammar.practicetests[course_id][k].new_date.substr(0,19);
  var nw=genService.contentNewCheck("tests",test_id,nd);
}
else
  var nw=false;
          $scope.grammar.practicetests[course_id][k].new=nw;
        }
      }
    }


    console.log($scope.grammar);
  }


})
