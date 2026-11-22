namespace Formulate.BackOffice.Api.Controllers.Item
{
    using System;
    using System.Collections.Generic;
    using Asp.Versioning;
    using Formulate.BackOffice.Api.Models.Item;
    using Formulate.BackOffice.Api.Services;
    using Microsoft.AspNetCore.Http;
    using Microsoft.AspNetCore.Mvc;
    using Umbraco.Cms.Api.Management.Routing;

    /// <summary>
    /// Looks up Formulate items by ID, as content pickers need to show what is picked.
    /// </summary>
    /// <remarks>
    /// Content pickers use this endpoint, so it needs back office access only, not the Formulate section.
    /// </remarks>
    [ApiVersion("1.0")]
    [VersionedApiBackOfficeRoute("formulate/item")]
    [ApiExplorerSettings(GroupName = "Item")]
    public sealed class FormulateItemController : FormulateApiControllerBase
    {
        private readonly IFormulateTreeService _treeService;

        /// <inheritdoc cref="FormulateItemController"/>
        public FormulateItemController(IFormulateTreeService treeService)
        {
            _treeService = treeService;
        }

        /// <summary>
        /// Gets items from any tree, in the order requested. Unknown IDs are left out.
        /// </summary>
        /// <param name="id">The IDs of the items.</param>
        [HttpGet]
        [ProducesResponseType<IEnumerable<FormulateItemResponseModel>>(StatusCodes.Status200OK)]
        public IActionResult Items([FromQuery] Guid[]? id)
        {
            return Ok(_treeService.GetItems(id ?? Array.Empty<Guid>()));
        }
    }
}
