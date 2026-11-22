namespace Formulate.BackOffice.Api.Services
{
    /// <summary>
    /// The answer to a write that comes without its request body. Over HTTP, model validation refuses such a
    /// request before it gets here; this keeps a direct caller, or a site that turns that validation off,
    /// from a null reference.
    /// </summary>
    internal static class RequestBody
    {
        /// <summary>
        /// The field a missing body is reported under: the name of the actions' body parameter, which is
        /// also what model validation reports.
        /// </summary>
        public const string Field = "request";

        /// <summary>
        /// Gets the result for a missing body.
        /// </summary>
        /// <typeparam name="T">The type of the service result value.</typeparam>
        /// <returns>A result that says the body is required.</returns>
        public static ServiceResult<T> Missing<T>() => ServiceResult<T>.Invalid(Field, "The request body is required.");
    }
}
