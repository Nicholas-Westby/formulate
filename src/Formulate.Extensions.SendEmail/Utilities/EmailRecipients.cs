namespace Formulate.Extensions.SendEmail.Utilities
{
    using System.Net.Mail;

    /// <summary>
    /// Who gets an email, split by how they get it.
    /// </summary>
    internal sealed class EmailRecipients
    {
        private EmailRecipients(IReadOnlyList<MailAddress> to, IReadOnlyList<MailAddress> cc, IReadOnlyList<MailAddress> bcc)
        {
            To = to;
            Cc = cc;
            Bcc = bcc;
        }

        public IReadOnlyList<MailAddress> To { get; }

        public IReadOnlyList<MailAddress> Cc { get; }

        public IReadOnlyList<MailAddress> Bcc { get; }

        public IEnumerable<MailAddress> All => To.Concat(Cc).Concat(Bcc);

        public bool IsEmpty => To.Count == 0 && Cc.Count == 0 && Bcc.Count == 0;

        /// <summary>
        /// Sends every address the way the delivery type says: "to", "cc", and anything else "bcc", as in
        /// Formulate 3.
        /// </summary>
        public static EmailRecipients For(string? deliveryType, IReadOnlyList<MailAddress> addresses)
        {
            var none = Array.Empty<MailAddress>();

            return deliveryType?.Trim().ToLowerInvariant() switch
            {
                "to" => new EmailRecipients(addresses, none, none),
                "cc" => new EmailRecipients(none, addresses, none),
                _ => new EmailRecipients(none, none, addresses),
            };
        }
    }
}
