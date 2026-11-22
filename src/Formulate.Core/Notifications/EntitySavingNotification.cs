using Formulate.Core.Persistence;
using Umbraco.Cms.Core.Notifications;

namespace Formulate.Core.Notifications
{
    public sealed class EntitySavingNotification<TPersistedEntity> : INotification where TPersistedEntity : class, IPersistedEntity
    {
        public EntitySavingNotification(TPersistedEntity entity)
            : this(entity, false)
        {
        }

        public EntitySavingNotification(TPersistedEntity entity, bool isNew)
        {
            Entity = entity;
            IsNew = isNew;
        }

        /// <summary>
        /// Gets a value indicating whether the entity is being stored for the first time.
        /// </summary>
        public bool IsNew { get; init; }

        public TPersistedEntity Entity { get; init; }
    }
}
