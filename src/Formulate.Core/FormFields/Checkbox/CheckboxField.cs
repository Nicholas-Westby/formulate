namespace Formulate.Core.FormFields.Checkbox
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using Formulate.Core.Submissions.Requests;
    using Formulate.Core.Validations;
    using Microsoft.Extensions.Primitives;

    /// <summary>
    /// A single checkbox.
    /// </summary>
    /// <remarks>
    /// The renderer always posts "true" or "false". Only "true" or "on" (ignoring case) counts as checked when
    /// the validations run, so a Mandatory validation fails an unchecked box. The value is kept as it was
    /// posted for Store Data, Email and Send Data.
    /// </remarks>
    public sealed class CheckboxField : FormField
    {
        /// <inheritdoc />
        public CheckboxField(IFormFieldSettings settings) : base(settings)
        {
        }

        /// <inheritdoc />
        public CheckboxField(IFormFieldSettings settings, IReadOnlyCollection<IValidation> validations) : base(settings, validations)
        {
        }

        /// <summary>
        /// Gets a value indicating whether a posted value means the box is checked.
        /// </summary>
        /// <param name="value">The posted value.</param>
        /// <returns>True for "true" or "on", ignoring case.</returns>
        public static bool IsChecked(string value)
        {
            return string.Equals(value, "true", StringComparison.OrdinalIgnoreCase)
                || string.Equals(value, "on", StringComparison.OrdinalIgnoreCase);
        }

        /// <inheritdoc />
        protected override FormFieldValidationResult ValidateStrings(IStringFormFieldValues strings)
        {
            // An unchecked box is no value at all as far as the validations are concerned.
            var checkedValues = strings.GetValues().Where(IsChecked).ToArray();

            return base.ValidateStrings(new StringFormFieldValues(new StringValues(checkedValues)));
        }
    }
}
