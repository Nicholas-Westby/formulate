namespace Formulate.Core.FormFields.ExtendedRadioButtonList
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using Formulate.Core.Utilities;

    /// <summary>
    /// An extended radio button list form field definition. Its items come from a Pair List of data values:
    /// the primary text is each item's value and label, and the secondary text is its description.
    /// </summary>
    public sealed class ExtendedRadioButtonListFieldDefinition : FormFieldDefinitionBase<ExtendedRadioButtonListField>
    {
        private readonly IJsonUtility _jsonUtility;

        private readonly IGetDataValuesItemsUtility _getDataValuesItemsUtility;

        /// <summary>
        /// Constants related to <see cref="ExtendedRadioButtonListFieldDefinition"/>.
        /// </summary>
        public static class Constants
        {
            /// <summary>
            /// The kind ID, the same as Formulate 3's.
            /// </summary>
            public const string KindId = "8B277AF31B1F469897D23900C6621C7D";

            /// <summary>
            /// The name.
            /// </summary>
            public const string Name = "Extended Radio Button List";

            /// <summary>
            /// The back office editor alias.
            /// </summary>
            public const string EditorAlias = "formulate-extended-radio-button-list-field";

            /// <summary>
            /// The icon.
            /// </summary>
            public const string Icon = "icon-record";
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

        /// <summary>
        /// Initializes a new instance of the <see cref="ExtendedRadioButtonListFieldDefinition"/> class.
        /// </summary>
        /// <param name="jsonUtility">The json utility.</param>
        /// <param name="getDataValuesItemsUtility">The get data values items utility.</param>
        public ExtendedRadioButtonListFieldDefinition(
            IJsonUtility jsonUtility,
            IGetDataValuesItemsUtility getDataValuesItemsUtility)
        {
            _jsonUtility = jsonUtility;
            _getDataValuesItemsUtility = getDataValuesItemsUtility;
        }

        /// <inheritdoc />
        public override FormField CreateField(IFormFieldSettings settings)
        {
            var items = new List<ExtendedRadioButtonListFieldItem>();
            var preValues = _jsonUtility.Deserialize<ExtendedRadioButtonListFieldPreValues>(settings.Data);

            if (preValues is null || preValues.DataValue == Guid.Empty)
            {
                // Reading the configuration stays quiet: a new field is saved before anyone picks a data value.
                // The renderer's map logs a field that has none.
            }
            else
            {
                var values = _getDataValuesItemsUtility.GetValues(preValues.DataValue, settings.Id);

                if (values is not null)
                {
                    // As in Formulate 3: the pair's primary text (its value) is the item, and the secondary text
                    // (its key) is the description, unless it repeats the primary text.
                    items.AddRange(values.Select(x => new ExtendedRadioButtonListFieldItem()
                    {
                        Selected = false,
                        Value = x.Value,
                        Label = x.Value,
                        Description = x.Key == x.Value ? string.Empty : x.Key
                    }));
                }
            }

            var config = new ExtendedRadioButtonListFieldConfiguration()
            {
                Items = items,
                Orientation = preValues?.Orientation,
                HasDataValue = preValues is not null && preValues.DataValue != Guid.Empty
            };

            return new ExtendedRadioButtonListField(settings, config);
        }

        /// <inheritdoc />
        public override object GetBackOfficeConfiguration(IFormFieldSettings settings)
        {
            if (settings is null)
            {
                return default;
            }

            return _jsonUtility.Deserialize<ExtendedRadioButtonListFieldPreValues>(settings.Data)
                ?? new ExtendedRadioButtonListFieldPreValues();
        }
    }
}
