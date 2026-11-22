using System.Data;
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
