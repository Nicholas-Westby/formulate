namespace Formulate.Extensions.SendEmail.Utilities
{
    using Formulate.Core.FormHandlers;
    using Formulate.Core.Submissions.Requests;
    using Formulate.Extensions.SendEmail.FormHandlers;

    /// <summary>
    /// Sends the Email handler's email for one submission.
    /// </summary>
    /// <remarks>
    /// Problems with the handler's or the site's settings (no recipients, no way to send email, no
    /// sender) are logged and send nothing, without failing the submission: they are not the visitor's
    /// doing, and the form's other handlers have run or will run either way.
    /// </remarks>
    internal sealed class SendEmailWorker
    {
        private readonly EmailRecipientResolver _recipients;

        private readonly EmailDispatcher _dispatcher;

        private readonly SendEmailContentBuilder _content;

        private readonly ISubmissionPageResolver _pages;

        public SendEmailWorker(EmailRecipientResolver recipients, EmailDispatcher dispatcher, SendEmailContentBuilder content,
            ISubmissionPageResolver pages)
        {
            _recipients = recipients;
            _dispatcher = dispatcher;
            _content = content;
            _pages = pages;
        }

        public async Task SendAsync(FormSubmissionRequest submission, IFormHandler handler, SendEmailConfiguration configuration,
            CancellationToken cancellationToken)
        {
            var context = new EmailHandlerContext(submission, handler);
            var recipients = _recipients.Resolve(configuration, context);

            if (recipients.IsEmpty)
            {
                _dispatcher.LogNoRecipients(context);
                return;
            }

            if (_dispatcher.CanSend(context) == false)
            {
                return;
            }

            var sender = _dispatcher.GetSender(configuration.SenderEmail, context);

            if (sender is null)
            {
                return;
            }

            // The page is looked up only when its URL and name go in the email.
            var page = configuration.AppendFields && configuration.AppendPayload
                ? _pages.Resolve(submission.PageId)
                : SubmissionPage.None;
            var content = _content.Build(configuration, submission, page);

            cancellationToken.ThrowIfCancellationRequested();

            await _dispatcher.SendAsync(
                new OutgoingEmail(sender, recipients, content.Subject, content.HtmlBody, true, content.Attachments),
                Constants.EmailTypes.Email,
                context);
        }
    }
}
