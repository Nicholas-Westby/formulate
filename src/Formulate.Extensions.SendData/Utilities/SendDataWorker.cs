namespace Formulate.Extensions.SendData.Utilities
{
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
                submission, context.HandlerId, context.HandlerName, logUrl, configuration.Method!, format, _payload.GetData(submission, configuration));

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
                (body, truncated) = await ReadBodyAsync(response.Content, limit.Token);
            }
            catch (Exception ex)
            {
                error = ex;
            }

            Log(context, logUrl, status, error);
            await PublishSentAsync(new SentDataNotification(submission, context.HandlerId, context.HandlerName, logUrl, status, body, error, truncated), context, logUrl);
        }

        /// <summary>
        /// Reads at most <see cref="MaxResponseBodyBytes"/> of the body, decoded by its charset (UTF-8 when it has none).
        /// </summary>
        private static async Task<(string Body, bool Truncated)> ReadBodyAsync(HttpContent content, CancellationToken cancellationToken)
        {
            await using var stream = await content.ReadAsStreamAsync(cancellationToken);
            var buffer = new byte[MaxResponseBodyBytes + 1];
            var length = 0;

            while (length < buffer.Length)
            {
                var read = await stream.ReadAsync(buffer.AsMemory(length), cancellationToken);

                if (read == 0)
                {
                    break;
                }

                length += read;
            }

            var truncated = length > MaxResponseBodyBytes;

            return (GetEncoding(content).GetString(buffer, 0, Math.Min(length, MaxResponseBodyBytes)), truncated);
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
    }
}
