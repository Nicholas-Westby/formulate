namespace Formulate.Extensions.SendEmail.Utilities
{
    using Microsoft.Extensions.Configuration;
    using Microsoft.Extensions.Logging;
    using Umbraco.Cms.Core.Events;
    using Umbraco.Cms.Core.Notifications;

    /// <summary>
    /// Warns at startup when Formulate:Email:Headers is set.
    /// </summary>
    /// <remarks>
    /// Formulate 3 added those headers to its emails. Formulate now sends through Umbraco's email sender,
    /// whose EmailMessage has no headers, so a site upgrading with the setting is told they are not added.
    /// </remarks>
    internal sealed class EmailHeadersSettingCheck : INotificationHandler<UmbracoApplicationStartingNotification>
    {
        /// <summary>
        /// The setting Formulate 3 read the headers from.
        /// </summary>
        public const string SettingName = EmailSettings.SectionName + ":Headers";

        private readonly IConfiguration _configuration;

        private readonly ILogger<EmailHeadersSettingCheck> _logger;

        public EmailHeadersSettingCheck(IConfiguration configuration, ILogger<EmailHeadersSettingCheck> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        public void Handle(UmbracoApplicationStartingNotification notification)
        {
            if (_configuration.GetSection(SettingName).Exists() == false)
            {
                return;
            }

            _logger.LogWarning(
                "{Setting} is set, but Formulate sends email through Umbraco's email sender, which cannot add headers, so the headers are not added. To add them, handle Umbraco's SendEmailNotification for emails of type {EmailType} and {DesignedEmailType}, and send those emails yourself.",
                SettingName, Constants.EmailTypes.Email, Constants.EmailTypes.DesignedEmail);
        }
    }
}
