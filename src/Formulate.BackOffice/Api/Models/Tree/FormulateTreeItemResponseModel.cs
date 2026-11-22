namespace Formulate.BackOffice.Api.Models.Tree
{
    using System;
    using Umbraco.Cms.Api.Management.ViewModels;

    /// <summary>
    /// An item in one of the Formulate trees.
    /// </summary>
    public sealed class FormulateTreeItemResponseModel
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
        /// Gets the entity type, one of the <see cref="EntityTypes"/> values.
        /// </summary>
        public required string EntityType { get; init; }

        /// <summary>
        /// Gets a value indicating whether the item has children to show.
        /// </summary>
        public required bool HasChildren { get; init; }

        /// <summary>
        /// Gets a value indicating whether the item is a folder.
        /// </summary>
        public required bool IsFolder { get; init; }

        /// <summary>
        /// Gets the Umbraco built-in icon name.
        /// </summary>
        public required string Icon { get; init; }

        /// <summary>
        /// Gets the parent, or null for a top-level item (the tree roots exist only in the client).
        /// </summary>
        public ReferenceByIdModel? Parent { get; init; }

        /// <summary>
        /// Gets the kind ID, for items that have a kind.
        /// </summary>
        public Guid? KindId { get; init; }

        /// <summary>
        /// Gets a value indicating whether the item's kind is a legacy one.
        /// </summary>
        public required bool IsLegacy { get; init; }
    }
}
