namespace Formulate.Core.FormFields.Hidden
{
    using Formulate.Core.Utilities;
    // Namespaces.
    using System;

    /// <summary>
    /// A hidden form field definition.
    /// </summary>
    public sealed class HiddenFieldDefinition : FormFieldDefinition<HiddenField>
    {
        private readonly IJsonUtility _jsonUtility;

        public HiddenFieldDefinition(IJsonUtility jsonUtility)
        {
            _jsonUtility = jsonUtility;
        }

        /// <summary>
        /// Constants related to <see cref="HiddenFieldDefinition"/>.
        /// </summary>
        public static class Constants
        {
            /// <summary>
            /// The kind ID.
            /// </summary>
            public const string KindId = "3DF6FACD2FFA4055B0BE94E8FA8E7C4A";

            /// <summary>
            /// The name.
            /// </summary>
            public const string Name = "Hidden";

            /// <summary>
            /// The icon.
            /// </summary>
            public const string Icon = "icon-readonly";

            /// <summary>
            /// The back office editor alias.
            /// </summary>
            public const string EditorAlias = "formulate-hidden-field";
        }

        /// <inheritdoc />
        public override string EditorAlias => Constants.EditorAlias;

        /// <inheritdoc />
        public override string Name => Constants.Name;

        /// <inheritdoc />
        public override string Category => FormFieldConstants.Categories.Constants;

        /// <inheritdoc />
        public override string Icon => Constants.Icon;

        /// <inheritdoc />
        public override Guid KindId => Guid.Parse(Constants.KindId);

        /// <inheritdoc />
        public override bool SupportsLabel => false;

        /// <inheritdoc />
        public override bool SupportsValidation => false;

        /// <inheritdoc />
        public override FormField CreateField(IFormFieldSettings settings)
        {
            var configuration = _jsonUtility.Deserialize<HiddenFieldConfiguration>(settings.Data);

            return new HiddenField(settings, configuration);
        }

        /// <inheritdoc />
        public override object GetBackOfficeConfiguration(IFormFieldSettings settings)
        {
            return _jsonUtility.Deserialize<HiddenFieldConfiguration>(settings.Data) ?? new HiddenFieldConfiguration();
        }
    }
}