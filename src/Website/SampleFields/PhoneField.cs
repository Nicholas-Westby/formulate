using Formulate.Core.FormFields;

namespace Website.SampleFields;

/// <summary>
/// The sample Phone field: a field for a phone number. docs/extending.md and formulate.rocks show this same code.
/// </summary>
public sealed class PhoneField : FormField
{
    public PhoneField(IFormFieldSettings settings) : base(settings)
    {
    }
}
