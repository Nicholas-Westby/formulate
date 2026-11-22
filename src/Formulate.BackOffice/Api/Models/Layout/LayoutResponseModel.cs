namespace Formulate.BackOffice.Api.Models.Layout
{
    using System;
    using System.Text.Json;

    /// <summary>
    /// A layout.
    /// </summary>
    public sealed class LayoutResponseModel
    {
        /// <summary>
        /// Gets the ID.
        /// </summary>
        public required Guid Id { get; init; }

        /// <summary>
        /// Gets the name.
        /// </summary>
        public required string Name { get; init; }

        /// <summary>
        /// Gets the alias.
        /// </summary>
        public string? Alias { get; init; }

        /// <summary>
        /// Gets the ID of the form the layout belongs to.
        /// </summary>
        public required Guid FormId { get; init; }

        /// <summary>
        /// Gets the ID of the layout's kind.
        /// </summary>
        public required Guid KindId { get; init; }

        /// <summary>
        /// Gets the ID of the template the layout renders with.
        /// </summary>
        public Guid? TemplateId { get; init; }

        /// <summary>
        /// Gets the kind-specific configuration, which can be any JSON value.
        /// </summary>
        public JsonElement? Configuration { get; init; }
    }
}
