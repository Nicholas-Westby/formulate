namespace Formulate.BackOffice.Api.Models.Definition
{
    using System;

    /// <summary>
    /// A template a layout can render with.
    /// </summary>
    public sealed class TemplateDefinitionModel
    {
        /// <summary>
        /// Gets the ID, which layouts store as their template ID.
        /// </summary>
        public required Guid Id { get; init; }

        /// <summary>
        /// Gets the name.
        /// </summary>
        public required string Name { get; init; }

        /// <summary>
        /// Gets a value indicating whether a layout saved without a template gets this one. Exactly one
        /// template is the default whenever any is installed.
        /// </summary>
        public required bool IsDefault { get; init; }
    }
}
