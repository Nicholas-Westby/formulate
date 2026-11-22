namespace Formulate.Extensions.SendEmail.FormHandlers
{
    using System.Runtime.Serialization;
    using Formulate.Extensions.SendEmail.Configuration;

    /// <summary>
    /// The configuration of the Email handler, with the JSON names Formulate 3 stored.
    /// </summary>
    [DataContract]
    public sealed class SendEmailConfiguration : EmailHandlerConfiguration
    {
        /// <summary>
        /// Gets or sets a value indicating whether the submitted values are added below the message and
        /// the uploaded files attached.
        /// </summary>
        [DataMember(Name = "appendFields")]
        public bool AppendFields { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the page's URL and name are added before the values.
        /// It needs <see cref="AppendFields"/>.
        /// </summary>
        [DataMember(Name = "appendPayload")]
        public bool AppendPayload { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the values are added without their field names.
        /// </summary>
        [DataMember(Name = "excludeFieldLabels")]
        public bool ExcludeFieldLabels { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the values of hidden fields are added.
        /// </summary>
        [DataMember(Name = "includeHiddenFields")]
        public bool IncludeHiddenFields { get; set; }

        /// <summary>
        /// Gets or sets the fields whose values are added; none means all. Choosing a Text Constant field
        /// adds its text.
        /// </summary>
        [DataMember(Name = "fieldsToInclude")]
        public FieldReference[] FieldsToInclude { get; set; } = Array.Empty<FieldReference>();

        /// <inheritdoc />
        internal override void Normalize()
        {
            base.Normalize();
            FieldsToInclude = (FieldsToInclude ?? Array.Empty<FieldReference>()).Where(x => x is not null).ToArray();
        }
    }
}
