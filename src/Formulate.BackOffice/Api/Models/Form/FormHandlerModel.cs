namespace Formulate.BackOffice.Api.Models.Form
{
    using System;
    using System.Text.Json.Serialization;
    using Formulate.BackOffice.Api.Json;
    using System.Text.Json;

    /// <summary>
    /// A handler on a form.
    /// </summary>
    public sealed class FormHandlerModel
    {
        /// <summary>
        /// Gets the ID.
        /// </summary>
        [JsonConverter(typeof(LenientGuidConverter))]
        public Guid Id { get; init; }

        /// <summary>
        /// Gets the ID of the handler's kind.
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
        /// Gets a value indicating whether the handler runs.
        /// </summary>
        public bool Enabled { get; init; }

        /// <summary>
        /// Gets the kind-specific configuration, which can be any JSON value.
        /// </summary>
        public JsonElement? Configuration { get; init; }
    }
}
