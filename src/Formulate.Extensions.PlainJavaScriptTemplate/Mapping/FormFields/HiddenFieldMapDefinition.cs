namespace Formulate.Extensions.PlainJavaScriptTemplate.Core.Mapping.FormFields
{
    using Formulate.Core.FormFields.Hidden;
    using Umbraco.Cms.Core.Mapping;

    public sealed class HiddenFieldMapDefinition : FormFieldMapDefinition<HiddenField>
    {
        protected override PlainJavaScriptFormField Map(HiddenField field, MapperContext context)
        {
            var config = new
            {
                text = field.Configuration.Text
            };

            return new PlainJavaScriptFormField(config, "hidden");
        }
    }
}
