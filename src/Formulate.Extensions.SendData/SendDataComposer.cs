namespace Formulate.Extensions.SendData
{
    using Microsoft.Extensions.DependencyInjection;
    using Formulate.Extensions.SendData.Utilities;
    using Umbraco.Cms.Core.Composing;
    using Umbraco.Cms.Core.DependencyInjection;
    using Umbraco.Cms.Core.Notifications;

    public sealed class SendDataComposer : IComposer
    {
        public void Compose(IUmbracoBuilder builder)
        {
            builder.Services.Configure<SendDataSettings>(builder.Config.GetSection(SendDataSettings.SectionName));
            builder.Services.AddFormulateSendData();
            builder.AddNotificationHandler<UmbracoApplicationStartingNotification, SendDataJsonModeSettingCheck>();
        }
    }
}
