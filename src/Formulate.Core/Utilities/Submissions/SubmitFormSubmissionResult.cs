namespace Formulate.Core.Utilities.Submissions
{
    /// <summary>
    /// How submitting a form ended.
    /// </summary>
    public sealed class SubmitFormSubmissionResult
    {
        /// <summary>
        /// Gets a value indicating whether every handler succeeded. False when the submission was cancelled.
        /// </summary>
        public bool IsSuccessful { get; init; }

        /// <summary>
        /// Gets a value indicating whether a notification handler cancelled the submission, so no form handler ran.
        /// </summary>
        public bool IsCancelled { get; init; }

        /// <summary>
        /// Gets the message for the visitor when <see cref="IsCancelled"/> is true.
        /// </summary>
        public string CancelMessage { get; init; }
    }
}
