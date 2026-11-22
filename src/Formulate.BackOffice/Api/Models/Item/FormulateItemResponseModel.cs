namespace Formulate.BackOffice.Api.Models.Item
{
    using System;

    /// <summary>
    /// A Formulate item as shown by a content picker.
    /// </summary>
    public sealed class FormulateItemResponseModel
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
        /// Gets the Umbraco built-in icon name.
        /// </summary>
        public required string Icon { get; init; }

        /// <summary>
        /// Gets the kind ID, for items that have a kind.
        /// </summary>
        public Guid? KindId { get; init; }

        /// <summary>
        /// Gets the ID of the parent folder, or for a layout its form; null at the tree root.
        /// </summary>
        public Guid? ParentId { get; init; }

        /// <summary>
        /// Gets the name of that parent; null at the tree root.
        /// </summary>
        public string? ParentName { get; init; }
    }
}
