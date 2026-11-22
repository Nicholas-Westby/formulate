using Formulate.Core.FormFields;
using Formulate.Core.FormFields.Button;
using Formulate.Core.Layouts.Basic;
using Formulate.Extensions.PlainJavaScriptTemplate.Core;
using Formulate.Extensions.PlainJavaScriptTemplate.Core.Mapping.FormFields;
using Formulate.Extensions.PlainJavaScriptTemplate.Core.Mapping.Layouts;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Core.Mapping;
using Newtonsoft.Json.Linq;
using Moq;
using Xunit;

namespace Formulate.Extensions.PlainJavaScriptTemplate.Tests;

public sealed class FormJsonTests
{
    [Fact]
    public void Json_escapes_script_breakout_sequences()
    {
        const string label = "</script><!-- & ' \u2028 \u2029 >";
        var harness = new FormJsonHarness();
        harness.AddField("name", label, new PlainJavaScriptFormField("text"));

        var raw = harness.BuildRaw(formName: "</script>");

        Assert.DoesNotContain("</", raw);
        Assert.DoesNotContain("<!--", raw);
        Assert.DoesNotContain("<", raw);
        Assert.DoesNotContain(">", raw);
        Assert.DoesNotContain("&", raw);
        Assert.DoesNotContain("'", raw);
        Assert.DoesNotContain("\u2028", raw);
        Assert.DoesNotContain("\u2029", raw);
        var parsed = JObject.Parse(raw);
        Assert.Equal(label, parsed["data"]!["fields"]![0]!["label"]!.Value<string>());
        Assert.Equal("</script>", parsed["data"]!["name"]!.Value<string>());
    }

    [Fact]
    public void IsStep_is_copied_from_layout()
    {
        var layout = new BasicLayout(Mock.Of<Formulate.Core.Layouts.ILayoutSettings>(), new BasicLayoutConfiguration
        {
            Rows = new[]
            {
                new BasicLayoutRow { IsStep = false, Cells = new[] { new BasicLayoutCell { ColumnSpan = 12 } } },
                new BasicLayoutRow { IsStep = true },
            }
        });

        var mapped = RunMap<BasicLayout, PlainJavaScriptLayout?>(new BasicLayoutMapDefinition(), layout)!;

        Assert.Equal(new[] { false, true }, mapped.Rows.Select(x => x.IsStep));
    }

    [Fact]
    public void Button_kind_is_emitted()
    {
        var field = new ButtonField(Mock.Of<IFormFieldSettings>(), new ButtonFieldConfiguration { ButtonKind = "Next" });

        var mapped = RunMap<ButtonField, PlainJavaScriptFormField>(new ButtonFieldMapDefinition(), field);

        Assert.Equal("button", mapped.FieldType);
        var json = JObject.FromObject(mapped.Configuration);
        Assert.Equal("Next", json["buttonKind"]!.Value<string>());
    }

    [Fact]
    public void Button_map_definition_is_registered()
    {
        var collection = new MapDefinitionCollectionBuilder();
        var builder = new Mock<IUmbracoBuilder>();
        builder.Setup(x => x.WithCollectionBuilder<MapDefinitionCollectionBuilder>()).Returns(collection);

        builder.Object.AddMapDefinitions();

        Assert.True(collection.Has<ButtonFieldMapDefinition>());
    }

    /// <summary>Runs the map a definition registers, the way the mapper would.</summary>
    private static TTarget RunMap<TSource, TTarget>(IMapDefinition definition, TSource source)
    {
        Func<TSource, MapperContext, TTarget>? map = null;
        var mapper = new Mock<IUmbracoMapper>();
        mapper.Setup(x => x.Define(It.IsAny<Func<TSource, MapperContext, TTarget>>()))
            .Callback<Func<TSource, MapperContext, TTarget>>(x => map = x);

        definition.DefineMaps(mapper.Object);

        Assert.NotNull(map);
        return map(source, null!);
    }
}
