angular.module('starter').controller('CourseCtrl', function($scope, $rootScope, $stateParams, AuthService, CoursesService, UnitsService, ChatService, varGlobal, $ionicLoading, backendService, adsService, $ionicScrollDelegate, $ionicPosition, $ionicHistory, genService) {

  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) // por aquí pasará cada vez que se tenga que recargar(cacheada o no, ojo (si es cacheado no 'refresca pantalla', por ejemplo al cambiar de opción de menu (solo si se cambia) y al pulsar el botón de login)
  { 
    //$rootScope.viewTitle=$stateParams.title;
    $scope.debug=varGlobal.debugMode;
  });

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

  $scope.titulo=function()
  {
    if ($rootScope.loc=='es')
      return $scope.course.name
    else
      if ($rootScope.loc=='br')      
        return $scope.course.name_br
      else
        return $scope.course.name_en
  }

  genService.logEvent('Course ' + $stateParams.courseId);

  var userInfo = AuthService.getUserInfo();
  $scope.userInfo=userInfo;
  console.log("* CourseCtrl *",userInfo);

  adsService.showInterstitial(AdMob);

  var course_id=$stateParams.courseId;

  $scope.course=CoursesService.GetCourseById(course_id);

  if ($rootScope.loc=="es")
    $rootScope.viewTitle=$scope.course.name;
  else if ($rootScope.loc=="br")
    $rootScope.viewTitle=$scope.course.name_br;
  else
    $rootScope.viewTitle=$scope.course.name_en;

  $scope.cacheKey="course"+$scope.course.id;

  console.log(".....")  
  console.log(course_id)
  console.log($scope.course);
  console.log(".....")  

 
  console.log("***** course ******");
  console.log($scope.course);

  $scope.Units =[];



  $scope.$on('$ionicView.afterEnter', function(){
 
    console.log("* CourseCtrl:afterEnter *");

    genService.viewTrack(JSON.stringify({name:$ionicHistory.currentStateName(),params:$stateParams}))

    console.log("* antes de getUnits *");
    $ionicLoading.show();

    if (varGlobal.currentCourse.id!=$scope.course.id)
    {
      console.log("* LLAMA AL BACKEND *");
      varGlobal.currentCourse=$scope.course;
      $rootScope.forceCache=true; // Al quitar el 'boton' que habia en el item de 'recursos' o de la lista de cursos para poner / quitar de offline, ha de forzar si no está (que es lo que hacia cuando no estaba offline)      
      backendService.doGetCached($scope.cacheKey,'/v3/courses/'+$scope.course.id+'/lessons',$scope.userInfo,function(result) {

        console.log("* dentro de getUnits *");
        $ionicLoading.hide();
        console.log('* getUnits returned value *');
        console.log(result);

        $scope.error=null;
        if (!result)
          $scope.error=$rootScope.i18n[$rootScope.loc].err01;
        
        //console.log(result.courses);
        // result.error contiene el mensaje de error si lo hay
        $scope.Units = result.data.lessons;

        // Progress
        $scope.applyProgress();

        UnitsService.setUnits($scope.course.id,result.data.lessons);
      });
      console.log("* después de getUnits *");
    }
    else
    {  
      console.log("* NO LLAMA AL BACKEND *");

      if ($rootScope.forceCache) // Ha entrado desde el botón de la nube del item de la lista de cursos, ha de poner offline
      {
        genService.fromTmp("__"+$scope.cacheKey);    
      }

      $scope.Units = UnitsService.getUnits($scope.course.id);
      console.log($scope.Units)

      // Progress
      $scope.applyProgress();

      $ionicLoading.hide();
      
      if ($rootScope.loc=="es")
        $rootScope.viewTitle=$scope.course.name;
      else if ($rootScope.loc=="br")
        $rootScope.viewTitle=$scope.course.name_br;
      else
        $rootScope.viewTitle=$scope.course.name_en;

    }


  });






  $scope.openUnit=-1;

  $scope.itemClick = function(index) {
    console.log("* click *",index);
    if ($scope.openUnit==index)
      $scope.openUnit=-1;
    else
      $scope.openUnit=index;
  };







  $scope.plusClick=function(index){
    console.log("* click *",index);
    if ($scope.openItem==index)
      $scope.openItem=-1;
    else
      $scope.openItem=index;
  }


  $scope.applyProgress=function()
  {
    console.log("");
    console.log("*** applyProgress ***");
    console.log("");

    if (!localStorage.getItem("_lastUnit"))
      var _lastUnit={};
    else
      var _lastUnit=JSON.parse(localStorage.getItem("_lastUnit"));
    
console.log("---<<<---");
console.log($stateParams.title);
    if ($stateParams.title && parseInt($stateParams.title)!=0)
      var lv=parseInt($stateParams.title)
    else
      var lv=_lastUnit[$scope.course.id]
console.log(lv);
console.log("---<<<---");      


    var lastUnit=0;
    var lastVisited=0;

    if ($scope.userInfo) //Logueado
    {
      lp=$scope.userInfo.lesson_progress;
      sp=$scope.userInfo.section_progress;
      tp=$scope.userInfo.test_progress;
    }
    else
    {
      lp=sp=tp={};
    }
    var n=$scope.Units.length;
    for(i=0;i<n;i++) 
    {
      //console.log(i);
      lesson_id=$scope.Units[i].id;
      if (lv && lesson_id==lv)
        lastVisited=i;
      if (lp[lesson_id])
      {    
        $scope.Units[i].donelearn=lp[lesson_id][0];
        $scope.Units[i].donepractice=lp[lesson_id][1];
      }
      else
      {
        $scope.Units[i].donelearn=0;
        $scope.Units[i].donepractice=0;
      }


      // Sections
      var m=$scope.Units[i].sections.length;
      for(j=0;j<m;j++) 
      {
        section_id=$scope.Units[i].sections[j].id;
        if (sp[section_id])
        {
          $scope.Units[i].sections[j].complete=1;
          lastUnit=i;
        }
        else
          $scope.Units[i].sections[j].complete=0;

        $scope.Units[i].sections[j].ntests=0;
        $scope.Units[i].sections[j].complete_tests=0;

        if ($scope.Units[i].sections[j].new_date)
        {
          var nd=$scope.Units[i].sections[j].new_date.substr(0,19);
          var nw=genService.contentNewCheck("lessons",section_id,nd);
        }
        else
          var nw=false;
        $scope.Units[i].sections[j].new=nw;
      }

      // Tests
      var m=$scope.Units[i].tests.length;
      for(j=0;j<m;j++) 
      {
        test_id=$scope.Units[i].tests[j].id;        
        var l_id=$scope.Units[i].tests[j].lesson_section_id;
        var r=-1;
        if (l_id)
        {
          // buscar l_id
          for(ff=0;ff<$scope.Units[i].sections.length;ff++)
          {
            if ($scope.Units[i].sections[ff].id==l_id)
              r=ff;
          }
        }
        if (r!=-1)
          $scope.Units[i].sections[r].ntests=$scope.Units[i].sections[r].ntests+1;


        if (tp[test_id]!=="undefined")
        {
          $scope.Units[i].tests[j].complete=tp[test_id];
                      
          if (r!=-1) 
          {              
            if (tp[test_id]==1)
              $scope.Units[i].sections[r].complete_tests=$scope.Units[i].sections[r].complete_tests+1;
          }     
        }
        else
          $scope.Units[i].tests[j].complete=0;

        var test_id=$scope.Units[i].tests[j].id;
        if ($scope.Units[i].tests[j].new_date)
        {
          var nd=$scope.Units[i].tests[j].new_date.substr(0,19);
          var nw=genService.contentNewCheck("tests",test_id,nd);
        }
        else
          var nw=false;

        $scope.Units[i].tests[j].new=nw;

      }
      $scope.Units[i].progress=Math.round(($scope.Units[i].donepractice+$scope.Units[i].donelearn)*100/($scope.Units[i].sections.length+$scope.Units[i].tests.length));
    }  


  
    $scope.openItem=-1;

    console.log("************* COLOCAR *************")
    
    console.log(lastVisited);
    console.log(lv);
  
    setTimeout(function(){
      var el= document.getElementById('divU'+0);
      //console.log(el);
      var el = angular.element(el);
      //console.log(el);
      var pos0=$ionicPosition.offset(el).top;
      //console.log(pos0);
      var el= document.getElementById('divU'+(lastVisited+1)); // Los divs se numeran desde divU1, divU0 es el div que contiene el nombre del curso
      //console.log(el);
      var el = angular.element(el);
      //console.log(el);
      var posn=$ionicPosition.offset(el).top;
      //console.log(posn);
      var delta=posn-pos0;
      $ionicScrollDelegate.$getByHandle('miScroller').scrollTo(0, delta, true)
    },500);
    


    $scope.openItem=lastVisited;
    // lastUnit; // lastUnit es la unidad mayor (en orden) de la que hay alguna lección completada.
    $rootScope.extra=null;

    console.log("************* COLOCAR *************")

  }












})
