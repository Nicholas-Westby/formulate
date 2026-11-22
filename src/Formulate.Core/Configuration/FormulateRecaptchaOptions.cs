namespace Formulate.Core.Configuration
{
    /// <summary>
    /// The reCAPTCHA settings, read from the "Formulate:Recaptcha" configuration section.
    /// </summary>
    public sealed class FormulateRecaptchaOptions
    {
        /// <summary>
        /// The configuration section.
        /// </summary>
        public const string SectionName = "Formulate:Recaptcha";

        /// <summary>
        /// Gets or sets the site key, which the form shows to the visitor's browser
        /// (Formulate:Recaptcha:SiteKey).
        /// </summary>
        public string SiteKey { get; set; }

        /// <summary>
        /// Gets or sets the secret key, which the server sends to Google to check a response
        /// (Formulate:Recaptcha:SecretKey). It is never sent to the browser or written to a log.
        /// </summary>
        public string SecretKey { get; set; }
    }
}
