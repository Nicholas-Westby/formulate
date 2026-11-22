namespace Formulate.Extensions.SendData.FormHandlers
{
    using Formulate.Core.FormHandlers;
    using Formulate.Core.Utilities;
    using System;
    using Microsoft.Extensions.DependencyInjection;

    /// <summary>
    /// The data definition for a form handler that sends data to a URL.
    /// </summary>
    public sealed class SendDataFormHandlerDefinition : FormHandlerDefinition
    {
        private readonly IServiceScopeFactory _scopeFactory;

        private readonly IJsonUtility _jsonUtility;

        public SendDataFormHandlerDefinition(IServiceScopeFactory scopeFactory, IJsonUtility jsonUtility)
        {
            _scopeFactory = scopeFactory;
            _jsonUtility = jsonUtility;
        }

        /// <summary>
        /// Constants related to <see cref="SendDataFormHandlerDefinition"/>.
        /// </summary>
        public static class Constants
        {
            /// <summary>
            /// The kind ID.
            /// </summary>
            public const string KindId = "C76E8D1D5DF244CB8FA285C32312D688";

            /// <summary>
            /// The name.
            /// </summary>
            public const string Name = "Send Data";

            /// <summary>
            /// The icon.
            /// </summary>
            public const string Icon = "icon-formulate-send-data";

            /// <summary>
            /// The back office editor alias.
            /// </summary>
            public const string EditorAlias = "formulate-send-data-handler";
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
            return new SendDataFormHandler(settings, ReadConfiguration(settings), _scopeFactory);
        }

        /// <inheritdoc />
        public override object GetBackOfficeConfiguration(IFormHandlerSettings settings)
        {
            var configuration = ReadConfiguration(settings);

            // Formulate 3's result handler is not used, so the editor is not given it to save back.
            configuration.ResultHandler = null;

            return configuration;
        }

        /// <summary>
        /// Reads the stored configuration. A handler that was just added has none (null or "{}"), which
        /// gives the defaults: no URL, so it sends nothing until it is configured.
        /// </summary>
        private SendDataConfiguration ReadConfiguration(IFormHandlerSettings settings)
        {
            var configuration = _jsonUtility.Deserialize<SendDataConfiguration>(settings?.Data) ?? new SendDataConfiguration();
            configuration.Normalize();

            return configuration;
        }
    }
}
