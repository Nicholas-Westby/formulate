namespace Formulate.Extensions.StoreData.Services
{
    using Formulate.BackOffice.Api.Services;
    using Formulate.Extensions.StoreData.Api.Models;
    using Umbraco.Cms.Api.Common.ViewModels.Pagination;

    /// <summary>
    /// Reads and deletes stored submissions.
    /// </summary>
    public interface ISubmissionQueryService
    {
        /// <summary>
        /// Gets a page of a form's submissions, newest first.
        /// </summary>
        ServiceResult<PagedViewModel<SubmissionResponseModel>> List(Guid formId, int skip, int take);

        /// <summary>
        /// Gets a submission.
        /// </summary>
        ServiceResult<SubmissionResponseModel> Get(Guid id);

        /// <summary>
        /// Deletes a submission and its files.
        /// </summary>
        ServiceResult<bool> Delete(Guid id);

        /// <summary>
        /// Finds an uploaded file. The name must be one stored for the submission and field.
        /// </summary>
        ServiceResult<SubmissionFileDownload> GetFile(Guid id, Guid fieldId, string? fileName);

        /// <summary>
        /// Gets all of a form's submissions as UTF-8 CSV with a byte order mark. The caller disposes the stream.
        /// </summary>
        /// <remarks>
        /// A form that was deleted still exports its stored submissions; one with no form and no
        /// submissions is not found.
        /// </remarks>
        ServiceResult<Stream> Export(Guid formId);
    }
}
