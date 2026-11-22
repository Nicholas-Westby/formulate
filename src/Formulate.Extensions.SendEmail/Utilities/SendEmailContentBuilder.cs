namespace Formulate.Extensions.SendEmail.Utilities
{
    using System.Globalization;
    using System.Net;
    using System.Text.RegularExpressions;
    using Formulate.Core.FormFields;
    using Formulate.Core.FormFields.Hidden;
    using Formulate.Core.FormFields.TextConstant;
    using Formulate.Core.FormFields.Upload;
    using Formulate.Core.Submissions.Requests;
    using Formulate.Core.Types;
    using Formulate.Core.Utilities;
    using Formulate.Extensions.SendEmail.FormHandlers;

    /// <summary>
    /// Writes the Email handler's subject, body and attachments the way Formulate 3 did.
    /// </summary>
    /// <remarks>
    /// Umbraco's email sender sends one body, so this writes Formulate 3's HTML version: every line HTML
    /// encoded, with line breaks as &lt;br&gt;.
    /// </remarks>
    internal sealed class SendEmailContentBuilder
    {
        /// <summary>
        /// Formulate 3's Date field. Its values are written as long dates, such as "November 05, 2026".
        /// </summary>
        internal static readonly Guid DateKindId = Guid.Parse("E70CB78CCF52461198B4556382F23119");

        private const string NewLine = "\r\n";

        private const string HtmlNewLine = NewLine + "<br>" + NewLine;

        private const string UnknownField = "Unknown Field";

        private static readonly Guid HiddenKindId = Guid.Parse(HiddenFieldDefinition.Constants.KindId);

        private static readonly Guid TextConstantKindId = Guid.Parse(TextConstantFieldDefinition.Constants.KindId);

        private static readonly Guid UploadKindId = Guid.Parse(UploadFieldDefinition.Constants.KindId);

        private static readonly Regex LineBreaks = new(@"\r\n|\r|\n", RegexOptions.Compiled);

        private readonly FormFieldDefinitionCollection _fieldDefinitions;

        private readonly IJsonUtility _jsonUtility;

        public SendEmailContentBuilder(FormFieldDefinitionCollection fieldDefinitions, IJsonUtility jsonUtility)
        {
            _fieldDefinitions = fieldDefinitions;
            _jsonUtility = jsonUtility;
        }

        public SendEmailContent Build(SendEmailConfiguration configuration, FormSubmissionRequest submission, SubmissionPage page)
        {
            var subject = (configuration.Subject ?? string.Empty) + GetExtraText(submission, Constants.ExtraContextKeys.ExtraSubject);
            var message = (configuration.Message ?? string.Empty) + GetExtraText(submission, Constants.ExtraContextKeys.ExtraMessage);

            if (configuration.AppendFields == false)
            {
                return new SendEmailContent(subject, ToHtml(message), Array.Empty<EmailAttachment>());
            }

            var fields = submission.Form?.Fields ?? Array.Empty<PersistedFormField>();
            var fieldsById = fields.GroupBy(x => x.Id).ToDictionary(x => x.Key, x => x.First());
            var formOrder = fields.Select(x => x.Id).ToList();
            var chosen = configuration.FieldsToInclude.Select(x => x.Id).ToHashSet();
            bool IsIncluded(Guid id) => chosen.Count == 0 || chosen.Contains(id);

            var lines = new List<string>();

            if (configuration.AppendPayload)
            {
                AddPayload(lines, "URL", page.Url);
                AddPayload(lines, "Page Name", page.Name);
            }

            // Submitted values, plus the server side fields (such as Text Constant) that were chosen.
            var values = new Dictionary<Guid, string?[]>();

            foreach (var pair in submission.FieldValues ?? new Dictionary<Guid, IStringFormFieldValues>())
            {
                if (IsIncluded(pair.Key))
                {
                    values[pair.Key] = pair.Value?.GetValues().ToArray() ?? Array.Empty<string?>();
                }
            }

            if (chosen.Count > 0)
            {
                foreach (var field in fields.Where(x => chosen.Contains(x.Id) && IsServerSideOnly(x)))
                {
                    values.TryAdd(field.Id, Array.Empty<string?>());
                }
            }

            foreach (var id in InFormOrder(values.Keys, formOrder))
            {
                fieldsById.TryGetValue(id, out var field);

                if (field is not null && configuration.IncludeHiddenFields == false && IsHidden(field))
                {
                    continue;
                }

                var formatted = Format(field, values[id]);
                lines.Add(configuration.ExcludeFieldLabels ? formatted : $"{field?.Name ?? UnknownField}: {formatted}");
            }

            // Uploaded files are mentioned in the text and attached. As with Store Data, only the form's
            // upload fields have files: a file posted under any other id is left out.
            var files = new Dictionary<Guid, FormFileValue[]>();

            foreach (var pair in submission.FilesValues ?? new Dictionary<Guid, IFileFormFieldValues>())
            {
                if (IsIncluded(pair.Key) && fieldsById.TryGetValue(pair.Key, out var uploadField) && uploadField.KindId == UploadKindId)
                {
                    files[pair.Key] = pair.Value?.GetValues().ToArray() ?? Array.Empty<FormFileValue>();
                }
            }

            var attachments = new List<EmailAttachment>();

            foreach (var id in InFormOrder(files.Keys, formOrder))
            {
                var names = files[id].Select(x => EmailAttachment.NameFor(x.Name)).ToArray();

                // Formulate 3 attached a field's files even when its line was left out as hidden.
                attachments.AddRange(files[id].Select((x, i) => new EmailAttachment(names[i], x.Data ?? Array.Empty<byte>())));

                fieldsById.TryGetValue(id, out var field);

                if (names.Length == 0 || (field is not null && configuration.IncludeHiddenFields == false && IsHidden(field)))
                {
                    continue;
                }

                var mention = names.Length == 1
                    ? $"See attachment, \"{names[0]}\""
                    : $"See attachments, {string.Join(", ", names.Select(x => $"\"{x}\""))}";
                lines.Add(configuration.ExcludeFieldLabels ? mention : $"{field?.Name ?? UnknownField}: {mention}");
            }

            var body = ToHtml(message) + HtmlNewLine + string.Join(HtmlNewLine, lines.Select(ToHtml));

            return new SendEmailContent(subject, body, attachments);
        }

        /// <summary>
        /// HTML encodes the text and turns its line breaks into &lt;br&gt;.
        /// </summary>
        private static string ToHtml(string text) => LineBreaks.Replace(WebUtility.HtmlEncode(text), HtmlNewLine);

        private static void AddPayload(List<string> lines, string name, string? value)
        {
            if (string.IsNullOrWhiteSpace(value) == false)
            {
                lines.Add($"{name}: {value}");
            }
        }

        /// <summary>
        /// Orders the field IDs as the fields are on the form. IDs the form does not have come last.
        /// </summary>
        private static IEnumerable<Guid> InFormOrder(IEnumerable<Guid> ids, List<Guid> formOrder)
        {
            return ids
                .Select((id, index) => (Id: id, Position: formOrder.IndexOf(id), Index: index))
                .OrderBy(x => x.Position < 0 ? int.MaxValue : x.Position)
                .ThenBy(x => x.Index)
                .Select(x => x.Id);
        }

        private string Format(PersistedFormField? field, string?[] values)
        {
            if (field?.KindId == TextConstantKindId)
            {
                return _jsonUtility.Deserialize<TextConstantFieldConfiguration>(field.Data)?.Text ?? string.Empty;
            }

            var texts = values.Select(x => x ?? string.Empty);

            if (field?.KindId == DateKindId)
            {
                texts = texts.Select(FormatDate);
            }

            return string.Join(", ", texts);
        }

        /// <summary>
        /// Gets a value indicating whether the field is hidden: its definition says so, or it is a Hidden
        /// field (which Formulate 3 treated as hidden; Formulate 5's Hidden kind accepts posted values).
        /// </summary>
        private bool IsHidden(PersistedFormField field)
        {
            return field.KindId == HiddenKindId || _fieldDefinitions.FirstOrDefault(field.KindId)?.IsHidden == true;
        }

        private bool IsServerSideOnly(PersistedFormField field)
        {
            return _fieldDefinitions.FirstOrDefault(field.KindId)?.IsServerSideOnly == true;
        }

        /// <summary>
        /// Writes a date as "MMMM dd, yyyy" in the current culture, as Formulate 3 did. A value that is not a
        /// date is kept.
        /// </summary>
        /// <remarks>
        /// The current culture is the submit request's, which ASP.NET Core's request localization takes from
        /// the query string, a cookie or the Accept-Language header, or else the default request culture. It is
        /// not the culture of the page the form is on. The value is read without regard to culture: the Date
        /// field posts "yyyy-MM-dd" (or a JavaScript date) in every language.
        /// </remarks>
        private static string FormatDate(string value)
        {
            var text = value.Trim();
            var culture = CultureInfo.InvariantCulture;

            if (DateTime.TryParseExact(text, "yyyy-MM-dd", culture, DateTimeStyles.None, out var date)
                || DateTime.TryParse(text, culture, DateTimeStyles.None, out date)

                // A JavaScript date, such as "Sat Nov 21 2026 10:30:00 GMT-0800 (Pacific Standard Time)".
                || (text.Length >= 24 && DateTime.TryParseExact(text[..24], "ddd MMM dd yyyy HH:mm:ss", culture, DateTimeStyles.None, out date)))
            {
                return date.ToString("MMMM dd, yyyy", CultureInfo.CurrentCulture);
            }

            return value;
        }

        private static string GetExtraText(FormSubmissionRequest submission, string key)
        {
            return submission.ExtraContext?.TryGetValue(key, out var value) == true ? value as string ?? string.Empty : string.Empty;
        }
    }

    /// <summary>
    /// The Email handler's subject, HTML body and attachments.
    /// </summary>
    internal sealed record SendEmailContent(string Subject, string HtmlBody, IReadOnlyList<EmailAttachment> Attachments);
}
