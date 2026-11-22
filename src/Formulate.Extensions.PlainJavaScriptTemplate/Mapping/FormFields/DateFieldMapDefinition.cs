namespace Formulate.Extensions.PlainJavaScriptTemplate.Core.Mapping.FormFields
{
    using Formulate.Core.FormFields.Date;
    using Formulate.Extensions.PlainJavaScriptTemplate;
    using Umbraco.Cms.Core.Mapping;

    public sealed class DateFieldMapDefinition : FormFieldMapDefinition<DateField>
    {
        protected override PlainJavaScriptFormField Map(DateField field, MapperContext context)
        {
            return new PlainJavaScriptFormField("date");
        }
    }
}
