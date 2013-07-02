'use strict';

/* Directives */

angular.module('notes.directives', []).
directive('appVersion', function (version) {
	return function(scope, elm, attrs) {
		elm.text(version);
	};
})
.directive("aceEditor", [
function ($location) {

	// Define a mode for us to use, with some text-highlighting rules
	// for finding URLs.
	//
	// Ace doc on how to define a mode: 
	// https://github.com/ajaxorg/ace/wiki/Creating-or-Extending-an-Edit-Mode
	ace.define('ace/mode/notes', function (require, exports, module) {

		var oop = ace.require("ace/lib/oop");
		var TextMode = ace.require("ace/mode/text").Mode;
		var Tokenizer = ace.require("ace/tokenizer").Tokenizer;
		var NotesHighlightRules = ace.require("ace/mode/notes_highlight_rules").NotesHighlightRules;

		var Mode = function() {
			this.$tokenizer = new Tokenizer(new NotesHighlightRules().getRules());
		};
		oop.inherits(Mode, TextMode);

		(function() {
			// Extra logic goes here.
		}).call(Mode.prototype);

		exports.Mode = Mode;
	});

	ace.define('ace/mode/notes_highlight_rules', function (require, exports, module) {

		var oop = ace.require("ace/lib/oop");
		var TextHighlightRules = ace.require("ace/mode/text_highlight_rules").TextHighlightRules;

		var NotesHighlightRules = function() {
			// We got this regex from Matthew O'Riordan, here:
			// http://mattheworiordan.tumblr.com/post/13174566389/url-regular-expression-for-links-with-or-without-the
			this.$rules = {
				"start" : [
					{
						token : "url", 
						regex: /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-]*)?\??(?:[\-\+=&;%@\.\w]*)#?(?:[\.\!\/\\\w]*))?)/
					},
					{
						caseInsensitive: true
					}
				]
			};
		}

		oop.inherits(NotesHighlightRules, TextHighlightRules);
		exports.NotesHighlightRules = NotesHighlightRules;
	});

	var Editor, Renderer;
	Editor = ace.require("ace/editor").Editor;
	Renderer = ace.require("ace/virtual_renderer").VirtualRenderer;
	return {
	  restrict: "EA",
	  require: "ngModel",
	  replace: true,
	  template: "<div class=\"ace-container\"></div>",

	  // TODO: The height of the ace-container doesn't change
	  // when the window is resized. This would be nice to fix.
	  link: function($scope, $el, attrs, model) {
		var editor, session, updateViewValue;
		
		editor = new Editor(new Renderer($el[0], "ace/theme/textmate"));
		editor.setHighlightActiveLine(false);

		var renderer = editor.renderer;
		renderer.setShowGutter(false);
		renderer.setShowPrintMargin(false);

		session = editor.getSession();
		session.setMode('ace/mode/notes');

		// The Ace editor prevents the default click actions from occurring, 
		// so we have to actively handle them, here.
		editor.on("click", function (e) {
			var position = e.getDocumentPosition();
			var token = session.getTokenAt(position.row, position.column);
			
			// Tell our controller that someone clicked a url.
			if (token && token.type === "url") {
				$scope.urlClicked(token.value);
			}
		});


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
