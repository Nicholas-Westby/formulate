namespace Formulate.Extensions.SendData.Utilities
{
    using System.Net;
    using System.Text;
    using System.Text.Encodings.Web;
    using System.Text.Json;
    using Formulate.Core.FormFields;
    using Formulate.Core.FormFields.TextConstant;
    using Formulate.Core.Types;
    using Formulate.Core.Submissions.Requests;
    using Formulate.Core.Utilities;
    using Formulate.Core.Utilities.Submissions;
    using Formulate.Extensions.SendData.FormHandlers;
    using Microsoft.AspNetCore.Http;
    using Microsoft.Extensions.Logging;
    using Microsoft.Extensions.Options;

    /// <summary>
    /// Builds what the Send Data handler sends: the names and values from the submission, and the request
    /// that carries them in each transmission format.
    /// </summary>
    internal sealed class SendDataPayloadBuilder
    {
        private const string UserAgent = "Formulate, an Umbraco Form Builder";

        private const string HubSpotCookie = "hubspotutk";

        private static readonly Guid TextConstantKindId = Guid.Parse(TextConstantFieldDefinition.Constants.KindId);

        private static readonly JsonWriterOptions JsonOptions = new() { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

        private readonly ISubmissionPageResolver _pages;

        private readonly FormFieldDefinitionCollection _fieldDefinitions;

        private readonly IJsonUtility _jsonUtility;

        private readonly IHttpContextAccessor? _httpContextAccessor;

        private readonly IOptions<SendDataSettings> _settings;

        private readonly ILogger<SendDataPayloadBuilder> _logger;

        public SendDataPayloadBuilder(
            ISubmissionPageResolver pages, FormFieldDefinitionCollection fieldDefinitions, IJsonUtility jsonUtility, IOptions<SendDataSettings> settings,
            ILogger<SendDataPayloadBuilder> logger, IHttpContextAccessor? httpContextAccessor = null)
        {
            _pages = pages;
            _fieldDefinitions = fieldDefinitions;
            _jsonUtility = jsonUtility;
            _settings = settings;
            _logger = logger;
            _httpContextAccessor = httpContextAccessor;
        }

        /// <summary>
        /// Gets the names and values to send: the mapped fields, in the mapping's order, one pair for each.
        /// An empty mapping sends no fields, as in Formulate 3: the request is still sent. Sending every field
        /// would start sending a site's visitors' data to a URL that received none before an upgrade.
        /// </summary>
        /// <remarks>
        /// A field's values are sent as posted, joined with ", " as Formulate 3's field formatting did for a
        /// checkbox list, except that a field kind that formats its values (a Date, as "MMMM dd, yyyy" in the
        /// current culture, as in Formulate 3) sends them formatted. A reCAPTCHA response token is sent only when
        /// the mapping names the field. An Upload field sends nothing (files are never sent). A mapping whose name is blank
        /// uses the field's alias, or its name when it has no alias.
        /// </remarks>
        public List<KeyValuePair<string, string>> GetData(FormSubmissionRequest submission, SendDataConfiguration configuration, HandlerContext context)
        {
            var data = new List<KeyValuePair<string, string>>();
            var fields = submission.Form?.Fields ?? Array.Empty<PersistedFormField>();
            var values = submission.FieldValues;

            void Add(PersistedFormField field, string? name)
            {
                var sendName = string.IsNullOrWhiteSpace(name) ? NameOf(field) : name;

                if (field.KindId == TextConstantKindId)
                {
                    // A server side field has no submitted values: it sends its configured text.
                    var text = _jsonUtility.Deserialize<TextConstantFieldConfiguration>(field.Data)?.Text;

                    if (text is not null)
                    {
                        data.Add(new KeyValuePair<string, string>(sendName, text));
                    }

                    return;
                }

                if (values is not null && values.TryGetValue(field.Id, out var fieldValues) && fieldValues is not null)
                {
                    var texts = fieldValues.GetValues().Select(x => x ?? string.Empty);

                    if (_fieldDefinitions.FirstOrDefault(field.KindId) is IFormFieldValueFormatter formatter)
                    {
                        texts = texts.Select(formatter.FormatValue);
                    }

                    data.Add(new KeyValuePair<string, string>(sendName, string.Join(", ", texts)));
                }
            }

            foreach (var mapping in configuration.Fields)
            {
                if (Guid.TryParse(mapping.Id, out var id) == false)
                {
                    _logger.LogWarning(
                        "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) leaves out a field mapping, because its id {FieldId} is not a GUID.",
                        context.HandlerName, context.HandlerId, context.FormName, context.FormId, mapping.Id);
                    continue;
                }

                var field = fields.FirstOrDefault(x => x.Id == id);

                if (field is not null)
                {
                    Add(field, mapping.Name);
                }
            }

            return data;
        }

        private static string NameOf(PersistedFormField field)
        {
            return string.IsNullOrWhiteSpace(field.Alias) ? field.Name : field.Alias;
        }

        public HttpRequestMessage CreateRequest(
            Uri uri, string method, string format, IReadOnlyList<KeyValuePair<string, string>> data, FormSubmissionRequest submission,
            IDictionary<string, string> headers, HandlerContext context)
        {
            var httpMethod = new HttpMethod(method);
            var request = new HttpRequestMessage(httpMethod, uri);

            switch (format)
            {
                case Constants.TransmissionFormats.QueryString:
                    var query = MergeQuery(uri, data);

                    if (query.Length > 0)
                    {
                        request.RequestUri = new Uri($"{uri.GetLeftPart(UriPartial.Path)}?{query}");
                    }

                    // A GET has no body; any other method sends an empty one, with the data in the query.
                    if (httpMethod != HttpMethod.Get && httpMethod != HttpMethod.Head)
                    {
                        request.Content = new ByteArrayContent(Array.Empty<byte>());
                    }

                    break;

                case Constants.TransmissionFormats.FormBody:
                    // The URL is left as it was, and the body has its own query values too, as in Formulate 3.
                    request.Content = new ByteArrayContent(Encoding.UTF8.GetBytes(MergeQuery(uri, data)));
                    request.Content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/x-www-form-urlencoded");
                    break;

                case Constants.TransmissionFormats.Json:
                    request.Content = new StringContent(ToJson(data, GetWrapJson()), Encoding.UTF8, "application/json");
                    break;

                default:
                    request.Content = new StringContent(ToHubSpotJson(data, submission), Encoding.UTF8, "application/json");
                    break;
            }

            request.Headers.TryAddWithoutValidation("User-Agent", UserAgent);

            foreach (var header in headers)
            {
                if (request.Headers.TryAddWithoutValidation(header.Key, header.Value) == false)
                {
                    if (request.Content is null || request.Content.Headers.TryAddWithoutValidation(header.Key, header.Value) == false)
                    {
                        // The value is not logged: a header is often an API key.
                        _logger.LogWarning(
                            "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) did not add the header {Header} a {Notification} handler asked for, because it is not a valid header.",
                            context.HandlerName, context.HandlerId, context.FormName, context.FormId, header.Key, nameof(Notifications.SendingDataNotification));
                    }
                }
            }

            return request;
        }

        /// <summary>
        /// Merges the data into the URL's own query values, as Formulate 3 did (it called
        /// <c>NameValueCollection.Set</c> for each pair): a pair replaces an earlier one with the same name,
        /// ignoring case, which keeps its spelling and place. The result is url encoded.
        /// </summary>
        private static string MergeQuery(Uri uri, IEnumerable<KeyValuePair<string, string>> data)
        {
            var pairs = new List<KeyValuePair<string, string>>();

            foreach (var part in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
            {
                var separator = part.IndexOf('=');
                pairs.Add(separator < 0
                    ? new KeyValuePair<string, string>(WebUtility.UrlDecode(part), string.Empty)
                    : new KeyValuePair<string, string>(WebUtility.UrlDecode(part[..separator]), WebUtility.UrlDecode(part[(separator + 1)..])));
            }

            foreach (var pair in data)
            {
                var first = pairs.FindIndex(x => string.Equals(x.Key, pair.Key, StringComparison.OrdinalIgnoreCase));

                if (first < 0)
                {
                    pairs.Add(pair);
                    continue;
                }

                // Set replaces every value the name had with the one.
                var key = pairs[first].Key;
                var kept = pairs.Where((x, i) => i < first || (i > first && string.Equals(x.Key, key, StringComparison.OrdinalIgnoreCase) == false)).ToList();
                kept.Insert(first, new KeyValuePair<string, string>(key, pair.Value));
                pairs = kept;
            }

            return string.Join("&", pairs.Select(x => $"{WebUtility.UrlEncode(x.Key)}={WebUtility.UrlEncode(x.Value)}"));
        }

        /// <summary>
        /// Writes an object of names to values, where a name used by more than one mapping has an array of its values,
        /// as in Formulate 3.
        /// </summary>
        private static string ToJson(IEnumerable<KeyValuePair<string, string>> data, bool wrapInArray)
        {
            using var stream = new MemoryStream();

            using (var writer = new Utf8JsonWriter(stream, JsonOptions))
            {
                if (wrapInArray)
                {
                    writer.WriteStartArray();
                }

                writer.WriteStartObject();

                foreach (var group in data.GroupBy(x => x.Key))
                {
                    var values = group.Select(x => x.Value).ToArray();

                    if (values.Length == 1)
                    {
                        writer.WriteString(group.Key, values[0]);
                        continue;
                    }

                    writer.WriteStartArray(group.Key);

                    foreach (var value in values)
                    {
                        writer.WriteStringValue(value);
                    }

                    writer.WriteEndArray();
                }

                writer.WriteEndObject();

                if (wrapInArray)
                {
                    writer.WriteEndArray();
                }
            }

            return Encoding.UTF8.GetString(stream.ToArray());
        }

        /// <summary>
        /// Gets a value indicating whether the JSON is wrapped in an array (Formulate:SendData:JsonMode).
        /// </summary>
        private bool GetWrapJson()
        {
            // A value that is neither is reported once at startup by SendDataJsonModeSettingCheck, and means Object.
            return string.Equals(_settings.Value.JsonMode, SendDataSettings.WrappedArrayJsonMode, StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Writes the JSON HubSpot's forms API takes: the fields, with several values joined by commas as in
        /// Formulate 3, and the page the form was on.
        /// </summary>
        private string ToHubSpotJson(IEnumerable<KeyValuePair<string, string>> data, FormSubmissionRequest submission)
        {
            var page = _pages.Resolve(submission.PageId);
            var hutk = _httpContextAccessor?.HttpContext?.Request.Cookies[HubSpotCookie];

            using var stream = new MemoryStream();

            using (var writer = new Utf8JsonWriter(stream, JsonOptions))
            {
                writer.WriteStartObject();
                writer.WriteStartArray("fields");

                foreach (var group in data.GroupBy(x => x.Key))
                {
                    writer.WriteStartObject();
                    writer.WriteString("name", group.Key);
                    writer.WriteString("value", string.Join(",", group.Select(x => x.Value)));
                    writer.WriteEndObject();
                }

                writer.WriteEndArray();
                writer.WriteStartObject("context");

                if (string.IsNullOrEmpty(hutk) == false)
                {
                    writer.WriteString("hutk", hutk);
                }

                if (page.Url is not null)
                {
                    writer.WriteString("pageUri", page.Url);
                }

                if (page.Name is not null)
                {
                    writer.WriteString("pageName", page.Name);
                }

                writer.WriteEndObject();
                writer.WriteEndObject();
            }

            return Encoding.UTF8.GetString(stream.ToArray());
        }
    }
}
