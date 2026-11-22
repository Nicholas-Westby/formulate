namespace Formulate.BackOffice.Api.Controllers.Form
{
    using System;
    using Asp.Versioning;
    using Formulate.BackOffice.Api.Filters;
    using Formulate.BackOffice.Api.Models.Form;
    using Formulate.BackOffice.Api.Models.Shared;
    using Formulate.BackOffice.Api.Services;
    using Formulate.Core.Forms;
    using Microsoft.AspNetCore.Http;
    using Microsoft.AspNetCore.Mvc;
    using Umbraco.Cms.Api.Management.Routing;

    /// <summary>
    /// Creates, reads, changes, deletes, moves and duplicates forms.
    /// </summary>
    [ApiVersion("1.0")]
    [VersionedApiBackOfficeRoute("formulate/form")]
    [ApiExplorerSettings(GroupName = "Form")]
    [RequireFormulateSection]
    public sealed class FormController : FormulateApiControllerBase
    {
        private readonly IFormApiService _formService;

        private readonly IMoveService _moveService;

        /// <inheritdoc cref="FormController"/>
        public FormController(IFormApiService formService, IMoveService moveService)
        {
            _formService = formService;
            _moveService = moveService;
        }

        /// <summary>
        /// Gets a form.
        /// </summary>
        /// <param name="id">The form's ID.</param>
        [HttpGet("{id:guid}")]
        [ProducesResponseType<FormResponseModel>(StatusCodes.Status200OK)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public IActionResult ById(Guid id)
        {
            var result = _formService.Get(id);

            return result.Status == ServiceStatus.Success ? Ok(result.Value) : ProblemFor(result);
        }

        /// <summary>
        /// Creates a form.
        /// </summary>
        /// <param name="request">The form.</param>
        [HttpPost]
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
        public IActionResult Create(CreateFormRequestModel request)
        {
            var result = _formService.Create(request);

            return result.Status == ServiceStatus.Success
                ? CreatedAtId<FormController>(controller => nameof(controller.ById), result.Value!.Id)
                : ProblemFor(result);
        }

        /// <summary>
        /// Replaces a form's name, alias, fields and handlers.
        /// </summary>
        /// <param name="id">The form's ID.</param>
        /// <param name="request">The new content.</param>
        [HttpPut("{id:guid}")]
        [ProducesResponseType<FormResponseModel>(StatusCodes.Status200OK)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public IActionResult Update(Guid id, UpdateFormRequestModel request)
        {
            var result = _formService.Update(id, request);

            return result.Status == ServiceStatus.Success ? Ok(result.Value) : ProblemFor(result);
        }

        /// <summary>
        /// Deletes a form and its layouts.
        /// </summary>
        /// <param name="id">The form's ID.</param>
        [HttpDelete("{id:guid}")]
        [ProducesResponseType<DeleteResponseModel>(StatusCodes.Status200OK)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public IActionResult Delete(Guid id)
        {
            var result = _formService.Delete(id);

            return result.Status == ServiceStatus.Success ? Ok(result.Value) : ProblemFor(result);
        }

        /// <summary>
        /// Moves a form, with its layouts, into a folder of the Forms tree.
        /// </summary>
        /// <param name="id">The form's ID.</param>
        /// <param name="request">Where to move to.</param>
        [HttpPut("{id:guid}/move")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public IActionResult Move(Guid id, MoveRequestModel request)
        {
            var result = _moveService.Move<PersistedForm>(id, request.TargetId);

            return result.Status == ServiceStatus.Success ? Ok() : ProblemFor(result);
        }

        /// <summary>
        /// Copies a form, with its layouts.
        /// </summary>
        /// <param name="id">The form's ID.</param>
        /// <param name="request">Where to put the copy.</param>
        [HttpPost("{id:guid}/duplicate")]
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public IActionResult Duplicate(Guid id, DuplicateFormRequestModel request)
        {
            var result = _formService.Duplicate(id, request);

            return result.Status == ServiceStatus.Success
                ? CreatedAtId<FormController>(controller => nameof(controller.ById), result.Value!.Id)
                : ProblemFor(result);
        }
    }
}
