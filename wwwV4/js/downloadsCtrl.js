angular.module('starter').controller('downloadsCtrl', function ($scope, $ionicSlideBoxDelegate, $ionicHistory, $stateParams, genService, varGlobal, $ionicLoading, $rootScope, backendService, CoursesService, $ionicPopup) {

  genService.logEvent("Downloads");

  $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) 
  {
    $rootScope.viewTitle=$rootScope.i18n[$rootScope.loc]["down_title"];    
    genService.viewTrack(JSON.stringify({name:$ionicHistory.currentStateName(),params:$stateParams}));
  })



  $scope.cacheKey="courseslist";

  $scope.Courses =[];

  $scope.$on('$ionicView.afterEnter', function(){
    console.log("* ENTRA EN downloads.html ($ionicView.afterEnter) *");

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
        $ionicLoading.hide();        
    }


  });


  $scope.fillFiles=function(cual)
  { 
    console.log("# fillFiles #");
    var lessons = JSON.parse(genService.getItem("__course" + cual)).lessons;
    console.log(lessons);  
    var files = [];
    var nf = 0;
    var nl = lessons.length;
    for (il = 0; il < nl; il++) {
      var lesson_id = lessons[il].id;
      //console.log(lesson_id);
      var sections = lessons[il].sections;
      var ns = lessons[il].sections.length;
      for (is = 0; is < ns; is++) {
        var lesson_section_id = lessons[il].sections[is].id;
        files.push(lesson_section_id.toString().padStart(5, "0") + ".zip");
        nf = nf + 1;
        $rootScope.loadingStatus["audios"][cual][2] = nf;
      }
    }
    $rootScope.loadingFiles[cual] = files;
    console.log(nf, files, $rootScope.loadingStatus["audios"][cual]);
  }

  $scope.goDoDo=function(cual)
  {
    $rootScope.loadingStatus["audios"][cual] = [1, 0, 0];
    $scope.fillFiles(cual);
    $scope.downloadAudio(cual, 0);
  }

  $scope.goDoDel=function(cual)
  {
    var inicial = $rootScope.loadingStatus["audios"][cual][1];
    $rootScope.loadingStatus["audios"][cual][0] = 4;
    $scope.fillFiles(cual);
    $scope.removeAudio(cual, inicial);
  }

  $scope.goDoThings=function(cual)
  {
    console.log("# goDoThings ["+cual+"] #");

    var estado = $rootScope.loadingStatus["audios"][cual];
    console.log("# $rootScope.loadingStatus['audios'][" + cual + "]: ",estado);
    console.log("# $rootScope.loadingStatus['audios'][" + cual + "][0]:",estado[0])

    if (estado[0] == 0 || (estado[0] == 3 && estado[1] == 0)) // Descargar
    {
      console.log("# Descargar #");
      var myPopup = $ionicPopup.show({ template: '', title: "", subTitle: "Do you really want to start the download ?", scope: $scope, buttons: [{ text: 'Ok', onTap: function (e) { $scope.goDoDo(cual); } }, { text: 'Cancel' }] });    
    }
    else
      if (estado[0] == 1) // Descargando
        console.log("DUMMY");
      else
        if (estado[0] == 2) // Descargado
        {
          console.log("# Eliminar #");
          var myPopup = $ionicPopup.show({ template: '', title: "", subTitle: "Do you really want to proceed with the deletion ?", scope: $scope, buttons: [{ text: 'Ok', onTap: function (e) { $scope.goDoDel(cual); } }, { text: 'Cancel' }] });
        }
        else // 3 == Error
        {
          $scope.goDoDel(cual);
        }
    
  }


  $scope.downloadAudio = async function(curso,contador)
  {    
    if (contador>=$rootScope.loadingStatus["audios"][curso][2]) 
    {
      $rootScope.loadingStatus["audios"][curso][0] = 2;
      window.localStorage.setItem("_loadingStatus" + curso, $rootScope.loadingStatus["audios"][curso].toString());      
      var myPopup = $ionicPopup.show({ template: '', title: "", subTitle: $rootScope.loadingStatus["audios"][curso][1]+" items downloaded.", scope: $rootScope, buttons: [{ text: 'Ok' }] });
      return;      
    } 
    if ($rootScope.loadingStatus["audios"][curso][0]==3) // Ha fallado la última descarga
      return;

    console.log("%%% Download audio %%%");
    $rootScope.loadingStatus["audios"][curso][1]=contador+1;
    var file=$rootScope.loadingFiles[curso][contador];
    var url="https://s3.amazonaws.com/sk.audios/speech/"+file
    console.log("%%% Curso "+curso+", contador: "+contador+", archivo: "+file+" url:"+url+" %%%")
    /////
    
    if ( r34lp0w3r.platform == 'browser' )
    {
      console.log(">>>");
      console.log(">>> Dummy download: browser.");      
      $rootScope.downloadAudio(curso, contador + 1);
    }
    else
    {
      var down_ok = await descargarZipAudio(url);

      if (down_ok)
      {

        var zip_ok = await unzipTmp();

        if (zip_ok)
        {
          window.localStorage.setItem("_loadingStatus" + curso, $rootScope.loadingStatus["audios"][curso].toString());
          $scope.downloadAudio(curso, contador + 1);           
        }
        else
        {
          $rootScope.loadingStatus["audios"][curso][0] = 3;
          $rootScope.loadingStatus["audios"][curso][1] = contador;
          window.localStorage.setItem("_loadingStatus" + curso, $rootScope.loadingStatus["audios"][curso].toString());          
        } 
      }
      else
      {
        $rootScope.loadingStatus["audios"][curso][0] = 3;
        $rootScope.loadingStatus["audios"][curso][1] = contador;
        window.localStorage.setItem("_loadingStatus" + curso, $rootScope.loadingStatus["audios"][curso].toString());
      }

    }

  }


  $scope.removeAudio = async function(curso,contador)
  {
    if (contador<1)
    {
      $rootScope.loadingStatus["audios"][curso][0] = 0;
      window.localStorage.setItem("_loadingStatus" + curso, $rootScope.loadingStatus["audios"][curso].toString());    
      var myPopup = $ionicPopup.show({ template: '', title: "", subTitle: "All items deleted", scope: $rootScope, buttons: [{ text: 'Ok' }] });     
      return;
    }

    console.log("%%% Remove audio %%%");
    $rootScope.loadingStatus["audios"][curso][1] = contador;
    file = $rootScope.loadingFiles[curso][contador-1];
    console.log("%%% Curso " + curso + ", contador: " + contador + ", archivo: " + file + " %%%")

    var subdir = file.substring(0, 5);
    var dir = "audio/sections";
    var dst = dir + "/" + subdir;

    if ( r34lp0w3r.platform == 'browser' )
    { 
      console.log(">>>");
      console.log(">>> " + dst);      
      console.log(">>> dummy delete: browser.")
      $scope.removeAudio(curso, contador - 1);
      console.log(">>>");      
    }
    else
    {

      borrar_ok = await borrarDirectorio(dst)

      $scope.removeAudio(curso, contador - 1);

    }
    
  }

})




async function descargarZipAudio(url) {

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




function unzipTmp() {

  const zipPath='audio/sections/tmp.zip';

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



