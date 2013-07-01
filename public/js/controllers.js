'use strict';

/* Controllers */

angular.module('notes.controllers', []).
  controller('MainCtrl', function ($scope, $location, $http) {

    var isDataDirty = false;

    var syncNoteData = function () {
      if (isDataDirty) {
        isDataDirty = false;

        var data = {};
        data.note = $scope.noteData;

        $http.put('/data' + $location.path(), data)
        .success(function (data, status, headers, config) {
          console.log(data);
        }).
        error(function (data, status, headers, config) {
          console.log(data);
        });
      }
    };

    var init = function () {
      $scope.path = $location.path();

      $http({
        method: 'GET',
        url: '/data' + $location.path()
      }).
      success(function (data, status, headers, config) {
        if (status === 200) {
          $scope.noteData = data;
        }
        else {
          $scope.noteData = "";
        }
        
      }).
      error(function (data, status, headers, config) {
        console.log(data);
      });

      $scope.$watch('noteData', function (val, oldval) {
        isDataDirty = true;
      }, true);

      var twoSeconds = 2 * 1000;
      setInterval(syncNoteData, twoSeconds);
    };

    init();
  });
