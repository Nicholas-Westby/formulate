using Formulate.BackOffice.Api.Services;
using Formulate.BackOffice.Configuration;
using System.Reflection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Moq;
using Umbraco.Cms.Core.DependencyInjection;
using Xunit;

namespace Formulate.BackOffice.Tests.Api;

public class ConfigApiServiceTests
{
    private static ConfigApiService Create(ButtonsOptions buttons, FormFieldOptions fields) =>
        new(Options.Create(buttons), Options.Create(fields));

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
        Assert.Equal(new[] { "ButtonKinds", "FieldCategories" }, typeof(Formulate.BackOffice.Api.Models.Config.FormulateConfigResponseModel).GetProperties().Select(x => x.Name).Order());
        Assert.Null(typeof(FormulateBackOfficeOptions).GetProperty("UseDefaultFolderIcon"));
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
}
