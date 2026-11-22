namespace Formulate.Core.DataValues
{
    // Namespaces.
    using System;
    using Microsoft.Extensions.Logging;
    using Types;

    /// <summary>
    /// The default implementation of <see cref="IDataValuesFactory"/> using the <see cref="DataValuesDefinitionCollection"/>.
    /// </summary>
    internal sealed class DataValuesFactory : IDataValuesFactory
    {
        /// <summary>
        /// The data values.
        /// </summary>
        private readonly DataValuesDefinitionCollection _dataValuesDefinitions;

        /// <summary>
        /// The logger.
        /// </summary>
        private readonly ILogger<DataValuesFactory> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="DataValuesFactory"/> class.
        /// </summary>
        /// <param name="dataValuesDefinitions">The data values.</param>
        /// <param name="logger">The logger.</param>
        public DataValuesFactory(DataValuesDefinitionCollection dataValuesDefinitions, ILogger<DataValuesFactory> logger)
        {
            _dataValuesDefinitions = dataValuesDefinitions;
            _logger = logger;
        }

        /// <inheritdoc />
        /// <remarks>
        /// Gives null when the kind is not installed, or when the kind can not read the configuration
        /// (such as a file that was edited by hand). The second is logged as a warning, so the fields
        /// that use the data values get no items rather than failing.
        /// </remarks>
        public IDataValues Create(PersistedDataValues entity)
        {
            if (entity is null)
            {
                throw new ArgumentNullException(nameof(entity));
            }

            var foundDataValuesDefinition = _dataValuesDefinitions.FirstOrDefault(entity.KindId);

            if (foundDataValuesDefinition is null)
            {
                return default;
            }

            try
            {
                return foundDataValuesDefinition.CreateDataValues(entity);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Skipping data values {DataValuesName} ({DataValuesId}) because their kind, {KindName} ({KindId}), could not read their configuration.",
                    entity.Name,
                    entity.Id,
                    foundDataValuesDefinition.Name,
                    entity.KindId);

                return default;
            }
        }
    }
}