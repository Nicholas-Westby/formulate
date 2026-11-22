using Formulate.BackOffice.Api.Services;
using Formulate.BackOffice.Configuration;
using Formulate.Core.Configuration;
using System.Reflection;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Moq;
using Umbraco.Cms.Core.DependencyInjection;
using Xunit;

namespace Formulate.BackOffice.Tests.Api;

public class ConfigApiServiceTests
{
    private static ConfigApiService Create(ButtonsOptions buttons, FormFieldOptions fields, FormulateRecaptchaOptions? recaptcha = null) =>
        new(Options.Create(buttons), Options.Create(fields), Options.Create(recaptcha ?? new FormulateRecaptchaOptions()));

    [Fact]
    public void Config_lists_button_kinds_and_field_categories()
    {
        var buttons = new ButtonsOptions { new ButtonItem { Kind = "Next" }, new ButtonItem { Kind = "Submit" } };
        var fields = new FormFieldOptions { Categories = new[] { new FormFieldCategory { Group = "Inputs", Kind = "Text" } } };

        var config = Create(buttons, fields).Get();

        Assert.Equal(new[] { "Next", "Submit" }, config.ButtonKinds);
        var category = Assert.Single(config.FieldCategories);
        Assert.Equal(("Inputs", "Text"), (category.Group, category.Kind));
    }

    [Fact]
    public void Empty_options_give_no_buttons_and_no_categories()
    {
        var config = Create(new ButtonsOptions(), new FormFieldOptions()).Get();

        Assert.Empty(config.ButtonKinds);
        Assert.Empty(config.FieldCategories);
    }

    [Fact]
    public void There_is_no_folder_icon_setting_because_every_folder_uses_the_folder_icon()
    {
        Assert.Equal(new[] { "ButtonKinds", "FieldCategories", "RecaptchaConfigured" }, typeof(Formulate.BackOffice.Api.Models.Config.FormulateConfigResponseModel).GetProperties().Select(x => x.Name).Order());
        Assert.Null(typeof(FormulateBackOfficeOptions).GetProperty("UseDefaultFolderIcon"));
    }

    // A reCAPTCHA field needs both keys: without the site key the visitor's browser cannot show the widget, and
    // without the secret key the server cannot check the response (RecaptchaField and RecaptchaFieldMapDefinition
    // count a blank key as missing too).
    [Theory]
    [InlineData(null, null, false)]
    [InlineData("the-site-key", null, false)]
    [InlineData(null, "the-secret-key", false)]
    [InlineData("the-site-key", "the-secret-key", true)]
    [InlineData("", "", false)]
    [InlineData("the-site-key", "", false)]
    [InlineData("", "the-secret-key", false)]
    [InlineData(" ", "the-secret-key", false)]
    [InlineData("the-site-key", " \t", false)]
    public void Recaptcha_is_configured_only_when_both_keys_are_set(string? siteKey, string? secretKey, bool configured)
    {
        var recaptcha = new FormulateRecaptchaOptions { SiteKey = siteKey!, SecretKey = secretKey! };

        var config = Create(new ButtonsOptions(), new FormFieldOptions(), recaptcha).Get();

        Assert.Equal(configured, config.RecaptchaConfigured);
    }

    [Fact]
    public void The_config_says_that_recaptcha_is_configured_without_giving_either_key()
    {
        var recaptcha = new FormulateRecaptchaOptions { SiteKey = "6LcSiteKeyValue", SecretKey = "6LcSecretKeyValue" };

        var config = Create(new ButtonsOptions(), new FormFieldOptions(), recaptcha).Get();
        // As the Management API writes it (System.Text.Json, camel case).
        var json = JsonSerializer.Serialize(config, new JsonSerializerOptions(JsonSerializerDefaults.Web));

        Assert.Contains("\"recaptchaConfigured\":true", json);
        Assert.DoesNotContain("6LcSiteKeyValue", json);
        Assert.DoesNotContain("6LcSecretKeyValue", json);
    }

    private static ConfigApiService CreateAsConfiguredByTheApp(Dictionary<string, string?> settings)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
        var services = new ServiceCollection();
        var builder = new Mock<IUmbracoBuilder>();
        builder.SetupGet(x => x.Services).Returns(services);
        builder.SetupGet(x => x.Config).Returns(configuration);
        typeof(Formulate.BackOffice.DependencyInjection.UmbracoBuilderExtensions)
            .GetMethod("AddFormulateConfiguration", BindingFlags.NonPublic | BindingFlags.Static)!
            .Invoke(null, new object[] { builder.Object });
        // Formulate's core registers the reCAPTCHA settings, which the reCAPTCHA field reads too.
        typeof(Formulate.Core.DependencyInjection.UmbracoBuilderExtensions)
            .GetMethod("AddFormulateUtilities", BindingFlags.NonPublic | BindingFlags.Static)!
            .Invoke(null, new object[] { builder.Object });
        services.AddSingleton<IConfigApiService, ConfigApiService>();

        return (ConfigApiService)services.BuildServiceProvider().GetRequiredService<IConfigApiService>();
    }

    [Fact]
    public void Nothing_configured_falls_back_to_next_previous_and_submit_buttons()
    {
        var config = CreateAsConfiguredByTheApp(new());

        Assert.Equal(new[] { "Next", "Previous", "Submit" }, config.Get().ButtonKinds);
    }

    [Fact]
    public void Configured_buttons_replace_the_fallback()
    {
        var config = CreateAsConfiguredByTheApp(new()
        {
            ["Formulate:Buttons:0:Kind"] = "Reset",
            ["Formulate:Fields:Categories:0:Group"] = "Inputs",
            ["Formulate:Fields:Categories:0:Kind"] = "Text",
        }).Get();

        Assert.Equal(new[] { "Reset" }, config.ButtonKinds);
        Assert.Equal(("Inputs", "Text"), (config.FieldCategories[0].Group, config.FieldCategories[0].Kind));
    }

    [Fact]
    public void The_recaptcha_keys_are_read_from_the_settings_the_recaptcha_field_reads()
    {
        var both = CreateAsConfiguredByTheApp(new()
        {
            ["Formulate:Recaptcha:SiteKey"] = "the-site-key",
            ["Formulate:Recaptcha:SecretKey"] = "the-secret-key",
        }).Get();
        var siteKeyOnly = CreateAsConfiguredByTheApp(new() { ["Formulate:Recaptcha:SiteKey"] = "the-site-key" }).Get();
        var nothing = CreateAsConfiguredByTheApp(new()).Get();

        Assert.Equal((true, false, false), (both.RecaptchaConfigured, siteKeyOnly.RecaptchaConfigured, nothing.RecaptchaConfigured));
    }

    [Fact]
    public void Blank_keys_as_the_dev_site_sets_them_are_not_configured()
    {
        // src/Website/appsettings.json sets both keys to "".
        var config = CreateAsConfiguredByTheApp(new()
        {
            ["Formulate:Recaptcha:SiteKey"] = "",
            ["Formulate:Recaptcha:SecretKey"] = "",
        }).Get();

        Assert.False(config.RecaptchaConfigured);
    }
}
