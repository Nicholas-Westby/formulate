using System.Net.Mail;
using System.Text;
using Formulate.Extensions.SendEmail.Tests.TestSupport;
using Formulate.Extensions.SendEmail.Utilities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Notifications;
using Xunit;

namespace Formulate.Extensions.SendEmail.Tests;

/// <summary>
/// Reads Formulate:Email:Whitelist the way a site does, through the registration the composer makes, and
/// runs the check the site runs at startup.
/// </summary>
/// <remarks>
/// Only a missing setting allows every address. A setting that is there but gives no domain or address
/// (an empty value, separators only, an empty array) allows no address typed into a form, and is warned about.
/// </remarks>
public sealed class WhitelistSettingTests
{
    [Fact]
    public void Whitelist_is_read_from_an_array_in_appsettings()
    {
        var (whitelist, logs) = Read(Json("""{ "Formulate": { "Email": { "Whitelist": [ "example.com", "boss@other.test" ] } } }"""));

        AssertAllows(whitelist, "ada@example.com", "boss@other.test");
        AssertBlocks(whitelist, "eve@other.test", "eve@mail.example.com");
        Assert.Empty(logs.Warnings);
    }

    [Fact]
    public void Whitelist_is_read_from_one_environment_variable_separated_by_commas_or_semicolons()
    {
        WithEnvironmentVariable("example.com; boss@other.test,third.test", configuration =>
        {
            var (whitelist, logs) = Read(configuration);

            AssertAllows(whitelist, "ada@example.com", "boss@other.test", "x@third.test");
            AssertBlocks(whitelist, "eve@other.test");
            Assert.Empty(logs.Warnings);
        });
    }

    [Fact]
    public void Array_entries_may_also_hold_several_values()
    {
        var (whitelist, logs) = Read(Json("""{ "Formulate": { "Email": { "Whitelist": [ "example.com;third.test", " , " ] } } }"""));

        AssertAllows(whitelist, "ada@example.com", "x@third.test");
        AssertBlocks(whitelist, "eve@other.test");
        Assert.Empty(logs.Warnings);
    }

    [Theory]
    [InlineData("\"\"")]
    [InlineData("\"   \"")]
    [InlineData("\";\"")]
    [InlineData("\" , \"")]
    [InlineData("\"@\"")]
    [InlineData("[]")]
    [InlineData("[\"\"]")]
    [InlineData("[\" ; \"]")]
    public void Whitelist_in_appsettings_with_no_entries_allows_no_typed_address(string value)
    {
        var (whitelist, logs) = Read(Json("{ \"Formulate\": { \"Email\": { \"Whitelist\": " + value + " } } }"));

        AssertFailsClosed(whitelist, logs);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(";")]
    [InlineData(" , ")]
    public void Whitelist_in_an_environment_variable_with_no_entries_allows_no_typed_address(string value)
    {
        WithEnvironmentVariable(value, configuration =>
        {
            var (whitelist, logs) = Read(configuration);

            AssertFailsClosed(whitelist, logs);
        });
    }

    [Fact]
    public void Empty_value_allows_no_typed_address()
    {
        // The key and value the environment variables provider makes of Formulate__Email__Whitelist=, so this
        // also runs where a process cannot give itself an empty variable.
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Formulate:Email:Whitelist"] = string.Empty })
            .Build();

        var (whitelist, logs) = Read(configuration);

        AssertFailsClosed(whitelist, logs);
    }

    [Fact]
    public void A_single_value_with_no_entries_still_replaces_an_array()
    {
        WithEnvironmentVariable(";", environment =>
        {
            var configuration = new ConfigurationBuilder()
                .AddJsonStream(Stream("""{ "Formulate": { "Email": { "Whitelist": [ "example.com" ] } } }"""))
                .AddConfiguration(environment)
                .Build();

            var (whitelist, logs) = Read(configuration);

            AssertFailsClosed(whitelist, logs);
        });
    }

    [Theory]
    [InlineData("""{ }""")]
    [InlineData("""{ "Formulate": { "Email": { "Headers": { "X-Campaign": "contact" } } } }""")]
    [InlineData("""{ "Formulate": { "Email": { "Whitelist": null } } }""")]
    public void Whitelist_that_is_not_set_allows_every_address_and_logs_nothing(string json)
    {
        var (whitelist, logs) = Read(Json(json));

        Assert.True(whitelist.AllowsAll);
        Assert.False(whitelist.AllowsNone);
        AssertAllows(whitelist, "anyone@anywhere.test");
        Assert.Empty(logs.Warnings);
    }

    private static IConfiguration Json(string json) => new ConfigurationBuilder().AddJsonStream(Stream(json)).Build();

    private static MemoryStream Stream(string json) => new(Encoding.UTF8.GetBytes(json));

    /// <summary>
    /// Runs <paramref name="test"/> with the environment variable Formulate__Email__Whitelist set to
    /// <paramref name="value"/>, read through Microsoft's environment variables provider.
    /// </summary>
    private static void WithEnvironmentVariable(string value, Action<IConfiguration> test)
    {
        // A prefix only this call uses keeps the variable away from other tests and the rest of the process.
        var prefix = $"FORMULATE_TEST_{Guid.NewGuid():N}_";
        var name = prefix + "Formulate__Email__Whitelist";
        Environment.SetEnvironmentVariable(name, value);

        try
        {
            Assert.SkipWhen(
                Environment.GetEnvironmentVariable(name) is null,
                "This platform deletes an environment variable that is set to an empty value; Empty_value_allows_no_typed_address covers it.");

            test(new ConfigurationBuilder().AddEnvironmentVariables(prefix).Build());
        }
        finally
        {
            Environment.SetEnvironmentVariable(name, null);
        }
    }

    /// <summary>
    /// Registers the settings as the composer does, runs the startup check, and reads the whitelist.
    /// </summary>
    private static (EmailWhitelist Whitelist, CapturingLoggerProvider Logs) Read(IConfiguration configuration)
    {
        var logs = new CapturingLoggerProvider();
        var services = new ServiceCollection();
        services.AddLogging(x => x.AddProvider(logs));
        services.AddFormulateEmailSettings(configuration);
        services.AddSingleton<EmailWhitelistSettingCheck>();
        using var provider = services.BuildServiceProvider();

        provider.GetRequiredService<EmailWhitelistSettingCheck>().Handle(new UmbracoApplicationStartingNotification(RuntimeLevel.Run, false));

        return (new EmailWhitelist(provider.GetRequiredService<IOptionsMonitor<EmailSettings>>().CurrentValue.Whitelist), logs);
    }

    private static void AssertFailsClosed(EmailWhitelist whitelist, CapturingLoggerProvider logs)
    {
        Assert.False(whitelist.AllowsAll);
        Assert.True(whitelist.AllowsNone);
        AssertBlocks(whitelist, "ada@example.com");
        var warning = Assert.Single(logs.Warnings);
        Assert.Contains("Formulate:Email:Whitelist", warning.Message);
    }

    private static void AssertAllows(EmailWhitelist whitelist, params string[] addresses)
    {
        Assert.All(addresses, x => Assert.True(whitelist.Allows(new MailAddress(x)), $"{x} should be allowed."));
    }

    private static void AssertBlocks(EmailWhitelist whitelist, params string[] addresses)
    {
        Assert.All(addresses, x => Assert.False(whitelist.Allows(new MailAddress(x)), $"{x} should be blocked."));
    }
}
