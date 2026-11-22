using Umbraco.Cms.Core.Mail;
using Umbraco.Cms.Core.Models.Email;

namespace Formulate.Extensions.SendEmail.Tests.TestSupport;

/// <summary>
/// An email sender that keeps what it is given, standing in for a site's own <see cref="IEmailSender"/>.
/// </summary>
internal sealed class CapturingEmailSender : IEmailSender
{
    private readonly List<SentEmail> _sent = new();

    public IReadOnlyList<SentEmail> Sent => _sent;

    public Task SendAsync(EmailMessage message, string emailType) => Capture(message, emailType, false);

    public Task SendAsync(EmailMessage message, string emailType, bool enableNotification) =>
        Capture(message, emailType, enableNotification);

    public Task SendAsync(EmailMessage message, string emailType, bool enableNotification, TimeSpan? expires) =>
        Capture(message, emailType, enableNotification);

    public bool CanSendRequiredEmail() => true;

    private Task Capture(EmailMessage message, string emailType, bool enableNotification)
    {
        // The streams are closed once the email is sent, so read them now.
        var attachments = (message.Attachments ?? new List<EmailMessageAttachment>())
            .Select(x =>
            {
                using var copy = new MemoryStream();
                x.Stream.CopyTo(copy);
                return new SentAttachment(x.FileName, copy.ToArray());
            })
            .ToArray();

        _sent.Add(new SentEmail(message, emailType, enableNotification, attachments));

        return Task.CompletedTask;
    }
}

internal sealed record SentEmail(EmailMessage Message, string EmailType, bool EnableNotification, IReadOnlyList<SentAttachment> Attachments)
{
    public string[] To => Message.To?.Where(x => x is not null).Select(x => x!).ToArray() ?? Array.Empty<string>();

    public string[] Cc => Message.Cc ?? Array.Empty<string>();

    public string[] Bcc => Message.Bcc ?? Array.Empty<string>();
}

internal sealed record SentAttachment(string FileName, byte[] Data);
