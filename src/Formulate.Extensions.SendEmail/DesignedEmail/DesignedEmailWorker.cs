namespace Formulate.Extensions.SendEmail.DesignedEmail
{
    using System.Net;
    using Formulate.Core.FormHandlers;
    using Formulate.Core.Submissions.Requests;
    using Formulate.Extensions.SendEmail.Utilities;
    using Microsoft.AspNetCore.Mvc.ViewEngines;
    using Microsoft.Extensions.Logging;

    /// <summary>
    /// Sends the Designed Email handler's email for one submission, written by Razor views.
    /// </summary>
    /// <remarks>
    /// <para>
    /// A view that is missing, does not compile or throws is logged with its path, and no email is sent.
    /// The submission does not fail, and the form's other handlers run either way.
    /// </para>
    /// <para>
    /// Umbraco's email sender sends one body, so the email is HTML when there is an HTML view, and plain
    /// text from the text view only when there is no HTML view.
    /// </para>
    /// </remarks>
    internal sealed class DesignedEmailWorker
    {
        private readonly EmailRecipientResolver _recipients;

        private readonly EmailDispatcher _dispatcher;

        private readonly ISubmissionPageResolver _pages;

        private readonly RazorEmailViewRenderer _renderer;

        private readonly ILogger<DesignedEmailWorker> _logger;

        public DesignedEmailWorker(EmailRecipientResolver recipients, EmailDispatcher dispatcher, ISubmissionPageResolver pages,
            RazorEmailViewRenderer renderer, ILogger<DesignedEmailWorker> logger)
        {
            _recipients = recipients;
            _dispatcher = dispatcher;
            _pages = pages;
            _renderer = renderer;
            _logger = logger;
        }

        public async Task SendAsync(FormSubmissionRequest submission, IFormHandler handler, DesignedEmailConfiguration configuration,
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

            var data = EmailDataFactory.Create(submission, _pages.Resolve(submission.PageId), configuration, sender, recipients);

            // The subject comes from its view, or else from the handler.
            var subject = configuration.Subject;
            var subjectPath = EmailViewPaths.Normalize(configuration.SubjectRazorPath);

            if (subjectPath is not null)
            {
                subject = await RenderTextAsync("subject", subjectPath, data, context);

                if (subject is null)
                {
                    return;
                }
            }

            var htmlPath = EmailViewPaths.Normalize(configuration.HtmlEmailRazorPath);
            var textPath = EmailViewPaths.Normalize(configuration.TextEmailRazorPath);
            var isHtml = htmlPath is not null || textPath is null;
            string? body;

            if (isHtml)
            {
                if (textPath is not null)
                {
                    _logger.LogDebug(
                        "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) left out its text view {ViewPath}, because Umbraco's email sender sends one body and the email has an HTML view.",
                        context.HandlerName, context.HandlerId, context.FormName, context.FormId, textPath);
                }

                body = await RenderAsync("HTML", htmlPath ?? EmailViewPaths.SampleHtml, data, context);
            }
            else
            {
                body = await RenderTextAsync("text", textPath!, data, context);
            }

            if (body is null)
            {
                return;
            }

            cancellationToken.ThrowIfCancellationRequested();

            var attachments = data.Helper.Attachments.Select(x => new EmailAttachment(x.FileName, x.FileData)).ToArray();

            await _dispatcher.SendAsync(
                new OutgoingEmail(sender, recipients, subject, body.Trim(), isHtml, attachments),
                Constants.EmailTypes.DesignedEmail,
                context);
        }

        /// <summary>
        /// Renders a view whose output is plain text. Razor encodes values as HTML, so the output is
        /// decoded back to the text the view wrote.
        /// </summary>
        private async Task<string?> RenderTextAsync(string kind, string path, EmailData data, EmailHandlerContext context)
        {
            var output = await RenderAsync(kind, path, data, context);

            return output is null ? null : WebUtility.HtmlDecode(output).Trim();
        }

        /// <summary>
        /// Renders a view. Null, with the reason logged, when it cannot be rendered.
        /// </summary>
        private async Task<string?> RenderAsync(string kind, string path, EmailData data, EmailHandlerContext context)
        {
            var found = FindView(kind, path, context);

            if (found is null)
            {
                return null;
            }

            try
            {
                return await _renderer.RenderAsync(found.Value.View, data);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) sent no email because its {ViewKind} view {ViewPath} failed.",
                    context.HandlerName, context.HandlerId, context.FormName, context.FormId, kind, found.Value.Path);

                return null;
            }
        }

        /// <summary>
        /// Finds a view, or the built-in sample for one of Formulate Pro's samples the site does not have
        /// (or has, written for Pro, so it does not compile). Null, with the reason logged, when there is none.
        /// </summary>
        private (IView View, string Path)? FindView(string kind, string path, EmailHandlerContext context)
        {
            var sample = EmailViewPaths.GetBuiltInSample(path);

            try
            {
                var view = _renderer.FindView(path);

                if (view is not null)
                {
                    return (view, path);
                }

                if (sample is null)
                {
                    _logger.LogError(
                        "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) sent no email because its {ViewKind} view {ViewPath} was not found.",
                        context.HandlerName, context.HandlerId, context.FormName, context.FormId, kind, path);

                    return null;
                }

                _logger.LogInformation(
                    "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) uses Formulate's built-in sample {SamplePath}, because its {ViewKind} view {ViewPath} is a Formulate Pro sample this site does not have.",
                    context.HandlerName, context.HandlerId, context.FormName, context.FormId, sample, kind, path);
            }
            catch (Exception ex) when (sample is not null)
            {
                _logger.LogWarning(
                    ex,
                    "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) uses Formulate's built-in sample {SamplePath}, because its {ViewKind} view {ViewPath}, a Formulate Pro sample, does not compile. Views written for Formulate Pro need changing for ASP.NET Core, as the built-in samples show.",
                    context.HandlerName, context.HandlerId, context.FormName, context.FormId, sample, kind, path);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) sent no email because its {ViewKind} view {ViewPath} does not compile.",
                    context.HandlerName, context.HandlerId, context.FormName, context.FormId, kind, path);

                return null;
            }

            return FindView(kind, sample, context);
        }
    }
}
