namespace Formulate.Extensions.SendEmail.Utilities
{
    using System.Net.Mail;
    using Formulate.Core.FormFields;
    using Formulate.Core.Submissions.Requests;
    using Formulate.Extensions.SendEmail.Configuration;
    using Microsoft.Extensions.Logging;
    using Microsoft.Extensions.Options;

    /// <summary>
    /// Works out who gets an email: the recipients chosen on the handler, the addresses typed into the
    /// chosen fields, and any code added to the submission, as Formulate 3 did.
    /// </summary>
    internal sealed class EmailRecipientResolver
    {
        private readonly IOptionsMonitor<EmailSettings> _settings;

        private readonly ILogger<EmailRecipientResolver> _logger;

        public EmailRecipientResolver(IOptionsMonitor<EmailSettings> settings, ILogger<EmailRecipientResolver> logger)
        {
            _settings = settings;
            _logger = logger;
        }

        public EmailRecipients Resolve(EmailHandlerConfiguration configuration, EmailHandlerContext context)
        {
            var addresses = new List<MailAddress>();

            // Recipients chosen in the back office are trusted. Like Formulate 3, an entry can have a name
            // and can list several addresses.
            foreach (var recipient in configuration.Recipients)
            {
                AddTrusted(recipient.Email, "the handler's recipients", addresses, context);
            }

            AddFromFields(configuration, addresses, context);

            // Code is trusted like the back office.
            foreach (var recipient in GetExtraRecipients(context.Submission))
            {
                AddTrusted(recipient, "the submission's extra recipients", addresses, context);
            }

            var distinct = addresses.DistinctBy(x => x.Address, StringComparer.OrdinalIgnoreCase).ToArray();

            return EmailRecipients.For(configuration.DeliveryType, distinct);
        }

        /// <summary>
        /// Adds the addresses the visitor typed into the recipient fields. Only a field's first posted value
        /// is read, so a visitor cannot add recipients by posting the field again. The value must be one
        /// plain address (as in Formulate 3), and it must match Formulate:Email:Whitelist when that has entries.
        /// </summary>
        private void AddFromFields(EmailHandlerConfiguration configuration, List<MailAddress> addresses, EmailHandlerContext context)
        {
            var whitelist = new EmailWhitelist(_settings.CurrentValue.Whitelist);
            var fields = context.Submission.Form?.Fields ?? Array.Empty<PersistedFormField>();

            foreach (var reference in configuration.RecipientFields)
            {
                if (context.Submission.FieldValues?.TryGetValue(reference.Id, out var values) != true || values is null)
                {
                    continue;
                }

                var fieldName = fields.FirstOrDefault(x => x.Id == reference.Id)?.Name ?? reference.Id.ToString("N");

                var posted = values.GetValues();
                var text = posted.Count == 0 ? null : posted[0]?.Trim();

                if (string.IsNullOrEmpty(text))
                {
                    continue;
                }

                if (IsOnePlainAddress(text, out var address) == false)
                {
                    _logger.LogInformation(
                        "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) ignored the value of field {FieldName} because it is not one email address.",
                        context.HandlerName, context.HandlerId, context.FormName, context.FormId, fieldName);
                    continue;
                }

                if (whitelist.AllowsNone)
                {
                    _logger.LogWarning(
                        "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) did not send to the address typed into field {FieldName}, because Formulate:Email:Whitelist is set but has no domains or addresses, so it allows none.",
                        context.HandlerName, context.HandlerId, context.FormName, context.FormId, fieldName);
                    continue;
                }

                if (whitelist.Allows(address) == false)
                {
                    _logger.LogWarning(
                        "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) did not send to the address typed into field {FieldName}, because Formulate:Email:Whitelist does not allow it.",
                        context.HandlerName, context.HandlerId, context.FormName, context.FormId, fieldName);
                    continue;
                }

                addresses.Add(address);
            }
        }

        private void AddTrusted(string? text, string source, List<MailAddress> addresses, EmailHandlerContext context)
        {
            if (string.IsNullOrWhiteSpace(text))
            {
                return;
            }

            try
            {
                var parsed = new MailAddressCollection();
                parsed.Add(text);
                addresses.AddRange(parsed);
            }
            catch (FormatException)
            {
                _logger.LogWarning(
                    "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) skipped {Recipient} from {Source} because it is not a valid email address.",
                    context.HandlerName, context.HandlerId, context.FormName, context.FormId, text, source);
            }
        }

        private static bool IsOnePlainAddress(string text, out MailAddress address)
        {
            // A name ("Ada <ada@example.com>"), a list or anything else around the address does not match.
            if (MailAddress.TryCreate(text, out var parsed) && string.Equals(parsed.Address, text, StringComparison.Ordinal))
            {
                address = parsed;
                return true;
            }

            address = null!;
            return false;
        }

        private static IEnumerable<string?> GetExtraRecipients(FormSubmissionRequest submission)
        {
            if (submission.ExtraContext?.TryGetValue(Constants.ExtraContextKeys.ExtraRecipients, out var value) != true)
            {
                return Array.Empty<string?>();
            }

            return value switch
            {
                string single => new[] { single },
                IEnumerable<string?> several => several,
                _ => Array.Empty<string?>(),
            };
        }
    }
}
