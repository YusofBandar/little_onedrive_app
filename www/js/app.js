(function () {

  'use strict';


  // EXAMPLE CODE STARTS HERE

  // little_scroll

  // creates a module called starter - bound to body through ng-app directive
  // requires the ionic module for ionic to work
  // need ngAnimate for animations
  var app = angular.module('starter', ['ionic']);

  // entry point for the web app
  // boilerplate code that doesn't need to be modified
  app.run(function ($ionicPlatform) {
    $ionicPlatform.ready(function () {
      // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
      // for form inputs).
      // The reason we default this to hidden is that native apps don't usually show an accessory bar, at
      // least on iOS. It's a dead giveaway that an app is using a Web View. However, it's sometimes
      // useful especially with forms, though we would prefer giving the user a little more room
      // to interact with the app.
      if (window.cordova && window.Keyboard) {
        window.Keyboard.hideKeyboardAccessoryBar(true);
      }

      if (window.StatusBar) {
        // Set the statusbar to use the default style, tweak this to
        // remove the status bar on iOS or change it to use white instead of dark colors.
        StatusBar.styleDefault();
      }
    });

  });

  app.controller('CallbackController', callbackcontrol);

  callbackcontrol.$inject = ['odauthService'];

  function callbackcontrol(odauthService) {
    var vm = angular.extend(this, {})
    odauthService.onAuthCallback();
  }


  // creating controller
  app.controller('MainController', control);

  // Inject services that you need (in this case we don't need any :D )
  control.$inject = ['odauthService', '$window'];

  // Pass any injected services to the controller constructor function
  function control(odauthService, $window) {
    var vm = angular.extend(this, {
      file_header: '',
      file_contents: '',
      file_path : ''
    });

    vm.oneDrive_login = function () {
      console.log('onedrive login');

      //OneDrive Application information, retrieved from Microsoft Graph API
      var appInfo = {
        "clientId": 'dabc0641-14b9-4c5f-8956-73693bbc3821',
        "redirectUri": "https://127.0.0.1:8080/callback.html",
        "scopes": "sites.read.all",
        "authServiceUri": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
      }

      //provide the app info
      odauthService.provideAppInfo(appInfo);
      challengeForAuth();

    }

    // Downloads specific file from a OneDrive account
    // file_path : absolute path to file, example : test/test/test.txt 
    vm.oneDrive_download = function (file_path) {
      console.log(vm.file_path);
      if (!is_authenticated()) {
        alert("login into onedrive")
        return;
      }

      // Download file providing OneDrive auth token and file path
      download_folder(localStorage.getItem("oneDriveToken"), file_path).then(function (result) {
        // show contents of file
        vm.file_header = "File Path: " + file_path;
        vm.file_contents = "File Contents  : " + result[1];

      }).catch(function (error) {
        // Un-authorized
        if (error[0] == 401) {
          alert("You are unauthorized, try logging in");
        }
        // File not found
        else if (error[0] == 404) {
          alert("item not found, check path");
        }
        else {
          alert("You have a weird error, check the console");
          console.log(error);
        }
      });
    }


    /*
        Downloads file contents from OneDrive using the '@microsoft.graph.downloadurl' property.
        token : OneDrive auth token
        file_path : absolute path to file, example : test/test/test.txt 
    
        ======================================= IMPORTANT INFORMATION ABOUT THE ONEDRIVE API =============================================================
            Downloads file contents by :
                1) Downloading files meta-data, which includes '@microsoft.graph.downloadUrl' property
                    The '@microsoft.graph.downloadUrl' provides a temporary authenticated url to download the file contents
                2) Using the temporary url download file contents
                    When using the '@microsoft.graph.downloadurl' property DO NOT send any any Authorisation headers. 
                        Sending Authorisation headers will cause a :
                        1) CORS error when requesting from client
                        2) 404 error when requesting from server
                    For more information look at https://github.com/microsoftgraph/microsoft-graph-docs/issues/43
    
            OneDrive API provides a second way to download file contents, using the /content endpoint. Using the /content point client-side
            will always cause a CORS issue. The /content endpoint returns 302 response redirecting to a temporary pre-authenticated url 
            (the same url as '@microsoft.graph.downloadUrl')
        
            For more information look at https://docs.microsoft.com/en-gb/onedrive/developer/rest-api/api/driveitem_get_content?view=odsp-graph-online
        ===================================================================================================================================================
    */
    function download_folder(token, file_path) {
      return new Promise(function (resolve, reject) {
        donwload_metadata(token, file_path).then(function (result) {
          var response = JSON.parse(result[1]);
          return response;
        }).then(function (result) {
          download_contents(result["@microsoft.graph.downloadUrl"]).then(function (result) {
            resolve(result);
          })
        }).catch(function (error) {
          reject(error);
        })
      });

    }

    // Downloads meta-data for a specific file
    // token : OneDrive auth token
    // file_path : absolute path to file, example : test/test/test.txt 
    function donwload_metadata(token, file_path) {
      return new Promise(function (resolve, reject) {
        var URI = "https://graph.microsoft.com/v1.0/me/drive/root:/" + file_path;

        var metaData_request = new XMLHttpRequest();

        metaData_request.onreadystatechange = function () {
          if (this.readyState == 4) {
            if (this.status == 200) {
              resolve([this.status, metaData_request.responseText]);
            } else {
              reject([this.status, metaData_request.responseText]);
            }
          }
        };
        metaData_request.open("GET", URI, true);
        metaData_request.setRequestHeader("Authorization", "bearer " + token);
        metaData_request.send();
      });

    }

    // Downloads file contents
    // download_uri : temporary authenticated uri for a file (retrieved from file meta data)  
    function download_contents(download_uri) {
      return new Promise(function (resolve, reject) {
        var download_request = new XMLHttpRequest();
        download_request.onreadystatechange = function () {
          if (this.readyState == 4) {
            if (this.status == 200) {
              resolve([this.status, download_request.responseText]);
            } else {
              reject([this.status, download_request.responseText]);
            }
          }
        }
        download_request.open("GET", download_uri, true);
        download_request.send();
      });
    }


    // Stores session token when user is authenticated into OneDrive
    // See odauthService.js
    $window.onAuthenticated = function (token, authWindow) {
      if (token) {
        authWindow.close();
        this.console.log("token : ", token);
        store_session(token);
      }
    }

    // Checks if user is authenticated
    // Returns true if authenticated, false if not
    function is_authenticated() {
      var expiresAt = JSON.parse(localStorage.getItem('oneDriveExpiresAt'));
      return new Date().getTime() < expiresAt;
    }

    // Store session token into local storage and token expiration time
    // token : OneDrive auth token
    function store_session(token) {
      var expiresAt = JSON.stringify(3600 * 1000 + new Date().getTime());
      localStorage.setItem("oneDriveExpiresAt", expiresAt);
      localStorage.setItem("oneDriveToken", token);
    }



  }











  //Odauth Service
  app.service('odauthService', odauthControl);

  odauthControl.$inject = ['$window'];

  function odauthControl($window) {
    var vm = angular.extend(this, {

    });


    /*
   This is a modified library, for original goto  https://github.com/tmathew1000/OneDriveWebPicker/blob/c371f9970153e3f8484a8001c017733644d5dc70/OneDriveWebPicker/odauth.js
  
   =====================================INSTRUCTIONS=======================================
   Host a copy of callback.html and odauthService.js on your domain.
  
   Before requesting authentication you must provide authorisation information.
   Call provideAppInfo(appInfo) passing appInfo.
  
    appInfoStructure = {
      "clientId" : "clientId_from_graph_account"
      "redirectUri" : "example_redirect_uri"
      "scopes" : "example_scopes"
      "authServiceUri" : "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
    }
  =========================================================================================
  
  
    
  ========================================HOW IT WORKS=============================================
    When challengeForAuth() is called a pop up a window and send the user to Microsoft Account 
    so that they can sign in or grant your app the permissions it needs. When the user finishes the
    auth flow, the popup window redirects back to your hosted callback.html file,
    which calls the onAuthCallback() method below. It extracts the auth token
    and calls your app's onAuthenticated() function, passing in the 'window'
    and token arguments for the popup window. Your onAuthenticated function should close the
    popup window.
  =================================================================================================
  
  */


    // for added security we require https
    function ensureHttps() {
      if ($window.location.protocol != "https:") {
        $window.location.href = "https:" + $window.location.href.substring($window.location.protocol.length);
      }
    }

    // Called when user finishes the OneDrive auth flow
    // Calls the onAuthenticated() function passing in the 'window' and
    // token arguments
    vm.onAuthCallback = function () {
      console.log('callback');
      var authInfo = getAuthInfoFromUrl();
      var token = authInfo["access_token"];
      $window.opener.onAuthenticated(token, $window);
    }

    // Extracts the auth token from URL
    function getAuthInfoFromUrl() {
      if ($window.location.hash) {
        var authResponse = $window.location.hash.substring(1);
        var authInfo = JSON.parse(
          '{"' + authResponse.replace(/&/g, '","').replace(/=/g, '":"') + '"}',
          function (key, value) { return key === "" ? value : decodeURIComponent(value); });
        return authInfo;
      }
      else {
        alert("failed to receive auth token");
      }
    }



    var storedAppInfo = null;

    // Stores appInfo
    vm.provideAppInfo = function (appInfo) {

      if (!appInfo.hasOwnProperty("clientId")) {
        alert("clientId was is not defined");
        return;
      }
      if (!appInfo.hasOwnProperty("redirectUri")) {
        alert("redirectUri was is not defined");
        return;
      }
      if (!appInfo.hasOwnProperty("scopes")) {
        alert("scopes was is not defined");
        return;
      }
      if (!appInfo.hasOwnProperty("authServiceUri")) {
        alert("authServiceUri was is not defined");
        return;
      }

      storedAppInfo = appInfo;
    }

    function getAppInfo() {

      if (storedAppInfo) {
        return storedAppInfo;
      }

      alert("No AppInfo was provided, make sure provedAppInfo() was called");
    }


    // Attempts a OneDrive Login, opening a new window prompting user to login into
    // OneDrive. 
    self.challengeForAuth = function () {
      var appInfo = getAppInfo();
      var url =
        appInfo.authServiceUri +
        "?client_id=" + appInfo.clientId +
        "&scope=" + encodeURIComponent(appInfo.scopes) +
        "&response_type=token" +
        "&redirect_uri=" + encodeURIComponent(appInfo.redirectUri);
      popup(url);
    }

    function popup(url) {
      var width = 525,
        height = 525,
        screenX = $window.screenX,
        screenY = $window.screenY,
        outerWidth = $window.outerWidth,
        outerHeight = $window.outerHeight;

      var left = screenX + Math.max(outerWidth - width, 0) / 2;
      var top = screenY + Math.max(outerHeight - height, 0) / 2;

      var features = [
        "width=" + width,
        "height=" + height,
        "top=" + top,
        "left=" + left,
        "status=no",
        "resizable=yes",
        "toolbar=no",
        "menubar=no",
        "scrollbars=yes"];
      var popup = $window.open(url, "oauth", features.join(","));
      if (!popup) {
        alert("failed to pop up auth window");
      }

      popup.focus();
    }

  }



})();