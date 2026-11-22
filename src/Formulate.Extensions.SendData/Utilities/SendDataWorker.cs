namespace Formulate.Extensions.SendData.Utilities
{
    using System.Net;
    using System.Text;
    using System.Text.Encodings.Web;
    using System.Text.Json;
    using Formulate.Core.FormFields;
    using Formulate.Core.FormFields.TextConstant;
    using Formulate.Core.FormHandlers;
    using Formulate.Core.Submissions.Requests;
    using Formulate.Core.Utilities;
    using Formulate.Extensions.SendData.FormHandlers;
    using Formulate.Extensions.SendData.Notifications;
    using Microsoft.AspNetCore.Http;
    using Microsoft.Extensions.Logging;
    using Umbraco.Cms.Core.Events;

    /// <summary>
    /// Sends the Send Data handler's request for one submission.
    /// </summary>
    /// <remarks>
    /// Nothing that goes wrong here fails the visitor's submission or stops the form's other handlers: a
    /// missing URL, a notification handler that throws, a failure status, a timeout and a refused connection
    /// are all logged, naming the handler, the form and the URL. Formulate 3's behaviour is kept: the
    /// request does not follow redirects, and the formats and their content types are the same.
    /// </remarks>
    internal sealed class SendDataWorker
    {
        private const string UserAgent = "Formulate, an Umbraco Form Builder";

        private const string HubSpotCookie = "hubspotutk";

        private static readonly Guid TextConstantKindId = Guid.Parse(TextConstantFieldDefinition.Constants.KindId);

        private static readonly JsonWriterOptions JsonOptions = new() { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

        private readonly IHttpClientFactory _httpClientFactory;

        private readonly IEventAggregator _events;

        private readonly ISubmissionPageResolver _pages;

        private readonly IJsonUtility _jsonUtility;

        private readonly IHttpContextAccessor? _httpContextAccessor;

        private readonly ILogger<SendDataWorker> _logger;

        public SendDataWorker(
            IHttpClientFactory httpClientFactory, IEventAggregator events, ISubmissionPageResolver pages, IJsonUtility jsonUtility,
            ILogger<SendDataWorker> logger, IHttpContextAccessor? httpContextAccessor = null)
        {
            _httpClientFactory = httpClientFactory;
            _events = events;
            _pages = pages;
            _jsonUtility = jsonUtility;
            _logger = logger;
            _httpContextAccessor = httpContextAccessor;
        }

        public async Task SendAsync(FormSubmissionRequest submission, IFormHandler handler, SendDataConfiguration configuration, CancellationToken cancellationToken)
        {
            var context = new HandlerContext(submission, handler);

            if (string.IsNullOrWhiteSpace(configuration.ResultHandler) == false)
            {
                _logger.LogWarning(
                    "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) has a resultHandler ({ResultHandler}) stored by Formulate 3, which is ignored. Handle the result in a notification handler for {Notification} instead.",
                    context.HandlerName, context.HandlerId, context.FormName, context.FormId, configuration.ResultHandler, nameof(SentDataNotification));
            }

            if (string.IsNullOrWhiteSpace(configuration.Url))
            {
                _logger.LogWarning(
                    "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) sent no data because no URL is configured. Set the handler's URL.",
                    context.HandlerName, context.HandlerId, context.FormName, context.FormId);
                return;
            }

            if (Uri.TryCreate(configuration.Url, UriKind.Absolute, out var uri) == false || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            {
                _logger.LogError(
                    "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) sent no data because its URL {Url} is not an absolute http or https URL.",
                    context.HandlerName, context.HandlerId, context.FormName, context.FormId, configuration.Url);
                return;
            }

            var format = GetFormat(configuration.TransmissionFormat);

            if (format is null)
            {
                _logger.LogWarning(
                    "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) sent no data because its transmission format {TransmissionFormat} is not one of Query String, Form Body, JSON or HubSpot JSON.",
                    context.HandlerName, context.HandlerId, context.FormName, context.FormId, configuration.TransmissionFormat);
                return;
            }

            // What is logged and published is the URL without its query string, which can hold a key.
            var logUrl = uri.GetLeftPart(UriPartial.Path);
            var sending = new SendingDataNotification(
                submission, context.HandlerId, context.HandlerName, logUrl, configuration.Method!, format, GetData(submission, configuration));

            try
            {
                await _events.PublishAsync(sending, CancellationToken.None);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) sent no data to {Url} because a {Notification} handler failed.",
                    context.HandlerName, context.HandlerId, context.FormName, context.FormId, logUrl, nameof(SendingDataNotification));
                return;
            }

            if (sending.Cancel)
            {
                _logger.LogInformation(
                    "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) sent no data to {Url} because a {Notification} handler cancelled it.",
                    context.HandlerName, context.HandlerId, context.FormName, context.FormId, logUrl, nameof(SendingDataNotification));
                return;
            }

            var data = sending.Data.ToArray();
            HttpStatusCode? status = null;
            string? body = null;
            Exception? error = null;

            try
            {
                using var request = CreateRequest(uri, configuration.Method!, format, data, submission, sending.Headers);

                // Handlers run without a cancellation token: the client's timeout is what ends a slow request.
                using var response = await _httpClientFactory.CreateClient(Constants.HttpClientName).SendAsync(request, CancellationToken.None);
                status = response.StatusCode;
                body = await response.Content.ReadAsStringAsync(CancellationToken.None);
            }
            catch (Exception ex)
            {
                error = ex;
            }

            Log(context, logUrl, status, error);
            await PublishSentAsync(new SentDataNotification(submission, context.HandlerId, context.HandlerName, logUrl, status, body, error), context, logUrl);
        }

        private void Log(HandlerContext context, string url, HttpStatusCode? status, Exception? error)
        {
            if (error is OperationCanceledException)
            {
                // Handlers run without a cancellation token, so a cancellation is the client's timeout.
                _logger.LogError(
                    error,
                    "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) timed out sending data to {Url}. The submission was still accepted.",
                    context.HandlerName, context.HandlerId, context.FormName, context.FormId, url);
            }
            else if (error is not null)
            {
                _logger.LogError(
                    error,
                    "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) could not send data to {Url}. The submission was still accepted.",
                    context.HandlerName, context.HandlerId, context.FormName, context.FormId, url);
            }
            else if (status is < (HttpStatusCode)200 or >= (HttpStatusCode)300)
            {
                _logger.LogError(
                    "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) sent data to {Url}, which answered with status {StatusCode} ({StatusName}). The submission was still accepted.",
                    context.HandlerName, context.HandlerId, context.FormName, context.FormId, url, (int)status!.Value, status.Value);
            }
            else
            {
                _logger.LogInformation(
                    "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) sent data to {Url}, which answered with status {StatusCode}.",
                    context.HandlerName, context.HandlerId, context.FormName, context.FormId, url, (int)status!.Value);
            }
        }

        private async Task PublishSentAsync(SentDataNotification notification, HandlerContext context, string url)
        {
            try
            {
                await _events.PublishAsync(notification, CancellationToken.None);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) sent data to {Url}, but a {Notification} handler failed.",
                    context.HandlerName, context.HandlerId, context.FormName, context.FormId, url, nameof(SentDataNotification));
            }
        }

        /// <summary>
        /// Gets the format as the constant spells it, or null when it is not one.
        /// </summary>
        private static string? GetFormat(string? configured)
        {
            return new[]
            {
                Constants.TransmissionFormats.QueryString,
                Constants.TransmissionFormats.FormBody,
                Constants.TransmissionFormats.Json,
                Constants.TransmissionFormats.HubSpotJson,
            }.FirstOrDefault(x => string.Equals(x, configured, StringComparison.OrdinalIgnoreCase));
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
        private List<KeyValuePair<string, string>> GetData(FormSubmissionRequest submission, SendDataConfiguration configuration)
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

        private HttpRequestMessage CreateRequest(
            Uri uri, string method, string format, IReadOnlyList<KeyValuePair<string, string>> data, FormSubmissionRequest submission,
            IDictionary<string, string> headers)
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
                    request.Content = new StringContent(ToJson(data), Encoding.UTF8, "application/json");
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
        private static string ToJson(IEnumerable<KeyValuePair<string, string>> data)
        {
            using var stream = new MemoryStream();

            using (var writer = new Utf8JsonWriter(stream, JsonOptions))
            {
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
            }

            return Encoding.UTF8.GetString(stream.ToArray());
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

        /// <summary>
        /// The submission and the handler a request is for, so every log message can name both.
        /// </summary>
        private readonly record struct HandlerContext(FormSubmissionRequest Submission, IFormHandler Handler)
        {
            public Guid FormId => Submission.Form?.Id ?? Guid.Empty;

            public string? FormName => Submission.Form?.Name;

            public Guid HandlerId => Handler.Id;

            public string? HandlerName => Handler.Name;
        }
    }
}
