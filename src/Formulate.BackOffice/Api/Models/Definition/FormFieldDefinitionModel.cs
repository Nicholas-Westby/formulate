namespace Formulate.BackOffice.Api.Models.Definition
{
    using System;
    using System.Text.Json;

    /// <summary>
    /// A kind of form field that can be added to a form.
    /// </summary>
    public sealed class FormFieldDefinitionModel
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
        /// Gets the category the field is grouped under, such as Inputs.
        /// </summary>
        public required string Category { get; init; }

        /// <summary>
        /// Gets the alias the back office client matches an editor registration on.
        /// </summary>
        public string? EditorAlias { get; init; }

        /// <summary>
        /// Gets a value indicating whether the field has a label.
        /// </summary>
        public required bool SupportsLabel { get; init; }

        /// <summary>
        /// Gets a value indicating whether validations can be added to the field.
        /// </summary>
        public required bool SupportsValidation { get; init; }

        /// <summary>
        /// Gets a value indicating whether the field has a category.
        /// </summary>
        public required bool SupportsCategory { get; init; }

        /// <summary>
        /// Gets a value indicating whether the field exists on the server only.
        /// </summary>
        public required bool IsServerSideOnly { get; init; }

        /// <summary>
        /// Gets a value indicating whether the field's value is stored with a submission.
        /// </summary>
        public required bool IsStored { get; init; }

        /// <summary>
        /// Gets a value indicating whether the field is hidden from visitors.
        /// </summary>
        public required bool IsHidden { get; init; }

        /// <summary>
        /// Gets the configuration a new field of this kind starts with; null when the definition has none.
        /// </summary>
        public JsonElement? DefaultConfiguration { get; init; }
    }
}
