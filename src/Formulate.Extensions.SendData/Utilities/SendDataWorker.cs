namespace Formulate.Extensions.SendData.Utilities
{
    using System.Buffers;
    using System.Collections.Concurrent;
    using System.Net;
    using System.Text;
    using Formulate.Core.FormHandlers;
    using Formulate.Core.Submissions.Requests;
    using Formulate.Extensions.SendData.FormHandlers;
    using Formulate.Extensions.SendData.Notifications;
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
        /// <summary>
        /// The most of a response's body that is kept for <see cref="SentDataNotification"/>: 1 MiB.
        /// </summary>
        internal const int MaxResponseBodyBytes = 1_048_576;

        private static readonly ConcurrentDictionary<Guid, bool> WarnedResultHandlers = new();

        private readonly IHttpClientFactory _httpClientFactory;

        private readonly IEventAggregator _events;

        private readonly SendDataPayloadBuilder _payload;

        private readonly ILogger<SendDataWorker> _logger;

        public SendDataWorker(IHttpClientFactory httpClientFactory, IEventAggregator events, SendDataPayloadBuilder payload, ILogger<SendDataWorker> logger)
        {
            _httpClientFactory = httpClientFactory;
            _events = events;
            _payload = payload;
            _logger = logger;
        }

        public async Task SendAsync(FormSubmissionRequest submission, IFormHandler handler, SendDataConfiguration configuration, CancellationToken cancellationToken)
        {
            var context = new HandlerContext(submission, handler);

            // Once for each handler in a process: the setting stays until the handler is saved again.
            if (string.IsNullOrWhiteSpace(configuration.ResultHandler) == false && WarnedResultHandlers.TryAdd(context.HandlerId, true))
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
                // The URL is not logged: it can hold a key or a password. Its scheme says what is wrong with it.
                _logger.LogError(
                    "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) sent no data because its URL is not an absolute http or https URL (its scheme is {Scheme}).",
                    context.HandlerName, context.HandlerId, context.FormName, context.FormId, uri?.Scheme ?? "missing");
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

            // Logs never carry the URL's user info or query, which can hold a key or a password. Notifications get the
            // real URL, as a site's own code may need it.
            var logUrl = SafeUrl(uri);
            List<KeyValuePair<string, string>> initialData;

            try
            {
                initialData = _payload.GetData(submission, configuration, context);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) sent no data to {Url} because its data could not be built.",
                    context.HandlerName, context.HandlerId, context.FormName, context.FormId, logUrl);
                return;
            }

            var sending = new SendingDataNotification(
                submission, context.HandlerId, context.HandlerName, configuration.Url, configuration.Method!, format, initialData);

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
            var truncated = false;
            string? redirect = null;
            var redirectUnreadable = false;
            Exception? error = null;

            try
            {
                using var request = _payload.CreateRequest(uri, configuration.Method!, format, data, submission, sending.Headers, context);

                // The time limit covers the whole exchange, the body included: HttpClient.Timeout ends at the
                // response headers when the body is read afterwards.
                using var limit = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                limit.CancelAfter(SendDataServiceCollectionExtensions.RequestTimeout);

                using var response = await _httpClientFactory.CreateClient(Constants.HttpClientName)
                    .SendAsync(request, HttpCompletionOption.ResponseHeadersRead, limit.Token);
                status = response.StatusCode;
                (redirect, redirectUnreadable) = GetRedirect(uri, response);
                (body, truncated) = await ReadBodyAsync(response.Content, limit.Token);
            }
            catch (Exception ex)
            {
                error = ex;
            }

            Log(context, logUrl, status, redirect, redirectUnreadable, error, cancellationToken);
            await PublishSentAsync(new SentDataNotification(submission, context.HandlerId, context.HandlerName, configuration.Url, status, body, error, truncated), context, logUrl);
        }

        /// <summary>
        /// Reads at most <see cref="MaxResponseBodyBytes"/> of the body, decoded by its byte order mark, or else
        /// its charset (UTF-8 when it has none). A mark is not part of the text, and a character the limit cuts in
        /// half is left out.
        /// </summary>
        private static async Task<(string Body, bool Truncated)> ReadBodyAsync(HttpContent content, CancellationToken cancellationToken)
        {
            await using var stream = await content.ReadAsStreamAsync(cancellationToken);

            // The buffer grows with what arrives, so a small response does not allocate the limit.
            using var bytes = new MemoryStream();
            var chunk = ArrayPool<byte>.Shared.Rent(8192);

            try
            {
                while (bytes.Length <= MaxResponseBodyBytes)
                {
                    var wanted = (int)Math.Min(chunk.Length, MaxResponseBodyBytes + 1 - bytes.Length);
                    var read = await stream.ReadAsync(chunk.AsMemory(0, wanted), cancellationToken);

                    if (read == 0)
                    {
                        break;
                    }

                    bytes.Write(chunk, 0, read);
                }
            }
            finally
            {
                ArrayPool<byte>.Shared.Return(chunk);
            }

            var truncated = bytes.Length > MaxResponseBodyBytes;
            var buffer = bytes.GetBuffer();
            var length = (int)Math.Min(bytes.Length, MaxResponseBodyBytes);
            var (encoding, skip) = DetectByteOrderMark(buffer, length);
            encoding ??= GetEncoding(content);

            // Without flushing, the decoder keeps back the start of a character the limit cut, instead of writing U+FFFD.
            var decoder = encoding.GetDecoder();
            var chars = new char[encoding.GetMaxCharCount(length - skip)];
            var count = decoder.GetChars(buffer, skip, length - skip, chars, 0, flush: truncated == false);

            return (new string(chars, 0, count), truncated);
        }

        /// <summary>
        /// Finds the encoding a byte order mark says, as <see cref="StreamReader"/> does, and the mark's length.
        /// </summary>
        private static (Encoding? Encoding, int Length) DetectByteOrderMark(byte[] b, int length)
        {
            if (length >= 4 && b[0] == 0xFF && b[1] == 0xFE && b[2] == 0 && b[3] == 0)
            {
                return (new UTF32Encoding(false, true), 4);
            }

            if (length >= 4 && b[0] == 0 && b[1] == 0 && b[2] == 0xFE && b[3] == 0xFF)
            {
                return (new UTF32Encoding(true, true), 4);
            }

            if (length >= 3 && b[0] == 0xEF && b[1] == 0xBB && b[2] == 0xBF)
            {
                return (Encoding.UTF8, 3);
            }

            if (length >= 2 && b[0] == 0xFF && b[1] == 0xFE)
            {
                return (Encoding.Unicode, 2);
            }

            if (length >= 2 && b[0] == 0xFE && b[1] == 0xFF)
            {
                return (Encoding.BigEndianUnicode, 2);
            }

            return (null, 0);
        }

        private static Encoding GetEncoding(HttpContent content)
        {
            var charset = content.Headers.ContentType?.CharSet?.Trim('"', ' ');

            try
            {
                return string.IsNullOrEmpty(charset) ? Encoding.UTF8 : Encoding.GetEncoding(charset);
            }
            catch (ArgumentException)
            {
                // A charset the runtime does not know.
                return Encoding.UTF8;
            }
        }

        private void Log(HandlerContext context, string url, HttpStatusCode? status, string? redirect, bool redirectUnreadable, Exception? error, CancellationToken cancellationToken)
        {
            if (error is OperationCanceledException)
            {
                // Handlers run without a cancellation token, so a cancellation is the time limit.
                _logger.LogError(
                    error,
                    "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) {Outcome} sending data to {Url}. The submission was still accepted.",
                    context.HandlerName, context.HandlerId, context.FormName, context.FormId, cancellationToken.IsCancellationRequested ? "was cancelled" : "timed out", url);
            }
            else if (error is not null)
            {
                _logger.LogError(
                    error,
                    "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) could not send data to {Url}. The submission was still accepted.",
                    context.HandlerName, context.HandlerId, context.FormName, context.FormId, url);
            }
            else if (status is >= (HttpStatusCode)300 and < (HttpStatusCode)400)
            {
                // A redirect is not followed, as in Formulate 3: the data would go to a URL the site owner did not choose.
                // It is not an error, but the site owner should change the URL to where it now goes.
                _logger.LogInformation(
                    "Form handler {HandlerName} ({HandlerId}) on form {FormName} ({FormId}) sent data to {Url}, which answered with status {StatusCode} ({StatusName}) and sent the request on to {Location}. Redirects are not followed: set the handler's URL to where the receiver now is.",
                    context.HandlerName, context.HandlerId, context.FormName, context.FormId, url, (int)status!.Value, status.Value,
                    redirectUnreadable ? "a Location that could not be read" : redirect ?? "(no Location)");
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

        /// <summary>
        /// Gets the URL without its user info, query and fragment, to log.
        /// </summary>
        private static string SafeUrl(Uri uri)
        {
            return uri.GetComponents(UriComponents.SchemeAndServer, UriFormat.UriEscaped) + uri.AbsolutePath;
        }

        /// <summary>
        /// Gets the host and path of the response's Location, to log, for a redirect only. It is null when there is
        /// no Location, and Unreadable is true when the Location is malformed: that is not the send's error, and the
        /// value is not logged.
        /// </summary>
        private static (string? Location, bool Unreadable) GetRedirect(Uri requested, HttpResponseMessage response)
        {
            if ((int)response.StatusCode is < 300 or >= 400)
            {
                return (null, false);
            }

            try
            {
                var location = response.Headers.Location;

                return location is null ? (null, false) : (SafeUrl(location.IsAbsoluteUri ? location : new Uri(requested, location)), false);
            }
            catch (Exception)
            {
                return (null, true);
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
    }
}
