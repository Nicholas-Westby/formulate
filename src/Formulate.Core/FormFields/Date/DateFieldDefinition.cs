namespace Formulate.Core.FormFields.Date
{
    using System;

    /// <summary>
    /// A date form field definition. It stores no configuration: a stored value (null, an empty object or
    /// anything Formulate 3 wrote) is ignored.
    /// </summary>
    /// <remarks>
    /// It is the one place that writes a date for the Email handler and Send Data, through
    /// <see cref="IFormFieldValueFormatter"/>.
    /// </remarks>
    public sealed class DateFieldDefinition : FormFieldDefinition<DateField>, IFormFieldValueFormatter
    {
        /// <summary>
        /// Constants related to <see cref="DateFieldDefinition"/>.
        /// </summary>
        public static class Constants
        {
            /// <summary>
            /// The kind ID, the same as Formulate 3's.
            /// </summary>
            public const string KindId = "E70CB78CCF52461198B4556382F23119";

            /// <summary>
            /// The name.
            /// </summary>
            public const string Name = "Date";

            /// <summary>
            /// The icon.
            /// </summary>
            public const string Icon = "icon-formulate-date";

            /// <summary>
            /// The back office editor alias.
            /// </summary>
            public const string EditorAlias = "formulate-date-field";
        }

        /// <inheritdoc />
        public override Guid KindId => Guid.Parse(Constants.KindId);

        /// <inheritdoc />
        public override string Name => Constants.Name;

        /// <inheritdoc />
        public override string Icon => Constants.Icon;

        /// <inheritdoc />
        public override string EditorAlias => Constants.EditorAlias;

        /// <inheritdoc />
        public override string Category => FormFieldConstants.Categories.Inputs;

        /// <inheritdoc />
        public override FormField CreateField(IFormFieldSettings settings)
        {
            return new DateField(settings);
        }

        /// <inheritdoc />
        public string FormatValue(string value)
        {
            return DateField.Format(value);
        }
    }
}
