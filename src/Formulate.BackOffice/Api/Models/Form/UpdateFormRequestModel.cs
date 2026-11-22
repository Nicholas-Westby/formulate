namespace Formulate.BackOffice.Api.Models.Form
{
    using System;

    /// <summary>
    /// Replaces a form's name, alias, fields and handlers.
    /// </summary>
    public sealed class UpdateFormRequestModel
    {
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
