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

        /// <summary>
        /// The default for <see cref="MaxUploadBytes"/>: 10 MB, the same as Store Data's default.
        /// </summary>
        public const long DefaultMaxUploadBytes = 10_485_760;

        /// <summary>
        /// Gets or sets the size, in bytes, of the largest file a visitor can upload. A larger file fails
        /// the submission with an error on its field, before any file is read into memory. The default is
        /// 10 MB.
        /// </summary>
        public long MaxUploadBytes { get; set; } = DefaultMaxUploadBytes;
    }
}
