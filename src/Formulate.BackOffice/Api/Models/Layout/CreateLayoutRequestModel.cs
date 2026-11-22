namespace Formulate.BackOffice.Api.Models.Layout
{
    using System;
    using System.Text.Json.Serialization;
    using Formulate.BackOffice.Api.Json;
    using System.Text.Json;

    /// <summary>
    /// Creates a layout.
    /// </summary>
    public sealed class CreateLayoutRequestModel
    {
        /// <summary>
        /// Gets the ID the new layout gets.
        /// </summary>
        [JsonConverter(typeof(LenientGuidConverter))]
        public Guid Id { get; init; }

        /// <summary>
        /// Gets the ID of the form the layout belongs to.
        /// </summary>
        [JsonConverter(typeof(LenientGuidConverter))]
        public Guid FormId { get; init; }

        /// <summary>
        /// Gets the ID of the layout's kind.
        /// </summary>
        [JsonConverter(typeof(LenientGuidConverter))]
        public Guid KindId { get; init; }

        /// <summary>
        /// Gets the name.
        /// </summary>
        public string Name { get; init; } = string.Empty;

        /// <summary>
        /// Gets the alias.
        /// </summary>
        public string? Alias { get; init; }

        /// <summary>
        /// Gets the ID of the template the layout renders with.
        /// </summary>
        [JsonConverter(typeof(LenientGuidConverter))]
        public Guid? TemplateId { get; init; }

        /// <summary>
        /// Gets the kind-specific configuration, which can be any JSON value.
        /// </summary>
        public JsonElement? Configuration { get; init; }
    }
}
