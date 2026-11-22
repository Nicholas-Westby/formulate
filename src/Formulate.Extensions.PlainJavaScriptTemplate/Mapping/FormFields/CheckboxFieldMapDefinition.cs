namespace Formulate.Extensions.PlainJavaScriptTemplate.Core.Mapping.FormFields
{
    using Formulate.Core.FormFields.Checkbox;
    using Formulate.Extensions.PlainJavaScriptTemplate;
    using Umbraco.Cms.Core.Mapping;

    public sealed class CheckboxFieldMapDefinition : FormFieldMapDefinition<CheckboxField>
    {
        protected override PlainJavaScriptFormField Map(CheckboxField field, MapperContext context)
        {
            return new PlainJavaScriptFormField("checkbox");
        }
    }
}
