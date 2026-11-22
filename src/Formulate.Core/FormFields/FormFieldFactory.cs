namespace Formulate.Core.FormFields
{
    // Namespaces.
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using Microsoft.Extensions.Logging;
    using Types;
    using Validations;

    /// <summary>
    /// The default implementation of <see cref="IFormFieldFactory"/> using the <see cref="FormFieldDefinitionCollection"/>.
    /// </summary>
    internal sealed class FormFieldFactory : IFormFieldFactory
    {
        /// <summary>
        /// The form field definitions.
        /// </summary>
        private readonly FormFieldDefinitionCollection _formFieldDefinitions;

        /// <inheritdoc cref="IValidationFactory" />
        private readonly IValidationFactory _validationFactory;

        /// <inheritdoc cref="IValidationEntityRepository" />
        private readonly IValidationEntityRepository _validationEntityRepository;

        /// <inheritdoc cref="ILogger" />
        private readonly ILogger<FormFieldFactory> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="FormFieldFactory"/> class.
        /// </summary>
        /// <param name="formFieldDefinitions">
        /// The form field definitions.
        /// </param>
        /// <param name="validationFactory">
        /// Factory for creating validations.
        /// </param>
        /// <param name="validationEntityRepository">
        /// The repository of validations.
        /// </param>
        /// <param name="logger">
        /// The logger.
        /// </param>
        public FormFieldFactory(FormFieldDefinitionCollection formFieldDefinitions,
            IValidationFactory validationFactory,
            IValidationEntityRepository validationEntityRepository,
            ILogger<FormFieldFactory> logger)
        {
            _formFieldDefinitions = formFieldDefinitions;
            _validationFactory = validationFactory;
            _validationEntityRepository = validationEntityRepository;
            _logger = logger;
        }

        /// <inheritdoc />
        /// <exception cref="ArgumentNullException">
        /// The provided settings are null.
        /// </exception>
        public IFormField Create(IFormFieldSettings settings)
        {
            if (settings is null)
            {
                throw new ArgumentNullException(nameof(settings));
            }

            var foundFormFieldDefinition = _formFieldDefinitions.FirstOrDefault(settings.KindId);

            if (foundFormFieldDefinition is null)
            {
                return default;
            }

            // Create an instance of the form field.
            var field = foundFormFieldDefinition.CreateField(settings);

            // Set the attributes on the form field that can be obtained from
            // the form field definition.
            field.Icon = foundFormFieldDefinition.Icon;
            field.EditorAlias = foundFormFieldDefinition.EditorAlias;
            field.BackOfficeConfiguration = foundFormFieldDefinition
                .GetBackOfficeConfiguration(settings);

            // Set the validations.
            // Validations that were deleted (or have an unknown kind) are skipped.
            var validations = new List<IValidation>();

            foreach (var validationId in settings.Validations ?? Array.Empty<Guid>())
            {
                var persistedValidation = _validationEntityRepository.Get(validationId);

                if (persistedValidation is null)
                {
                    _logger.LogWarning(
                        "Form field {FieldId} references validation {ValidationId}, which no longer exists. Skipping it.",
                        settings.Id,
                        validationId);
                    continue;
                }

                var validation = _validationFactory.Create(persistedValidation);

                if (validation is null)
                {
                    _logger.LogWarning(
                        "Form field {FieldId} references validation {ValidationId}, which has an unknown kind. Skipping it.",
                        settings.Id,
                        validationId);
                    continue;
                }

                validations.Add(validation);
            }

            field.Validations = validations.ToArray();

            // Return the form field.
            return field;
        }
    }
}