using System.Data;
using System.Net.Sockets;
using System.Text.Json;
using Formulate.Core.FormHandlers;
using Formulate.Core.Forms;
using Formulate.Core.Submissions.Requests;
using Formulate.Core.Utilities.Submissions;
using Formulate.Extensions.SendEmail.Tests.TestSupport;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Persistence.Repositories;
using Umbraco.Cms.Core.Scoping;
using Xunit;
using static Formulate.Extensions.SendEmail.Tests.TestSupport.TestForms;

namespace Formulate.Extensions.SendEmail.Tests;

/// <summary>
/// Submits through Formulate's real handler runner, to show that an email handler that cannot send
/// does not stop the form's other handlers or fail the visitor's submission.
/// </summary>
public sealed class HandlerIsolationTests
{
    [Fact]
    public async Task Email_handler_that_cannot_send_does_not_stop_other_handlers()
    {
        using var umbraco = UmbracoEmail.NotConfigured();
        await using var services = EmailTestServices.Create(umbraco.Sender, umbraco.Settings);
        var recorder = new RecordingDefinition();
        var definitions = new FormHandlerDefinitionCollection(() => new IFormHandlerDefinition[] { services.EmailDefinition, recorder });
        var email = Handler(services.EmailDefinition, new { recipients = new[] { new { email = "team@site.test" } }, subject = "Hello" });
        var store = Handler(recorder, null);
        var form = Form();
        form.Handlers = new[] { email, store };

        var result = await Runner(definitions, services).SubmitAsync(Submit(form).Build(), TestContext.Current.CancellationToken);

        Assert.True(result.IsSuccessful);
        Assert.Equal(1, recorder.Runs);
        Assert.Contains("Umbraco:CMS:Global:Smtp:Host", Assert.Single(services.Logs.Errors).Message);
    }

    [Fact]
    public async Task Designed_email_whose_view_throws_does_not_stop_other_handlers()
    {
        const string view = "~/Views/Tests/Email/Throws.cshtml";
        await using var services = EmailTestServices.Create();
        var recorder = new RecordingDefinition();
        var definitions = new FormHandlerDefinitionCollection(() => new IFormHandlerDefinition[] { services.DesignedDefinition, recorder });
        var designed = Handler(services.DesignedDefinition, new { recipients = new[] { new { email = "team@site.test" } }, htmlEmailRazorPath = view });
        var store = Handler(recorder, null);
        var form = Form();
        form.Handlers = new[] { designed, store };

        var result = await Runner(definitions, services).SubmitAsync(Submit(form).Build(), TestContext.Current.CancellationToken);

        Assert.True(result.IsSuccessful);
        Assert.Equal(1, recorder.Runs);
        Assert.Empty(services.Sent);
        Assert.Contains(view, Assert.Single(services.Logs.Errors).Message);
    }

    [Fact]
    public async Task Email_whose_send_fails_still_lets_the_submission_succeed()
    {
        var sender = new FailingEmailSender(new SocketException((int)SocketError.ConnectionRefused));
        await using var services = EmailTestServices.Create(sender);
        var recorder = new RecordingDefinition();
        var definitions = new FormHandlerDefinitionCollection(() => new IFormHandlerDefinition[] { services.EmailDefinition, recorder });
        var email = Handler(services.EmailDefinition, new { recipients = new[] { new { email = "team@site.test" } }, subject = "Hello" });
        var form = Form();
        form.Handlers = new[] { email, Handler(recorder, null) };

        var result = await Runner(definitions, services).SubmitAsync(Submit(form).Build(), TestContext.Current.CancellationToken);

        Assert.True(result.IsSuccessful);
        Assert.Equal(1, recorder.Runs);
        Assert.Equal(1, sender.Attempts);
        AssertSendFailureLogged<SocketException>(services, email, form, "FormulateEmail");
    }

    [Fact]
    public async Task Designed_email_whose_send_fails_still_lets_the_submission_succeed()
    {
        var sender = new FailingEmailSender(new SocketException((int)SocketError.ConnectionRefused));
        await using var services = EmailTestServices.Create(sender);
        var recorder = new RecordingDefinition();
        var definitions = new FormHandlerDefinitionCollection(() => new IFormHandlerDefinition[] { services.DesignedDefinition, recorder });
        var designed = Handler(services.DesignedDefinition, new { recipients = new[] { new { email = "team@site.test" } }, htmlEmailRazorPath = "~/Views/Tests/Email/Html.cshtml" });
        var form = Form();
        form.Handlers = new[] { designed, Handler(recorder, null) };

        var result = await Runner(definitions, services).SubmitAsync(Submit(form).Build(), TestContext.Current.CancellationToken);

        Assert.True(result.IsSuccessful);
        Assert.Equal(1, recorder.Runs);
        Assert.Equal(1, sender.Attempts);
        AssertSendFailureLogged<SocketException>(services, designed, form, "FormulateDesignedEmail");
    }

    [Fact]
    public async Task Send_that_times_out_is_logged_like_any_other_failure()
    {
        // Handlers run without a cancellation token, so a cancellation here is a timeout in the site's sender,
        // such as an HttpClient call in a SendEmailNotification handler.
        var sender = new FailingEmailSender(new TaskCanceledException("The request was canceled due to the configured HttpClient.Timeout of 100 seconds elapsing."));
        await using var services = EmailTestServices.Create(sender);
        var recorder = new RecordingDefinition();
        var definitions = new FormHandlerDefinitionCollection(() => new IFormHandlerDefinition[] { services.EmailDefinition, recorder });
        var email = Handler(services.EmailDefinition, new { recipients = new[] { new { email = "team@site.test" } }, subject = "Hello" });
        var form = Form();
        form.Handlers = new[] { email, Handler(recorder, null) };

        var result = await Runner(definitions, services).SubmitAsync(Submit(form).Build(), TestContext.Current.CancellationToken);

        Assert.True(result.IsSuccessful);
        Assert.Equal(1, recorder.Runs);
        Assert.Equal(1, sender.Attempts);
        AssertSendFailureLogged<TaskCanceledException>(services, email, form, "FormulateEmail");
    }

    private static void AssertSendFailureLogged<TException>(EmailTestServices services, PersistedFormHandler handler, PersistedForm form, string emailType)
        where TException : Exception
    {
        var error = Assert.Single(services.Logs.Errors);
        Assert.Contains(handler.Name, error.Message);
        Assert.Contains(form.Name, error.Message);
        Assert.Contains(emailType, error.Message);
        Assert.Contains("Umbraco:CMS:Global:Smtp", error.Message);
        Assert.IsType<TException>(error.Exception);
        Assert.DoesNotContain(services.Logs.Entries, x => x.Message.Contains("sent an email"));
    }

    internal static PersistedFormHandler Handler(IFormHandlerDefinition definition, object? configuration)
    {
        var settings = EmailTestServices.Settings(definition, configuration is null ? null : JsonSerializer.Serialize(configuration));
        settings.Name = definition.Name;

        return settings;
    }

    internal static ISubmitFormSubmissionRequest Runner(FormHandlerDefinitionCollection definitions, EmailTestServices services)
    {
        // The FormSubmittingNotification needs a scope; nothing handles it here.
        var scope = new Mock<ICoreScope> { DefaultValue = DefaultValue.Mock };
        var scopeProvider = new Mock<ICoreScopeProvider>();
        scopeProvider
            .Setup(x => x.CreateCoreScope(It.IsAny<IsolationLevel>(), It.IsAny<RepositoryCacheMode>(), It.IsAny<IEventDispatcher>(), It.IsAny<IScopedNotificationPublisher>(), It.IsAny<bool?>(), It.IsAny<bool>(), It.IsAny<bool>()))
            .Returns(scope.Object);

        return new SubmitFormSubmissionRequest(
            scopeProvider.Object,
            new FormHandlerFactory(definitions),
            services.Provider.GetRequiredService<ILogger<SubmitFormSubmissionRequest>>());
    }

    /// <summary>
    /// A handler kind that counts its runs, standing in for Store Data.
    /// </summary>
    internal sealed class RecordingDefinition : FormHandlerDefinition
    {
        public int Runs { get; set; }

        public override string Icon => "icon-box";

        public override Guid KindId { get; } = Guid.NewGuid();

        public override string Name => "Recorder";

        public override string EditorAlias => "recorder";

        public override IFormHandler CreateHandler(IFormHandlerSettings settings) => new RecordingHandler(settings, this);

        public override object GetBackOfficeConfiguration(IFormHandlerSettings settings) => new();

        private sealed class RecordingHandler(IFormHandlerSettings settings, RecordingDefinition definition) : FormHandler(settings)
        {
            public override void Handle(FormSubmissionRequest submission) => definition.Runs++;
        }
    }
}
