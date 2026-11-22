using Formulate.Core.FormFields;
using Formulate.Core.Layouts;
using Formulate.Core.RenderModels;
using Formulate.Core.Utilities.Internal;
using Formulate.Extensions.PlainJavaScriptTemplate.Core;
using Formulate.Web.RenderModels;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.ViewFeatures;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Newtonsoft.Json.Linq;
using Umbraco.Cms.Core.Mapping;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Models.PublishedContent;
using Umbraco.Cms.Core.Routing;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Core.Web;

namespace Formulate.Extensions.PlainJavaScriptTemplate.Tests;

/// <summary>
/// Builds the form JSON for a form with the given fields and layout rows, on a request with the
/// given query string and path base.
/// </summary>
internal sealed class FormJsonHarness
{
    private readonly List<(IFormField Field, PlainJavaScriptFormField Mapped)> _fields = new();

    public List<PlainJavaScriptLayoutRow> Rows { get; } = new();

    public string QueryString { get; set; } = string.Empty;

    public string PathBase { get; set; } = string.Empty;

    public string Theme { get; set; } = "none";

    public bool IncludeScript { get; set; } = true;

    /// <summary>The logger the assets service writes to.</summary>
    public Mock<ILogger<PlainJavaScriptAssets>> Logger { get; } = new();

    /// <summary>Replaces the file version provider (by default it appends ?v=hash).</summary>
    public IFileVersionProvider FileVersionProvider { get; set; } = new HashingFileVersionProvider();

    public Guid FormId { get; } = Guid.NewGuid();

    public IFormField AddField(string alias, string label, PlainJavaScriptFormField mapped)
    {
        var field = new Mock<IFormField>();
        field.SetupGet(x => x.Id).Returns(Guid.NewGuid());
        field.SetupGet(x => x.Alias).Returns(alias);
        field.SetupGet(x => x.Name).Returns(alias);
        field.SetupGet(x => x.Label).Returns(label);
        field.SetupGet(x => x.Category).Returns((string)null!);
        field.SetupGet(x => x.Validations).Returns(Array.Empty<Formulate.Core.Validations.IValidation>());
        _fields.Add((field.Object, mapped));
        return field.Object;
    }

    public JObject Build(string formName = "Contact") => JObject.Parse(BuildRaw(formName));

    /// <summary>Gets the JSON text exactly as the view writes it into the page.</summary>
    public string BuildRaw(string formName = "Contact")
    {
        var pageMock = new Mock<IPublishedContent>();
        pageMock.SetupGet(x => x.Key).Returns(Guid.NewGuid());
        var request = Mock.Of<IPublishedRequest>(x => x.PublishedContent == pageMock.Object);
        var umbracoContext = Mock.Of<IUmbracoContext>(x => x.PublishedRequest == request);
        var umbracoContextAccessor = new Mock<IUmbracoContextAccessor>();
        umbracoContextAccessor.Setup(x => x.TryGetUmbracoContext(out umbracoContext)).Returns(true);

        var antiforgery = new Mock<IAntiforgery>();
        antiforgery.Setup(x => x.GetAndStoreTokens(It.IsAny<HttpContext>()))
            .Returns(new AntiforgeryTokenSet("request-token", "cookie-token", "__RequestVerificationToken", null));

        var mapper = new Mock<IUmbracoMapper>();
        mapper.Setup(x => x.Map<PlainJavaScriptLayout>(It.IsAny<object>()))
            .Returns(new PlainJavaScriptLayout { Rows = Rows.ToArray() });
        foreach (var (field, mapped) in _fields)
        {
            mapper.Setup(x => x.Map<PlainJavaScriptFormField>(It.Is<object>(o => ReferenceEquals(o, field)))).Returns(mapped);
        }

        var idKeyMap = new Mock<IIdKeyMap>();
        idKeyMap.Setup(x => x.GetIdForKey(It.IsAny<Guid>(), It.IsAny<UmbracoObjectTypes>())).Returns(Umbraco.Cms.Core.Attempt.Succeed(1));

        var httpContext = new DefaultHttpContext();
        httpContext.Request.QueryString = new QueryString(QueryString);
        httpContext.Request.PathBase = new PathString(PathBase);

        var assets = new PlainJavaScriptAssets(
            Options.Create(new PlainJavaScriptOptions { Theme = Theme, IncludeScript = IncludeScript }),
            FileVersionProvider,
            Logger.Object);
        var builder = CreateBuilder(umbracoContextAccessor.Object, httpContext, antiforgery.Object, mapper.Object, idKeyMap.Object, assets);

        var features = Mock.Of<IFormFieldFeatures>();
        var renderModel = new FormLayoutRenderModel(
            new FormRenderModel(FormId, formName, "contact")
            {
                Fields = _fields.Select(x => new FormFieldRenderModel(features, x.Field)).ToArray()
            },
            Mock.Of<ILayout>());

        return builder.Build(renderModel, "container");
    }

    private static BuildPlainJavaScriptJson CreateBuilder(IUmbracoContextAccessor umbracoContextAccessor, HttpContext httpContext, IAntiforgery antiforgery, IUmbracoMapper mapper, IIdKeyMap idKeyMap, IPlainJavaScriptAssets assets)
    {
        return new BuildPlainJavaScriptJson(
            new JsonUtility(new NewtonsoftJsonSerializer()),
            umbracoContextAccessor,
            new HttpContextAccessor { HttpContext = httpContext },
            antiforgery,
            mapper,
            idKeyMap,
            assets);
    }
}

/// <summary>A file version provider that always finds the file: it appends a fixed hash, like asp-append-version does.</summary>
internal sealed class HashingFileVersionProvider : IFileVersionProvider
{
    public string AddFileVersionToPath(PathString requestPathBase, string path) => path + "?v=HASH";
}

/// <summary>A file version provider that cannot find the file, so it returns the path as given.</summary>
internal sealed class MissingFileVersionProvider : IFileVersionProvider
{
    public string AddFileVersionToPath(PathString requestPathBase, string path) => path;
}
