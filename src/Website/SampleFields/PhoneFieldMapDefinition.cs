using Formulate.Extensions.PlainJavaScriptTemplate.Core;
using Formulate.Extensions.PlainJavaScriptTemplate.Core.Mapping.FormFields;
using Umbraco.Cms.Core.Mapping;

namespace Website.SampleFields;

/// <summary>
/// What the browser gets for a Phone field: the field type "phone", which wwwroot/scripts/phone-field.js registers
/// a renderer for. To send the renderer a configuration too, pass it first, such as
/// <c>new PlainJavaScriptFormField(new { autocomplete = "tel" }, "phone")</c>: the renderer reads it as
/// <c>fieldData.configuration</c>.
/// </summary>
public sealed class PhoneFieldMapDefinition : FormFieldMapDefinition<PhoneField>
{
    protected override PlainJavaScriptFormField Map(PhoneField field, MapperContext context)
    {
        return new PlainJavaScriptFormField("phone");
    }
}
