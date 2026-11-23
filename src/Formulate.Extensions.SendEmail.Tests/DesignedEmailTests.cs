using Formulate.Core.Submissions.Requests;
using Formulate.Extensions.SendEmail.Tests.TestSupport;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Razor;
using Microsoft.AspNetCore.Mvc.ViewEngines;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Xunit;
using static Formulate.Extensions.SendEmail.Tests.TestSupport.TestForms;

namespace Formulate.Extensions.SendEmail.Tests;

/// <summary>
/// The Designed Email handler, rendering views with ASP.NET Core's real Razor view engine. The views
/// under Views in this project stand in for a site's own; the samples come from Formulate's library.
/// </summary>
public sealed class DesignedEmailTests
{
    private const string SubjectView = "~/Views/Tests/Email/Subject.cshtml";

    private const string HtmlView = "~/Views/Tests/Email/Html.cshtml";

    private const string TextView = "~/Views/Tests/Email/Text.cshtml";

    private const string ThrowingView = "~/Views/Tests/Email/Throws.cshtml";

    private const string MissingView = "~/Views/Tests/Email/Missing.cshtml";

    private const string SampleSubject = "~/Views/Formulate/Email/Sample (Subject).cshtml";

    private const string SampleHtml = "~/Views/Formulate/Email/Sample (HTML).cshtml";

    private const string SampleText = "~/Views/Formulate/Email/Sample (Text).cshtml";

    private const string ProSubject = "~/Views/Formulate/Email/Formulate Pro Sample (Subject).cshtml";

    private const string ProHtml = "~/Views/Formulate/Email/Formulate Pro Sample (HTML).cshtml";

    private const string ProText = "~/Views/Formulate/Email/Formulate Pro Sample (Text).cshtml";

    private static readonly object[] Team = { new { email = "team@site.test" }, new { email = "boss@site.test" } };

    [Fact]
    public async Task Designed_email_renders_subject_html_and_text_views()
    {
        var submission = Enquiry();
        await using var services = EmailTestServices.Create();

        // An HTML email, with its subject from a view.
        await services.SendDesignedEmailAsync(new
        {
            senderEmail = "forms@site.test",
            recipients = Team,
            deliveryType = "to",
            subject = "Enquiry",
            message = "Hello & welcome",
            subjectRazorPath = SubjectView,
            htmlEmailRazorPath = HtmlView,
        }, submission);

        // A plain text email, with the subject set on the handler.
        await services.SendDesignedEmailAsync(new
        {
            recipients = Team,
            subject = "Plain enquiry",
            textEmailRazorPath = TextView,
        }, submission);

        Assert.Empty(services.Logs.Errors);
        Assert.Equal(2, services.Sent.Count);

        var html = services.Sent[0];
        Assert.Equal(Constants.EmailTypes.DesignedEmail, html.EmailType);
        Assert.True(html.EnableNotification);
        Assert.Equal("forms@site.test", html.Message.From);
        Assert.Equal(new[] { "team@site.test", "boss@site.test" }, html.To);

        // The subject view's two lines become one, and nothing in it is HTML encoded.
        Assert.Equal("Enquiry: Ada <Lovelace> & \"friends\"", html.Message.Subject);
        Assert.True(html.Message.IsBodyHtml);
        Assert.Contains("<p class=\"message\">Hello &amp; welcome</p>", html.Message.Body);
        Assert.Contains("<p class=\"name\">Ada &lt;Lovelace&gt;</p>", html.Message.Body);
        Assert.Contains("<p class=\"sender\">forms@site.test</p>", html.Message.Body);
        Assert.Contains("<p class=\"recipients\">boss@site.test team@site.test</p>", html.Message.Body);

        // The HTML view attached the upload with the helper.
        var attachment = Assert.Single(html.Attachments);
        Assert.Equal("cv.pdf", attachment.FileName);
        Assert.Equal(new byte[] { 1, 2, 3 }, attachment.Data);

        var text = services.Sent[1];
        Assert.Equal("Plain enquiry", text.Message.Subject);
        Assert.False(text.Message.IsBodyHtml);
        Assert.Equal("Name: Ada <Lovelace>\nColours: Red, Green & Blue", text.Message.Body!.ReplaceLineEndings("\n"));
        Assert.Empty(text.Attachments);
    }

    [Theory]
    [InlineData("subjectRazorPath")]
    [InlineData("htmlEmailRazorPath")]
    [InlineData("textEmailRazorPath")]
    public async Task Designed_email_missing_view_logs_and_sends_nothing(string setting)
    {
        var submission = Enquiry();
        await using var services = EmailTestServices.Create();

        await services.SendDesignedEmailAsync(new Dictionary<string, object>
        {
            ["recipients"] = Team,
            ["subject"] = "Hello",
            [setting] = MissingView,
        }, submission);

        Assert.Empty(services.Sent);
        var error = Assert.Single(services.Logs.Errors);
        Assert.Contains(MissingView, error.Message);
        Assert.Contains("Notify the team", error.Message);
        Assert.Contains(submission.Form.Id.ToString(), error.Message);
    }

    [Fact]
    public async Task Designed_email_view_that_throws_logs_the_path_and_sends_nothing()
    {
        var submission = Enquiry();
        await using var services = EmailTestServices.Create();

        await services.SendDesignedEmailAsync(new { recipients = Team, htmlEmailRazorPath = ThrowingView }, submission);

        Assert.Empty(services.Sent);
        var error = Assert.Single(services.Logs.Errors);
        Assert.Contains(ThrowingView, error.Message);
        Assert.Contains("This view is broken.", error.Exception?.ToString());
    }

    [Fact]
    public async Task Html_emails_leave_out_the_text_view_because_umbraco_sends_one_body()
    {
        // Umbraco's EmailMessage has one body, so the text view is only used without an HTML view. It is
        // not rendered at all here: this one would throw.
        var submission = Enquiry();
        await using var services = EmailTestServices.Create();

        await services.SendDesignedEmailAsync(new
        {
            recipients = Team,
            htmlEmailRazorPath = HtmlView,
            textEmailRazorPath = ThrowingView,
        }, submission);

        Assert.True(Assert.Single(services.Sent).Message.IsBodyHtml);
        Assert.Empty(services.Logs.Errors);
    }

    [Fact]
    public async Task Pro_sample_paths_fall_back_to_the_built_in_samples()
    {
        // This "site" has no view at Pro's HTML or text sample path, as after upgrading from Formulate Pro.
        var submission = Enquiry();
        await using var services = EmailTestServices.Create();

        await services.SendDesignedEmailAsync(new { recipients = Team, htmlEmailRazorPath = ProHtml }, submission);
        await services.SendDesignedEmailAsync(new { recipients = Team, htmlEmailRazorPath = SampleHtml }, submission);
        await services.SendDesignedEmailAsync(new { recipients = Team, textEmailRazorPath = ProText }, submission);
        await services.SendDesignedEmailAsync(new { recipients = Team, textEmailRazorPath = SampleText }, submission);

        Assert.Empty(services.Logs.Errors);
        Assert.Equal(4, services.Sent.Count);
        Assert.Equal(services.Sent[1].Message.Body, services.Sent[0].Message.Body);
        Assert.Equal(services.Sent[3].Message.Body, services.Sent[2].Message.Body);
        Assert.Contains(services.Logs.Entries, x => x.Level == LogLevel.Information && x.Message.Contains(ProHtml) && x.Message.Contains(SampleHtml));
        Assert.Contains(services.Logs.Entries, x => x.Level == LogLevel.Information && x.Message.Contains(ProText) && x.Message.Contains(SampleText));
    }

    [Fact]
    public async Task A_site_view_at_a_pro_sample_path_is_used_instead_of_the_built_in_sample()
    {
        var submission = Enquiry();
        await using var services = EmailTestServices.Create();

        await services.SendDesignedEmailAsync(new { recipients = Team, subjectRazorPath = ProSubject, htmlEmailRazorPath = HtmlView }, submission);

        Assert.Equal("The site's own subject", Assert.Single(services.Sent).Message.Subject);
    }

    [Fact]
    public async Task A_pro_sample_that_does_not_compile_falls_back_with_a_warning()
    {
        // A site that kept Pro's sample file has a view written for RazorEngine, which does not compile.
        var submission = Enquiry();
        await using var services = EmailTestServices.Create(configure: x => x.Replace(ServiceDescriptor.Singleton<IRazorViewEngine>(
            provider => new NotCompilingViewEngine(ActivatorUtilities.CreateInstance<RazorViewEngine>(provider), ProText))));

        await services.SendDesignedEmailAsync(new { recipients = Team, textEmailRazorPath = ProText }, submission);
        await services.SendDesignedEmailAsync(new { recipients = Team, textEmailRazorPath = SampleText }, submission);

        Assert.Equal(services.Sent[1].Message.Body, services.Sent[0].Message.Body);
        var warning = Assert.Single(services.Logs.Warnings);
        Assert.Contains(ProText, warning.Message);
        Assert.Contains(SampleText, warning.Message);
        Assert.NotNull(warning.Exception);
    }

    [Fact]
    public async Task A_view_that_does_not_compile_logs_the_path_and_sends_nothing()
    {
        var submission = Enquiry();
        await using var services = EmailTestServices.Create(configure: x => x.Replace(ServiceDescriptor.Singleton<IRazorViewEngine>(
            provider => new NotCompilingViewEngine(ActivatorUtilities.CreateInstance<RazorViewEngine>(provider), HtmlView))));

        await services.SendDesignedEmailAsync(new { recipients = Team, htmlEmailRazorPath = HtmlView }, submission);

        Assert.Empty(services.Sent);
        Assert.Contains(HtmlView, Assert.Single(services.Logs.Errors).Message);
    }

    [Fact]
    public async Task Built_in_samples_list_every_value_and_attach_the_uploads()
    {
        var name = Field("Name", TextKind, alias: "name");
        var colours = Field("Favourite colours", TextKind);
        var photo = Field("Photo", UploadKind, alias: "photo");
        var form = Form(name, colours, photo);
        var submission = Submit(form)
            .Value(name, "Ada")
            .Value(colours, "Red", "Blue")
            .File(photo, "me.png", new byte[] { 9 }, "image/png")
            .OnPage(1234)
            .Build();
        await using var services = EmailTestServices.Create();
        services.Pages.Url = "https://site.test/contact/";
        services.Pages.Name = "Contact";

        await services.SendDesignedEmailAsync(new
        {
            senderEmail = "forms@site.test",
            recipients = Team,
            subject = "New {PageName} enquiry",
            message = "Someone filled in the form.",
            subjectRazorPath = SampleSubject,
            htmlEmailRazorPath = SampleHtml,
        }, submission);
        await services.SendDesignedEmailAsync(new { recipients = Team, textEmailRazorPath = SampleText }, submission);

        Assert.Empty(services.Logs.Errors);
        var html = services.Sent[0];
        Assert.Equal("New Contact enquiry", html.Message.Subject);
        Assert.Contains("Someone filled in the form.", html.Message.Body);
        Assert.Contains("<strong>URL:</strong> https://site.test/contact/", html.Message.Body);
        Assert.Contains("<strong>PageName:</strong> Contact", html.Message.Body);
        Assert.Contains("<strong>name:</strong> Ada", html.Message.Body);
        Assert.Contains("<strong>Favouritecolours:</strong> Red, Blue", html.Message.Body);
        Assert.Contains("<strong>photo:</strong> me.png", html.Message.Body);
        Assert.Contains("forms@site.test", html.Message.Body);
        var attachment = Assert.Single(html.Attachments);
        Assert.Equal("me.png", attachment.FileName);

        var lines = services.Sent[1].Message.Body!.ReplaceLineEndings("\n").Split('\n');
        Assert.Equal(
            new[] { "URL: https://site.test/contact/", "PageName: Contact", "name: Ada", "Favouritecolours: Red, Blue", "photo: me.png" },
            lines);
    }

    [Fact]
    public async Task Built_in_html_sample_attaches_only_files_from_upload_fields()
    {
        var name = Field("Name", TextKind, alias: "name");
        var notes = Field("Notes", TextKind, alias: "notes");
        var photo = Field("Photo", UploadKind, alias: "photo");
        var stranger = Field("Not on the form", UploadKind, alias: "stranger");
        var form = Form(name, notes, photo);
        var submission = Submit(form)
            .Value(name, "Ada")
            .File(notes, "posted-under-notes.exe", new byte[] { 9 })
            .File(stranger, "posted-under-stranger.exe", new byte[] { 9 })
            .File(photo, "me.png", new byte[] { 2 }, "image/png")
            .Build();
        await using var services = EmailTestServices.Create();

        await services.SendDesignedEmailAsync(new { recipients = Team, htmlEmailRazorPath = SampleHtml }, submission);

        var html = Assert.Single(services.Sent);
        Assert.Equal(new[] { "me.png" }, html.Attachments.Select(x => x.FileName));
        Assert.DoesNotContain(".exe", html.Message.Body);
    }

    [Fact]
    public async Task Built_in_samples_do_not_print_the_recipients()
    {
        var submission = Enquiry();
        await using var services = EmailTestServices.Create();

        await services.SendDesignedEmailAsync(new { recipients = Team, htmlEmailRazorPath = SampleHtml }, submission);
        await services.SendDesignedEmailAsync(new { recipients = Team, textEmailRazorPath = SampleText }, submission);

        Assert.Equal(2, services.Sent.Count);

        foreach (var sent in services.Sent)
        {
            Assert.DoesNotContain("team@site.test", sent.Message.Body);
            Assert.DoesNotContain("boss@site.test", sent.Message.Body);
        }
    }

    [Fact]
    public async Task Built_in_subject_sample_names_the_page_when_the_handler_has_no_subject()
    {
        var form = Form();
        await using var services = EmailTestServices.Create();
        services.Pages.Url = "https://site.test/contact/";
        services.Pages.Name = "Contact";

        await services.SendDesignedEmailAsync(new { recipients = Team, subjectRazorPath = SampleSubject }, Submit(form).OnPage(1234).Build());
        await services.SendDesignedEmailAsync(new { recipients = Team, subjectRazorPath = SampleSubject }, Submit(form).Build());

        Assert.Equal("Email for Contact Page at https://site.test/contact/", services.Sent[0].Message.Subject);

        // Without a page the sample writes nothing, and the form's name is used.
        Assert.Equal("Contact Us", services.Sent[1].Message.Subject);
    }

    [Theory]
    [InlineData("~/Views/Tests/Email/Subject.cshtml")]
    [InlineData("/Views/Tests/Email/Subject.cshtml")]
    [InlineData("Views/Tests/Email/Subject.cshtml")]
    [InlineData("Views\\Tests\\Email\\Subject.cshtml")]
    [InlineData("  ~/views/tests/email/SUBJECT.cshtml ")]
    public async Task View_paths_are_found_however_they_are_written(string path)
    {
        // Formulate Pro took paths with or without "~", and with either slash.
        var submission = Enquiry();
        await using var services = EmailTestServices.Create();

        await services.SendDesignedEmailAsync(new { recipients = Team, subject = "Hi", subjectRazorPath = path, htmlEmailRazorPath = HtmlView }, submission);

        Assert.Equal("Hi: Ada <Lovelace> & \"friends\"", Assert.Single(services.Sent).Message.Subject);
    }

    [Fact]
    public async Task Blank_view_paths_send_the_built_in_html_sample_with_the_handlers_subject()
    {
        var submission = Enquiry();
        await using var services = EmailTestServices.Create();

        await services.SendDesignedEmailAsync(new { recipients = Team, subject = "Hello" }, submission);
        await services.SendDesignedEmailAsync(new { recipients = Team, subject = "Hello", htmlEmailRazorPath = SampleHtml }, submission);

        Assert.Empty(services.Logs.Errors);
        var sent = services.Sent[0];
        Assert.Equal("Hello", sent.Message.Subject);
        Assert.True(sent.Message.IsBodyHtml);
        Assert.Equal(services.Sent[1].Message.Body, sent.Message.Body);
    }

    [Fact]
    public async Task Designed_email_uses_the_same_recipients_as_the_email_handler()
    {
        var email = Field("Email", TextKind, alias: "email");
        var form = Form(email);
        await using var services = EmailTestServices.Create(whitelist: new[] { "allowed.test" });

        await services.SendDesignedEmailAsync(new
        {
            recipients = new[] { new { email = "team@site.test" } },
            recipientFields = new[] { new { id = email.Id } },
            deliveryType = "cc",
            htmlEmailRazorPath = HtmlView,
        }, Submit(form).Value(email, "ada@allowed.test").Build());
        await services.SendDesignedEmailAsync(new
        {
            recipients = new[] { new { email = "team@site.test" } },
            recipientFields = new[] { new { id = email.Id } },
            htmlEmailRazorPath = HtmlView,
        }, Submit(form).Value(email, "eve@blocked.test").Build());

        Assert.Equal(new[] { "team@site.test", "ada@allowed.test" }, services.Sent[0].Cc);
        Assert.Equal(new[] { "undisclosed-recipients:;" }, services.Sent[0].To);
        Assert.Equal(new[] { "team@site.test" }, services.Sent[1].Bcc);
        Assert.Contains("Formulate:Email:Whitelist", Assert.Single(services.Logs.Warnings).Message);
    }

    [Fact]
    public async Task Designed_email_without_recipients_renders_nothing()
    {
        var submission = Enquiry();
        await using var services = EmailTestServices.Create();

        await services.SendDesignedEmailAsync(new { htmlEmailRazorPath = ThrowingView }, submission);

        Assert.Empty(services.Sent);
        Assert.Empty(services.Logs.Errors);
        Assert.Contains("no recipients", Assert.Single(services.Logs.Warnings).Message);
    }

    private static FormSubmissionRequest Enquiry()
    {
        var name = Field("Name", TextKind, alias: "name");
        var colours = Field("Colours", TextKind, alias: "colours");
        var resume = Field("Resume", UploadKind, alias: "resume");
        var form = Form(name, colours, resume);

        return Submit(form)
            .Value(name, "Ada <Lovelace>")
            .Value(colours, "Red", "Green & Blue")
            .File(resume, "cv.pdf", new byte[] { 1, 2, 3 }, "application/pdf")
            .Build();
    }

    /// <summary>
    /// The real view engine, except that one view fails to compile, as a view with errors does on a site
    /// that compiles its views at runtime.
    /// </summary>
    private sealed class NotCompilingViewEngine(IRazorViewEngine inner, string brokenPath) : IRazorViewEngine
    {
        public ViewEngineResult FindView(ActionContext context, string viewName, bool isMainPage) =>
            inner.FindView(context, viewName, isMainPage);

        public ViewEngineResult GetView(string? executingFilePath, string viewPath, bool isMainPage)
        {
            if (string.Equals(viewPath, brokenPath, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException($"One or more compilation failures occurred in {viewPath}.");
            }

            return inner.GetView(executingFilePath, viewPath, isMainPage);
        }

        public RazorPageResult FindPage(ActionContext context, string pageName) => inner.FindPage(context, pageName);

        public RazorPageResult GetPage(string executingFilePath, string pagePath) => inner.GetPage(executingFilePath, pagePath);

        public string? GetAbsolutePath(string? executingFilePath, string? pagePath) => inner.GetAbsolutePath(executingFilePath, pagePath);
    }
}
