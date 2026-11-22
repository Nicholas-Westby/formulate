namespace Formulate.BackOffice.Api.Models.Form
{
    using System;
    using System.Text.Json.Serialization;
    using Formulate.BackOffice.Api.Json;

    /// <summary>
    /// Creates a form.
    /// </summary>
    public sealed class CreateFormRequestModel
    {
        /// <summary>
        /// Gets the ID the new form gets.
        /// </summary>
        [JsonConverter(typeof(LenientGuidConverter))]
        public Guid Id { get; init; }

        /// <summary>
        /// Gets the ID of the folder to create the form in; null for the top of the Forms tree.
        /// </summary>
        [JsonConverter(typeof(LenientGuidConverter))]
        public Guid? ParentId { get; init; }

        /// <summary>
        /// Gets the ID of the form kind, such as Form with Basic Layout, which also creates a layout.
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
        /// Gets the fields.
        /// </summary>
        public FormFieldModel[] Fields { get; init; } = Array.Empty<FormFieldModel>();

        /// <summary>
        /// Gets the handlers.
        /// </summary>
        public FormHandlerModel[] Handlers { get; init; } = Array.Empty<FormHandlerModel>();
    }
}
