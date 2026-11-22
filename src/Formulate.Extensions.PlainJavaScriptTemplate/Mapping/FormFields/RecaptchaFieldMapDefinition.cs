namespace Formulate.Extensions.PlainJavaScriptTemplate.Core.Mapping.FormFields
{
    using Formulate.Core.FormFields.Recaptcha;
    using Formulate.Extensions.PlainJavaScriptTemplate;
    using Microsoft.Extensions.Logging;
    using Umbraco.Cms.Core.Mapping;

    public sealed class RecaptchaFieldMapDefinition : FormFieldMapDefinition<RecaptchaField>
    {
        private readonly ILogger<RecaptchaFieldMapDefinition> _logger;

        public RecaptchaFieldMapDefinition(ILogger<RecaptchaFieldMapDefinition> logger)
        {
            _logger = logger;
        }

        protected override PlainJavaScriptFormField Map(RecaptchaField field, MapperContext context)
        {
            // Logged when the form is rendered, once per field: without a site key the widget cannot show.
            if (string.IsNullOrWhiteSpace(field.Configuration.SiteKey))
            {
                _logger.LogWarning(
                    "Form field {FieldName} ({FieldId}) cannot show its reCAPTCHA because the site key is not set. Set Formulate:Recaptcha:SiteKey.",
                    field.Name,
                    field.Id);
            }

            // Only the site key is sent to the browser. The secret key stays on the server.
            var config = new
            {
                siteKey = field.Configuration.SiteKey ?? string.Empty
            };

            return new PlainJavaScriptFormField(config, "recaptcha");
        }
    }
}
