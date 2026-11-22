namespace Formulate.Core.Notifications
{
    using Formulate.Core.Submissions.Requests;
    using Umbraco.Cms.Core.Notifications;

    /// <summary>
    /// A notification for modifying a <see cref="FormSubmissionRequest"/> before it is handled by form handlers.
    /// </summary>
    /// <remarks>
    /// <para>
    /// This is primarily for modifying the ExtraContext property. Other properties in the request should be read only.
    /// </para>
    /// <para>
    /// A notification handler can cancel the submission with <see cref="CancelSubmission"/>. No form handler
    /// runs, and the visitor is told the submission was not successful, with the message.
    /// </para>
    /// </remarks>
    public sealed class FormSubmittingNotification : ICancelableNotification
    {
        /// <summary>
        /// The message used when a submission is cancelled without one.
        /// </summary>
        public const string DefaultCancelMessage = "The form could not be submitted.";

        public FormSubmittingNotification(FormSubmissionRequest request)
        {
            Request = request;
        }

        /// <summary>
        /// Gets the request.
        /// </summary>
        public FormSubmissionRequest Request { get; init; }

        /// <inheritdoc />
        public bool Cancel { get; set; }

        /// <summary>
        /// Gets the message shown to the visitor when the submission is cancelled.
        /// </summary>
        public string CancelMessage { get; private set; }

        /// <summary>
        /// Cancels the submission.
        /// </summary>
        /// <param name="message">The message shown to the visitor.</param>
        /// <remarks>When several handlers cancel, the first message is kept.</remarks>
        public void CancelSubmission(string message)
        {
            if (Cancel == false || string.IsNullOrWhiteSpace(CancelMessage))
            {
                CancelMessage = string.IsNullOrWhiteSpace(message) ? DefaultCancelMessage : message;
            }

            Cancel = true;
        }
    }
}
