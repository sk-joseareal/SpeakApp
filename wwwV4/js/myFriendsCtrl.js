angular.module('starter').controller('myFriendsCtrl', function(Upload, $rootScope, $scope, $stateParams, AuthService, ChatService, varGlobal, $cordovaFile, $ionicScrollDelegate, $ionicPosition, $http, $ionicLoading, chat, genService, $window, backendService, CoursesService, $cordovaFileTransfer, $timeout, adsService, $ionicModal, $state) {

$scope.pusherMembers = function()
{
  console.log( "----------" )
  console.log( "chat.pusher.channel( 'presence-site-wide-chat-channel' ).members.members:")
  console.log( chat.pusher.channel( 'presence-site-wide-chat-channel' ).members.members )
  const members = Object.values( chat.pusher.channel( 'presence-site-wide-chat-channel' ).members.members )
  console.log( "----------" )
  console.log( "members:", members )
  console.log( members.filter( m => m.hidden!=true ).map( m => m.name ) )
  console.log( "----------" )
}





$scope.adbmobPlusInit = function()
{
  console.log("* adbmobPlusInit *")

  var banner = null
  if( /(android)/i.test(navigator.userAgent) ) 
  {
    //var admobid = { banner:'ca-app-pub-7994364056975402/2301384119', interstitial:'ca-app-pub-7994364056975402/4260842519', rewarded:'ca-app-pub-7994364056975402/1092865027' };
    banner = new admob.BannerAd( { adUnitId: 'ca-app-pub-7994364056975402/2301384119' } )

  }
  else if(/(ipod|iphone|ipad)/i.test(navigator.userAgent))
  {
    //var admobid = { banner:'ca-app-pub-7994364056975402/9924846977', interstitial:'ca-app-pub-7994364056975402/1167775318', rewarded:'ca-app-pub-7994364056975402/6919906777' };
    banner = new admob.BannerAd( { adUnitId: 'ca-app-pub-7994364056975402/9924846977' } )
  }

  console.log("----- banner -----")
  console.log(banner)
  console.log("------------------")  

  banner.show()

}




  $scope.esiOS = function()
  {
    return r34lp0w3r.platform != 'android';
  }

  function loadImageFromFile(filename, imgElement) {
    // filename is cdvfile:....... (string)
    // imgElement is target IMG element name (string)
    window.resolveLocalFileSystemURL(filename, function success(fileEntry) {
      fileEntry.file(function (file) {
        var reader = new FileReader()
        reader.onloadend = function() {
          if (reader.result) {
            var elem = document.getElementById(imgElement)
            var blob = new Blob([new Uint8Array(reader.result)], { type: "image/png" })
            elem.src = window.URL.createObjectURL(blob)
            window.URL.revokeObjectURL(blob)
          }
        }
        reader.readAsArrayBuffer(file)
      })
    }, function () {
        console.log( "File not found: " + filename )
    })
  }


  $scope.testImage_internal = "/assets/no-avatar.gif"
  $scope.testImage_iOS = "/assets/no-avatar.gif"

  $scope.imgTest_S3 = function()
  {

  //console.log(">>> cordova.file >>>")
  //Object.keys(cordova.file).forEach( (k) => {
  //  console.log( k, cordova.file[k] )
  //} )

  /* iOS
    applicationDirectory                  file:///private/var/containers/Bundle/Application/385D46B1-E151-4F25-91D0-DFA2B1F6E3A3/English%20Course.app/
    applicationStorageDirectory           file:///var/mobile/Containers/Data/Application/491880FD-9FBD-4025-BE46-B5FA2C248624/
    dataDirectory                         file:///var/mobile/Containers/Data/Application/491880FD-9FBD-4025-BE46-B5FA2C248624/Library/NoCloud/
    cacheDirectory                        file:///var/mobile/Containers/Data/Application/491880FD-9FBD-4025-BE46-B5FA2C248624/Library/Caches/
    externalApplicationStorageDirectory
    externalDataDirectory
    externalCacheDirectory
    externalRootDirectory
    tempDirectory                         file:///private/var/mobile/Containers/Data/Application/491880FD-9FBD-4025-BE46-B5FA2C248624/tmp/
    syncedDataDirectory                   file:///var/mobile/Containers/Data/Application/491880FD-9FBD-4025-BE46-B5FA2C248624/Library/Cloud/
    documentsDirectory                    file:///var/mobile/Containers/Data/Application/491880FD-9FBD-4025-BE46-B5FA2C248624/Documents/
    sharedDirectory
  */

  /* Android
    applicationDirectory                  file:///android_asset/
    applicationStorageDirectory           file:///data/user/0/com.sokinternet.cursoingles/
    dataDirectory                         file:///data/user/0/com.sokinternet.cursoingles/files/
    cacheDirectory                        file:///data/user/0/com.sokinternet.cursoingles/cache/
    externalApplicationStorageDirectory   file:///storage/emulated/0/Android/data/com.sokinternet.cursoingles/
    externalDataDirectory                 file:///storage/emulated/0/Android/data/com.sokinternet.cursoingles/files/
    externalCacheDirectory                file:///storage/emulated/0/Android/data/com.sokinternet.cursoingles/cache/
    externalRootDirectory                 file:///storage/emulated/0/
    tempDirectory                         null
    syncedDataDirectory                   null
    documentsDirectory                    null
    sharedDirectory                       null
  */

  console.log("<<<")

    var src  = "https://s3.amazonaws.com/sk.audios.dev/avatars/2423882/original/image.gif"
    var file = "avatar.jpeg"
    var dst  = cordova.file.dataDirectory + file

    console.log( ">>> src:", src )
    console.log( ">>> file:", file)
    console.log( ">>> dst (cordova.file.dataDirectory + file) :", dst )

    $cordovaFileTransfer.download(src, dst, {}, true).then
    (
      function (result) {

        console.log( ">>>" )
        console.log( ">>> FileTransfer -> Success." )
        console.log( ">>> result:" + JSON.stringify(result) )
        /* {
              "isFile":true,
              "isDirectory":false,
              "name":"testImage.gif",
              "fullPath":"/testDir/testImage.gif",
              "filesystem":"<FileSystem: library-nosync>",
              "nativeURL":"file:///var/mobile/Containers/Data/Application/8A4CE283-5506-41AD-8CF9-7321BCA6CFAD/Library/NoCloud/testDir/testImage.gif"
        } */
        console.log( ">>> result.nativeURL:", result.nativeURL )
        console.log( ">>> result.toInternalURL():", result.toInternalURL() )
        console.log( ">>>" )

        var testImage_internal = result.toInternalURL()

        // Obviamente, WkWebView sólo existe en iOS
        if (!ionic.Platform.isAndroid())
          var testImage_WkWV = WkWebView.convertFilePath(result.nativeURL)
        else 
          var testImage_WkWV = "( Android, no aplicable )"

        loadImageFromFile( testImage_internal, "testImage" )

        if (!$rootScope.$$phase) {
          $rootScope.$apply(function () {
            $scope.src = src
            $scope.file = file
            $scope.dst = dst
            $scope.testImage_internal = testImage_internal
            $scope.testImage_WkWV = testImage_WkWV

          })
        }
        else {
          $scope.src = src
          $scope.file = file
          $scope.dst = dst
          $scope.testImage_internal = testImage_internal
          $scope.testImage_WkWV = testImage_WkWV
        }

      },
      function (error) {

        console.log( ">>>" )
        console.log( ">>> FileTransfer -> Error." )
        console.log( ">>> " + JSON.stringify(error) )
        console.log( ">>>" )

      }
    )

  } 


  $scope.imgTest_fs = function()
  {

    var src = "-"
    var file = "avatar.jpeg"
    var dst  = cordova.file.dataDirectory + file

    // file:///data/user/0/com.sokinternet.cursoingles/files/avatar.jpeg

    // file:///var/mobile/Containers/Data/Application/FFF85810-ABF7-4816-906E-9ED34D5CCD42/Library/NoCloud/avatar.jpeg

    // Obviamente, WkWebView sólo existe en iOS
    if (!ionic.Platform.isAndroid())
      var testImage_WkWV = WkWebView.convertFilePath(dst)
    else 
      var testImage_WkWV = "( Android, no aplicable )"

    window.resolveLocalFileSystemURL(dst,
    function( entry )
    {
      var testImage_internal = entry.toInternalURL()

      loadImageFromFile( testImage_internal, "testImage" )

      if (!$rootScope.$$phase) {
        $rootScope.$apply(function () {
          $scope.src = src
          $scope.file = file
          $scope.dst = dst
          $scope.testImage_internal = testImage_internal
          $scope.testImage_WkWV = testImage_WkWV

        })
      }
      else {
        $scope.src = src
        $scope.file = file
        $scope.dst = dst
        $scope.testImage_internal = testImage_internal
        $scope.testImage_WkWV = testImage_WkWV
      }


    },
    function( error ) {
      console.log( "--> resolveLocalFileSystemURL: Error", JSON.stringify( error ) )
    })

  }






$scope.pluginStateColor=function(cual)
{
  if (okPlugin[cual][2]=="-----" || okPlugin[cual][2]==null)
    return "gris";
  else
  {
    if (!okPlugin[cual][2])
      return "rojo";
    else
      if (okPlugin[cual][0]!=okPlugin[cual][1])
        return "naranja"
      else
        return "verde"
  }
  return 0;
}

$scope.pluginStateSym=function(cual) 
{
  if (cual=="-----")
    return "-"
  else
    if (cual==true)
      return " "
    else
      if (cual==false)
        return "x"
      else
        return "?"
}


$scope.mp3_OK=function()
{
  console.log("* mp3_OK *");
}
$scope.mp3_KO=function(err) {
  console.log("* mp3_KO *");
  console.log(JSON.stringify(err));
}
$scope.mp3_test_remoto=function()
{
  console.log("* mp3_test_remoto *");
  var URL="https://s3.amazonaws.com/sk.audios/speech.US-E/00029/US-E/000290300700501.mp3";
  $scope.media = new Media(URL, $scope.mp3_OK, $scope.mp3_KO);
  $scope.media.play();
}
$scope.mp3_test_iOS = function () {
  console.log("* mp3_test_iOS *");
  var URL = (cordova.file.dataDirectory + "audio/sections/00029/US-E/000290300200001.mp3").substring(7);
  $scope.media = new Media(URL, $scope.mp3_OK, $scope.mp3_KO);
  $scope.media.play();
}
$scope.mp3_test_Android = function () {
  console.log("* mp3_test_Android *");
  var URL = "file:///data/data/com.sokinternet.cursoingles/files/audio/sections/00029/US-E/000290300200001.mp3";
  $scope.media = new Media(URL, $scope.mp3_OK, $scope.mp3_KO);
  $scope.media.play();
}

$scope.mp3_test_local = function() 
{
  console.log( "* mp3_test_iOS_local *" );
  var URL = "https://s3.amazonaws.com/sk.audios/speech.US-E/00029/US-E/000290300700501.mp3";
  var URLPlay = ( cordova.file.dataDirectory + "audio/tmp/tmp.mp3" ); 
  if ( r34lp0w3r.platform == 'ios' )
    URLPlay = URLPlay.substring( 7 ) ;
  $scope.media = new Media( URLPlay, $scope.mp3_OK, $scope.mp3_KO );
  $scope.downMP3( URL, function( result ) { if( result.codigo == 0 ) $scope.media.play(); else console.log( result.txt ); } );
}

$scope.play_test = function()
{
  console.log("* play_test *")
  backendService.Play("This is a test.",$scope.userInfo);
}

$scope.downMP3=function(file,cb)
{
  var src = file;
  var dir0= "audio";
  var dir = "audio/tmp";
  var dst = cordova.file.dataDirectory + dir + "/tmp.mp3";
  console.log(" " + src + " -> " + dst);
  $cordovaFile.createDir(cordova.file.dataDirectory, dir0, true).then(function (success) {    
    $cordovaFile.createDir(cordova.file.dataDirectory, dir, true).then(function (success) 
    {
      $cordovaFileTransfer.download(src, dst, {}, true).then
        (
          function (result) {
            console.log(">>>");
            console.log(">>> FileTransfer -> Success.");
            console.log(JSON.stringify(result));
            console.log(">>>");
            cb( { codigo: 0, txt:"* archivo descargado *" } );
          },
          function (error) {
            console.log(">>>");
            console.log(">>> FileTransfer -> Error.");
            console.log(JSON.stringify(error));
            console.log(">>>");
            cb( { codigo: 1, txt:"* error descargando archivo *" } );
          }
        );
    }, function (error) {
      console.log("# " + dst + " #");
      console.log("# Error creando el directorio ["+dir+"]: " + error);
      cb( { codigo: 3, txt:"* error creando directorio *" } );
    });  
  }, function (error) {
    console.log("# " + dst + " #");
    console.log("# Error creando el directorio [" + dir0 + "]: " + error);
    cb({ codigo: 3, txt: "* error creando directorio *" });
  });
  
}





////////////////////////////////////////////
$scope.cancelMediaTick=function()
{
  if ($scope.mediaStepTick) {
    console.log("* Cancela mediaStepTick.");
    $timeout.cancel($scope.mediaStepTick);
    $scope.stepTick = null;
  }
  else {
    console.log(" -> Ya era null.");
  } 
}
$scope.mediaTestOK=function()
{
  console.log("* mediaTestOK *");
  console.log($scope.media);
  $scope.media.release(); // Pruebo si poniendo esto se resuelve lo de que en iOS se van acumulando llamadas a mediaTestOK. <- NO
  console.log($scope.media);
//  delete $scope.media;
  console.log($scope.media);
  console.log("-----");
  $scope.cancelMediaTick();  
  if ($scope.mediaTestStepNum < $scope.steps) 
  {
    console.log("* Crea mediaStepTick.")
    $scope.mediaStepTick = $timeout($scope.mediaTestStep, $scope.pauseLen);
  }
}
$scope.mediaTestLocalKO = function (err) {
  console.log("* mediaTestLocalKO *");
  console.log("* err: " + JSON.stringify(err) + " *");
  $scope.cancelMediaTick();
}
$scope.mediaTestS3KO=function(err)
{
  console.log("* mediaTestS3KO *");
  console.log("* err: "+JSON.stringify(err)+" *");
  $scope.cancelMediaTick();

  console.log("* S3URL: '" + $scope.S3URL + "'");
  //$scope.media.stop(); Comento esto por que es el responsable de que en Android se llame a mediaTestS3KO con err: {"code":0}
//  $scope.media.release(); Comento para ver si es responsable de la acumulacion de OK en iOS. <- NO
  $scope.media = new Media($scope.S3URL, $scope.mediaTestOK, $scope.mediaTestLocalKO);
  $scope.media.play();  
}
$scope.mediaTestStep=function()
{
  $scope.mediaTestStepNum++;
  console.log("*");
  console.log("* mediaTestStep : audioStepNum " + $scope.mediaTestStepNum+" *");
    
  var mp3="000290300000000.mp3";
  //var mp3 = $scope.Unit.sections[$scope.currentSlide].audio[field].mp3[$scope.currentStep - 1];
  console.log("* mp3: '"+mp3+"'");

  var lesson = mp3.substring(0, 5);

  $scope.S3URL = "https://s3.amazonaws.com/sk.audios/speech." + $scope.voice + "/" + lesson + "/" + $scope.voice + "/" + mp3;
  if ( r34lp0w3r.platform == 'browser' )
    $scope.localURL = "assets/speech/" + lesson + "/" + $scope.voice + "/" + mp3;
  else
  {
    $scope.localURL = cordova.file.dataDirectory + "audio/sections/" + lesson + "/" + $scope.voice + "/" + mp3;
    if (!ionic.Platform.isAndroid()) // En iOS hay que quitar el leading 'file://'
      $scope.localURL = $scope.localURL.substring(7);
  }

  console.log("* localURL: '" + $scope.localURL+"'");
  $scope.media = new Media($scope.localURL, $scope.mediaTestOK, $scope.mediaTestS3KO);
  $scope.media.play();
}
$scope.mediaTick = function () {
  console.log("* STEP TICK *");
  if ($scope.stepTick) {
    console.log(" -> lo cancela.");
    $timeout.cancel($scope.stepTick);
    $scope.stepTick = null;
  }
  else {
    console.log(" -> Ya era null.");
  }
  $scope.deltaClick(1);
}
/// >>>
$scope.voice = "US-E";
$scope.pauseLen = 2000;
$scope.steps = 3;

$scope.mediaTest=function()
{
  $scope.mediaTestStepNum = 0;
  $scope.mediaTestStep();
}
////////////////////////////////////////////

  


$scope.echoTest=function()
{

  console.log("* echoTest:echo *");
  window.plugins.P4w4Echo.echo("Lenguajes disponibles en TTS.", function (p) { console.log("*success*"); console.log(p); }, function (p) { console.log("*fail*"); console.log(p); });

  console.log("* echoTest:pollas *");
  window.plugins.P4w4Echo.pollas("Lenguajes disponibles en TTS.", function (p) { console.log("# success #"); console.log("# Resultado: '"+p+"' #"); alert(p) }, function (p) { console.log("# fail #"); console.log(p); });

}





  $scope.datos = {};
  $scope.datos.frmQueVoz = "usf";
  $scope.loc="en-US";
  $scope.gen="Female";
  $scope.setQueVoz=function()
  {
    switch ($scope.datos.frmQueVoz) {
      case "usf":
        $scope.loc = "en-US";
        $scope.gen = "Female";        
        break;
      case "usm":
        $scope.loc = "en-US";
        $scope.gen = "Male";
        break;
      case "gbf":
        $scope.loc = "en-GB";
        $scope.gen = "Female";
        break;
      case "gbm":
        $scope.loc = "en-GB";
        $scope.gen = "Male";
        break;    
    }
  }




  

  $scope.voces = [];
  $scope.hashVoces = {};
  $scope.datos.frmVoz = $scope.voces[0];
  $scope.datos.frmText = "Testing audio"

  if (typeof window.speechSynthesis!="undefined")
  {
    voices = window.speechSynthesis.getVoices();
    voices_US = [];
    voices_GB = [];
    for (i = 0; i < voices.length; i++) {
      name = voices[i].name;
      lang = voices[i].lang;
      if (voices[i].default)
        def = " (Default)"
      else
        def = ""
      console.log(i, name + ' [' + lang + ']' + def);

      if (lang == "en-US")
        voices_US.push([i, name]);
      if (lang == "en-GB")
        voices_GB.push([i, name]);

      var voz = name + ' [' + lang + ']' + def;
      $scope.voces.push(voz);
      $scope.hashVoces[voz] = i;

    }
    console.log(JSON.stringify({ "voices_US": voices_US }));
    console.log(JSON.stringify({ "voices_GB": voices_GB }));
  }



  






$scope.queEs=function(que){ typeof que }
$scope.esString=function(que){ typeof que ==="string" }
$scope.getVersion=function(que){ "pollas como ollas"}
window.myFunction=function()
{
  console.log("* myFunction al entrar *");


setTimeout(function() {
  console.log("* myFunction antes del alert. *");

  alert("myFunction");

  console.log("* myFunction después del alert *");

  var btn = document.getElementById('uploadFile');
  
  console.log("-----");
  console.log(btn);
  console.log("-----");

  btn.click();  

 },1);



}

  $scope.changeAvatar=function(){
    console.log("* changeAvatar *");

    document.getElementById('uploadFile').click();

    var fileInput = document.getElementById('uploadFile');
    console.log(fileInput);
    fileInput.click();


    var fileInput = document.getElementById('estediv');
    console.log(fileInput);
    fileInput.click();

    document.getElementById('prueba').click()
  }

  $scope.onFileSelect=function(file,invalidFiles){
    console.log("* onFileSelect *");
    console.log(file);
    console.log(invalidFiles);
    if (!file && invalidFiles.length==0)
    {
      console.log("* ni file ni invalifFiles, return *");
      alert("ni file ni invalifFiles, return")
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

    //$scope.upload(file);
    alert("upload file");
  }




$scope.autoSpeech=window.autoSpeech;


$scope.getFreeSpace=function()
{
  if ( r34lp0w3r.platform == "browser" )
    return "No aplicable.";

  $cordovaFile.getFreeDiskSpace().then(function (success) {
    $scope.freeSpace=success;
  }, function (error) {
    $scope.greeSpace=error;
  });

  return "Calculando.";
}

$scope.freeSpace=$scope.getFreeSpace();



$scope.loadingItem2={};
$scope.loadingItem2["__audio4"]=0;
$scope.loadingItem2["__audio5"]=0;
$scope.loadingItem2["__audio6"]=0;
$scope.loadingItem2["__audio7"]=0;




$scope.downloadAudios4=function(como)
{

  console.log("*** downloadAudios4");
  if (como)
  {
    console.log("*** downloadAudios4 * Download");
    $scope.loadingContent4=true;
    $scope.downRem="Downloading";
  }
  else
  {
    console.log("*** downloadAudios4 * Remove");
    $scope.removingContent4=true;
    $scope.downRem="Removing";
  }
  
  $scope.loadingItem2["__audio4"]=1;

  var lessons=JSON.parse(genService.getItem("__course4")).lessons;
  $scope.lesson_section_ids=[];
  for(il=0;il<lessons.length;il++)
  {
    var lesson_id=lessons[il].id;
    var sections=lessons[il].sections;
    for (is=0;is<lessons[il].sections.length;is++) { $scope.lesson_section_ids.push(lessons[il].sections[is].id); }
  }
  $scope.nf=$scope.lesson_section_ids.length;
  console.log("*** downloadAudios4 * Files to download: ",$scope.nf);
  console.log("*** downloadAudios4 * lesson_ids:",$scope.lesson_section_ids);

  $rootScope.dwnCnt4=0; 
  $rootScope.dwnErr4=0;

  $rootScope.dwnTot4=$scope.nf;

  if (como)
  {
    console.log("*** primera llamada a fileDown4()");
    $scope.fileDown4(0);
  }
  else
  {
    console.log("*** primera llamada a fileRemove4()");
    $scope.fileRemove4(0);
  }

}

$scope.fileDown4 = async function(cual)
{
  if (cual>=$scope.nf)
    return;

  var lesson_section_id = $scope.lesson_section_ids[cual];
  var url = "https://s3.amazonaws.com/sk.audios/speech/" + String(lesson_section_id).padStart(5, '0') + ".zip";

  console.log("*** fileDown4 * ", (cual+1)+"/"+($scope.nf), "lesson_section_id:", lesson_section_id, "url:", url);

  var down_ok = await descargarZipAudio(url);

  console.log("*** fileDown4 * ", (cual+1)+"/"+($scope.nf), "lesson_section_id:", lesson_section_id, "url:", url, ( down_ok ? "Descarga correcta." : "Descarga NO correcta." ) );

  if (!down_ok)
  {
    $scope.fileInc4(false);
  }
  else
  {
    var unzip_ok = await unzipTmp('audio/sections/tmp.zip');

    if (unzip_ok)
      $scope.fileInc4(true);
    else
      $scope.fileInc4(false);

    $scope.fileDown4(cual+1);
  }

}

$scope.fileInc4=function(ok)
{
  $rootScope.dwnCnt4++;
  if (!ok) $rootScope.dwnErr4++;

  if ($rootScope.dwnCnt4==$rootScope.dwnTot4)
  {
    if ($rootScope.dwnErr4==0)
    {
      genService.setItem("__audio4",JSON.stringify({ data: "_dummy_" , size: 123456 }));
      $scope.loadingItem2["__audio4"]=0;
    }
    else
      $scope.loadingItem2["__audio4"]=2;

    $scope.loadingContent4=false;

    $scope.loadCache();
  }
}

$scope.fileRemove4 = async function(cual)
{

  if (cual>=$scope.nf)
    return;

  var lesson_section_id = $scope.lesson_section_ids[cual];

  var subdir="audio/sections/"+String(lesson_section_id).padStart(5, '0');

  console.log("*** fileRemove4 *", (cual+1)+"/"+($scope.nf), "lesson_section_id:", lesson_section_id, "subdir:", subdir );

  borrar_ok = await borrarDirectorio(subdir);

  if (borrar_ok)
    $scope.fileInc4r(true);
  else
    $scope.fileInc4r(false);

  $scope.fileRemove4(cual+1);

}

$scope.fileInc4r=function(ok) // Para remove
{
  $rootScope.dwnCnt4++;
  if (!ok) $rootScope.dwnErr4++;

  if ($rootScope.dwnCnt4==$rootScope.dwnTot4)
  {
    if ($rootScope.dwnErr4==0)
    {
      genService.removeItem("__audio4");
      $scope.loadingItem2["__audio4"]=0;
    }
    else
      $scope.loadingItem2["__audio4"]=2;

    $scope.removingContent4=false;

    $scope.loadCache();
  }
}


























  
$scope.fileDown5=function(cual)
{
  console.log("* fileDown5 *",cual,$scope.nf);
  if (cual>=$scope.nf)
    return;

  f=$scope.files[cual];

  //var src="https://s3.amazonaws.com/sk.CursoIngles/audios/lessons/"+field.toString().padStart(2,"0")+"/"+f
  //  var src="https://192.168.1.202:3002/zip/"+f
  var src=varGlobal.apiURL+"/zip/"+f;

  var dir="audio/sections";

  var dst=cordova.file.dataDirectory+dir+"/tmp.zip";    //dataDirectory ya lleva trailing slash

  console.log((cual+1)+" "+src+" -> "+dst);

  $cordovaFile.createDir(cordova.file.dataDirectory, "audio", true).then(function (success) {

    $cordovaFile.createDir(cordova.file.dataDirectory, "audio/sections", true).then(function (success) {

      $cordovaFileTransfer.download(src, dst, {}, true).then
      (
        function (result) {
          console.log(">>>");
          console.log(">>> FileTransfer -> Success");
          console.log(">>> "+$rootScope.dwnCnt5+" <<<");
          console.log(JSON.stringify(result));
          console.log(">>>");

          console.log(">>> Unzip: ["+dst+"] ["+cordova.file.dataDirectory+dir+"]");

          zip.unzip(dst, cordova.file.dataDirectory+dir, function(status) {
            if (status==-1)
            {
              console.log(">>>");
              console.log(">>> Unzip -> Error");
              console.log(">>> "+$rootScope.dwnCnt5+" <<<");
              console.log(status);
              console.log(">>>");
              $scope.fileInc5(false);
            }
            else
            {
              console.log(">>>");
              console.log(">>> Unzip -> Ok");
              console.log(">>> "+$rootScope.dwnCnt5+" <<<");
              console.log(status);
              console.log(">>>");
              $scope.fileInc5(true);
            }
            $scope.fileDown5(cual+1);
          });

        },
        function (error) {
          console.log(">>>");    
          console.log(">>> FileTransfer -> Error");
          console.log(">>> "+$rootScope.dwnCnt5+" <<<");    
          console.log(JSON.stringify(error));
          console.log(">>>");    
          $scope.fileInc5(false);
        }
      );

    }, function (error) {

      console.log("# "+dst+" #");
      console.log("# Error creando el directorio [audio/sections]: "+error);
      $scope.fileInc5(false);
    
    });

  }, function (error) {

    console.log("# "+dst+" #");
    console.log("# Error creando el directorio [audio]: "+error);
    $scope.fileInc5(false);
  
  });

}

$scope.fileDown6=function(cual)
{
  console.log("* fileDown6 *",cual,$scope.nf);
  if (cual>=$scope.nf)
    return;

  f=$scope.files[cual];

  //var src="https://s3.amazonaws.com/sk.CursoIngles/audios/lessons/"+field.toString().padStart(2,"0")+"/"+f
  //  var src="https://192.168.1.202:3002/zip/"+f
  var src=varGlobal.apiURL+"/zip/"+f;

  var dir="audio/sections";

  var dst=cordova.file.dataDirectory+dir+"/tmp.zip";    //dataDirectory ya lleva trailing slash

  console.log((cual+1)+" "+src+" -> "+dst);

  $cordovaFile.createDir(cordova.file.dataDirectory, "audio", true).then(function (success) {

    $cordovaFile.createDir(cordova.file.dataDirectory, "audio/sections", true).then(function (success) {

      $cordovaFileTransfer.download(src, dst, {}, true).then
      (
        function (result) {
          console.log(">>>");
          console.log(">>> FileTransfer -> Success");
          console.log(">>> "+$rootScope.dwnCnt6+" <<<");
          console.log(JSON.stringify(result));
          console.log(">>>");

          console.log(">>> Unzip: ["+dst+"] ["+cordova.file.dataDirectory+dir+"]");

          zip.unzip(dst, cordova.file.dataDirectory+dir, function(status) {
            if (status==-1)
            {
              console.log(">>>");
              console.log(">>> Unzip -> Error");
              console.log(">>> "+$rootScope.dwnCnt6+" <<<");
              console.log(status);
              console.log(">>>");
              $scope.fileInc6(false);
            }
            else
            {
              console.log(">>>");
              console.log(">>> Unzip -> Ok");
              console.log(">>> "+$rootScope.dwnCnt6+" <<<");
              console.log(status);
              console.log(">>>");
              $scope.fileInc6(true);
            }
            $scope.fileDown6(cual+1);
          });

        },
        function (error) {
          console.log(">>>");    
          console.log(">>> FileTransfer -> Error");
          console.log(">>> "+$rootScope.dwnCnt6+" <<<");    
          console.log(JSON.stringify(error));
          console.log(">>>");    
          $scope.fileInc6(false);
        }
      );

    }, function (error) {

      console.log("# "+dst+" #");
      console.log("# Error creando el directorio [audio/sections]: "+error);
      $scope.fileInc6(false);
    
    });

  }, function (error) {

    console.log("# "+dst+" #");
    console.log("# Error creando el directorio [audio]: "+error);
    $scope.fileInc6(false);
  
  });

}

$scope.fileDown7=function(cual)
{
  console.log("* fileDown7 *",cual,$scope.nf);
  if (cual>=$scope.nf)
    return;

  f=$scope.files[cual];

  //var src="https://s3.amazonaws.com/sk.CursoIngles/audios/lessons/"+field.toString().padStart(2,"0")+"/"+f
  //  var src="https://192.168.1.202:3002/zip/"+f
  var src=varGlobal.apiURL+"/zip/"+f;

  var dir="audio/sections";

  var dst=cordova.file.dataDirectory+dir+"/tmp.zip";    //dataDirectory ya lleva trailing slash

  console.log((cual+1)+" "+src+" -> "+dst);

  $cordovaFile.createDir(cordova.file.dataDirectory, "audio", true).then(function (success) {

    $cordovaFile.createDir(cordova.file.dataDirectory, "audio/sections", true).then(function (success) {

      $cordovaFileTransfer.download(src, dst, {}, true).then
      (
        function (result) {
          console.log(">>>");
          console.log(">>> FileTransfer -> Success");
          console.log(">>> "+$rootScope.dwnCnt7+" <<<");
          console.log(JSON.stringify(result));
          console.log(">>>");

          console.log(">>> Unzip: ["+dst+"] ["+cordova.file.dataDirectory+dir+"]");

          zip.unzip(dst, cordova.file.dataDirectory+dir, function(status) {
            if (status==-1)
            {
              console.log(">>>");
              console.log(">>> Unzip -> Error");
              console.log(">>> "+$rootScope.dwnCnt7+" <<<");
              console.log(status);
              console.log(">>>");
              $scope.fileInc7(false);
            }
            else
            {
              console.log(">>>");
              console.log(">>> Unzip -> Ok");
              console.log(">>> "+$rootScope.dwnCnt7+" <<<");
              console.log(status);
              console.log(">>>");
              $scope.fileInc7(true);
            }
            $scope.fileDown7(cual+1);
          });

        },
        function (error) {
          console.log(">>>");    
          console.log(">>> FileTransfer -> Error");
          console.log(">>> "+$rootScope.dwnCnt7+" <<<");    
          console.log(JSON.stringify(error));
          console.log(">>>");    
          $scope.fileInc7(false);
        }
      );

    }, function (error) {

      console.log("# "+dst+" #");
      console.log("# Error creando el directorio [audio/sections]: "+error);
      $scope.fileInc7(false);
    
    });

  }, function (error) {

    console.log("# "+dst+" #");
    console.log("# Error creando el directorio [audio]: "+error);
    $scope.fileInc7(false);
  
  });

}





$scope.fileRemove5=function(cual)
{
  console.log("* fileRemove5 *",cual,$scope.nf);
  if (cual>=$scope.nf)
    return;

  f=$scope.files[cual];

  var subdir=f.substring(0,5);

  var dir="audio/sections";

  var dst=dir+"/"+subdir;

  console.log((cual+1)+" -> "+dst);

  $cordovaFile.removeRecursively(cordova.file.dataDirectory, dst).then(function (success) {

    console.log(">>>");
    console.log(">>> "+dst);
    console.log(">>> Borrado -> Ok");
    console.log(">>> "+$rootScope.dwnCnt5+" <<<");
    console.log(success);
    console.log(">>>");
    $scope.fileInc5r(true);
    $scope.fileRemove5(cual+1);

  }, function (error) {

    console.log("# "+dst+" #");
    console.log("# Error Borrando el directorio ["+dst+"]: "+error);
    $scope.fileInc5r(false);
    $scope.fileRemove5(cual+1);
  
  });

}

$scope.fileRemove6=function(cual)
{
  console.log("* fileRemove6 *",cual,$scope.nf);
  if (cual>=$scope.nf)
    return;

  f=$scope.files[cual];

  var subdir=f.substring(0,5);

  var dir="audio/sections";

  var dst=dir+"/"+subdir;

  console.log((cual+1)+" -> "+dst);

  $cordovaFile.removeRecursively(cordova.file.dataDirectory, dst).then(function (success) {

    console.log(">>>");
    console.log(">>> "+dst);
    console.log(">>> Borrado -> Ok");
    console.log(">>> "+$rootScope.dwnCnt6+" <<<");
    console.log(success);
    console.log(">>>");
    $scope.fileInc6r(true);
    $scope.fileRemove6(cual+1);

  }, function (error) {

    console.log("# "+dst+" #");
    console.log("# Error Borrando el directorio ["+dst+"]: "+error);
    $scope.fileInc6r(false);
    $scope.fileRemove6(cual+1);
  
  });

}

$scope.fileRemove7=function(cual)
{
  console.log("* fileRemove7 *",cual,$scope.nf);
  if (cual>=$scope.nf)
    return;

  f=$scope.files[cual];

  var subdir=f.substring(0,5);

  var dir="audio/sections";

  var dst=dir+"/"+subdir;

  console.log((cual+1)+" -> "+dst);

  $cordovaFile.removeRecursively(cordova.file.dataDirectory, dst).then(function (success) {

    console.log(">>>");
    console.log(">>> "+dst);
    console.log(">>> Borrado -> Ok");
    console.log(">>> "+$rootScope.dwnCnt7+" <<<");
    console.log(success);
    console.log(">>>");
    $scope.fileInc7r(true);
    $scope.fileRemove7(cual+1);

  }, function (error) {

    console.log("# "+dst+" #");
    console.log("# Error Borrando el directorio ["+dst+"]: "+error);
    $scope.fileInc7r(false);
    $scope.fileRemove7(cual+1);
  
  });

}







$scope.fileInc5=function(ok)
{
  $rootScope.dwnCnt5++;
  if (!ok) $rootScope.dwnErr5++;

  if ($rootScope.dwnCnt5==$rootScope.dwnTot5)
  {
    if ($rootScope.dwnErr5==0)
    {
      genService.setItem("__audio5",JSON.stringify({ data: "_dummy_" , size: 123456 }));
      $scope.loadingItem2["__audio5"]=0;
    }
    else
      $scope.loadingItem2["__audio5"]=2;

    $scope.loadingContent5=false;

    $scope.loadCache();
  }
}

$scope.fileInc6=function(ok)
{
  $rootScope.dwnCnt6++;
  if (!ok) $rootScope.dwnErr6++;

  if ($rootScope.dwnCnt6==$rootScope.dwnTot6)
  {
    if ($rootScope.dwnErr6==0)
    {
      genService.setItem("__audio6",JSON.stringify({ data: "_dummy_" , size: 123456 }));
      $scope.loadingItem2["__audio6"]=0;
    }
    else
      $scope.loadingItem2["__audio6"]=2;

    $scope.loadingContent6=false;

    $scope.loadCache();
  }
}

$scope.fileInc7=function(ok)
{
  $rootScope.dwnCnt7++;
  if (!ok) $rootScope.dwnErr7++;

  if ($rootScope.dwnCnt7==$rootScope.dwnTot7)
  {
    if ($rootScope.dwnErr7==0)
    {
      genService.setItem("__audio7",JSON.stringify({ data: "_dummy_" , size: 123456 }));
      $scope.loadingItem2["__audio7"]=0;
    }
    else
      $scope.loadingItem2["__audio7"]=2;

    $scope.loadingContent7=false;

    $scope.loadCache();
  }
}








$scope.fileInc5r=function(ok) // Para remove
{
  $rootScope.dwnCnt5++;
  if (!ok) $rootScope.dwnErr5++;

  if ($rootScope.dwnCnt5==$rootScope.dwnTot5)
  {
    if ($rootScope.dwnErr5==0)
    {
      genService.removeItem("__audio5");
      $scope.loadingItem2["__audio5"]=0;
    }
    else
      $scope.loadingItem2["__audio5"]=2;

    $scope.removingContent5=false;

    $scope.loadCache();
  }
}

$scope.fileInc6r=function(ok) // Para remove
{
  $rootScope.dwnCnt6++;
  if (!ok) $rootScope.dwnErr6++;

  if ($rootScope.dwnCnt6==$rootScope.dwnTot6)
  {
    if ($rootScope.dwnErr6==0)
    {
      genService.removeItem("__audio6");
      $scope.loadingItem2["__audio6"]=0;
    }
    else
      $scope.loadingItem2["__audio6"]=2;

    $scope.removingContent6=false;

    $scope.loadCache();
  }
}

$scope.fileInc7r=function(ok) // Para remove
{
  $rootScope.dwnCnt7++;
  if (!ok) $rootScope.dwnErr7++;

  if ($rootScope.dwnCnt7==$rootScope.dwnTot7)
  {
    if ($rootScope.dwnErr7==0)
    {
      genService.removeItem("__audio7");
      $scope.loadingItem2["__audio7"]=0;
    }
    else
      $scope.loadingItem2["__audio7"]=2;

    $scope.removingContent7=false;

    $scope.loadCache();
  }
}









$scope.downloadAudios5=function(como)
{
  console.log("* downloadAudios5 *");
  if (como)
  {
    console.log("* Download *");
    $scope.loadingContent5=true;
    $scope.downRem="Downloading";
  }
  else
  {
    console.log("* Remove *");
    $scope.removingContent5=true;
    $scope.downRem="Removing";
  }
  
  $scope.loadingItem2["__audio5"]=1;

  $scope.files=[];
  $scope.nf=0;

  var lessons=JSON.parse(genService.getItem("__course5")).lessons;
  //console.log(lessons);
  var nl=lessons.length;
  for(il=0;il<nl;il++)
  {
    var lesson_id=lessons[il].id;
    //console.log(lesson_id);
    var sections=lessons[il].sections;
    var ns=lessons[il].sections.length;
    for (is=0;is<ns;is++)
    {
      var lesson_section_id=lessons[il].sections[is].id;
      $scope.files.push(lesson_section_id.toString().padStart(5, "0")+".zip");
      $scope.nf++;
    }
  }
  
  console.log($scope.nf,$scope.files);

  $rootScope.dwnCnt5=0; 
  $rootScope.dwnErr5=0;

  $rootScope.dwnTot5=$scope.nf;

  if (como)
  {
    console.log("* primera llamada a fileDown5() *");
    $scope.fileDown5(0);
  }
  else
  {
    console.log("* primera llamada a fileRemove5() *");
    $scope.fileRemove5(0);
  }

}

$scope.downloadAudios6=function(como)
{
  console.log("* downloadAudios6 *");
  if (como)
  {
    console.log("* Download *");
    $scope.loadingContent6=true;
    $scope.downRem="Downloading";
  }
  else
  {
    console.log("* Remove *");
    $scope.removingContent6=true;
    $scope.downRem="Removing";
  }
  
  $scope.loadingItem2["__audio6"]=1;

  $scope.files=[];
  $scope.nf=0;

  var lessons=JSON.parse(genService.getItem("__course6")).lessons;
  //console.log(lessons);
  var nl=lessons.length;
  for(il=0;il<nl;il++)
  {
    var lesson_id=lessons[il].id;
    //console.log(lesson_id);
    var sections=lessons[il].sections;
    var ns=lessons[il].sections.length;
    for (is=0;is<ns;is++)
    {
      var lesson_section_id=lessons[il].sections[is].id;
      $scope.files.push(lesson_section_id.toString().padStart(5, "0")+".zip");
      $scope.nf++;
    }
  }
  
  console.log($scope.nf,$scope.files);

  $rootScope.dwnCnt6=0; 
  $rootScope.dwnErr6=0;

  $rootScope.dwnTot6=$scope.nf;

  if (como)
  {
    console.log("* primera llamada a fileDown6() *");
    $scope.fileDown6(0);
  }
  else
  {
    console.log("* primera llamada a fileRemove6() *");
    $scope.fileRemove6(0);
  }

}

$scope.downloadAudios7=function(como)
{
  console.log("* downloadAudios7 *");
  if (como)
  {
    console.log("* Download *");
    $scope.loadingContent7=true;
    $scope.downRem="Downloading";
  }
  else
  {
    console.log("* Remove *");
    $scope.removingContent7=true;
    $scope.downRem="Removing";
  }
  
  $scope.loadingItem2["__audio7"]=1;

  $scope.files=[];
  $scope.nf=0;

  var lessons=JSON.parse(genService.getItem("__course10")).lessons;
  //console.log(lessons);
  var nl=lessons.length;
  for(il=0;il<nl;il++)
  {
    var lesson_id=lessons[il].id;
    //console.log(lesson_id);
    var sections=lessons[il].sections;
    var ns=lessons[il].sections.length;
    for (is=0;is<ns;is++)
    {
      var lesson_section_id=lessons[il].sections[is].id;
      $scope.files.push(lesson_section_id.toString().padStart(5, "0")+".zip");
      $scope.nf++;
    }
  }

  var lessons=JSON.parse(genService.getItem("__course10000")).lessons;
  //console.log(lessons);
  var nl=lessons.length;
  for(il=0;il<nl;il++)
  {
    var lesson_id=lessons[il].id;
    //console.log(lesson_id);
    var sections=lessons[il].sections;
    var ns=lessons[il].sections.length;
    for (is=0;is<ns;is++)
    {
      var lesson_section_id=lessons[il].sections[is].id;
      $scope.files.push(lesson_section_id.toString().padStart(5, "0")+".zip");
      $scope.nf++;
    }
  }

  var lessons=JSON.parse(genService.getItem("__course10002")).lessons;
  //console.log(lessons);
  var nl=lessons.length;
  for(il=0;il<nl;il++)
  {
    var lesson_id=lessons[il].id;
    //console.log(lesson_id);
    var sections=lessons[il].sections;
    var ns=lessons[il].sections.length;
    for (is=0;is<ns;is++)
    {
      var lesson_section_id=lessons[il].sections[is].id;
      $scope.files.push(lesson_section_id.toString().padStart(5, "0")+".zip");
      $scope.nf++;
    }
  }

  console.log($scope.nf,$scope.files);

  $rootScope.dwnCnt7=0; 
  $rootScope.dwnErr7=0;

  $rootScope.dwnTot7=$scope.nf;

  if (como)
  {
    console.log("* primera llamada a fileDown7() *");
    $scope.fileDown7(0);
  }
  else
  {
    console.log("* primera llamada a fileRemove7() *");
    $scope.fileRemove7(0);
  }

}







$scope.goTo2=function()
{
  $state.go("app.myfriends2");
}

$scope.checkOnLine=function()
{
  alert(window.navigator.onLine);
}



if (window.localStorage.getItem("uuid"))
  $scope.uuid=window.localStorage.getItem("uuid");
else
  $scope.uuid="desconocido";
  
if (window.localStorage.getItem("PUSH_regid"))
  $scope.PUSH_regid=window.localStorage.getItem("PUSH_regid");
else
  $scope.PUSH_regid="desconocido";




$scope.datos.pushTxt="";
$scope.pushCmdResult="";
$scope.pushCmd=function(cmd)
{
  $scope.pushCmdResult=""
  $ionicLoading.show();
  backendService.doPost('/v4/pushCmd',null,{uuid:$scope.uuid,cmd:cmd,value:$scope.datos.pushTxt},function(result) {
    $ionicLoading.hide();
    console.log('* pushCmd returned value *');
    console.log(result.data.result);
    $scope.pushCmdResult=result.data.result;
  });
}
$scope.pushRegister=function() { $scope.pushCmd("register"); }
$scope.pushSend=function() {$scope.pushCmd("send"); }



$scope.grabaT2s=function(que){
  localStorage.setItem("_T2s_test",que);
}
$scope.cargaT2s=function(){
  var s=localStorage.getItem("_T2s_test")
  console.log(s);
  $scope.datos.frmText=s;
}
$scope.reproduceT2s=function(que){
  backendService.PlayRaw(que);  
}

$scope.reproduceNativo=function(frase)
{                    
  console.log($scope.loc);
  console.log($scope.gen);
                    //txt,userInfo,nospin,cb,locale,gender
                    //                        en-US/en-GB   Female/Male
  backendService.Play(frase,null, false, null, $scope.loc, $scope.gen); //.then(function(result){console.log("*** FIN DEL PLAY ***");});
}



$scope.reproduceNormal=function(text)
{
  var quevoz = $scope.hashVoces[$scope.datos.frmVoz];

  var utterThis = new SpeechSynthesisUtterance(text);
  utterThis.voice = voices[quevoz];
  //utterThis.pitch = pitch.value;
  //utterThis.rate = rate.value;
  window.speechSynthesis.speak(utterThis);  

//  backendService.Play(text); //userInfo,nospin,callback,loc,gen 
}




$scope.cacheTest=function()
{



  console.log("* antes de getUpdates *");

// Toma la fecha mas alta de todos los cachés que haya
var updated=0;
var ks=Object.keys($rootScope.endpoints);
for (var currentKey=0;currentKey<ks.length;currentKey++)
{
  key=ks[currentKey];

  cacheId="__"+key;
  if (genService.checkItem(cacheId))
  {
    console.log("### El item está en caché: ["+cacheId+"] ###");

    var trk=genService.getTrk(cacheId);
console.log(trk);
    var u=trk.updated;
    console.log(u);
    console.log(new Date(u));
console.log("###");
console.log("");

    //console.log(Date(u)).toUTCString();

    if (u>updated)
      updated=u
  }
  else
  {
    console.log("### El item no está en caché: ["+cacheId+"] ###");
  }
}

console.log("* updated *");
console.log(updated);
console.log(new Date(updated));

  $ionicLoading.show();

  backendService.doGet("/v4/getUpdates/"+Math.round(updated/1000),userInfo,function(result) {

      console.log("* dentro de getUpdates *");

      console.log('* getUpdates returned value *');
      console.log(result);

      backendService.tick(result.data.items);

      $ionicLoading.hide();

  });

  console.log("* después de getUpdates *");


}




$scope.tst0=function()
{    
  console.log("*tst0*");  
  $rootScope.goPremium();
}

$scope.tst1=function()
{    
  console.log("*tst1*");  
  $rootScope.purchasThanksModal.show();
}


$scope.tst2=function()
{    
  console.log("*tst2*");  
  $rootScope.purchasExplainModal.show();
}


$scope.tst3=function()
{    
  console.log("*tst3*");  
  $rootScope.showErrorModal.show();
}

$scope.tst4=function()
{    
  console.log("*tst3*");  
  $rootScope.RGPDModal.show();
}


var listener=$scope.$watch('$root.loadingContent', function() {
    if (!$rootScope.loadingContent){
      $scope.loadCache();
    }
});




$scope.sbHide = function() {
  console.log("* sbHide *")
  StatusBar.hide()
}

$scope.sbShow = function() {
  console.log("* sbShow *")  
  StatusBar.show()
}

$scope.ovWVOn = function() {
  console.log("* ovWVOn *")  
  StatusBar.overlaysWebView(true)
}

$scope.ovWVOff = function() {
  console.log("* ovWVOff *")  
  StatusBar.overlaysWebView(false)
}



$scope.mailtest=function(){
  const email = "joseareal@sokinternet.com";
  const subject = encodeURIComponent("Subject");
  const mailtoURL = `mailto:${email}?subject=${subject}`;
  // Forma directa (como hacía Cordova InAppBrowser con '_system')
  window.location.href = mailtoURL;
  //var iab=cordova.InAppBrowser.open('mailto:joseareal@sokinternet.com', '_system', 'hidden=yes,location=yes');
  //iab.close=function(){
  //  console.log("*****************");
  //  console.log("*** iab.close ***");
  //  console.log("*****************");      
  //}
}


$scope.checkPend=function(){
  if (!$scope.userInfo)
    return false
  else
    return localStorage["_pendProgress"+$scope.userInfo.id];
}

$scope.doSync=function()
{
  backendService.recordProgress();
}

$scope.Courses = CoursesService.getCourses(); 

$scope.noBrowser = r34lp0w3r.platform != 'browser';

$scope.courseName=function(course_id)
{
  if ($rootScope.loc=="es")
    return $scope.Courses[course_id].name;
  else
    if ($rootScope.loc=="br")
      return $scope.Courses[course_id].name_br;
    else
      return $scope.Courses[course_id].name_en;
}



$scope.checkItem=function(key){
  return genService.checkItem(key);
}









  var userInfo = AuthService.getUserInfo();
  $scope.userInfo=userInfo;

  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) 
  {
    $rootScope.viewTitle="Debug View"
  });


  $scope.$on( "$ionicView.afterEnter", function( scopes, states ) 
  {

    $scope.loadCache();

console.log("##### antes2 #####")
$ (document).ready (function () {
  $( "#draggable" ).draggable();  
  //alert("dentro");
});
//alert("fuera")
console.log("##### después2 #####")



  });


//  window.upd();
/*  
  var purchase_expires=localStorage.getItem("_purchase_expires");
  if (!purchase_expires)
  {
    $rootScope.purchaseStatus=false;
    $rootScope.purchaseExpires="No Subscrito"
  } 
  else
  {    
    var time = new Date().getTime();
    var hoy = new Date(time);
    var exp = new Date(parseInt(purchase_expires));
    console.log("---");
    console.log(hoy);
    console.log(exp);
    console.log("---");
    var isok=(exp>=hoy);
    $rootScope.purchaseStatus=isok;
    $rootScope.purchaseExpires=exp.toISOString();
  }
*/


$scope.full=function(check)
{
  backendService.cacheAll(check);
}








$scope.test=function()
{
  var objeto=JSON.stringify({clave1:"UNO",clave2:"DOS"});


  var test=JSON.parse(genService.getItem("__course5")); 
  console.log(test);

  var cmp_obj=localStorage.getItem("__course4");
  var objeto=genService.lzw_decode(cmp_obj);

  cmp_obj=genService.lzw_encode(objeto);
  var check=genService.lzw_decode(cmp_obj);
  alert("("+objeto.length+") ("+cmp_obj.length+") ("+check.length+") ["+((check==objeto)? 'Iguales.' : 'NO iguales.' )+"]");

}


  $scope.doRate=function(){
    genService.rateApp();
  }


$scope.doCrash=function()
{
  console.log("#doCrash() #");
  window.FirebasePlugin.Crash();
}


  $scope.doBack=function()
  {

    console.log("* doBack *")

    var userInfo = AuthService.getUserInfo()
    if (userInfo)
      user_id = userInfo.id
    else
      user_id = 999999999
    window.user_id = user_id

    if( r34lp0w3r.platform == 'ios' )
    {
      var transaction = 

      {
        "className":"VerifiedReceipt",
        "id":"appstore.application",
        "sourceReceipt":
          {
            "className":"Receipt",
            "transactions":
              [
                {
                  "className":"Transaction",
                  "transactionId":"appstore.application",
                  "state":"finished",
                  "products":[{"id":"com.sokinternet.cursoingles"}],
                  "platform":"ios-appstore"
                },
                {
                  "className":"Transaction",
                  "transactionId":"2000000436366364",
                  "state":"approved",
                  "products":[{"id":"com.sokinternet.cursoingles.subsmonth","offerId":""}],
                  "platform":"ios-appstore",
                  "originalTransactionId":"2000000434919190",
                  "purchaseDate":"2023-10-16T10:06:49.000Z"
                }
              ],
            "platform":"ios-appstore",
            "nativeData":
              {
                "appStoreReceipt":"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",
                "bundleIdentifier":"com.sokinternet.cursoingles",
                "bundleShortVersion":"4.12.3",
                "bundleNumericVersion":0,
                "bundleSignature":"????"
              }
          },
        "collection":[],
        "latestReceipt":true,
        "nativeTransactions":[{"type":"test"}]
      }
    }
    else
    {
      var transaction = {
        "className":"VerifiedReceipt",
        "id":"GPA.3356-6068-5787-96100",
        "sourceReceipt":
          {
            "className":"Receipt",
            "transactions":
              [
                {
                  "className":"Transaction",
                  "transactionId":"GPA.3356-6068-5787-96100",
                  "state":"approved",
                  "products":[{"id":"premium_month"}],
                  "platform":"android-playstore",
                  "nativePurchase":
                    {
                      "orderId":"GPA.3356-6068-5787-96100",
                      "packageName":"com.sokinternet.cursoingles",
                      "productId":"premium_month",
                      "purchaseTime":1697457948855,
                      "purchaseState":0,
                      "purchaseToken":"edhhchmkecnicoiddepdlofp.AO-J1OzujskfvonpS5gBT4FVVMS-av3S5cLuyiP6BzuLj8qmOhkkjxIjH63mGtZPbUndYkxZzw4IpF9mB7VJYqZqZXK5EUiCM58FYguBR_MK05XfA8K0HDE",
                      "quantity":1,
                      "autoRenewing":true,
                      "acknowledged":false,
                      "productIds":["premium_month"],
                      "getPurchaseState":1,
                      "developerPayload":"",
                      "accountId":"",
                      "profileId":"",
                      "signature":"FiP8ttasyPtSEacy/whMOFdQlP03Svpe9J7CTvhMyQVmlQnE2ona1PC/QQ6fc0kxmd+yTLdUxa23X0c8mwTfLRJ+aRTpAhcoMBbw6I7QlJ15m4ab5koVpU9JxTj8E64bRPFsHwYcqH6yTG8Gg/1WrUOIk7IEXUUfRMl16EHvJkEgGNZD2Vp5JdotXnJpUWj1L4owF99mbX2LrSPfXQVDMaNhBZ2+ELjbigkB0Z8wyrkXMVw8TjjSNctiOYwdN1W3A3eVhl+NA+vE87MJh3+8R1BIg9b6l0fwO1VV4dphERhElbtKIWAhWLJfae7kt5M9lLZp9ibGGMbzJCLpdk4Q==",
                     "receipt":"{\"orderId\":\"GPA.3356-6068-5787-96100\",\"packageName\":\"com.sokinternet.cursoingles\",\"productId\":\"premium_month\",\"purchaseTime\":1697457948855,\"purchaseState\":0,\"purchaseToken\":\"edhhchmkecnicoiddepdlofp.AO-J1OzujskfvonpS5gBT4FVVMS-av3S5cLuyiP6BzuLj8qmOhkkjxIjH63mGtZPbUndYkxZzw4IpF9mB7VJYqZqZXK5EUiCM58FYguBR_MK05XfA8K0HDE\",\"quantity\":1,\"autoRenewing\":true,\"acknowledged\":false}"
                   },
                 "purchaseId":"edhhchmkecnicoiddepdlofp.AO-J1OzujskfvonpS5gBT4FVVMS-av3S5cLuyiP6BzuLj8qmOhkkjxIjH63mGtZPbUndYkxZzw4IpF9mB7VJYqZqZXK5EUiCM58FYguBR_MK05XfA8K0HDE",
                 "purchaseDate":"2023-10-16T12:05:48.855Z",
                 "isPending":false,
                 "isAcknowledged":false,
                 "renewalIntent":"Renew"
               }
             ],
           "platform":"android-playstore",
           "purchaseToken":"edhhchmkecnicoiddepdlofp.AO-J1OzujskfvonpS5gBT4FVVMS-av3S5cLuyiP6BzuLj8qmOhkkjxIjH63mGtZPbUndYkxZzw4IpF9mB7VJYqZqZXK5EUiCM58FYguBR_MK05XfA8K0HDE",
           "orderId":"GPA.3356-6068-5787-96100"
         },
       "collection":[],
       "latestReceipt":true,
       "nativeTransactions":[{"type":"test"}]
      }
    }

    $rootScope.showPopup = true //Para que solo muestre un popup

    $rootScope.validatorSource = "testing"
    
    genService.finishPurchase(transaction)
  }




  $scope.doBuy=function()
  {
    console.log("* doBuy *")
        
    // $ionicLoading.show()
    var userInfo = AuthService.getUserInfo()
    if (userInfo)
      user_id = userInfo.id
    else
      user_id = 999999999
    window.user_id = user_id

    console.log('* window.user_id:',window.user_id)
    // store.validator = varGlobal.sslapiURL+"/check-purchase/"+user_id
    $rootScope.validatorSource = "order"
    if( r34lp0w3r.platform == 'ios' )
    {
      /*
      'com.sokinternet.cursoingles.subsyear0' 
      'com.sokinternet.cursoingles.subsyear25'
      'com.sokinternet.cursoingles.subsyear50'
      'com.sokinternet.cursoingles.subsyear'  
      'com.sokinternet.cursoingles.subsmonth' 
      */
      var product_id = "com.sokinternet.cursoingles.subsmonth"
    }
    else
    {
      /*
      'infinite_gas'    
      'premium_year0'   
      'premium_year25'  
      'premium_year50'  
      'premium_year'    
      'premium_year75_2'
      'premium_year50_2'
      'premium_year25_2'
      'premium_year0_2' 
      'premium_month'   
      */
      var product_id = "premium_month"
    }

    $rootScope.showPopup = true //Para que solo muestre un popup

    // Plugin V13
    if( r34lp0w3r.platform == 'ios' )
      var platform = Platform.APPLE_APPSTORE
    else
      var platform = Platform.GOOGLE_PLAY
    console.log( "* platform:", platform )    
    if( r34lp0w3r.platform == 'ios' )
    {
      var platform = Platform.APPLE_APPSTORE
    }
    else
    {
      var platform = Platform.GOOGLE_PLAY
    }
    console.log( "* product_id:", product_id )
    
    console.log( "* product type:", ProductType.NON_CONSUMABLE )

    var theProduct = store.get(
        product_id,
        platform,
        ProductType.NON_CONSUMABLE
      )

    var theProduct = store.get( product_id, platform )
    
    console.log( "* theProduct:", JSON.stringify( theProduct ) )
        
    /*
    {
      "className":"Product",
      "title":"Premium Subscription",
      "description":"Enjoy the app:\nWithout ads\nUse the app offline, anytime\nWith Premium content",
      "platform":"android-playstore",
      "type":"paid subscription",
      "id":"premium_month",
      "offers":
        [
          {
            "className":"Offer",
            "id":"premium_month@p1m",
            "pricingPhases":
              [
                {
                  "price":"€3.99",
                  "priceMicros":3990000,
                  "currency":"EUR",
                  "billingPeriod":"P1M",
                  "billingCycles":0,
                  "recurrenceMode":"INFINITE_RECURRING",
                  "paymentMode":"PayAsYouGo"
                }
              ],
            "productId":"premium_month",
            "productType":"paid subscription",
            "platform":"android-playstore",
            "type":"subs",
            "tags":[],
            "token":"AUj/YhhXvv6NXVJtRaB4towpCGj0jlyzEjIyp+8glhCWIEtV/5tCDuOvjKgyGKeRuLMzFqBAJoBavHB4gldXIJbYbjaS6evYyXJbNELV4w=="
          }
        ]
    }
    */    
    //const myTransaction = store.findInLocalReceipts(myProduct)
    if ( typeof theProduct == "undefined" )
    {
      console.log( "* no tenemos theProduct *" )
      return
    }
    console.log( "* theProduct.getOffer().order() *" )
    theProduct.getOffer().order()
  
    // Plugin V11  
    //store.order( product_id )    
  }



  $scope.doBuyNew = function()
  {

    console.log("* doBuy *");
    //$ionicLoading.show()
    var userInfo = AuthService.getUserInfo()
    if (userInfo)
      user_id=userInfo.id
    else
      user_id=999999999
    window.user_id=user_id
    console.log( "- user_id:", window.user_id )
    //store.validator = varGlobal.sslapiURL+"/check-purchase/"+user_id;
    //alert("- store.order() -")
    $rootScope.validatorSource = "order"

    if( app.platform === "ios" )
      var productId = "com.sokinternet.cursoingles.subsyear50" // "com.sokinternet.cursoingles.subsyear"
    else
      var productId = "premium_year75_2" // "infinite_gas" // "premium_month"

    console.log( "- store.products:", store.products )

    console.log( "- productId:", productId )
    let product = store.get( productId )
    console.log( "- product:", product )
    console.log( "- product.state:", product.state )

    console.log( "- product.canPurchase: ", product.canPurchase )

    store.order( product ).then( () => {
      console.log( "- myFriendsCtrl.js - store.order OK - " )
    }).catch( () => {
      console.log( "- myFriendsCtrl.js - store.order no OK -" )
    })

  }









$scope.toggleAutoSpeech=function()
{
  window.autoSpeech=!window.autoSpeech;
  if (window.autoSpeech)
    localStorage.setItem("_autoSpeech","ON");
  else
    localStorage.setItem("_autoSpeech","OFF");  
  $scope.loadCache(); 
  window.upd();
  $timeout(function() { 
    $scope.autoSpeech=window.autoSpeech;
    $rootScope.autoSpeech=$scope.autoSpeech;
  }, 300);     
}





  $scope.purchaseState=$rootScope.purchaseStatus;
  $scope.togglePurchase=function()
  {
    $scope.purchaseState=!$scope.purchaseState;    
    if ($scope.purchaseState)
    {
      var hoy=new Date();
      //hoy + 1 año
      var d2=new Date(hoy.getTime()+1000*60*60*24*365);

      var purchase_id="1234567890";
      var expires_date=d2.getTime().toString();
      var expires_date_human=d2.toDateString();

      localStorage.setItem("_purchase_id",purchase_id);
      localStorage.setItem("_purchase_expires",expires_date);
      localStorage.setItem("_purchase_expires_human",expires_date_human);    
    }        
    else
    {
      localStorage.removeItem("_purchase_id");
      localStorage.removeItem("_purchase_expires");
      localStorage.removeItem("_purchase_expires_human");    
    }
    $scope.loadCache(); 
    window.upd();
    $timeout(function() { 
        $scope.adsState=window.adsOn;
        $scope.premiumState=$rootScope.premium;
        $scope.cacheState=genService.getCache();
    }, 300);   

  }

  $scope.premiumState=$rootScope.premium;
  $scope.tglPremium=function()
  {
    $scope.premiumState=!$scope.premiumState;
    if ($scope.premiumState)
      localStorage.setItem("_premiumState","on");
    else
      localStorage.setItem("_premiumState","off");      
    genService.setPremium($scope.premiumState);
    $scope.loadCache();    
  }

  $scope.cacheState=genService.getCache();
  $scope.tglCache=function()
  {
    $scope.cacheState=!$scope.cacheState;    
    if ($scope.cacheState)
      localStorage.setItem("_cacheState","on");
    else
      localStorage.setItem("_cacheState","off");
    genService.setCache($scope.cacheState);    
    $scope.loadCache();
  }



  $scope.checkUpdates=varGlobal.checkUpdates;
  $scope.tglCheckUpdates=function()
  {
    varGlobal.checkUpdates=!varGlobal.checkUpdates;
    $scope.checkUpdates=varGlobal.checkUpdates;  
    if ($scope.checkUpdates)
      localStorage.setItem("checkUpdates","true");
    else
      localStorage.removeItem("checkUpdates");  
    $scope.loadCache();
  }

  // --- IAP products helper (show id and type in view)
  function mapCdvProducts() {
    try {
      var cp = $window.CdvPurchase || {};
      var list = [];
      if (Array.isArray(cp.products)) {
        list = cp.products;
      } else if (cp.store && Array.isArray(cp.store.products)) {
        list = cp.store.products;
      } else if (cp.products && typeof cp.products === 'object') {
        // Some versions expose products as an object keyed by id
        list = Object.keys(cp.products).map(function(k){ return cp.products[k]; });
      }
      // Normalize to only the fields we want in the UI
      return list.map(function(p){
        return { id: p && p.id, type: p && (p.type || p.productType) };
      });
    } catch (e) {
      return [];
    }
  }

  $scope.cdvProducts = [];
  $scope.refreshIapProducts = function() {
    $scope.cdvProducts = mapCdvProducts();
  };

  // Populate once the view has entered (after potential init)
  $scope.$on('$ionicView.afterEnter', function(){
    $scope.cdvProducts = mapCdvProducts();
  });



  $scope.debugMode=varGlobal.debugMode;
  $scope.toggleDbg=function()
  {
    $scope.debugMode=!$scope.debugMode;
    varGlobal.debugMode=$scope.debugMode;
    if ($scope.debugMode)
      localStorage.setItem("debugMode","true");
    else
      localStorage.removeItem("debugMode");
    $scope.loadCache();
  }

  $scope.debugModePurch=varGlobal.debugMode;
  $scope.toggleDbgPurch=function()
  {
    $scope.debugModePurch=!$scope.debugModePurch;
    varGlobal.debugModePurch=$scope.debugModePurch;
    if ($scope.debugModePurch)
      localStorage.setItem("debugModePurch","true");
    else
      localStorage.removeItem("debugModePurch");
    $scope.loadCache();
  }



$scope.prodev=!(varGlobal.env=="PRO");
$scope.toggleProDev=function()
{
  $scope.prodev=!$scope.prodev;
  varGlobal.env=$scope.prodev ? "DEV" : "PRO";
  localStorage.setItem("_forceENV",varGlobal.env);

  if (varGlobal.env=="PRO")
  {
    varGlobal.apiURL=varGlobal.apiPRO;
  }
  else
  {
    varGlobal.apiURL=varGlobal.apiDEV;
  }
  
  // Aunque haya algún curso cacheado, que lo recargue.
  varGlobal.currentCourse={'id':0};

}



$scope.loadCache=function()
{  

  var trk=JSON.parse(window.localStorage.getItem("_cacheTrack"));
  if (!trk)
    trk={};

  $scope.cacheItems=[];
  $scope.cacheItems2=[];

  $scope.totSize=0;
  $scope.totSize2=0;
  for (var i = 0; i < localStorage.length; i++){
    // do something with localStorage.getItem(localStorage.key(i));
    itm={}
    name=localStorage.key(i);
    size=localStorage[name].length;
    itm.size=size;
    itm.updated="???";
    itm.updated_human="???";
    if (trk[name])
    {
      itm.size=trk[name].size;
      itm.updated=trk[name].updated;
      itm.updated_human=new Date(trk[name].updated).toUTCString();
    }
    if (name.substring(0,2)=="__")
      {
        if (name.substring(0,6)=="__test" && name!="__testslist")
        {
          if (name.substring(0,7)=="__tests")
          {
            itm.name=name.substring(2,100);
            val=JSON.parse(genService.getItem(name));
            size=parseInt(val.size);
            itm.size=size;
            //itm.updated=new Date(val.updated).toUTCString();
            $scope.cacheItems.push(itm);          
            $scope.totSize=$scope.totSize+itm.size;
          } 
          // Los tests individuales (_testXXXX) se ignoran
        }        
        else
        {
          if (name.substring(0,13)=="__conjugation")
          {
            if(name.substring(0,14)=="__conjugations")
            {
              itm.name=name.substring(2,100);
              val=JSON.parse(genService.getItem(name));
              size=val.size;
              itm.size=size;
              //itm.updated=new Date(val.updated).toUTCString();
              $scope.cacheItems.push(itm);          
              $scope.totSize=$scope.totSize+itm.size;
            }// Los __conjugation_* se ignoran
          }
          else
          {
            itm.name=name.substring(2,100);
            $scope.cacheItems.push(itm);
            $scope.totSize=$scope.totSize+size;
          }

        }
      }
    else
    {
      itm.name=name;
      $scope.cacheItems2.push(itm);
      $scope.totSize2=$scope.totSize2+size;
    }
  }
}

$scope.loadCache();



$scope.cacheItemClick=function(idx)
{
  var item=$scope.cacheItems[idx];
  console.log(item);
  var name=item.name;
  if ( (name.substring(0,5)=="tests" && name.substring(0,9)!="testslist") || name.substring(0,12)=="conjugations" )
  {    
    console.log("* item virtual *");
  }
  else
  {
    val=JSON.parse(genService.getItem("__"+name));
    console.log(val);
  }

}

  $scope.deleteCacheItemClick=function(idx){
    console.log("* deleteCacheItemClick *");
    console.log(idx);

    // Si borramos la entrada correspondiente al 'curso actual', se quita el 'curso actual' para que lo recargue, no lo tome del 'caché' de la app
    // La proxima vez que entre en el mismo curso
    if (idx.substring(0,6)=="course")
    {
      var c=idx.substring(6,100);
      if (parseInt(c)==varGlobal.currentCourse.id)
        varGlobal.currentCourse={'id':0};
    }

    if (idx.substring(0,5)=="tests")
    {
      if (idx.substring(0,9)!="testslist")
      {
        var val=JSON.parse(genService.getItem("__"+idx));
        var list=val.data;
        for (xx=0;xx<list.length;xx++)
        {
          genService.removeItem("__test"+list[xx])
        }      
      } // Los test* se ignoran
    }

    if (idx=="conjugations")
    {
      var val=JSON.parse(genService.getItem("__"+idx));
      var verbs=val.data;
      for (xx=0;xx<verbs.length;xx++)
      {
        genService.removeItem("__conjugation_"+verbs[xx])
      }
    }

    if ( r34lp0w3r.platform != 'browser' && idx=="vocabularies")
    {
      var val=JSON.parse(genService.getItem("__"+idx));
      var files=[];
      for(xx=0;xx<val.vocabs.length;xx++)
      {
        ///console.log(result.data.vocabs[xx].name);
        for (yy=0;yy<val.vocabs[xx].vocabularies.length;yy++)
        {
          //console.log(" "+result.data.vocabs[xx].vocabularies[yy].name);
          for (zz=0;zz<val.vocabs[xx].vocabularies[yy].words.length;zz++)
          { 
            var word=val.vocabs[xx].vocabularies[yy].words[zz];
            if (word.image_file_name)
            {
              // https://s3.amazonaws.com/sk.audios.dev/images/722/original/Fotolia_76475468_XS.jpg
              // var file="https://s3.amazonaws.com/sk.audios.dev/images/"+word.id+"/original/"+word.image_file_name;
              // https://s3.amazonaws.com/sk.CursoIngles/vocabimages/vocab100.png
              var file="https://s3.amazonaws.com/sk.CursoIngles/vocabimages/vocab"+word.id+".png"
              files.push({"id":word.id, "file":file});
              //console.log("  "+word.name+" "+file)
            }
          }
        }
      }

      for (xx=0;xx<files.length;xx++)
      {
        f=files[xx];
        id=f.id;
        file="vocab"+id+".png"
        console.log (">>> "+file)

        $cordovaFile.removeFile(cordova.file.dataDirectory, file)
        .then(function (success) {
          console.log(">>> Success borrando archivo.")
          console.log(JSON.stringify(success));
        }, function (error) {
          console.log(">>> Error borrando archivo.")
          console.log(JSON.stringify(error));
        });

      }

    }

    genService.removeItem("__"+idx);
    var m=$scope.cacheItems.length;      
    c=-1;
    for(j=0;j<m;j++)   
    {
      if ($scope.cacheItems[j].name==idx) 
        c=j;
    }
    if (c>-1)
    {
      $scope.totSize=$scope.totSize-$scope.cacheItems[c].size;      
      $scope.cacheItems.splice(c,1);
    }
  }

  $scope.deleteCacheItemClick2=function(name){
    console.log("* deleteCacheItemClick2 *");
    console.log(name);
    localStorage.removeItem(name);
    var m=$scope.cacheItems2.length;
    c=-1;
    for(j=0;j<m;j++)
    {
      if ($scope.cacheItems2[j].name==name)
        c=j;
    }
    if (c>-1)
    {
      $scope.totSize2=$scope.totSize2-$scope.cacheItems2[c].size;
      $scope.cacheItems2.splice(c,1);
    }
  }

  $scope.deleteAllCacheClick=function(){    
    console.log("*deleteCacheItemClick*");

    // Se quita el 'curso actual' para que lo recargue, no lo tome del 'caché' de la app
    // La proxima vez que entre en el mismo curso
    varGlobal.currentCourse={'id':0};

    var m=$scope.cacheItems.length;
    c=-1;
    for(j=0;j<m;j++)   
    {
      idx=$scope.cacheItems[j].name;
      if (idx.substring(0,5)=="tests")
      {
        if (idx.substring(0,9)!="testslist")
        {
          var val=JSON.parse(genService.getItem("__"+idx));
          var list=val.data;
          for(xx=0;xx<list.length;xx++)
          {
            k="__test"+list[xx];
            genService.removeItem(k);
          }
        }
      }
      if (idx.substring(0,12)=="conjugations")
      {
        var val=JSON.parse(genService.getItem("__"+idx));
        var verbs=val.data;
        for(xx=0;xx<verbs.length;xx++)
        {
          k="__conjugation_"+verbs[xx];
          genService.removeItem(k);
        }
      }
      if ( r34lp0w3r.platform != 'browser' && idx.substring( 0, 12 ) == "vocabularies" )
      {

        var val=JSON.parse(genService.getItem("__"+idx));
        var files=[];
        for(xx=0;xx<val.vocabs.length;xx++)
        {
          ///console.log(result.data.vocabs[xx].name);
          for (yy=0;yy<val.vocabs[xx].vocabularies.length;yy++)
          {
            //console.log(" "+result.data.vocabs[xx].vocabularies[yy].name);
            for (zz=0;zz<val.vocabs[xx].vocabularies[yy].words.length;zz++)
            { 
              var word=val.vocabs[xx].vocabularies[yy].words[zz];
              if (word.image_file_name)
              {
                // https://s3.amazonaws.com/sk.audios.dev/images/722/original/Fotolia_76475468_XS.jpg
                // var file="https://s3.amazonaws.com/sk.audios.dev/images/"+word.id+"/original/"+word.image_file_name;
                // https://s3.amazonaws.com/sk.CursoIngles/vocabimages/vocab100.png
                var file="https://s3.amazonaws.com/sk.CursoIngles/vocabimages/vocab"+word.id+".png"
                files.push({"id":word.id, "file":file});
                //console.log("  "+word.name+" "+file)
              }
            }
          }
        }

        for (xx=0;xx<files.length;xx++)
        {
          f=files[xx];
          id=f.id;
          file="vocab"+id+".png"
          console.log (">>> "+file)

          $cordovaFile.removeFile(cordova.file.dataDirectory, file)
          .then(function (success) {
            console.log(">>> Success borrando archivo.")
            console.log(JSON.stringify(success));
          }, function (error) {
            console.log(">>> Error borrando archivo.")
            console.log(JSON.stringify(error));
          });

        }        

      }
      genService.removeItem("__"+idx);
    }
    $scope.cacheItems=[];
    $rootScope.allCached=false;
  }

  $scope.chache2click=function(idx){
    console.log("*cache2click*");
    console.log(idx);
    console.log($scope.cacheItems2[idx]);
    console.log(window.localStorage.getItem($scope.cacheItems2[idx].name));
//    console.log(JSON.parse(window.localStorage.getItem($scope.cacheItems2[idx].name)));  
alert((window.localStorage.getItem($scope.cacheItems2[idx].name)));      
  }


  $scope.items = [ "Amor", "Vida", "Felicidad", "Paz", "Comportamiento", "Educación", "Conocimiento", "Lenguaje", "Belleza", "Cambios", 
  "Talento", "Sabiduría", "Coraje", "Civilización", "Muerte", "Creatividad", "Inglés", "Experiencia", "Libertad", "Amistad", 
  "El perdón", "Humor", "Inteligencia", "Justicia", "Aprendizaje", "Humanidad", "Naturaleza", "Éxito", "Ciencia", "Silencio", "Riqueza" ]


  $scope.section = {
    lesson_id:60,
    pairs:[0,2],
    resources:[
    {type:1,id:12,name:"Modals 1"},
    {type:1,id:34,name:"Modals 2"},
    {type:2,name:"You Can't Hurry Love"},
    {type:3,name:"English Pronunciation",title:"English Pronunciation"}
    ]
  }

  $scope.tg1=true;
  $scope.switch1=function(){
    console.log("switch1");    
    console.log($scope.tg1);    
    if ($scope.tg1)
      $scope.tg1=false;
    else
      $scope.tg1=true;
  }

  $scope.tg2=true;
  $scope.switch2=function(){
    console.log("switch2");
    console.log($scope.tg2);       
    if ($scope.tg2)
      $scope.tg2=false;
    else
      $scope.tg2=true;
  }

  $scope.itemClick=function(e,index){
    console.log("* itemClick *");
    console.log($scope.items[index]);
    //console.log(e.currentTarget);
    var el=angular.element(e.currentTarget)
    //console.log(el);
    
    var oldPos=$ionicPosition.position(el).left;
    //console.log("* item top / oldPos / itemWidth *")
    //console.log($ionicPosition.position(el).top);
    //console.log(oldPos);
    var itemWidth=el.prop('offsetWidth');
    //console.log(itemWidth)

    //console.log(el.parent());
    var parentWidth=el.parent().prop('clientWidth');

    //console.log("* parent offsetWidth / scrollWidth / clientWidth *");
    //console.log(el.parent().prop('offsetWidth'));
    //console.log(el.parent().prop('scrollWidth'));
    //console.log(parentWidth);

    var newPos=(parentWidth-itemWidth)/2 // <- Con parentwidth relativo, (no los 2000 px si no los 309)
    //console.log("* newPos *");
    //console.log(newPos);

    var delta=oldPos-newPos;
    //console.log("* delta *");
    //console.log(delta);


    var oldScrollPos=$ionicScrollDelegate.$getByHandle('miScroller').getScrollPosition().left;
    //console.log("* oldScrollPos *");
    //console.log(oldScrollPos);

    //var parentWidth=el.parent().prop('scrollWidth');
    
    var newScrollPos=oldScrollPos+delta;
    //console.log("* newScrollPos *");
    //console.log(newScrollPos);


    //$ionicScrollDelegate.$getByHandle('miScroller').scrollTop();
    $ionicScrollDelegate.$getByHandle('miScroller').scrollTo(newScrollPos, 0, true)

    $scope.selItem=index;
  }

  $scope.selItem=0;



 //////////////////////////////// Pruebas de Drag & Drop
  $scope.centerAnchor = false;
  $scope.toggleCenterAnchor = function () {$scope.centerAnchor = !$scope.centerAnchor}
  $scope.draggableObjects = [{name:'uno'}, {name:'dos'}, {name:'tres'}, {name:'cuatro'}];
  $scope.droppedObjects1 = [];
  $scope.droppedObjects2= [];

  $scope.onDragStart1=function(data,evt){
    console.log("onDragStart1");    
  }
  $scope.onDragStart2=function(data,evt){
    console.log("onDragStart2");    
  }

  $scope.onDragSuccess1=function(data,evt){
    console.log("133","$scope","onDragSuccess1", "", evt);
    var index = $scope.droppedObjects1.indexOf(data);
    if (index > -1) {
      $scope.droppedObjects1.splice(index, 1);
    }
  }
  $scope.onDropComplete1=function(data,evt){
    console.log("onDropComplete1");    
    var index = $scope.droppedObjects1.indexOf(data);
    if (index == -1)
      $scope.droppedObjects1.push(data);
  }
  $scope.onDragSuccess2=function(data,evt){
      console.log("onDragSuccess2");
      var index = $scope.droppedObjects2.indexOf(data);
      if (index > -1) {
          $scope.droppedObjects2.splice(index, 1);
      }
  }  
  $scope.onDropComplete2=function(data,evt){
      console.log("onDropComplete2")
      var index = $scope.droppedObjects2.indexOf(data);
      if (index == -1) {
          $scope.droppedObjects2.push(data);
      }
  }  
  ////////////////////////////////






  $scope.messages=[];
  var message={ userName:"Manolo Sánchez", text:"Contenido del mensaje", time:"10:20", userId:100008};
  $scope.messages.push(message);

  var message={ userName:"Julia Ramirez", text:"Contenido del otro mensaje", time:"10:00", userId:9999};
  $scope.messages.push(message);

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



  $scope.datos={};
  $scope.datos.loces=($rootScope.loc=="es");
  $scope.datos.locen=($rootScope.loc=="en");
  $scope.datos.locbr=($rootScope.loc=="br");
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


  $scope.TTSTest01=function(locale,text) {
    var speed = 0.75;
    if( window.cordova )
      if( r34lp0w3r.platform == 'ios' )
          speed = 1.5;
    TTS
        .speak({
            text: $scope.datos.ttstext,
            locale: locale,
            rate: speed
        }, function () {
            console.log('TTS success.');
        }, function (reason) {
            console.log('TTS failed: '+reason);
        });
  }

  $scope.STT=function() {
    recognition = new SpeechRecognition();
    recognition.onresult = function(event) {
        if (event.results.length > 0) {
            //$ionicLoading.hide();         
            text = event.results[0][0].transcript;
            $scope.datos.ttstext=text;
            $scope.$apply();
            //alert(text);
        }
    }
    //$ionicLoading.show();
    recognition.start();
  }

})




async function descargarZipAudioX(url) {

  const Filesystem = window.Capacitor.Plugins.Filesystem;

  try {
    console.log('*** descargarZipAudio * Descargando ZIP desde:', url);

    // Descargar como blob
    const response = await fetch(url);
    if (!response.ok) throw new Error('Error al descargar el archivo.');
    const blob = await response.blob();

    // Convertir a base64
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (!result) return reject('Error en lectura base64.');
        resolve(result.split(',')[1]); // quitar data:application/zip;base64,
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // Asegurar el directorio (Filesystem lo crea automáticamente si no existe)
    const fullPath = 'audio/sections/tmp.zip';

    await Filesystem.writeFile({
      path: fullPath,
      data: base64,
      directory: "DATA",
      recursive: true,
    });

    console.log(`*** descargarZipAudio * ✅ ZIP guardado en ${fullPath}.`);
    return true;

  } catch (error) {
    console.error('*** descargarZipAudio * ❌ Error al descargar o guardar el ZIP:', error);
    return false;
  }

}


function unzipTmpX(zipPath) {

  const Filesystem = window.Capacitor.Plugins.Filesystem;

  return new Promise(function (resolve) {
    console.log('* unzipTmp * Iniciando descompresión SECUENCIAL v4 para:', zipPath);

    var lastSlashIndex = zipPath.lastIndexOf('/');
    var extractToDir = (lastSlashIndex === -1) ? '' : zipPath.substring(0, lastSlashIndex);

    Filesystem.readFile({ path: zipPath, directory: "DATA" })
      .then(function (result) {
        var jszip = new JSZip();
        return jszip.loadAsync(result.data, { base64: true });
      })
      .then(function (zip) {
        // --- PASO 1: SEPARAR Y ORDENAR DIRECTORIOS ---
        var dirEntries = [];
        var fileEntries = [];
        zip.forEach(function (relativePath, zipEntry) {
          if (zipEntry.dir) {
            dirEntries.push(zipEntry);
          } else {
            fileEntries.push(zipEntry);
          }
        });

        // ¡CAMBIO CLAVE! Ordenamos los directorios alfabéticamente por su nombre.
        // Esto garantiza que 'padre/' siempre se procese antes que 'padre/hijo/'.
        dirEntries.sort(function (a, b) {
          return a.name.localeCompare(b.name);
        });

        // --- PASO 2: CREAR DIRECTORIOS EN SERIE (UNO TRAS OTRO) ---
        console.log('* unzipTmp * Creando ' + dirEntries.length + ' directorios en SERIE...');
        // Empezamos con una promesa ya resuelta para poder encadenar la primera.
        var serialDirPromise = Promise.resolve();

        dirEntries.forEach(function (dirEntry) {
          // Encadenamos la siguiente promesa a la anterior.
          serialDirPromise = serialDirPromise.then(function () {
            var fullDestPath = extractToDir ? extractToDir + '/' + dirEntry.name : dirEntry.name;
            return Filesystem.mkdir({
              path: fullDestPath,
              directory: "DATA",
              recursive: true, // Lo mantenemos por seguridad
            }).catch(function (error) {
              if (error && error.code === 'OS-PLUG-FILE-0010') {
                return Promise.resolve(); // Ignoramos si ya existe
              }
              return Promise.reject(error); // Propagamos otros errores
            });
          });
        });

        return serialDirPromise.then(function () {
          // --- PASO 3: ESCRIBIR ARCHIVOS EN PARALELO (esto es seguro ahora) ---
          console.log('* unzipTmp * Escribiendo ' + fileEntries.length + ' archivos en PARALELO...');
          var filePromises = fileEntries.map(function (fileEntry) {
            var fullDestPath = extractToDir ? extractToDir + '/' + fileEntry.name : fileEntry.name;
            return fileEntry.async('base64').then(function (content) {
              return Filesystem.writeFile({
                path: fullDestPath,
                data: content,
                directory: "DATA",
              });
            });
          });
          return Promise.all(filePromises);
        });
      })
      .then(function () {
        console.log('* unzipTmp * ¡Extracción completada!');
        return Filesystem.deleteFile({ path: zipPath, directory: "DATA" });
      })
      .then(function () {
        console.log('* unzipTmp * Archivo ' + zipPath + ' eliminado.');
        resolve(true);
      })
      .catch(function (error) {
        console.error('* unzipTmp * Ha ocurrido un error durante la descompresión:', error);
        resolve(false);
      });
  });
}



function borrarDirectorio(subdir) {

  const Filesystem = window.Capacitor.Plugins.Filesystem;

  return new Promise(function (resolve) {
    console.log('* borrarDirectorio * Intentando borrar el directorio:', subdir);

    // Verificamos que se haya pasado una ruta válida para evitar borrar la raíz por error.
    if (!subdir || subdir === '' || subdir === '/') {
        console.error('* borrarDirectorio * Ruta de directorio no válida o vacía. Operación cancelada por seguridad.');
        return resolve(false);
    }

    Filesystem.rmdir({
      path: subdir,
      directory: "DATA",
      recursive: true, // ¡MUY IMPORTANTE! Esto borra el contenido del directorio también.
    })
    .then(function() {
      console.log('* borrarDirectorio * Directorio borrado con éxito:', subdir);
      // El directorio fue borrado, resolvemos con 'true'.
      resolve(true);
    })
    .catch(function(error) {
      console.error('* borrarDirectorio * Error al borrar el directorio:', subdir, error);
      // Cualquier error (ej: el directorio no existe) hará que resolvamos con 'false'.
      resolve(false);
    });

  });


}

