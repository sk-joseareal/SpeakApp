angular.module('starter').controller('profileCtrl', function($scope,$rootScope,$state,$stateParams,backendService,$ionicLoading,AuthService,Upload,$cordovaFile,$ionicPopup,varGlobal,adsService,genService) {
  
  genService.logEvent("Profile");

  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) 
  {
    $rootScope.viewTitle=$rootScope.i18n[$rootScope.loc]["prof_title"];  
  });




  $scope.clearInput=function(cual)
  {
    console.log(cual);
  }


  $scope.pepe=""

  $scope.userInfo = AuthService.getUserInfo();
  console.log("*> profileCtrl *<");
  console.log($scope.userInfo);

  var datos={};
  datos.first_name=$scope.userInfo.first_name;
  datos.last_name=$scope.userInfo.last_name;

  $scope.imagen=$scope.userInfo.image

  /*
  var any=$scope.userInfo.birthdate.substr(0,4);
  var mes=$scope.userInfo.birthdate.substr(5,2);
  var dia=$scope.userInfo.birthdate.substr(8,2);
  datos.birthdate=dia+"/"+mes+"/"+any;
  */

  datos.birthdate=new Date($scope.userInfo.birthdate);

  datos.email=$scope.userInfo.email;
  datos.password="";
  datos.confirmation="";
  if ($scope.userInfo.sex==2){
    datos.man=false;
    datos.woman=true;
  } else {
    datos.man=true;
    datos.woman=false;
  }
  if ($scope.userInfo.lc=="en-gb"){
    datos.usa=false;
    datos.britain=true;
  } else {
    datos.usa=true;
    datos.britain=false;
  }


  $scope.datos=datos;

  $scope.toggle1=function(valor){
    if (valor==0)
    {
      $scope.datos.man=true;
      $scope.datos.woman=false;
    } else
    {
      $scope.datos.man=false;
      $scope.datos.woman=true;
    }
  }
  $scope.toggle2=function(valor){
    if (valor==0)
    {
      $scope.datos.usa=true;
      $scope.datos.britain=false;
    } else
    {
      $scope.datos.usa=false;
      $scope.datos.britain=true;
    }
  }

  $scope.changeAvatar=function(){
    console.log("* changeAvatar *");

    var fileInput = document.getElementById('uploadFile');
    fileInput.click();
  }

  $scope.onFileSelect=function(file,invalidFiles){
    console.log("* onFileSelect *");
    console.log(file);
    console.log(invalidFiles);
    if (!file && invalidFiles.length==0)
    {
      console.log("* ni file ni invalifFiles, return *");
      return;
    }

    if (!file){
      $scope.pepe="";

      $ionicPopup.alert({
        title: 'Atención',
        content: 'Error cargando imágen.'
      }).then(function(res) {
        console.log('Error cargando imágen.');
      });

      return;
    
    }

    console.log("-------------");

    $scope.upload(file);

  }

  $scope.upload = function (file) {


 $ionicLoading.show();

    var endpoint='/v3/fileupload'

    console.log("* endpoint: ["+endpoint+"]")

    var user_id=$scope.userInfo.id;
    var token=$scope.userInfo.token;
    var timestamp=Math.round(+new Date()/1000);
    
    var data={file: file, 'user_id': user_id, 'token': token, 'timestamp': timestamp};
    

  console.log("* endpoint *");          
  console.log(endpoint);
  console.log("* data *");
  console.log(data);    

  var hash = CryptoJS.HmacSHA256(endpoint, varGlobal.auth_key);
  var signature = CryptoJS.enc.Base64.stringify(hash);
          
  console.log("* signature *");
  console.log(signature)

  var endpoint2=endpoint+"?timestamp="+timestamp+"&user_id="+user_id+"&token="+token;

  console.log("* endpoint2: ["+endpoint2+"]")

  var hash2 = CryptoJS.HmacSHA256(endpoint2, varGlobal.auth_key);
  var signature2 = CryptoJS.enc.Base64.stringify(hash2);

  console.log("* signature2 *");
  console.log(signature2)

  if (varGlobal.authOn)
  {
    var headers = { "Authorization" : signature2 };
  }
  else
  {
    var headers = { "X-Testing" : "testing" };
  }
  var config = { headers: headers };
 

   

    console.log( "* upload *" )
    Upload.upload({
      url: varGlobal.apiURL+endpoint,
      headers: headers,  
      data: data
    }).then(function ( resp ) {
      console.log( '  *** Success ' + resp.config.data.file.name + ' uploaded. Response: ' )
      console.log( resp.data )

      AuthService.updateUserAvatar( resp.data.image_url ) // Ahi a la imagen se le añade el ?xxxxx para forzar a que se refresque

      console.log("----------")
      console.log( $scope.userInfo.image )
      console.log("----------")

      $scope.imagen = $scope.userInfo.image
      $scope.pepe = $scope.userInfo.image
      $ionicLoading.hide()

    }, function (resp) {
      console.log('  *** Error status: ' + resp.status);
      $ionicLoading.hide();
    }, function (evt) {
      var progressPercentage = parseInt(100.0 * evt.loaded / evt.total);
      console.log('  *** progress: ' + progressPercentage + '% ' + evt.config.data.file.name);
    });
  };




  $scope.updateProfile= function()
  {
    console.log("* updateProfile *");
    console.log($scope.datos);
    if (($scope.datos.password!="" || $scope.datos.confirmation!="") && $scope.datos.password!=$scope.datos.confirmation)
    {
      $scope.error="La confirmación no coincide con la contraseña."
      return
    }
    $scope.error=""


    var usrData={}
    usrData.first_name=$scope.datos.first_name
    usrData.last_name=$scope.datos.last_name
    usrData.name=( $scope.datos.first_name.trim()+" "+$scope.datos.last_name.trim() ).trim();
    usrData.birthdate=$scope.datos.birthdate.toISOString();
    usrData.email=$scope.datos.email
    usrData.password=$scope.datos.password
    if ($scope.datos.woman)
      usrData.sex=2
    else
      usrData.sex=1
    if ($scope.datos.britain)
      usrData.lc="en-gb"
    else
      usrData.lc="en-us"

    console.log(usrData);

    console.log("* antes de updateProfile *");
    $ionicLoading.show();

    backendService.doPost('/v3/usr/updateprofile',$scope.userInfo,usrData,function(result) {

      console.log("* dentro de updateProfile *");
      $ionicLoading.hide();
      console.log('* updateProfile returned value *');
      console.log(result);
      $scope.error=result.data.error;

      if ($scope.error=="")
      {        
        AuthService.updateUserInfo(usrData);
        $scope.userInfo=AuthService.getUserInfo();
        //console.log($scope.userInfo);
      }

    });
    console.log("* después de updateProfile *");

  }




})
