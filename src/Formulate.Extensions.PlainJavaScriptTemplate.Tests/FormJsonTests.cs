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
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;
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

    [Fact]
    public void Submit_url_includes_path_base()
    {
        var root = new FormJsonHarness();
        var underPathBase = new FormJsonHarness { PathBase = "/site" };

        Assert.Equal("/api/formulate/plain-js/submit", root.Build()["data"]!["url"]!.Value<string>());
        Assert.Equal("/site/api/formulate/plain-js/submit", underPathBase.Build()["data"]!["url"]!.Value<string>());
    }

    [Fact]
    public void Assets_respect_options()
    {
        var none = new FormJsonHarness { PathBase = "/site" }.Build()["assets"]!;
        var basic = new FormJsonHarness { Theme = "Basic", PathBase = "/site" }.Build()["assets"]!;

        Assert.Equal("/site/App_Plugins/Formulate/PlainJavaScript/formulate.min.js?v=HASH", none["script"]!.Value<string>());
        Assert.Equal(JTokenType.Null, none["theme"]!.Type);
        Assert.Equal("/site/App_Plugins/Formulate/PlainJavaScript/themes/basic.min.css?v=HASH", basic["theme"]!.Value<string>());
    }

    [Fact]
    public void Unknown_theme_acts_as_none_and_warns_once()
    {
        var logger = new Mock<ILogger<PlainJavaScriptAssets>>();
        var assets = new PlainJavaScriptAssets(
            Microsoft.Extensions.Options.Options.Create(new PlainJavaScriptOptions { Theme = "fancy" }),
            new HashingFileVersionProvider(),
            logger.Object);

        var urls = new[] { assets.GetThemeUrl(default), assets.GetThemeUrl(default), assets.TakePageAssets(new DefaultHttpContext()).ThemeUrl };

        Assert.All(urls, Assert.Null);
        logger.Verify(
            x => x.Log(LogLevel.Warning, It.IsAny<EventId>(), It.IsAny<It.IsAnyType>(), null, It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    [Fact]
    public void Script_url_falls_back_to_the_assembly_version_when_the_file_cannot_be_found()
    {
        var harness = new FormJsonHarness { FileVersionProvider = new MissingFileVersionProvider() };

        var script = harness.Build()["assets"]!["script"]!.Value<string>()!;

        Assert.StartsWith("/App_Plugins/Formulate/PlainJavaScript/formulate.min.js?v=", script);
        Assert.NotEqual("/App_Plugins/Formulate/PlainJavaScript/formulate.min.js?v=", script);
    }

    // The real provider, as asp-append-version uses it, with the site under a path base.
    [Fact]
    public void Script_url_carries_a_content_hash_under_a_path_base()
    {
        var webRoot = Path.Combine(Path.GetTempPath(), "formulate-" + Guid.NewGuid().ToString("N"));
        var scriptFolder = Path.Combine(webRoot, "App_Plugins", "Formulate", "PlainJavaScript");
        Directory.CreateDirectory(scriptFolder);
        File.WriteAllText(Path.Combine(scriptFolder, "formulate.min.js"), "console.log(1);");

        try
        {
            var environment = new Mock<Microsoft.AspNetCore.Hosting.IWebHostEnvironment>();
            environment.SetupGet(x => x.WebRootFileProvider).Returns(new Microsoft.Extensions.FileProviders.PhysicalFileProvider(webRoot));
            var services = new Microsoft.Extensions.DependencyInjection.ServiceCollection();
            services.AddSingleton(environment.Object);
            services.AddLogging();
            services.AddMemoryCache();
            services.AddControllersWithViews();
            using var provider = services.BuildServiceProvider();
            var assets = new PlainJavaScriptAssets(
                Microsoft.Extensions.Options.Options.Create(new PlainJavaScriptOptions()),
                provider.GetRequiredService<Microsoft.AspNetCore.Mvc.ViewFeatures.IFileVersionProvider>(),
                Mock.Of<ILogger<PlainJavaScriptAssets>>());

            var url = assets.GetScriptUrl(new PathString("/site"));

            Assert.Matches(@"^/site/App_Plugins/Formulate/PlainJavaScript/formulate\.min\.js\?v=[A-Za-z0-9_-]{20,}$", url);
        }
        finally
        {
            Directory.Delete(webRoot, recursive: true);
        }
    }

    [Fact]
    public void Page_assets_are_taken_once_per_request()
    {
        var assets = new PlainJavaScriptAssets(
            Microsoft.Extensions.Options.Options.Create(new PlainJavaScriptOptions { Theme = "basic" }),
            new HashingFileVersionProvider(),
            Mock.Of<ILogger<PlainJavaScriptAssets>>());
        var request = new DefaultHttpContext();
        var otherRequest = new DefaultHttpContext();

        var first = assets.TakePageAssets(request);
        var second = assets.TakePageAssets(request);
        var other = assets.TakePageAssets(otherRequest);

        Assert.EndsWith("/formulate.min.js?v=HASH", first.ScriptUrl);
        Assert.EndsWith("themes/basic.min.css?v=HASH", first.ThemeUrl);
        Assert.Null(second.ScriptUrl);
        Assert.Null(second.ThemeUrl);
        Assert.Equal(first, other);
    }

    [Fact]
    public void Page_assets_leave_out_the_script_when_it_is_turned_off()
    {
        var assets = new PlainJavaScriptAssets(
            Microsoft.Extensions.Options.Options.Create(new PlainJavaScriptOptions { IncludeScript = false }),
            new HashingFileVersionProvider(),
            Mock.Of<ILogger<PlainJavaScriptAssets>>());

        var page = assets.TakePageAssets(new DefaultHttpContext());

        Assert.Null(page.ScriptUrl);
        Assert.Null(page.ThemeUrl);
    }

    [Fact]
    public void Form_json_has_the_same_shape_as_the_renderer_fixture()
    {
        var fixture = JObject.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "fixtures", "multi-step.json")));
        var harness = new FormJsonHarness();
        harness.AddField("name", "Name", new PlainJavaScriptFormField("text"));
        harness.AddField("message", "Message", new PlainJavaScriptFormField("textarea"));
        harness.AddField("next", "Next", new PlainJavaScriptFormField(new { buttonKind = "Next" }, "button"));
        harness.Rows.Add(new PlainJavaScriptLayoutRow { Cells = new[] { new PlainJavaScriptLayoutCell { ColumnSpan = 12 } } });
        harness.Rows.Add(new PlainJavaScriptLayoutRow { IsStep = true, Cells = Array.Empty<PlainJavaScriptLayoutCell>() });

        var actual = harness.Build();

        Assert.Equal(Shape(fixture["data"]!, "fields", "rows"), Shape(actual["data"]!, "fields", "rows"));
        Assert.Equal(Shape(fixture["assets"]!), Shape(actual["assets"]!));
        foreach (var type in new[] { "text", "textarea", "button" })
        {
            var expected = fixture["data"]!["fields"]!.First(x => x["fieldType"]!.Value<string>() == type);
            var found = actual["data"]!["fields"]!.First(x => x["fieldType"]!.Value<string>() == type);
            Assert.Equal(Shape(expected, "validations"), Shape(found, "validations"));
        }

        var fixtureRow = fixture["data"]!["rows"]![0]!;
        var actualRow = actual["data"]!["rows"]![0]!;
        Assert.Equal(Shape(fixtureRow["cells"]![0]!, "fields"), Shape(actualRow["cells"]![0]!, "fields"));
        Assert.Equal(Shape(fixtureRow, "cells"), Shape(actualRow, "cells"));
    }

    /// <summary>The property names and value types of a JSON object, without its values or the named properties.</summary>
    private static string Shape(JToken token, params string[] skip)
    {
        return token switch
        {
            JObject o => "{" + string.Join(",", o.Properties().Where(p => !skip.Contains(p.Name)).OrderBy(p => p.Name).Select(p => p.Name + ":" + Shape(p.Value, skip))) + "}",
            JArray => "array",
            JValue v when v.Type == JTokenType.Null => "null",
            JValue v => v.Type.ToString(),
            _ => token.Type.ToString(),
        };
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
