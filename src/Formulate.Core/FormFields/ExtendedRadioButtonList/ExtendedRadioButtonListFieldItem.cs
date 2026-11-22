namespace Formulate.Core.FormFields.ExtendedRadioButtonList
{
    /// <summary>
    /// An individual item used by <see cref="ExtendedRadioButtonListField"/>.
    /// </summary>
    public sealed class ExtendedRadioButtonListFieldItem
    {
        /// <summary>
        /// Gets or sets a value indicating whether this item is selected.
        /// </summary>
        public bool Selected { get; set; }

        /// <summary>
        /// Gets or sets the value, which is the primary text of the Pair List item.
        /// </summary>
        public string Value { get; set; }

        /// <summary>
        /// Gets or sets the label, which is also the primary text.
        /// </summary>
        public string Label { get; set; }

        /// <summary>
        /// Gets or sets the description, which is the secondary text of the Pair List item.
        /// </summary>
        public string Description { get; set; }
    }
}
