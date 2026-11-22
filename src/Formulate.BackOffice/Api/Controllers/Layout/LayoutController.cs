namespace Formulate.BackOffice.Api.Controllers.Layout
{
    using System;
    using Asp.Versioning;
    using Formulate.BackOffice.Api.Filters;
    using Formulate.BackOffice.Api.Models.Layout;
    using Formulate.BackOffice.Api.Models.Shared;
    using Formulate.BackOffice.Api.Services;
    using Microsoft.AspNetCore.Http;
    using Microsoft.AspNetCore.Mvc;
    using Umbraco.Cms.Api.Management.Routing;

    /// <summary>
    /// Creates, reads, changes and deletes a form's layouts.
    /// </summary>
    [ApiVersion("1.0")]
    [VersionedApiBackOfficeRoute("formulate/layout")]
    [ApiExplorerSettings(GroupName = "Layout")]
    [RequireFormulateSection]
    public sealed class LayoutController : FormulateApiControllerBase
    {
        private readonly ILayoutApiService _layoutService;

        /// <inheritdoc cref="LayoutController"/>
        public LayoutController(ILayoutApiService layoutService)
        {
            _layoutService = layoutService;
        }

        /// <summary>
        /// Gets a layout.
        /// </summary>
        /// <param name="id">The layout's ID.</param>
        [HttpGet("{id:guid}")]
        [ProducesResponseType<LayoutResponseModel>(StatusCodes.Status200OK)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public IActionResult ById(Guid id)
        {
            var result = _layoutService.Get(id);

            return result.Status == ServiceStatus.Success ? Ok(result.Value) : ProblemFor(result);
        }

        /// <summary>
        /// Creates a layout on a form.
        /// </summary>
        /// <param name="request">The layout.</param>
        [HttpPost]
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
        public IActionResult Create(CreateLayoutRequestModel request)
        {
            var result = _layoutService.Create(request);

            return result.Status == ServiceStatus.Success
                ? CreatedAtId<LayoutController>(controller => nameof(controller.ById), result.Value!.Id)
                : ProblemFor(result);
        }

        /// <summary>
        /// Replaces a layout's name, alias, template and configuration.
        /// </summary>
        /// <param name="id">The layout's ID.</param>
        /// <param name="request">The new content.</param>
        [HttpPut("{id:guid}")]
        [ProducesResponseType<LayoutResponseModel>(StatusCodes.Status200OK)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public IActionResult Update(Guid id, UpdateLayoutRequestModel request)
        {
            var result = _layoutService.Update(id, request);

            return result.Status == ServiceStatus.Success ? Ok(result.Value) : ProblemFor(result);
        }

        /// <summary>
        /// Deletes a layout.
        /// </summary>
        /// <param name="id">The layout's ID.</param>
        [HttpDelete("{id:guid}")]
        [ProducesResponseType<DeleteResponseModel>(StatusCodes.Status200OK)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public IActionResult Delete(Guid id)
        {
            var result = _layoutService.Delete(id);

            return result.Status == ServiceStatus.Success ? Ok(result.Value) : ProblemFor(result);
        }
    }
}
