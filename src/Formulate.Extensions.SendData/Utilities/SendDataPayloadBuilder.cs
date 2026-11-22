namespace Formulate.Extensions.SendData.Utilities
{
    using System.Net;
    using System.Text;
    using System.Text.Encodings.Web;
    using System.Text.Json;
    using Formulate.Core.FormFields;
    using Formulate.Core.FormFields.TextConstant;
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

        private readonly IJsonUtility _jsonUtility;

        private readonly IHttpContextAccessor? _httpContextAccessor;

        private readonly IOptions<SendDataSettings> _settings;

        private readonly ILogger<SendDataPayloadBuilder> _logger;

        public SendDataPayloadBuilder(
            ISubmissionPageResolver pages, IJsonUtility jsonUtility, IOptions<SendDataSettings> settings,
            ILogger<SendDataPayloadBuilder> logger, IHttpContextAccessor? httpContextAccessor = null)
        {
            _pages = pages;
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
        /// A field's values are joined with ", ", as Formulate 3's field formatting did for a checkbox list.
        /// Formulate 3 formatted values per field kind for transmission. Formulate 5 has no such formatting, so
        /// every kind sends the submitted values as they arrived: a Date field the text its field posts
        /// ("yyyy-MM-dd"), a Checkbox List its selected values' values, and an Upload field nothing (files are
        /// never sent).
        /// </remarks>
        public List<KeyValuePair<string, string>> GetData(FormSubmissionRequest submission, SendDataConfiguration configuration)
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
                    data.Add(new KeyValuePair<string, string>(sendName, string.Join(", ", fieldValues.GetValues().Select(x => x ?? string.Empty))));
                }
            }

            foreach (var mapping in configuration.Fields)
            {
                if (Guid.TryParse(mapping.Id, out var id) == false)
                {
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
                    request.RequestUri = new Uri(AppendQuery(uri, data));

                    // A GET has no body; any other method sends an empty one, with the data in the query.
                    if (httpMethod != HttpMethod.Get && httpMethod != HttpMethod.Head)
                    {
                        request.Content = new ByteArrayContent(Array.Empty<byte>());
                    }

                    break;

                case Constants.TransmissionFormats.FormBody:
                    request.Content = new FormUrlEncodedContent(data);
                    break;

                case Constants.TransmissionFormats.Json:
                    request.Content = new StringContent(ToJson(data, GetWrapJson(context)), Encoding.UTF8, "application/json");
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
                    request.Content?.Headers.TryAddWithoutValidation(header.Key, header.Value);
                }
            }

            return request;
        }

        /// <summary>
        /// Adds the data to the URL's own query string.
        /// </summary>
        private static string AppendQuery(Uri uri, IEnumerable<KeyValuePair<string, string>> data)
        {
            var pairs = data.Select(x => $"{WebUtility.UrlEncode(x.Key)}={WebUtility.UrlEncode(x.Value)}");
            var query = string.Join("&", new[] { uri.Query.TrimStart('?') }.Concat(pairs).Where(x => x.Length > 0));
            var bare = uri.GetLeftPart(UriPartial.Path);

            return query.Length == 0 ? bare : $"{bare}?{query}";
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
        private bool GetWrapJson(HandlerContext context)
        {
            var mode = _settings.Value.JsonMode;

            if (string.IsNullOrWhiteSpace(mode) || string.Equals(mode, SendDataSettings.ObjectJsonMode, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            if (string.Equals(mode, SendDataSettings.WrappedArrayJsonMode, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            _logger.LogWarning(
                "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) sends a JSON object, because Formulate:SendData:JsonMode is {JsonMode}, which is not Object or WrappedArray.",
                context.HandlerName, context.HandlerId, context.FormName, context.FormId, mode);

            return false;
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
