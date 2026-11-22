namespace Formulate.BackOffice.Api.Services
{
    using System;
    using Formulate.BackOffice.Api.Json;
    using Formulate.BackOffice.Api.Models.Shared;
    using Formulate.BackOffice.Api.Models.Validation;
    using Formulate.BackOffice.Persistence;
    using Formulate.Core.Types;
    using Formulate.Core.Validations;

    /// <summary>
    /// The default implementation of <see cref="IValidationApiService"/>.
    /// </summary>
    public sealed class ValidationApiService : ConfiguredItemApiService<PersistedValidation, ValidationResponseModel>, IValidationApiService
    {
        private readonly ValidationDefinitionCollection _definitions;

        private readonly ConfigurationJson _configurationJson;

        /// <inheritdoc cref="ValidationApiService"/>
        public ValidationApiService(
            IValidationEntityRepository repository,
            ITreeEntityRepository treeRepository,
            ValidationDefinitionCollection definitions,
            ConfigurationJson configurationJson,
            ApiWriteLock writeLock)
            : base(repository, treeRepository, configurationJson, writeLock)
        {
            _definitions = definitions;
            _configurationJson = configurationJson;
        }

        /// <inheritdoc />
        private protected override TreeTypes Tree => TreeTypes.Validations;

        /// <inheritdoc />
        private protected override string TreeLabel => "Validations";

        /// <inheritdoc />
        private protected override string ItemNoun => "validation";

        /// <inheritdoc />
        private protected override string KindNoun => "validation kind";

        /// <inheritdoc />
        public ServiceResult<ValidationResponseModel> Get(Guid id) => GetItem(id);

        /// <inheritdoc />
        public ServiceResult<ValidationResponseModel> Create(CreateValidationRequestModel request) =>
            request is null
                ? RequestBody.Missing<ValidationResponseModel>()
                : CreateItem(request.Id, request.ParentId, request.KindId, request.Name, request.Alias, request.Configuration);

        /// <inheritdoc />
        public ServiceResult<ValidationResponseModel> Update(Guid id, UpdateValidationRequestModel request) =>
            request is null
                ? RequestBody.Missing<ValidationResponseModel>()
                : UpdateItem(id, request.Name, request.Alias, request.Configuration);

        /// <inheritdoc />
        // A form that still uses the validation is fine: rendering skips validations that are missing.
        public ServiceResult<DeleteResponseModel> Delete(Guid id) => DeleteItem(id);

        /// <inheritdoc />
        private protected override IDefinition? GetDefinition(Guid kindId) => _definitions.FirstOrDefault(kindId);

        /// <inheritdoc />
        private protected override Guid GetKindId(PersistedValidation entity) => entity.KindId;

        /// <inheritdoc />
        private protected override PersistedValidation CreateEntity(Guid id, Guid[] path, Guid kindId, string name, string? alias, string? data) =>
            new() { Id = id, Path = path, KindId = kindId, Name = name, Alias = alias, Data = data };

        /// <inheritdoc />
        // The same calls ValidationFactory makes when a form is shown.
        private protected override (string Kind, Action Read)? GetConfigurationReader(PersistedValidation entity)
        {
            var definition = _definitions.FirstOrDefault(entity.KindId);

            return definition is null
                ? null
                : (definition.Name, () =>
                {
                    definition.CreateValidation(entity);
                    definition.GetBackOfficeConfiguration(entity);
                });
        }

        /// <inheritdoc />
        private protected override ValidationResponseModel ToResponse(PersistedValidation validation)
        {
            var definition = _definitions.FirstOrDefault(validation.KindId);

            return new ValidationResponseModel
            {
                Id = validation.Id,
                Name = validation.Name,
                Alias = validation.Alias,
                ParentId = TreeEntities.GetParentId(validation),
                KindId = validation.KindId,
                Configuration = _configurationJson.FromDefinition(
                    definition is null ? null : () => definition.GetBackOfficeConfiguration(validation),
                    validation.Data,
                    $"validation '{validation.Name}' ({validation.Id})",
                    item: null),
            };
        }
    }
}
