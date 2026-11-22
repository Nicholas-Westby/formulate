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
    private static ConfigApiService Create(ButtonsOptions buttons, FormFieldOptions fields, FormulateBackOfficeOptions backOffice) =>
        new(Options.Create(buttons), Options.Create(fields), Options.Create(backOffice));

    [Fact]
    public void Config_lists_button_kinds_field_categories_and_the_folder_icon_setting()
    {
        var buttons = new ButtonsOptions { new ButtonItem { Kind = "Next" }, new ButtonItem { Kind = "Submit" } };
        var fields = new FormFieldOptions { Categories = new[] { new FormFieldCategory { Group = "Inputs", Kind = "Text" } } };

        var config = Create(buttons, fields, new FormulateBackOfficeOptions { UseDefaultFolderIcon = true }).Get();

        Assert.Equal(new[] { "Next", "Submit" }, config.ButtonKinds);
        var category = Assert.Single(config.FieldCategories);
        Assert.Equal(("Inputs", "Text"), (category.Group, category.Kind));
        Assert.True(config.UseDefaultFolderIcon);
    }

    [Fact]
    public void Empty_options_give_no_buttons_no_categories_and_tree_folder_icons()
    {
        var config = Create(new ButtonsOptions(), new FormFieldOptions(), new FormulateBackOfficeOptions()).Get();

        Assert.Empty(config.ButtonKinds);
        Assert.Empty(config.FieldCategories);
        Assert.False(config.UseDefaultFolderIcon);
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
            ["Formulate:BackOffice:UseDefaultFolderIcon"] = "true",
        }).Get();

        Assert.Equal(new[] { "Reset" }, config.ButtonKinds);
        Assert.Equal(("Inputs", "Text"), (config.FieldCategories[0].Group, config.FieldCategories[0].Kind));
        Assert.True(config.UseDefaultFolderIcon);
    }
}
