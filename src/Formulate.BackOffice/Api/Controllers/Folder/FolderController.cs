namespace Formulate.BackOffice.Api.Controllers.Folder
{
    using System;
    using Asp.Versioning;
    using Formulate.BackOffice.Api.Filters;
    using Formulate.BackOffice.Api.Models.Folder;
    using Formulate.BackOffice.Api.Models.Shared;
    using Formulate.BackOffice.Api.Services;
    using Formulate.Core.Folders;
    using Microsoft.AspNetCore.Http;
    using Microsoft.AspNetCore.Mvc;
    using Umbraco.Cms.Api.Management.Routing;

    /// <summary>
    /// Creates, reads, changes, moves and deletes folders.
    /// </summary>
    [ApiVersion("1.0")]
    [VersionedApiBackOfficeRoute("formulate/folder")]
    [ApiExplorerSettings(GroupName = "Folder")]
    [RequireFormulateSection]
    public sealed class FolderController : FormulateApiControllerBase
    {
        private readonly IFolderApiService _service;

        private readonly IMoveService _moveService;

        /// <inheritdoc cref="FolderController"/>
        public FolderController(IFolderApiService service, IMoveService moveService)
        {
            _service = service;
            _moveService = moveService;
        }

        /// <summary>
        /// Gets a folder.
        /// </summary>
        /// <param name="id">The ID.</param>
        [HttpGet("{id:guid}")]
        [ProducesResponseType<FolderResponseModel>(StatusCodes.Status200OK)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public IActionResult ById(Guid id)
        {
            var result = _service.Get(id);

            return result.Status == ServiceStatus.Success ? Ok(result.Value) : ProblemFor(result);
        }

        /// <summary>
        /// Creates a folder.
        /// </summary>
        /// <param name="request">The new item.</param>
        [HttpPost]
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
        public IActionResult Create(CreateFolderRequestModel request)
        {
            var result = _service.Create(request);

            return result.Status == ServiceStatus.Success
                ? CreatedAtId<FolderController>(controller => nameof(controller.ById), result.Value!.Id)
                : ProblemFor(result);
        }

        /// <summary>
        /// Replaces a folder's content.
        /// </summary>
        /// <param name="id">The ID.</param>
        /// <param name="request">The new content.</param>
        [HttpPut("{id:guid}")]
        [ProducesResponseType<FolderResponseModel>(StatusCodes.Status200OK)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public IActionResult Update(Guid id, UpdateFolderRequestModel request)
        {
            var result = _service.Update(id, request);

            return result.Status == ServiceStatus.Success ? Ok(result.Value) : ProblemFor(result);
        }

        /// <summary>
        /// Deletes a folder.
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
        /// Moves a folder into a folder of its own tree.
        /// </summary>
        /// <param name="id">The ID.</param>
        /// <param name="request">Where to move to.</param>
        [HttpPut("{id:guid}/move")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public IActionResult Move(Guid id, MoveRequestModel request)
        {
            var result = _moveService.Move<PersistedFolder>(id, request.TargetId);

            return result.Status == ServiceStatus.Success ? Ok() : ProblemFor(result);
        }
    }
}
