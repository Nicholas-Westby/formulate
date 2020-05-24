---
layout: page
title: Rendering a Form in Formulate
---

# Form Rendering

Once you've gone through the trouble of installing Formulate, creating a form, and modifying a document type to pick a form, the final step is to render that form to HTML on your website.

You can render your picked form like this (this assumes the form picker property is called "myFormPicker"):

```csharp
@using formulate.app.Types
@inherits Umbraco.Web.Mvc.UmbracoTemplatePage
@{

    // Boilerplate.
    Layout = null;

    // Get a view model for the picked form.
    var pickedForm = Model.Content.GetPropertyValue<ConfiguredFormInfo>("myFormPicker");
    var vm = formulate.api.Rendering.GetFormViewModel(pickedForm.FormId, pickedForm.LayoutId,
        pickedForm.TemplateId,
        // Include this parameter in Formulate 0.3.7 or greater.
        Model.Content);

}<!doctype html>

<html>
<head>
    <title>Formulate Example</title>

    <!-- Include the CSS/JavaScript for jQuery, Bootstrap, Lodash, and AngularJS. -->
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.6/css/bootstrap.min.css" />
    <script src="https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.5.1/lodash.min.js"></script>
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/2.1.4/jquery.min.js"></script>
    <script src="https://ajax.googleapis.com/ajax/libs/angularjs/1.4.8/angular.min.js"></script>
    <script src="https://ajax.googleapis.com/ajax/libs/angularjs/1.4.8/angular-messages.min.js"></script>

    <!-- The Formulate JavaScript for the Responsive / AngularJS / Bootstrap form template. -->
    <script src="/App_Plugins/formulate/responsive.bootstrap.angular.js"></script>

    <!-- This is some AngularJS JavaScript specific to your application. -->
    <script>

        // Include Formulate as a dependency.
        var app = angular.module("app", ["formulate"]);

        // Create a controller to handle form submissions.
        app.controller("formWrapper", function ($scope) {
            $scope.status = "pending";
            $scope.$on("Formulate.formSubmit.OK", function () {
                $scope.status = "success";
            });
            $scope.$on("Formulate.formSubmit.Failed", function () {
                $scope.status = "failure";
            });
        });

    </script>

</head>
<body ng-app="app">

    <!-- Handle the display of the form, the success message, and the error message. -->
    <div ng-controller="formWrapper">

        <!-- Display the form. -->
        <div ng-if="status !== 'success'">
            <div class="container">
                @Html.Partial("~/Views/Partials/Formulate/RenderForm.cshtml", vm)
            </div>
        </div>

        <!-- Display the success message. -->
        <div ng-if="status === 'success'">
            Your request has been received!
        </div>

        <!-- Display the error message. -->
        <div ng-if="status === 'failure'">
            Unable to submit request. Please try again.
        </div>

    </div>

</body>
</html>
```

All you need to do is copy the above code into a CSHTML file on a page with a picked form on a property with the appropriate alias, and you will have a rendered form.

You can of course integrate it with your site in a number of ways, but this is the simplest version.

If you are interested in minified or modular JavaScript, read further about that [here](/angularjs/include-javascript-rba).