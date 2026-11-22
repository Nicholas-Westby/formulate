namespace Formulate.BackOffice.Api.Models.Form
{
    using System;
    using System.Text.Json.Serialization;
    using Formulate.BackOffice.Api.Json;

    /// <summary>
    /// Duplicates a form.
    /// </summary>
    public sealed class DuplicateFormRequestModel
    {
        /// <summary>
        /// Gets the ID of the folder to put the copy in; null puts it beside the original.
        /// </summary>
        [JsonConverter(typeof(LenientGuidConverter))]
        public Guid? ParentId { get; init; }
    }
}
