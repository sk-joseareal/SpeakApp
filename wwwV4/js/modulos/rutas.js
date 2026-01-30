console.log("002.001 >###> js/modulos/rutas.js >>>")

angular.module('starter.rutas', [])

.config(function($stateProvider, $urlRouterProvider, $sceDelegateProvider) {
  $stateProvider

  .state('app', {
    url: '/app',
    abstract: true,
    //template:"<p>Menu.html</p>",
    templateUrl: 'views/menu.html',
    controller: 'AppCtrl'
  })

  .state('app.practice', {
    url: '/practice',
    views: {
      'menuContent': {
        templateUrl: 'views/practice.html',
        controller: 'practiceCtrl'
//        ,
//        controller: function($scope) {
//          $scope.titulo="Prueba";
//        }
      }
    }
  })

  .state('app.resources', {
      url: '/resources',
      views: {
        'menuContent': {
          templateUrl: 'views/resources.html', //,
          controller: 'resourcesCtrl'
        }
      }
  })

  .state('app.learn', {
    //cache: false,
    url: '/learn',
    views: {
      'menuContent': {
        templateUrl: 'views/learn.html',
        controller: 'learnCtrl'
      }
    }
  })

  .state('app.chat', {
    url: '/chat',
    views: {
      'menuContent': {
        templateUrl: 'views/chat.html',
        controller: 'ChatCtrl'
      }
    }
  })

  .state('app.chatlist', {
    url: '/chatlist',
    views: {
      'menuContent': {
        templateUrl: 'views/chatlist.html',
        controller: 'ChatListCtrl'
      }
    }
  })

  .state('app.chats', {
    cache: false,
    url: '/chats/:channel',
    views: {
      'menuContent': {
        templateUrl: 'views/chats.html',
        controller: 'ChatsCtrl'
      }
    }
  })    

  .state('app.single', {
    url: '/course/:courseId',
    views: {
      'menuContent': {
        templateUrl: 'views/course.html',
        controller: 'CourseCtrl'
      }
    }
  })

  .state('app.singlewithTitle', {
    url: '/course/:courseId/:title',
    views: {
      'menuContent': {
        templateUrl: 'views/course.html',
        controller: 'CourseCtrl'
      }
    }
  })

  .state('app.unit', {
    url: '/course/:courseId/:unitId',
    views: {
      'menuContent': {
        templateUrl: 'views/course.html',
        controller: 'CourseCtrl'
      }
    }
  })

  .state('app.section', {
    url: '/section/:unitId/:lessonId',
    views: {
      'menuContent': {
        templateUrl: 'views/section.html',
        controller: 'SectionCtrl'
      }
    }
  })

  .state('app.section_fullURL', {
    url: '/section/:courseId/:unitId/:lessonId',
    views: {
      'menuContent': {
        templateUrl: 'views/section.html',
        controller: 'SectionCtrl'
      }
    }
  })

  .state('app.section_fullURL_goToContent', {
    url: '/section/:courseId/:unitId/:lessonId/:goTo',
    views: {
      'menuContent': {
        templateUrl: 'views/section.html',
        controller: 'SectionCtrl'
      }
    }
  })

  .state('app.test', {
    url: '/test/:unitId/:testId',
    views: {
      'menuContent': {
        templateUrl: 'views/test.html',
        controller: 'TestCtrl'
      }
    }
  })

  .state('app.singlequestion', {
    url: '/questions/:questionId',
    views: {
      'menuContent': {
        templateUrl: 'views/question.html',
        controller: 'questionCtrl'
      }
    }
  })

  .state('app.translate', {
    url: '/translate',
    views: {
      'menuContent': {
        templateUrl: 'views/translate.html',
        controller: 'translateCtrl'
      }
    }
  })

  .state('app.translateText', {
    url: '/translate/:dir/:text',
    views: {
      'menuContent': {
        templateUrl: 'views/translate.html',
        controller: 'translateCtrl'
      }
    }
  })

  .state('app.pronounce', {
    url: '/pronounce',
    views: {
      'menuContent': {
        templateUrl: 'views/pronounce.html',
        controller: 'pronounceCtrl'
      }
    }
  })

  .state('app.pronounceText', {
    url: '/pronounce/:text',
    views: {
      'menuContent': {
        templateUrl: 'views/pronounce.html',
        controller: 'pronounceCtrl'
      }
    }
  })

  .state('app.friends', {
    url: '/friends',
    views: {
      'menuContent': {
        templateUrl: 'views/friends.html'
      }
    }
  })  

  .state('app.myfriends', {
    url: '/myfriends',
    views: {
      'menuContent': {
        templateUrl: 'views/myfriends.html',
        controller: 'myFriendsCtrl'
      }
    }
  })

  .state('app.myfriends2', {
    url: '/myfriends2',
    views: {
      'menuContent': {
        templateUrl: 'views/myfriends2.html',
        controller: 'myFriendsCtrl2'
      }
    }
  })

  .state('app.conjugate', {
    url: '/conjugate',
    views: {
      'menuContent': {
        templateUrl: 'views/conjugate.html'
      }
    }
  })


  .state('app.vocabularies', {
    url: '/vocabularies',
    views: {
      'menuContent': {
        templateUrl: 'views/vocabularies.html',
        controller: 'vocabsCtrl'          
      }
    }
  })

  .state('app.vocabulary', {
    url: '/vocabulary/:vocabId/:vocabularyId',
    views: {
      'menuContent': {
        templateUrl: 'views/vocabulary.html',
        controller: 'vocabularyCtrl'          
      }
    }
  })

  .state('app.expressions', {
    url: '/expressions',
    views: {
      'menuContent': {
        templateUrl: 'views/expressions.html',
        controller: 'expressionsCtrl'          
      }
    }
  })

  .state('app.regverbs', {
    url: '/regverbs',
    views: {
      'menuContent': {
        templateUrl: 'views/regverbs.html',
        controller: 'regverbsCtrl'          
      }
    }
  })

  .state('app.irregverbs', {
    url: '/irregverbs',
    views: {
      'menuContent': {
        templateUrl: 'views/irregverbs.html',
        controller: 'irregverbsCtrl'          
      }
    }
  })

  .state('app.phrasverbs', {
    url: '/phrasverbs',
    views: {
      'menuContent': {
        templateUrl: 'views/phrasverbs.html',
        controller: 'phrasverbsCtrl'          
      }
    }
  })

  .state('app.proverbs', {
    url: '/proverbs',
    views: {
      'menuContent': {
        templateUrl: 'views/proverbs.html',
        controller: 'proverbsCtrl'          
      }
    }
  })

  .state('app.quotes', {
    url: '/quotes',
    views: {
      'menuContent': {
        templateUrl: 'views/quotes.html',
        controller: 'quotesCtrl'          
      }
    }
  })

  .state('app.setting', {
    url: '/settings',
    views: {
      'menuContent': {
        templateUrl: 'views/settings.html',
        controller: 'settingsCtrl' 
      }
    }
  })

  .state('app.settings', {
    url: '/settings/:id',
    views: {
      'menuContent': {
        templateUrl: 'views/settings.html',
        controller: 'settingsCtrl' 
      }
    }
  })

  .state('app.profile', {
    url: '/profile',
    views: {
      'menuContent': {
        templateUrl: 'views/profile.html',
        controller: 'profileCtrl' 
      }
    }
  })

  .state('app.conjugateverb', {
    url: '/conjugate/:verb',
    views: {
      'menuContent': {
        templateUrl: 'views/conjugateverb.html',
        controller: 'conjugateverbCtrl'
      }
    }
  })

  .state('app.grammar', {
    url: '/grammar/:courseId',
    views: {
      'menuContent': {
        templateUrl: 'views/grammar.html',
        controller: 'grammarCtrl'
      }
    }
  })

  .state('app.songs', {
    url: '/songs',
    views: {
      'menuContent': {
        templateUrl: 'views/songs.html',
        controller: 'songsCtrl'
      }
    }
  })

  .state('app.song', {
    url: '/song?params',
    views: {
      'menuContent': {
        templateUrl: 'views/song.html',
        controller: 'songCtrl'         
      }
    }
  })

  .state('app.videolesson', {
    url: '/videolesson?params',
    views: {
      'menuContent': {
        templateUrl: 'views/videolesson.html',
        controller: 'videolessonCtrl' // Está en Songs_Ctrl.js        
      }
    }
  })

  .state('app.games', {
    url: '/games',
    views: {
      'menuContent': {
        templateUrl: 'views/games.html',
        controller: 'gamesCtrl'
      }
    }
  })

  .state('app.game', {
    url: '/game?params',
    views: {
      'menuContent': {
        templateUrl: 'views/game.html',
        controller: 'gameCtrl'         
      }
    }
  })
  
  .state('app.tour', {
    url: '/tour/:page',
    views: {
      'menuContent': {
        templateUrl: 'views/tour.html',
        //template: "<br><br><br><h2>Tour</h2>",
        controller: 'tourCtrl'   
      }
    }
  })

  .state('app.legal', {
    url: '/legal/:title',
    views: {
      'menuContent': {
        templateUrl: 'views/legal.html',
        controller: 'placeholderCtrl'
      }
    }
  })

  .state('app.credits', {
    url: '/credits/:title',
    views: {
      'menuContent': {
        templateUrl: 'views/credits.html',
        controller: 'placeholderCtrl',
      }
    }
  })

  .state('app.chatnorms', {
    url: '/chatnorms/:title',
    views: {
      'menuContent': {
        templateUrl: 'views/chatnorms.html',
        controller: 'placeholderCtrl'      
      }
    }
  })

  .state('app.subscription', {
    url: '/subscription',
    views: {
      'menuContent': {
        templateUrl: 'views/subscription.html'   
      }
    }
  })

  .state('app.downloads', {
    url: '/downloads',
    views: {
      'menuContent': {
        templateUrl: 'views/downloads.html',
        controller: 'downloadsCtrl'
      }
    }
  })

  ;

  // if none of the above states are matched, use this as the fallback
  $urlRouterProvider.otherwise('/app/settings');

  $urlRouterProvider.otherwise(function($injector, $location){    
    var state = $injector.get('$state');
    console.log("# 00y # urlRouterProvider.otherwise #")
    var firstTime=window.localStorage.getItem("firstTime");
    if (!firstTime)
    {
      window.localStorage.setItem("firstTime","SI");
      console.log("# 00y # urlRouterProvider.otherwise : Va al Tour #")
      state.go('app.tour');
    }
    else
    {      
      console.log("# 00y # urlRouterProvider.otherwise : No va al Tour #")
      var donde=JSON.parse(window.localStorage.getItem("_lastPos"));
      console.log("# 00y # urlRouterProvider.otherwise : restaura _lastPos #")
      console.log("# 00y # urlRouterProvider.otherwise : donde=["+JSON.stringify(donde)+"] #")
      if (donde)
      {
        console.log("# 00y # urlRouterProvider.otherwise : restaura la posición #")
        state.go(donde.name,donde.params);
      }
      else
      {
        console.log("# 00y # urlRouterProvider.otherwise : Va al Tour #")
        state.go('app.tour',{page:3});
      }
    }
    return $location.path();
  });

  //$sceDelegateProvider.resourceUrlWhitelist(['**']);
  $sceDelegateProvider.resourceUrlWhitelist(['self', new RegExp('^(http[s]?):\/\/(w{3}.)?youtube\.com/.+$')]);
  
})

console.log("002.001 >###> js/modulos/rutas.js <<<")