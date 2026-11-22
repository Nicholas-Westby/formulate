namespace Formulate.Extensions.SendData.Notifications
{
    using Formulate.Core.Submissions.Requests;
    using Umbraco.Cms.Core.Notifications;

    /// <summary>
    /// Published before the Send Data handler sends. A handler can change the data and headers, or cancel
    /// the send.
    /// </summary>
    public sealed class SendingDataNotification : ICancelableNotification
    {
        public SendingDataNotification(
            FormSubmissionRequest request, Guid handlerId, string? handlerName, string url, string method,
            string transmissionFormat, IList<KeyValuePair<string, string>> data)
        {
            Request = request;
            HandlerId = handlerId;
            HandlerName = handlerName;
            Url = url;
            Method = method;
            TransmissionFormat = transmissionFormat;
            Data = data;
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
        /// Gets the HTTP method.
        /// </summary>
        public string Method { get; }

        /// <summary>
        /// Gets the transmission format, as configured.
        /// </summary>
        public string TransmissionFormat { get; }

        /// <summary>
        /// Gets the names and values to send, in order. A field is in the list once, with its values joined by ", ". A handler can add, change or remove entries; what is left is sent.
        /// </summary>
        public IList<KeyValuePair<string, string>> Data { get; }

        /// <summary>
        /// Gets headers to add to the request, such as an API key.
        /// </summary>
        public IDictionary<string, string> Headers { get; } = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        /// <summary>
        /// Gets or sets a value indicating whether nothing is sent.
        /// </summary>
        public bool Cancel { get; set; }
    }
}
