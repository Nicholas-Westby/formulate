namespace Formulate.BackOffice.Api.Models.Form
{
    using System;
    using System.Text.Json.Serialization;
    using Formulate.BackOffice.Api.Json;
    using System.Text.Json;

    /// <summary>
    /// A field on a form.
    /// </summary>
    public sealed class FormFieldModel
    {
        /// <summary>
        /// Gets the ID.
        /// </summary>
        [JsonConverter(typeof(LenientGuidConverter))]
        public Guid Id { get; init; }

        /// <summary>
        /// Gets the ID of the field's kind.
        /// </summary>
        [JsonConverter(typeof(LenientGuidConverter))]
        public Guid KindId { get; init; }

        /// <summary>
        /// Gets the name.
        /// </summary>
        public string? Name { get; init; }

        /// <summary>
        /// Gets the alias.
        /// </summary>
        public string? Alias { get; init; }

        /// <summary>
        /// Gets the label.
        /// </summary>
        public string? Label { get; init; }

        /// <summary>
        /// Gets the category.
        /// </summary>
        public string? Category { get; init; }

        /// <summary>
        /// Gets the IDs of the validations.
        /// </summary>
        [JsonConverter(typeof(LenientGuidConverter))]
        public Guid[] Validations { get; init; } = Array.Empty<Guid>();

        /// <summary>
        /// Gets the kind-specific configuration, which can be any JSON value.
        /// </summary>
        public JsonElement? Configuration { get; init; }
    }
}
