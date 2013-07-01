'use strict';

// Declare app level module which depends on filters, and services

angular.module('notes', [
  'notes.controllers',
  'notes.filters',
  'notes.services',
  'notes.directives'
]).
config(function ($routeProvider, $locationProvider) {
  $routeProvider.
    otherwise({
      templateUrl: 'partials/main.html',
      controller: 'MainCtrl'
    });

  $locationProvider.html5Mode(true);
});
