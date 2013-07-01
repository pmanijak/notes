'use strict';

angular.module('notes.controllers', []).
	controller('MainCtrl', function ($scope, $location, $http) {

		$scope.isThereUnsavedData = false;
		$scope.isSaving = false;

		var getNoteDataLocation = function() {
			return '/data' + $location.path();
		}

		var saveNoteData = function () {
			if ($scope.isThereUnsavedData) {
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

		var init = function () {
			$scope.path = $location.path();

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
