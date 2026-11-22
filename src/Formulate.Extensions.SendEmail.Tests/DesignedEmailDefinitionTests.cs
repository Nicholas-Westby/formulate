using System.Text.Json;
using Formulate.Core.FormHandlers;
using Formulate.Extensions.SendEmail.DesignedEmail;
using Formulate.Extensions.SendEmail.Tests.TestSupport;
using Xunit;
using static Formulate.Extensions.SendEmail.Tests.TestSupport.TestForms;

namespace Formulate.Extensions.SendEmail.Tests;

/// <summary>
/// The Designed Email handler's definition: Formulate Pro's kind, and reading the configuration Pro stored.
/// </summary>
public sealed class DesignedEmailDefinitionTests
{
    [Fact]
    public async Task Definition_keeps_formulate_pros_kind_and_editor()
    {
        await using var services = EmailTestServices.Create();
        var definition = services.DesignedDefinition;

        // Forms upgraded from Formulate Pro keep working because the kind is the same.
        Assert.Equal(Guid.Parse("15BE7A7D179D40A59AD034B71DAC52D4"), definition.KindId);
        Assert.Equal("Designed Email", definition.Name);
        Assert.Equal("formulate-designed-email-handler", definition.EditorAlias);
        Assert.Equal(FormHandlerConstants.Categories.Notify, definition.Category);
        Assert.False(string.IsNullOrWhiteSpace(definition.Icon));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("{}")]
    [InlineData("null")]
    [InlineData("{\"recipients\":null,\"recipientFields\":null,\"subjectRazorPath\":null,\"htmlEmailRazorPath\":null,\"textEmailRazorPath\":null}")]
    public async Task Definition_accepts_a_missing_or_empty_configuration(string? json)
    {
        // A handler just added in the back office is saved, and validated, with no configuration.
        var form = Form();
        await using var services = EmailTestServices.Create();
        var definition = services.DesignedDefinition;
        var settings = EmailTestServices.Settings(definition, json);

        var handler = Assert.IsType<DesignedEmailFormHandler>(definition.CreateHandler(settings));
        var configuration = Assert.IsType<DesignedEmailConfiguration>(definition.GetBackOfficeConfiguration(settings));

        Assert.Empty(handler.Configuration.Recipients);
        Assert.Empty(configuration.RecipientFields);
        Assert.Null(configuration.HtmlEmailRazorPath);

        // Until it is configured it only logs that it has nobody to send to.
        await handler.HandleAsync(Submit(form).Build(), TestContext.Current.CancellationToken);
        Assert.Empty(services.Sent);
        Assert.Contains("no recipients", Assert.Single(services.Logs.Warnings).Message);
    }

    [Fact]
    public async Task Definition_reads_formulate_pro_configuration()
    {
        const string json = """
            {
              "senderEmail": "forms@site.test",
              "recipients": [ { "email": "team@site.test" } ],
              "recipientFields": [ { "id": "c6d5e3a3-0d6c-4b8d-9d4c-6a1f2a3b4c5d" } ],
              "deliveryType": "to",
              "subject": "New enquiry",
              "message": "Hello",
              "subjectRazorPath": "~/Views/Formulate/Email/Formulate Pro Sample (Subject).cshtml",
              "htmlEmailRazorPath": "~/Views/Formulate/Email/Formulate Pro Sample (HTML).cshtml",
              "textEmailRazorPath": "~/Views/Formulate/Email/Formulate Pro Sample (Text).cshtml"
            }
            """;
        await using var services = EmailTestServices.Create();
        var definition = services.DesignedDefinition;

        var handler = Assert.IsType<DesignedEmailFormHandler>(definition.CreateHandler(EmailTestServices.Settings(definition, json)));
        var configuration = handler.Configuration;

        Assert.Equal("forms@site.test", configuration.SenderEmail);
        Assert.Equal("team@site.test", Assert.Single(configuration.Recipients).Email);
        Assert.Equal(Guid.Parse("c6d5e3a3-0d6c-4b8d-9d4c-6a1f2a3b4c5d"), Assert.Single(configuration.RecipientFields).Id);
        Assert.Equal("to", configuration.DeliveryType);
        Assert.Equal("New enquiry", configuration.Subject);
        Assert.Equal("Hello", configuration.Message);
        Assert.Equal("~/Views/Formulate/Email/Formulate Pro Sample (Subject).cshtml", configuration.SubjectRazorPath);
        Assert.Equal("~/Views/Formulate/Email/Formulate Pro Sample (HTML).cshtml", configuration.HtmlEmailRazorPath);
        Assert.Equal("~/Views/Formulate/Email/Formulate Pro Sample (Text).cshtml", configuration.TextEmailRazorPath);
    }

    [Fact]
    public async Task Back_office_configuration_uses_the_stored_names()
    {
        await using var services = EmailTestServices.Create();
        var definition = services.DesignedDefinition;
        var stored = JsonSerializer.Serialize(new
        {
            recipients = new[] { new { email = "team@site.test" } },
            htmlEmailRazorPath = "~/Views/Emails/Contact.cshtml",
        });

        var configuration = definition.GetBackOfficeConfiguration(EmailTestServices.Settings(definition, stored));
        using var shown = JsonDocument.Parse(Json.Serialize(configuration));
        var root = shown.RootElement;

        Assert.Equal(
            new[] { "senderEmail", "recipients", "recipientFields", "deliveryType", "subject", "message", "subjectRazorPath", "htmlEmailRazorPath", "textEmailRazorPath" }.Order(),
            root.EnumerateObject().Select(x => x.Name).Order());
        Assert.Equal("~/Views/Emails/Contact.cshtml", root.GetProperty("htmlEmailRazorPath").GetString());
    }
}
