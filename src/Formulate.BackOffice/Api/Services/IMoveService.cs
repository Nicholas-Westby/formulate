namespace Formulate.BackOffice.Api.Services
{
    using System;
    using Formulate.Core.Persistence;

    /// <summary>
    /// Moves items of a Formulate tree, and everything under them, into a folder.
    /// </summary>
    public interface IMoveService
    {
        /// <summary>
        /// Moves an item.
        /// </summary>
        /// <typeparam name="TEntity">The type the item must be, such as a form or a folder. Another type gives not found.</typeparam>
        /// <param name="id">The item's ID.</param>
        /// <param name="targetId">The ID of the folder to move into, which must be in the item's own tree, or null for the top of that tree.</param>
        ServiceResult<bool> Move<TEntity>(Guid id, Guid? targetId)
            where TEntity : class, IPersistedEntity;
    }
}
