namespace Formulate.Extensions.StoreData.Utilities
{
    using NPoco;

    /// <summary>
    /// Gives the submission repository a database to work with.
    /// </summary>
    internal interface ISubmissionDatabase
    {
        /// <summary>
        /// Runs some work against the database, saving its changes when it returns.
        /// </summary>
        T Run<T>(Func<IDatabase, T> work);

        /// <summary>
        /// Runs some asynchronous work against the database, saving its changes when it completes.
        /// </summary>
        Task<T> RunAsync<T>(Func<IDatabase, Task<T>> work);
    }
}
