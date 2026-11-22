namespace Formulate.Extensions.SendEmail.FormHandlers
{
    using Formulate.Core.FormHandlers;
    using Formulate.Core.Utilities;
    using Microsoft.Extensions.DependencyInjection;

    /// <summary>
    /// The data definition for a form handler that sends an email.
    /// </summary>
    public sealed class SendEmailFormHandlerDefinition : FormHandlerDefinition
    {
        private readonly IServiceScopeFactory _scopeFactory;

        private readonly IJsonUtility _jsonUtility;

        public SendEmailFormHandlerDefinition(IServiceScopeFactory scopeFactory, IJsonUtility jsonUtility)
        {
            _scopeFactory = scopeFactory;
            _jsonUtility = jsonUtility;
        }

        /// <summary>
        /// Constants related to <see cref="SendEmailFormHandlerDefinition"/>.
        /// </summary>
        public static class Constants
        {
            /// <summary>
            /// The kind ID.
            /// </summary>
            public const string KindId = "A0C06033CB94424F9C035B10A420DB16";

            /// <summary>
            /// The name.
            /// </summary>
            public const string Name = "Send Email";

            /// <summary>
            /// The icon.
            /// </summary>
            public const string Icon = "icon-formulate-email";

            /// <summary>
            /// The back office editor alias.
            /// </summary>
            public const string EditorAlias = "formulate-send-email-handler";
        }

        /// <inheritdoc />
        public override string Category => FormHandlerConstants.Categories.Notify;

        /// <inheritdoc />
        public override string EditorAlias => Constants.EditorAlias;

        /// <inheritdoc />
        public override string Name => Constants.Name;

        /// <inheritdoc />
        public override Guid KindId => Guid.Parse(Constants.KindId);

        /// <inheritdoc />
        public override string Icon => Constants.Icon;

        /// <inheritdoc />
        public override IFormHandler CreateHandler(IFormHandlerSettings settings)
        {
            // Scoped services are resolved when the handler runs, not here.
            return new SendEmailFormHandler(settings, ReadConfiguration(settings), _scopeFactory);
        }

        /// <inheritdoc />
        public override object GetBackOfficeConfiguration(IFormHandlerSettings settings)
        {
            return ReadConfiguration(settings);
        }

        /// <summary>
        /// Reads the stored configuration. A handler that was just added has none (null or "{}"), which
        /// gives the defaults: no recipients, so it sends nothing until it is configured.
        /// </summary>
        private SendEmailConfiguration ReadConfiguration(IFormHandlerSettings settings)
        {
            var configuration = _jsonUtility.Deserialize<SendEmailConfiguration>(settings?.Data) ?? new SendEmailConfiguration();
            configuration.Normalize();

            return configuration;
        }
    }
}
