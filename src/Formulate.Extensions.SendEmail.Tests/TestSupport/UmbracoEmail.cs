using System.Net.Mail;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using MimeKit;
using Umbraco.Cms.Core.Configuration.Models;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Cms.Infrastructure.Mail;

namespace Formulate.Extensions.SendEmail.Tests.TestSupport;

/// <summary>
/// Umbraco's real email sender, writing to a pickup folder that is deleted afterwards.
/// </summary>
internal sealed class UmbracoEmail : IDisposable
{
    private UmbracoEmail(GlobalSettings settings, string? pickupFolder, bool notificationHandler)
    {
        Settings = settings;
        PickupFolder = pickupFolder;
        var monitor = new FixedOptionsMonitor<GlobalSettings>(settings);
        Sender = new EmailSender(
            NullLogger<EmailSender>.Instance,
            monitor,
            new NoEventAggregator(),
            new BasicSmtpEmailSenderClient(monitor),
            notificationHandler ? new IgnoringSendEmailHandler() : null,
            null);
    }

    public GlobalSettings Settings { get; }

    public string? PickupFolder { get; }

    public EmailSender Sender { get; }

    /// <summary>
    /// Umbraco set up to write emails to a new, empty folder, as Umbraco:CMS:Global:Smtp:DeliveryMethod
    /// SpecifiedPickupDirectory with a PickupDirectoryLocation does.
    /// </summary>
    public static UmbracoEmail WithPickupFolder(string? from = "website@site.test")
    {
        var folder = Path.Combine(Path.GetTempPath(), "formulate-sendemail-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(folder);

        var settings = new GlobalSettings
        {
            Smtp = new SmtpSettings
            {
                From = from!,
                DeliveryMethod = SmtpDeliveryMethod.SpecifiedPickupDirectory,
                PickupDirectoryLocation = folder,
            },
        };

        return new UmbracoEmail(settings, folder, notificationHandler: false);
    }

    /// <summary>
    /// Umbraco with no SMTP section at all.
    /// </summary>
    public static UmbracoEmail NotConfigured(bool notificationHandler = false) =>
        new(new GlobalSettings(), null, notificationHandler);

    /// <summary>
    /// The emails written to the pickup folder.
    /// </summary>
    public IReadOnlyList<MimeMessage> Written()
    {
        if (PickupFolder is null)
        {
            return Array.Empty<MimeMessage>();
        }

        return Directory.GetFiles(PickupFolder, "*.eml").Select(x => MimeMessage.Load(x)).ToArray();
    }

    public void Dispose()
    {
        if (PickupFolder is not null && Directory.Exists(PickupFolder))
        {
            Directory.Delete(PickupFolder, recursive: true);
        }
    }

    private sealed class FixedOptionsMonitor<T>(T value) : IOptionsMonitor<T>
    {
        public T CurrentValue => value;

        public T Get(string? name) => value;

        public IDisposable? OnChange(Action<T, string?> listener) => null;
    }

    private sealed class IgnoringSendEmailHandler : INotificationHandler<SendEmailNotification>
    {
        public void Handle(SendEmailNotification notification)
        {
        }
    }

    private sealed class NoEventAggregator : IEventAggregator
    {
        public Task PublishAsync<TNotification>(TNotification notification, CancellationToken cancellationToken = default)
            where TNotification : INotification => Task.CompletedTask;

        public Task PublishAsync<TNotification, TNotificationHandler>(IEnumerable<TNotification> notifications, CancellationToken cancellationToken = default)
            where TNotification : INotification
            where TNotificationHandler : INotificationHandler => Task.CompletedTask;

        public void Publish<TNotification>(TNotification notification)
            where TNotification : INotification
        {
        }

        public void Publish<TNotification, TNotificationHandler>(IEnumerable<TNotification> notifications)
            where TNotification : INotification
            where TNotificationHandler : INotificationHandler
        {
        }

        public bool PublishCancelable<TCancelableNotification>(TCancelableNotification notification)
            where TCancelableNotification : ICancelableNotification => false;

        public Task<bool> PublishCancelableAsync<TCancelableNotification>(TCancelableNotification notification)
            where TCancelableNotification : ICancelableNotification => Task.FromResult(false);
    }
}
