namespace Formulate.Extensions.SendEmail.DesignedEmail
{
    /// <summary>
    /// The model a designed email's views get (@model Formulate.Extensions.SendEmail.DesignedEmail.EmailData).
    /// </summary>
    /// <remarks>
    /// Ported from Formulate Pro, without its MailMessage: Formulate sends through Umbraco's email sender,
    /// so views attach files with <see cref="Helper"/>.
    /// </remarks>
    public sealed class EmailData
    {
        private readonly SafeExpandoObject _values = new();

        private readonly SafeExpandoObject _collectionValues = new(Array.Empty<object>());

        /// <summary>
        /// Initializes a new instance of the <see cref="EmailData"/> class.
        /// </summary>
        /// <param name="values">The values of each field (and of the page), by field alias or name.</param>
        public EmailData(IEnumerable<KeyValuePair<string, object?[]>> values)
        {
            foreach (var pair in values)
            {
                var all = pair.Value ?? Array.Empty<object?>();
                _collectionValues.SetValue(pair.Key, all);
                _values.SetValue(pair.Key, all.FirstOrDefault());
            }
        }

        /// <summary>
        /// Gets or sets the sender's email address.
        /// </summary>
        public string? SenderEmail { get; set; }

        /// <summary>
        /// Gets or sets the email addresses of the recipients, in alphabetical order.
        /// </summary>
        public IEnumerable<string> RecipientEmails { get; set; } = Array.Empty<string>();

        /// <summary>
        /// Gets or sets the subject set on the handler in the back office.
        /// </summary>
        public string? Subject { get; set; }

        /// <summary>
        /// Gets or sets the message set on the handler in the back office.
        /// </summary>
        public string? Message { get; set; }

        /// <summary>
        /// Gets the first value of each field, by field alias (or name, when a field has no alias), such
        /// as Model.Values.FirstName, and the page's Url and PageName. A missing value is null.
        /// </summary>
        /// <remarks>
        /// An upload's value is an <see cref="EmailDataFile"/>.
        /// </remarks>
        public dynamic Values => _values;

        /// <summary>
        /// Gets every value of each field, as an object[], such as Model.CollectionValues.FavoriteColors. A
        /// missing value is an empty array. GetRawValues() lists them all.
        /// </summary>
        public dynamic CollectionValues => _collectionValues;

        /// <summary>
        /// Gets or sets the helper for common jobs, such as attaching files.
        /// </summary>
        public EmailDataHelper Helper { get; set; } = new();
    }
}
