angular.module('starter').controller('settingsCtrl', function($scope,$rootScope,$state,$stateParams,backendService,$ionicLoading,AuthService,$ionicActionSheet,$ionicScrollDelegate,$ionicViewSwitcher,$ionicHistory,chat,CoursesService,varGlobal,$ionicPopup,genService,ChatService) {

  genService.logEvent("Settings")

  $scope.testvar = genService.getPlatform()


  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) 
  {
    console.log("* settingsCtrl:beforeEnter *")
    
    // Esto es para que en iOS aparezca el botón 'done'    
    if ( (typeof Keyboard != "undefined") && (typeof Keyboard.hideAccessoryBar != "undefined")  ) Keyboard.hideFormAccessoryBar(false)
    
    $scope.env=varGlobal.env
  
    $scope.userInfo=AuthService.getUserInfo()
    $rootScope.srchOn=false; //Desactivar búsqeda si está activa
    if ($scope.userInfo)
      $rootScope.viewTitle=$rootScope.i18n[$rootScope.loc]["sett_title"]
    else
      $rootScope.viewTitle=$rootScope.i18n[$rootScope.loc]["ci"]

  })

  $scope.$on( "$ionicView.beforeLeave", function( scopes, states ) 
  {
    console.log("* settingsCtrl:beforeLeave *")
    // Lo deja como está por defecto
    if ( (typeof Keyboard != "undefined") && (typeof Keyboard.hideAccessoryBar != "undefined")  ) Keyboard.hideFormAccessoryBar(true)
  })






$scope.XsendMail=function(){

  console.log("")
  console.log("* sendMail *");

  if ($rootScope.loc=="es")
  {
    var txtSubject="Tengo comentarios";
  }
  else
    if ($rootScope.loc=="br")
    {
      var txtSubject="Tenho comentários";
    }
    else
    {
      var txtSubject="I have feedback"
    }
console.log("AAAA")
  const email = $rootScope.i18n[$rootScope.loc].contact_mail;
console.log("BBBB")
  const subject = encodeURIComponent(txtSubject + " (" + genService.deviceId() + ")");
console.log("CCCC")
  const mailtoURL = `mailto:${email}?subject=${subject}`;
console.log("DDDD")
console.log("mailtoURL:",mailtoURL);
  // Forma directa (como hacía Cordova InAppBrowser con '_system')
  //  window.location.href = mailtoURL;
   window.Capacitor.Plugins.App.openUrl({ url: mailtoURL }).catch(err => {
    console.error("Error opening mail app:", err);
  }); 
console.log("EEEE")

}


if ($rootScope.loc=="es")
  {
    $scope.data=["Español","Inglés","Portugués"];
    $scope.datamodel="Español";
  }
else
  if ($rootScope.loc=="br")
    {
      $scope.data=["Espanhol","Inglês","Português"];
      $scope.datamodel="Português";
    }
  else
    {
      $scope.data=["Spanish","English","Portuguese"];
      $scope.datamodel="English";
    }

$scope.selectLang=function(cual){
  if (cual=="Español" || cual=="Spanish" || cual=="Espanhol")
  {
    $rootScope.loc="es";
    $scope.data=["Español","Inglés","Portugués"];
    $scope.datamodel="Español";
  }
  else
    if (cual=="Portugués" || cual=="Português" || cual=="Portuguese")
    {
      $rootScope.loc="br";
      $scope.data=["Espanhol","Inglês","Português"];
      $scope.datamodel="Português";      
    }
    else
    {
      $rootScope.loc="en";
      $scope.data=["Spanish","English","Portuguese"];
      $scope.datamodel="English";      
    }


}

  $scope.userInfo=AuthService.getUserInfo();

  $scope.preparado=false;





  $scope.getColor=function(cual){
  if (cual=="A")
    return "#61d164" //"#5cd35e"
  else  
    if (cual=="B" || cual=="B+")
      return "#61d1af" //"#21c7a4"
    else
      if (cual=="C" || cual=="C+")
        return "#61a8db" // "#258a9d"
      else
        return "#6160d1" // "#34589c"     
  }


  $scope.assign=function(){    
    console.log("*** settingsCtrl : assign start ***");


    $scope.preparado=false;

    $scope.userInfo=AuthService.getUserInfo();
    console.log("$scope.userInfo");
    console.log($scope.userInfo);
    console.log("$stateParams");
    console.log($stateParams);

    $scope.loginData.where="app.learn"; // A dónde tiene que ir al volver del modal

    $scope.user={};
    if ($stateParams.id!=undefined && $stateParams.id!="")
    {
      $scope.user.id=parseInt($stateParams.id);
      $scope.user.name=""; // Dummy user name 
      $scope.user.image="assets/no-avatar.gif";
      $scope.user.current_course_name=""; // Dummy course
      $scope.user.current_course_name_br="";
      $scope.user.current_course_name_en="";
      $scope.user.current_course_background="";
      $scope.user.current_course_image="";
      $scope.user.current_course_progress=0;
      $scope.currentUser=false;
      if ($scope.userInfo)
      {
        console.log("=============>");
        console.log($scope.userInfo.friends);
        if ($scope.userInfo.friends[$scope.user.id])
          $scope.user.friend=true;
        else
          $scope.user.friend=false;
        if ($scope.userInfo.ignored[$scope.user.id])
          $scope.user.ignored=true;
        else
          $scope.user.ignored=false;
        if ($scope.userInfo.ignoringMe[$scope.user.id])
          $scope.user.ignoringMe=true;
        else
          $scope.user.ignoringMe=false;
      }
      else
      { 
        $scope.user.friend=false;
        $scope.user.ignored=false;
        $scope.user.ignoringMe=false;
      }
    }
    else
    {
      if ($scope.userInfo)
      {
        $scope.user.id=$scope.userInfo.id;
        $scope.user.name=$scope.userInfo.name;
        $scope.user.image=$scope.userInfo.image;
        $scope.user.current_course_name=$scope.userInfo.current_course_name;
        $scope.user.current_course_name_br=$scope.userInfo.current_course_name_br;
        $scope.user.current_course_name_en=$scope.userInfo.current_course_name_en;
        $scope.user.current_course_background=$scope.userInfo.current_course_background;
        $scope.user.current_course_image=$scope.userInfo.current_course_image;
        $scope.user.current_course_progress=$scope.userInfo.current_course_progress;
        $scope.currentUser=true;
      }
      else
      {
        $scope.user.id=-1;
        $scope.currentUser=false;
      }
    }
    console.log($scope.user);

    $scope.preparado=true;
      console.log("*** settingsCtrl : assign end ***");
    }

    var selectTab=function(tab){
     
    $scope.queTab=tab;

    $rootScope.errorValue=null;

    console.log( "tab:"                , tab                                           , 
                 "$scope.userInfo:"    , ($scope.userInfo) ? $scope.userInfo    : "NO" , 
                 "$scope.user.id:"     , ($scope.user.id)  ? $scope.user.id     : "NO" , 
                 "$scope.userInfo.id:" , ($scope.userInfo) ? $scope.userInfo.id : "NO"   )

    if (tab==0 && (!$scope.userInfo || $scope.user.id!=$scope.userInfo.id) && $scope.user.id!=-1)
    {
      ///
        $scope.test="Cargando ..."
        $scope.progress=[];
        console.log("* antes de getProgress *");
        $ionicLoading.show();
        backendService.doGet('/v3/progress?user2_id='+$scope.user.id,$scope.userInfo,function(result) {
          console.log("* dentro de getProgress *");
          $ionicLoading.hide();
          console.log('* getProgress returned value *');
          console.log(result);
          //console.log(result.courses);
          // result.error contiene el mensaje de error si lo hay
          $scope.test="";
          $scope.progress=result.data.progress;

          $scope.user.name=result.data.userinfo.name;
          $scope.user.image=result.data.userinfo.image;
          $scope.user.current_course_name=result.data.userinfo.current_course_name;
          $scope.user.current_course_name_br=result.data.userinfo.current_course_name_br;
          $scope.user.current_course_name_en=result.data.userinfo.current_course_name_en;
          $scope.user.current_course_background=result.data.userinfo.current_course_background;
          $scope.user.current_course_image=result.data.userinfo.current_course_image;
          $scope.user.current_course_progress=result.data.userinfo.current_course_progress;
          $scope.user.expires_date=result.data.userinfo.expires_date;
          var ed=new Date(result.data.userinfo.expires_date);
          var hoy=new Date();
          if (ed>=hoy)
            $scope.user.premium=true;
          else
            $scope.user.premium=false;
        });
        console.log("* después de getProgress *");
      ///
    }


    if (tab==1)
    {
      ///
        $scope.test="Cargando ..."

        $scope.activity=[];

        console.log("* antes de getActivity *");
        $ionicLoading.show();
        backendService.doGet('/v3/activity?user2_id='+$scope.user.id,$scope.userInfo,function(result) {
          console.log("* dentro de getActivity *");
          $ionicLoading.hide();
          console.log('* getActivity returned value *');
          console.log(result);
          //console.log(result.courses);
          // result.error contiene el mensaje de error si lo hay
          $scope.test="";
          $scope.activity=result.data.activity;
          console.log("* activity *")
          console.log($scope.activity);

          /// Agrupar por fecha (y añadir el texto descriptivo)
          var fechas=[];
          var grouped={}
          var m=$scope.activity.length;
          for (i=0;i<m;i++)
          {
            var activity=$scope.activity[i]
            var fecha=activity.created_at.substring(0,10); // <- Era date en vez de created_at
            var n=fechas.indexOf(fecha);
            if (n==-1)
            {
              fechas.push(fecha);
              n=fechas.indexOf(fecha);
            }

            if (!grouped[n])
            {
              grouped[n]={"date":fecha,"activities":[]};
            }

            if (activity.type_action=="LEVEL_TEST_DONE")
            {
              activity.text="Has realizado el test de nivel";
              activity.text_br="Você tem feito o teste de nivelamento";
              activity.text_en="Level test done"
              activity.type=0;
            }
            else
              if (activity.type_action=="COURSE_STARTED")
              {
                activity.text="Has empezado el curso";  
                activity.text_br="Você iniciou o curso"                
                activity.text_en="Started the course";
                activity.type=1;
                activity.image="assets/course"+activity.entity_id+".png";
              }
              else
              {
                activity.text="Finalizaste el ejercicio"                
                activity.text_br="Você concluiu o exercício"
                activity.text_en="Test done"
                activity.type=2;

                activity.color=$scope.getColor(activity.type_action.substring(10,100));
              }

            grouped[n].activities.push( activity );
          }
          $scope.grouped=grouped;
          console.log("* grouped *");
          console.log($scope.grouped);

        });
        console.log("* después de getActivity *");
      ///
    }


    if (tab==2)
    {
      ///
        $scope.test="Cargando ..."

        $scope.record=[];

        console.log("* antes de getRecord *");
        $ionicLoading.show();
        backendService.doGet('/v3/record?user2_id='+$scope.user.id,$scope.userInfo,function(result) {
          console.log("* dentro de getRecord *");
          $ionicLoading.hide();
          console.log('* getRecord returned value *');
          console.log(result);
          //console.log(result.courses);
          // result.error contiene el mensaje de error si lo hay
          $scope.test="";
          $scope.record=result.data.record;
          console.log("* record *")
          console.log($scope.record);

          for (var i=0;i<$scope.record.length;i++)
          {
            console.log($scope.record[i].id);
            console.log($scope.Courses[$scope.record[i].id].complete);
            $scope.record[i].complete=$scope.Courses[$scope.record[i].id].complete;
          }


        });
        console.log("* después de getRecord *");
      ///
    }

  }




 $scope.$on( "$ionicView.afterEnter", function( scopes, states ) // por aquí pasará cada vez que se tenga que recargar(cacheada o no, ojo (si es cacheado no 'refresca pantalla', por ejemplo al cambiar de opción de menu (solo si se cambia) y al pulsar el botón de login)
  {
    console.log("*** settingsCtrl : afterEnter ***");

    $rootScope.debug=varGlobal.debugMode;

    $scope.userInfo=AuthService.getUserInfo();
    $scope.Courses = CoursesService.getCourses(); 
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

    $rootScope.errorValue=null;
  
    $scope.assign();
    if (true || $scope.userInfo && ($scope.userInfo.id==$scope.user.id) )
    {
      console.log("*** YO MISMO ***");
        $scope.tabOption=0;
        $scope.openItem=0;        
        selectTab($scope.tabOption);
    }
    else
      console.log("*** OTRO USUARIO ***");

  });



  console.log("* settingsCtrl : View enter *");
  $scope.assign();

  console.log($scope.user.id);
  if ($scope.currentUser)
    console.log(" *currentUser*");
  else
    console.log(" *not currentUser*");

  if (!$scope.tabOption)
  {
    $scope.tabOption=0;
    $scope.openItem=0;  
  }




  $scope.titulo=function(){
    if ($scope.userInfo)
    {
      if ($scope.currentUser)
      {
        ret=$rootScope.i18n[$rootScope.loc].sett_title;
      }
      else
      {
        ret=$rootScope.i18n[$rootScope.loc].sett_title;
      }
    } 
    else
      ret=$rootScope.i18n[$rootScope.loc].ci;
    return ret;
  }



  if ($scope.user.id!=-1) // Si no está logueado ni se trata de la info de otro usuarios
    selectTab(0);



  $scope.tabClick = function(index){
    console.log("* tabClick *",index);
    if (index==-1)
      var idx=0;
    else
      var idx=index;
    $scope.tabOption = idx;
    $scope.tab($scope.tabOption);
  };

  $scope.goProfile=function(param){
    console.log("* goProfile *");
    $state.go("app.profile");
  }

  $scope.goLegal=function(param){
    console.log("* goLegal *");
    $state.go("app.legal");
  }

  $scope.goCredits=function(param){
    console.log("* goCredits *");
    $state.go("app.credits",{title: "credits" });
  }

  $scope.goChatNorms=function(param){
    console.log("* goChatNorms *");
    $state.go("app.chatnorms",{title: "chatnorms" });
  }

  $scope.goLegal=function(param){
    console.log("* goLegal *");
    $state.go("app.legal");
  }

  $scope.persAds=function(param){
    console.log("* persAds *");
    $rootScope.RGPDModal.show();
  }

  $scope.goDownloads = function () {
    console.log("* goDownloads *");
    $state.go("app.downloads");
  }

  $scope.tab=function(tab){
    selectTab(tab);
  }

  $scope.goTour=function(){
    console.log("* goTour *");

    $rootScope.noFirstTime=true; // Para que no muestre el pop-up de personalizar anuncios.
    
    $state.go('app.tour');
  }


  $scope.plusClick=function(index){
    console.log("* click *",index);
    if ($scope.openItem==index)
      $scope.openItem=-1;
    else
      $scope.openItem=index;
  }

  $scope.humanDate=function(cual){
    //2016-03-02
    var dia=cual.substring(8,10);
    var mes=cual.substring(5,7);
    var any=cual.substring(0,4);

    if ($rootScope.loc=="en")
    {
      var meses=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      mes=meses[parseInt(mes)-1]
      currentYear=new Date().getFullYear().toString();
      if (any==currentYear)
        return mes+" "+dia;
      else
        return mes+" "+dia+", "+any;
    }
    else
      if ($rootScope.loc=="br")
      {
        var meses=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
        mes=meses[parseInt(mes)-1]
        currentYear=new Date().getFullYear().toString();
        if (any==currentYear)
          return mes+" "+dia;
        else
          return mes+" "+dia+", "+any;
      }
      else
      {      
        var meses=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
        mes=meses[parseInt(mes)-1]
        currentYear=new Date().getFullYear().toString();
        if (any==currentYear)
          return dia+" de "+mes;
        else
          return dia+" de "+mes+" de "+any;
      }

  }

  $scope.goTest=function(idx1,idx2){
    console.log("* goTest *");
    console.log(idx1);
    console.log(idx2);
    console.log($scope.grouped[idx1].activities[idx2].test_name);

    test_id=$scope.grouped[idx1].activities[idx2].entity_id;
    lesson_id=$scope.grouped[idx1].activities[idx2].lesson_id;

    console.log(lesson_id);
    console.log(test_id);
    
    $state.go("app.test",{ unitId: lesson_id, testId: test_id });
    //href="#/app/test/{{section.lesson_id}}/{{section.resources[1].id}}"
  }

  $scope.goCourse=function(idx1,idx2){
    console.log("* goCourse *");
    console.log(idx1);
    console.log(idx2);

    courseId=$scope.grouped[idx1].activities[idx2].entity_id;

    console.log(courseId);

    $rootScope.extra=true;
    $state.go('app.single',{courseId:courseId});

  }


  $scope.goTest2=function(idx1,idx2,idx3){
    console.log("* goTest2 *");
    //console.log(idx1);
    //console.log(idx2);
    //console.log(idx3);

    //console.log($scope.record[idx1].lessons[idx2].tests[idx3]);

    test_id=$scope.record[idx1].lessons[idx2].tests[idx3].id;
    lesson_id=$scope.record[idx1].lessons[idx2].tests[idx3].lesson_id;

    //console.log(lesson_id);
    //console.log(test_id);
    
    $state.go("app.test",{ unitId: lesson_id, testId: test_id });
    //href="#/app/test/{{section.lesson_id}}/{{section.resources[1].id}}"
  }




  $scope.doclick=function()
  {
    if (!$scope.userInfo)
      return;


    if ($rootScope.loc=="es")
    {
      txtCancel="Cancelar";
      txtUnblock="Desbloquear";
      txtOpen="Abrir privado";
      txtMark="Marcar como favorito";
      txtUnmark="Desmarcar como favorito";
    }
    else
      if ($rootScope.loc=="br")
      {
        txtCancel="Cancelar";
        txtUnblock="Desbloquear";        
        txtOpen="Abrir privado";
        txtMark="Marcar como favorito";
        txtUnmark="Desmarcar como favorito";
      }
      else
      {
        txtCancel="Cancel";
        txtUnblock="Unblock";
        txtOpen="Open private"
        txtMark="Mark as favorite";
        txtUnmark="Unmark as favorite";
      }

    btn1=txtOpen;

    if ($scope.user.friend)
      btn2=txtUnmark;
    else
      btn2=txtMark;

    var buttons= [
      { text: btn1 }, {text:btn2}
    ]


    var hideSheet = $ionicActionSheet.show({
      buttons: buttons,
//      destructiveText: txtUnblock,
      titleText: $scope.user.name,
      cancelText: txtCancel,
      cancel: function() {
          console.log("* cancel *");
        },
      buttonClicked: function(index2) {
        console.log("* buttonClicked *");
        
        console.log(index2);
        if (index2==1)
        {
          // Marcar / desmarcar como favorito
          console.log("* "+btn2+" *");
          var newState=!$scope.user.friend;

          console.log("------------------->");
          for(i=0;i<$rootScope.channels.length;i++)
          {
            var ch=$rootScope.channels[i].name;
            //console.log(ch);
            for (j=0;j<$rootScope.chatlist[ch].length;j++)
            {
              if ($rootScope.chatlist[ch][j].id == $scope.user.id)
              {
                var mark=" *";
                $rootScope.chatlist[ch][j].friend=newState;
              }
              else
              {
                var mark=""
              }
              console.log(" "+$rootScope.chatlist[ch][j].id+mark);
              console.log($scope.userInfo.friends[$scope.user.id]);
            }
          }
          $scope.user.friend=newState;

//////////
          var user_id=$scope.userInfo.id;
          var friend_id=$scope.user.id;
          if (newState)
            var onoff="1"
          else
            var onoff="0"

          var data={ user_id : user_id, friend_id : friend_id, onoff : onoff };

          console.log("* antes de markFriend *");
          $ionicLoading.show();

          backendService.doPost('/v3/markfriend',$scope.userInfo,data,function(result) {
            console.log("* dentro de markFriend *");
            $ionicLoading.hide();
            console.log('* markFriend returned value *');
            console.log(result);
          });
          console.log("* después de markFriend *");
//////////




          if (newState) //Añadir a la lista de amigos
          {
            $scope.userInfo.friends[$scope.user.id]=true;
            $scope.addToFriends($scope.user)                  
          }
          else //Eliminar de la lista de amigos
          {
            delete $scope.userInfo.friends[$scope.user.id]
          }

  
        } else 
          if (index2==0)
          {      
            $rootScope.openPrivate($scope.user.id);
          }
        return true;
        },
      destructiveButtonClicked: function() {
        console.log("* Bloqueo *");
        $rootScope.ignoreUser($scope.user.id);
        $scope.user.ignored=!$scope.user.ignored;
        return true;
      }
    });


  }

  $scope.courseClick=function(courseId){
    $rootScope.extra=true;
    $state.go('app.single',{courseId:courseId});
  }


  $scope.datos={};
  $scope.datos.loces=($rootScope.loc=="es");
  $scope.datos.locbr=($rootScope.loc=="br");  
  $scope.datos.locen=($rootScope.loc=="en");
  $scope.langToggle=function(val)
  {
    if (val==0)
    {
      $rootScope.loc="es";
      var cap="Estudiantes";
      $scope.datos.loces=true;
      $scope.datos.locen=false;
      $scope.datos.locbr=false;
    }
    else
      if (val==1)
      {
        $rootScope.loc="en";
        var cap="Students";
        $scope.datos.loces=false;
        $scope.datos.locen=true;
        $scope.datos.locbr=false;
      }
      else
      {
        $rootScope.loc="br";
        var cap="Estudantes";
        $scope.datos.loces=false;
        $scope.datos.locen=false;
        $scope.datos.locbr=true;
      }

    for(i=0;i<$rootScope.channels.length;i++)
    {
      if ($rootScope.channels[i].name==chat.publicChannelName)
      {
        $rootScope.channels[i].caption=cap;
      }
    }

    window.localStorage.setItem("locale",$rootScope.loc);
  }


$scope.addToFriends=function(user)
{

  console.log(user)
  if (user.id>chat.currentUser.id)
    var chan="private-"+user.id+"_"+chat.currentUser.id;
  else
    var chan="private-"+chat.currentUser.id+"_"+user.id;

  // Comprobar si ya existe, si no añadirlo y rellenarlo (indirectamente se crea en localStorage ???) <- Localstorage vacio, sin mensajes??
  c=-1;
  for (i=0;i<$rootScope.channels.length;i++)
  {
    if ($rootScope.channels[i].name==chan)
      c=i;
  }  
  if (c==-1) // No existe, se crea
  {
    // Se pone algo en lastUser para que aparezca en la lista de chats aunque no haya ningun mensaje.
    $rootScope.channels.push({name:chan,type:2,state:0,badge:0, muted:false,caption:user.name,img:user.image, lastChat:"", lastUser: user.name, lastUpdated:""});  
    $rootScope.messages[chan]=[];
    $rootScope.chatlist[chan]=[];

    var d=-1;
    for(nnn=0;nnn<$rootScope.chatlist[chat.publicChannelName].length;nnn++)
    {
      if ($rootScope.chatlist[chat.publicChannelName][nnn].id==user.id)
        d=nnn;
    }
    
    if (d!=-1)
    {
        var info=$rootScope.chatlist[chat.publicChannelName][d];
        $rootScope.chatlist[chan].push(info);    
        window.localStorage.setItem("messages-"+$scope.userInfo.id+"-"+chan,JSON.stringify($rootScope.messages[chan]))
        window.localStorage.setItem("chatlist-"+$scope.userInfo.id+"-"+chan,JSON.stringify($rootScope.chatlist[chan]))
    }
  }

}










  $scope.dbg=function(event)
  {  
    console.log(" * dbg *" );
    
    if ( viewDBG )
    {
      console.log("* Go debug view *" );
      $state.go( "app.myfriends2" );
    }
  }


})
