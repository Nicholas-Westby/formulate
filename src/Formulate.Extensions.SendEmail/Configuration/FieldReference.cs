namespace Formulate.Extensions.SendEmail.Configuration
{
    using System.Runtime.Serialization;

    /// <summary>
    /// A form field, chosen in the back office by its ID.
    /// </summary>
    [DataContract]
    public sealed class FieldReference
    {
        /// <summary>
        /// Gets or sets the field's ID.
        /// </summary>
        [DataMember(Name = "id")]
        public Guid Id { get; set; }
    }
}
