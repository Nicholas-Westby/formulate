using Microsoft.Extensions.Options;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.Configuration.Models;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Notifications;

namespace Website.Composers;

/// <summary>
/// Has the dev site write its emails to a folder when nothing says how to send them, makes the folder, and says
/// at start which way the site's email goes.
/// </summary>
/// <remarks>
/// When Umbraco:CMS:Global:Smtp has no Host and no PickupDirectoryLocation, Umbraco would send no email at all.
/// So the dev site then has Umbraco write each email it sends, such as a form handler's, to an .eml file in
/// <see cref="DefaultFolder"/>, from <see cref="DefaultFrom"/> when no From is set, and needs no mail server.
/// A Host set anywhere, such as in appsettings.Local.json, is used as it is, and so is a folder set elsewhere:
/// the end-to-end tests set one in their run folder, and read the emails from there. Umbraco does not make the
/// folder (without it, every email fails), and a relative one is taken from the folder the site runs in
/// (src/Website, with dotnet run), as Umbraco takes it. It runs only in the Development environment and is
/// never packed.
/// </remarks>
public sealed class DevEmailComposer : IComposer
{
    /// <summary>The folder the dev site writes its emails to when nothing says how to send them.</summary>
    public const string DefaultFolder = "umbraco/Data/Email";

    /// <summary>The address the dev site's emails are from, when it writes them to its folder and no From is set.</summary>
    public const string DefaultFrom = "formulate@example.com";

    public void Compose(IUmbracoBuilder builder)
    {
        // The host registers its environment as an instance, so it can be read while composing.
        var environment = builder.Services
            .Select(x => x.ImplementationInstance)
            .OfType<IHostEnvironment>()
            .FirstOrDefault();

        if (environment is null || !environment.IsDevelopment())
        {
            return;
        }

        builder.Services.PostConfigure<GlobalSettings>(settings =>
        {
            var smtp = settings.Smtp ??= new SmtpSettings { From = DefaultFrom };

            if (string.IsNullOrWhiteSpace(smtp.Host) && string.IsNullOrWhiteSpace(smtp.PickupDirectoryLocation))
            {
                smtp.PickupDirectoryLocation = DefaultFolder;

                if (string.IsNullOrWhiteSpace(smtp.From))
                {
                    smtp.From = DefaultFrom;
                }
            }
        });
        builder.AddNotificationHandler<UmbracoApplicationStartingNotification, DevEmailStarting>();
    }
}

/// <summary>
/// Makes the folder while Umbraco starts, before the site answers requests, and says which way email goes.
/// </summary>
public sealed class DevEmailStarting(IOptions<GlobalSettings> settings, ILogger<DevEmailStarting> logger)
    : INotificationHandler<UmbracoApplicationStartingNotification>
{
    public void Handle(UmbracoApplicationStartingNotification notification)
    {
        var smtp = settings.Value.Smtp;

        // Umbraco writes to the folder whenever it is set (and a From address is), before it tries a server.
        if (!string.IsNullOrWhiteSpace(smtp?.PickupDirectoryLocation))
        {
            var folder = Path.GetFullPath(smtp.PickupDirectoryLocation);
            Directory.CreateDirectory(folder);

            if (string.IsNullOrWhiteSpace(smtp.Host))
            {
                logger.LogInformation("The dev site writes the emails it sends to {DevEmailFolder}, and sends none to a mail server.", folder);
            }
            else
            {
                logger.LogInformation(
                    "The dev site writes the emails it sends to {DevEmailFolder}, and sends none to {SmtpHost}: Umbraco uses Umbraco:CMS:Global:Smtp:PickupDirectoryLocation first.",
                    folder,
                    smtp.Host);
            }

            return;
        }

        // Without a folder, the composer has left a Host. Port 0 is the default port.
        var server = smtp?.Port > 0 ? $"{smtp.Host}:{smtp.Port}" : smtp?.Host;
        logger.LogInformation("The dev site sends its emails to the mail server at {SmtpServer}.", server);
    }
}
