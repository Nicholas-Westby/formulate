using Formulate.Core.FormFields;
using Formulate.Core.FormFields.Checkbox;
using Formulate.Core.FormFields.Date;
using Formulate.Core.FormFields.ExtendedRadioButtonList;
using Formulate.Core.FormFields.Recaptcha;
using Formulate.Core.FormFields.RichText;
using Formulate.Extensions.PlainJavaScriptTemplate.Core;
using Formulate.Extensions.PlainJavaScriptTemplate.Core.Mapping.FormFields;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Newtonsoft.Json.Linq;
using Umbraco.Cms.Core.Configuration.Models;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Core.Mapping;
using Umbraco.Cms.Core.Media;
using Umbraco.Cms.Core.Models.PublishedContent;
using Umbraco.Cms.Core.PublishedCache;
using Umbraco.Cms.Core.Routing;
using Umbraco.Cms.Core.Services.Navigation;
using Umbraco.Cms.Core.Templates;
using Umbraco.Cms.Core.Web;
using Xunit;

namespace Formulate.Extensions.PlainJavaScriptTemplate.Tests;

/// <summary>
/// The JSON the renderer's field registrations read: "checkbox", "date", "extended-radio-list", "recaptcha" and "rich-text".
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

    /// <summary>
    /// The Rich Text map definition, with Umbraco's own parsers of rich text, in a request that Umbraco handles: the
    /// URL of the content page <see cref="ContactUs"/> is /contact-us/, and the media item <see cref="Logo"/>'s file
    /// is at /media/yptj3z3h/logo.png.
    /// </summary>
    private static RichTextFieldMapDefinition RichText()
    {
        var urls = new Mock<IPublishedUrlProvider>();
        urls.Setup(x => x.GetUrl(ContactUs, It.IsAny<UrlMode>(), It.IsAny<string?>(), It.IsAny<Uri?>())).Returns("/contact-us/");

        return new RichTextFieldMapDefinition(
            new HtmlLocalLinkParser(urls.Object),
            new HtmlImageSourceParser(id => id == Logo ? "/media/yptj3z3h/logo.png" : string.Empty, UnsignedImageUrls()),
            WithUmbracoContext(Mock.Of<IUmbracoContext>()),
            NullLogger<RichTextFieldMapDefinition>.Instance);
    }

    /// <summary>Signs no image's URL: each one comes back as it is.</summary>
    private static IImageUrlTokenGenerator UnsignedImageUrls()
    {
        var tokens = new Mock<IImageUrlTokenGenerator>();
        tokens.Setup(x => x.RefreshSignature(It.IsAny<string>())).Returns<string>(url => url);

        return tokens.Object;
    }

    /// <summary>Gives the Umbraco context of a request that Umbraco handles.</summary>
    private static IUmbracoContextAccessor WithUmbracoContext(IUmbracoContext umbracoContext)
    {
        var accessor = new Mock<IUmbracoContextAccessor>();
        IUmbracoContext? context = umbracoContext;
        accessor.Setup(x => x.TryGetUmbracoContext(out context)).Returns(true);

        return accessor.Object;
    }

    /// <summary>
    /// Umbraco's own URL provider, <see cref="UrlProvider"/>, which Umbraco registers as <see cref="IPublishedUrlProvider"/>.
    /// It looks pages and media up in the Umbraco context that <paramref name="accessor"/> gives.
    /// </summary>
    private static UrlProvider UmbracosUrlProvider(IUmbracoContextAccessor accessor) => new(
        accessor,
        Options.Create(new WebRoutingSettings()),
        new UrlProviderCollection(() => []),
        new MediaUrlProviderCollection(() => []),
        Mock.Of<IVariationContextAccessor>(),
        Mock.Of<IDocumentNavigationQueryService>(),
        Mock.Of<IPublishedContentStatusFilteringService>());

    private static readonly Guid ContactUs = Guid.Parse("5d3a0b0e-6a43-4a4f-9a3c-1f6f7b0f2a03");

    private static readonly Guid Logo = Guid.Parse("51c82d4c-71ce-4bc8-a849-4c6edf056062");

    /// <summary>
    /// As Umbraco's rich text editor writes them: a link to the page <see cref="ContactUs"/>, picked from the content
    /// tree, and an image of <see cref="Logo"/>, picked from the media library, at the address the back office had then.
    /// </summary>
    private const string LinkAndImage =
        "<p><a href=\"/{localLink:5d3a0b0e-6a43-4a4f-9a3c-1f6f7b0f2a03}\" title=\"Contact Us\" type=\"document\">Contact us</a></p>"
        + "<p><img src=\"https://admin.example.com/media/yptj3z3h/logo.png?rmode=max&amp;width=120&amp;height=80\" alt=\"Our logo\" width=\"120\" height=\"80\" data-udi=\"umb://media/51c82d4c71ce4bc8a8494c6edf056062\"></p>";

    private static string? MapRichText(string? text) => MapRichText(RichText(), Mock.Of<IFormFieldSettings>(), text);

    private static string? MapRichText(RichTextFieldMapDefinition definition, IFormFieldSettings settings, string? text) =>
        JObject.FromObject(Map(definition, new RichTextField(settings, new RichTextFieldConfiguration { Text = text! })).Configuration)["text"]!
            .Value<string?>();

    [Fact]
    public void Rich_text_maps_its_text_with_its_content_links_and_media_images_resolved_as_Umbraco_renders_rich_text()
    {
        Assert.Equal(
            "<p><a href=\"/contact-us/\" title=\"Contact Us\">Contact us</a></p>"
                + "<p><img src=\"/media/yptj3z3h/logo.png?rmode=max&amp;width=120&amp;height=80\" alt=\"Our logo\" width=\"120\" height=\"80\" data-udi=\"umb://media/51c82d4c71ce4bc8a8494c6edf056062\"></p>",
            MapRichText(LinkAndImage));
    }

    [Fact]
    public void Rich_text_rendered_with_no_Umbraco_context_maps_its_text_as_stored_and_logs_a_warning_that_names_the_field()
    {
        // With no Umbraco context, as when a form is rendered outside a request that Umbraco handles, Umbraco's own
        // URL provider throws when it is asked for a page's or an image's URL: "Wasn't able to get an UmbracoContext".
        var accessor = new Mock<IUmbracoContextAccessor>();
        IUmbracoContext? none = null;
        accessor.Setup(x => x.TryGetUmbracoContext(out none)).Returns(false);
        var urls = UmbracosUrlProvider(accessor.Object);
        var logger = new Mock<ILogger<RichTextFieldMapDefinition>>();
        var definition = new RichTextFieldMapDefinition(
            new HtmlLocalLinkParser(urls), new HtmlImageSourceParser(urls, UnsignedImageUrls()), accessor.Object, logger.Object);
        var settings = new Mock<IFormFieldSettings>();
        settings.SetupGet(x => x.Name).Returns("Intro");
        string? mapped = null;

        var error = Record.Exception(() => mapped = MapRichText(definition, settings.Object, LinkAndImage));

        Assert.Null(error);
        Assert.Equal(LinkAndImage, mapped);
        logger.Verify(
            x => x.Log(
                LogLevel.Warning,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((state, _) => state != null && state.ToString()!.Contains("Intro")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once());
    }

    [Theory]
    [InlineData("<h2 class=\"intro\">Hello</h2><p>Fill <b>this</b> in. <a href=\"https://example.com/\">More</a> <img src=\"/images/a.png\" alt=\"\"></p>")]
    [InlineData("")]
    [InlineData(null)]
    public void Rich_text_maps_text_with_no_content_links_or_media_images_as_it_is(string? text)
    {
        Assert.Equal(text, MapRichText(text));
    }

    [Fact]
    public void Rich_text_maps_an_image_from_another_site_as_it_is()
    {
        // Only an image picked from the media library has a data-udi, for Umbraco's parser to give it its media's URL.
        const string text = "<p><img src=\"https://example.com/a.png\" alt=\"A\"></p>";

        Assert.Equal(text, MapRichText(text));
    }

    [Fact]
    public void Rich_text_maps_a_link_to_a_page_that_is_not_there_to_what_Umbraco_gives_for_one()
    {
        // Umbraco's own URL provider gives "#" for a page that is not in the content cache, as when the page was
        // unpublished or deleted after the link was picked: UrlProvider.GetUrl returns "#" when it finds no content
        // (read in Umbraco.Core 17.6.0, 18.3.2 and 19.0.0-rc1).
        var missing = Guid.Parse("0c1e2c5a-8d4b-4f5e-9a39-2f2d6e1b7c41");
        var cache = new Mock<IPublishedContentCache>();
        cache.Setup(x => x.GetById(missing)).Returns((IPublishedContent?)null);
        var umbracoContext = new Mock<IUmbracoContext>();
        umbracoContext.SetupGet(x => x.Content).Returns(cache.Object);
        var accessor = WithUmbracoContext(umbracoContext.Object);
        var urls = UmbracosUrlProvider(accessor);
        var definition = new RichTextFieldMapDefinition(
            new HtmlLocalLinkParser(urls), new HtmlImageSourceParser(urls, UnsignedImageUrls()), accessor, NullLogger<RichTextFieldMapDefinition>.Instance);
        const string text = "<p><a href=\"/{localLink:0c1e2c5a-8d4b-4f5e-9a39-2f2d6e1b7c41}\" title=\"Old news\" type=\"document\">Old news</a></p>";

        Assert.Equal("<p><a href=\"#\" title=\"Old news\">Old news</a></p>", MapRichText(definition, Mock.Of<IFormFieldSettings>(), text));
    }

    [Fact]
    public void Rich_text_maps_to_the_rich_text_renderer()
    {
        var mapped = Map(RichText(), new RichTextField(Mock.Of<IFormFieldSettings>(), new RichTextFieldConfiguration { Text = "<p>Hi</p>" }));

        Assert.Equal("rich-text", mapped.FieldType);
        Assert.Equal(new[] { "text" }, JObject.FromObject(mapped.Configuration).Properties().Select(x => x.Name).ToArray());
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
