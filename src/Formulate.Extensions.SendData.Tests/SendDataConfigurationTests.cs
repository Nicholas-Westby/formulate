using System.Text.Json;
using Formulate.Extensions.SendData.FormHandlers;
using Formulate.Extensions.SendData.Tests.TestSupport;
using static Formulate.Extensions.SendData.Tests.TestSupport.TestForms;

namespace Formulate.Extensions.SendData.Tests;

/// <summary>
/// The stored configuration: null, {} and what Formulate 3 stored all read, and the back office gets
/// Formulate 3's names.
/// </summary>
public sealed class SendDataConfigurationTests
{
    /// <summary>
    /// A configuration as Formulate 3's editor stored it (ids are "N" format GUIDs).
    /// </summary>
    private const string V3Sample = """
        {"url":"https://hooks.example.com/in","method":"POST","transmissionFormat":"JSON","fields":[{"id":"{0}","name":"first_name"}],"resultHandler":"MySite.Handlers.CrmResult, MySite"}
        """;

    private const string DefaultJson = "{\"url\":null,\"method\":\"GET\",\"transmissionFormat\":\"Query String\",\"fields\":[]}";

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("{}")]
    public async Task Null_and_empty_configuration_save_and_send_nothing(string? json)
    {
        await using var services = SendDataTestServices.Create();
        var definition = services.Definition;
        var settings = SendDataTestServices.Settings(definition, json);
        var field = Field("Name", TextKind, "name");

        // What the back office write check runs.
        var back = definition.GetBackOfficeConfiguration(settings);
        Assert.Equal(DefaultJson, TestForms.Json.Serialize(back));
        var handler = Assert.IsAssignableFrom<Formulate.Core.FormHandlers.AsyncFormHandler>(definition.CreateHandler(settings));
        await handler.HandleAsync(Submit(TestForms.Form(field)).Value(field, "Ann").Build(), TestContext.Current.CancellationToken);

        Assert.Empty(services.Network.Requests);
        var log = Assert.Single(services.Logs.Entries, x => x.Message.Contains("no URL"));
        Assert.Contains("Send to the CRM", log.Message);
        Assert.Contains("Contact Us", log.Message);
    }

    [Fact]
    public async Task Defaults_are_formulate_3s_get_and_query_string()
    {
        await using var services = SendDataTestServices.Create();

        var back = services.Definition.GetBackOfficeConfiguration(SendDataTestServices.Settings(services.Definition, "{}"));

        // The configuration the back office gets is Formulate 3's, camelCase, written as the back office writes it.
        Assert.Equal(DefaultJson, TestForms.Json.Serialize(back));
        var config = Assert.IsType<SendDataConfiguration>(back);
        Assert.Equal("GET", config.Method);
        Assert.Equal("Query String", config.TransmissionFormat);
        Assert.Empty(config.Fields);
        Assert.Null(config.Url);
    }

    [Fact]
    public async Task Formulate_3_configuration_is_read()
    {
        await using var services = SendDataTestServices.Create();
        var field = Field("First name", TextKind, "firstName");
        var stored = V3Sample.Replace("{0}", field.Id.ToString("N"));
        var definition = services.Definition;

        var config = Assert.IsType<SendDataConfiguration>(definition.GetBackOfficeConfiguration(SendDataTestServices.Settings(definition, stored)));
        Assert.Equal("https://hooks.example.com/in", config.Url);
        Assert.Equal("POST", config.Method);
        Assert.Equal("JSON", config.TransmissionFormat);
        var mapping = Assert.Single(config.Fields);
        Assert.Equal(field.Id.ToString("N"), mapping.Id);
        Assert.Equal("first_name", mapping.Name);

        // And it sends.
        await services.SendAsync(stored, Submit(TestForms.Form(field)).Value(field, "Ann").Build());
        Assert.Equal("{\"first_name\":\"Ann\"}", services.Network.Single.Body);
    }

    [Fact]
    public async Task Stored_result_handler_is_ignored_with_one_warning()
    {
        await using var services = SendDataTestServices.Create();
        var field = Field("First name", TextKind, "firstName");
        var stored = V3Sample.Replace("{0}", field.Id.ToString("N"));

        await services.SendAsync(stored, Submit(TestForms.Form(field)).Value(field, "Ann").Build());

        // It still sent, and the warning names the handler and the notification to use.
        Assert.Single(services.Network.Requests);
        var warning = Assert.Single(services.Logs.Warnings);
        Assert.Contains("Send to the CRM", warning.Message);
        Assert.Contains("resultHandler", warning.Message);
        Assert.Contains("SentDataNotification", warning.Message);
        Assert.Empty(services.Logs.Errors);
    }

    [Fact]
    public async Task Stored_result_handler_is_not_given_back_to_the_back_office()
    {
        await using var services = SendDataTestServices.Create();
        var id = Guid.NewGuid().ToString("N");
        var stored = V3Sample.Replace("{0}", id);

        var back = services.Definition.GetBackOfficeConfiguration(SendDataTestServices.Settings(services.Definition, stored));

        Assert.Equal(
            "{\"url\":\"https://hooks.example.com/in\",\"method\":\"POST\",\"transmissionFormat\":\"JSON\",\"fields\":[{\"id\":\"" + id + "\",\"name\":\"first_name\"}]}",
            TestForms.Json.Serialize(back));
    }

    [Fact]
    public async Task Unreleased_v4_names_are_ignored()
    {
        await using var services = SendDataTestServices.Create();
        var field = Field("Name", TextKind, "name");

        await services.SendAsync(new { httpClientName = "x", endpointUrl = "http://old.test/in" }, Submit(TestForms.Form(field)).Value(field, "Ann").Build());

        Assert.Empty(services.Network.Requests);
    }

    [Fact]
    public async Task Kind_id_is_formulate_3s()
    {
        await using var services = SendDataTestServices.Create();

        Assert.Equal(Guid.Parse("C76E8D1D5DF244CB8FA285C32312D688"), services.Definition.KindId);
    }
}
