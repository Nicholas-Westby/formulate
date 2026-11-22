namespace Formulate.BackOffice.Api.Models.Folder
{
    using System;
    using System.Text.Json.Serialization;
    using Formulate.BackOffice.Api.Json;

    /// <summary>
    /// Creates a folder.
    /// </summary>
    public sealed class CreateFolderRequestModel
    {
        /// <summary>
        /// Gets the ID the new folder gets.
        /// </summary>
        [JsonConverter(typeof(LenientGuidConverter))]
        public Guid Id { get; init; }

        /// <summary>
        /// Gets the ID of the folder to create it in, which must be in the same tree; null creates it at the top of the tree.
        /// </summary>
        [JsonConverter(typeof(LenientGuidConverter))]
        public Guid? ParentId { get; init; }

        /// <summary>
        /// Gets the alias of the tree to create the folder in: forms, data-values or validations.
        /// </summary>
        public string TreeAlias { get; init; } = string.Empty;

        /// <summary>
        /// Gets the name.
        /// </summary>
        public string Name { get; init; } = string.Empty;
    }
}
