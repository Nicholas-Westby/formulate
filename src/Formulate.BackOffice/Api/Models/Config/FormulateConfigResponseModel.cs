namespace Formulate.BackOffice.Api.Models.Config
{
    /// <summary>
    /// The settings the back office client needs.
    /// </summary>
    public sealed class FormulateConfigResponseModel
    {
        /// <summary>
        /// Gets the kinds of button a button field offers.
        /// </summary>
        public required string[] ButtonKinds { get; init; }

        /// <summary>
        /// Gets how kinds of form field are grouped.
        /// </summary>
        public required FieldCategoryModel[] FieldCategories { get; init; }

        /// <summary>
        /// Gets a value indicating whether both reCAPTCHA keys are set (Formulate:Recaptcha:SiteKey and
        /// Formulate:Recaptcha:SecretKey). Until they are, a reCAPTCHA field rejects every submission. The keys
        /// themselves are never given.
        /// </summary>
        public required bool RecaptchaConfigured { get; init; }
    }
}
