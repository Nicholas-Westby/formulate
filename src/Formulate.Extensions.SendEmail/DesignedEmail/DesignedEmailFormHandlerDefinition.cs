namespace Formulate.Extensions.SendEmail.DesignedEmail
{
    using Formulate.Core.FormHandlers;
    using Formulate.Core.Utilities;
    using Microsoft.Extensions.DependencyInjection;

    /// <summary>
    /// The data definition for a form handler that sends an email written by Razor views, from
    /// Formulate Pro.
    /// </summary>
    public sealed class DesignedEmailFormHandlerDefinition : FormHandlerDefinition
    {
        private readonly IServiceScopeFactory _scopeFactory;

        private readonly IJsonUtility _jsonUtility;

        public DesignedEmailFormHandlerDefinition(IServiceScopeFactory scopeFactory, IJsonUtility jsonUtility)
        {
            _scopeFactory = scopeFactory;
            _jsonUtility = jsonUtility;
        }

        /// <summary>
        /// Constants related to <see cref="DesignedEmailFormHandlerDefinition"/>.
        /// </summary>
        public static class Constants
        {
            /// <summary>
            /// The kind ID, the same as Formulate Pro's, so upgraded forms keep their handlers.
            /// </summary>
            public const string KindId = "15BE7A7D179D40A59AD034B71DAC52D4";

            /// <summary>
            /// The name.
            /// </summary>
            public const string Name = "Designed Email";

            /// <summary>
            /// The icon.
            /// </summary>
            public const string Icon = "icon-message";

            /// <summary>
            /// The back office editor alias.
            /// </summary>
            public const string EditorAlias = "formulate-designed-email-handler";
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
            return new DesignedEmailFormHandler(settings, ReadConfiguration(settings), _scopeFactory);
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
        private DesignedEmailConfiguration ReadConfiguration(IFormHandlerSettings settings)
        {
            var configuration = _jsonUtility.Deserialize<DesignedEmailConfiguration>(settings?.Data) ?? new DesignedEmailConfiguration();
            configuration.Normalize();

            return configuration;
        }
    }
}
