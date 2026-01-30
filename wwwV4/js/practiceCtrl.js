angular.module('starter').controller('practiceCtrl', function($scope, $ionicSlideBoxDelegate, $ionicHistory, $stateParams, genService, varGlobal, $ionicLoading, $rootScope, backendService, CoursesService) {

  genService.logEvent("Practice");

  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) 
  {
    $rootScope.viewTitle=$rootScope.i18n[$rootScope.loc]["prac_title"];    
    genService.viewTrack(JSON.stringify({name:$ionicHistory.currentStateName(),params:$stateParams}));  		
  })






$scope.cacheKey="courseslist";

$scope.Courses =[];

  $scope.$on('$ionicView.afterEnter', function(){
    console.log("* ENTRA EN learn.html ($ionicView.afterEnter) *");

    console.log(varGlobal.learnPass);

    $ionicLoading.show();

    if (varGlobal.learnPass==0)
    {
      $scope.allok=true;

      console.log("* antes de getCourses *");
//Se cachea siempre, no hay botón en el título
$rootScope.forceCache=true;
      backendService.doGetCached($scope.cacheKey,'/v3/courses.json',$scope.userInfo,function(result) {

$rootScope.forceCache=false;

// OJO, este es el 'caché' extra que hace que sólo se tenga que cargar una vez.
varGlobal.learnPass=1;

        console.log("* dentro de getCourses *");
        $ionicLoading.hide();
        console.log('* getCourses returned value *');
        console.log(result);
        
        if (!result.data)
        {
          $scope.allok=false;
          $scope.error=$rootScope.i18n[$rootScope.loc].err01;
          $scope.errorValue="Error connecting server.";
          console.log("# error #");
        }
        else
        {
          $scope.allok=true;
          $scope.error=null;
          $scope.errorValue=null;
          console.log ("# no error #");
          // result.error contiene el mensaje de error si lo hay
          $scope.Courses = result.data.courses;
          // Progress
          $scope.applyProgress();
          //          
          CoursesService.setCoursesAndScores(result.data.courses,result.data.scores);
        }

      });
      console.log("* después de getCourses *");
    }
    else
    {
        $scope.allok=true;
        $scope.error=null;
        $scope.errorValue=null;
        console.log ("# se toma del caché intermedio #");
        $scope.Courses = CoursesService.getCourses(); 
        // Progress
        $scope.applyProgress();
        $ionicLoading.hide();        
    }


  });

  $scope.applyProgress=function()
  {
    console.log("* applyProgress *")

    if ($scope.userInfo) //Logueado
    {
      cp=$scope.userInfo.course_progress;
    }
    else
    {
      cp={}
    }
       
    var keys=Object.keys($scope.Courses);
    var n=keys.length;

    for(i=0;i<n;i++) 
    {
      course_id=$scope.Courses[keys[i]].id;
      sectioncount=$scope.Courses[keys[i]].sectioncount;
      testcount=$scope.Courses[keys[i]].testcount;
      if (cp[course_id])
        $scope.Courses[keys[i]].complete=Math.round(100*(cp[course_id][0]+cp[course_id][1])/(sectioncount+testcount));
//console.log("____________________");
//console.log($scope.Courses[keys[i]].complete);

      else
        $scope.Courses[keys[i]].complete=0;

    }

  }





})

