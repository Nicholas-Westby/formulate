namespace Formulate.Extensions.PlainJavaScriptTemplate.Core.Mapping.FormFields
{
    using Formulate.Core.FormFields.ExtendedRadioButtonList;
    using Formulate.Extensions.PlainJavaScriptTemplate;
    using Microsoft.Extensions.Logging;
    using Umbraco.Cms.Core.Mapping;

    public sealed class ExtendedRadioButtonListFieldMapDefinition : FormFieldMapDefinition<ExtendedRadioButtonListField>
    {
        private readonly ILogger<ExtendedRadioButtonListFieldMapDefinition> _logger;

        public ExtendedRadioButtonListFieldMapDefinition(ILogger<ExtendedRadioButtonListFieldMapDefinition> logger)
        {
            _logger = logger;
        }

        protected override PlainJavaScriptFormField Map(ExtendedRadioButtonListField field, MapperContext context)
        {
            var fieldConfig = field.Configuration;

            // Logged here, when the form is rendered, and not when the configuration is read (which also happens on save).
            if (fieldConfig.HasDataValue == false)
            {
                _logger.LogWarning(
                    "Form field {FieldName} ({FieldId}) has no data value chosen, so it has no items. Choose a data value for it in the back office.",
                    field.Name,
                    field.Id);
            }

            var config = new
            {
                orientation = fieldConfig.Orientation,
                items = fieldConfig.Items.Select(y => new
                {
                    value = y.Value,
                    label = y.Label,
                    description = y.Description
                }).ToArray()
            };

            return new PlainJavaScriptFormField(config, "extended-radio-list");
        }
    }
}
