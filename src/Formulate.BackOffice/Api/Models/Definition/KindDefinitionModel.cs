namespace Formulate.BackOffice.Api.Models.Definition
{
    using System;
    using System.Text.Json;

    /// <summary>
    /// A kind of validation, data values or layout.
    /// </summary>
    public sealed class KindDefinitionModel
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
        /// Gets the Umbraco built-in icon name.
        /// </summary>
        public required string Icon { get; init; }

        /// <summary>
        /// Gets the alias the back office client matches an editor registration on.
        /// </summary>
        public required string EditorAlias { get; init; }

        /// <summary>
        /// Gets a value indicating whether the kind exists for older data only, so new items cannot use it.
        /// </summary>
        public required bool IsLegacy { get; init; }

        /// <summary>
        /// Gets the configuration a new item of this kind starts with; null when the definition has none.
        /// </summary>
        public JsonElement? DefaultConfiguration { get; init; }
    }
}
