namespace Formulate.Extensions.PlainJavaScriptTemplate.Core
{
    /// <summary>
    /// The settings in the "Formulate:PlainJavaScript" configuration section.
    /// </summary>
    public sealed class PlainJavaScriptOptions
    {
        /// <summary>
        /// The name of the configuration section.
        /// </summary>
        public const string SectionName = "Formulate:PlainJavaScript";

        /// <summary>
        /// Gets or sets a value indicating whether the form view adds the renderer script to the page.
        /// Turn this off to load the script yourself (for example, in your own bundle).
        /// </summary>
        public bool IncludeScript { get; set; } = true;

        /// <summary>
        /// Gets or sets the theme to add to the page: "none" or "basic" (not case sensitive).
        /// Any other value is treated as "none".
        /// </summary>
        public string Theme { get; set; } = "none";
    }
}
