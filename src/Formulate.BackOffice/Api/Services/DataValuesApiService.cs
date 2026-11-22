namespace Formulate.BackOffice.Api.Services
{
    using System;
    using Formulate.BackOffice.Api.Json;
    using Formulate.BackOffice.Api.Models.DataValues;
    using Formulate.BackOffice.Api.Models.Shared;
    using Formulate.BackOffice.Persistence;
    using Formulate.Core.DataValues;
    using Formulate.Core.Types;

    /// <summary>
    /// The default implementation of <see cref="IDataValuesApiService"/>.
    /// </summary>
    public sealed class DataValuesApiService : ConfiguredItemApiService<PersistedDataValues, DataValuesResponseModel>, IDataValuesApiService
    {
        private readonly DataValuesDefinitionCollection _definitions;

        private readonly ConfigurationJson _configurationJson;

        /// <inheritdoc cref="DataValuesApiService"/>
        public DataValuesApiService(
            IDataValuesEntityRepository repository,
            ITreeEntityRepository treeRepository,
            DataValuesDefinitionCollection definitions,
            ConfigurationJson configurationJson)
            : base(repository, treeRepository, configurationJson)
        {
            _definitions = definitions;
            _configurationJson = configurationJson;
        }

        /// <inheritdoc />
        private protected override TreeTypes Tree => TreeTypes.DataValues;

        /// <inheritdoc />
        private protected override string TreeLabel => "Data Values";

        /// <inheritdoc />
        private protected override string ItemNoun => "data values item";

        /// <inheritdoc />
        private protected override string KindNoun => "data values kind";

        /// <inheritdoc />
        public ServiceResult<DataValuesResponseModel> Get(Guid id) => GetItem(id);

        /// <inheritdoc />
        public ServiceResult<DataValuesResponseModel> Create(CreateDataValuesRequestModel request) =>
            CreateItem(request.Id, request.ParentId, request.KindId, request.Name, request.Alias, request.Configuration);

        /// <inheritdoc />
        public ServiceResult<DataValuesResponseModel> Update(Guid id, UpdateDataValuesRequestModel request) =>
            UpdateItem(id, request.Name, request.Alias, request.Configuration);

        /// <inheritdoc />
        // A form that still uses the items is fine: the form is shown with no choices and a warning is logged.
        public ServiceResult<DeleteResponseModel> Delete(Guid id) => DeleteItem(id);

        /// <inheritdoc />
        private protected override IDefinition? GetDefinition(Guid kindId) => _definitions.FirstOrDefault(kindId);

        /// <inheritdoc />
        private protected override Guid GetKindId(PersistedDataValues entity) => entity.KindId;

        /// <inheritdoc />
        private protected override PersistedDataValues CreateEntity(Guid id, Guid[] path, Guid kindId, string name, string? alias, string? data) =>
            new() { Id = id, Path = path, KindId = kindId, Name = name, Alias = alias, Data = data };

        /// <inheritdoc />
        // The call DataValuesFactory makes when a field that uses the items is shown, and what GET shows.
        private protected override (string Kind, Action Read)? GetConfigurationReader(PersistedDataValues entity)
        {
            var definition = _definitions.FirstOrDefault(entity.KindId);

            return definition is null
                ? null
                : (definition.Name, () =>
                {
                    definition.CreateDataValues(entity);
                    definition.GetBackOfficeConfiguration(entity);
                });
        }

        /// <inheritdoc />
        private protected override ServiceResult<DataValuesResponseModel>? CheckUpdatable(PersistedDataValues entity)
        {
            if (_definitions.FirstOrDefault(entity.KindId)?.IsLegacy != true)
            {
                return null;
            }

            // The field is kindId because ServiceResult.Conflict requires a field, and the kind is the cause.
            return ServiceResult<DataValuesResponseModel>.Conflict("kindId", "Legacy data values can not be changed. Create new data values and use them instead.");
        }

        /// <inheritdoc />
        private protected override DataValuesResponseModel ToResponse(PersistedDataValues dataValues)
        {
            var definition = _definitions.FirstOrDefault(dataValues.KindId);

            return new DataValuesResponseModel
            {
                Id = dataValues.Id,
                Name = dataValues.Name,
                Alias = dataValues.Alias,
                ParentId = TreeEntities.GetParentId(dataValues),
                KindId = dataValues.KindId,
                IsLegacy = definition?.IsLegacy ?? false,
                Configuration = _configurationJson.FromDefinition(
                    definition is null ? null : () => definition.GetBackOfficeConfiguration(dataValues),
                    dataValues.Data,
                    $"data values '{dataValues.Name}' ({dataValues.Id})",
                    "its configuration"),
            };
        }
    }
}
