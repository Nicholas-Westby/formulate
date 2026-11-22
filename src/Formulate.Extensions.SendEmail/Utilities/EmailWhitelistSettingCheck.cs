namespace Formulate.Extensions.SendEmail.Utilities
{
    using Microsoft.Extensions.Logging;
    using Microsoft.Extensions.Options;
    using Umbraco.Cms.Core.Events;
    using Umbraco.Cms.Core.Notifications;

    /// <summary>
    /// Warns at startup when Formulate:Email:Whitelist is set but has no domain or address.
    /// </summary>
    /// <remarks>
    /// Such a setting (an empty value, only separators, or an empty array) allows no address typed into a
    /// form, so the email handlers send nothing to recipient fields. That is the safe reading of a value that
    /// was perhaps meant to be filled in, and this tells the site's developers about it.
    /// </remarks>
    internal sealed class EmailWhitelistSettingCheck : INotificationHandler<UmbracoApplicationStartingNotification>
    {
        private readonly IOptions<EmailSettings> _settings;

        private readonly ILogger<EmailWhitelistSettingCheck> _logger;

        public EmailWhitelistSettingCheck(IOptions<EmailSettings> settings, ILogger<EmailWhitelistSettingCheck> logger)
        {
            _settings = settings;
            _logger = logger;
        }

        public void Handle(UmbracoApplicationStartingNotification notification)
        {
            if (new EmailWhitelist(_settings.Value.Whitelist).AllowsNone == false)
            {
                return;
            }

            _logger.LogWarning(
                "{Setting} is set but has no domains or addresses, so Formulate's email handlers send to no address typed into a form. List the domains and addresses to allow, separated by commas or semicolons, or remove the setting to allow every address.",
                EmailWhitelist.SettingName);
        }
    }
}
