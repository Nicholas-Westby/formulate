namespace Formulate.BackOffice.Api.Models.Form
{
    using System;

    /// <summary>
    /// A form.
    /// </summary>
    public sealed class FormResponseModel
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
        /// Gets the ID of the folder the form is in; null at the top of the Forms tree.
        /// </summary>
        public Guid? ParentId { get; init; }

        /// <summary>
        /// Gets the fields.
        /// </summary>
        public required FormFieldModel[] Fields { get; init; }

        /// <summary>
        /// Gets the handlers.
        /// </summary>
        public required FormHandlerModel[] Handlers { get; init; }
    }
}
