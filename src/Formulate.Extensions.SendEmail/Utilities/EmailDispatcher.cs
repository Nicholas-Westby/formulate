namespace Formulate.Extensions.SendEmail.Utilities
{
    using System.Net.Mail;
    using System.Text.RegularExpressions;
    using Microsoft.Extensions.DependencyInjection;
    using Microsoft.Extensions.Logging;
    using Microsoft.Extensions.Options;
    using Umbraco.Cms.Core.Configuration.Models;
    using Umbraco.Cms.Core.Events;
    using Umbraco.Cms.Core.Mail;
    using Umbraco.Cms.Core.Models.Email;
    using Umbraco.Cms.Core.Notifications;
    using Umbraco.Cms.Infrastructure.Mail;

    /// <summary>
    /// Hands emails to Umbraco's <see cref="IEmailSender"/>, which sends them with the site's
    /// Umbraco:CMS:Global:Smtp settings, and logs what happened.
    /// </summary>
    internal sealed class EmailDispatcher
    {
        /// <summary>
        /// The "To" address for an email whose recipients are all Cc or Bcc. Umbraco needs a "To" address,
        /// and this empty group is the one RFC 5322 suggests; it adds no recipient.
        /// </summary>
        internal const string UndisclosedRecipients = "undisclosed-recipients:;";

        private const string FallbackSubject = "Form submission";

        /// <summary>
        /// Line breaks, with the spaces around them (such as a view's indenting).
        /// </summary>
        private static readonly Regex LineBreaks = new(@"\s*[\r\n]+\s*", RegexOptions.Compiled);

        private readonly IEmailSender _emailSender;

        private readonly IOptionsMonitor<GlobalSettings> _globalSettings;

        private readonly IServiceProvider _services;

        private readonly ILogger<EmailDispatcher> _logger;

        public EmailDispatcher(IEmailSender emailSender, IOptionsMonitor<GlobalSettings> globalSettings, IServiceProvider services,
            ILogger<EmailDispatcher> logger)
        {
            _emailSender = emailSender;
            _globalSettings = globalSettings;
            _services = services;
            _logger = logger;
        }

        /// <summary>
        /// Checks that Umbraco has a way to send email, and logs an error naming the setting when it has not.
        /// </summary>
        /// <remarks>
        /// Umbraco's own sender drops an email quietly (with a debug message) when there is no SMTP server,
        /// pickup folder or SendEmailNotification handler, so this is the same rule, checked first so the
        /// site owner hears about it. Umbraco 19 removed IEmailSender.CanSendRequiredEmail, which is why the
        /// rule is not asked of the sender. A site's own IEmailSender is trusted to send.
        /// </remarks>
        public bool CanSend(EmailHandlerContext context)
        {
            if (_emailSender is not EmailSender || HasSendEmailHandler())
            {
                return true;
            }

            var settings = _globalSettings.CurrentValue;

            if (settings.IsSmtpServerConfigured)
            {
                return true;
            }

            if (settings.IsPickupDirectoryLocationConfigured)
            {
                // Without a "From" address Umbraco skips the pickup folder and fails on the missing SMTP host.
                if (string.IsNullOrWhiteSpace(settings.Smtp?.From) == false)
                {
                    return true;
                }

                _logger.LogError(
                    "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) sent no email because Umbraco only writes emails to Umbraco:CMS:Global:Smtp:PickupDirectoryLocation when Umbraco:CMS:Global:Smtp:From is set.",
                    context.HandlerName, context.HandlerId, context.FormName, context.FormId);

                return false;
            }

            _logger.LogError(
                "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) sent no email because Umbraco has no way to send email. Set Umbraco:CMS:Global:Smtp:Host to an SMTP server, or Umbraco:CMS:Global:Smtp:PickupDirectoryLocation to a folder to write emails to.",
                context.HandlerName, context.HandlerId, context.FormName, context.FormId);

            return false;
        }

        /// <summary>
        /// Gets the sender: the handler's sender email, or Umbraco:CMS:Global:Smtp:From when that is blank.
        /// Null, with an error logged, when there is no valid sender.
        /// </summary>
        public string? GetSender(string? configured, EmailHandlerContext context)
        {
            var sender = configured?.Trim();

            if (string.IsNullOrEmpty(sender) == false)
            {
                if (MailAddress.TryCreate(sender, out _))
                {
                    return sender;
                }

                _logger.LogError(
                    "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) sent no email because its sender email {SenderEmail} is not a valid email address.",
                    context.HandlerName, context.HandlerId, context.FormName, context.FormId, sender);

                return null;
            }

            var from = _globalSettings.CurrentValue.Smtp?.From?.Trim();

            if (string.IsNullOrEmpty(from) == false)
            {
                return from;
            }

            _logger.LogError(
                "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) sent no email because it has no sender. Set the handler's sender email, or Umbraco:CMS:Global:Smtp:From.",
                context.HandlerName, context.HandlerId, context.FormName, context.FormId);

            return null;
        }

        public void LogNoRecipients(EmailHandlerContext context)
        {
            _logger.LogWarning(
                "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) sent no email because it has no recipients. Add recipients to the handler, or choose fields whose values are email addresses.",
                context.HandlerName, context.HandlerId, context.FormName, context.FormId);
        }

        /// <summary>
        /// Sends the email through Umbraco.
        /// </summary>
        /// <remarks>
        /// A failed send (the SMTP server is down, refuses the login or the email) is logged as an error and
        /// does not fail the visitor's submission: the form's other handlers, such as Store Data, have done
        /// their work, and the visitor cannot fix the mail server. A cancelled send is a failure like any other:
        /// handlers run without a cancellation token, so a cancellation here is a timeout in the site's sender
        /// (such as an HttpClient call in a SendEmailNotification handler).
        /// </remarks>
        public async Task SendAsync(OutgoingEmail email, string emailType, EmailHandlerContext context)
        {
            var attachments = email.Attachments
                .Select(x => new EmailMessageAttachment(new MemoryStream(x.Data, writable: false), x.Name))
                .ToList();

            try
            {
                var recipients = email.Recipients;
                var message = new EmailMessage(
                    email.From,
                    recipients.To.Count == 0 ? new[] { UndisclosedRecipients } : Addresses(recipients.To),
                    recipients.Cc.Count == 0 ? null : Addresses(recipients.Cc),
                    recipients.Bcc.Count == 0 ? null : Addresses(recipients.Bcc),
                    null,
                    GetSubject(email.Subject, context),

                    // Umbraco's EmailMessage refuses an empty body.
                    string.IsNullOrEmpty(email.Body) ? " " : email.Body,
                    email.IsBodyHtml,
                    attachments);

                // The notification lets a site's SendEmailNotification handler send it instead (the
                // email type tells it the email is Formulate's). This overload is the one Umbraco 17, 18
                // and 19 all have.
                await _emailSender.SendAsync(message, emailType, true, null);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) could not send its email (email type {EmailType}). The submission was still accepted. Check the SMTP server set in Umbraco:CMS:Global:Smtp, or the site's SendEmailNotification handler.",
                    context.HandlerName, context.HandlerId, context.FormName, context.FormId, emailType);

                return;
            }
            finally
            {
                foreach (var attachment in attachments)
                {
                    attachment.Stream.Dispose();
                }
            }

            _logger.LogInformation(
                "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) sent an email to {RecipientCount} recipients.",
                context.HandlerName, context.HandlerId, context.FormName, context.FormId, email.Recipients.All.Count());
        }

        private static string[] Addresses(IEnumerable<MailAddress> addresses) => addresses.Select(x => x.ToString()).ToArray();

        /// <summary>
        /// Gets the subject on one line. Umbraco's EmailMessage refuses an empty subject, so a blank one
        /// becomes the form's name.
        /// </summary>
        private static string GetSubject(string? subject, EmailHandlerContext context)
        {
            var oneLine = LineBreaks.Replace(subject ?? string.Empty, " ").Trim();

            if (oneLine.Length > 0)
            {
                return oneLine;
            }

            return string.IsNullOrWhiteSpace(context.FormName) ? FallbackSubject : context.FormName.Trim();
        }

        private bool HasSendEmailHandler()
        {
            var handlerTypes = new[]
            {
                typeof(INotificationHandler<SendEmailNotification>),
                typeof(INotificationAsyncHandler<SendEmailNotification>),
            };

            // Umbraco registers notification handlers as services of these types.
            if (_services.GetService<IServiceProviderIsService>() is { } isService)
            {
                return handlerTypes.Any(isService.IsService);
            }

            return handlerTypes.Any(x => _services.GetService(x) is not null);
        }
    }
}
