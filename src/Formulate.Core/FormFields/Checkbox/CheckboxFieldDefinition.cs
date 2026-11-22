namespace Formulate.Core.FormFields.Checkbox
{
    using System;

    /// <summary>
    /// A checkbox form field definition. It stores no configuration: a stored value (null, an empty object or
    /// anything Formulate 3 wrote) is ignored.
    /// </summary>
    public sealed class CheckboxFieldDefinition : FormFieldDefinition<CheckboxField>
    {
        /// <summary>
        /// Constants related to <see cref="CheckboxFieldDefinition"/>.
        /// </summary>
        public static class Constants
        {
            /// <summary>
            /// The kind ID, the same as Formulate 3's.
            /// </summary>
            public const string KindId = "99C1A656C7A644ACA787C18593327310";

            /// <summary>
            /// The name.
            /// </summary>
            public const string Name = "Checkbox";

            /// <summary>
            /// The icon.
            /// </summary>
            public const string Icon = "icon-checkbox";

            /// <summary>
            /// The back office editor alias.
            /// </summary>
            public const string EditorAlias = "formulate-checkbox-field";
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
            return new CheckboxField(settings);
        }
    }
}
