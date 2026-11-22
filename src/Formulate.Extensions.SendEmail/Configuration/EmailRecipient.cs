namespace Formulate.Extensions.SendEmail.Configuration
{
    using System.Runtime.Serialization;

    /// <summary>
    /// A recipient chosen in the back office.
    /// </summary>
    [DataContract]
    public sealed class EmailRecipient
    {
        /// <summary>
        /// Gets or sets the address. It can have a name ("Sales &lt;sales@example.com&gt;") and can list
        /// several addresses separated by commas.
        /// </summary>
        [DataMember(Name = "email")]
        public string? Email { get; set; }
    }
}
