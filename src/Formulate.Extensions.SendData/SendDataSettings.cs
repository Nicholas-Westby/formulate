namespace Formulate.Extensions.SendData
{
    /// <summary>
    /// The Send Data settings, read from the "Formulate:SendData" configuration section.
    /// </summary>
    public sealed class SendDataSettings
    {
        /// <summary>
        /// The configuration section.
        /// </summary>
        public const string SectionName = "Formulate:SendData";

        /// <summary>
        /// The JSON top level is a plain object. This is the default.
        /// </summary>
        public const string ObjectJsonMode = "Object";

        /// <summary>
        /// The JSON top level is an array holding the object, which was Formulate 3's default.
        /// </summary>
        public const string WrappedArrayJsonMode = "WrappedArray";

        /// <summary>
        /// Gets or sets the JSON top level of the "JSON" transmission format: "Object" (the default) or
        /// "WrappedArray", which sends <c>[ {...} ]</c> as Formulate 3 did unless its "Formulate:Send Data JSON
        /// Mode" setting was "JSON Object". It does not change "HubSpot JSON". Read ignoring case.
        /// </summary>
        public string JsonMode { get; set; } = ObjectJsonMode;
    }
}
