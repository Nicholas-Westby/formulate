using System.Diagnostics;
using System.Text.Json;
using Formulate.Core.FormFields;
using Formulate.Core.FormHandlers;
using Formulate.Core.Submissions.Requests;
using Formulate.Core.Utilities;
using Formulate.Extensions.SendEmail.DesignedEmail;
using Formulate.Extensions.SendEmail.FormHandlers;
using Formulate.Extensions.SendEmail.Utilities;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc.ApplicationParts;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Umbraco.Cms.Core.Configuration.Models;
using Umbraco.Cms.Core.Mail;
using Xunit;

namespace Formulate.Extensions.SendEmail.Tests.TestSupport;

/// <summary>
/// The services the email handlers resolve on a site, with test stand-ins for the email sender and
/// the page lookup.
/// </summary>
internal sealed class EmailTestServices : IAsyncDisposable
{
    private EmailTestServices(ServiceProvider provider, CapturingLoggerProvider logs, IEmailSender emailSender, FakePageResolver pages)
    {
        Provider = provider;
        Logs = logs;
        EmailSender = emailSender;
        Pages = pages;
    }

    public ServiceProvider Provider { get; }

    public CapturingLoggerProvider Logs { get; }

    public IEmailSender EmailSender { get; }

    /// <summary>
    /// The emails sent, when the sender is a <see cref="CapturingEmailSender"/>.
    /// </summary>
    public IReadOnlyList<SentEmail> Sent => ((CapturingEmailSender)EmailSender).Sent;

    public FakePageResolver Pages { get; }

    /// <summary>
    /// Creates the services.
    /// </summary>
    /// <param name="emailSender">The sender; a <see cref="CapturingEmailSender"/> when null.</param>
    /// <param name="globalSettings">Umbraco's global settings; an SMTP server and a "From" address when null.</param>
    /// <param name="whitelist">The Formulate:Email:Whitelist setting; not set when null, which allows every address.</param>
    /// <param name="configure">Changes to make to the services after the defaults.</param>
    public static EmailTestServices Create(
        IEmailSender? emailSender = null,
        GlobalSettings? globalSettings = null,
        string[]? whitelist = null,
        Action<IServiceCollection>? configure = null)
    {
        var logs = new CapturingLoggerProvider();
        var pages = new FakePageResolver();
        var sender = emailSender ?? new CapturingEmailSender();
        var global = globalSettings ?? new GlobalSettings
        {
            Smtp = new SmtpSettings { From = "website@site.test", Host = "smtp.site.test" },
        };

        var services = new ServiceCollection();
        services.AddLogging(x => x.AddProvider(logs).SetMinimumLevel(LogLevel.Trace));
        services.AddOptions();
        services.Configure<GlobalSettings>(x => x.Smtp = global.Smtp);
        services.Configure<EmailSettings>(x => x.Whitelist = whitelist);
        services.AddSingleton(TestForms.Json);
        services.AddSingleton(TestForms.FieldDefinitions);
        AddRazor(services);

        // The same registrations the composer makes on a site.
        services.AddFormulateSendEmail();

        services.AddSingleton(sender);
        services.RemoveAll<ISubmissionPageResolver>();
        services.AddSingleton<ISubmissionPageResolver>(pages);
        configure?.Invoke(services);

        // Scopes are validated, so a scoped service resolved from the root provider fails the test.
        var provider = services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true });

        return new EmailTestServices(provider, logs, sender, pages);
    }

    public SendEmailFormHandlerDefinition EmailDefinition =>
        new(Provider.GetRequiredService<IServiceScopeFactory>(), Provider.GetRequiredService<IJsonUtility>());

    public DesignedEmailFormHandlerDefinition DesignedDefinition =>
        new(Provider.GetRequiredService<IServiceScopeFactory>(), Provider.GetRequiredService<IJsonUtility>());

    /// <summary>
    /// Runs an Email handler with the configuration the back office stores (camelCase JSON).
    /// </summary>
    public Task SendEmailAsync(object? configuration, FormSubmissionRequest submission)
    {
        return RunAsync(EmailDefinition, ToJson(configuration), submission);
    }

    /// <summary>
    /// Runs a Designed Email handler with the configuration the back office stores (camelCase JSON).
    /// </summary>
    public Task SendDesignedEmailAsync(object? configuration, FormSubmissionRequest submission)
    {
        return RunAsync(DesignedDefinition, ToJson(configuration), submission);
    }

    /// <summary>
    /// A configuration as JSON: a string is used as it is.
    /// </summary>
    public static string? ToJson(object? configuration)
    {
        return configuration is null ? null : configuration as string ?? JsonSerializer.Serialize(configuration);
    }

    public static PersistedFormHandler Settings(IFormHandlerDefinition definition, string? json, string name = "Notify the team")
    {
        return new PersistedFormHandler
        {
            Id = Guid.NewGuid(),
            KindId = definition.KindId,
            Name = name,
            Alias = "notifyTheTeam",
            Enabled = true,
            Data = json!,
        };
    }

    public async Task RunAsync(IFormHandlerDefinition definition, string? json, FormSubmissionRequest submission)
    {
        var handler = Assert.IsAssignableFrom<AsyncFormHandler>(definition.CreateHandler(Settings(definition, json)));

        await handler.HandleAsync(submission, TestContext.Current.CancellationToken);
    }

    public async ValueTask DisposeAsync()
    {
        await Provider.DisposeAsync();
    }

    /// <summary>
    /// Adds ASP.NET Core's Razor view engine, as a site has it.
    /// </summary>
    private static void AddRazor(IServiceCollection services)
    {
        // Services the web host registers, which Razor needs.
        var diagnostics = new DiagnosticListener("Microsoft.AspNetCore");
        services.AddSingleton(diagnostics);
        services.AddSingleton<DiagnosticSource>(diagnostics);
        services.AddSingleton<IDataProtectionProvider>(new EphemeralDataProtectionProvider());

        services.AddMvcCore()
            .AddViews()
            .AddRazorViewEngine()
            .ConfigureApplicationPartManager(manager =>
            {
                manager.ApplicationParts.Clear();

                // The test assembly plays the site, and only it is a part to begin with. A site's build
                // lists only the libraries whose public types use MVC, which leaves out Formulate's
                // email library, so the library has to add its own views (see AddFormulateSendEmail).
                manager.ApplicationParts.Add(new AssemblyPart(typeof(EmailTestServices).Assembly));
                manager.ApplicationParts.Add(new CompiledRazorAssemblyPart(typeof(EmailTestServices).Assembly));
            });
    }
}

/// <summary>
/// Answers the page a form was on without Umbraco's content.
/// </summary>
internal sealed class FakePageResolver : ISubmissionPageResolver
{
    public string? Url { get; set; }

    public string? Name { get; set; }

    public List<int?> Requested { get; } = new();

    public SubmissionPage Resolve(int? pageId)
    {
        Requested.Add(pageId);

        return pageId is null ? SubmissionPage.None : new SubmissionPage(Url, Name);
    }
}
