namespace Formulate.Extensions.StoreData.Utilities
{
    using Formulate.Extensions.StoreData.Models;

    /// <summary>
    /// Reads and writes rows of the submissions table.
    /// </summary>
    internal interface ISubmissionRepository
    {
        void Insert(FormulateSubmissionDto submission);

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

    internal sealed class SubmissionRepository : ISubmissionRepository
    {
        private readonly ISubmissionDatabase _database;

        public SubmissionRepository(ISubmissionDatabase database)
        {
            _database = database;
        }

        public void Insert(FormulateSubmissionDto submission)
        {
            _database.Run(db => db.Insert(submission));
        }

        public (long Total, IReadOnlyList<FormulateSubmissionDto> Items) Page(Guid formId, long skip, long take)
        {
            return _database.Run<(long, IReadOnlyList<FormulateSubmissionDto>)>(db =>
            {
                var total = db.ExecuteScalar<long>(
                    $"SELECT COUNT(*) FROM {FormulateSubmissionDto.TableName} WHERE FormId = @0", formId);
                var items = db.SkipTake<FormulateSubmissionDto>(
                    skip,
                    take,
                    "WHERE FormId = @0 ORDER BY CreationDate DESC, SubmissionId",
                    formId);

                return (total, items);
            });
        }

        public FormulateSubmissionDto? Get(Guid submissionId)
        {
            return _database.Run(db => db.FirstOrDefault<FormulateSubmissionDto>("WHERE SubmissionId = @0", submissionId));
        }

        public bool Delete(Guid submissionId)
        {
            return _database.Run(db => db.Delete<FormulateSubmissionDto>("WHERE SubmissionId = @0", submissionId)) > 0;
        }
    }
}
