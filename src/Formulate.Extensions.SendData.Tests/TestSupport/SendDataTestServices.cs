using System.Data;
using System.Text.Json;
using Formulate.Core.FormHandlers;
using Formulate.Core.Forms;
using Formulate.Core.Submissions.Requests;
using Formulate.Core.Utilities;
using Formulate.Core.Utilities.Submissions;
using Formulate.Extensions.SendData.FormHandlers;
using Formulate.Extensions.SendData.Utilities;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Moq;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Cms.Core.Persistence.Repositories;
using Umbraco.Cms.Core.Scoping;

namespace Formulate.Extensions.SendData.Tests.TestSupport;

/// <summary>
/// The services the Send Data handler resolves on a site, with a fake network and a fake page lookup, and
/// Umbraco's real notification publisher.
/// </summary>
internal sealed class SendDataTestServices : IAsyncDisposable
{
    private SendDataTestServices(ServiceProvider provider, CapturingLoggerProvider logs, FakeHttpMessageHandler network, FakePageResolver pages)
    {
        Provider = provider;
        Logs = logs;
        Network = network;
        Pages = pages;
    }

    public ServiceProvider Provider { get; }

    public CapturingLoggerProvider Logs { get; }

    public FakeHttpMessageHandler Network { get; }

    public FakePageResolver Pages { get; }

    public SendDataFormHandlerDefinition Definition =>
        new(Provider.GetRequiredService<IServiceScopeFactory>(), Provider.GetRequiredService<IJsonUtility>());

    /// <summary>
    /// Creates the services.
    /// </summary>
    /// <param name="fakeNetwork">False to use the client as the composer registers it, to reach a real listener.</param>
    /// <param name="configure">Changes to make to the services, such as adding notification handlers.</param>
    public static SendDataTestServices Create(Action<IServiceCollection>? configure = null, bool fakeNetwork = true)
    {
        var logs = new CapturingLoggerProvider();
        var network = new FakeHttpMessageHandler();
        var pages = new FakePageResolver();

        var services = new ServiceCollection();
        services.AddLogging(x => x.AddProvider(logs).SetMinimumLevel(LogLevel.Trace));
        services.AddSingleton(TestForms.Json);

        // The same registrations the composer makes on a site.
        services.AddFormulateSendData();

        // The network is the only thing replaced.
        if (fakeNetwork)
        {
            services.AddHttpClient(Constants.HttpClientName).ConfigurePrimaryHttpMessageHandler(() => network);
        }

        services.AddSingleton<IEventAggregator>(x => new EventAggregator(type => x.GetService(type)!));
        services.RemoveAll<ISubmissionPageResolver>();
        services.AddSingleton<ISubmissionPageResolver>(pages);
        configure?.Invoke(services);

        // Scopes are validated, so a scoped service resolved from the root provider fails the test.
        var provider = services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true });

        return new SendDataTestServices(provider, logs, network, pages);
    }

    /// <summary>
    /// A configuration as JSON: a string is used as it is.
    /// </summary>
    public static string? ToJson(object? configuration)
    {
        return configuration is null ? null : configuration as string ?? JsonSerializer.Serialize(configuration);
    }

    public static PersistedFormHandler Settings(IFormHandlerDefinition definition, string? json, string name = "Send to the CRM")
    {
        return new PersistedFormHandler
        {
            Id = Guid.NewGuid(),
            KindId = definition.KindId,
            Name = name,
            Alias = "sendToTheCrm",
            Enabled = true,
            Data = json!,
        };
    }

    /// <summary>
    /// Runs the handler directly with the configuration the back office stores.
    /// </summary>
    public async Task SendAsync(object? configuration, FormSubmissionRequest submission, string name = "Send to the CRM")
    {
        var definition = Definition;
        var handler = Assert.IsAssignableFrom<AsyncFormHandler>(definition.CreateHandler(Settings(definition, ToJson(configuration), name)));

        await handler.HandleAsync(submission, TestContext.Current.CancellationToken);
    }

    /// <summary>
    /// Formulate's real handler runner.
    /// </summary>
    public ISubmitFormSubmissionRequest Runner(params IFormHandlerDefinition[] otherDefinitions)
    {
        var definitions = new FormHandlerDefinitionCollection(() => new IFormHandlerDefinition[] { Definition }.Concat(otherDefinitions).ToArray());

        // The FormSubmittingNotification needs a scope; nothing handles it here.
        var scope = new Mock<ICoreScope> { DefaultValue = DefaultValue.Mock };
        var scopeProvider = new Mock<ICoreScopeProvider>();
        scopeProvider
            .Setup(x => x.CreateCoreScope(It.IsAny<IsolationLevel>(), It.IsAny<RepositoryCacheMode>(), It.IsAny<IEventDispatcher>(), It.IsAny<IScopedNotificationPublisher>(), It.IsAny<bool?>(), It.IsAny<bool>(), It.IsAny<bool>()))
            .Returns(scope.Object);

        return new SubmitFormSubmissionRequest(
            scopeProvider.Object,
            new FormHandlerFactory(definitions),
            Provider.GetRequiredService<ILogger<SubmitFormSubmissionRequest>>());
    }

    public async ValueTask DisposeAsync()
    {
        await Provider.DisposeAsync();
    }
}

/// <summary>
/// Answers the page a form was on without Umbraco's content.
/// </summary>
internal sealed class FakePageResolver : ISubmissionPageResolver
{
    public string? Url { get; set; }

    public string? Name { get; set; }

    public SubmissionPage Resolve(int? pageId)
    {
        return pageId is null ? SubmissionPage.None : new SubmissionPage(Url, Name);
    }
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

/// <summary>
/// A notification handler written as a delegate.
/// </summary>
internal sealed class DelegateHandler<TNotification>(Action<TNotification> action) : INotificationHandler<TNotification>
    where TNotification : INotification
{
    public void Handle(TNotification notification) => action(notification);
}
