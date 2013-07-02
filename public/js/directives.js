'use strict';

/* Directives */

angular.module('notes.directives', []).
  directive('appVersion', function (version) {
    return function(scope, elm, attrs) {
      elm.text(version);
    };
  })
  .directive("aceEditor", [
  function() {
    var Editor, Renderer;
    Editor = ace.require("ace/editor").Editor;
    Renderer = ace.require("ace/virtual_renderer").VirtualRenderer;
    return {
      restrict: "EA",
      require: "ngModel",
      replace: true,
      template: "<div class=\"ace-container\"></div>",

      link: function($scope, $el, attrs, model) {
        var editor, session, updateViewValue;
        editor = new Editor(new Renderer($el[0], "ace/theme/textmate"));

        var renderer = editor.renderer;
        renderer.setShowGutter(false);
        renderer.setShowPrintMargin(false);

        session = editor.getSession();

        model.$render = function() {
          return session.setValue(model.$modelValue);
        };

        var updateViewValue = function() {
          if (!$scope.$$phase) {
            return $scope.$apply(function() {
              return model.$setViewValue(session.getValue());
            });
          };
        };

        session.on("change", updateViewValue);
        return $scope.$on("$destroy", function() {
          return editor.removeListener("change", updateViewValue);
        });
      }
    };
  }
]);
;
