'use strict';

angular.module('notes.controllers', []).
	controller('HeadCtrl', function ($scope, $location, $route) {
		$scope.path = $location.path();

		$scope.$on('$routeChangeStart', function () {
			$scope.path = $location.path();
		});
	}).
	controller('MainCtrl', function ($scope, $location, $http, $window) {

		$scope.noteData = "";
		$scope.noteList = [];
		$scope.isThereUnsavedData = false;
		$scope.isSaving = false;
		$scope.isUsingNoteArea = false;
		$scope.isAuthorized = true;
		$scope.isAuthRequired = false;
		$scope.isUnauthorized = false;

		var isMouseOverNoteArea, isUsingAuthArea = false;
		
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
			$scope.isAtRoot = false;
		}

		var getNoteDataLocation = function() {
			return '/_/data' + $location.path();
		};

		var getNoteListLocation = function() {
			return '/_/notes-at' + $location.path();
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
					$scope.isUnauthorized = false;
				}).
				error(function (data, status, headers, config) {
					$scope.isSaving = false;
					if (status === 401) {
						$scope.isUnauthorized = true;
					}
					else {
						console.log(data);
					}
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


		$scope.webUrlClicked = function (url) {
			// Web urls are probably not on our server
			$window.location.href = url;
		};

		$scope.noteUrlClicked = function (url) {
			// Note urls start with /, so just chop
			// off the prefix and navigate.
			var noteUrlPrefix = "/";
			var destination;

			if (url.indexOf(noteUrlPrefix) === 0) {
				destination = url.slice(noteUrlPrefix.length);
				$location.path(destination);
			}
		};

		var updateIsUsingNoteArea = function () {
			$scope.isUsingNoteArea = !isUsingAuthArea 
				&& isMouseOverNoteArea 
				&& !$scope.isUnauthorized;
		}

		$scope.$watch('isUnauthorized', function() {
			updateIsUsingNoteArea();
		});

		$scope.mouseEnterNoteArea = function() {
			isMouseOverNoteArea = true;
			updateIsUsingNoteArea();
		};

		$scope.mouseLeaveNoteArea = function() {
			isMouseOverNoteArea = false;
			updateIsUsingNoteArea();
		};


		var focusEditor = function() {
			if ($scope.focusEditor) {
				$scope.focusEditor();
			}
		};

		$scope.authSubmit = function () {
			var data = {
				authcode: $scope.authcode
			};
			$scope.authcode = "";

			$http.post('/_/auth', data)
			.success(function (data, status, headers, config) {
				$scope.isAuthorized = true;
				$scope.isUnauthorized = false;
				// Account for the situation where we've typed something
				// in, been denied, and then sign in.
				$scope.isThereUnsavedData = true;
				focusEditor();
			}).
			error(function (data, status, headers, config) {
				$scope.isAuthorized = false;
				$scope.isUnauthorized = true;
			});
		};

		$scope.authFocus = function() {
			isUsingAuthArea = true;
			updateIsUsingNoteArea();
		};

		$scope.authBlur = function () {
			isUsingAuthArea = false;
			$scope.setAuthFocus = false;
			updateIsUsingNoteArea();
		};

		$scope.pathClicked = function () {
			$scope.newPath = $scope.path;
			$scope.isEditingPath = true;
			$scope.setNewPathFocus = true;
		};

		$scope.editablePathSubmit = function () {
			$scope.isEditingPath = false;
			$scope.setNewPathFocus = false;
			$location.path($scope.newPath);
		};

		$scope.cancelNewPath = function () {
			console.log('ok');
			$scope.$apply(function() {
				$scope.isEditingPath = false;
				$scope.setNewPathFocus = false;
			});
		};

		var updatePermissions = function () {
			// UX: Focus on the text editor if we have permission
			// to write, otherwise focus on the authcode box.
			$http.get('/_/permissions')
			.success(function (data, status, headers, config) {
				var permissions = data;
				if (permissions.write) {
					$scope.isAuthorized = true;
					focusEditor();
				}
				else {
					$scope.isAuthorized = false;
					$scope.setAuthFocus = true;
				}
			});
		};

		$scope.signout = function () {
			$http.get("/_/signout")
			.success(function (data, status, headers, config) {
				updatePermissions(); // Refresh.
			})
		};

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

			$http.get('/_/auth-required')
			.success(function (data, status, headers, config) {
				if (data === "true") {
					$scope.isAuthRequired = true;
				}
				else {
					$scope.isAuthRequired = false;
				}
			});

			updatePermissions();

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
