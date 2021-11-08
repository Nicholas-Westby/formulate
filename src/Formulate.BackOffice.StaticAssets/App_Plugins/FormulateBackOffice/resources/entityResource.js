﻿(function () {
    var resource = function ($http, umbRequestHelper) {
        var serverVars = Umbraco.Sys.ServerVariables.formulate;

        function performGetOrScaffold(options) {
            var isNew = options.create === "true" && options.entityType;
            var hasId = options.id && options.id !== "-1";
            var hasDefinitionId = options.definitionId && options.definitionId.length > 0;
            var url;

            // replace with resource calls
            if (isNew) {
                url = serverVars[`${options.treeType}.GetScaffolding`] + "?entityType=" + options.entityType;

                if (hasId) {
                    url += `&parentId=${options.id}`;
                }

                if (hasDefinitionId) {
                    url += `&definitionId=${options.definitionId}`;
                }
            } else {
                url = serverVars[`${options.treeType}.Get`];

                if (hasId) {
                    url += `?id=${options.id}`;
                }
            }

            return $http.get(url);
        }

        function performDelete(options) {
            var url = serverVars[`${options.treeType}.Delete`] + "?id=" + options.id;

            return $http.get(url);
        }

        function performMove(options) {
            var request = {
                entityId: options.entityId,
                treeType: options.treeType
            }

            if (options.parentId && options.parentId !== "-1") {
                request.parentId = options.parentId;
            }

            var url = serverVars[`${options.treeType}.Move`];

            return umbRequestHelper.resourcePromise($http.post(url, request), "Unable to move item.");
        }

        return {
            getOrScaffold: performGetOrScaffold,
            delete: performDelete,
            move: performMove
        };
    };

    angular.module("umbraco").factory("formulateEntityResource", resource);
})();