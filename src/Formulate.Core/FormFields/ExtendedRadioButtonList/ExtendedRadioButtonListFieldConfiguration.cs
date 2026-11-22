namespace Formulate.Core.FormFields.ExtendedRadioButtonList
{
    using System.Collections.Generic;

    /// <summary>
    /// Configuration required by <see cref="ExtendedRadioButtonListField"/>.
    /// </summary>
    public sealed class ExtendedRadioButtonListFieldConfiguration
    {
        /// <summary>
        /// Gets or sets the items.
        /// </summary>
        public IEnumerable<ExtendedRadioButtonListFieldItem> Items { get; set; }

        /// <summary>
        /// Gets or sets the orientation.
        /// </summary>
        public string Orientation { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether a data value is chosen. A field with none has no items.
        /// </summary>
        public bool HasDataValue { get; set; }
    }
}
