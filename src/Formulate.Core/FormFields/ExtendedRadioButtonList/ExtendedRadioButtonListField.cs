namespace Formulate.Core.FormFields.ExtendedRadioButtonList
{
    using System.Collections.Generic;
    using Formulate.Core.Validations;

    /// <summary>
    /// A list of radio buttons that each show a description under their label.
    /// </summary>
    public sealed class ExtendedRadioButtonListField : FormField<ExtendedRadioButtonListFieldConfiguration>
    {
        /// <inheritdoc />
        public ExtendedRadioButtonListField(IFormFieldSettings settings, IReadOnlyCollection<IValidation> validations, ExtendedRadioButtonListFieldConfiguration configuration) : base(settings, validations, configuration)
        {
        }

        /// <inheritdoc />
        public ExtendedRadioButtonListField(IFormFieldSettings settings, ExtendedRadioButtonListFieldConfiguration config) : base(settings, config)
        {
        }
    }
}
