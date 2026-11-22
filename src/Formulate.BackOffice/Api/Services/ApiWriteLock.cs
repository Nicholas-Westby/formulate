namespace Formulate.BackOffice.Api.Services
{
    using System;
    using System.Threading;

    /// <summary>
    /// Makes the Management API's writes happen one at a time across the site. A write reads the tree,
    /// decides, then saves, often several files. Two at once can each decide on what the other is about
    /// to change: two folders moved into each other both succeed and drop out of the tree, a form saved
    /// during a move of its folder writes the old path back, and a form created in a folder being deleted
    /// is left without a parent.
    /// </summary>
    /// <remarks>
    /// Registered as a singleton, so every request shares it. Reads do not take it. A write that starts
    /// another write on the same thread does not wait for itself.
    /// </remarks>
    public sealed class ApiWriteLock
    {
        private readonly object _sync = new();

        /// <summary>
        /// Gets a value indicating whether the current thread is running a write.
        /// </summary>
        internal bool IsHeldByCurrentThread => Monitor.IsEntered(_sync);

        /// <summary>
        /// Runs a write once no other write is running.
        /// </summary>
        /// <param name="write">The write.</param>
        /// <typeparam name="T">The type of the write's result.</typeparam>
        /// <returns>The write's result.</returns>
        public T Run<T>(Func<T> write)
        {
            lock (_sync)
            {
                return write();
            }
        }
    }
}
