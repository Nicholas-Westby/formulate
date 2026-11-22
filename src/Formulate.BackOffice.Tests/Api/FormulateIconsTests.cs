using Xunit;
using Formulate.BackOffice.Api;

namespace Formulate.BackOffice.Tests.Api;

public class FormulateIconsTests
{
    [Theory]
    [InlineData(EntityTypes.FormsRoot, "icon-folder")]
    [InlineData(EntityTypes.FormFolder, "icon-folder")]
    [InlineData(EntityTypes.DataValuesFolder, "icon-folder")]
    [InlineData(EntityTypes.ValidationFolder, "icon-folder")]
    [InlineData(EntityTypes.Form, "icon-document")]
    [InlineData(EntityTypes.Layout, "icon-layout")]
    [InlineData(EntityTypes.Validation, "icon-check")]
    [InlineData(EntityTypes.DataValues, "icon-bulleted-list")]
    [InlineData("something-else", "icon-document")]
    public void Default_icon_follows_the_entity_type(string entityType, string expected)
    {
        Assert.Equal(expected, FormulateIcons.For(entityType, null));
    }

    [Theory]
    [InlineData("icon-globe", "icon-globe")]
    [InlineData("icon-formulate-value", "icon-bulleted-list")]
    [InlineData("icon-formulate-", "icon-bulleted-list")]
    [InlineData("formulate-value", "icon-bulleted-list")]
    [InlineData("", "icon-bulleted-list")]
    [InlineData("   ", "icon-bulleted-list")]
    [InlineData(null, "icon-bulleted-list")]
    [InlineData("Icon-globe", "icon-bulleted-list")]
    public void Definition_icon_is_used_only_when_it_is_a_built_in_name(string? definitionIcon, string expected)
    {
        Assert.Equal(expected, FormulateIcons.For(EntityTypes.DataValues, definitionIcon));
    }

    [Fact]
    public void Folders_and_forms_ignore_the_definition_icon()
    {
        Assert.Equal("icon-folder", FormulateIcons.For(EntityTypes.FormFolder, "icon-globe"));
        Assert.Equal("icon-document", FormulateIcons.For(EntityTypes.Form, "icon-globe"));
    }
}
