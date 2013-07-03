'use strict';

angular.module('notes.controllers', []).
	controller('HeadCtrl', function ($scope, $location, $route) {
		$scope.path = $location.path();

		$scope.$on('$routeChangeStart', function () {
			$scope.path = $location.path();
		});
	}).
	controller('MainCtrl', function ($scope, $location, $http, $window) {

		$scope.noteList = [];
		$scope.isThereUnsavedData = false;
		$scope.isSaving = false;
		$scope.isUsingNoteArea = false;

		var path = $scope.path = $location.path();
		// If path already ends in /, don't add another one.
		if (path[path.length-1] === '/') {
			if (path === '/') {
				$scope.base = '';
				$scope.isAtRoot = true;
			}
			else {
				$scope.base = path;
				$scope.isAtRoot = false;
			}
		}
		else {
			$scope.base = path + '/';
		}
		
		var getNoteDataLocation = function() {
			return '/data' + $location.path();
		};

		var getNoteListLocation = function() {
			return '/notes-at' + $location.path();
		};

		var saveNoteData = function () {

			if ($scope.isThereUnsavedData) {
				if (path !== $location.path()) {
					// Stop invalid requests that can happen
					// when we're navigating quickly.
					$scope.isThereUnsavedData = false;
					return;
				}

				$scope.isThereUnsavedData = false;
				$scope.isSaving = true;

				var data = {};
				data.note = $scope.noteData;

				$http.put(getNoteDataLocation(), data)
				.success(function (data, status, headers, config) {
					console.log(data);
					$scope.isSaving = false;
				}).
				error(function (data, status, headers, config) {
					console.log(data);
					$scope.isSaving = false;
				});
			}
		};

		$window.onresize = function () {
			// This is defined in our ace-editor directive.
			// A hack, yes.
			if ($scope.resizeEditor) {
				$scope.resizeEditor();
			}
		};

		$scope.mouseEnterNoteArea = function() {
			$scope.isUsingNoteArea = true;
		};

		$scope.mouseLeaveNoteArea = function() {
			$scope.isUsingNoteArea = false;
		};

		$scope.webUrlClicked = function (url) {
			// Web urls are probably not on our server
			$window.location.href = url;
		};

		$scope.noteUrlClicked = function (url) {
			// Note urls start with /// or ---, so just chop
			// them off and navigate.
			var noteUrlPrefix = "///";
			var altNoteUrlPrefix = "---";

			if (url.indexOf(noteUrlPrefix) === 0
			|| url.indexOf(altNoteUrlPrefix) === 0) {
				var destination = url.slice(noteUrlPrefix.length);
				$location.path(destination);
			}
		}

		var init = function () {
			$http.get(getNoteDataLocation())
			.success(function (data, status, headers, config) {
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


			$http.get(getNoteListLocation())
			.success(function (data, status, headers, config) {
				if (status === 200) {
					$scope.noteList = data;
				}
				else {
					$scope.noteList = [];
				}
			}).
			error(function (data, status, headers, config) {
				console.log(data);
			});


			$scope.$watch('noteData', function (val, oldval) {
				if (oldval) {
					$scope.isThereUnsavedData = true;
				}
			}, true);

			var twoSeconds = 2 * 1000;
			setInterval(saveNoteData, twoSeconds);
		};

		init();
	});
