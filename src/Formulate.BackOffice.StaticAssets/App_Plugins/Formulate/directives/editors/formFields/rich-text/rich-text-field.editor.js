﻿// Variables.
var app = angular.module("umbraco");

// Associate directive.
app.directive("formulateRichTextField", directive);

// Controller.
function Controller($scope) {
    // Configure rich text editor model.
    $scope.textEditorModel = {
        editor: "Umbraco.TinyMCE",
        view: "rte",
        alias: "rich-text",
        config: {
            editor: {
                toolbar: [
                    "ace",
                    "removeformat",
                    "bold",
                    "italic",
                    "underline",
                    "strikethrough",
                    "alignleft",
                    "aligncenter",
                    "alignright",
                    "alignjustify",
                    "bullist",
                    "numlist",
                    "outdent",
                    "indent",
                    "link",
                    "unlink",
                    "anchor",
                    "table",
                    "hr"
                ],
                stylesheets: [],
                maxImageSize: 500,
                dimensions: {
                    height: 250
                }
            }
        },
        value: $scope.configuration.text
    };

    // Update the text value when the rich text editor model changes.
    $scope.$watch("textEditorModel.value", function () {
        $scope.configuration.text = $scope.textEditorModel.value;
    });

}

// Directive.
function directive() {
    return {
        restrict: "E",
        controller: Controller,
        replace: true,
        templateUrl: "/app_plugins/formulate/directives/editors/formFields/rich-text/rich-text-field.editor.html",
        scope: {
            configuration: "="
        }
    };
}