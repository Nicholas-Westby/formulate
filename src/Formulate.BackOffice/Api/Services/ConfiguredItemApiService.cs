namespace Formulate.BackOffice.Api.Services
{
    using System;
    using System.Linq;
    using System.Text.Json;
    using Formulate.BackOffice.Api.Json;
    using Formulate.BackOffice.Api.Models.Shared;
    using Formulate.BackOffice.Persistence;
    using Formulate.Core.Persistence;
    using Formulate.Core.Types;

    /// <summary>
    /// The steps validations and data values share: both are items of a tree with a kind, a name, an alias
    /// and a configuration. What differs is left to the derived class.
    /// </summary>
    /// <typeparam name="TEntity">The persisted entity.</typeparam>
    /// <typeparam name="TResponse">The response model.</typeparam>
    public abstract class ConfiguredItemApiService<TEntity, TResponse>
        where TEntity : class, IPersistedEntity
        where TResponse : class
    {
        private readonly IEntityRepository<TEntity> _repository;

        private readonly ITreeEntityRepository _treeRepository;

        private readonly ConfigurationJson _configurationJson;

        /// <inheritdoc cref="ConfiguredItemApiService{TEntity, TResponse}"/>
        protected ConfiguredItemApiService(IEntityRepository<TEntity> repository, ITreeEntityRepository treeRepository, ConfigurationJson configurationJson)
        {
            _repository = repository;
            _treeRepository = treeRepository;
            _configurationJson = configurationJson;
        }

        /// <summary>
        /// Gets the tree the items live in.
        /// </summary>
        private protected abstract TreeTypes Tree { get; }

        /// <summary>
        /// Gets the tree's name in messages, such as "Validations".
        /// </summary>
        private protected abstract string TreeLabel { get; }

        /// <summary>
        /// Gets what an item is called in "does not exist" messages, such as "validation".
        /// </summary>
        private protected abstract string ItemNoun { get; }

        /// <summary>
        /// Gets what a kind is called in messages, such as "validation kind".
        /// </summary>
        private protected abstract string KindNoun { get; }

        /// <summary>
        /// Gets the definition of a kind; null when there is none.
        /// </summary>
        private protected abstract IDefinition? GetDefinition(Guid kindId);

        /// <summary>
        /// Gets an entity's kind ID.
        /// </summary>
        private protected abstract Guid GetKindId(TEntity entity);

        /// <summary>
        /// Creates an entity from its parts. The data is the stored configuration text.
        /// </summary>
        private protected abstract TEntity CreateEntity(Guid id, Guid[] path, Guid kindId, string name, string? alias, string? data);

        /// <summary>
        /// Creates the response for an entity.
        /// </summary>
        private protected abstract TResponse ToResponse(TEntity entity);

        /// <summary>
        /// Gets the code the site runs when it builds an item of the entity's kind from its configuration.
        /// </summary>
        /// <returns>The kind's name and that code; null when the kind is not installed, so the configuration stays as sent.</returns>
        private protected abstract (string Kind, Action Read)? GetConfigurationReader(TEntity entity);

        /// <summary>
        /// Checks an entity can be changed. Null means it can; a result says why not.
        /// </summary>
        private protected virtual ServiceResult<TResponse>? CheckUpdatable(TEntity entity) => null;

        /// <summary>
        /// Gets an item.
        /// </summary>
        protected ServiceResult<TResponse> GetItem(Guid id)
        {
            var entity = _repository.Get(id);

            return entity is null ? NotFound(id) : ServiceResult<TResponse>.Success(ToResponse(entity));
        }

        /// <summary>
        /// Creates an item.
        /// </summary>
        protected ServiceResult<TResponse> CreateItem(Guid id, Guid? parentId, Guid kindId, string name, string? alias, JsonElement? configuration)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                return ServiceResult<TResponse>.Invalid("name", "The name is required.");
            }

            var definition = GetDefinition(kindId);

            if (definition is null || definition.IsLegacy)
            {
                return ServiceResult<TResponse>.Invalid("kindId", $"{kindId} is not a {KindNoun} that can be created.");
            }

            var problem = CreatePlacement.Check<TResponse>(_treeRepository, Tree, TreeLabel, id, parentId, out var parentPath);

            if (problem is not null)
            {
                return problem;
            }

            var entity = CreateEntity(id, parentPath.Append(id).ToArray(), kindId, name, alias, ConfigurationJson.ToStored(configuration));
            var unreadable = CheckConfiguration(entity);

            if (unreadable is not null)
            {
                return unreadable;
            }

            return ServiceResult<TResponse>.Success(ToResponse(_repository.Save(entity)));
        }

        /// <summary>
        /// Replaces an item's name, alias and configuration, keeping its kind and place.
        /// </summary>
        protected ServiceResult<TResponse> UpdateItem(Guid id, string name, string? alias, JsonElement? configuration)
        {
            var existing = _repository.Get(id);

            if (existing is null)
            {
                return NotFound(id);
            }

            var notUpdatable = CheckUpdatable(existing);

            if (notUpdatable is not null)
            {
                return notUpdatable;
            }

            if (string.IsNullOrWhiteSpace(name))
            {
                return ServiceResult<TResponse>.Invalid("name", "The name is required.");
            }

            var entity = CreateEntity(existing.Id, existing.Path, GetKindId(existing), name, alias, ConfigurationJson.ToStored(configuration));
            var unreadable = CheckConfiguration(entity);

            if (unreadable is not null)
            {
                return unreadable;
            }

            return ServiceResult<TResponse>.Success(ToResponse(_repository.Save(entity)));
        }

        /// <summary>
        /// Deletes an item. Whatever still refers to it is left alone.
        /// </summary>
        protected ServiceResult<DeleteResponseModel> DeleteItem(Guid id)
        {
            if (_repository.Get(id) is null)
            {
                return ServiceResult<DeleteResponseModel>.NotFound($"The {ItemNoun} {id} does not exist.");
            }

            _repository.Delete(id);

            return ServiceResult<DeleteResponseModel>.Success(new DeleteResponseModel { DeletedIds = new[] { id } });
        }

        private ServiceResult<TResponse> NotFound(Guid id) =>
            ServiceResult<TResponse>.NotFound($"The {ItemNoun} {id} does not exist.");

        /// <summary>
        /// Checks the item's kind can read its configuration. A kind that is not installed keeps the
        /// configuration exactly as sent.
        /// </summary>
        private ServiceResult<TResponse>? CheckConfiguration(TEntity entity)
        {
            var reader = GetConfigurationReader(entity);

            if (reader is null)
            {
                return null;
            }

            var (kind, read) = reader.Value;

            return _configurationJson.CanRead(read, kind, $"{ItemNoun} '{entity.Name}' ({entity.Id})")
                ? null
                : ServiceResult<TResponse>.Invalid("configuration", $"The {kind} kind can not read the configuration of {ItemNoun} '{entity.Name}'.");
        }
    }
}
