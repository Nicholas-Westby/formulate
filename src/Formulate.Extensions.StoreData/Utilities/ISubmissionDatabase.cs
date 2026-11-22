namespace Formulate.Extensions.StoreData.Utilities
{
    using NPoco;
    using Umbraco.Cms.Infrastructure.Scoping;

    /// <summary>
    /// Gives the submission repository a database to work with.
    /// </summary>
    internal interface ISubmissionDatabase
    {
        /// <summary>
        /// Runs some work against the database, saving its changes when it returns.
        /// </summary>
        T Run<T>(Func<IDatabase, T> work);
    }

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
    }
}
