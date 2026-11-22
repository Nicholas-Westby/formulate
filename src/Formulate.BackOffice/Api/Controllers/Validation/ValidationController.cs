namespace Formulate.BackOffice.Api.Controllers.Validation
{
    using System;
    using Asp.Versioning;
    using Formulate.BackOffice.Api.Filters;
    using Formulate.BackOffice.Api.Models.Validation;
    using Formulate.BackOffice.Api.Models.Shared;
    using Formulate.BackOffice.Api.Services;
    using Formulate.Core.Validations;
    using Microsoft.AspNetCore.Http;
    using Microsoft.AspNetCore.Mvc;
    using Umbraco.Cms.Api.Management.Routing;

    /// <summary>
    /// Creates, reads, changes, moves and deletes validations.
    /// </summary>
    [ApiVersion("1.0")]
    [VersionedApiBackOfficeRoute("formulate/validation")]
    [ApiExplorerSettings(GroupName = "Validation")]
    [RequireFormulateSection]
    public sealed class ValidationController : FormulateApiControllerBase
    {
        private readonly IValidationApiService _service;

        private readonly IMoveService _moveService;

        /// <inheritdoc cref="ValidationController"/>
        public ValidationController(IValidationApiService service, IMoveService moveService)
        {
            _service = service;
            _moveService = moveService;
        }

        /// <summary>
        /// Gets a validation.
        /// </summary>
        /// <param name="id">The ID.</param>
        [HttpGet("{id:guid}")]
        [ProducesResponseType<ValidationResponseModel>(StatusCodes.Status200OK)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public IActionResult ById(Guid id)
        {
            var result = _service.Get(id);

            return result.Status == ServiceStatus.Success ? Ok(result.Value) : ProblemFor(result);
        }

        /// <summary>
        /// Creates a validation.
        /// </summary>
        /// <param name="request">The new item.</param>
        [HttpPost]
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
        public IActionResult Create(CreateValidationRequestModel request)
        {
            var result = _service.Create(request);

            return result.Status == ServiceStatus.Success
                ? CreatedAtId<ValidationController>(controller => nameof(controller.ById), result.Value!.Id)
                : ProblemFor(result);
        }

        /// <summary>
        /// Replaces a validation's content.
        /// </summary>
        /// <param name="id">The ID.</param>
        /// <param name="request">The new content.</param>
        [HttpPut("{id:guid}")]
        [ProducesResponseType<ValidationResponseModel>(StatusCodes.Status200OK)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public IActionResult Update(Guid id, UpdateValidationRequestModel request)
        {
            var result = _service.Update(id, request);

            return result.Status == ServiceStatus.Success ? Ok(result.Value) : ProblemFor(result);
        }

        /// <summary>
        /// Deletes a validation.
        /// </summary>
        /// <param name="id">The ID.</param>
        [HttpDelete("{id:guid}")]
        [ProducesResponseType<DeleteResponseModel>(StatusCodes.Status200OK)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public IActionResult Delete(Guid id)
        {
            var result = _service.Delete(id);

            return result.Status == ServiceStatus.Success ? Ok(result.Value) : ProblemFor(result);
        }

        /// <summary>
        /// Moves a validation into a folder of its own tree.
        /// </summary>
        /// <param name="id">The ID.</param>
        /// <param name="request">Where to move to.</param>
        [HttpPut("{id:guid}/move")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public IActionResult Move(Guid id, MoveRequestModel request)
        {
            // A missing body is refused, not read as a move to the top of the tree.
            if (request is null)
            {
                return ProblemFor(RequestBody.Missing<bool>());
            }

            var result = _moveService.Move<PersistedValidation>(id, request.TargetId);

            return result.Status == ServiceStatus.Success ? Ok() : ProblemFor(result);
        }
    }
}
