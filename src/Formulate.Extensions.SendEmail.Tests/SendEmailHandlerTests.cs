using System.Globalization;
using Formulate.Core.Submissions.Requests;
using Formulate.Extensions.SendEmail.Tests.TestSupport;
using Formulate.Extensions.SendEmail.Utilities;
using Microsoft.Extensions.Logging;
using Xunit;
using static Formulate.Extensions.SendEmail.Tests.TestSupport.TestForms;

namespace Formulate.Extensions.SendEmail.Tests;

/// <summary>
/// The Email handler, as Formulate 3's: recipients, delivery type, subject and message, appended
/// fields and uploads.
/// </summary>
public sealed class SendEmailHandlerTests
{
    private const string Undisclosed = "undisclosed-recipients:;";

    [Fact]
    public async Task Builds_message_with_recipients_from_config_and_fields()
    {
        var name = Field("Name", TextKind);
        var email = Field("Email", TextKind);
        var form = Form(name, email);
        var submission = Submit(form).Value(name, "Ada").Value(email, "ada@visitor.test").Build();
        await using var services = EmailTestServices.Create();

        await services.SendEmailAsync(new
        {
            senderEmail = "forms@site.test",
            recipients = new[] { new { email = "team@site.test" } },
            recipientFields = new[] { new { id = email.Id.ToString("N") } },
            deliveryType = "to",
            subject = "New enquiry",
            message = "Someone filled in the form.",
        }, submission);

        var sent = Assert.Single(services.Sent);
        Assert.Equal("forms@site.test", sent.Message.From);
        Assert.Equal(new[] { "team@site.test", "ada@visitor.test" }, sent.To);
        Assert.Empty(sent.Cc);
        Assert.Empty(sent.Bcc);
        Assert.Equal("New enquiry", sent.Message.Subject);
        Assert.True(sent.Message.IsBodyHtml);
        Assert.Contains("Someone filled in the form.", sent.Message.Body);
        Assert.Equal(Constants.EmailTypes.Email, sent.EmailType);
        Assert.True(sent.EnableNotification);
        Assert.Contains(services.Logs.Entries, x => x.Level == LogLevel.Information && x.Message.Contains("Notify the team") && x.Message.Contains("2 recipients"));
    }

    [Theory]
    [InlineData("to", "to")]
    [InlineData("TO", "to")]
    [InlineData("cc", "cc")]
    [InlineData("bcc", "bcc")]
    [InlineData(null, "bcc")]
    [InlineData("", "bcc")]
    [InlineData("sideways", "bcc")]
    public async Task Respects_delivery_type(string? deliveryType, string expected)
    {
        var email = Field("Email", TextKind);
        var form = Form(email);
        var submission = Submit(form).Value(email, "ada@visitor.test").Build();
        await using var services = EmailTestServices.Create();

        await services.SendEmailAsync(new
        {
            recipients = new[] { new { email = "team@site.test" } },
            recipientFields = new[] { new { id = email.Id } },
            deliveryType,
            subject = "Hello",
        }, submission);

        var sent = Assert.Single(services.Sent);
        var everyone = new[] { "team@site.test", "ada@visitor.test" };

        // Umbraco needs a "To" address, so Cc and Bcc emails go to the empty group RFC 5322 suggests.
        Assert.Equal(expected == "to" ? everyone : new[] { Undisclosed }, sent.To);
        Assert.Equal(expected == "cc" ? everyone : Array.Empty<string>(), sent.Cc);
        Assert.Equal(expected == "bcc" ? everyone : Array.Empty<string>(), sent.Bcc);
    }

    [Fact]
    public async Task Whitelist_blocks_field_addresses_outside_domains()
    {
        var fields = new[] { "ada@allowed.test", "eve@blocked.test", "vip@other.test", "grace@ALLOWED.test", "mallory@other.test" }
            .Select((value, i) => (Field: Field(i == 4 ? "Friend's email" : $"Email {i}", TextKind), Value: value))
            .ToArray();
        var form = Form(fields.Select(x => x.Field).ToArray());
        var builder = Submit(form);

        foreach (var (field, value) in fields)
        {
            builder.Value(field, value);
        }

        await using var services = EmailTestServices.Create(whitelist: new[] { "allowed.test", " VIP@other.test ", "" });

        await services.SendEmailAsync(new
        {
            recipients = new[] { new { email = "boss@anywhere.test" } },
            recipientFields = fields.Select(x => new { id = x.Field.Id }).ToArray(),
            deliveryType = "to",
            subject = "Hello",
        }, builder.Build());

        // Recipients chosen in the back office are trusted; addresses typed by the visitor must match.
        var sent = Assert.Single(services.Sent);
        Assert.Equal(new[] { "boss@anywhere.test", "ada@allowed.test", "vip@other.test", "grace@ALLOWED.test" }, sent.To);
        Assert.Contains(services.Logs.Warnings, x => x.Message.Contains("eve@blocked.test") && x.Message.Contains("Formulate:Email:Whitelist"));
        Assert.Contains(services.Logs.Warnings, x => x.Message.Contains("mallory@other.test") && x.Message.Contains("Friend's email"));
    }

    [Fact]
    public async Task Whitelist_domain_does_not_allow_its_subdomains()
    {
        var email = Field("Email", TextKind);
        var form = Form(email);
        var submission = Submit(form).Value(email, "eve@mail.allowed.test").Build();
        await using var services = EmailTestServices.Create(whitelist: new[] { "allowed.test" });

        await services.SendEmailAsync(new
        {
            recipients = new[] { new { email = "boss@anywhere.test" } },
            recipientFields = new[] { new { id = email.Id } },
            deliveryType = "to",
            subject = "Hello",
        }, submission);

        Assert.Equal(new[] { "boss@anywhere.test" }, Assert.Single(services.Sent).To);
        Assert.Contains(services.Logs.Warnings, x => x.Message.Contains("eve@mail.allowed.test") && x.Message.Contains("Formulate:Email:Whitelist"));
    }

    [Fact]
    public async Task Only_the_first_value_of_a_recipient_field_is_used()
    {
        var email = Field("Email", TextKind);
        var form = Form(email);
        var submission = Submit(form).Value(email, "first@visitor.test", "second@visitor.test", "third@visitor.test").Build();
        await using var services = EmailTestServices.Create();

        await services.SendEmailAsync(new { recipientFields = new[] { new { id = email.Id } }, deliveryType = "to", subject = "Hi" }, submission);

        Assert.Equal(new[] { "first@visitor.test" }, Assert.Single(services.Sent).To);
    }

    [Fact]
    public async Task Whitelist_that_is_not_set_allows_every_field_address()
    {
        var email = Field("Email", TextKind);
        var form = Form(email);
        var submission = Submit(form).Value(email, "anyone@anywhere.test").Build();
        await using var services = EmailTestServices.Create(whitelist: null);

        await services.SendEmailAsync(new { recipientFields = new[] { new { id = email.Id } }, subject = "Hi" }, submission);

        Assert.Equal(new[] { "anyone@anywhere.test" }, Assert.Single(services.Sent).Bcc);
    }

    [Fact]
    public async Task Whitelist_that_is_set_with_no_entries_uses_no_field_address()
    {
        var email = Field("Email", TextKind);
        var form = Form(email);
        var submission = Submit(form).Value(email, "ada@visitor.test").Build();
        await using var services = EmailTestServices.Create(whitelist: new[] { " ; " });

        await services.SendEmailAsync(new
        {
            recipients = new[] { new { email = "boss@anywhere.test" } },
            recipientFields = new[] { new { id = email.Id } },
            deliveryType = "to",
            subject = "Hello",
        }, submission);

        // The handler's own recipients are trusted; the address the visitor typed is not used.
        Assert.Equal(new[] { "boss@anywhere.test" }, Assert.Single(services.Sent).To);
        Assert.Contains(services.Logs.Warnings, x => x.Message.Contains("ada@visitor.test") && x.Message.Contains("has no domains or addresses"));
    }

    [Fact]
    public async Task Field_values_that_are_not_one_plain_address_are_ignored()
    {
        var fields = new[]
            {
                "Ada <ada@visitor.test>",
                "one@visitor.test, two@visitor.test",
                "not an address",
                "eve@visitor.test\r\nBcc: victim@victim.test",
                "",
                "  spaced@visitor.test  ",
            }
            .Select((value, i) => (Field: Field($"Email {i}", TextKind), Value: value))
            .ToArray();
        var form = Form(fields.Select(x => x.Field).ToArray());
        var builder = Submit(form);

        foreach (var (field, value) in fields)
        {
            builder.Value(field, value);
        }

        await using var services = EmailTestServices.Create();

        await services.SendEmailAsync(new
        {
            recipientFields = fields.Select(x => new { id = x.Field.Id }).ToArray(),
            deliveryType = "to",
            subject = "Hi",
        }, builder.Build());

        Assert.Equal(new[] { "spaced@visitor.test" }, Assert.Single(services.Sent).To);
    }

    [Fact]
    public async Task Handler_recipients_may_have_names_and_be_separated_by_commas()
    {
        var form = Form();
        await using var services = EmailTestServices.Create();

        await services.SendEmailAsync(new
        {
            recipients = new[]
            {
                new { email = "\"Sales, North\" <north@site.test>, south@site.test" },
                new { email = "NORTH@site.test" },
                new { email = "nonsense" },
                new { email = "  " },
            },
            deliveryType = "to",
            subject = "Hi",
        }, Submit(form).Build());

        var sent = Assert.Single(services.Sent);
        Assert.Equal(new[] { "\"Sales, North\" <north@site.test>", "south@site.test" }, sent.To);
        Assert.Contains(services.Logs.Warnings, x => x.Message.Contains("nonsense"));
    }

    [Fact]
    public async Task Appends_fields_in_form_order_without_labels_when_excluded()
    {
        var first = Field("First", TextKind);
        var second = Field("Second", TextKind);
        var third = Field("Third", TextKind);
        var form = Form(first, second, third);

        // The values arrive in a different order from the fields on the form.
        var submission = Submit(form).Value(third, "value three").Value(first, "value one").Value(second, "value two", "and more").Build();
        await using var services = EmailTestServices.Create();

        await services.SendEmailAsync(new
        {
            recipients = new[] { new { email = "team@site.test" } },
            subject = "Hello",
            message = "Intro",
            appendFields = true,
            excludeFieldLabels = true,
        }, submission);

        var body = Assert.Single(services.Sent).Message.Body!;
        AssertInOrder(body, "Intro", "value one", "value two, and more", "value three");
        Assert.DoesNotContain("First", body);
        Assert.DoesNotContain("Second:", body);
        Assert.DoesNotContain("Third:", body);
    }

    [Fact]
    public async Task Appends_fields_with_their_names_as_labels()
    {
        var name = Field("Name", TextKind);
        var comments = Field("Comments", TextAreaKind);
        var form = Form(name, comments);
        var submission = Submit(form).Value(comments, "Line one\nLine <two> & \"three\"").Value(name, "Ada").Build();
        await using var services = EmailTestServices.Create();

        await services.SendEmailAsync(new
        {
            recipients = new[] { new { email = "team@site.test" } },
            subject = "Hello",
            message = "First line of the message\r\nSecond line",
            appendFields = true,
        }, submission);

        var body = Assert.Single(services.Sent).Message.Body!;

        // As in Formulate 3, every line is HTML encoded and line breaks become <br>.
        Assert.Contains("First line of the message\r\n<br>\r\nSecond line", body);
        AssertInOrder(body, "Second line", "Name: Ada", "Comments: Line one\r\n<br>\r\nLine &lt;two&gt; &amp; &quot;three&quot;");
    }

    [Fact]
    public async Task Does_not_append_fields_or_attach_uploads_when_append_fields_is_off()
    {
        var name = Field("Name", TextKind);
        var resume = Field("Resume", UploadKind);
        var form = Form(name, resume);
        var submission = Submit(form).Value(name, "Ada").File(resume, "cv.pdf", new byte[] { 1, 2, 3 }).Build();
        await using var services = EmailTestServices.Create();

        await services.SendEmailAsync(new
        {
            recipients = new[] { new { email = "team@site.test" } },
            subject = "Hello",
            message = "Just <this>",
        }, submission);

        var sent = Assert.Single(services.Sent);
        Assert.Equal("Just &lt;this&gt;", sent.Message.Body);
        Assert.Empty(sent.Attachments);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Hidden_fields_are_left_out_unless_included(bool includeHiddenFields)
    {
        var name = Field("Name", TextKind);
        var campaign = Field("Campaign", HiddenKind);
        var form = Form(name, campaign);
        var submission = Submit(form).Value(name, "Ada").Value(campaign, "spring-sale").Build();
        await using var services = EmailTestServices.Create();

        await services.SendEmailAsync(new
        {
            recipients = new[] { new { email = "team@site.test" } },
            subject = "Hello",
            appendFields = true,
            includeHiddenFields,
        }, submission);

        var body = Assert.Single(services.Sent).Message.Body!;
        Assert.Contains("Name: Ada", body);
        Assert.Equal(includeHiddenFields, body.Contains("Campaign: spring-sale"));
    }

    [Fact]
    public async Task Payload_lists_the_page_url_and_name_first()
    {
        var name = Field("Name", TextKind);
        var form = Form(name);
        var submission = Submit(form).Value(name, "Ada").OnPage(1234).Build();
        await using var services = EmailTestServices.Create();
        services.Pages.Url = "https://site.test/contact/";
        services.Pages.Name = "Contact";

        await services.SendEmailAsync(new
        {
            recipients = new[] { new { email = "team@site.test" } },
            subject = "Hello",
            message = "Intro",
            appendFields = true,
            appendPayload = true,
            excludeFieldLabels = true,
        }, submission);

        // The payload keeps its labels even when the field labels are left out, as in Formulate 3.
        var body = Assert.Single(services.Sent).Message.Body!;
        AssertInOrder(body, "Intro", "URL: https://site.test/contact/", "Page Name: Contact", "Ada");
        Assert.Equal(new int?[] { 1234 }, services.Pages.Requested);
    }

    [Fact]
    public async Task Payload_is_not_looked_up_unless_it_is_appended()
    {
        var name = Field("Name", TextKind);
        var form = Form(name);
        var submission = Submit(form).Value(name, "Ada").OnPage(1234).Build();
        await using var services = EmailTestServices.Create();
        services.Pages.Url = "https://site.test/contact/";

        await services.SendEmailAsync(new { recipients = new[] { new { email = "team@site.test" } }, subject = "Hello", appendFields = true }, submission);

        Assert.DoesNotContain("URL:", Assert.Single(services.Sent).Message.Body);
        Assert.Empty(services.Pages.Requested);
    }

    [Fact]
    public async Task Fields_to_include_limits_the_fields_and_can_add_text_constants()
    {
        var name = Field("Name", TextKind);
        var phone = Field("Phone", TextKind);
        var source = Field("Source", TextConstantKind, configuration: "{\"text\":\"Website form\"}");
        var resume = Field("Resume", UploadKind);
        var photo = Field("Photo", UploadKind);
        var form = Form(name, phone, source, resume, photo);
        var submission = Submit(form)
            .Value(name, "Ada")
            .Value(phone, "555 0100")
            .File(resume, "cv.pdf", new byte[] { 1 })
            .File(photo, "me.png", new byte[] { 2 })
            .Build();
        await using var services = EmailTestServices.Create();

        await services.SendEmailAsync(new
        {
            recipients = new[] { new { email = "team@site.test" } },
            subject = "Hello",
            appendFields = true,
            fieldsToInclude = new[] { new { id = source.Id }, new { id = name.Id }, new { id = photo.Id } },
        }, submission);

        var sent = Assert.Single(services.Sent);
        var body = sent.Message.Body!;
        AssertInOrder(body, "Name: Ada", "Source: Website form", "Photo: See attachment, &quot;me.png&quot;");
        Assert.DoesNotContain("Phone", body);
        Assert.DoesNotContain("cv.pdf", body);
        Assert.Equal(new[] { "me.png" }, sent.Attachments.Select(x => x.FileName));
    }

    [Fact]
    public async Task Only_files_from_the_forms_upload_fields_are_attached()
    {
        var name = Field("Name", TextKind);
        var notes = Field("Notes", TextKind);
        var resume = Field("Resume", UploadKind);
        var stranger = Field("Not on the form", UploadKind);
        var form = Form(name, notes, resume);
        var submission = Submit(form)
            .Value(name, "Ada")
            .File(name, "posted-under-name.exe", new byte[] { 9 })
            .File(notes, "posted-under-notes.exe", new byte[] { 9 })
            .File(stranger, "posted-under-stranger.exe", new byte[] { 9 })
            .File(resume, "cv.pdf", new byte[] { 1 })
            .Build();
        await using var services = EmailTestServices.Create();

        await services.SendEmailAsync(new { recipients = new[] { new { email = "team@site.test" } }, subject = "Hello", appendFields = true }, submission);

        var sent = Assert.Single(services.Sent);
        Assert.Equal(new[] { "cv.pdf" }, sent.Attachments.Select(x => x.FileName));
        Assert.Contains("Name: Ada", sent.Message.Body);
        Assert.Contains("Resume: See attachment, &quot;cv.pdf&quot;", sent.Message.Body);
        Assert.DoesNotContain(".exe", sent.Message.Body);
    }

    [Fact]
    public async Task Text_constants_are_left_out_unless_chosen()
    {
        var name = Field("Name", TextKind);
        var source = Field("Source", TextConstantKind, configuration: "{\"text\":\"Website form\"}");
        var form = Form(name, source);
        var submission = Submit(form).Value(name, "Ada").Build();
        await using var services = EmailTestServices.Create();

        await services.SendEmailAsync(new { recipients = new[] { new { email = "team@site.test" } }, subject = "Hello", appendFields = true }, submission);

        Assert.DoesNotContain("Website form", Assert.Single(services.Sent).Message.Body);
    }

    [Fact]
    public async Task Date_fields_are_written_as_long_dates()
    {
        var date = Field("Start date", DateKind);
        var text = Field("Reference", TextKind);
        var form = Form(date, text);
        var submission = Submit(form)
            .Value(date, "2026-11-05", "Sat Nov 21 2026 10:30:00 GMT-0800 (Pacific Standard Time)", "not a date")
            .Value(text, "2026-11-05")
            .Build();
        await using var services = EmailTestServices.Create();

        var body = await SendInCulture("en-US", services, submission);

        Assert.Contains("Start date: November 05, 2026, November 21, 2026, not a date", body);

        // Only Date fields are reformatted.
        Assert.Contains("Reference: 2026-11-05", body);
    }

    [Fact]
    public async Task Date_fields_are_written_in_the_culture_of_the_submission()
    {
        var date = Field("Start date", DateKind);
        var form = Form(date);
        var submission = Submit(form).Value(date, "2026-11-05").Build();
        await using var services = EmailTestServices.Create();

        var body = await SendInCulture("fr-FR", services, submission);

        Assert.Contains("Start date: novembre 05, 2026", body);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task The_recaptcha_token_is_left_out_of_the_email(bool chosen)
    {
        var name = Field("Name", TextKind);
        var robot = Field("Robot check", RecaptchaKind);
        var form = Form(name, robot);
        var submission = Submit(form).Value(name, "Ada").Value(robot, "03AGdBq-TOKEN").Build();
        await using var services = EmailTestServices.Create();

        // Even a site that picks the field by id gets no token: Formulate 3 never stored or sent it.
        var fieldsToInclude = chosen ? new[] { new { id = name.Id.ToString("N") }, new { id = robot.Id.ToString("N") } } : Array.Empty<object>().Select(x => new { id = string.Empty }).ToArray();
        await services.SendEmailAsync(new { recipients = new[] { new { email = "team@site.test" } }, subject = "Hello", appendFields = true, fieldsToInclude }, submission);

        var body = Assert.Single(services.Sent).Message.Body!;
        Assert.Contains("Name: Ada", body);
        Assert.DoesNotContain("TOKEN", body);
        Assert.DoesNotContain("Robot check", body);
    }

    /// <summary>
    /// Sends the submission with the given current culture, as request localization sets it for the submit request.
    /// </summary>
    private static async Task<string> SendInCulture(string culture, EmailTestServices services, FormSubmissionRequest submission)
    {
        var previous = CultureInfo.CurrentCulture;
        CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo(culture);

        try
        {
            await services.SendEmailAsync(new { recipients = new[] { new { email = "team@site.test" } }, subject = "Hello", appendFields = true }, submission);
        }
        finally
        {
            CultureInfo.CurrentCulture = previous;
        }

        return Assert.Single(services.Sent).Message.Body!;
    }

    [Theory]
    [InlineData("invoice\u202Efdp.exe", "invoicefdp.exe")]
    [InlineData("a\u200Bb\u2066c.txt", "abc.txt")]
    [InlineData("tag\U000E0001x.txt", "tagx.txt")]
    [InlineData(@"C:\fakepath\cv.pdf", "cv.pdf")]
    [InlineData(" line\r\nbreak.txt ", "linebreak.txt")]
    [InlineData("\u202E\t", "attachment")]
    [InlineData(null, "attachment")]
    public void Attachment_names_have_no_folders_or_hidden_characters(string? fileName, string expected)
    {
        Assert.Equal(expected, EmailAttachment.NameFor(fileName));
    }

    [Fact]
    public async Task Attachment_names_cannot_hide_their_real_extension()
    {
        var resume = Field("Resume", UploadKind);
        var form = Form(resume);
        var submission = Submit(form).File(resume, "invoice\u202Efdp.exe", new byte[] { 1 }).Build();
        await using var services = EmailTestServices.Create();

        await services.SendEmailAsync(new { recipients = new[] { new { email = "team@site.test" } }, subject = "Hello", appendFields = true }, submission);

        var sent = Assert.Single(services.Sent);
        Assert.Equal("invoicefdp.exe", Assert.Single(sent.Attachments).FileName);
        Assert.Contains("Resume: See attachment, &quot;invoicefdp.exe&quot;", sent.Message.Body);
        Assert.DoesNotContain("\u202E", sent.Message.Body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Attaches_uploads()
    {
        var name = Field("Name", TextKind);
        var resume = Field("Resume", UploadKind);
        var photos = Field("Photos", UploadKind);
        var form = Form(name, resume, photos);
        var submission = Submit(form)
            .Value(name, "Ada")
            .File(resume, @"C:\fakepath\cv.pdf", new byte[] { 1, 2, 3 }, "application/pdf")
            .File(photos, "one.png", new byte[] { 4 }, "image/png")
            .File(photos, "../two.png", new byte[] { 5, 6 }, "image/png")
            .Build();
        await using var services = EmailTestServices.Create();

        await services.SendEmailAsync(new
        {
            recipients = new[] { new { email = "team@site.test" } },
            subject = "Hello",
            appendFields = true,
        }, submission);

        var sent = Assert.Single(services.Sent);
        Assert.Equal(new[] { "cv.pdf", "one.png", "two.png" }, sent.Attachments.Select(x => x.FileName));
        Assert.Equal(new byte[] { 1, 2, 3 }, sent.Attachments[0].Data);
        Assert.Equal(new byte[] { 5, 6 }, sent.Attachments[2].Data);
        AssertInOrder(sent.Message.Body!,
            "Name: Ada",
            "Resume: See attachment, &quot;cv.pdf&quot;",
            "Photos: See attachments, &quot;one.png&quot;, &quot;two.png&quot;");
    }

    [Fact]
    public async Task Extra_context_adds_recipients_subject_and_message()
    {
        var form = Form();
        var submission = Submit(form)
            .Extra(Constants.ExtraContextKeys.ExtraRecipients, new List<string> { "extra@site.test" })
            .Extra(Constants.ExtraContextKeys.ExtraSubject, " (urgent)")
            .Extra(Constants.ExtraContextKeys.ExtraMessage, " Please reply today.")
            .Build();
        await using var services = EmailTestServices.Create(whitelist: new[] { "allowed.test" });

        await services.SendEmailAsync(new
        {
            recipients = new[] { new { email = "team@site.test" } },
            deliveryType = "to",
            subject = "New enquiry",
            message = "Hello.",
        }, submission);

        // Code is trusted like the back office, so its recipients skip the whitelist.
        var sent = Assert.Single(services.Sent);
        Assert.Equal(new[] { "team@site.test", "extra@site.test" }, sent.To);
        Assert.Equal("New enquiry (urgent)", sent.Message.Subject);
        Assert.Equal("Hello. Please reply today.", sent.Message.Body);
    }

    [Fact]
    public async Task Blank_subject_and_message_fall_back_so_umbraco_accepts_the_email()
    {
        var form = Form();
        await using var services = EmailTestServices.Create();

        await services.SendEmailAsync(new { recipients = new[] { new { email = "team@site.test" } }, subject = " \r\n " }, Submit(form).Build());

        // Umbraco's EmailMessage refuses an empty subject or body.
        var sent = Assert.Single(services.Sent);
        Assert.Equal("Contact Us", sent.Message.Subject);
        Assert.False(string.IsNullOrEmpty(sent.Message.Body));
    }

    [Fact]
    public async Task Line_breaks_in_the_subject_become_spaces()
    {
        var form = Form();
        await using var services = EmailTestServices.Create();

        await services.SendEmailAsync(new { recipients = new[] { new { email = "team@site.test" } }, subject = "One\r\nBcc: victim@victim.test" }, Submit(form).Build());

        Assert.Equal("One Bcc: victim@victim.test", Assert.Single(services.Sent).Message.Subject);
    }

    [Fact]
    public async Task No_recipients_logs_a_warning_and_sends_nothing()
    {
        var email = Field("Email", TextKind);
        var form = Form(email);
        var submission = Submit(form).Value(email, "").Build();
        await using var services = EmailTestServices.Create();

        await services.SendEmailAsync(new { recipientFields = new[] { new { id = email.Id } }, subject = "Hello" }, submission);

        Assert.Empty(services.Sent);
        var warning = Assert.Single(services.Logs.Warnings);
        Assert.Contains("no recipients", warning.Message);
        Assert.Contains("Notify the team", warning.Message);
        Assert.Contains(form.Id.ToString(), warning.Message);
    }

    [Fact]
    public async Task Missing_sender_logs_an_error_naming_the_setting()
    {
        var form = Form();
        var noFrom = new Umbraco.Cms.Core.Configuration.Models.GlobalSettings
        {
            Smtp = new Umbraco.Cms.Core.Configuration.Models.SmtpSettings { Host = "smtp.site.test" },
        };
        await using var services = EmailTestServices.Create(globalSettings: noFrom);

        await services.SendEmailAsync(new { recipients = new[] { new { email = "team@site.test" } }, subject = "Hello" }, Submit(form).Build());

        Assert.Empty(services.Sent);
        var error = Assert.Single(services.Logs.Errors);
        Assert.Contains("Umbraco:CMS:Global:Smtp:From", error.Message);
    }

    [Fact]
    public async Task Invalid_sender_logs_an_error_and_sends_nothing()
    {
        var form = Form();
        await using var services = EmailTestServices.Create();

        await services.SendEmailAsync(new { senderEmail = "not an address", recipients = new[] { new { email = "team@site.test" } }, subject = "Hello" }, Submit(form).Build());

        Assert.Empty(services.Sent);
        Assert.Contains("not an address", Assert.Single(services.Logs.Errors).Message);
    }

    private static void AssertInOrder(string text, params string[] parts)
    {
        var position = -1;

        foreach (var part in parts)
        {
            var next = text.IndexOf(part, position + 1, StringComparison.Ordinal);
            Assert.True(next > position, $"Expected \"{part}\" after position {position} in:\n{text}");
            position = next;
        }
    }
}
