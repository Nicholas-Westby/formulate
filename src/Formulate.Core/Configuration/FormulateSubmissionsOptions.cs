namespace Formulate.Core.Configuration
{
    /// <summary>
    /// The submission settings, read from the "Formulate:Submissions" configuration section.
    /// </summary>
    public sealed class FormulateSubmissionsOptions
    {
        /// <summary>
        /// The configuration section.
        /// </summary>
        public const string SectionName = "Formulate:Submissions";

        /// <summary>
        /// Gets or sets a value indicating whether validations that can run on the server (such as
        /// regular expressions) are checked when a form is submitted. The default is true.
        /// </summary>
        public bool EnableServerSideValidation { get; set; } = true;
    }
}
