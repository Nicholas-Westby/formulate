namespace Formulate.Core.Utilities.Internal
{
    // Namespaces.
    using DataValues;
    using Microsoft.Extensions.Logging;
    using System;
    using System.Collections.Generic;

    /// <summary>
    /// The default implementation of <see cref="IGetDataValuesItemsUtility"/>/
    /// </summary>
    internal sealed class GetDataValuesItemsUtility : IGetDataValuesItemsUtility
    {
        /// <summary>
        /// The data values factory.
        /// </summary>
        private readonly IDataValuesFactory _dataValuesFactory;

        /// <summary>
        /// The data values entity repository.
        /// </summary>
        private readonly IDataValuesEntityRepository _dataValuesRepository;

        /// <summary>
        /// The logger.
        /// </summary>
        private readonly ILogger<GetDataValuesItemsUtility> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="GetDataValuesItemsUtility"/>
        /// class.
        /// </summary>
        /// <param name="dataValuesFactory">
        /// The data values factory.
        /// </param>
        /// <param name="dataValuesRepository">
        /// The data values entity repo.
        /// </param>
        /// <param name="logger">
        /// The logger.
        /// </param>
        public GetDataValuesItemsUtility(IDataValuesFactory dataValuesFactory,
            IDataValuesEntityRepository dataValuesRepository,
            ILogger<GetDataValuesItemsUtility> logger)
        {
            _dataValuesFactory = dataValuesFactory;
            _dataValuesRepository = dataValuesRepository;
            _logger = logger;
        }

        /// <inheritdoc />
        public IReadOnlyCollection<KeyValuePair<string, string>> GetValues(Guid id, Guid fieldId)
        {
            // A field that has no data values chosen yet is not a problem worth logging.
            if (id == Guid.Empty)
            {
                return Array.Empty<KeyValuePair<string, string>>();
            }

            var settings = _dataValuesRepository.Get(id);

            if (settings is null)
            {
                _logger.LogWarning(
                    "Form field {FieldId} references data values {DataValuesId}, which no longer exist. It will have no items.",
                    fieldId,
                    id);
                return Array.Empty<KeyValuePair<string, string>>();
            }

            var definition = _dataValuesFactory.Create(settings);

            if (definition is null)
            {
                _logger.LogWarning(
                    "Form field {FieldId} references data values {DataValuesId}, which have an unknown kind. It will have no items.",
                    fieldId,
                    id);
                return Array.Empty<KeyValuePair<string, string>>();
            }

            return definition.Items;
        }
    }
}