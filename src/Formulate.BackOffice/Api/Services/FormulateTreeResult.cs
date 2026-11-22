namespace Formulate.BackOffice.Api.Services
{
    /// <summary>
    /// The outcome of a tree service call.
    /// </summary>
    public enum FormulateTreeStatus
    {
        /// <summary>
        /// The call succeeded.
        /// </summary>
        Success,

        /// <summary>
        /// The tree alias is not one of <see cref="TreeAliases"/>.
        /// </summary>
        UnknownTree,

        /// <summary>
        /// The parent or descendant does not exist in the tree.
        /// </summary>
        NotFound,
    }

    /// <summary>
    /// A tree service result: a status and, on success, a value.
    /// </summary>
    /// <typeparam name="T">The type of the value.</typeparam>
    public sealed class FormulateTreeResult<T>
    {
        private FormulateTreeResult(FormulateTreeStatus status, T? value)
        {
            Status = status;
            Value = value;
        }

        /// <summary>
        /// Gets the status.
        /// </summary>
        public FormulateTreeStatus Status { get; }

        /// <summary>
        /// Gets the value, which is set only when the status is <see cref="FormulateTreeStatus.Success"/>.
        /// </summary>
        public T? Value { get; }

        /// <summary>
        /// Creates a successful result.
        /// </summary>
        public static FormulateTreeResult<T> Success(T value) => new(FormulateTreeStatus.Success, value);

        /// <summary>
        /// Creates a failed result.
        /// </summary>
        public static FormulateTreeResult<T> Failure(FormulateTreeStatus status) => new(status, default);
    }
}
