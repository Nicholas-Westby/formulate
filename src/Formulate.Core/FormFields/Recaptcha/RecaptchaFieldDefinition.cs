namespace Formulate.Core.FormFields.Recaptcha
{
    using System;
    using Formulate.Core.Configuration;
    using Microsoft.Extensions.Logging;
    using Microsoft.Extensions.Options;

    /// <summary>
    /// A reCAPTCHA form field definition. It stores no configuration: a stored value (null, an empty object or
    /// anything Formulate 3 wrote) is ignored. The keys come from the "Formulate:Recaptcha" settings.
    /// </summary>
    /// <remarks>
    /// As in Formulate 3, the field is not stored: its response token is posted and checked, then dropped by
    /// Store Data and the Email handler, and sent by Send Data only when a site maps the field.
    /// </remarks>
    public sealed class RecaptchaFieldDefinition : FormFieldDefinitionBase<RecaptchaField>
    {
        private readonly IOptions<FormulateRecaptchaOptions> _options;

        private readonly IRecaptchaVerifier _verifier;

        private readonly ILogger<RecaptchaFieldDefinition> _logger;

        /// <summary>
        /// Constants related to <see cref="RecaptchaFieldDefinition"/>.
        /// </summary>
        public static class Constants
        {
            /// <summary>
            /// The kind ID, the same as Formulate 3's.
            /// </summary>
            public const string KindId = "80C0543D419E4DDFAB052C2D052B97A2";

            /// <summary>
            /// The name.
            /// </summary>
            public const string Name = "reCAPTCHA";

            /// <summary>
            /// The icon.
            /// </summary>
            public const string Icon = "icon-formulate-recaptcha";

            /// <summary>
            /// The back office editor alias.
            /// </summary>
            public const string EditorAlias = "formulate-recaptcha-field";
        }

        /// <summary>
        /// Initializes a new instance of the <see cref="RecaptchaFieldDefinition"/> class.
        /// </summary>
        /// <param name="options">The reCAPTCHA settings.</param>
        /// <param name="verifier">The verifier.</param>
        /// <param name="logger">The logger.</param>
        public RecaptchaFieldDefinition(IOptions<FormulateRecaptchaOptions> options, IRecaptchaVerifier verifier, ILogger<RecaptchaFieldDefinition> logger)
        {
            _options = options;
            _verifier = verifier;
            _logger = logger;
        }

        /// <inheritdoc />
        public override Guid KindId => Guid.Parse(Constants.KindId);

        /// <inheritdoc />
        public override string Name => Constants.Name;

        /// <inheritdoc />
        public override string Icon => Constants.Icon;

        /// <inheritdoc />
        public override string EditorAlias => Constants.EditorAlias;

        /// <inheritdoc />
        public override string Category => FormFieldConstants.Categories.Inputs;

        /// <inheritdoc />
        /// <remarks>False, as in Formulate 3.</remarks>
        public override bool IsStored => false;

        /// <inheritdoc />
        public override FormField CreateField(IFormFieldSettings settings)
        {
            var options = _options.Value;

            return new RecaptchaField(
                settings,
                new RecaptchaFieldConfiguration { SiteKey = options.SiteKey },
                options.SecretKey,
                _verifier,
                _logger);
        }
    }
}
