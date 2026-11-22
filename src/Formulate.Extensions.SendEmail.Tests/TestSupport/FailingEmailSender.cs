using Umbraco.Cms.Core.Mail;
using Umbraco.Cms.Core.Models.Email;

namespace Formulate.Extensions.SendEmail.Tests.TestSupport;

/// <summary>
/// An email sender whose every send fails, standing in for a mail server that is down or refuses the email.
/// </summary>
internal sealed class FailingEmailSender(Exception error) : IEmailSender
{
    public int Attempts { get; private set; }

    public Task SendAsync(EmailMessage message, string emailType) => Fail();

    public Task SendAsync(EmailMessage message, string emailType, bool enableNotification) => Fail();

    public Task SendAsync(EmailMessage message, string emailType, bool enableNotification, TimeSpan? expires) => Fail();

    public bool CanSendRequiredEmail() => true;

    private Task Fail()
    {
        Attempts++;

        return Task.FromException(error);
    }
}
