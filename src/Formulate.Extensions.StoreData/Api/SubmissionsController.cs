namespace Formulate.Extensions.StoreData.Api
{
    using System;
    using Asp.Versioning;
    using Formulate.BackOffice.Api;
    using Formulate.BackOffice.Api.Filters;
    using Formulate.BackOffice.Api.Services;
    using Formulate.Extensions.StoreData.Api.Models;
    using Formulate.Extensions.StoreData.Services;
    using Microsoft.AspNetCore.Http;
    using Microsoft.AspNetCore.Mvc;
    using Umbraco.Cms.Api.Common.ViewModels.Pagination;
    using Umbraco.Cms.Api.Management.Routing;

    /// <summary>
    /// Lists, reads, exports and deletes the submissions the Store Data handler stored.
    /// </summary>
    [ApiVersion("1.0")]
    [VersionedApiBackOfficeRoute("formulate/submission")]
    [ApiExplorerSettings(GroupName = "Submission")]
    [RequireFormulateSection]
    public sealed class SubmissionsController : FormulateApiControllerBase
    {
        private readonly ISubmissionQueryService _submissions;

        /// <inheritdoc cref="SubmissionsController"/>
        public SubmissionsController(ISubmissionQueryService submissions)
        {
            _submissions = submissions;
        }

        /// <summary>
        /// Gets a page of a form's submissions, newest first.
        /// </summary>
        /// <param name="formId">The form's ID.</param>
        /// <param name="skip">The number of submissions to skip.</param>
        /// <param name="take">The number of submissions to return, from 1 to 200.</param>
        [HttpGet]
        [ProducesResponseType<PagedViewModel<SubmissionResponseModel>>(StatusCodes.Status200OK)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
        public IActionResult List(Guid formId, int skip = 0, int take = 50)
        {
            var result = _submissions.List(formId, skip, take);

            return result.Status == ServiceStatus.Success ? Ok(result.Value) : ProblemFor(result);
        }

        /// <summary>
        /// Gets all of a form's submissions as a CSV file.
        /// </summary>
        /// <param name="formId">The form's ID.</param>
        [HttpGet("export")]
        [Produces("text/csv")]
        [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK, "text/csv")]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public IActionResult Export(Guid formId)
        {
            var result = _submissions.Export(formId);

            return result.Status == ServiceStatus.Success
                ? File(result.Value!, "text/csv; charset=utf-8", "submissions.csv")
                : ProblemFor(result);
        }

        /// <summary>
        /// Gets a submission.
        /// </summary>
        /// <param name="id">The submission's ID.</param>
        [HttpGet("{id:guid}")]
        [ProducesResponseType<SubmissionResponseModel>(StatusCodes.Status200OK)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public IActionResult ById(Guid id)
        {
            var result = _submissions.Get(id);

            return result.Status == ServiceStatus.Success ? Ok(result.Value) : ProblemFor(result);
        }

        /// <summary>
        /// Deletes a submission and its uploaded files.
        /// </summary>
        /// <param name="id">The submission's ID.</param>
        [HttpDelete("{id:guid}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public IActionResult Delete(Guid id)
        {
            var result = _submissions.Delete(id);

            return result.Status == ServiceStatus.Success ? Ok() : ProblemFor(result);
        }

        /// <summary>
        /// Downloads a file uploaded to a field of a submission.
        /// </summary>
        /// <param name="id">The submission's ID.</param>
        /// <param name="fieldId">The upload field's ID.</param>
        /// <param name="fileName">The stored name of the file, as listed on the submission.</param>
        [HttpGet("{id:guid}/file/{fieldId:guid}")]
        [ProducesResponseType(typeof(FileResult), StatusCodes.Status200OK, "application/octet-stream")]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public IActionResult DownloadFile(Guid id, Guid fieldId, string? fileName)
        {
            var result = _submissions.GetFile(id, fieldId, fileName);

            if (result.Status != ServiceStatus.Success)
            {
                return ProblemFor(result);
            }

            // Whatever the visitor uploaded is served as an opaque download, never rendered by the browser.
            Response.Headers["X-Content-Type-Options"] = "nosniff";

            return PhysicalFile(result.Value!.Path, "application/octet-stream", result.Value.FileName);
        }
    }
}
