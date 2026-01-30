angular.module('starter').controller('SectionCtrl', function($scope, $rootScope, $state, $stateParams, varGlobal, UnitsService, CoursesService, $ionicSlideBoxDelegate, $timeout, $ionicLoading, backendService, $ionicScrollDelegate,adsService,AuthService,genService,$ionicPosition,$ionicPopup,$ionicModal) {

  genService.logEvent('Section ' + $stateParams.lessonId, { uuid: uuid });

  adsService.showInterstitial(AdMob);

  $scope.hayFloat=false;
  // Esto hace que aparezcan o no los 'controles flotantes':
  // el de arriba a la izquierda que cambia el idioma del texto,
  // y los de la derecha que controlan la reproducción del audio.

  $scope.chipi2=function()
  {
    //Nothing
    console.log("* chipi2 * : Nothing.");
  }

  $scope.startedPlaying=false;

  $scope.ctrlAccent="U"
  $scope.ctrlGender="F"
  $scope.ctrlPanelClick=function(cual)
  {
    switch (cual) {
      case 0:
        $scope.ctrlAccent = "U"
        $scope.ctrlGender = "F"
        break;
      case 1:
        $scope.ctrlAccent = "U"
        $scope.ctrlGender = "M"
        break;
      case 2:
        $scope.ctrlAccent = "B"
        $scope.ctrlGender = "F"
        break;
      case 3:
        $scope.ctrlAccent = "B"
        $scope.ctrlGender = "M"
        break;
    }
    $scope.showCtrlPanel=false;
  }


  $scope.showCtrlPanel=false;
  $scope.toggleCtrlPanel=function()
  {  
    if (!$rootScope.premium)
      $rootScope.goPremium("lessonAudios");
    else
      $scope.showCtrlPanel=!$scope.showCtrlPanel;
  }

  $scope.lesson_loc_es=($rootScope.loc=="es");
  window.lesson_loc_es=$scope.lesson_loc_es;

  $scope.langClick=function()
  {
    $scope.showCtrlPanel=false;
    $scope.lesson_loc_es=!$scope.lesson_loc_es;
    window.lesson_loc_es=$scope.lesson_loc_es;  
  }




  $scope.autoSpeech=window.autoSpeech;

  $scope.media=null;

  $scope.pauseLen=1000;

  if ($rootScope.loc=="es")
    $scope.ttsNames=["Nativo","Conchita","Enrique","Penelope","Miguel","es-ES-Standard-A"];
  else
    $scope.ttsNames=["Nativo",
  "Amy","Brian","Emma","Ivy","Joanna","Joey","Justin","Kendra",
  "en-GB-Standard-A","en-GB-Standard-B","en-GB-Standard-C","en-GB-Standard-D","en-US-Standard-B","en-US-Standard-C","en-US-Standard-D","en-US-Standard-E",
  "en-US-Wavenet-A","en-US-Wavenet-B","en-US-Wavenet-C","en-US-Wavenet-D","en-US-Wavenet-E","en-US-Wavenet-F"];

  $rootScope.userInfo=AuthService.getUserInfo();

  if ($scope.userInfo)
  {
    var lc=$scope.userInfo.lc;
    if (!lc)
      var lc="en-us";
  }
  else
    var lc="en-us";

  if ($rootScope.loc=="es")
    $scope.ttsLoc="es-ES";
  else
  {
    if (lc=="en-us")
      $scope.ttsLoc="en-US";
    else
      $scope.ttsLoc="en-GB";
  }

  var speed = 0.75;
  if( r34lp0w3r.platform == 'ios' )
    speed = 1.5;
  $scope.ttsSpeed=speed;

  $scope.live=false;
  $scope.steps=-3;
  $scope.currentStep=-2;
  $scope.playing=false;
  $scope.stepTick=null;

  $scope.ResetClick=function()
  {
    console.log("* resetClick *");
    $scope.startedPlaying = false;
    $scope.playing = false;
    $scope.cancelTick();    
    backendService.Stop();
    if ($scope.media) $scope.media.stop();
    $timeout(function () { $scope.playing = false; $scope.live = false; }, 2);    
    $scope.marca($scope.currentStep, 0);  
    $scope.currentStep = 0;
    $ionicScrollDelegate.$getByHandle('miScroller').scrollTo(0, 0, true);
  }

  $scope.cancelTick = function () {
    if ($scope.mediaStepTick) {
      console.log("* -> Cancela el timer.");
      $timeout.cancel($scope.mediaStepTick);
      $scope.stepTick = null;
    }
    else {
      console.log("* -> El timer ya estaba cancelado.");
    }
  }
  /// >>>
  $scope.playPauseClick = async function()
  {
    console.log("* playPauseClick *");

    if (!$rootScope.premium) {
      $rootScope.goPremium("lessonAudios");
      return;
    }     

    console.log("* playPauseClick * $scope.course.id: ", $scope.course.id);
    
    $scope.startedPlaying = true;
    $scope.playing=!$scope.playing;
    if ($scope.playing)
    {
      genService.logEvent('PlaySection ' + $stateParams.lessonId, { uuid: uuid });
      await $scope.deltaClick(1);    
    }
    else
    {
      $scope.cancelTick();    
      $scope.marca($scope.currentStep,1);
      backendService.Stop();
      if ($scope.media) { $scope.media.stop(); $scope.media.release(); }
      $timeout(function() { $scope.playing=false; $scope.live=false; }, 2);  
    }
  }
  $scope.deltaClick = async function(delta)
  {
    console.log("* deltaClick * delta:", delta)
    if ($scope.playing)
    {  
      $scope.cancelTick();  
    }
    if ($scope.live)
    {
      $scope.marca($scope.currentStep,1);
      backendService.Stop();
      if ($scope.media) $scope.media.stop();
    }
    if (delta == -999) // Se llama con -999 para que pare la reproduccion correctamente si está reproduciendo al cambiar de tab o slide.
    {
      $scope.startedPlaying=false;
      return; 
    }
    if ($scope.currentStep!=0) $scope.marca($scope.currentStep,0);  
    $scope.currentStep+=delta;
    if ($scope.currentStep>$scope.steps || $scope.currentStep==0)
    {
      $scope.pcnt=0;
      $scope.currentStep=0;
      $scope.playing=false;
      $ionicScrollDelegate.scrollTop(true); 
      return;  
    }
    $scope.pcnt = ($scope.currentStep * 100 / $scope.steps).toFixed(0);
    $scope.marca($scope.currentStep,2);
    $scope.coloca($scope.currentStep);
    await $scope.reproduce();
  }




//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  ///
  $scope.audioOK = function () {
    console.log("* audioOK *");
    console.log("* audioOK * playing:", $scope.playing);
    $timeout(function () { $scope.live = false; }, 2);
    if ($scope.playing)
    {
      $scope.marca($scope.currentStep, 1);
      setTimeout(function () {
        if ($scope.playing)
          $scope.deltaClick(1);          
      }, $scope.pauseLen);
    }
  }
  ///
  $scope.audioKO = function (err) {
    console.log("* audioKO: "+JSON.stringify(err));
    $scope.cancelTick();
    $scope.startedPlaying = false;
    backendService.Stop();
    if ($scope.media) $scope.media.stop();
    $timeout(function () { $scope.playing = false; $scope.live = false; }, 2);
    $scope.marca($scope.currentStep, 0);
    $scope.currentStep = 0;
    $timeout(function () { $ionicScrollDelegate.$getByHandle('miScroller').scrollTo(0, 0, true); }, 2);

    if ($rootScope.premium) 
    {
      if (err.code==4)
      {
        console.log("* error 4: estaba en background, se ignora. *");
      }
      else
        var myPopup = $ionicPopup.show({ template: '', title: "", subTitle: "If you want to enjoy the high quality audio while offline, go to 'downloads' in the settings page.\n(" + JSON.stringify(err)+")", scope: $scope, buttons: [{ text: 'Ok', onTap: function(){console.log("OK")} }] });
      //$state.go("app.downloads");
    }
    else 
    {
      $rootScope.goPremium("lessonAudios");
    }
  }
  ///
async function playAndWait(url) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    
    audio.addEventListener('ended', resolve);
    audio.addEventListener('error', (err) => {
      console.error('* playAndWait * Error reproduciendo audio:', err);
      reject(err);
    });

    audio.play().catch((err) => {
      console.error('* playAndWait * Error al iniciar audio:', err);
      reject(err);
    });
  });
}
  ///
  $scope.reproduce= async function()
  {
    console.log("* reproduce * [" + $scope.currentSlide + "] [" + $scope.currentStep + "] *");

    $scope.localReady = ($rootScope.loadingStatus["audios"][$scope.course.id][0] == 2);

    console.log("* reproduce * localReady: " + $scope.localReady);
    console.log("* reproduce * isOnLine: " + $rootScope.isOnLine);

    var frase = $scope.Unit.sections[$scope.currentSlide].frases[$scope.currentStep - 1];

    $timeout(function () { $scope.live = true; }, 2);

    console.log("* reproduce * slide:", $scope.currentSlide);
    console.log("* reproduce * step:", $scope.currentStep);
    console.log("* reproduce * tab:", $scope.tabOption);
    var field = [3, 1, 5][$scope.tabOption];
    console.log("* reproduce * field: " + field);
    if ($scope.ctrlAccent == "U")
      if ($scope.ctrlGender == "M") $scope.voice = "US-D"; else $scope.voice = "US-E";
    else
      if ($scope.ctrlGender == "M") $scope.voice = "GB-B"; else $scope.voice = "GB-A";
    console.log("* reproduce * voice: " + $scope.voice); 

    var mp3 = $scope.Unit.sections[$scope.currentSlide].audio[field].mp3[$scope.currentStep - 1];    
    $scope.mp3 = mp3 
    console.log("* reproduce * mp3:", mp3);

    var lesson = mp3.substring(0, 5);
    var S3URL = "https://s3.amazonaws.com/sk.audios/speech." + $scope.voice + "/" + lesson + "/" + $scope.voice + "/" + mp3;

    console.log("* reproduce * S3URL:", S3URL);

    if ( r34lp0w3r.platform == 'browser' )
      var localURL = S3URL;
    else 
      var localURL = "audio/sections/" + lesson + "/" + $scope.voice + "/" + mp3;

    console.log("* reproduce * localURL:", localURL);

    // Aqui hay que asignar localURL si existe,
    // Si no existe, si existe el de S3 se asigna.
    // Si no existe el de S3 (o el dispositivo no está online), se salta a mediaPlayKO con el err -1

    if ($scope.localReady)
    {
      var playURL = localURL;
      console.log("* reproduce * playURL:", playURL);
      $scope.showMP3 = playURL;
      
      if ($scope.audio) { $scope.audio.stop(); $scope.audio.release(); }
      const resultadoUri = await window.Capacitor.Plugins.Filesystem.getUri({ path: playURL, directory: 'DATA' });
      const urlServible = window.Capacitor.convertFileSrc(resultadoUri.uri);
      console.log('* reproduce * URL Nativa:', resultadoUri.uri);
      console.log('* reproduce * URL Servible por Capacitor:', urlServible);
      await playAndWait(urlServible);
      $scope.audioOK();

    }
    else
    {
      if ($rootScope.isOnLine)
      {
        var playURL = S3URL;
        console.log("* reproduce * playURL: ", playURL);
        await playAndWait(playURL);
        $scope.audioOK();
      }
      else
      {
        $scope.audioKO();
      }
    }
  }
  ///
//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>






  ///
  $scope.contentClick = async function(e) 
  {
    console.log("* contentClick *");
    console.log("* contentClick * lesson_loc_es: "+window.lesson_loc_es);
    console.log("* contentClick * vienedechipi: "+window.vienedechipi);
    if (window.lesson_loc_es)
    {
      console.log("* contentClick * version ES. click ignorado *");
      window.vienedechipi=false;
      return;
    }
    if (!window.autoSpeech)
    {
      console.log("* contentClick * !autoSpeech, click ignorado *");
      return;
    }
    if($scope.playing)
    {
      console.log("* contentClick * playing, click ignorado *");
      return;
    }
    if (!$rootScope.premium)
    {
      console.log("* contentClick * no premium, ofrecerselo *")
      $rootScope.goPremium("lessonAudios");
      return;
    }
    
    var canvas_x = e.gesture.center.pageX;
    var canvas_y = e.gesture.center.pageY;
    console.log("* contentClick * canvas_x:",canvas_x);
    console.log("* contentClick * canvas_y:",canvas_y);   
    
    var step_clicked=-1;
    for(idx=0;idx<$scope.steps;idx++)
    {
      if ($scope.getPos(idx, canvas_x, canvas_y))
      {
        step_clicked = idx;
        break;
      }
    }
    if (step_clicked==-1)
    {
      console.log("* contentClick * click fuera *");

      if ($scope.currentStep)
      {
        $scope.marca($scope.currentStep, 1);

        backendService.Stop();
        if ($scope.media) $scope.media.stop();
      }
      return;
    }

    console.log("* contentClick * click en step " + ( step_clicked + 1 ) + " *");
    console.log("* contentClick * $scope.currentStep:",$scope.currentStep);
  
    if ($scope.currentStep)
      $scope.marca($scope.currentStep, 0);

    $scope.currentStep = step_clicked+1;

    $scope.pcnt = ($scope.currentStep * 100 / $scope.steps).toFixed(0);

    $scope.marca($scope.currentStep, 2);

    $scope.coloca($scope.currentStep);

    $scope.startedPlaying = true;
  
    console.log("* contentClick * ANTES DE $scope.reproduce()");
    await $scope.reproduce();
    console.log("* contentClick * DESPUÉS DE $scope.reproduce()");

  }
  ///




  $scope.tick=function()
  {
    console.log("* STEP TICK *");
    if ($scope.stepTick)
    {
      console.log(" -> lo cancela.");
      $timeout.cancel($scope.stepTick);
      $scope.stepTick=null;
    }  
    else
    {
      console.log(" -> Ya era null.");
    }
    $scope.deltaClick(1);
  }

  $scope.playCallback1 = function () { $scope.playCallback(1); }
  $scope.playCallback2=function(){ $scope.playCallback(2); }
  $scope.playCallback3 = function () 
  { 
    console.log("  --> playCallback3 <--"); 
    //window.audio2.stop();
    //window.audio2.release();    
    $scope.playCallback(3); 
  }
  $scope.playCallback=function(quien)
  {
    console.log("*");
    console.log("*");
    console.log("*");
    console.log("* playCallback("+quien+") * ["+$scope.currentStep+"] *");

    if (!ionic.Platform.isAndroid())
      return;

    $scope.marca($scope.currentStep,1);

    $timeout(function() { $scope.live=false; }, 2);

    if ($scope.playing)
      $scope.stepTick=$timeout($scope.tick,$scope.pauseLen);
  }

  $scope.doScroll=function(donde)
  {
    setTimeout(function(){ $ionicScrollDelegate.$getByHandle('miScroller').scrollTo(0, donde, true) },100);
  }


  $scope.trgt=function(cual)
  {
    console.log("> trgt - cual:",cual);
    var item=$scope.Unit.sections[$scope.currentSlide].items[cual];
    console.log("> trgt - item:",JSON.stringify(item));
    if (!item)
    {
      console.log("> trgt - !item")
      return
    }       
    if (!item.hasOwnProperty("block") || !item.hasOwnProperty("row") || !item.hasOwnProperty("col"))
    {
      console.log("> trgt - !item.hasOwnProperty('block') || !item.hasOwnProperty('row') || !item.hasOwnProperty('col')")
      return
    }
    var block=item["block"];
    var row=item["row"];
    var col=item["col"];
    // Si el elemento es la celda de la columna 0 de la fila 0 de una tabla, podria ser en realidad otro item (sin filas ni columnas).
    var target="cell"+(block).toString()+"_"+(row).toString()+"_"+(col).toString();
    //console.log(target);
    var el= document.getElementById(target);
    if (el!== null)
    {
      //console.log("existe.");
    }
    else
    {
      //console.log("no existe.");
      target="blk"+(block).toString();
    }
    //console.log(target);  
    return target;
  }


  $scope.getPos = function (cual,x,y) 
  {
    //console.log("getPos");
    elRect = document.getElementById($scope.trgt(cual)).getBoundingClientRect();
    //console.log(x, y, elRect.x + elRect.width - 1, elRect.y + elRect.height - 1,elRect);
    if (x<elRect.x) return false;
    else 
      if (y<elRect.y) return false;
      else 
        if (x > (elRect.x + elRect.width - 1)) return false;
        else 
          if (y > (elRect.y + elRect.height - 1)) return false;
          else return true;
  }

  $scope.marca=function(cual,como){
    //  var target="s"+(cual).toString().padStart(3,"0"); 
    var target=$scope.trgt(cual-1);
    //console.log(" * marca *",cual,target,como);
    var el= document.getElementById(target);
    //console.log(" el=document.getElementById('"+target+"') ->",el);
    var el = angular.element(el);
    //console.log(" angular.element(el) ->",el);
    if (como==2)
      el.addClass('marcado2');
    else
      if (como==1)
      {
        el.removeClass('marcado2');
        el.addClass('marcado');
      }
      else // 0 == desmarcar
      {
        el.removeClass('marcado');
        el.removeClass('marcado2');
      }
  }


  $scope.coloca=function(cual)
  {
    var target=$scope.trgt(cual-1)
    console.log("* coloca *",target)
    setTimeout(function(){
      var el= document.getElementById('s000');
      //console.log("s000",el);
      var el = angular.element(el);
      //console.log(el);
      var pos0=$ionicPosition.offset(el).top;
      //console.log(pos0);
      var el= document.getElementById(target);
      //console.log("target",el);
      var el = angular.element(el);
      //console.log(el);
      var posn=$ionicPosition.offset(el).top;
      //console.log(posn);
      var delta=posn-pos0+100;
      $ionicScrollDelegate.$getByHandle('miScroller').scrollTo(0, delta, true)
    },100);
  }








  $scope.goPremiumOpts=function()
  {
    if ( AdMob && window.adsOn ) AdMob.banner.hide();
    $rootScope.premiumOpts.show()
  }


  $rootScope.reward=false;

  $rootScope.extra=false; // Este flag se usa para que al entrar en tests 'sepa' que viene de una lección. Se activa en beforeEnter y se desactiva en beforeLeave.


  ///////// EVENTOS DEL VIEW

  $scope.$on("$ionicView.beforeEnter", function( scopes, states ){ 

    // La variable chipiDisabled anula la reproducción de audio al hacer tap sobre el altavoz de los examples. 
    // Ese audio es el nativo (TTS), cuando el usuario es Premium, no ha de reproducirse, ya dispone del 'click on tap' que 
    // Reproduce el audio de alta calidad (mp3).
    window.tmp=window.chipiDisabled;
    window.chipiDisabled=true;

    if ($rootScope.sectionPayLoad)
    {
      $scope.sectionPayLoad=$rootScope.sectionPayLoad; // Indica que viene del conjugador
      $rootScope.sectionPayLoad=null;  
    }

    $ionicLoading.show();
    $scope.visible=false;

    $rootScope.extra=true; 
 });

 $scope.$on('$ionicView.beforeLeave', function(){ 
  window.chipiDisabled=window.tmp;    
  $rootScope.extra=false; 
 }); 

///////// EVENTOS DEL VIEW


function href2Chipi(wf) 
{
  var regex = /href=\"\/texttospeech/gi, result, sr = [];
  while ((result = regex.exec(wf))) {
    let trozo = wf.substring(result.index, result.index + 100);
    let wd = trozo.search(">");
    let original = wf.substring(result.index, result.index + wd);
    let cambiado = "onclick=\"chipi('" + trozo.substring(20, wd - 1).replace("'", "*") + "')\"";
    if (original.trim().length > 0) {
      sr.push({ i: result.index, f: result.index + wd, original: original, cambiado: cambiado });
    }
  }
  for (let iii = sr.length - 1; iii >= 0; iii--) {
    wf = wf.replace(sr[iii].original, sr[iii].cambiado);
  }
  return wf;
}




////////// PROCESA
  $scope.procesa=function(){
    //dbgless
    console.log("### PROCESA START ###");
    var nsections=$scope.Unit.sections.length;
    for(i=0;i<nsections;i++) 
    {
      $scope.Unit.sections[i].resources=[];

      ///
      $scope.Unit.sections[i].audio={};

      var section_id=$scope.Unit.sections[i].id;
      var currentField=1; // complete_en
      //->
      $scope.Unit.sections[i].items=[];
      $scope.Unit.sections[i].frases=[];
      $scope.Unit.sections[i].mp3=[];
      //->
      $scope.Unit.sections[i].audio[currentField]={items:[],frases:[],mp3:[],steps:0};
      //<-
      var steps=0;
      var texts=$scope.Unit.sections[i].textfull_en;
      console.log("")
      console.log("-----")
      console.log("texts")
      console.log("-----")
      console.log($scope.Unit.sections[i])
      console.log("-----")
      console.log(texts)
      console.log("-----")
      console.log("")
      if (texts)
      {
         //var index={};
         var nl=0;
         for (block=0;block<texts.length;block++)
         {
            var nr=texts[block].length;
            for (row=0; row<nr; row++)
            {
               var nc=texts[block][row].length;
               for (col=0; col<nc; col++)
               {
                  var txt=texts[block][row][col];
                  if (txt.length>0)
                  {
                    var idx=block.toString().padStart(3,"0")+row.toString().padStart(3,"0")+col.toString().padStart(2,"0");
                    //->
                    $scope.Unit.sections[i].items.push({block:block, row:row, col:col});
                    $scope.Unit.sections[i].frases.push(txt);
                    $scope.Unit.sections[i].mp3.push(section_id.toString().padStart(5, "0")+currentField.toString().padStart(2,"0")+idx+".mp3");
                    //->
                    $scope.Unit.sections[i].audio[currentField].items.push({block:block, row:row, col:col});
                    $scope.Unit.sections[i].audio[currentField].frases.push(txt);
                    $scope.Unit.sections[i].audio[currentField].mp3.push(section_id.toString().padStart(5, "0")+currentField.toString().padStart(2,"0")+idx+".mp3");
                    //<-
                    //index[idx]=nl;
                    nl=nl+1;              
                  }
               }
            }
         }
         steps=nl;
      }
      //->
      $scope.Unit.sections[i].steps=steps;
      //->
      $scope.Unit.sections[i].audio[currentField].steps=steps;
      //<-


      var currentField=3; // compact_en
      $scope.Unit.sections[i].audio[currentField]={items:[],frases:[],mp3:[],steps:0};
      var steps=0;
      var texts=$scope.Unit.sections[i].textcompact_en;
      if (texts)
      {
         //var index={};
         var nl=0;
         for (block=0;block<texts.length;block++)
         {
            var nr=texts[block].length;
            for (row=0; row<nr; row++)
            {
               var nc=texts[block][row].length;
               for (col=0; col<nc; col++)
               {
                  var txt=texts[block][row][col];
                  if (txt.length>0)
                  {
                    var idx=block.toString().padStart(3,"0")+row.toString().padStart(3,"0")+col.toString().padStart(2,"0");
                    $scope.Unit.sections[i].audio[currentField].items.push({block:block, row:row, col:col});
                    $scope.Unit.sections[i].audio[currentField].frases.push(txt);
                    $scope.Unit.sections[i].audio[currentField].mp3.push(section_id.toString().padStart(5, "0")+currentField.toString().padStart(2,"0")+idx+".mp3");
                    //index[idx]=nl;
                    nl=nl+1;              
                  }
               }
            }
         }
         steps=nl;
      }

      // Identificar el último step de la parte no premium
      var p=$scope.Unit.sections[i].wikicompact_en.indexOf("<!-- premium -->");
      if (p!=-1)      
        var wce=$scope.Unit.sections[i].wikicompact_en.substring(0,p-1);
      else
        var wce="";
      // Buscamos el último 'blk='
      var n = wce.lastIndexOf("id='blk");
      if (n!=-1)
      {
        var wce2=wce.substring(n+7);
        n=wce2.indexOf("'")
        var last_blk=parseInt(wce2.substring(0,n));
      }
      else
        var last_blk=0;
      console.log("last_blk:",last_blk);
      // Buscamos el último 'cell='
      var n = wce.lastIndexOf("id='cell");
      if (n!=-1)
      {
        var wce2=wce.substring(n+8);
        n=wce2.indexOf("'")
        var last_cell=wce2.substring(0,n);
        //block_row_col
        var brc=last_cell.split("_");
        last_cell=brc[0];
        last_row=brc[1];
        last_col=brc[2];
      }
      else
      {
        var last_cell=0;
        var last_row=0;
        var last_col=0;
      }
      console.log("last_cell:",last_cell,last_row,last_col);

      if (last_cell>last_blk)
      {
        var b=last_cell;
        var r=last_row;
        var c=last_col;
      }
      else
      {
        var b=last_blk;
        var r=0;
        var c=0;
      }
      last_item=0;
      var items=$scope.Unit.sections[i].audio[currentField].items;
      for (iit=0; iit<items.length; iit++){
        if (items[iit].block==b && items[iit].row==r && items[iit].col==c)
          last_item=iit+1;
      }
      console.log("last_item:",last_item);

      $scope.Unit.sections[i].audio[currentField].steps=steps;
      $scope.Unit.sections[i].audio[currentField].steps_free=last_item;




      var currentField=5; // examples_en
      $scope.Unit.sections[i].audio[currentField]={items:[],frases:[],mp3:[],steps:0};
      var steps=0;
      var texts=$scope.Unit.sections[i].textexamples_en;
      if (texts)
      {
         //var index={};
         var nl=0;
         for (block=0;block<texts.length;block++)
         {
            var nr=texts[block].length;
            for (row=0; row<nr; row++)
            {
               var nc=texts[block][row].length;
               for (col=0; col<nc; col++)
               {
                  var txt=texts[block][row][col];
                  if (txt.length>0)
                  {
                    var idx=block.toString().padStart(3,"0")+row.toString().padStart(3,"0")+col.toString().padStart(2,"0");
                    $scope.Unit.sections[i].audio[currentField].items.push({block:block, row:row, col:col});
                    $scope.Unit.sections[i].audio[currentField].frases.push(txt);
                    $scope.Unit.sections[i].audio[currentField].mp3.push(section_id.toString().padStart(5, "0")+currentField.toString().padStart(2,"0")+idx+".mp3");
                    //index[idx]=nl;
                    nl=nl+1;              
                  }
               }
            }
         }
         steps=nl;
      }
      $scope.Unit.sections[i].audio[currentField].steps=steps;
      ///



      var rsc=[];

      // Tests
      var m=$scope.Unit.tests.length;
      var nex=0;
      for(j=0;j<m;j++) 
      {
        if ($scope.Unit.tests[j].lesson_section_id == section_id)
        {
          var test_id=$scope.Unit.tests[j].id;
          if ($scope.Unit.tests[j].new_date)
          {
            var nd=$scope.Unit.tests[j].new_date.substr(0,19);
            var nw=genService.contentNewCheck("tests",test_id,nd);
          }
          else
            var nw=false;

          var icono=0;
          if ($scope.Unit.tests[j].clase==2) // Multi
            icono=1;        
          else if ($scope.Unit.tests[j].subclase>3) // Tap: 1.4, 1.5, 1.7
            icono=2;
          else 
            icono=3;    
          // "name" : $scope.Unit.tests[j].name
          nex=nex+1;
          if ($rootScope.loc=="es")
            var name="Ejercicio "+(nex);
          else if ($rootScope.loc=="br")             
            var name="Exercício "+(nex);
          else
            var name="Exercise "+(nex);

          rsc.push( { "type":1, "id":$scope.Unit.tests[j].id, "name": name, "complete": $scope.Unit.tests[j].complete, "new":nw, "icono":icono } );
        }
      } 

      // Songs
      if ($scope.Unit.songs[section_id])
      {      
        var m=$scope.Unit.songs[section_id].length;
        for(j=0;j<m;j++) 
        {
          rsc.push( {"type":2, "id" :$scope.Unit.songs[section_id][j].song_id, "name":$scope.Unit.songs[section_id][j].title, "artist":$scope.Unit.songs[section_id][j].name, "video_id":$scope.Unit.songs[section_id][j].video_id} );
        }
      }

      // Videolessons
      if ($scope.Unit.videolessons[section_id])
      {      
        var m=$scope.Unit.videolessons[section_id].length;
        for(j=0;j<m;j++) 
        {
          rsc.push( {"type":3, "title" :$scope.Unit.videolessons[section_id][j].title, "video_id":$scope.Unit.videolessons[section_id][j].video_id} );
        }
      }


      $scope.Unit.sections[i].resources=rsc; 
      //console.log("------------ resources --------------")
      //console.log(rsc)

      var pairs=[]

      nrsc=rsc.length-1;
      for(j=0;j<=nrsc;j+=2) 
      {
        pairs.push(j)
      }

      //console.log(pairs)
      $scope.Unit.sections[i].pairs=pairs;

      //console.log($scope.Unit.sections[i])

      $scope.Unit.sections[i].wikifull = href2Chipi($scope.Unit.sections[i].wikifull);
      $scope.Unit.sections[i].wikifull_en = href2Chipi($scope.Unit.sections[i].wikifull_en);
      $scope.Unit.sections[i].wikiexamples = href2Chipi($scope.Unit.sections[i].wikiexamples);
      $scope.Unit.sections[i].wikiexamples_en = href2Chipi($scope.Unit.sections[i].wikiexamples_en);

      var p=$scope.Unit.sections[i].wikicompact.indexOf("<!-- premium -->");
      if (p!=-1)
      {
        $scope.Unit.sections[i].wikicompact_redacted=$scope.Unit.sections[i].wikicompact.substring(0,p-1);
        $scope.Unit.sections[i].wikicompact_hidden=$scope.Unit.sections[i].wikicompact.substring(p+16,99999);  
      }
      else  
      {
        $scope.Unit.sections[i].wikicompact_redacted="";
        $scope.Unit.sections[i].wikicompact_hidden=$scope.Unit.sections[i].wikicompact;  
      }  

      var p=$scope.Unit.sections[i].wikicompact_en.indexOf("<!-- premium -->");
      if (p!=-1)
      {
        $scope.Unit.sections[i].wikicompact_redacted_en=$scope.Unit.sections[i].wikicompact_en.substring(0,p-1);
        $scope.Unit.sections[i].wikicompact_hidden_en=$scope.Unit.sections[i].wikicompact_en.substring(p+16,99999);        
      }
      else
      {
        $scope.Unit.sections[i].wikicompact_redacted_en="";
        $scope.Unit.sections[i].wikicompact_hidden_en=$scope.Unit.sections[i].wikicompact_en;  
      }

    }

    $scope.Unit.sections[$scope.currentSlide].items=$scope.Unit.sections[$scope.currentSlide].audio[3].items;
    $scope.Unit.sections[$scope.currentSlide].frases=$scope.Unit.sections[$scope.currentSlide].audio[3].frases;
    $scope.Unit.sections[$scope.currentSlide].mp3=$scope.Unit.sections[$scope.currentSlide].audio[3].mp3;

    $scope.steps=$scope.Unit.sections[$scope.currentSlide].audio[3].steps;


    $scope.currentStep=0;
    $scope.playing=false;
    if ($scope.stepTick)
    {
      timeout.cancel($scope.stepTick);
      $scope.stepTick=null;
    }

    console.log("### PROCESA END ###");
    if ($scope.sectionPayLoad=="conjugate")
    {
      console.log("* viene del conjugador *");
      $timeout(function() { $scope.visible=false;$ionicSlideBoxDelegate.slide($scope.currentSlide); $ionicSlideBoxDelegate.update(); $ionicLoading.hide(); $scope.visible=true; }, 650);
    }
    else
    {
      console.log("* viene directo *");
      $timeout(function() { $scope.visible=false;$ionicSlideBoxDelegate.slide($scope.currentSlide); $ionicSlideBoxDelegate.update(); $ionicLoading.hide(); $scope.visible=true; }, 250);      
    }
  } 
  ////////// PROCESA


  ////////// GRABA
  $scope.graba=function()
  {
    if ($scope.Unit.id==999999) return; // Testing
    if (!$scope.userInfo) return;

    var index=$scope.currentSlide;
    var course_id=$scope.course.id;
    var lesson_id=$scope.Unit.sections[index].lesson_id; 
    var lesson_section_id=$scope.Unit.sections[index].id;    
    var lesson_section_name=$scope.Unit.sections[index].name;
    var lesson_section_complete=$scope.Unit.sections[index].complete;
    console.log(index);
    console.log(lesson_section_complete);
    if (lesson_section_complete!="0" || !$scope.userInfo)
    {
      console.log("* no graba *"+lesson_section_name);
      return
    }

    console.log("* graba *");    

    console.log("* antes de recordLesson *");
    $ionicLoading.show();

    // Se toman los updates que haya pendientes de la entrada de localStorage _updatesXXXX (XXX -> user_id)
    if (varGlobal.cacheOn)
    {
      var pendProgress=window.localStorage.getItem("_pendProgress"+$scope.userInfo.id);
      if (!pendProgress)
      {
        pendProgress={ lessons : [] };
        postData={ lessons : [] };
      }
      else
      {
        pendProgress=JSON.parse(pendProgress);
        postData=pendProgress
        if (!pendProgress.lessons)
        {
          pendProgress.lessons=[];
          postData.lessons=[];
        }
      }
    }
    else
    {
        pendProgress={ lessons : [] };
        postData={ lessons : [] };
    }

    // Se añade el lesson_section_id a la tabla de lessons pendientes
    pendProgress.lessons.push(lesson_section_id);
    postData.lessons.push(lesson_section_id);
    // Y se envia al backend
    console.log(pendProgress);
    
    backendService.doPost('/v4/recordProgress',$scope.userInfo,postData,function(result) { // { lesson_section_id: lesson_section_id }
      $ionicLoading.hide();
      console.log('* recordProgress returned value *');
      console.log(result);

      if (varGlobal.cacheOn) 
      {        
        if (result.ok) // Si ha ido bien, se ha de eliminar la entrada de localStorage
          window.localStorage.removeItem("_pendProgress"+$scope.userInfo.id);
        else // Si ha habido error, !result.ok, se ha de actualizar la entrada de localStorage
          window.localStorage.setItem("_pendProgress"+$scope.userInfo.id,JSON.stringify(pendProgress));
      }     

      // Si hay error y el cache no esta on, no ha de actualizar los datos localmente
      if (result.ok || varGlobal.cacheOn) // Actualizar progreso local
      {
        // ¿ Actualizar current_course ?
        if (course_id>=4 && course_id<=6 && course_id>$scope.userInfo.current_course) //  result.data.returnCode=="2") //Ha habido cambio de current_course
        {
          //cc=result.data.cc;
          AuthService.changeCurrentCourse(course_id); // AuthService.changeCurrentUser(cc);
        }

        // Update progress
        $scope.Unit.sections[index].complete="1";
        $scope.userInfo.section_progress[lesson_section_id]=1;
        if (lesson_id in $scope.userInfo.lesson_progress)
          $scope.userInfo.lesson_progress[lesson_id][0]++
        else
          $scope.userInfo.lesson_progress[lesson_id]=[1,0]
        if (course_id in $scope.userInfo.course_progress)
          $scope.userInfo.course_progress[course_id][0]++
        else
          $scope.userInfo.course_progress[course_id]=[1,0]

        if ($scope.userInfo.current_course==course_id) // Es del curso actual, actualizar current_course_progress en userInfo (el porcentaje que aparece en el avatar).
        {
          var cp=$scope.userInfo.course_progress;
          var sectioncount=$scope.Courses[course_id].sectioncount;
          var testcount=$scope.Courses[course_id].testcount;
          var progress=Math.round(100*(cp[course_id][0]+cp[course_id][1])/(sectioncount+testcount));
          $scope.userInfo.current_course_progress=progress;
        }
      }    


      AuthService.setUserProgress($scope.userInfo.course_progress,$scope.userInfo.lesson_progress,null);
    });

    console.log("* después de recordProgress *");
  };
  ////////// GRABA



  $scope.tg1=true;
  $scope.tg2=true;
  $scope.switch1=function(){
    $scope.tg1=!$scope.tg1;
  }
  $scope.switch2=function(){
    $scope.tg2=!$scope.tg2;
  }

  $scope.unitId=$stateParams.unitId;
  $scope.lessonId=$stateParams.lessonId;
 

  $scope.Courses = CoursesService.getCourses(); 
  console.log("-- $scope.Courses -----------")
  console.log($scope.Courses);
  console.log("-- varGlobal.courses")
  console.log(varGlobal.courses);
  console.log("-----------------------------")



  var sameCourse=true;
  if ($stateParams.courseId) // $stateParams.courseId == Ha llegado con courseID -> Desde el botón 'repasar lección' de un test / desde el botón 'lección relacionada' de conjugar.
  {
    if ($stateParams.courseId!=varGlobal.currentCourse.id)
    {
      sameCourse=false;
    }
  }
  else // No viene con courseID, viene del curso
    $scope.conBola=true; // Que aparezca el indicador de lección (1.1 / 2.1 ...)

  if ($stateParams.goTo)
    $scope.tabOption=1;
  else
    $scope.tabOption=0;

  if (sameCourse)
  {
    $scope.course=varGlobal.currentCourse;

    $scope.Unit=UnitsService.GetUnitById($scope.unitId); 
    console.log("--------")
    console.log($scope.unitId)
    console.log($scope.Unit)
    console.log("--------")

    if (!localStorage.getItem("_lastUnit"))
    {
      localStorage.setItem("_lastUnit",JSON.stringify({}))
    }
    var _lastUnit=JSON.parse(localStorage.getItem("_lastUnit"));

    _lastUnit[$scope.course.id]=$scope.unitId;
    localStorage.setItem("_lastUnit",JSON.stringify(_lastUnit)); 
    $scope.currentSlide=0;
    var n=$scope.Unit.sections.length;
    for(i=0;i<n;i++) 
    {
      if ($scope.Unit.sections[i].id == $scope.lessonId)
      {
        $scope.currentSlide=i;
      }
    }      
    //console.log("--->",$scope.Unit.sections[$scope.currentSlide]);    

    genService.contentTrack("lesson",$scope.Unit.sections[$scope.currentSlide].id);

  }
  else
  {

    $scope.course=varGlobal.courses[$stateParams.courseId];
    $scope.Unit={id:0, name:"Cargando ...", sections:[]};

    $ionicLoading.show();
    console.log("* antes de getUnit *");

    var cacheEntry='unit'+$scope.unitId;
    var endpoint='/v3/unit/'+$scope.unitId;
    backendService.doGetCached(cacheEntry,endpoint,$scope.userInfo,function(result) {
      console.log("* dentro de getUnit *");
      //      $ionicLoading.hide();
      console.log('* getUnit returned value *');
      console.log(result);

      $scope.currentSlide=0;
      var n=result.data.lesson.sections.length;
      for(i=0;i<n;i++) 
      {
        if (result.data.lesson.sections[i].id == $scope.lessonId)
        {
          $scope.currentSlide=i;
        }
      }

      $scope.Unit=result.data.lesson;      
      $scope.procesa(); 
      console.log("----- tras procesa -----");
      console.log($scope.Unit);
      $rootScope.viewTitle=$scope.Unit.name; 


    });    
    console.log("* después de getUnit *");

  }












  /////////////////////////////////////////////////////////////////////////////////////////

  $scope.$on('$ionicView.afterEnter', function(){

    console.log("* ENTRA EN LA UNIDAD ($ionicView.afterEnter) *");
    $scope.temporizador=$timeout($scope.graba,20000);

    // Para actualizar tests si vuelve de un test
    $scope.Unit=UnitsService.GetUnitById($scope.unitId);
    if ($scope.Unit)
    {
      console.log("<----------------------");
      console.log($scope.Unit);
      $scope.procesa();
      
      $rootScope.viewTitle=$scope.Unit.name;                
    }
else
    // SI NO HACE ESTO, LA PANTALLA SE QUEDA MAL ACTUALIZADA, TODO EL CONTENIDO COMPRIMIDO A LA IZQUIERDA
    // opcioón original (parece que 250 es poco)
    //    $timeout(function() { $ionicSlideBoxDelegate.slide($scope.currentSlide); $ionicSlideBoxDelegate.update(); $scope.visible=true; }, 250);

    // opción B (se supone que el tiempo aqui puede ser menor)
    //    $timeout(function() { $scope.visible=false;; $scope.visible=true; }, 100);

    // La opción C es poner en el ion-slide que tiene el ng-repeat:  ng-init="updateSlider()"
    // Que llama a $scope.updateSlider(), que solo hace $ionicSlideBoxDelegate.update(); <- Parece que no va, ni si quiera llama a updateSlider() ?¿

    // el $ionicLoading.show() está en beforeEnter
    $timeout(function() { $scope.visible=false; $ionicSlideBoxDelegate.slide($scope.currentSlide); $ionicSlideBoxDelegate.update(); $ionicLoading.hide(); $scope.visible=true; }, 500);
    // Trasladado a PROCESA END <- Recuperado

  });

  $scope.$on('$ionicView.beforeLeave', function()
  {
    console.log("* SALE DE LA UNIDAD ($ionicView.beforeLeave) *");    
    $scope.deltaClick(-999);
    $scope.ResetClick();
    console.log($scope.temporizador);
    if ($scope.temporizador) $timeout.cancel($scope.temporizador);
    if ($scope.stepTick) $timeout.cancel($scope.stepTick);
  });






  $scope.pagerClick = function(cual) {
    console.log("* Cambio de sección (ion-slide-box:pager-click) *",cual);
    
    $rootScope.reward=false; // Si habia visto un video para ver el contenido de la sección, al cambiar de sección tiene que volver a ver otro.    
    $timeout.cancel($scope.temporizador);
    $scope.temporizador=$timeout($scope.graba,20000);
    console.log(cual);
    $ionicSlideBoxDelegate.slide(cual);
  };



  $scope.slideHasChanged=function(cual){
    console.log("* Cambio de sección (ion-slide-box:on-slide-changed) *",cual);

    if (isNaN(cual)) // Parece que según como (temporizadores?) entra con NaN 
      return;

    $scope.deltaClick(-999);

    console.log("*sigue*");

    console.log($scope.currentSlide);    
    console.log($scope.Unit.sections)

    $rootScope.reward=false; // Si habia visto un video para ver el contenido de la sección, al cambiar de sección tiene que volver a ver otro. 
    $scope.tabOption=0;
    $timeout.cancel($scope.temporizador);
    $scope.temporizador=$timeout($scope.graba,20000);
    //console.log(cual);
    //$scope.openItem=-1;
    $scope.currentSlide=cual;

    //->
    //    $scope.steps=$scope.Unit.sections[$scope.currentSlide].steps;
    $scope.Unit.sections[$scope.currentSlide].items=$scope.Unit.sections[$scope.currentSlide].audio[3].items;
    $scope.Unit.sections[$scope.currentSlide].frases=$scope.Unit.sections[$scope.currentSlide].audio[3].frases;
    $scope.Unit.sections[$scope.currentSlide].mp3=$scope.Unit.sections[$scope.currentSlide].audio[3].mp3;
    if ($rootScope.premium)
      $scope.steps=$scope.Unit.sections[$scope.currentSlide].audio[3].steps;
    else
      $scope.steps=$scope.Unit.sections[$scope.currentSlide].audio[3].steps_free;

    //<-

    $scope.currentStep=0;
    $scope.playing=false;
    if ($scope.stepTick)
    {
      timeout.cancel($scope.stepTick);
      $scope.stepTick=null;
    }

    genService.contentTrack("lesson",$scope.Unit.sections[$scope.currentSlide].id);    
    $ionicScrollDelegate.scrollTop(true);
  }; 


  $scope.tabClick = function(index){

    if (index==3)
      $scope.steps=0;
    else
    {

      if (index==0)
        var field=3;
      else if (index==1)
        var field=1;
      else
        var field=5;
        
      if (index==2) // Examples
      {
        if ($rootScope.premium)
          window.chipiDisabled=true;
        else
          window.chipiDisabled=false;
      }
      else
      {
        window.chipiDisabled=true;
      }

      console.log("");
      console.log("");
      console.log("TAB CHANGE")
      console.log("index: "+index);
      console.log("field: "+field);
      console.log($scope.Unit.sections[$scope.currentSlide].audio[field]);  
      $scope.deltaClick(-999);
      //->
      //    $scope.steps=$scope.Unit.sections[$scope.currentSlide].steps;
      $scope.Unit.sections[$scope.currentSlide].items=$scope.Unit.sections[$scope.currentSlide].audio[field].items;
      $scope.Unit.sections[$scope.currentSlide].frases=$scope.Unit.sections[$scope.currentSlide].audio[field].frases;
      $scope.Unit.sections[$scope.currentSlide].mp3=$scope.Unit.sections[$scope.currentSlide].audio[field].mp3;
      if (field==3)
        if ($rootScope.premium)
          $scope.steps=$scope.Unit.sections[$scope.currentSlide].audio[field].steps;
        else
          $scope.steps=$scope.Unit.sections[$scope.currentSlide].audio[field].steps_free;
      else
        $scope.steps=$scope.Unit.sections[$scope.currentSlide].audio[field].steps;

      $scope.currentStep=0;
      $scope.playing=false;
      if ($scope.stepTick)
      {
        timeout.cancel($scope.stepTick);
        $scope.stepTick=null;
      }

    }

    console.log("* Cambio de tab (ti-segmented-control:on-select) *",index);
    console.log(index);
    $scope.tabOption = index;
    $scope.$apply();
  }

  $scope.videoClick=function(section,index){
    //console.log(section);
    //console.log(section.resources[index]);
    var song=section.resources[index];
    var obj={}
    obj.artist=song.artist;
    obj.title=song.name;
    obj.lesson_section=section.name
    obj.video_id=song.video_id
    console.log(obj)
    var params = angular.toJson(obj);
    $state.go("app.song",{ params: params });
  }


  $scope.videoLessonClick=function(section,index){
    //console.log(section);
    //console.log(section.resources[index]);
    var video=section.resources[index];
    var obj={}
    obj.title=video.title;
    obj.lesson_section=section.name
    obj.video_id=video.video_id;
    console.log(obj)
    var params = angular.toJson(obj);
    $state.go("app.videolesson",{ params: params });
  }

  $scope.Klander=function(txt){    
    if ($scope.tabOption==1 && !$scope.lesson_loc_es) // En el tab lesson los examples no tienen que reproducirse (si no es 'es'), ya está el 'tap to play'
    {
      console.log("* Klander * tab: "+$scope.tabOption+" * lesson_loc_es: "+$scope.lesson_loc_es+" '"+txt+"' * cancelado *")
      return;
    }
    txt=txt.replace(/\*/g, "'");
    console.log("* Klander * tab: "+$scope.tabOption+" * lesson_loc_es: "+$scope.lesson_loc_es+" '"+txt+"'")
    backendService.Play(txt,$scope.userInfo);
  }

  $scope.short=function(txt){
    if (txt.length>16)
      return txt.substring(0,16)+"..."
    else
      return txt;
  }


})
