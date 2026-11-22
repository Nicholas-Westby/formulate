namespace Formulate.BackOffice.Api.Models.Folder
{
    using System;

    /// <summary>
    /// A folder.
    /// </summary>
    public sealed class FolderResponseModel
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
        /// Gets the ID of the folder it is in; null when it is at the top of its tree.
        /// </summary>
        public Guid? ParentId { get; init; }

        /// <summary>
        /// Gets the alias of the tree the folder is in: forms, data-values or validations.
        /// </summary>
        public required string TreeAlias { get; init; }
    }
}
