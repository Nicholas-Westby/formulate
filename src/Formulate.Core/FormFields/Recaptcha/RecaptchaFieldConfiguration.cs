namespace Formulate.Core.FormFields.Recaptcha
{
    /// <summary>
    /// Configuration required by <see cref="RecaptchaField"/>. It comes from settings, not from what the field
    /// stores.
    /// </summary>
    public sealed class RecaptchaFieldConfiguration
    {
        /// <summary>
        /// Gets or sets the site key (Formulate:Recaptcha:SiteKey), which the renderer needs.
        /// </summary>
        public string SiteKey { get; set; }
    }
}
