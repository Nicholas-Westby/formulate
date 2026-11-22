namespace Formulate.Extensions.SendEmail.Utilities
{
    using System.Net.Mail;

    /// <summary>
    /// The domains and addresses in Formulate:Email:Whitelist.
    /// </summary>
    internal sealed class EmailWhitelist
    {
        /// <summary>
        /// The setting the whitelist is read from.
        /// </summary>
        public const string SettingName = EmailSettings.SectionName + ":" + nameof(EmailSettings.Whitelist);

        private static readonly char[] Separators = { ',', ';' };

        private readonly bool _isSet;

        private readonly HashSet<string> _addresses = new(StringComparer.OrdinalIgnoreCase);

        private readonly HashSet<string> _domains = new(StringComparer.OrdinalIgnoreCase);

        /// <summary>
        /// Reads the entries, which are null when the setting is not there. Each may hold several domains or
        /// addresses, separated by commas or semicolons.
        /// </summary>
        public EmailWhitelist(IEnumerable<string?>? entries)
        {
            _isSet = entries is not null;

            var values = (entries ?? Array.Empty<string?>())
                .SelectMany(x => (x ?? string.Empty).Split(Separators, StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries));

            foreach (var value in values)
            {
                // "someone@example.com" is one address; "example.com" (or "@example.com") a whole domain.
                if (value.IndexOf('@') > 0)
                {
                    _addresses.Add(value);
                }
                else if (value.TrimStart('@') is { Length: > 0 } domain)
                {
                    _domains.Add(domain);
                }
            }
        }

        /// <summary>
        /// Gets a value indicating whether the setting is not there, which allows every address.
        /// </summary>
        public bool AllowsAll => _isSet == false;

        /// <summary>
        /// Gets a value indicating whether the setting is there but has no domain or address, which allows
        /// none: an empty value is read as a whitelist that was meant to be filled in, not as "allow all".
        /// </summary>
        public bool AllowsNone => _isSet && _addresses.Count == 0 && _domains.Count == 0;

        public bool Allows(MailAddress address)
        {
            return AllowsAll || _addresses.Contains(address.Address) || _domains.Contains(address.Host);
        }
    }
}
