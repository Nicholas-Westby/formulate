namespace Formulate.Core.Validations
{
    // Namespaces.
    using System;
    using Microsoft.Extensions.Logging;
    using Types;

    /// <summary>
    /// The default implementation of <see cref="IValidationFactory"/> using the <see cref="ValidationDefinitionCollection"/>.
    /// </summary>
    internal sealed class ValidationFactory : IValidationFactory
    {
        /// <summary>
        /// The validation definitions.
        /// </summary>
        private readonly ValidationDefinitionCollection _validationDefinitions;

        /// <summary>
        /// The logger.
        /// </summary>
        private readonly ILogger<ValidationFactory> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="ValidationFactory"/> class.
        /// </summary>
        /// <param name="validationDefinitions">The validation definitions.</param>
        /// <param name="logger">The logger.</param>
        public ValidationFactory(ValidationDefinitionCollection validationDefinitions, ILogger<ValidationFactory> logger)
        {
            _validationDefinitions = validationDefinitions;
            _logger = logger;
        }

        /// <inheritdoc />
        /// <remarks>
        /// Gives null when the kind is not installed, or when the kind can not read the configuration
        /// (such as a file that was edited by hand). The second is logged as a warning, so the fields
        /// that use the validation are shown without it rather than failing.
        /// </remarks>
        /// <exception cref="ArgumentNullException">The provided settings are null.</exception>
        public IValidation Create(PersistedValidation settings)
        {
            if (settings is null)
            {
                throw new ArgumentNullException(nameof(settings));
            }

            var foundValidationDefinition = _validationDefinitions.FirstOrDefault(settings.KindId);

            if (foundValidationDefinition is null)
            {
                return default;
            }

            try
            {
                var validation = foundValidationDefinition.CreateValidation(settings);

                // Set the attributes on the validation that can be obtained from
                // the validation definition.
                validation.Name = settings.Name;
                validation.BackOfficeConfiguration = foundValidationDefinition
                    .GetBackOfficeConfiguration(settings);

                return validation;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Skipping validation {ValidationName} ({ValidationId}) because its kind, {KindName} ({KindId}), could not read its configuration.",
                    settings.Name,
                    settings.Id,
                    foundValidationDefinition.Name,
                    settings.KindId);

                return default;
            }
        }
    }
}