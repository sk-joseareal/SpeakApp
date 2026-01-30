angular.module('starter').controller('TestCtrl', function($scope, $rootScope, $state, $stateParams, varGlobal, backendService, CoursesService, AuthService, $ionicLoading, $ionicSlideBoxDelegate, $ionicModal, $ionicPopup, adsService, $ionicHistory, UnitsService, genService, $ionicSideMenuDelegate) {

$rootScope.srchOn=false;

$scope.hideAt=function(cual)
{
  return cual.replace(/@/gi,"");
}

 $scope.pepe_down=function(questionIndex,palabra){
   console.log("* pepe_down *");
   console.log(questionIndex);
   console.log(palabra);
   this.onDropComplete1(questionIndex,palabra,null);
   this.onDragSuccess2(questionIndex,palabra,null);
 }
 
 $scope.pepe_up=function(questionIndex,palabra){
   console.log("* pepe_up *");
   console.log(questionIndex);
   console.log(palabra);
   this.onDropComplete2(questionIndex,palabra,null);
   this.onDragSuccess1(questionIndex,palabra,null);
}


// Polyfill para Array.fill:
if ( ![].fill) {
  Array.prototype.fill = function( value ) {
    var O = Object( this );
    var len = parseInt( O.length, 10 );
    var start = arguments[1];
    var relativeStart = parseInt( start, 10 ) || 0;
    var k = relativeStart < 0
    ? Math.max( len + relativeStart, 0)
    : Math.min( relativeStart, len );
    var end = arguments[2];
    var relativeEnd = end === undefined
    ? len
    : ( parseInt( end) || 0) ;
    var final = relativeEnd < 0
    ? Math.max( len + relativeEnd, 0 )
    : Math.min( relativeEnd, len );
    for (; k < final; k++) {
      O[k] = value;
    }
    return O;
  };
}


$scope.centerAnchor = true;


$scope.sayPlay=function(parent,index)
{
  console.log("* sayPlay *");
  // 'play' en elemento de multiple option
  var txt=$scope.questions[parent].options[index].text
  if ($scope.questions[parent].placeholders>0)
  {
    if (txt=="True" || txt=="False" || txt.substr(0,1)=="-")
      txt=""    
    //$scope.userAnswersPh[parent]=[txt];
    $scope.userAnswersPh[parent]=txt.split(",");    
    $scope.sayAnswerPh(parent);
  }
  else
    if (txt!="True" && txt!="False" && txt.substr(0,1)!="-") backendService.Play(txt,$scope.userInfo);
}

$scope.sayHeader=function(){
  var txt=$scope.header;
  backendService.Play(txt,$scope.userInfo);
}

$scope.sayText=function(text){
  var txt=text;
  backendService.Play(txt,$scope.userInfo);
}


$scope.sayAnswer=function(idx){
  if ($scope.questions[idx].subtype==7)
  {
    $scope.sayAnswerPh(idx);
    return
  }

  console.log("* sayAnswer *");
  console.log(idx);
  console.log($scope.userAnswers);
  var txt=$scope.userAnswers[idx];
  backendService.Play(txt,$scope.userInfo);
}

$scope.sayAnswerPh=function(idx){
  console.log("* sayAnswerPh * ");
  console.log(idx);
  console.log($scope.questions[idx].phData);
  console.log($scope.userAnswersPh[idx]);
  console.log($scope.userAnswers[idx]);
  var ans=$scope.userAnswers[idx];
  
  console.log("----")  
  var txt="";
  for (var qi=1;qi<=Object.keys($scope.questions[idx].phData).length;qi++)
  { 
    var tr="";
    console.log("///")
    console.log(qi)  
    console.log($scope.questions[idx].phData[qi-1]);  
    console.log($scope.userAnswersPh[idx][qi-1]);
    console.log("///")

    var o=$scope.questions[idx].phData[qi-1];
    if (o["text"])
      tr=tr+o["text"].trim()+" ";

    if ($scope.userAnswersPh[idx][qi-1])
      tr=tr+$scope.userAnswersPh[idx][qi-1].trim()+" ";

    if (o["text2"])
      tr=tr+o["text2"].trim()+" ";
      txt=txt+" "+tr.trim();
    }
    txt=txt.replace(/ *\([^)]*\) */g, " ").trim(); // Eliminar lo que esté entre paréntesis (no se ha de pronunciar)
    console.log("----")  
    backendService.Play(txt,$scope.userInfo);
  }

  genService.logEvent('Test ' + $stateParams.testId);

  adsService.showInterstitial(AdMob);

  $scope.multiText = ($rootScope.loc=="es") ? '(Respuestas separadas con comas)' : "(Separate answers with commas)";

  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) 
  {
    $rootScope.viewTitle=$rootScope.i18n[$rootScope.loc]["gram_title"];
    genService.viewTrack(JSON.stringify({name:$ionicHistory.currentStateName(),params:$stateParams}));
    
    genService.contentTrack("test",$stateParams.testId);

    if ($rootScope.extra)
    { 
      $scope.fromLesson=true;
      console.log("*** ACCEDE DESDE UNA LECCIÓN ***");
    }
    else
    {
      $scope.fromLesson=false;
      console.log("*** NO ACCEDE DESDE UNA LECCIÓN ***");
    }
  });


  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) 
  {
    $ionicSideMenuDelegate.canDragContent(true);   
  });

  $scope.resultSaved=false;

  $scope.testId=$stateParams.testId;

  $scope.userAnswers=[];  
  $scope.userAnswersPh=[];
  $scope.userAnswersPhOk=[];
  $scope.correct=[];
  $scope.clicked=[];
  $scope.nok=0;
  $scope.percent=0;

  $scope.scores=varGlobal.scores;

  $scope.scoreTxt=function(){
    var n=$scope.scores.length;
    var ret="???";
    for (i=0;i<n;i++)
    {
      if ($scope.scores[i].minimum_mark <= $scope.percent && $scope.scores[i].maximum_mark>= $scope.percent )
      {
        if ($rootScope.loc=="en")
          ret=$scope.scores[i].quiz_recommendation_en;
        else
          ret=$scope.scores[i].quiz_recommendation;          
      }
    }
    return ret;
  }

  $scope.scoreText=$scope.scoreTxt();


  if ($rootScope.loc=="en")
  {
    btnCont="Next";
    btnCorr="Solve";
  }
  else
  {
    btnCont="Continuar";
    btnCorr="Corregir";
  }

  $scope.test="Cargando ..."


  $scope.ww=12;



  $ionicModal.fromTemplateUrl('views/testResult.html', {
    scope: $scope
  }).then(function(modal) {
    $scope.modal = modal;
  });

  // Triggered in the login modal to close it
  $scope.closeResult = function() {
    $scope.modal.hide();
  };

  // Open the login modal
  $scope.showResult = function() {
    $scope.modal.show();
  };


  $scope.palabras=[];
  $scope.dropped=[];

  $scope.shuffle=function(array) {
      var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
  }



  $scope.startDrag=function(data,event){
    $ionicSlideBoxDelegate.enableSlide(false);  
    $ionicSideMenuDelegate.canDragContent(false);
  }
  $scope.onDragSuccess1=function(idx,data,evt){
    console.log("* onDragSuccess1 *");    
    console.log(data);
    if (data)
    {
      var index = $scope.dropped[idx].indexOf(data);
      if (index > -1) 
        $scope.dropped[idx].splice(index, 1);
        var txt=$scope.dropped[idx].join(" ");
        $scope.userAnswers[idx]=txt;
        console.log(txt);
        console.log($scope.questions[idx].answer_text);
        if (txt==$scope.questions[idx].answer_text)
        {
          $scope.correct[idx]=1;
        } 
        else
        {
          $scope.correct[idx]=2;
        }
        $scope.updateOk(); 
    }
  }
  $scope.onDropComplete1=function(idx,data,evt){
    console.log("* onDropComplete1 *");    
    console.log(data);
    if (data)
    {
      var index = $scope.dropped[idx].indexOf(data);
      if (index == -1)
      {

        if ($scope.questions[idx].subtype==7) // Sustituir la palabra que haya 
        {
          if ($scope.dropped[idx].length==1)
            $scope.palabras[idx].push($scope.dropped[idx][0]);
          $scope.dropped[idx]=[]
          $scope.userAnswersPh[idx]=[]
          $scope.userAnswersPh[idx].push(data);
        }
        $scope.dropped[idx].push(data);

        var txt=$scope.dropped[idx].join(" ");
        console.log(txt);
        var txtcmp=txt.toLowerCase().trim().replace(/´/gi,"'").replace(/@/gi,"");
        console.log(txtcmp);
        var corr=$scope.questions[idx].answer_text.split("|");
//        console.log(corr);
        var escorrecto=false;
        for (var ind=0;ind<corr.length;ind++)
        {
          var crr=corr[ind].trim().toLowerCase().trim().replace(/´/gi,"'");
          console.log(crr);
          if (txtcmp==crr)
            escorrecto=true
        }

        $scope.userAnswers[idx]=txt;
        if (escorrecto) // (txt==$scope.questions[idx].answer_text)
        {
          $scope.correct[idx]=1;
        } 
        else
        {
          $scope.correct[idx]=2;
        }
        $scope.updateOk(); 

        if ($scope.questions[idx].subtype==7)
        {
          if (escorrecto)
            $scope.userAnswersPhOk[idx][0]=1;
          else
            $scope.userAnswersPhOk[idx][0]=2;
        }

        // 'play'
        if (data!="." && data!="?" && data!="," && data!="!") // El string que se acaba de añadir no es pronunciable -> No pronunciar el conjunto. 
        {      
          if ($scope.questions[idx].subtype==7)
          {
            console.log("* subtype 7: no pronuncia *")
            //$scope.sayAnswerPh(idx);
          }
          else
          {
            if ($scope.questions[idx].subtype==4 || $scope.questions[idx].subtype==5)
            {
              console.log("* subtype 5 ó 5: no pronuncia *")
            }
            else
            {
              var saytxt=$scope.hideAt(txt);
              backendService.Play(saytxt,$scope.userInfo);
            }

          }
        }  

      }
    }
    $ionicSlideBoxDelegate.enableSlide(true);          
    $ionicSideMenuDelegate.canDragContent(true);
  }

  $scope.onDragSuccess2=function(idx,data,evt){
    console.log("* onDragSuccess2 *");
    console.log(idx);
    console.log(data);
    if (data)
    {
    var index = $scope.palabras[idx].indexOf(data);
    if (index > -1) 
    {
        console.log("*remove*");
        console.log(index);
        $scope.palabras[idx].splice(index, 1);
        console.log($scope.palabras[idx]);
    
    } else
      console.log("* not remove *")
    }
  }  
  $scope.onDropComplete2=function(idx,data,evt){
    console.log("* onDropComplete2 *");
    console.log(data);
    console.log(evt);    
    if (data)
    {
      var index = $scope.palabras[idx].indexOf(data);
      if (index == -1) 
      {
        $scope.palabras[idx].push(data);
      }
    }
    $ionicSlideBoxDelegate.enableSlide(true);
    $ionicSideMenuDelegate.canDragContent(true);      
  }  
  ////////////////////////////////

  $scope.TestQuestions =[];
  $scope.correct=[];
  $scope.clicked=[];
  $scope.correctShow=[];
  console.log("* antes de getTest *");
  $ionicLoading.show();
  $rootScope.forceCache=true; // Al quitar el 'boton' que habia en el item de 'Grammar' para poner / quitar de offline, ha de forzar si no está (que es lo que hacia cuando no estaba offline)      
  backendService.doGetCached("test"+$scope.testId,'/v3/practice_tests/'+$scope.testId+'/practice_questions.json',$scope.userInfo,function(result) {
    console.log("* dentro de getTest *");
    $ionicLoading.hide();
    console.log('* getTest returned value *');
    console.log(result);
    //console.log(result.courses);
    // result.error contiene el mensaje de error si lo hay
    $scope.test="";
console.log("::::::::::::::::::::::::::::::::::")    
console.log(result);    
    $scope.testName=result.data.header.name;  
    $scope.testName_es=result.data.header.name_es;  
    if ($rootScope.loc=="es")
      $scope.header=result.data.header.content;
    else
      $scope.header=result.data.header.content_en;

var hdr=$scope.header;
$scope.header_orig=$scope.header
$scope.header_palabras=[];
$scope.header2=$scope.header;
var nn=hdr.indexOf(":");
if (nn!=-1)
{
  $scope.header2=hdr.substr(0,nn);
  $scope.header_palabras=hdr.substr(nn+1,1000).split("/");
  for (var i = 0; i < $scope.header_palabras.length; i++) {
     $scope.header_palabras[i] = $scope.header_palabras[i].trim();
 }
}

    $scope.questions=result.data.questions;
    $scope.courseId=result.data.course_id;
    $scope.lessonId=result.data.lesson_id;
    $scope.lessonSectionId=result.data.lesson_section_id;

    var n=$scope.questions.length;
    for (i=0;i<n;i++)
    {
//var asset=null;
//if ($scope.questions[i].image_file_name)
//   asset="image"+("00000"+$scope.questions[i].image_file_name).substr(-5,5)+".png"
//$scope.questions[i].image_file_name=asset;

      // Yesterday was a long day.  I _____ (work) all afternoon, _____ (go) to class in the evening and then _____ (have) dinner with my parents.
      var texto=$scope.questions[i].text
      texto=texto.replace(/\_____/g, '_');
      texto=texto.replace(/\____/g, '_');
      texto=texto.replace(/\___/g, '_');
      texto=texto.replace(/\__/g, '_');
      // Yesterday was a long day.  I _ (work) all afternoon, _ (go) to class in the evening and then _ (have) dinner with my parents.

      var nph2=0;
      var phData={}
      var sigue=true;      
      while (sigue)
      {
        nph2=nph2+1
        var donde=texto.indexOf("_");
        if (donde==-1)
        {
          if (nph2!=1) // Si es 1, No hay ningun placeholder
          {
            phData[nph2-2]["text2"]=texto;
          }
          sigue=false;
        }
        else
        {
          if (donde==0)
          {
            var ttt=null;
          }
          else
          {
            var ttt=texto.substr(0,donde);
          }
          texto=texto.substr(donde+1,1000);
          phData[nph2-1]={text:ttt};
        }
      }

      //var nph=$scope.questions[i].text.split("____").length - 1;
      var nph=nph2-1;

      $scope.questions[i].placeholders=nph;

      //$scope.questions[i].phData={}
      //$scope.questions[i].phData[0]={text:"Yesterday was a long day. I"};
      //$scope.questions[i].phData[1]={text:"(work) all afternoon,"};
      //$scope.questions[i].phData[2]={text:"(go) to class in the evening and then",text2:"(have) dinner with my parents."
      $scope.questions[i].phData=phData;

var t=$scope.questions[i].question_type;
var st=$scope.questions[i].subtype;
if (t==1 && [4,5,7].indexOf(st)==-1)
  st=0;

if (t==1) // tipo 1
{
  if (st==0)
  {
    if (nph==0) // Sin placeholders
      $scope.questions[i].typeText="LP"; // Tipo examplel con audio
    else
      $scope.questions[i].typeText="N"; // Nada
  }
  else
    if (st==4)
    {
      $scope.questions[i].typeText="L"; // Tipo examplel sin audio
    }
    else
      if (st==5)
      {
        $scope.questions[i].typeText="LP"; // Tipo examplel con audio
      }
      else // 7
        $scope.questions[i].typeText="N"; // Nada

} 
else  // tipo 2
{
  if (nph==0) // Sin placeholders
  {
    $scope.questions[i].typeText="LP"; // Tipo examplel con audio
  }
  else  
  {
    $scope.questions[i].typeText="L"; // Tipo examplel sin audio
  }
} 

if ($scope.questions[i].image_file_name)
  // Si hay imagen y es LP pasa a CP (sin imágen en el enunciado)
  if ($scope.questions[i].typeText=="LP")
    $scope.questions[i].typeText="CP"; 
else
  // Si hay imagen y es L pasa a C (sin imágen en el enunciado)
  if ($scope.questions[i].typeText=="L")
    $scope.questions[i].typeText="C"; 

      $scope.userAnswersPh[i]=Array(nph).fill("");
      $scope.userAnswersPhOk[i]=Array(nph).fill(0);
      $scope.palabras[i]=[]
      var m=$scope.questions[i].options.length;
      for (j=0;j<m;j++)
      {
        $scope.questions[i].options[j]["selected"]=false;
        if (j==1)
          $scope.questions[i].options[j]["selected"]=true;
        var p=$scope.questions[i].options[j]["text"];      
        $scope.palabras[i].push(p);
      }

      if ($scope.questions[i].question_type==1) // Free text
      {
        if ($scope.questions[i].subtype==7) // Con lista de opciones en el enunciado, se convierte en drag and drop
        {
          $scope.header=$scope.header2;
          $scope.palabras[i]=$scope.header_palabras.slice();
        }
        else
        {

if ($scope.questions[i].subtype==4 || $scope.questions[i].subtype==5)
   // Sólo deja la primera opción si hay varias correctas (es 'drag & drop').
   $scope.questions[i].answer_text=$scope.questions[i].answer_text.split("|")[0];
   // Le separa los puntos, los interrogantes, las comas y los signos de admiración.
   $scope.questions[i].answer_text=$scope.questions[i].answer_text.replace(/\./g, ' .').replace(/\?/g, ' ?').replace(/\,/g, ' ,').replace(/\!/g, ' !');

          var at1=$scope.questions[i].answer_text.split("|")[0];
          at1=at1.split(",");
          var mm=Object.keys($scope.questions[i].phData).length;
          for (var yy=0;yy<mm;yy++)
          {
            if (at1[yy])
              var ll=at1[yy].length;
            else
              var ll=10;
            if (ll>20)
              ll=20;
            $scope.questions[i].phData[yy]["long"]=ll;
          }          

          var at=$scope.questions[i].answer_text.replace(/\|/g, ' '); // Eliminar puntos y sustituir 'pipes' por espacios.



//          $scope.palabras[i] = at.split(" ").reduce(function(a,b){if(a.indexOf(b)<0)a.push(b);return a;},[]).filter(Boolean); // Separa por espacios y retira duplicados y strings vacios.        
// Deja palabras duplicadas por que solo toma la primera respuesta correcta si hay varias, pero no se pueden repetir elementos en un 'repeater', de modo que hay que añadir algo a los repetidos.
$scope.palabras[i] = at.split(" ").reduce(
function(a,b){
  if(a.indexOf(b)<0)
    a.push(b);
  else 
    a.push(b+"@");
  return a;
},[]).filter(Boolean); // Separa por espacios y retira duplicados y strings vacios.        
//@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
          
        }
      }

      $scope.shuffle($scope.palabras[i]);
      
      $scope.dropped[i]= [];

      $scope.correct[i]=0;
      $scope.clicked[i]=0;

    }
    $scope.correctShow=$scope.correct.slice(0);
    console.log("* $scope.questions *");
    console.log($scope.questions);

  });
  console.log("* después de getTest *");


  $scope.currentSlide=0;
  
  $scope.pagerClick=function(index){
    $scope.openItem=-1;
    $ionicSlideBoxDelegate.slide(index);
  };

  $scope.slideHasChanged=function(cual){
    //console.log("slideHasChanged");
    //console.log(cual);
    //$scope.openItem=-1;
    $scope.currentSlide=cual;
  };  



  $scope.cambia=function(index){
    console.log("* cambia *");
    console.log("Index: "+index);
    console.log("Placeholders: "+$scope.questions[index].placeholders);

    if ($scope.questions[index].placeholders>0)
    {
      console.log("----- ph ---->");
      console.log($scope.userAnswersPh[index]);
      var resUsr=_limpiApostrofes($scope.userAnswersPh[index].join(", ").replace(/\./g,'').toLowerCase().trim().replace(/´/gi,"'")); // Quito puntos y paso a minúsculas;
      console.log(resUsr);

console.log("-----")
var resOk=$scope.questions[index].answer_text.replace(/\./g,'').toLowerCase().trim().replace(/´/gi,"'"); // Quito puntos y paso a minúsculas
resOk=resOk.split("|"); // Por si hay múltiples opciones
console.log(resOk);
for (var ix=0;ix<$scope.userAnswersPh[index].length;ix++)
{
  var ua=_limpiApostrofes($scope.userAnswersPh[index][ix].toLowerCase().trim().replace(/´/gi,"'"));   // Minúsculas / Quitar espacios / Sustituir apóstrofes inclinados por rectos.
  var wok=false;
  for (iy=0;iy<resOk.length;iy++)
  {
//    console.log(" ua ->")
//    console.log("  ua:{"+ua+"}");
    if (!ua || ua=="")
      wok=0;
    else
    {
      var elok=resOk[iy].split(",");   
      console.log("elok[]:",elok);
      console.log("ix:",ix);
      console.log("elok[ix]:",elok[ix]);       
      elok=elok[ix].toLowerCase().trim().replace(/´/gi,"'"); // Minúsculas / Quitar espacios / Substituir apóstrofes inclinados por rectos.
      elok=elok.replace(/’/gi,"'"); // Minúsculas / Quitar espacios / Substituir apóstrofes inclinados por rectos.

      console.log("  elok:{"+elok+"}");
      console.log(" <- elok");

      console.log("-- ua:{"+ua+"} elok:{"+elok+"} ==:{"+(ua==elok)+"} --");
      
      if (ua==elok) 
        wok=true;
    }
  }
  if (wok)
    wok=1;
  else
    wok=2;
  $scope.userAnswersPhOk[index][ix]=wok;
}
console.log("-----")



      console.log("<----- ph -----");
    }
    else
    {
      console.log("----- sin ph ----->")
      console.log($scope.userAnswers[index]);
      var resUsr=_limpiApostrofes($scope.userAnswers[index].replace(/\./g,'').toLowerCase().trim().replace(/´/gi,"'")); // Quito puntos y paso a minúsculas
      // Si en el resultado que ha introducido el usuario hay comas (varios placeholders), las comas han de convertirse a ', '      
      var tr = resUsr.split(',');
      if (tr.length>1)
      {
        var pp=tr[0].trim();
        for (vv_i=1;vv_i<tr.length;vv_i++)
        {
          console.log(">"+tr[vv_i]);
          pp=pp+", "+tr[vv_i].trim()
        }
        console.log(">"+pp+"<");
        resUsr=pp;
      }
      console.log(resUsr);
      console.log("<----- sin ph -----")
    }

    var resOk=$scope.questions[index].answer_text.replace(/\./g,'').toLowerCase().trim().replace(/´/gi,"'"); // Quito puntos y paso a minúsculas
//console.log("resOK original ..:",resOk);    
    resOk=resOk.split("|"); // Por si hay múltiples opciones 
//console.log("resOK tras split :",resOk);
    console.log("-----");

    var ok=false;
    var n=resOk.length;
    for (i=0;i<n;i++)
    {
      console.log("<<<<")
//console.log("resOk[i] antes de RegExp .:",resOk[i]);
resOk[i]=resOk[i].replace(new RegExp(' ,','g'),",");  
//console.log("resOk[i] después de RegExp:",resOk[i]);

      console.log(" ["+resOk[i]+"]");
      console.log(" ["+resUsr+"]");
      if (resOk[i].trim()==resUsr.trim())
      {
        ok=true;
        console.log("OK")
      }
      else
      {
        console.log("NO OK")
      }
      console.log(">>>>")
    }    

    if (ok)
    {
      $scope.correct[index]=1;
      console.log("OK");
    } 
    else
    {
      $scope.correct[index]=2;
      console.log("NO OK");
    }

    console.log("-----");    

    $scope.updateOk(); 

  }

  $scope.cambia2=function(parent,index){

    console.log("* cambia2 *");
console.log(parent);
console.log(index);
    //console.log($scope.userAnswers);
    console.log($scope.questions[parent].options[index].correct)
console.log($scope.questions[parent].options[index].text);

/*
    // 'play' al seleccionar elemento de multiple option
    var txt=$scope.questions[parent].options[index].text
    if ($scope.questions[parent].placeholders>0)
    {
      if (txt=="True" || txt=="False" || txt.substr(0,1)=="-")
        txt=""
      $scope.userAnswersPh[parent]=[txt];
      $scope.sayAnswerPh(parent);
    }
    else
      if (txt!="True" && txt!="False" && txt.substr(0,1)!="-")
        backendService.Play(txt,$scope.userInfo);
*/


    if ($scope.questions[parent].options[index].correct)
    {
      var vl=1;
    } 
    else
    {
      var vl=2;
    }

   
  if(!$scope.$$phase) {
    $scope.$apply(function() {
      $scope.correct[parent]=vl;
      $scope.updateOk();
    });   
  }
  else
  {
    $scope.correct[parent]=vl;
    $scope.updateOk();

  }


      
  }


  $scope.updateOk=function()
  {
    var nok=0;
    var n=$scope.correct.length;
    for (i=0;i<n;i++)
    {
      if ($scope.correct[i]==1)
        nok=nok+1;
    }
    var per=nok*100/$scope.questions.length;
    console.log(nok);
    console.log(per);
    $scope.nok=nok;
    $scope.percent=Math.round(per);
    $scope.scoreText=$scope.scoreTxt();
  }


  $scope.toggle=function(idx)
  {
    if ($scope.correct[idx]==0)
      return;

    $scope.clicked[idx]=1;
    $scope.editDisabled=!$scope.editDisabled;
    if ($scope.editDisabled)
    {
      $scope.toggleName=btnCont;
      $ionicSlideBoxDelegate.enableSlide(false);
$ionicSideMenuDelegate.canDragContent(false);      
    }
    else
    {
      $scope.toggleName=btnCorr;
      $ionicSlideBoxDelegate.enableSlide(true);
$ionicSideMenuDelegate.canDragContent(true);      
    }

  if ($scope.toggleName==btnCorr) // Si el botón pone 'Corregir' es que ponia 'Continuar' cuando lo ha pulsado.
  {
    //pasar a la siguiente si hay, a la pantalla de resultado si no.
    //if ((idx+1)<$scope.questions.length)
    //{
      $scope.currentSlide=$scope.currentSlide+1;
      $ionicSlideBoxDelegate.slide($scope.currentSlide);
    //}
    //else
    //  $scope.showResult();
  }
  else // Ponia 'Corregir' cuando lo ha pulsado
  {
    $scope.correctShow=$scope.correct.slice(0);
  }

//    console.log($scope.dropped);
    console.log($scope.correct);
  }

  $scope.editDisabled=false;
  $scope.toggleName=btnCorr;


  $scope.sendResult=function(){
    console.log("* sendResult *");

    console.log($scope.userInfo.id);
    console.log($scope.testId);
    console.log($scope.percent);

    var test_id=$scope.testId;
    var lesson_id=$scope.lessonId;
    var course_id=$scope.courseId;

    var Units=UnitsService.getUnits(course_id);
    console.log(Units);
    if (Units)
    {
      var m=Units.length;
      for(j=0;j<m;j++) 
      {
        var n=Units[j].tests.length
        for(k=0;k<n;k++) 
        {
          if (Units[j].tests[k].id==test_id)
          {
            console.log(Units[j].tests[k].name);
            var cmp=Units[j].tests[k].complete;
            if ($scope.percent>80 && Units[j].tests[k].complete!=1)
              {
                Units[j].tests[k].complete=1;
                UnitsService.setUnits(Units);
              } 
            else
              if (!Units[j].tests[k].complete)
              {                
                Units[j].tests[k].complete=2;
                UnitsService.setUnits(Units);
              }
          }
        }
      }
    }


    console.log("* antes de recorProgress *");
    $ionicLoading.show();

//console.log("");
//console.log("* MARK 1 *");
//console.log("");

    // Se toman los updates que haya pendientes de la entrada de localStorage _updatesXXXX (XXX -> user_id)
    if (varGlobal.cacheOn)
    {

//console.log("");
//console.log("* MARK 2 *");
//console.log("");

      var pendProgress=window.localStorage.getItem("_pendProgress"+$scope.userInfo.id);
      if (!pendProgress)
      {

//console.log("");
//console.log("* MARK 3 *");
//console.log("");

        pendProgress={ tests : [], results: [] };
        postData={ tests : [], results: [] };        
      }
      else
      {  

//console.log("");
//console.log("* MARK 4 *");
//console.log("");

        pendProgress=JSON.parse(pendProgress);
        postData=pendProgress;        
        if (!pendProgress.tests)
        {

//console.log("");
//console.log("* MARK 5 *");
//console.log("");

          pendProgress.tests=[];
          pendProgress.results=[];
          postData.tests=[];
          postData.results=[];          
        }

      }
    }
    else
    {

//console.log("");
//console.log("* MARK 6 *");
//console.log("");

      pendProgress={ tests : [], results: [] };
      postData={ tests : [], results: [] };        
    }

//console.log("");
//console.log("* MARK 7 *");    
//console.log("");

    // Se añade el test_id / result a la tabla de tests pendientes
    pendProgress.tests.push(test_id);
    pendProgress.results.push($scope.percent);
    postData.tests.push(test_id);
    postData.results.push($scope.percent);
    // Y se envia al backend
    console.log(pendProgress);

    backendService.doPost('/v4/recordProgress',$scope.userInfo,postData,function(result) {
      $ionicLoading.hide();
      console.log('* recorProgress returned value *');
      console.log(result);

      //console.log(test_id);
      //console.log($scope.userInfo.test_progress);
      //console.log($scope.userInfo.test_progress[test_id]);

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

        // Update local progress
        if ($scope.percent>80)
        {
          $scope.userInfo.test_progress[test_id]=1;
          if (lesson_id in $scope.userInfo.lesson_progress)
            $scope.userInfo.lesson_progress[lesson_id][1]++
          else
            $scope.userInfo.lesson_progress[lesson_id]=[0,1]
          if (course_id in $scope.userInfo.course_progress)
            $scope.userInfo.course_progress[course_id][1]++
          else
            $scope.userInfo.course_progress[course_id]=[0,1]
        }
        else
          if (!$scope.userInfo.test_progress[test_id]) 
            $scope.userInfo.test_progress[test_id]=2;

        //console.log($scope.userInfo.test_progress[test_id]);

        if ($scope.userInfo.current_course==course_id) // Es del curso actual, actualizar current_course_progress en userInfo (el porcentaje que aparece en el avatar).
        {        
          $scope.Courses = CoursesService.getCourses(); 
          console.log($scope.Courses);
          var cp=$scope.userInfo.course_progress;
          var sectioncount=$scope.Courses[course_id].sectioncount;
          var testcount=$scope.Courses[course_id].testcount;
          var progress=Math.round(100*(cp[course_id][0]+cp[course_id][1])/(sectioncount+testcount));
          $scope.userInfo.current_course_progress=progress;
        }
        AuthService.setUserProgress($scope.userInfo.course_progress,$scope.userInfo.lesson_progress,$scope.userInfo.test_progress);      

$rootScope.errorValue=false;

        //
        var txt1=($rootScope.loc=="en") ? "We have successfully recorded your qualification in your profile !" : "¡ Hemos registrado tu calificación con éxito en tu expediente !";
        var txt2=($rootScope.loc=="en") ? "Done !" : "¡ Hecho !";

        //var myPopup = $ionicPopup.show({ template: '', title: txt2, subTitle: txt1, scope: $scope, buttons: [ { text: 'Ok' } ] });
        $scope.resultSaved=true;
      }



    });
    console.log("* después de recorProgress *");


  }

  $scope.checkOption=function(q,i){
    //console.log("* checkOption *");
    //console.log(q);
    //console.log(i);
    //console.log("* item *");
    //console.log($scope.questions[q].options[i].text);
    //console.log("* item correcto?")
    //console.log($scope.questions[q].options[i].correct)
    //console.log("* item seleccionado ?")
    //console.log($scope.userAnswers[q])
    var ret=0;
    if ( $scope.correctShow[q]!=0       ) //$scope.editDisabled) // Modo corregir
    {
      if ($scope.questions[q].options[i].correct) //Los items correctos se marcan siempre en verde
        ret=1;
      else //$scope.userAnswers[q] && 
        if ($scope.userAnswers[q]==i) // Si el seleccionado es malo, rojo
          ret=2;
    }
    //console.log(ret);
    return ret;
  }



  $scope.ballClick=function(index)
  {
    if (!$scope.editDisabled)
    {
      $scope.openItem=index;
      $ionicSlideBoxDelegate.slide(index);
    }
  }


  $scope.goLesson=function(){
    console.log($scope.courseId);
    console.log($scope.lessonId);
    console.log($scope.lessonSectionId);
    $state.go("app.section_fullURL",{ "courseId": $scope.courseId , "unitId" : $scope.lessonId, "lessonId" : $scope.lessonSectionId });
  }

  $scope.goUnit=function(){
    console.log($scope.courseId);
    $ionicHistory.nextViewOptions({
      disableBack: true
    });    
    $state.go("app.single",{ "courseId": $scope.courseId });
  }


  $scope.doRestart=function(){
    $scope.openItem=0;
    $ionicSlideBoxDelegate.slide(0);    

    var nel=$scope.correct.length;
    $scope.correct=Array(nel).fill(0);
    $scope.correctShow=Array(nel).fill(0);
    $scope.clicked=Array(nel).fill(0);
    $scope.userAnswers=[];
    $scope.resultSaved=false;

    for (var ix=0;ix<$scope.userAnswersPh.length;ix++)
    {
      for (var iy=0;iy<$scope.userAnswersPh[ix].length;iy++)
      {
        var v1=$scope.userAnswersPh[ix][iy];
        if (typeof v1 === 'string' || v1 instanceof String)
          $scope.userAnswersPh[ix][iy]="";
        var v2=$scope.userAnswersPhOk[ix][iy];
        if (typeof v2 === 'number' || v2 instanceof Number)
          $scope.userAnswersPhOk[ix][iy]=0;        
      }
    }

for (var ii=0;ii<$scope.questions.length;ii++)
{


          if ($scope.questions[ii].subtype==7) // Con lista de opciones en el enunciado, se convierte en drag and drop
          {
            $scope.palabras[ii]=$scope.header_palabras.slice();
            $scope.dropped[ii]=[];
          }
          else
          {



//@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

$scope.palabras[ii] = $scope.questions[ii].answer_text.split(" ").reduce(
function(a,b){
  if(a.indexOf(b)<0)
    a.push(b);
  else 
    a.push(b+"@");
  return a;
},[]).filter(Boolean);      
//@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
$scope.shuffle($scope.palabras[ii]);
$scope.dropped[ii]=[];
}


          }


    //$scope.editDisabled=false;
  }



})



