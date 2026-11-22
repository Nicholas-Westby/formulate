namespace Formulate.BackOffice.Api.Models.Tree
{
    using System;

    /// <summary>
    /// Something that can be created under a place in a tree.
    /// </summary>
    public sealed class CreateOptionModel
    {
        /// <summary>
        /// Gets the entity type to create, one of the <see cref="EntityTypes"/> values.
        /// </summary>
        public required string EntityType { get; init; }

        /// <summary>
        /// Gets the kind ID to create it with; null for folders.
        /// </summary>
        public Guid? KindId { get; init; }

        /// <summary>
        /// Gets the name.
        /// </summary>
        public required string Name { get; init; }

        /// <summary>
        /// Gets what creating it does, when that needs saying.
        /// </summary>
        public string? Description { get; init; }

        /// <summary>
        /// Gets the Umbraco built-in icon name.
        /// </summary>
        public required string Icon { get; init; }
    }
}
