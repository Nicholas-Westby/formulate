﻿(function () {
    var controller = function ($scope, $routeParams, navigationService, notificationsService, formulateEntityResource) {
        var options = {
            create: $routeParams.create,
            entityType: $routeParams.entityType,
            treeType: "validations",
            id: $routeParams.id,
            kindId: $routeParams.kindId
        };

        $scope.loading = true;
        formulateEntityResource.getOrScaffold(options).then(
            function (data) {
                $scope.entity = data.entity;
                $scope.entityType = data.entityType;
                $scope.kindId = data.kindId;
                $scope.treeType = options.treeType;

                navigationService.syncTree({ tree: options.treeType, path: data.treePath, forceReload: true });

                $scope.loading = false;
            }, function (err) {
                notificationsService.error(err.errorMsg);
            });
    };

    angular.module("umbraco").controller("FormulateBackOffice.Validations.EditController", controller);
})();