namespace Formulate.Extensions.StoreData.Utilities
{
    using Formulate.Extensions.StoreData.Models;

    internal sealed class SubmissionRepository : ISubmissionRepository
    {
        private const string Order = "ORDER BY CreationDate DESC, SubmissionId";

        private readonly ISubmissionDatabase _database;

        public SubmissionRepository(ISubmissionDatabase database)
        {
            _database = database;
        }

        public Task InsertAsync(FormulateSubmissionDto submission, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            return _database.RunAsync(async db => await db.InsertAsync(submission));
        }

        public (long Total, IReadOnlyList<FormulateSubmissionDto> Items) Page(Guid formId, long skip, long take)
        {
            return _database.Run<(long, IReadOnlyList<FormulateSubmissionDto>)>(db =>
            {
                var total = db.ExecuteScalar<long>(
                    $"SELECT COUNT(*) FROM {FormulateSubmissionDto.TableName} WHERE FormId = @0", formId);
                var items = db.SkipTake<FormulateSubmissionDto>(skip, take, $"WHERE FormId = @0 {Order}", formId);

                return (total, items);
            });
        }

        public IReadOnlyList<FormulateSubmissionDto> PageAfter(Guid formId, FormulateSubmissionDto? after, int take)
        {
            return _database.Run<IReadOnlyList<FormulateSubmissionDto>>(db => after is null
                ? db.SkipTake<FormulateSubmissionDto>(0, take, $"WHERE FormId = @0 {Order}", formId)
                : db.SkipTake<FormulateSubmissionDto>(
                    0,
                    take,
                    $"WHERE FormId = @0 AND (CreationDate < @1 OR (CreationDate = @1 AND SubmissionId > @2)) {Order}",
                    formId,
                    after.CreationDate,
                    after.SubmissionId!.Value));
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
