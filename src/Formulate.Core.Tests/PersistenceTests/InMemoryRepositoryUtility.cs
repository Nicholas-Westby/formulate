using System;
using System.Collections.Generic;
using System.Linq;
using Formulate.Core.Persistence;

namespace Formulate.Core.Tests.PersistenceTests
{
    /// <summary>
    /// A repository utility that keeps entities in memory.
    /// </summary>
    internal sealed class InMemoryRepositoryUtility<TEntity> : IRepositoryUtility<TEntity>, IRepositoryUtilityFactory
        where TEntity : class, IPersistedEntity
    {
        private readonly Dictionary<Guid, TEntity> _entities = new();

        public TEntity Save(TEntity entity)
        {
            _entities[entity.Id] = entity;
            return entity;
        }

        public void Delete(Guid entityId) => _entities.Remove(entityId);

        public TEntity Get(Guid entityId) => _entities.TryGetValue(entityId, out var entity) ? entity : null;

        public IReadOnlyCollection<TEntity> GetChildren(Guid parentId) =>
            _entities.Values.Where(x => x.ParentId() == parentId).ToArray();

        public IReadOnlyCollection<TEntity> GetRootItems() => _entities.Values.Where(x => x.Path.Length == 2).ToArray();

        public IReadOnlyCollection<TEntity> GetAll() => _entities.Values.ToArray();

        public Guid[] Move(TEntity entity, Guid[] newPath)
        {
            Save(entity);
            return entity.Path;
        }

        IRepositoryUtility<T> IRepositoryUtilityFactory.Create<T>() => (IRepositoryUtility<T>)(object)this;
    }
}
