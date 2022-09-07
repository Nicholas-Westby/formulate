﻿namespace Formulate.BackOffice.Mapping.EditorModels
{
    using Formulate.BackOffice.EditorModels.Validation;
    using Formulate.Core.Types;
    using Formulate.Core.Utilities;
    using Formulate.Core.Validations;
    using Umbraco.Cms.Core.Mapping;

    internal sealed class ValidationEditorModelMapDefinition : EntityEditorModelMapDefinition<PersistedValidation, ValidationEditorModel>
    {
        private readonly IJsonUtility _jsonUtility;
        
        private readonly ValidationDefinitionCollection _validationDefinitions;

        public ValidationEditorModelMapDefinition(IJsonUtility jsonUtility, ValidationDefinitionCollection validationDefinitions)
        {
            _jsonUtility = jsonUtility;
            _validationDefinitions = validationDefinitions;
        }

        public override ValidationEditorModel? MapToEditor(PersistedValidation entity, MapperContext mapperContext)
        {
            var definition = _validationDefinitions.FirstOrDefault(entity.KindId);

            if (definition is null)
            {
                return default;
            }

            return new ValidationEditorModel(entity, mapperContext.IsNew(), definition.IsLegacy)
            {
                Data = definition.GetBackOfficeConfiguration(entity),
                Directive = definition.Directive
            };
        }

        public override PersistedValidation? MapToEntity(ValidationEditorModel editorModel, MapperContext mapperContext)
        {
            return new PersistedValidation()
            {
                Alias = editorModel.Alias,
                Id = editorModel.Id,
                KindId = editorModel.KindId,
                Name = editorModel.Name,
                Path = editorModel.Path,
                Data = _jsonUtility.Serialize(editorModel.Data)
            };
        }
    }
}