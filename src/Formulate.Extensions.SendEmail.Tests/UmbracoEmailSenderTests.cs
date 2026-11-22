using Formulate.Extensions.SendEmail.Tests.TestSupport;
using Microsoft.Extensions.DependencyInjection;
using MimeKit;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Notifications;
using Xunit;
using static Formulate.Extensions.SendEmail.Tests.TestSupport.TestForms;

namespace Formulate.Extensions.SendEmail.Tests;

/// <summary>
/// Sends through Umbraco's real <see cref="Umbraco.Cms.Infrastructure.Mail.EmailSender"/>, which writes
/// each email to a pickup folder as an .eml file, and reads the files back.
/// </summary>
public sealed class UmbracoEmailSenderTests
{
    [Fact]
    public async Task Sends_an_eml_file_through_umbracos_email_sender()
    {
        using var umbraco = UmbracoEmail.WithPickupFolder();
        var name = Field("Name", TextKind);
        var email = Field("Email", TextKind);
        var resume = Field("Resume", UploadKind);
        var form = Form(name, email, resume);
        var submission = Submit(form)
            .Value(name, "Ada Lovelace")
            .Value(email, "ada@visitor.test")
            .File(resume, "cv.pdf", new byte[] { 37, 80, 68, 70 }, "application/pdf")
            .Build();
        await using var services = EmailTestServices.Create(umbraco.Sender, umbraco.Settings);

        await services.SendEmailAsync(new
        {
            senderEmail = "forms@site.test",
            recipients = new[] { new { email = "team@site.test" } },
            recipientFields = new[] { new { id = email.Id } },
            deliveryType = "to",
            subject = "New enquiry from the website",
            message = "Someone filled in the contact form.",
            appendFields = true,
        }, submission);

        var written = Assert.Single(umbraco.Written());
        Assert.Equal("forms@site.test", written.From.Mailboxes.Single().Address);
        Assert.Equal(new[] { "team@site.test", "ada@visitor.test" }, written.To.Mailboxes.Select(x => x.Address));
        Assert.Equal("New enquiry from the website", written.Subject);
        Assert.Contains("Someone filled in the contact form.", written.HtmlBody!);
        Assert.Contains("Name: Ada Lovelace", written.HtmlBody);
        Assert.Contains("Resume: See attachment, &quot;cv.pdf&quot;", written.HtmlBody);
        var attachment = Assert.IsType<MimePart>(Assert.Single(written.Attachments));
        Assert.Equal("cv.pdf", attachment.FileName);
        using var content = new MemoryStream();
        attachment.Content!.DecodeTo(content, TestContext.Current.CancellationToken);
        Assert.Equal(new byte[] { 37, 80, 68, 70 }, content.ToArray());
        Assert.Empty(services.Logs.Errors);
    }

    [Fact]
    public async Task Bcc_emails_keep_the_recipients_out_of_the_to_header()
    {
        using var umbraco = UmbracoEmail.WithPickupFolder();
        var form = Form();
        await using var services = EmailTestServices.Create(umbraco.Sender, umbraco.Settings);

        await services.SendEmailAsync(new
        {
            recipients = new[] { new { email = "one@site.test" }, new { email = "two@site.test" } },
            subject = "Hello",
            message = "Hi",
        }, Submit(form).Build());

        var written = Assert.Single(umbraco.Written());

        // No sender on the handler, so Umbraco's own "From" address is used.
        Assert.Equal("website@site.test", written.From.Mailboxes.Single().Address);
        var group = Assert.IsType<GroupAddress>(Assert.Single(written.To));
        Assert.Equal("undisclosed-recipients", group.Name);
        Assert.Empty(group.Members);
        Assert.Equal(new[] { "one@site.test", "two@site.test" }, written.Bcc.Mailboxes.Select(x => x.Address));
    }

    [Fact]
    public async Task Smtp_not_configured_logs_an_error_naming_the_setting_and_sends_nothing()
    {
        using var umbraco = UmbracoEmail.NotConfigured();
        var form = Form();
        await using var services = EmailTestServices.Create(umbraco.Sender, umbraco.Settings);

        // The handler finishes normally, so the visitor still gets the other handlers' results.
        await services.SendEmailAsync(new
        {
            senderEmail = "forms@site.test",
            recipients = new[] { new { email = "team@site.test" } },
            subject = "Hello",
        }, Submit(form).Build());

        var error = Assert.Single(services.Logs.Errors);
        Assert.Contains("Umbraco:CMS:Global:Smtp:Host", error.Message);
        Assert.Contains("Umbraco:CMS:Global:Smtp:PickupDirectoryLocation", error.Message);
        Assert.Contains("Notify the team", error.Message);
        Assert.Contains(form.Id.ToString(), error.Message);
    }

    [Fact]
    public async Task Pickup_folder_without_a_from_address_logs_an_error_naming_the_setting()
    {
        // Umbraco only writes to the pickup folder when it has a "From" address; otherwise it throws
        // an ArgumentNullException about the SMTP host.
        using var umbraco = UmbracoEmail.WithPickupFolder(from: null);
        var form = Form();
        await using var services = EmailTestServices.Create(umbraco.Sender, umbraco.Settings);

        await services.SendEmailAsync(new
        {
            senderEmail = "forms@site.test",
            recipients = new[] { new { email = "team@site.test" } },
            subject = "Hello",
        }, Submit(form).Build());

        Assert.Empty(umbraco.Written());
        Assert.Contains("Umbraco:CMS:Global:Smtp:From", Assert.Single(services.Logs.Errors).Message);
    }

    [Fact]
    public async Task A_site_that_sends_through_a_notification_handler_is_not_reported_as_unconfigured()
    {
        using var umbraco = UmbracoEmail.NotConfigured(notificationHandler: true);
        var form = Form();
        await using var services = EmailTestServices.Create(umbraco.Sender, umbraco.Settings,
            configure: x => x.AddTransient<INotificationHandler<SendEmailNotification>, SiteEmailHandler>());

        await services.SendEmailAsync(new
        {
            senderEmail = "forms@site.test",
            recipients = new[] { new { email = "team@site.test" } },
            subject = "Hello",
        }, Submit(form).Build());

        Assert.Empty(services.Logs.Errors);
    }

    [Fact]
    public async Task A_site_with_its_own_email_sender_is_trusted_to_send()
    {
        var form = Form();
        var noSmtp = new Umbraco.Cms.Core.Configuration.Models.GlobalSettings();
        await using var services = EmailTestServices.Create(new CapturingEmailSender(), noSmtp);

        await services.SendEmailAsync(new
        {
            senderEmail = "forms@site.test",
            recipients = new[] { new { email = "team@site.test" } },
            subject = "Hello",
        }, Submit(form).Build());

        Assert.Single(services.Sent);
        Assert.Empty(services.Logs.Errors);
    }

    private sealed class SiteEmailHandler : INotificationHandler<SendEmailNotification>
    {
        public void Handle(SendEmailNotification notification)
        {
        }
    }
}
