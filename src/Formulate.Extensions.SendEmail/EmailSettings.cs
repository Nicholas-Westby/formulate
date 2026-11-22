namespace Formulate.Extensions.SendEmail
{
    /// <summary>
    /// The email settings, read from the "Formulate:Email" configuration section.
    /// </summary>
    public sealed class EmailSettings
    {
        /// <summary>
        /// The configuration section.
        /// </summary>
        public const string SectionName = "Formulate:Email";

        /// <summary>
        /// Gets or sets the domains (such as "example.com") and addresses (such as "sales@example.com")
        /// an address typed into a recipient field must match before it gets an email. Recipients chosen on
        /// the handler, and ones code adds, are always allowed.
        /// </summary>
        /// <remarks>
        /// <para>
        /// Null, when the setting is not there, allows every address. When it is there, only its entries
        /// are allowed, so a setting with none (an empty value, only separators or an empty array) allows
        /// no typed address, and the site logs a warning at startup.
        /// </para>
        /// <para>
        /// It can be set as an array, or as one value with the entries separated by commas or semicolons
        /// (such as the environment variable Formulate__Email__Whitelist=example.com;sales@other.com).
        /// A single value replaces an array. A domain does not allow its subdomains.
        /// </para>
        /// </remarks>
        public string[]? Whitelist { get; set; }
    }
}
