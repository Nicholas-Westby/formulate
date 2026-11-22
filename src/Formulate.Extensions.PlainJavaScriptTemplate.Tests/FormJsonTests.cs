using Formulate.Core.FormFields;
using Formulate.Core.FormFields.Button;
using Formulate.Core.FormFields.Hidden;
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
        Assert.True(collection.Has<HiddenFieldMapDefinition>());
    }

    [Fact]
    public void Hidden_value_prefers_query_string_then_configured_text()
    {
        var hidden = new PlainJavaScriptFormField(new { text = "configured" }, "hidden");

        var withoutQuery = new FormJsonHarness();
        withoutQuery.AddField("source", "Source", hidden);
        var withQuery = new FormJsonHarness { QueryString = "?source=newsletter%20%3Cb%3E" };
        withQuery.AddField("source", "Source", hidden);

        var plain = withoutQuery.Build()["data"]!["fields"]![0]!;
        var prefilled = withQuery.Build()["data"]!["fields"]![0]!;

        Assert.Equal("configured", plain["initialValue"]!.Value<string>());
        Assert.Equal("configured", plain["configuration"]!["text"]!.Value<string>());
        Assert.Equal("newsletter <b>", prefilled["initialValue"]!.Value<string>());
        Assert.Equal("newsletter <b>", prefilled["configuration"]!["text"]!.Value<string>());
    }

    // An empty value (?alias=) is the same as no value, so it never wipes what the form is configured with.
    [Fact]
    public void Empty_query_string_values_are_ignored()
    {
        var harness = new FormJsonHarness { QueryString = "?source=&name=&interests=" };
        harness.AddField("source", "Source", new PlainJavaScriptFormField(new { text = "configured" }, "hidden"));
        harness.AddField("name", "Name", new PlainJavaScriptFormField("text"));
        harness.AddField("interests", "Interests", new PlainJavaScriptFormField("checkbox-list"));

        var fields = harness.Build()["data"]!["fields"]!;

        Assert.Equal("configured", fields[0]!["initialValue"]!.Value<string>());
        Assert.Equal("configured", fields[0]!["configuration"]!["text"]!.Value<string>());
        Assert.Equal("", fields[1]!["initialValue"]!.Value<string>());
        Assert.Equal("", fields[2]!["initialValue"]!.Value<string>());
    }

    [Fact]
    public void Hidden_map_emits_the_configured_text()
    {
        var field = new HiddenField(Mock.Of<IFormFieldSettings>(), new HiddenFieldConfiguration { Text = "abc" });

        var mapped = RunMap<HiddenField, PlainJavaScriptFormField>(new HiddenFieldMapDefinition(), field);

        Assert.Equal("hidden", mapped.FieldType);
        Assert.Equal("abc", JObject.FromObject(mapped.Configuration)["text"]!.Value<string>());
    }

    [Fact]
    public void Text_initial_value_comes_from_query_string_alias()
    {
        var harness = new FormJsonHarness { QueryString = "?email=a%40b.c&other=x&interests=a&interests=b" };
        harness.AddField("email", "Email", new PlainJavaScriptFormField("text"));
        harness.AddField("name", "Name", new PlainJavaScriptFormField("text"));
        harness.AddField("interests", "Interests", new PlainJavaScriptFormField("checkbox-list"));

        var fields = harness.Build()["data"]!["fields"]!;

        Assert.Equal("a@b.c", fields[0]!["initialValue"]!.Value<string>());
        Assert.Equal("", fields[1]!["initialValue"]!.Value<string>());
        Assert.Equal(new[] { "a", "b" }, fields[2]!["initialValue"]!.Values<string>());
    }

    [Fact]
    public void Unknown_field_kinds_map_through_the_default_map()
    {
        var field = Mock.Of<IFormField>();

        var mapped = RunMap<IFormField, PlainJavaScriptFormField>(new DefaultFormFieldMapDefinition(), field);

        Assert.False(string.IsNullOrEmpty(mapped.FieldType));
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
