using Formulate.Extensions.SendEmail.Tests.TestSupport;
using Formulate.Extensions.SendEmail.Utilities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Notifications;
using Xunit;

namespace Formulate.Extensions.SendEmail.Tests;

/// <summary>
/// Formulate 3 added the headers in Formulate:Email:Headers to its emails. Umbraco's email sender cannot
/// add headers, so a site that still has the setting is told at startup.
/// </summary>
public sealed class HeadersSettingTests
{
    [Fact]
    public void Headers_setting_logs_a_warning_that_the_headers_are_not_added()
    {
        var logs = Check(new Dictionary<string, string?> { ["Formulate:Email:Headers:X-Campaign"] = "contact" });

        var warning = Assert.Single(logs.Warnings);
        Assert.Contains("Formulate:Email:Headers", warning.Message);
        Assert.Contains("SendEmailNotification", warning.Message);
    }

    [Fact]
    public void No_headers_setting_logs_nothing()
    {
        var logs = Check(new Dictionary<string, string?> { ["Formulate:Email:Whitelist:0"] = "site.test" });

        Assert.Empty(logs.Entries);
    }

    private static CapturingLoggerProvider Check(Dictionary<string, string?> settings)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
        var logs = new CapturingLoggerProvider();
        using var loggerFactory = LoggerFactory.Create(x => x.AddProvider(logs));
        var check = new EmailHeadersSettingCheck(configuration, loggerFactory.CreateLogger<EmailHeadersSettingCheck>());

        check.Handle(new UmbracoApplicationStartingNotification(RuntimeLevel.Run, false));

        return logs;
    }
}
