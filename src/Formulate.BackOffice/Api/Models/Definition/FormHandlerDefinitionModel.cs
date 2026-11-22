namespace Formulate.BackOffice.Api.Models.Definition
{
    using System;
    using System.Text.Json;

    /// <summary>
    /// A kind of form handler that can be added to a form.
    /// </summary>
    public sealed class FormHandlerDefinitionModel
    {
        /// <summary>
        /// Gets the kind ID.
        /// </summary>
        public required Guid KindId { get; init; }

        /// <summary>
        /// Gets the name.
        /// </summary>
        public required string Name { get; init; }

        /// <summary>
        /// Gets the icon name the definition declares.
        /// </summary>
        public required string Icon { get; init; }

        /// <summary>
        /// Gets the category the handler is grouped under.
        /// </summary>
        public required string Category { get; init; }

        /// <summary>
        /// Gets the alias the back office client matches an editor registration on.
        /// </summary>
        public required string EditorAlias { get; init; }

        /// <summary>
        /// Gets the configuration a new handler of this kind starts with; null when the definition has none.
        /// </summary>
        public JsonElement? DefaultConfiguration { get; init; }
    }
}
