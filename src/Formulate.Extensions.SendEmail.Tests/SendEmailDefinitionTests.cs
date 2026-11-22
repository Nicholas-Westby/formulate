using System.Text.Json;
using Formulate.Core.FormHandlers;
using Formulate.Extensions.SendEmail.FormHandlers;
using Formulate.Extensions.SendEmail.Tests.TestSupport;
using Xunit;
using static Formulate.Extensions.SendEmail.Tests.TestSupport.TestForms;

namespace Formulate.Extensions.SendEmail.Tests;

/// <summary>
/// The Email handler's definition: its kind, and reading the configuration the back office stores.
/// </summary>
public sealed class SendEmailDefinitionTests
{
    [Fact]
    public async Task Definition_keeps_the_formulate_kind_and_editor()
    {
        await using var services = EmailTestServices.Create();
        var definition = services.EmailDefinition;

        Assert.Equal(Guid.Parse("A0C06033CB94424F9C035B10A420DB16"), definition.KindId);
        Assert.Equal("formulate-send-email-handler", definition.EditorAlias);
        Assert.Equal(FormHandlerConstants.Categories.Notify, definition.Category);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("{}")]
    [InlineData("null")]
    [InlineData("{\"recipients\":null,\"recipientFields\":null,\"fieldsToInclude\":null}")]
    public async Task Definition_accepts_a_missing_or_empty_configuration(string? json)
    {
        // A handler just added in the back office is saved, and validated, with no configuration.
        var form = Form();
        await using var services = EmailTestServices.Create();
        var definition = services.EmailDefinition;
        var settings = EmailTestServices.Settings(definition, json);

        var handler = Assert.IsType<SendEmailFormHandler>(definition.CreateHandler(settings));
        var configuration = Assert.IsType<SendEmailConfiguration>(definition.GetBackOfficeConfiguration(settings));

        Assert.Empty(handler.Configuration.Recipients);
        Assert.Empty(configuration.RecipientFields);
        Assert.Empty(configuration.FieldsToInclude);
        Assert.False(configuration.AppendFields);

        // Until it is configured it only logs that it has nobody to send to.
        await handler.HandleAsync(Submit(form).Build(), TestContext.Current.CancellationToken);
        Assert.Empty(services.Sent);
        Assert.Contains("no recipients", Assert.Single(services.Logs.Warnings).Message);
    }

    [Fact]
    public async Task Definition_reads_formulate_3_configuration()
    {
        // As Formulate 3 stored it: GUIDs with and without dashes, booleans, and an unknown property.
        const string json = """
            {
              "senderEmail": "forms@site.test",
              "recipients": [ { "email": "team@site.test" }, { "email": "boss@site.test" } ],
              "recipientFields": [ { "id": "c6d5e3a3-0d6c-4b8d-9d4c-6a1f2a3b4c5d" } ],
              "deliveryType": "cc",
              "subject": "New enquiry",
              "message": "Hello",
              "appendFields": true,
              "appendPayload": true,
              "excludeFieldLabels": true,
              "includeHiddenFields": true,
              "fieldsToInclude": [ { "id": "1D9C4A7B2E3F4A5B8C6D7E8F9A0B1C2D" } ],
              "somethingElse": 42
            }
            """;
        await using var services = EmailTestServices.Create();
        var definition = services.EmailDefinition;

        var handler = Assert.IsType<SendEmailFormHandler>(definition.CreateHandler(EmailTestServices.Settings(definition, json)));
        var configuration = handler.Configuration;

        Assert.Equal("forms@site.test", configuration.SenderEmail);
        Assert.Equal(new[] { "team@site.test", "boss@site.test" }, configuration.Recipients.Select(x => x.Email));
        Assert.Equal(Guid.Parse("c6d5e3a3-0d6c-4b8d-9d4c-6a1f2a3b4c5d"), Assert.Single(configuration.RecipientFields).Id);
        Assert.Equal("cc", configuration.DeliveryType);
        Assert.Equal("New enquiry", configuration.Subject);
        Assert.Equal("Hello", configuration.Message);
        Assert.True(configuration.AppendFields);
        Assert.True(configuration.AppendPayload);
        Assert.True(configuration.ExcludeFieldLabels);
        Assert.True(configuration.IncludeHiddenFields);
        Assert.Equal(Guid.Parse("1D9C4A7B2E3F4A5B8C6D7E8F9A0B1C2D"), Assert.Single(configuration.FieldsToInclude).Id);
    }

    [Fact]
    public async Task Back_office_configuration_uses_the_stored_names()
    {
        await using var services = EmailTestServices.Create();
        var definition = services.EmailDefinition;
        var fieldId = Guid.NewGuid();
        var stored = JsonSerializer.Serialize(new
        {
            senderEmail = "forms@site.test",
            recipients = new[] { new { email = "team@site.test" } },
            recipientFields = new[] { new { id = fieldId } },
            deliveryType = "bcc",
            subject = "Subject",
            message = "Message",
            appendFields = true,
            appendPayload = false,
            excludeFieldLabels = true,
            includeHiddenFields = false,
            fieldsToInclude = new[] { new { id = fieldId } },
        });

        // The back office API serializes what the definition returns with the same JSON utility.
        var configuration = definition.GetBackOfficeConfiguration(EmailTestServices.Settings(definition, stored));
        using var shown = JsonDocument.Parse(Json.Serialize(configuration));
        var root = shown.RootElement;

        Assert.Equal(
            new[] { "senderEmail", "recipients", "recipientFields", "deliveryType", "subject", "message", "appendFields", "appendPayload", "excludeFieldLabels", "includeHiddenFields", "fieldsToInclude" }.Order(),
            root.EnumerateObject().Select(x => x.Name).Order());
        Assert.Equal("team@site.test", root.GetProperty("recipients")[0].GetProperty("email").GetString());
        Assert.Equal(fieldId, root.GetProperty("recipientFields")[0].GetProperty("id").GetGuid());
        Assert.Equal(fieldId, root.GetProperty("fieldsToInclude")[0].GetProperty("id").GetGuid());
        Assert.True(root.GetProperty("appendFields").GetBoolean());
        Assert.Equal("bcc", root.GetProperty("deliveryType").GetString());
    }

    [Fact]
    public async Task New_handlers_start_with_an_empty_configuration()
    {
        await using var services = EmailTestServices.Create();
        var definition = services.EmailDefinition;

        // What GET definition/form-handler shows as the default configuration.
        var configuration = definition.GetBackOfficeConfiguration(new PersistedFormHandler { KindId = definition.KindId });
        using var shown = JsonDocument.Parse(Json.Serialize(configuration));

        Assert.Equal(JsonValueKind.Array, shown.RootElement.GetProperty("recipients").ValueKind);
        Assert.Equal(0, shown.RootElement.GetProperty("recipients").GetArrayLength());
        Assert.False(shown.RootElement.GetProperty("appendFields").GetBoolean());
    }
}
