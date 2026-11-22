namespace Formulate.Extensions.SendData.FormHandlers
{
    using System.Runtime.Serialization;

    /// <summary>
    /// Chooses a form field to send, and the name to send it with. The JSON names are the ones Formulate 3
    /// stored.
    /// </summary>
    [DataContract]
    public sealed class FieldMapping
    {
        /// <summary>
        /// Gets or sets the ID of the Formulate field, as a GUID in any format.
        /// </summary>
        [DataMember(Name = "id")]
        public string? Id { get; set; }

        /// <summary>
        /// Gets or sets the name to send the field with, typically the name the receiving system expects.
        /// When it is blank the field's alias, or else its name, is used.
        /// </summary>
        [DataMember(Name = "name")]
        public string? Name { get; set; }
    }
}
