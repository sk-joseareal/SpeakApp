angular.module('starter').controller('conjugateverbCtrl', function($scope,$rootScope,$state,$stateParams,backendService,$ionicLoading, adsService, $ionicHistory, genService, $timeout) {

$rootScope.viewTitle="conj_title"

$scope.conj = function(cnj1,cnj2,cnj3,tiempo,persona)
{

  switch (tiempo)
  {
    case 0: // Present simple
      switch(persona)
      {
      case 0:
        ret = [ "I "+cnj1+".", "Do I "+cnj1+"?", "I do not "+cnj1+"." ];
        break;
      case 1:
        ret = [ "You "+cnj1+".", "Do you "+cnj1+"?", "You do not "+cnj1+"." ];
        break;
      case 2:
        ret = [ "He/She/It "+cnj2+".", "Does he/she/it "+cnj1+"?", "He/She/It does not "+cnj1+"." ];
        break;
      case 3:
        ret = [ "We "+cnj1+".", "Do we "+cnj1+"?", "We do not "+cnj1+"." ];
        break;
      case 4:
        ret = [ "You "+cnj1+".", "Do you "+cnj1+"?", "You do not "+cnj1+"." ];
        break;
      case 5:
        ret = [ "They "+cnj1+".", "Do they "+cnj1+"?", "They do not "+cnj1+"." ];
        break;      
      }
      break;
    case 1: // Present continuous
      switch(persona)
      {
      case 0:
        ret = [ "I am "+cnj1+".", "Am I "+cnj1+"?", "I am not "+cnj1+"." ];
        break;
      case 1:
        ret = [ "You are "+cnj1+".", "Are you "+cnj1+"?", "You are not "+cnj1+"." ];
        break;
      case 2:
        ret = [ "He/She/It is "+cnj1+".", "Is he/she/it "+cnj1+"?", "He/She/It is not "+cnj1+"." ];
        break;
      case 3:
        ret = [ "We are "+cnj1+".", "Are we "+cnj1+"?", "We are not "+cnj1+"." ];
        break;
      case 4:
        ret = [ "You are "+cnj1+".", "Are you "+cnj1+"?", "You are not "+cnj1+"." ];
        break;
      case 5:
        ret = [ "They are "+cnj1+".", "Are they "+cnj1+"?", "They are not "+cnj1+"." ];
        break;      
      }
      break;
    case 2: // Present perfect
      switch(persona)
      {
      case 0:
        ret = [ "I have "+cnj1+".", "Have I "+cnj1+"?", "I have not "+cnj1+"." ];
        break;
      case 1:
        ret = [ "You have "+cnj1+".", "Have you "+cnj1+"?", "You have not "+cnj1+"." ];
        break;
      case 2:
        ret = [ "He/She/It has "+cnj1+".", "Has he/she/it "+cnj1+"?", "He/She/It has not "+cnj1+"." ];
        break;
      case 3:
        ret = [ "We have "+cnj1+".", "Have we "+cnj1+"?", "We have not "+cnj1+"." ];
        break;
      case 4:
        ret = [ "You have "+cnj1+".", "Have you "+cnj1+"?", "You have not "+cnj1+"." ];
        break;
      case 5:
        ret = [ "They have "+cnj1+".", "Have they "+cnj1+"?", "They have not "+cnj1+"." ];
        break;      
      }
      break;
    case 3: 
      switch(persona)
      {
      case 0:
        ret = [ "I have been "+cnj1+".", "Have I been "+cnj1+"?", "I have not been "+cnj1+"." ];
        break;
      case 1:
        ret = [ "You have been "+cnj1+".", "Have you been "+cnj1+"?", "You have not been "+cnj1+"." ];
        break;
      case 2:
        ret = [ "He/She/It has been "+cnj1+".", "Has he/she/it been "+cnj1+"?", "He/She/It has not been "+cnj1+"." ];
        break;
      case 3:
        ret = [ "We have been "+cnj1+".", "Have we been "+cnj1+"?", "We have not been "+cnj1+"." ];
        break;
      case 4:
        ret = [ "You have been "+cnj1+".", "Have you been "+cnj1+"?", "You have not been "+cnj1+"." ];
        break;
      case 5:
        ret = [ "They have been "+cnj1+".", "Have they been "+cnj1+"?", "They have not been "+cnj1+"." ];
        break;      
      }
      break;




    case 4: 
      switch(persona)
      {
      case 0:
        ret = [ "I "+cnj1+".", "Did I "+cnj3+"?", "I did not "+cnj3+"." ];
        break;
      case 1:
        ret = [ "You "+cnj1+".", "Did you "+cnj3+"?", "You did not "+cnj3+"." ];
        break;
      case 2:
        ret = [ "He/She/It "+cnj1+".", "Did he/she/it "+cnj3+"?", "He/She/It did not "+cnj3+"." ];
        break;
      case 3:
        ret = [ "We "+cnj1+".", "Did we "+cnj3+"?", "We did not "+cnj3+"." ];
        break;
      case 4:
        ret = [ "You "+cnj1+".", "Did you "+cnj3+"?", "You did not "+cnj3+"." ];
        break;
      case 5:
        ret = [ "They "+cnj1+".", "Did they "+cnj3+"?", "They did not "+cnj3+"." ];
        break;      
      }
      break;
    case 5: 
      switch(persona)
      {
      case 0:
        ret = [ "I was "+cnj1+".", "Was I "+cnj3+"?", "I was not "+cnj3+"." ];
        break;
      case 1:
        ret = [ "You were "+cnj1+".", "Were you "+cnj3+"?", "You were not "+cnj3+"." ];
        break;
      case 2:
        ret = [ "He/She/It was "+cnj1+".", "Was he/she/it "+cnj3+"?", "He/She/It was not "+cnj3+"." ];
        break;
      case 3:
        ret = [ "We were "+cnj1+".", "Were we "+cnj3+"?", "We were not "+cnj3+"." ];
        break;
      case 4:
        ret = [ "You were "+cnj1+".", "Were you "+cnj3+"?", "You were not "+cnj3+"." ];
        break;
      case 5:
        ret = [ "They were "+cnj1+".", "Were they "+cnj3+"?", "They were not "+cnj3+"." ];
        break;      
      }
      break;    
    case 6: 
      switch(persona)
      {
      case 0:
        ret = [ "I had "+cnj1+".", "Had I "+cnj3+"?", "I had not "+cnj3+"." ];
        break;
      case 1:
        ret = [ "You had "+cnj1+".", "Had you "+cnj3+"?", "You had not "+cnj3+"." ];
        break;
      case 2:
        ret = [ "He/She/It had "+cnj1+".", "Had he/she/it "+cnj3+"?", "He/She/It had not "+cnj3+"." ];
        break;
      case 3:
        ret = [ "We had "+cnj1+".", "Had we "+cnj3+"?", "We had not "+cnj3+"." ];
        break;
      case 4:
        ret = [ "You had "+cnj1+".", "Had you "+cnj3+"?", "You had not "+cnj3+"." ];
        break;
      case 5:
        ret = [ "They had "+cnj1+".", "Had they "+cnj3+"?", "They had not "+cnj3+"." ];
        break;      
      }
      break;
    case 7: 
      switch(persona)
      {
      case 0:
        ret = [ "I had been "+cnj1+".", "Had I been "+cnj3+"?", "I had not been "+cnj3+"." ];
        break;
      case 1:
        ret = [ "You had been "+cnj1+".", "Had you been "+cnj3+"?", "You had not been "+cnj3+"." ];
        break;
      case 2:
        ret = [ "He/She/It had been "+cnj1+".", "Had he/she/it been "+cnj3+"?", "He/She/It had not been "+cnj3+"." ];
        break;
      case 3:
        ret = [ "We had been "+cnj1+".", "Had we been "+cnj3+"?", "We had not been "+cnj3+"." ];
        break;
      case 4:
        ret = [ "You had been "+cnj1+".", "Had you been "+cnj3+"?", "You had not been "+cnj3+"." ];
        break;
      case 5:
        ret = [ "They had been "+cnj1+".", "Had they been "+cnj3+"?", "They had not been "+cnj3+"." ];
        break;      
      }
      break;   
    case 8: 
      switch(persona)
      {
      case 0:
        ret = [ "I will "+cnj1+".", "Will I "+cnj3+"?", "I will not "+cnj3+"." ];
        break;
      case 1:
        ret = [ "You will "+cnj1+".", "Will you "+cnj3+"?", "You will not "+cnj3+"." ];
        break;
      case 2:
        ret = [ "He/She/It will "+cnj1+".", "Will he/she/it "+cnj3+"?", "He/She/It will not "+cnj3+"." ];
        break;
      case 3:
        ret = [ "We will "+cnj1+".", "Will we "+cnj3+"?", "We will not "+cnj3+"." ];
        break;
      case 4:
        ret = [ "You will "+cnj1+".", "Will you "+cnj3+"?", "You will not "+cnj3+"." ];
        break;
      case 5:
        ret = [ "They will "+cnj1+".", "Will they "+cnj3+"?", "They will not "+cnj3+"." ];
        break;      
      }
      break;    
    case 9: 
      switch(persona)
      {
      case 0:
        ret = [ "I will have "+cnj1+".", "Will I have "+cnj3+"?", "I will not have "+cnj3+"." ];
        break;
      case 1:
        ret = [ "You will have "+cnj1+".", "Will you have "+cnj3+"?", "You will not have "+cnj3+"." ];
        break;
      case 2:
        ret = [ "He/She/It will have "+cnj1+".", "Will he/she/it have "+cnj3+"?", "He/She/It will not have "+cnj3+"." ];
        break;
      case 3:
        ret = [ "We will have "+cnj1+".", "Will we have "+cnj3+"?", "We will not have "+cnj3+"." ];
        break;
      case 4:
        ret = [ "You will have "+cnj1+".", "Will you have "+cnj3+"?", "You will not have "+cnj3+"." ];
        break;
      case 5:
        ret = [ "They will have "+cnj1+".", "Will they have "+cnj3+"?", "They will not have "+cnj3+"." ];
        break;      
      }
      break;
    case 10:
      switch(persona)
      {
      case 0:
        ret = [ "I would "+cnj1+".", "Would I "+cnj3+"?", "I would not "+cnj3+"." ];
        break;
      case 1:
        ret = [ "You would "+cnj1+".", "Would you "+cnj3+"?", "You would not "+cnj3+"." ];
        break;
      case 2:
        ret = [ "He/She/It would "+cnj1+".", "Would he/she/it "+cnj3+"?", "He/She/It would not "+cnj3+"." ];
        break;
      case 3:
        ret = [ "We would "+cnj1+".", "Would we "+cnj3+"?", "We would not "+cnj3+"." ];
        break;
      case 4:
        ret = [ "You would "+cnj1+".", "Would you "+cnj3+"?", "You would not "+cnj3+"." ];
        break;
      case 5:
        ret = [ "They would "+cnj1+".", "Would they "+cnj3+"?", "They would not "+cnj3+"." ];
        break;      
      }
      break;
    case 11: 
      switch(persona)
      {
      case 0:
        ret = [ "I would have "+cnj1+".", "Would I have "+cnj3+"?", "I would not have "+cnj3+"." ];
        break;
      case 1:
        ret = [ "You would have "+cnj1+".", "Would you have "+cnj3+"?", "You would not have "+cnj3+"." ];
        break;
      case 2:
        ret = [ "He/She/It would have "+cnj1+".", "Would he/she/it have "+cnj3+"?", "He/She/It would not have "+cnj3+"." ];
        break;
      case 3:
        ret = [ "We would have "+cnj1+".", "Would we have "+cnj3+"?", "We would not have "+cnj3+"." ];
        break;
      case 4:
        ret = [ "You would have "+cnj1+".", "Would you have "+cnj3+"?", "You would not have "+cnj3+"." ];
        break;
      case 5:
        ret = [ "They would have "+cnj1+".", "Would they have "+cnj3+"?", "They would not have "+cnj3+"." ];
        break;      
      }
      break;      
    default:
      ret = ["Affirmative.", "Interrogative.", "Negative."];
  }
  return ret;

}

$scope.conj2 = function(cnj1,cnj2,cnj3,tiempo,persona)
{

  switch (tiempo)
  {
    case 0: // Present simple
      switch(persona)
      {
      case 0: 
        ret = [ "I "+cnj1+".", cnj1+" I ?", "I "+cnj1+" not." ];
        break;
      case 1:
        ret = [ "You "+cnj2+".", cnj2+" You ?", "You "+cnj2+" not." ];
        break;
      case 2:
        ret = [ "He/She/It "+cnj3+".", cnj3+" he/she/it ?", "He/She/It "+cnj3+" not." ];
        break;
      case 3:
        ret = [ "We "+cnj2+".", cnj2+" we ?", "We "+cnj2+" not." ];
        break;
      case 4:
        ret = [ "You "+cnj2+".", cnj2+" you ?", "You "+cnj2+" not." ];
        break;
      case 5:
        ret = [ "They "+cnj2+".", cnj2+" they ?", "They "+cnj2+" not." ];
        break;      
      }
      break;
    case 1: // Present continuous
      var aux="being"
      switch(persona)
      {
      case 0: 
        ret = [ "I "+cnj1+" "+aux+".", cnj1+" I "+aux+" ?", "I "+cnj1+" not "+aux+"." ];
        break;
      case 1:
        ret = [ "You "+cnj2+" "+aux+".", cnj2+" You "+aux+" ?", "You "+cnj2+" not "+aux+"." ];
        break;
      case 2:
        ret = [ "He/She/It "+cnj3+" "+aux+".", cnj3+" he/she/it "+aux+" ?", "He/She/It "+cnj3+" not "+aux+"." ];
        break;
      case 3:
        ret = [ "We "+cnj2+" "+aux+".", cnj2+" we "+aux+" ?", "We "+cnj2+" not "+aux+"." ];
        break;
      case 4:
        ret = [ "You "+cnj2+" "+aux+".", cnj2+" you "+aux+" ?", "You "+cnj2+" not "+aux+"." ];
        break;
      case 5:
        ret = [ "They "+cnj2+" "+aux+".", cnj2+" they "+aux+" ?", "They "+cnj2+" not "+aux+"." ];
        break;       
      }
      break;
    case 2: // Present perfect
      var aux="been";
      switch(persona)
      {
      case 0: 
        ret = [ "I "+cnj1+" "+aux+".", cnj1+" I "+aux+" ?", "I "+cnj1+" not "+aux+"." ];
        break;
      case 1:
        ret = [ "You "+cnj2+" "+aux+".", cnj2+" You "+aux+" ?", "You "+cnj2+" not "+aux+"." ];
        break;
      case 2:
        ret = [ "He/She/It "+cnj3+" "+aux+".", cnj3+" he/she/it "+aux+" ?", "He/She/It "+cnj3+" not "+aux+"." ];
        break;
      case 3:
        ret = [ "We "+cnj2+" "+aux+".", cnj2+" we "+aux+" ?", "We "+cnj2+" not "+aux+"." ];
        break;
      case 4:
        ret = [ "You "+cnj2+" "+aux+".", cnj2+" you "+aux+" ?", "You "+cnj2+" not "+aux+"." ];
        break;
      case 5:
        ret = [ "They "+cnj2+" "+aux+".", cnj2+" they "+aux+" ?", "They "+cnj2+" not "+aux+"." ];
        break;      
      }
      break;
    case 3: 
      var aux="been being";
      switch(persona)
      {
      case 0: 
        ret = [ "I "+cnj1+" "+aux+".", cnj1+" I "+aux+" ?", "I "+cnj1+" not "+aux+"." ];
        break;
      case 1:
        ret = [ "You "+cnj2+" "+aux+".", cnj2+" You "+aux+" ?", "You "+cnj2+" not "+aux+"." ];
        break;
      case 2:
        ret = [ "He/She/It "+cnj3+" "+aux+".", cnj3+" he/she/it "+aux+" ?", "He/She/It "+cnj3+" not "+aux+"." ];
        break;
      case 3:
        ret = [ "We "+cnj2+" "+aux+".", cnj2+" we "+aux+" ?", "We "+cnj2+" not "+aux+"." ];
        break;
      case 4:
        ret = [ "You "+cnj2+" "+aux+".", cnj2+" you "+aux+" ?", "You "+cnj2+" not "+aux+"." ];
        break;
      case 5:
        ret = [ "They "+cnj2+" "+aux+".", cnj2+" they "+aux+" ?", "They "+cnj2+" not "+aux+"." ];
        break;        
      }
      break;
    case 4: //Past simple
      switch(persona)
      {
      case 0:
        ret = [ "I "+cnj1 , cnj1+" I ?", "I "+cnj1+" not" ];
        break;
      case 1:
        ret = [ "You "+cnj2, cnj2+" You ?", "You "+cnj2+" not" ];
        break;
      case 2:
        ret = [ "He/She/It "+cnj3, cnj3+" he/she/it ?", "He/She/It "+cnj3+" not" ];
        break;
      case 3:
        ret = [ "We "+cnj2, cnj2+" we ?","We "+cnj2+" not" ];
        break;
      case 4:
        ret = [ "You "+cnj2, cnj2+" you ?", "You "+cnj2+" not" ];
        break;
      case 5:
        ret = [ "They "+cnj2, cnj2+" they ?", "They "+cnj2+" not" ];
        break;      
      }
      break;
    case 5: // Past continuous
      var aux="being"
      switch(persona)
      {
      case 0: 
        ret = [ "I "+cnj1+" "+aux+".", cnj1+" I "+aux+" ?", "I "+cnj1+" not "+aux+"." ];
        break;
      case 1:
        ret = [ "You "+cnj2+" "+aux+".", cnj2+" You "+aux+" ?", "You "+cnj2+" not "+aux+"." ];
        break;
      case 2:
        ret = [ "He/She/It "+cnj3+" "+aux+".", cnj3+" he/she/it "+aux+" ?", "He/She/It "+cnj3+" not "+aux+"." ];
        break;
      case 3:
        ret = [ "We "+cnj2+" "+aux+".", cnj2+" we "+aux+" ?", "We "+cnj2+" not "+aux+"." ];
        break;
      case 4:
        ret = [ "You "+cnj2+" "+aux+".", cnj2+" you "+aux+" ?", "You "+cnj2+" not "+aux+"." ];
        break;
      case 5:
        ret = [ "They "+cnj2+" "+aux+".", cnj2+" they "+aux+" ?", "They "+cnj2+" not "+aux+"." ];
        break;       
      }
      break; 
    case 6: // Past perfect
      var aux="been"
      switch(persona)
      {
      case 0: 
        ret = [ "I "+cnj1+" "+aux+".", cnj1+" I "+aux+" ?", "I "+cnj1+" not "+aux+"." ];
        break;
      case 1:
        ret = [ "You "+cnj2+" "+aux+".", cnj2+" You "+aux+" ?", "You "+cnj2+" not "+aux+"." ];
        break;
      case 2:
        ret = [ "He/She/It "+cnj3+" "+aux+".", cnj3+" he/she/it "+aux+" ?", "He/She/It "+cnj3+" not "+aux+"." ];
        break;
      case 3:
        ret = [ "We "+cnj2+" "+aux+".", cnj2+" we "+aux+" ?", "We "+cnj2+" not "+aux+"." ];
        break;
      case 4:
        ret = [ "You "+cnj2+" "+aux+".", cnj2+" you "+aux+" ?", "You "+cnj2+" not "+aux+"." ];
        break;
      case 5:
        ret = [ "They "+cnj2+" "+aux+".", cnj2+" they "+aux+" ?", "They "+cnj2+" not "+aux+"." ];
        break;       
      }
      break; 
    case 7: // Past perfect continuous
      var aux="been being"
      switch(persona)
      {
      case 0: 
        ret = [ "I "+cnj1+" "+aux+".", cnj1+" I "+aux+" ?", "I "+cnj1+" not "+aux+"." ];
        break;
      case 1:
        ret = [ "You "+cnj2+" "+aux+".", cnj2+" You "+aux+" ?", "You "+cnj2+" not "+aux+"." ];
        break;
      case 2:
        ret = [ "He/She/It "+cnj3+" "+aux+".", cnj3+" he/she/it "+aux+" ?", "He/She/It "+cnj3+" not "+aux+"." ];
        break;
      case 3:
        ret = [ "We "+cnj2+" "+aux+".", cnj2+" we "+aux+" ?", "We "+cnj2+" not "+aux+"." ];
        break;
      case 4:
        ret = [ "You "+cnj2+" "+aux+".", cnj2+" you "+aux+" ?", "You "+cnj2+" not "+aux+"." ];
        break;
      case 5:
        ret = [ "They "+cnj2+" "+aux+".", cnj2+" they "+aux+" ?", "They "+cnj2+" not "+aux+"." ];
        break;       
      }
      break; 
    case 8: // Future simple
      switch(persona)
      {
      case 0:
        ret = [ "I will "+cnj1+".", "Will I "+cnj3+"?", "I will not "+cnj3+"." ];
        break;
      case 1:
        ret = [ "You will "+cnj1+".", "Will you "+cnj3+"?", "You will not "+cnj3+"." ];
        break;
      case 2:
        ret = [ "He/She/It will "+cnj1+".", "Will he/she/it "+cnj3+"?", "He/She/It will not "+cnj3+"." ];
        break;
      case 3:
        ret = [ "We will "+cnj1+".", "Will we "+cnj3+"?", "We will not "+cnj3+"." ];
        break;
      case 4:
        ret = [ "You will "+cnj1+".", "Will you "+cnj3+"?", "You will not "+cnj3+"." ];
        break;
      case 5:
        ret = [ "They will "+cnj1+".", "Will they "+cnj3+"?", "They will not "+cnj3+"." ];
        break;      
      }
      break;    
    case 9: // Future perfect
      switch(persona)
      {
      case 0:
        ret = [ "I will have "+cnj1+".", "Will I have "+cnj3+"?", "I will not have "+cnj3+"." ];
        break;
      case 1:
        ret = [ "You will have "+cnj1+".", "Will you have "+cnj3+"?", "You will not have "+cnj3+"." ];
        break;
      case 2:
        ret = [ "He/She/It will have "+cnj1+".", "Will he/she/it have "+cnj3+"?", "He/She/It will not have "+cnj3+"." ];
        break;
      case 3:
        ret = [ "We will have "+cnj1+".", "Will we have "+cnj3+"?", "We will not have "+cnj3+"." ];
        break;
      case 4:
        ret = [ "You will have "+cnj1+".", "Will you have "+cnj3+"?", "You will not have "+cnj3+"." ];
        break;
      case 5:
        ret = [ "They will have "+cnj1+".", "Will they have "+cnj3+"?", "They will not have "+cnj3+"." ];
        break;      
      }
      break;
    case 10: // Conditional
      switch(persona)
      {
      case 0:
        ret = [ "I would "+cnj1+".", "Would I "+cnj3+"?", "I would not "+cnj3+"." ];
        break;
      case 1:
        ret = [ "You would "+cnj1+".", "Would you "+cnj3+"?", "You would not "+cnj3+"." ];
        break;
      case 2:
        ret = [ "He/She/It would "+cnj1+".", "Would he/she/it "+cnj3+"?", "He/She/It would not "+cnj3+"." ];
        break;
      case 3:
        ret = [ "We would "+cnj1+".", "Would we "+cnj3+"?", "We would not "+cnj3+"." ];
        break;
      case 4:
        ret = [ "You would "+cnj1+".", "Would you "+cnj3+"?", "You would not "+cnj3+"." ];
        break;
      case 5:
        ret = [ "They would "+cnj1+".", "Would they "+cnj3+"?", "They would not "+cnj3+"." ];
        break;      
      }
      break;
    case 11: // Conditional perfect
      switch(persona)
      {
      case 0:
        ret = [ "I would have "+cnj1+".", "Would I have "+cnj3+"?", "I would not have "+cnj3+"." ];
        break;
      case 1:
        ret = [ "You would have "+cnj1+".", "Would you have "+cnj3+"?", "You would not have "+cnj3+"." ];
        break;
      case 2:
        ret = [ "He/She/It would have "+cnj1+".", "Would he/she/it have "+cnj3+"?", "He/She/It would not have "+cnj3+"." ];
        break;
      case 3:
        ret = [ "We would have "+cnj1+".", "Would we have "+cnj3+"?", "We would not have "+cnj3+"." ];
        break;
      case 4:
        ret = [ "You would have "+cnj1+".", "Would you have "+cnj3+"?", "You would not have "+cnj3+"." ];
        break;
      case 5:
        ret = [ "They would have "+cnj1+".", "Would they have "+cnj3+"?", "They would not have "+cnj3+"." ];
        break;      
      }
      break;      
    default:
      ret = ["Affirmative.", "Interrogative.", "Negative."];
  }
  return ret;

}


$scope.conj_be=function(){
  conj={}
  conj["verb"]=$scope.verb;
  conj["infinitve"]="inf";
  conj["present"]="pres";
  conj["pastsimple"]="pastsimp";
  conj["pastparticiple"]="pastpart";
  conj["gerund"]="gerund";
  conj["tenses"]=["PresentSimple","PresentContinuous","PresentPerfect","PresentPerfectContinuous","PastSimple","PastContinuous","PastPerfect","PastPerfectContinuous","FutureSimple","FuturePerfect","Conditional","ConditionalPerfect"];

  cnj={};
  cnj[5]=["am","are","is"];
  cnj[6]=["am","are","is"];
  cnj[7]=["have","have","has"];
  cnj[8]=["have","have","has"];
  cnj[9]=["was","were","was"];
  cnj[10]=["was","were","was"];
  cnj[11]=["had","had","had"];
  cnj[12]=["had","had","had"];
  cnj[13]=["be","be","be"];
  cnj[14]=["been","been","been"];
  cnj[15]=["be","be","be"];
  cnj[16]=["been","been","been"];

  for (xx=0;xx<12;xx++)
  {
    var cnj1=cnj[5+xx][0];
    var cnj2=cnj[5+xx][1];
    var cnj3=cnj[5+xx][2];

    conj[conj["tenses"][xx]]={"I":       { "Affirmative":$scope.conj2(cnj1,cnj2,cnj3,xx,0)[0], "Interrogative":$scope.conj2(cnj1,cnj2,cnj3,xx,0)[1], "Negative":$scope.conj2(cnj1,cnj2,cnj3,xx,0)[2] }, 
                              "You":     { "Affirmative":$scope.conj2(cnj1,cnj2,cnj3,xx,1)[0], "Interrogative":$scope.conj2(cnj1,cnj2,cnj3,xx,1)[1], "Negative":$scope.conj2(cnj1,cnj2,cnj3,xx,1)[2] },
                              "hesheit": { "Affirmative":$scope.conj2(cnj1,cnj2,cnj3,xx,2)[0], "Interrogative":$scope.conj2(cnj1,cnj2,cnj3,xx,2)[1], "Negative":$scope.conj2(cnj1,cnj2,cnj3,xx,2)[2] },
                              "We":      { "Affirmative":$scope.conj2(cnj1,cnj2,cnj3,xx,3)[0], "Interrogative":$scope.conj2(cnj1,cnj2,cnj3,xx,3)[1], "Negative":$scope.conj2(cnj1,cnj2,cnj3,xx,3)[2] },
                              "You2":    { "Affirmative":$scope.conj2(cnj1,cnj2,cnj3,xx,4)[0], "Interrogative":$scope.conj2(cnj1,cnj2,cnj3,xx,4)[1], "Negative":$scope.conj2(cnj1,cnj2,cnj3,xx,4)[2] },
                              "They":    { "Affirmative":$scope.conj2(cnj1,cnj2,cnj3,xx,5)[0], "Interrogative":$scope.conj2(cnj1,cnj2,cnj3,xx,5)[1], "Negative":$scope.conj2(cnj1,cnj2,cnj3,xx,5)[2] }  };

  }

  return conj;
}    







$scope.genService=genService;
$scope.checkItem=function(){
  return genService.checkItem("__"+$scope.cacheKey);
}
$scope.offLine=function()
{
  if (genService.checkItem("__"+$scope.cacheKey)) // Quitar de offline
  {
      val=JSON.parse(genService.getItem("__"+$scope.cacheKey));
      verbs=val.data;
      for (xx=0;xx<verbs.length;xx++)
      {
        verb=verbs[xx];
        k="__conjugation_"+verb;
        genService.removeItem(k);
      }
      genService.removeItem("__"+$scope.cacheKey);
  } 
  else // Poner offline
  {
    console.log("* antes de getCached *");
    $ionicLoading.show();
    backendService.doGetCached($scope.cacheKey,'/v4/conjugations',$scope.userInfo,function(result) {
      console.log("* dentro de getCached *");
      $ionicLoading.hide();
      console.log('* getCached returned value *');
      console.log(result);
    });
    console.log("* después de getCached *");
  }
}
$scope.cacheKey="conjugations";

  genService.logEvent("Conjugate")

  adsService.showInterstitial(AdMob)

  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) 
  {
    // Esto es para que en iOS aparezca el botón 'done'    
    if ( ( typeof Keyboard != "undefined" ) && ( typeof Keyboard.hideFormAccessoryBar != "undefined" ) ) Keyboard.hideFormAccessoryBar(false)

    $rootScope.viewTitle = $rootScope.i18n[$rootScope.loc]["conj_title"]
    genService.viewTrack(JSON.stringify({name:$ionicHistory.currentStateName(),params:$stateParams}))

    $rootScope.errorValue = null

    if ($rootScope.loc == "es")
      $scope.locIdx = 1
    else      
      $scope.locIdx = 0
  })

  $scope.$on( "$ionicView.beforeLeave", function( scopes, states ) 
  {
    console.log("* settingsCtrl:beforeLeave *")
    // Lo deja como está por defecto
    if ( ( typeof Keyboard != "undefined" ) && ( typeof Keyboard.hideFormAccessoryBar != "undefined" ) ) Keyboard.hideFormAccessoryBar(true)
  })

  $scope.verb=$stateParams.verb

  console.log("* verb *")
  if ($scope.verb)
    console.log("* si *")
  else
    console.log("* no *")

  console.log($scope.verb)

  $scope.txt={};
  $scope.txt["all"]=["All","Todos"]
  $scope.txt["PresentSimple"]=["Present Simple","Presente Simple"]
  $scope.txt["PresentContinuous"]=["Present Continuous","Presente Contínuo"]
  $scope.txt["PastSimple"]=["Past Simple","Pasado Simple"]
  $scope.txt["PastContinuous"]=["Past Continuous","Pasado Contínuo"]
  $scope.txt["FutureSimple"]=["future Simple","Futuro Simple"]
  $scope.txt["PresentPerfect"]=["Present Perfect","Presente Perfecto"]
  $scope.txt["PresentPerfectContinuous"]=["Present Perfect Continuous","Presente Perfecto Contínuo"]
  $scope.txt["PastPerfect"]=["Past Perfect","Pasado Perfecto"]
  $scope.txt["PastPerfectContinuous"]=["Past Perfect Continuous","Pasado Perfecto Contínuo"]
  $scope.txt["FuturePerfect"]=["Future Perfect","Futuro Perfecto"]
  $scope.txt["Conditional"]=["Conditional","Condicional"]
  $scope.txt["ConditionalPerfect"]=["Conditional Perfect","Condicional Perfecto"]

  $scope.related={}
  $scope.related["PresentSimple"]=            { course: 4 , unit: 32 , lesson: 81 }
  $scope.related["PresentContinuous"]=        { course: 4 , unit: 32 , lesson: 82 }
  $scope.related["PastSimple"]=               { course: 5 , unit: 23 , lesson: 44 }
  $scope.related["PastContinuous"]=           { course: 5 , unit: 23 , lesson: 45 }
  $scope.related["FutureSimple"]=             { course: 5 , unit: 24 , lesson: 46 }
  $scope.related["PresentPerfect"]=           { course: 6 , unit: 25 , lesson: 48 }
  $scope.related["PresentPerfectContinuous"]= { course: 6 , unit: 25 , lesson: 49 }
  $scope.related["PastPerfect"]=              { course: 6 , unit: 26 , lesson: 206 }
  $scope.related["PastPerfectContinuous"]=    { course: 6 , unit: 26 , lesson: 54 }
  $scope.related["FuturePerfect"]=            { course: 6 , unit: 27 , lesson: 55 }
  $scope.related["Conditional"]=              { course: 6 , unit: 34 , lesson: 87 }
  $scope.related["ConditionalPerfect"]=       { course: 6 , unit: 34 , lesson: 87 }

  if ( $scope.verb!="" )
  {
    $scope.filter = false
    $scope.test = "Cargando ..."
    $scope.filterTense = ""

    if ( $scope.verb=="be" )
    {
      $scope.notFound = false
      $scope.found = false  // Para que no muestre lo de 'Verbo en inglés: xxx'
      $scope.conjugation = $scope.conj_be()
      $scope.test = ""
      $rootScope.errorValue = null
    }
    else
    {

      $scope.conjugation=[]
      console.log("* antes de getConjugation *")
      $ionicLoading.show()
      $rootScope.forceCache=true    
      //backendService.getConjugation($scope.verb,function(result) {
      backendService.doGetCached("conjugation_"+$scope.verb,'/v4/conjugation/'+$scope.verb,$scope.userInfo,function(result) {
        console.log("* dentro de getConjugation *")
        $ionicLoading.hide()
        console.log('* getConjugation returned value *')

        console.log(result)
        //console.log(result.courses)
        // result.error contiene el mensaje de error si lo hay

        //     $scope.conjugation=result.data.conjugation
        if (result.data.cnj.error)
        {
          $scope.notFound = true
          $scope.found = false
          $scope.conjugation = null
        }
        else
        {
          var cnj = result.data.cnj.datos
          console.log(cnj)

          conj = {}
          conj["verb"] = $scope.verb
          conj["infinitve"] = cnj[0]
          conj["present"] = cnj[1]
          conj["pastsimple"] = cnj[2]
          conj["pastparticiple"] = cnj[3]
          conj["gerund"] = cnj[4]
          conj["tenses"] = ["PresentSimple","PresentContinuous","PresentPerfect","PresentPerfectContinuous","PastSimple","PastContinuous","PastPerfect","PastPerfectContinuous","FutureSimple","FuturePerfect","Conditional","ConditionalPerfect"]

          for (xx=0;xx<12;xx++)
          {
            var cnj1 = cnj[5+xx][0]
            var cnj2 = cnj[5+xx][1]
            var cnj3 = cnj[5+xx][2]

            conj[conj["tenses"][xx]] = {"I":       { "Affirmative":$scope.conj(cnj1,cnj2,cnj3,xx,0)[0], "Interrogative":$scope.conj(cnj1,cnj2,cnj3,xx,0)[1], "Negative":$scope.conj(cnj1,cnj2,cnj3,xx,0)[2] }, 
                                        "You":     { "Affirmative":$scope.conj(cnj1,cnj2,cnj3,xx,1)[0], "Interrogative":$scope.conj(cnj1,cnj2,cnj3,xx,1)[1], "Negative":$scope.conj(cnj1,cnj2,cnj3,xx,1)[2] },
                                        "hesheit": { "Affirmative":$scope.conj(cnj1,cnj2,cnj3,xx,2)[0], "Interrogative":$scope.conj(cnj1,cnj2,cnj3,xx,2)[1], "Negative":$scope.conj(cnj1,cnj2,cnj3,xx,2)[2] },
                                        "We":      { "Affirmative":$scope.conj(cnj1,cnj2,cnj3,xx,3)[0], "Interrogative":$scope.conj(cnj1,cnj2,cnj3,xx,3)[1], "Negative":$scope.conj(cnj1,cnj2,cnj3,xx,3)[2] },
                                        "You2":    { "Affirmative":$scope.conj(cnj1,cnj2,cnj3,xx,4)[0], "Interrogative":$scope.conj(cnj1,cnj2,cnj3,xx,4)[1], "Negative":$scope.conj(cnj1,cnj2,cnj3,xx,4)[2] },
                                        "They":    { "Affirmative":$scope.conj(cnj1,cnj2,cnj3,xx,5)[0], "Interrogative":$scope.conj(cnj1,cnj2,cnj3,xx,5)[1], "Negative":$scope.conj(cnj1,cnj2,cnj3,xx,5)[2] }  }

          }

          $scope.conjugation = conj
          console.log(conj)
        }
        
        $scope.test = ""

        //console.log($scope.conjugation)

      })
      console.log("* después de getConjugation *");
    }

  }
  else
  {
    $scope.filter = true
    $scope.tenses = ["all","PresentSimple","PresentContinuous","PastSimple","PastContinuous","FutureSimple","PresentPerfect","PresentPerfectContinuous","PastPerfect","PastPerfectContinuous","FuturePerfect","Conditional","ConditionalPerfect"]
  }

  // Para el 'buscar' de arriba del todo
  $scope.openItem2 = true
  $scope.plusClick2 = function(){
    console.log("* click 2 *")
    $scope.openItem2=!$scope.openItem2
  }

  // Para los tenses
  $scope.openItem=0 //Abierto el 0 (primero) por defecto
  $scope.plusClick=function(index){
    console.log("* click *",index)
    if ($scope.openItem==index)
      $scope.openItem=-1 // Ninguno abierto
    else
      $scope.openItem=index
  }

  $scope.wordClick=function(word){
    console.log("wordClick")
    console.log(word)
    backendService.Play(word,$scope.userInfo)
  }

  $scope.tabOption=0
  $scope.tabClick = function(index){
    console.log("* tabClick *",index)
    $scope.tabOption = index
    $scope.$apply()
  }

  $scope.goRelated = function(tense){
    console.log("* goRelated *")
    console.log(tense)
    var less = $scope.related[tense]
    $rootScope.sectionPayLoad = "conjugate"
    $state.go("app.section_fullURL",{ "courseId" : less.course , "unitId" : less.unit, "lessonId" : less.lesson })
  }

  $scope.checkVerb=function(verb){
    //console.log("* checkVerb *")
    if (verb==undefined || verb.length<2)
      return true
    else
      return false
  }











  $scope.conjuga = function(verb,tense)
  {
    console.log("* conjuga *");
    console.log(verb);
    console.log(tense);

    v=verb.split(" ");
    console.log(v);
    if (v.length==1 || v.length==2)
    {
      if (v.length==2)
      {
       if (v[0].toLowerCase()=="to")
          verb=v[1].toLowerCase();
        else
        {
          console.log("* dos plabras pero la primera no es 'to' *");
          $scope.notFound=true;
          $scope.found=false;
          $scope.conjugation=null;
          return
        }
      }
    }
    else
    {
      console.log("* no tiene 1 o 2 palabras *");
      $scope.notFound=true;
      $scope.found=false;  
      $scope.conjugation=null;
      return
    }

    // Si estan todos cacheados se comprueba si está en la lista, si no no tiene sentido llamar al backend para recibir el error de que no existe.
    if (genService.getCache() && $scope.checkItem() && verb!="be")
    {  
      val=JSON.parse(genService.getItem("__"+$scope.cacheKey));
      verbs=val.data;
      if (verbs.indexOf(verb)==-1)
      {
        $scope.notFound=true;
        $scope.found=false;
        $scope.conjugation=null;

        return
      }
    }

    $scope.test="Cargando ..."

    $scope.verb=verb
    if (tense==undefined || tense=="Todos" || tense=="All" || tense=="all")
    {
      $scope.filterTense="";
      var cual=0;
    }
    else
    {
      $scope.filterTense=tense;
      // buscar la posicion de tense 
      var cual=-1;
      for (i=0;i<$scope.tenses.length;i++)
      {
        if ($scope.tenses[i]==tense)
          cual=i-1;
      }      
    }


  if ($scope.verb=="be")
  {
    $scope.conjugation=$scope.conj_be();
    $scope.test="";
    $scope.notFound=false; 
    $scope.found=true;
    $rootScope.errorValue=null;
  }
  else
  {

    $scope.notFound=false; // Este flag gobierna el mensaje de no encontrado.

    console.log("* antes de getConjugation *");
    $ionicLoading.show();
    $rootScope.forceCache=true;    
    backendService.doGetCached("conjugation_"+$scope.verb,'/v4/conjugation/'+$scope.verb,$scope.userInfo,function(result) {
      console.log("* dentro de getConjugation *");

      console.log('** getConjugation returned value **');
      console.log(result);

      if (result.data.cnj.error)
      {
        $ionicLoading.hide();
        $scope.notFound=true;
        $scope.found=false;  
        $scope.conjugation=null;
      }
      else
      {
        var cnj=result.data.cnj.datos;
        console.log(cnj);

        conj={}
        conj["verb"]=$scope.verb;
        conj["infinitve"]=cnj[0];
        conj["present"]=cnj[1];
        conj["pastsimple"]=cnj[2];
        conj["pastparticiple"]=cnj[3];
        conj["gerund"]=cnj[4];
        conj["tenses"]=["PresentSimple","PresentContinuous","PresentPerfect","PresentPerfectContinuous","PastSimple","PastContinuous","PastPerfect","PastPerfectContinuous","FutureSimple","FuturePerfect","Conditional","ConditionalPerfect"];

        for (xx=0;xx<12;xx++)
        {
          var cnj1=cnj[5+xx][0];
          var cnj2=cnj[5+xx][1];
          var cnj3=cnj[5+xx][2];

          conj[conj["tenses"][xx]]={"I":       { "Affirmative":$scope.conj(cnj1,cnj2,cnj3,xx,0)[0], "Interrogative":$scope.conj(cnj1,cnj2,cnj3,xx,0)[1], "Negative":$scope.conj(cnj1,cnj2,cnj3,xx,0)[2] }, 
                                    "You":     { "Affirmative":$scope.conj(cnj1,cnj2,cnj3,xx,1)[0], "Interrogative":$scope.conj(cnj1,cnj2,cnj3,xx,1)[1], "Negative":$scope.conj(cnj1,cnj2,cnj3,xx,1)[2] },
                                    "hesheit": { "Affirmative":$scope.conj(cnj1,cnj2,cnj3,xx,2)[0], "Interrogative":$scope.conj(cnj1,cnj2,cnj3,xx,2)[1], "Negative":$scope.conj(cnj1,cnj2,cnj3,xx,2)[2] },
                                    "We":      { "Affirmative":$scope.conj(cnj1,cnj2,cnj3,xx,3)[0], "Interrogative":$scope.conj(cnj1,cnj2,cnj3,xx,3)[1], "Negative":$scope.conj(cnj1,cnj2,cnj3,xx,3)[2] },
                                    "You2":    { "Affirmative":$scope.conj(cnj1,cnj2,cnj3,xx,4)[0], "Interrogative":$scope.conj(cnj1,cnj2,cnj3,xx,4)[1], "Negative":$scope.conj(cnj1,cnj2,cnj3,xx,4)[2] },
                                    "They":    { "Affirmative":$scope.conj(cnj1,cnj2,cnj3,xx,5)[0], "Interrogative":$scope.conj(cnj1,cnj2,cnj3,xx,5)[1], "Negative":$scope.conj(cnj1,cnj2,cnj3,xx,5)[2] }  };

        }


        $scope.notFound=false
        $scope.found=true
        $scope.conjugation=conj
        console.log(conj)

        $timeout(function() { $ionicLoading.hide(); $scope.notFound=false;  }, 500);

      }

      $scope.test = ""
      $scope.openItem = cual        

    })
}

  }


})
