namespace Formulate.Extensions.SendEmail.DesignedEmail
{
    using Formulate.Core.Utilities.Submissions;
    using Formulate.Core.FormFields;
    using Formulate.Core.FormFields.Upload;
    using Formulate.Core.Submissions.Requests;
    using Formulate.Core.Types;
    using Formulate.Extensions.SendEmail.Configuration;
    using Formulate.Extensions.SendEmail.Utilities;

    /// <summary>
    /// Builds the <see cref="EmailData"/> a designed email's views get, as Formulate Pro did.
    /// </summary>
    internal static class EmailDataFactory
    {
        private static readonly Guid UploadKindId = Guid.Parse(UploadFieldDefinition.Constants.KindId);

        public static EmailData Create(FormSubmissionRequest submission, FormFieldDefinitionCollection fieldDefinitions, SubmissionPage page, EmailHandlerConfiguration configuration,
            string senderEmail, EmailRecipients recipients)
        {
            // The page comes first, named as Formulate 3 named it, so views read Values.Url and Values.PageName.
            var values = new List<KeyValuePair<string, object?[]>>
            {
                new("URL", new object?[] { page.Url }),
                new("Page Name", new object?[] { page.Name }),
            };

            // Then each field with a value, in the form's order, by alias (or name, when it has no alias).
            foreach (var field in submission.Form?.Fields ?? Array.Empty<PersistedFormField>())
            {
                var name = string.IsNullOrWhiteSpace(field.Alias) ? field.Name : field.Alias;

                if (string.IsNullOrWhiteSpace(name))
                {
                    continue;
                }

                // A field whose definition is not stored (reCAPTCHA) is left out, as the Email handler leaves it out.
                // A kind that is not installed has no definition to ask, so its values are kept.
                if (fieldDefinitions.FirstOrDefault(field.KindId)?.IsStored == false)
                {
                    continue;
                }

                if (submission.FieldValues?.TryGetValue(field.Id, out var text) == true && text is not null)
                {
                    values.Add(new(name, text.GetValues().Cast<object?>().ToArray()));
                }
                // As with Store Data, only upload fields have files: a file posted under any other field is left out.
                else if (field.KindId == UploadKindId && submission.FilesValues?.TryGetValue(field.Id, out var files) == true && files is not null)
                {
                    var uploads = files.GetValues()
                        .Select(x => (object?)new EmailDataFile(EmailAttachment.NameFor(x.Name), x.Data ?? Array.Empty<byte>(), x.ContentType))
                        .ToArray();
                    values.Add(new(name, uploads));
                }
            }

            return new EmailData(values)
            {
                SenderEmail = senderEmail,
                RecipientEmails = recipients.All
                    .Select(x => x.Address)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .Order(StringComparer.OrdinalIgnoreCase)
                    .ToArray(),
                Subject = configuration.Subject,
                Message = configuration.Message,
            };
        }
    }
}
