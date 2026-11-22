namespace Formulate.Extensions.SendData.Notifications
{
    using System.Net;
    using Formulate.Core.Submissions.Requests;
    using Umbraco.Cms.Core.Notifications;

    /// <summary>
    /// Published after the Send Data handler sent, whatever came back. It replaces Formulate 3's result
    /// handler.
    /// </summary>
    public sealed class SentDataNotification : INotification
    {
        public SentDataNotification(
            FormSubmissionRequest request, Guid handlerId, string? handlerName, string url, HttpStatusCode? statusCode,
            string? responseBody, Exception? error, bool isBodyTruncated = false)
        {
            Request = request;
            HandlerId = handlerId;
            HandlerName = handlerName;
            Url = url;
            StatusCode = statusCode;
            ResponseBody = responseBody;
            Error = error;
            IsBodyTruncated = isBodyTruncated;
        }

        /// <summary>
        /// Gets the submission.
        /// </summary>
        public FormSubmissionRequest Request { get; }

        /// <summary>
        /// Gets the ID of the Send Data handler.
        /// </summary>
        public Guid HandlerId { get; }

        /// <summary>
        /// Gets the name of the Send Data handler.
        /// </summary>
        public string? HandlerName { get; }

        /// <summary>
        /// Gets the configured URL, without the data.
        /// </summary>
        public string Url { get; }

        /// <summary>
        /// Gets the response's status code, or null when there was no response (the request failed).
        /// </summary>
        public HttpStatusCode? StatusCode { get; }

        /// <summary>
        /// Gets the response's body, or null when there was no response.
        /// </summary>
        public string? ResponseBody { get; }

        /// <summary>
        /// Gets a value indicating whether the response had more than 1 MiB (1,048,576 bytes) of body, of which
        /// <see cref="ResponseBody"/> has the first 1 MiB. The limit keeps a receiver that answers with an enormous
        /// body from filling the site's memory.
        /// </summary>
        public bool IsBodyTruncated { get; }

        /// <summary>
        /// Gets the failure when the request failed (a connection error or a timeout), or null.
        /// </summary>
        public Exception? Error { get; }

        /// <summary>
        /// Gets a value indicating whether the response had a success status (2xx).
        /// </summary>
        public bool IsSuccess => Error is null && StatusCode is >= (HttpStatusCode)200 and < (HttpStatusCode)300;
    }
}
