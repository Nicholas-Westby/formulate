namespace Formulate.BackOffice.Api.Controllers.Tree
{
    using System;
    using System.Collections.Generic;
    using Asp.Versioning;
    using Formulate.BackOffice.Api.Filters;
    using Formulate.BackOffice.Api.Models.Tree;
    using Formulate.BackOffice.Api.Services;
    using Microsoft.AspNetCore.Http;
    using Microsoft.AspNetCore.Mvc;
    using Umbraco.Cms.Api.Common.Builders;
    using Umbraco.Cms.Api.Common.ViewModels.Pagination;
    using Umbraco.Cms.Api.Management.Routing;

    /// <summary>
    /// Lists the items of the Forms, Data Values and Validations trees.
    /// </summary>
    /// <remarks>
    /// Content pickers use the listing endpoints, so those need back office access only, not the Formulate
    /// section. Create options are an editing aid, so that endpoint requires the section.
    /// </remarks>
    [ApiVersion("1.0")]
    [VersionedApiBackOfficeRoute("formulate/tree")]
    [ApiExplorerSettings(GroupName = "Tree")]
    public sealed class FormulateTreeController : FormulateApiControllerBase
    {
        private readonly IFormulateTreeService _treeService;

        private readonly ICreateOptionsApiService _createOptionsService;

        /// <inheritdoc cref="FormulateTreeController"/>
        public FormulateTreeController(IFormulateTreeService treeService, ICreateOptionsApiService createOptionsService)
        {
            _treeService = treeService;
            _createOptionsService = createOptionsService;
        }

        /// <summary>
        /// Gets the items at the top of a tree.
        /// </summary>
        /// <param name="treeAlias">One of forms, data-values or validations.</param>
        /// <param name="skip">The number of items to skip.</param>
        /// <param name="take">The number of items to return.</param>
        /// <param name="foldersOnly">True to list folders only.</param>
        [HttpGet("{treeAlias}/root")]
        [ProducesResponseType<PagedViewModel<FormulateTreeItemResponseModel>>(StatusCodes.Status200OK)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
        public IActionResult Root(string treeAlias, int skip = 0, int take = 100, bool foldersOnly = false)
        {
            var result = _treeService.GetRoot(treeAlias, foldersOnly, skip, take);

            return ToActionResult(result, treeAlias);
        }

        /// <summary>
        /// Gets the children of an item.
        /// </summary>
        /// <param name="treeAlias">One of forms, data-values or validations.</param>
        /// <param name="parentId">The parent's ID.</param>
        /// <param name="skip">The number of items to skip.</param>
        /// <param name="take">The number of items to return.</param>
        /// <param name="foldersOnly">True to list folders only.</param>
        [HttpGet("{treeAlias}/children")]
        [ProducesResponseType<PagedViewModel<FormulateTreeItemResponseModel>>(StatusCodes.Status200OK)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public IActionResult Children(string treeAlias, Guid parentId, int skip = 0, int take = 100, bool foldersOnly = false)
        {
            var result = _treeService.GetChildren(treeAlias, parentId, foldersOnly, skip, take);

            return ToActionResult(result, treeAlias);
        }

        /// <summary>
        /// Gets an item and its ancestors, root-most first, ending with the item.
        /// </summary>
        /// <param name="treeAlias">One of forms, data-values or validations.</param>
        /// <param name="descendantId">The item's ID.</param>
        [HttpGet("{treeAlias}/ancestors")]
        [ProducesResponseType<IEnumerable<FormulateTreeItemResponseModel>>(StatusCodes.Status200OK)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public IActionResult Ancestors(string treeAlias, Guid descendantId)
        {
            var result = _treeService.GetAncestors(treeAlias, descendantId);

            return ToActionResult(result, treeAlias);
        }

        /// <summary>
        /// Gets what can be created under a place in a tree.
        /// </summary>
        /// <param name="treeAlias">One of forms, data-values or validations.</param>
        /// <param name="parentId">The ID of the folder or form to create under; leave out for the top of the tree.</param>
        [HttpGet("{treeAlias}/create-options")]
        [RequireFormulateSection]
        [ProducesResponseType<IEnumerable<CreateOptionModel>>(StatusCodes.Status200OK)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public IActionResult CreateOptions(string treeAlias, Guid? parentId = null)
        {
            var result = _createOptionsService.GetCreateOptions(treeAlias, parentId);

            return result.Status == ServiceStatus.Success ? Ok(result.Value) : ProblemFor(result);
        }

        private IActionResult ToActionResult<T>(FormulateTreeResult<T> result, string treeAlias)
        {
            switch (result.Status)
            {
                case FormulateTreeStatus.Success:
                    return Ok(result.Value);

                case FormulateTreeStatus.UnknownTree:
                    return BadRequest(new ProblemDetailsBuilder()
                        .WithTitle("Unknown tree")
                        .WithDetail($"'{treeAlias}' is not a Formulate tree. Use forms, data-values or validations.")
                        .Build());

                default:
                    return NotFound(new ProblemDetailsBuilder()
                        .WithTitle("Item not found")
                        .WithDetail($"The item does not exist in the {treeAlias} tree.")
                        .Build());
            }
        }
    }
}
