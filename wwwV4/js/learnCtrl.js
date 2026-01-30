angular.module('starter').controller('learnCtrl', function($scope, $rootScope, AuthService, $ionicLoading, CoursesService , backendService, varGlobal, adsService, $ionicHistory, $stateParams, genService, $ionicScrollDelegate, $timeout) {

  window.addEventListener( "scroll", function( event ) {
    console.log("aaaaa");
  });

  $scope.genService=genService;

  $scope.checkScroll=function(){
    return false;

    var currentTop = $ionicScrollDelegate.$getByHandle('scroller').getScrollPosition().top;
    var maxTop = $ionicScrollDelegate.$getByHandle('scroller').getScrollView().__maxScrollTop;

    if (currentTop < 0 )
    {
      // hit the top
      console.log("* top of scroll *");
    }

    if (currentTop >= maxTop)
    {
      // hit the bottom
      console.log('* bottom of scroll *');
    }  
  }

  $scope.checkItemCourse=function(course_id){
    return genService.checkItem("__course"+course_id);
  }

  $scope.descarga=function(course_id)
  {
    var key="__course"+course_id;
    if (genService.checkItem(key)) // Quitar el curso de offline
    {
      genService.toTmp(key); 
      genService.removeItem(key);        
      $rootScope.forceCache=false;
    }
    else // Poner el curso offline
    {
      $rootScope.forceCache=true;
    }
  }

  genService.logEvent("Learn");

  $scope.cacheKey="courseslist";

  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) // por aquí pasará cada vez que se tenga que recargar(cacheada o no, ojo (si es cacheado no 'refresca pantalla', por ejemplo al cambiar de opción de menu (solo si se cambia) y al pulsar el botón de login)
  {
    console.log("* learnCtrl: $ionicView.beforeEnter *");
    console.log($rootScope.loc);

    $rootScope.viewTitle=$rootScope.i18n[$rootScope.loc]["lear_title"];

    $scope.debugMode=varGlobal.debugMode;
    genService.viewTrack(JSON.stringify({name:$ionicHistory.currentStateName(),params:$stateParams})); 

    console.log(states.fromCache); //true si viene de caché
    console.log(states.stateName); //app.playlists
    $scope.userInfo=AuthService.getUserInfo(); // Si esto cambia, se refrescará en consecuencia la parte del view que depende de 'userInfo'.
  });

  $scope.$on('$ionicView.beforeLeave', function(){
    console.log("* learnCtrl: $ionicView.beforeLeave *")    
    $rootScope.flash01=false;
    $rootScope.flash02=false;
    console.log("* Desactiva flash01 y flash02 *")
  });




  $scope.$on('$ionicView.enter', function(){

      var _flash01=window.localStorage.getItem("_flash01");
      if (!_flash01)
        {
          setTimeout(function () {
            console.log("* Activa flash01 *");    
            if(!$scope.$$phase) {
              $scope.$apply(function() {
                $rootScope.flash01=true;
              });   
            }
            else
            {
              $rootScope.flash01=true;
            }
          }, 500);
        }

      else
        {

          var _flash02=window.localStorage.getItem("_flash02");
          if (!_flash02)
            {

              setTimeout(function () {
                console.log("* Activa flash02 *");    
                if(!$scope.$$phase) {
                  $scope.$apply(function() {
                    $rootScope.flash02=true;
                  });   
                }
                else
                {
                  $rootScope.flash02=true;
                }
              }, 800);

            }

        }
        
  });

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
      else
        $scope.Courses[keys[i]].complete=0;
    }

  }

})
