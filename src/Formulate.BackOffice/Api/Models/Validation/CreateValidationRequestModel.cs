namespace Formulate.BackOffice.Api.Models.Validation
{
    using System;
    using System.Text.Json;
    using System.Text.Json.Serialization;
    using Formulate.BackOffice.Api.Json;

    /// <summary>
    /// Creates a validation.
    /// </summary>
    public sealed class CreateValidationRequestModel
    {
        /// <summary>
        /// Gets the ID the new item gets.
        /// </summary>
        [JsonConverter(typeof(LenientGuidConverter))]
        public Guid Id { get; init; }

        /// <summary>
        /// Gets the ID of the folder to create it in; null creates it at the top of its tree.
        /// </summary>
        [JsonConverter(typeof(LenientGuidConverter))]
        public Guid? ParentId { get; init; }

        /// <summary>
        /// Gets the ID of its kind.
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
        /// Gets the kind-specific configuration, which can be any JSON value.
        /// </summary>
        public JsonElement? Configuration { get; init; }
    }
}
