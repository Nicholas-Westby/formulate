namespace Formulate.Extensions.StoreData.Utilities
{
    using NPoco;
    using Umbraco.Cms.Infrastructure.Scoping;

    /// <summary>
    /// Runs work in an Umbraco scope.
    /// </summary>
    internal sealed class ScopedSubmissionDatabase : ISubmissionDatabase
    {
        private readonly IScopeProvider _scopeProvider;

        public ScopedSubmissionDatabase(IScopeProvider scopeProvider)
        {
            _scopeProvider = scopeProvider;
        }

        public T Run<T>(Func<IDatabase, T> work)
        {
            using var scope = _scopeProvider.CreateScope();
            var result = work(scope.Database);
            scope.Complete();
            return result;
        }

        public async Task<T> RunAsync<T>(Func<IDatabase, Task<T>> work)
        {
            using var scope = _scopeProvider.CreateScope();
            var result = await work(scope.Database);
            scope.Complete();
            return result;
        }
    }
}
