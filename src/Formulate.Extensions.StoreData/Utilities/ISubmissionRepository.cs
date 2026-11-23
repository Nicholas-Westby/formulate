namespace Formulate.Extensions.StoreData.Utilities
{
    using Formulate.Extensions.StoreData.Models;

    /// <summary>
    /// Reads and writes rows of the submissions table.
    /// </summary>
    internal interface ISubmissionRepository
    {
        Task InsertAsync(FormulateSubmissionDto submission, CancellationToken cancellationToken);

        /// <summary>
        /// Gets a page of a form's submissions, newest first (then by submission ID), and how many it has.
        /// </summary>
        (long Total, IReadOnlyList<FormulateSubmissionDto> Items) Page(Guid formId, long skip, long take);

        FormulateSubmissionDto? Get(Guid submissionId);

        /// <summary>
        /// Deletes a submission's row.
        /// </summary>
        /// <returns>True when there was a row to delete.</returns>
        bool Delete(Guid submissionId);
    }
}
