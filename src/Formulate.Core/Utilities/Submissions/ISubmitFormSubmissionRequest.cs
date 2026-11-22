namespace Formulate.Core.Utilities.Submissions
{
    using Formulate.Core.Submissions.Requests;
    using System.Threading;
    using System.Threading.Tasks;

    public interface ISubmitFormSubmissionRequest
    {
        /// <summary>
        /// Runs the form's enabled handlers on a submission.
        /// </summary>
        /// <param name="input">The submission.</param>
        /// <param name="cancellationToken">
        /// Not passed on to the handlers: once a submission starts, every handler runs to the end,
        /// even if the visitor disconnects.
        /// </param>
        /// <returns>
        /// The result: successful when every handler succeeded, or cancelled (with no handler run) when a
        /// <see cref="Formulate.Core.Notifications.FormSubmittingNotification"/> handler cancelled it.
        /// </returns>
        Task<SubmitFormSubmissionResult> SubmitAsync(FormSubmissionRequest input, CancellationToken cancellationToken);
    }
}
