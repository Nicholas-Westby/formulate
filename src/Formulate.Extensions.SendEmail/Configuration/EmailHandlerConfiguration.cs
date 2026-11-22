namespace Formulate.Extensions.SendEmail.Configuration
{
    using System.Runtime.Serialization;

    /// <summary>
    /// The configuration the Email and Designed Email handlers share: who sends the email, who gets it,
    /// and its subject and message. The JSON names are the ones Formulate 3 stored.
    /// </summary>
    [DataContract]
    public abstract class EmailHandlerConfiguration
    {
        /// <summary>
        /// Gets or sets the sender's address. When it is blank, Umbraco:CMS:Global:Smtp:From is used.
        /// </summary>
        [DataMember(Name = "senderEmail")]
        public string? SenderEmail { get; set; }

        /// <summary>
        /// Gets or sets the recipients chosen in the back office.
        /// </summary>
        [DataMember(Name = "recipients")]
        public EmailRecipient[] Recipients { get; set; } = Array.Empty<EmailRecipient>();

        /// <summary>
        /// Gets or sets the fields whose values are addresses to send to.
        /// </summary>
        [DataMember(Name = "recipientFields")]
        public FieldReference[] RecipientFields { get; set; } = Array.Empty<FieldReference>();

        /// <summary>
        /// Gets or sets how the recipients get the email: "to", "cc" or "bcc". Anything else is "bcc",
        /// as in Formulate 3.
        /// </summary>
        [DataMember(Name = "deliveryType")]
        public string? DeliveryType { get; set; }

        /// <summary>
        /// Gets or sets the subject.
        /// </summary>
        [DataMember(Name = "subject")]
        public string? Subject { get; set; }

        /// <summary>
        /// Gets or sets the message.
        /// </summary>
        [DataMember(Name = "message")]
        public string? Message { get; set; }

        /// <summary>
        /// Replaces the lists JSON left empty (null) with empty lists, and drops empty entries, so the
        /// handlers can read every list.
        /// </summary>
        internal virtual void Normalize()
        {
            Recipients = (Recipients ?? Array.Empty<EmailRecipient>()).Where(x => x is not null).ToArray();
            RecipientFields = (RecipientFields ?? Array.Empty<FieldReference>()).Where(x => x is not null).ToArray();
        }
    }
}
