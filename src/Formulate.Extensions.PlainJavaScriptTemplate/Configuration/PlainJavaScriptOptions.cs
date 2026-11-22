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
        /// Gets or sets a value indicating whether the form view adds the renderer to the page: a
        /// <c>&lt;script type="module"&gt;</c> for formulate.min.js, after a <c>&lt;link rel="modulepreload"&gt;</c>
        /// for each of its modules. Turn this off to add them yourself (see <see cref="IPlainJavaScriptAssets"/>).
        /// </summary>
        public bool IncludeScript { get; set; } = true;

        /// <summary>
        /// Gets or sets the theme to add to the page: "none" or "basic" (not case sensitive).
        /// Any other value is treated as "none".
        /// </summary>
        public string Theme { get; set; } = "none";
    }
}
