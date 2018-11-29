var app = angular.module('starter');

app.controller('CallbackController', callbackcontrol);

  callbackcontrol.$inject = ['odauthService'];

  function callbackcontrol(odauthService) {
    var vm = angular.extend(this, {})

    //automatically call onAuthCallback
    odauthService.onAuthCallback();
  }
