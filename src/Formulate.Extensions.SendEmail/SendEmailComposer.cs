namespace Formulate.Extensions.SendEmail
{
    using Formulate.Extensions.SendEmail.Utilities;
    using Microsoft.Extensions.DependencyInjection;
    using Umbraco.Cms.Core.Composing;
    using Umbraco.Cms.Core.DependencyInjection;
    using Umbraco.Cms.Core.Notifications;

    public sealed class SendEmailComposer : IComposer
    {
        public void Compose(IUmbracoBuilder builder)
        {
            builder.Services.AddFormulateEmailSettings(builder.Config);
            builder.Services.AddFormulateSendEmail();
            builder.AddNotificationHandler<UmbracoApplicationStartingNotification, EmailHeadersSettingCheck>();
            builder.AddNotificationHandler<UmbracoApplicationStartingNotification, EmailWhitelistSettingCheck>();
        }
    }
}
