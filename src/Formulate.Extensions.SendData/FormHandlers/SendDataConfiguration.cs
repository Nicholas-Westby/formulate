namespace Formulate.Extensions.SendData.FormHandlers
{
    using System.Runtime.Serialization;

    /// <summary>
    /// The configuration of the Send Data handler, with the JSON names Formulate 3 stored.
    /// </summary>
    [DataContract]
    public sealed class SendDataConfiguration
    {
        /// <summary>
        /// Gets or sets the URL to send to. Only http and https URLs are used.
        /// </summary>
        [DataMember(Name = "url")]
        public string? Url { get; set; }

        /// <summary>
        /// Gets or sets the HTTP method. The default is GET.
        /// </summary>
        [DataMember(Name = "method")]
        public string? Method { get; set; }

        /// <summary>
        /// Gets or sets how the data is sent: "Query String", "Form Body", "JSON" or "HubSpot JSON", read
        /// ignoring case. The default is "Query String".
        /// </summary>
        [DataMember(Name = "transmissionFormat")]
        public string? TransmissionFormat { get; set; }

        /// <summary>
        /// Gets or sets the fields to send, in order, and the names to send them with. None sends no fields, as in Formulate 3 (the request is still sent).
        /// </summary>
        [DataMember(Name = "fields")]
        public FieldMapping[] Fields { get; set; } = Array.Empty<FieldMapping>();

        /// <summary>
        /// Gets or sets the .NET type name Formulate 3 stored for its result handler. It is read only to warn
        /// that it is not used: Formulate 5 has <c>SentDataNotification</c> instead.
        /// </summary>
        [DataMember(Name = "resultHandler", EmitDefaultValue = false)]
        public string? ResultHandler { get; set; }

        /// <summary>
        /// Fills in the defaults (Formulate 3's editor defaulted to GET and "Query String") and replaces the
        /// lists JSON left empty (null) with empty lists.
        /// </summary>
        internal void Normalize()
        {
            Url = Url?.Trim();
            Method = string.IsNullOrWhiteSpace(Method) ? "GET" : Method.Trim().ToUpperInvariant();
            TransmissionFormat = string.IsNullOrWhiteSpace(TransmissionFormat) ? Constants.TransmissionFormats.QueryString : TransmissionFormat.Trim();
            Fields = (Fields ?? Array.Empty<FieldMapping>()).Where(x => x is not null).ToArray();
        }
    }
}
