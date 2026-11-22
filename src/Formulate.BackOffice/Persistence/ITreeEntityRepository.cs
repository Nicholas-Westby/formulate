namespace Formulate.BackOffice.Persistence
{
    using System;
    using System.Collections.Generic;
    using Formulate.Core.Persistence;

    /// <summary>
    /// A contract for creating a tree entity repository.
    /// </summary>
    /// <remarks>A tree entity repository pulls entities from all repositories.</remarks>
    public interface ITreeEntityRepository
    {
        /// <summary>
        /// Gets a persisted entity for a given id.
        /// </summary>
        /// <param name="id">The entity ID.</param>
        /// <returns>A <see cref="IPersistedEntity"/>.</returns>
        IPersistedEntity? Get(Guid? id);

        /// <summary>
        /// Gets a the children a given ID.
        /// </summary>
        /// <param name="parentId">The parent ID.</param>
        /// <returns>A read only collection of <see cref="IPersistedEntity"/> items.</returns>
        IReadOnlyCollection<IPersistedEntity> GetChildren(Guid parentId);

        /// <summary>
        /// Gets the root items for a given tree root type.
        /// </summary>
        /// <param name="treeRootType">The tree root type.</param>
        /// <returns>A read only collection of <see cref="IPersistedEntity"/> items.</returns>
        IReadOnlyCollection<IPersistedEntity> GetRootItems(TreeTypes treeRootType);

        /// <summary>
        /// Gets the root id for a given tree root type.
        /// </summary>
        /// <param name="treeRootType">The tree root type.</param>
        /// <returns>A <see cref="Guid"/>.</returns>
        Guid GetRootId(TreeTypes treeRootType);

        /// <summary>
        /// Gets the IDs of every entity in a tree that has at least one child.
        /// </summary>
        /// <param name="treeType">The tree.</param>
        /// <param name="foldersOnly">True to count only folders as children.</param>
        /// <returns>The parent IDs. Each repository is read at most once.</returns>
        IReadOnlyCollection<Guid> GetParentIds(TreeTypes treeType, bool foldersOnly);

        /// <summary>
        /// Gets everything under an entity, at any depth, without the entity itself.
        /// </summary>
        /// <param name="id">The entity's ID.</param>
        /// <returns>The descendants. Each repository is read once, however many there are.</returns>
        IReadOnlyCollection<IPersistedEntity> GetDescendants(Guid id);

        /// <summary>
        /// Gives an entity a new path and saves it, leaving the entities under it alone.
        /// </summary>
        /// <param name="entity">The entity.</param>
        /// <param name="path">The new path, ending with the entity's own ID.</param>
        void UpdatePath(IPersistedEntity entity, Guid[] path);
    }
}