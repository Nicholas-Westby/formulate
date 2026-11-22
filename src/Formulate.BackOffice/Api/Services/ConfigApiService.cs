namespace Formulate.BackOffice.Api.Services
{
    using System.Linq;
    using Formulate.BackOffice.Api.Models.Config;
    using Formulate.BackOffice.Configuration;
    using Formulate.Core.Configuration;
    using Microsoft.Extensions.Options;

    /// <summary>
    /// The default implementation of <see cref="IConfigApiService"/>.
    /// </summary>
    public sealed class ConfigApiService : IConfigApiService
    {
        private readonly IOptions<ButtonsOptions> _buttons;

        private readonly IOptions<FormFieldOptions> _fields;

        private readonly IOptions<FormulateRecaptchaOptions> _recaptcha;

        /// <inheritdoc cref="ConfigApiService"/>
        public ConfigApiService(
            IOptions<ButtonsOptions> buttons,
            IOptions<FormFieldOptions> fields,
            IOptions<FormulateRecaptchaOptions> recaptcha)
        {
            _buttons = buttons;
            _fields = fields;
            _recaptcha = recaptcha;
        }

        /// <inheritdoc />
        public FormulateConfigResponseModel Get()
        {
            var recaptcha = _recaptcha.Value;

            return new FormulateConfigResponseModel
            {
                ButtonKinds = _buttons.Value.Select(button => button.Kind).ToArray(),
                FieldCategories = _fields.Value.Categories
                    .Select(category => new FieldCategoryModel { Group = category.Group, Kind = category.Kind })
                    .ToArray(),
                // A blank key counts as missing, as it does for the reCAPTCHA field itself: without the site key the
                // widget cannot be shown, and without the secret key no response can be checked.
                RecaptchaConfigured = !string.IsNullOrWhiteSpace(recaptcha.SiteKey) && !string.IsNullOrWhiteSpace(recaptcha.SecretKey),
            };
        }
    }
}
