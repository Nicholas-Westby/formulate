using Formulate.Core.FormFields;
using Formulate.Core.FormFields.Checkbox;
using Formulate.Core.FormFields.Date;
using Formulate.Core.FormFields.ExtendedRadioButtonList;
using Formulate.Core.FormFields.Recaptcha;
using Formulate.Extensions.PlainJavaScriptTemplate.Core;
using Formulate.Extensions.PlainJavaScriptTemplate.Core.Mapping.FormFields;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Newtonsoft.Json.Linq;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Core.Mapping;
using Xunit;

namespace Formulate.Extensions.PlainJavaScriptTemplate.Tests;

/// <summary>
/// The JSON the renderer's field registrations read: "checkbox", "date", "extended-radio-list" and "recaptcha".
/// </summary>
public sealed class FieldMapDefinitionTests
{
    private static PlainJavaScriptFormField Map<TField>(IMapDefinition definition, TField field) where TField : IFormField
    {
        Func<TField, MapperContext, PlainJavaScriptFormField>? map = null;
        var mapper = new Mock<IUmbracoMapper>();
        mapper.Setup(x => x.Define(It.IsAny<Func<TField, MapperContext, PlainJavaScriptFormField>>()))
            .Callback<Func<TField, MapperContext, PlainJavaScriptFormField>>(x => map = x);

        definition.DefineMaps(mapper.Object);

        Assert.NotNull(map);
        return map(field, null!);
    }

    [Fact]
    public void Checkbox_maps_to_the_checkbox_renderer_with_no_configuration()
    {
        var field = new CheckboxField(Mock.Of<IFormFieldSettings>());

        var mapped = Map(new CheckboxFieldMapDefinition(), field);

        Assert.Equal("checkbox", mapped.FieldType);
        Assert.Empty(JObject.FromObject(mapped.Configuration).Properties());
    }

    [Fact]
    public void Date_maps_to_the_date_renderer_with_no_configuration()
    {
        var field = new DateField(Mock.Of<IFormFieldSettings>());

        var mapped = Map(new DateFieldMapDefinition(), field);

        Assert.Equal("date", mapped.FieldType);
        Assert.Empty(JObject.FromObject(mapped.Configuration).Properties());
    }

    [Fact]
    public void Extended_radio_maps_items_with_value_label_and_description_and_the_orientation()
    {
        var field = new ExtendedRadioButtonListField(Mock.Of<IFormFieldSettings>(), new ExtendedRadioButtonListFieldConfiguration
        {
            Orientation = "horizontal",
            Items = new[]
            {
                new ExtendedRadioButtonListFieldItem { Value = "Basic", Label = "Basic", Description = "Cheapest" },
                new ExtendedRadioButtonListFieldItem { Value = "Pro", Label = "Pro", Description = string.Empty },
            }
        });

        var mapped = Map(new ExtendedRadioButtonListFieldMapDefinition(NullLogger<ExtendedRadioButtonListFieldMapDefinition>.Instance), field);

        Assert.Equal("extended-radio-list", mapped.FieldType);
        var json = JObject.FromObject(mapped.Configuration);
        Assert.Equal("horizontal", json["orientation"]!.Value<string>());
        var items = (JArray)json["items"]!;
        Assert.Equal(2, items.Count);
        Assert.Equal(new[] { "description", "label", "value" }, ((JObject)items[0]).Properties().Select(x => x.Name).Order().ToArray());
        Assert.Equal("Basic", items[0]["value"]!.Value<string>());
        Assert.Equal("Basic", items[0]["label"]!.Value<string>());
        Assert.Equal("Cheapest", items[0]["description"]!.Value<string>());
        Assert.Equal(string.Empty, items[1]["description"]!.Value<string>());
    }

    private static void VerifyWarnings<T>(Mock<ILogger<T>> logger, Times times)
    {
        logger.Verify(
            x => x.Log(LogLevel.Warning, It.IsAny<EventId>(), It.IsAny<It.IsAnyType>(), null, It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            times);
    }

    private static RecaptchaField Recaptcha(string? siteKey) => new(
        Mock.Of<IFormFieldSettings>(), new RecaptchaFieldConfiguration { SiteKey = siteKey }, "the-secret", Mock.Of<IRecaptchaVerifier>(), NullLogger.Instance);

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    public void Recaptcha_without_a_site_key_logs_one_warning_when_it_is_rendered(string? siteKey)
    {
        var logger = new Mock<ILogger<RecaptchaFieldMapDefinition>>();

        Map(new RecaptchaFieldMapDefinition(logger.Object), Recaptcha(siteKey));

        VerifyWarnings(logger, Times.Once());
    }

    [Fact]
    public void Recaptcha_with_a_site_key_logs_nothing_when_it_is_rendered()
    {
        var logger = new Mock<ILogger<RecaptchaFieldMapDefinition>>();

        Map(new RecaptchaFieldMapDefinition(logger.Object), Recaptcha("the-site-key"));

        VerifyWarnings(logger, Times.Never());
    }

    [Fact]
    public void Extended_radio_with_no_data_value_logs_one_warning_when_it_is_rendered()
    {
        var logger = new Mock<ILogger<ExtendedRadioButtonListFieldMapDefinition>>();
        var settings = new Mock<IFormFieldSettings>();
        settings.SetupGet(x => x.Name).Returns("Plan");
        var field = new ExtendedRadioButtonListField(settings.Object, new ExtendedRadioButtonListFieldConfiguration { Items = Array.Empty<ExtendedRadioButtonListFieldItem>(), HasDataValue = false });

        Map(new ExtendedRadioButtonListFieldMapDefinition(logger.Object), field);

        VerifyWarnings(logger, Times.Once());
    }

    [Fact]
    public void Extended_radio_with_a_data_value_logs_nothing_when_it_is_rendered()
    {
        var logger = new Mock<ILogger<ExtendedRadioButtonListFieldMapDefinition>>();
        var field = new ExtendedRadioButtonListField(Mock.Of<IFormFieldSettings>(), new ExtendedRadioButtonListFieldConfiguration { Items = Array.Empty<ExtendedRadioButtonListFieldItem>(), HasDataValue = true });

        Map(new ExtendedRadioButtonListFieldMapDefinition(logger.Object), field);

        VerifyWarnings(logger, Times.Never());
    }

    [Fact]
    public void Recaptcha_maps_the_site_key()
    {
        var field = new RecaptchaField(
            Mock.Of<IFormFieldSettings>(),
            new RecaptchaFieldConfiguration { SiteKey = "the-site-key" },
            string.Empty,
            Mock.Of<IRecaptchaVerifier>(),
            NullLogger.Instance);

        var mapped = Map(new RecaptchaFieldMapDefinition(NullLogger<RecaptchaFieldMapDefinition>.Instance), field);

        Assert.Equal("recaptcha", mapped.FieldType);
        Assert.Equal("the-site-key", JObject.FromObject(mapped.Configuration)["siteKey"]!.Value<string>());
    }

    [Fact]
    public void Recaptcha_without_a_site_key_maps_an_empty_one_and_never_the_secret()
    {
        var field = new RecaptchaField(
            Mock.Of<IFormFieldSettings>(),
            new RecaptchaFieldConfiguration { SiteKey = null },
            "the-secret",
            Mock.Of<IRecaptchaVerifier>(),
            NullLogger.Instance);

        var json = JObject.FromObject(Map(new RecaptchaFieldMapDefinition(NullLogger<RecaptchaFieldMapDefinition>.Instance), field).Configuration);

        Assert.Equal(string.Empty, json["siteKey"]!.Value<string>());
        Assert.DoesNotContain("the-secret", json.ToString());
        Assert.Single(json.Properties());
    }

    [Fact]
    public void The_new_map_definitions_are_registered()
    {
        var collection = new MapDefinitionCollectionBuilder();
        var builder = new Mock<IUmbracoBuilder>();
        builder.Setup(x => x.WithCollectionBuilder<MapDefinitionCollectionBuilder>()).Returns(collection);

        builder.Object.AddMapDefinitions();

        Assert.True(collection.Has<CheckboxFieldMapDefinition>());
        Assert.True(collection.Has<DateFieldMapDefinition>());
        Assert.True(collection.Has<ExtendedRadioButtonListFieldMapDefinition>());
        Assert.True(collection.Has<RecaptchaFieldMapDefinition>());
    }

    [Fact]
    public void The_json_a_form_gets_carries_each_kinds_field_type()
    {
        var harness = new FormJsonHarness();
        harness.AddField("agree", "Agree", Map(new CheckboxFieldMapDefinition(), new CheckboxField(Mock.Of<IFormFieldSettings>())));
        harness.AddField("when", "When", Map(new DateFieldMapDefinition(), new DateField(Mock.Of<IFormFieldSettings>())));
        harness.AddField("robot", "Robot", Map(new RecaptchaFieldMapDefinition(NullLogger<RecaptchaFieldMapDefinition>.Instance), new RecaptchaField(
            Mock.Of<IFormFieldSettings>(), new RecaptchaFieldConfiguration { SiteKey = "k" }, "s", Mock.Of<IRecaptchaVerifier>(),
            NullLogger.Instance)));

        var fields = harness.Build()["data"]!["fields"]!;

        Assert.Equal(new[] { "checkbox", "date", "recaptcha" }, fields.Select(x => x["fieldType"]!.Value<string>()).ToArray());
        Assert.Equal("k", fields[2]!["configuration"]!["siteKey"]!.Value<string>());

        // A date or a checkbox can be pre-filled from the query string, like the other inputs.
        var prefilled = new FormJsonHarness { QueryString = "?when=2026-11-05&agree=true" };
        prefilled.AddField("when", "When", new PlainJavaScriptFormField("date"));
        prefilled.AddField("agree", "Agree", new PlainJavaScriptFormField("checkbox"));
        var values = prefilled.Build()["data"]!["fields"]!;
        Assert.Equal("2026-11-05", values[0]!["initialValue"]!.Value<string>());
        Assert.Equal("true", values[1]!["initialValue"]!.Value<string>());
    }
}
