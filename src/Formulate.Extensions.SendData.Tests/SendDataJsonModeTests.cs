using Formulate.Extensions.SendData.Tests.TestSupport;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;
using static Formulate.Extensions.SendData.Tests.TestSupport.TestForms;

namespace Formulate.Extensions.SendData.Tests;

/// <summary>
/// Formulate:SendData:JsonMode: a plain object by default, or Formulate 3's array around the object.
/// </summary>
public sealed class SendDataJsonModeTests
{
    private readonly PersistedFormField _name = Field("Name", TextKind, "name");

    private object Config(string format = "JSON") => new
    {
        url = "http://hook.test/in",
        method = "POST",
        transmissionFormat = format,
        fields = new[] { new { id = _name.Id.ToString("N"), name = "first_name" } },
    };

    private FormSubmissionRequest Submission() => Submit(TestForms.Form(_name)).Value(_name, "Ann").Build();

    private static SendDataTestServices Services(string? mode)
    {
        var settings = new Dictionary<string, string?>();

        if (mode is not null)
        {
            settings["Formulate:SendData:JsonMode"] = mode;
        }

        var configuration = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();

        // Bound the way the composer binds it.
        return SendDataTestServices.Create(x => x.Configure<SendDataSettings>(configuration.GetSection(SendDataSettings.SectionName)));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("Object")]
    [InlineData("object")]
    public async Task Object_mode_is_the_default(string? mode)
    {
        await using var services = Services(mode);

        await services.SendAsync(Config(), Submission());

        Assert.Equal("{\"first_name\":\"Ann\"}", services.Network.Single.Body);
        Assert.Empty(services.Logs.Warnings);
    }

    [Theory]
    [InlineData("WrappedArray")]
    [InlineData("wrappedarray")]
    public async Task Wrapped_array_mode_sends_v3s_array_around_the_object(string mode)
    {
        await using var services = Services(mode);

        await services.SendAsync(Config(), Submission());

        Assert.Equal("[{\"first_name\":\"Ann\"}]", services.Network.Single.Body);
        Assert.Equal("application/json; charset=utf-8", services.Network.Single.ContentType);
    }

    [Fact]
    public async Task Wrapped_array_mode_does_not_change_hubspot_json_or_other_formats()
    {
        await using var services = Services("WrappedArray");

        await services.SendAsync(Config("HubSpot JSON"), Submission());
        await services.SendAsync(Config("Form Body"), Submission());

        Assert.StartsWith("{\"fields\"", services.Network.Requests[0].Body);
        Assert.Equal("first_name=Ann", services.Network.Requests[1].Body);
    }

    [Fact]
    public async Task Unknown_mode_sends_an_object_without_a_warning_on_every_send()
    {
        await using var services = Services("Array");

        await services.SendAsync(Config(), Submission());
        await services.SendAsync(Config(), Submission());

        Assert.All(services.Network.Requests, x => Assert.Equal("{\"first_name\":\"Ann\"}", x.Body));
        Assert.Empty(services.Logs.Warnings);
    }

    [Theory]
    [InlineData("Array", true)]
    [InlineData("Object", false)]
    [InlineData("wrappedarray", false)]
    [InlineData(null, false)]
    public void Startup_warns_once_about_a_mode_that_is_not_known(string? mode, bool warns)
    {
        var logs = new CapturingLoggerProvider();
        using var loggerFactory = Microsoft.Extensions.Logging.LoggerFactory.Create(x => x.AddProvider(logs));
        var settings = Microsoft.Extensions.Options.Options.Create(mode is null ? new SendDataSettings() : new SendDataSettings { JsonMode = mode });
        var check = new Formulate.Extensions.SendData.Utilities.SendDataJsonModeSettingCheck(settings, loggerFactory.CreateLogger<Formulate.Extensions.SendData.Utilities.SendDataJsonModeSettingCheck>());

        check.Handle(new Umbraco.Cms.Core.Notifications.UmbracoApplicationStartingNotification(Umbraco.Cms.Core.RuntimeLevel.Run, false));

        if (warns)
        {
            var warning = Assert.Single(logs.Warnings);
            Assert.Contains("Formulate:SendData:JsonMode", warning.Message);
            Assert.Contains("Array", warning.Message);
        }
        else
        {
            Assert.Empty(logs.Warnings);
        }
    }
}
