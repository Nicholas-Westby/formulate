namespace Formulate.BackOffice.Api.Services
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using Formulate.BackOffice.Api.Json;
    using Formulate.BackOffice.Api.Models.Definition;
    using Formulate.BackOffice.Utilities;
    using Formulate.Core.DataValues;
    using Formulate.Core.FormFields;
    using Formulate.Core.FormHandlers;
    using Formulate.Core.Layouts;
    using Formulate.Core.Templates;
    using Formulate.Core.Types;
    using Formulate.Core.Validations;

    /// <summary>
    /// The default implementation of <see cref="IDefinitionApiService"/>.
    /// </summary>
    /// <remarks>
    /// A kind's default configuration is what its definition describes for the back office when nothing
    /// is stored yet, so the client can start a new item from it. A layout kind can start new layouts with
    /// another (<see cref="ILayoutDefinition.GetDefaultConfiguration"/>).
    /// </remarks>
    public sealed class DefinitionApiService : IDefinitionApiService
    {
        private readonly FormFieldDefinitionCollection _fieldDefinitions;

        private readonly FormHandlerDefinitionCollection _handlerDefinitions;

        private readonly ValidationDefinitionCollection _validationDefinitions;

        private readonly DataValuesDefinitionCollection _dataValuesDefinitions;

        private readonly LayoutDefinitionCollection _layoutDefinitions;

        private readonly TemplateDefinitionCollection _templateDefinitions;

        private readonly IGetDefaultTemplateId _defaultTemplateId;

        private readonly ConfigurationJson _configurationJson;

        /// <inheritdoc cref="DefinitionApiService"/>
        public DefinitionApiService(
            FormFieldDefinitionCollection fieldDefinitions,
            FormHandlerDefinitionCollection handlerDefinitions,
            ValidationDefinitionCollection validationDefinitions,
            DataValuesDefinitionCollection dataValuesDefinitions,
            LayoutDefinitionCollection layoutDefinitions,
            TemplateDefinitionCollection templateDefinitions,
            IGetDefaultTemplateId defaultTemplateId,
            ConfigurationJson configurationJson)
        {
            _fieldDefinitions = fieldDefinitions;
            _handlerDefinitions = handlerDefinitions;
            _validationDefinitions = validationDefinitions;
            _dataValuesDefinitions = dataValuesDefinitions;
            _layoutDefinitions = layoutDefinitions;
            _templateDefinitions = templateDefinitions;
            _defaultTemplateId = defaultTemplateId;
            _configurationJson = configurationJson;
        }

        /// <inheritdoc />
        public IReadOnlyList<FormFieldDefinitionModel> GetFormFields()
        {
            return _fieldDefinitions
                .Where(definition => !definition.IsLegacy)
                .Select(definition => new FormFieldDefinitionModel
                {
                    KindId = definition.KindId,
                    Name = definition.Name,
                    Icon = definition.Icon,
                    Category = definition.Category,
                    EditorAlias = definition.EditorAlias,
                    SupportsLabel = definition.SupportsLabel,
                    SupportsValidation = definition.SupportsValidation,
                    SupportsCategory = definition.SupportsCategory,
                    IsServerSideOnly = definition.IsServerSideOnly,
                    IsStored = definition.IsStored,
                    IsHidden = definition.IsHidden,
                    IsTransitory = definition.IsTransitory,
                    DefaultConfiguration = _configurationJson.DefaultFromDefinition(
                        () => definition.GetBackOfficeConfiguration(new PersistedFormField { KindId = definition.KindId }),
                        definition.Name),
                })
                .ToArray();
        }

        /// <inheritdoc />
        public IReadOnlyList<FormHandlerDefinitionModel> GetFormHandlers()
        {
            return _handlerDefinitions
                .Where(definition => !definition.IsLegacy)
                .Select(definition => new FormHandlerDefinitionModel
                {
                    KindId = definition.KindId,
                    Name = definition.Name,
                    Icon = definition.Icon,
                    Category = definition.Category,
                    EditorAlias = definition.EditorAlias,
                    DefaultConfiguration = _configurationJson.DefaultFromDefinition(
                        () => definition.GetBackOfficeConfiguration(new PersistedFormHandler { KindId = definition.KindId }),
                        definition.Name),
                })
                .ToArray();
        }

        /// <inheritdoc />
        public IReadOnlyList<KindDefinitionModel> GetValidations() =>
            Kinds(
                _validationDefinitions,
                _ => FormulateIcons.For(EntityTypes.Validation, null),
                definition => definition.GetBackOfficeConfiguration(new PersistedValidation { KindId = definition.KindId }));

        /// <inheritdoc />
        public IReadOnlyList<KindDefinitionModel> GetDataValues() =>
            Kinds(
                _dataValuesDefinitions,
                definition => FormulateIcons.For(EntityTypes.DataValues, definition.Icon),
                definition => definition.GetBackOfficeConfiguration(new PersistedDataValues { KindId = definition.KindId }));

        /// <inheritdoc />
        public IReadOnlyList<KindDefinitionModel> GetLayouts() =>
            Kinds(
                _layoutDefinitions,
                _ => FormulateIcons.For(EntityTypes.Layout, null),
                definition => definition.GetDefaultConfiguration());

        /// <inheritdoc />
        public IReadOnlyList<TemplateDefinitionModel> GetTemplates()
        {
            // The template a layout saved without one gets. Only its first entry is marked, so exactly one
            // template is the default whenever any is installed.
            var defaultId = _defaultTemplateId.GetValue();
            var marked = false;

            return _templateDefinitions
                .Select(definition =>
                {
                    var isDefault = !marked && definition.KindId == defaultId;
                    marked |= isDefault;

                    return new TemplateDefinitionModel { Id = definition.KindId, Name = definition.Name, IsDefault = isDefault };
                })
                .ToArray();
        }

        private KindDefinitionModel[] Kinds<T>(IEnumerable<T> definitions, Func<T, string> icon, Func<T, object?> defaultConfiguration)
            where T : IDefinition, IHaveEditor
        {
            return definitions
                .Select(definition => new KindDefinitionModel
                {
                    KindId = definition.KindId,
                    Name = definition.Name,
                    Icon = icon(definition),
                    EditorAlias = definition.EditorAlias,
                    IsLegacy = definition.IsLegacy,
                    DefaultConfiguration = _configurationJson.DefaultFromDefinition(() => defaultConfiguration(definition), definition.Name),
                })
                .ToArray();
        }
    }
}
