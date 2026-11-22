namespace Formulate.Extensions.SendData.Utilities
{
    using Microsoft.Extensions.Logging;
    using Microsoft.Extensions.Options;
    using Umbraco.Cms.Core.Events;
    using Umbraco.Cms.Core.Notifications;

    /// <summary>
    /// Warns at startup when Formulate:SendData:JsonMode is neither "Object" nor "WrappedArray". The handler
    /// then sends an object, as when the setting is not there.
    /// </summary>
    internal sealed class SendDataJsonModeSettingCheck : INotificationHandler<UmbracoApplicationStartingNotification>
    {
        /// <summary>
        /// The setting.
        /// </summary>
        public const string SettingName = SendDataSettings.SectionName + ":JsonMode";

        private readonly IOptions<SendDataSettings> _settings;

        private readonly ILogger<SendDataJsonModeSettingCheck> _logger;

        public SendDataJsonModeSettingCheck(IOptions<SendDataSettings> settings, ILogger<SendDataJsonModeSettingCheck> logger)
        {
            _settings = settings;
            _logger = logger;
        }

        public void Handle(UmbracoApplicationStartingNotification notification)
        {
            var mode = _settings.Value.JsonMode;

            if (string.IsNullOrWhiteSpace(mode)
                || string.Equals(mode, SendDataSettings.ObjectJsonMode, StringComparison.OrdinalIgnoreCase)
                || string.Equals(mode, SendDataSettings.WrappedArrayJsonMode, StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            _logger.LogWarning(
                "{Setting} is {JsonMode}, which is not {Object} or {WrappedArray}, so the Send Data handler sends a JSON object.",
                SettingName, mode, SendDataSettings.ObjectJsonMode, SendDataSettings.WrappedArrayJsonMode);
        }
    }
}
