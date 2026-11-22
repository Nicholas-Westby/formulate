using Formulate.Core.Persistence;
using Umbraco.Cms.Core.Notifications;

namespace Formulate.Core.Notifications
{
    public sealed class EntitySavedNotification<TPersistedEntity> : INotification where TPersistedEntity : class, IPersistedEntity
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="EntitySavedNotification{TPersistedEntity}"/> class.
        /// </summary>
        /// <param name="entity">The entity.</param>
        /// <param name="isNew">True when the entity is being stored for the first time.</param>
        public EntitySavedNotification(TPersistedEntity entity, bool isNew)
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
