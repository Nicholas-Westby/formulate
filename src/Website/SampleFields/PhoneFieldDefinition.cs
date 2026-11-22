using Formulate.Core.FormFields;

namespace Website.SampleFields;

/// <summary>
/// The kind of the sample Phone field. Formulate finds field definitions by scanning the site's assemblies.
/// </summary>
public sealed class PhoneFieldDefinition : FormFieldDefinition<PhoneField>
{
    public override Guid KindId => Guid.Parse("6A7E3C1B-5C0B-4C57-9B5A-3D4B1D6B2F11");

    public override string Name => "Phone";

    public override string Icon => "icon-phone";

    public override string Category => FormFieldConstants.Categories.Inputs;

    // The alias of the back office editor for the field's settings. The Phone field has no settings, so no editor
    // is registered for it, and the back office shows "No settings".
    public override string EditorAlias => "my-phone-field";

    public override FormField CreateField(IFormFieldSettings settings)
    {
        return new PhoneField(settings);
    }
}
