using Formulate.Core.Layouts;
using Formulate.Core.RenderModels;
using Formulate.Core.Utilities.Internal;
using Formulate.Extensions.PlainJavaScriptTemplate.Core;
using Formulate.Web.RenderModels;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http;
using Moq;
using Newtonsoft.Json.Linq;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Mapping;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Models.PublishedContent;
using Umbraco.Cms.Core.Routing;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Core.Web;
using Xunit;

namespace Formulate.Extensions.PlainJavaScriptTemplate.Tests;

public sealed class BuildPlainJavaScriptJsonTests
{
    [Fact]
    public void Page_id_is_looked_up_from_the_page_key()
    {
        var pageKey = Guid.NewGuid();
        var idKeyMap = new Mock<IIdKeyMap>();
        idKeyMap.Setup(x => x.GetIdForKey(pageKey, UmbracoObjectTypes.Document)).Returns(Attempt.Succeed(1234));

        var payload = BuildPayload(pageKey, idKeyMap.Object);

        Assert.Equal(1234, payload["PageId"]!.Value<int>());
    }

    [Fact]
    public void Page_id_is_null_when_the_page_key_has_no_id()
    {
        var idKeyMap = new Mock<IIdKeyMap>();
        idKeyMap.Setup(x => x.GetIdForKey(It.IsAny<Guid>(), It.IsAny<UmbracoObjectTypes>())).Returns(Attempt<int>.Fail());

        var payload = BuildPayload(Guid.NewGuid(), idKeyMap.Object);

        Assert.Equal(JTokenType.Null, payload["PageId"]!.Type);
    }

    /// <summary>
    /// Renders a form on a page with the given key and returns the payload the browser posts back.
    /// </summary>
    private static JObject BuildPayload(Guid pageKey, IIdKeyMap idKeyMap)
    {
        // The page's Id is a different number, so reading it instead of looking up the key fails the test.
        // Umbraco 18 moved Id off IPublishedContent, so code compiled against 17 cannot call it there.
        var page = new Mock<IPublishedContent>();
        page.SetupGet(x => x.Key).Returns(pageKey);
        page.SetupGet(x => x.Id).Returns(999);
        var request = Mock.Of<IPublishedRequest>(x => x.PublishedContent == page.Object);
        var umbracoContext = Mock.Of<IUmbracoContext>(x => x.PublishedRequest == request);
        var umbracoContextAccessor = new Mock<IUmbracoContextAccessor>();
        umbracoContextAccessor.Setup(x => x.TryGetUmbracoContext(out umbracoContext)).Returns(true);

        var antiforgery = new Mock<IAntiforgery>();
        antiforgery.Setup(x => x.GetAndStoreTokens(It.IsAny<HttpContext>()))
            .Returns(new AntiforgeryTokenSet("request-token", "cookie-token", "__RequestVerificationToken", null));

        var mapper = new Mock<IUmbracoMapper>();
        mapper.Setup(x => x.Map<PlainJavaScriptLayout>(It.IsAny<object>())).Returns(new PlainJavaScriptLayout());

        var builder = new BuildPlainJavaScriptJson(
            new JsonUtility(new NewtonsoftJsonSerializer()),
            umbracoContextAccessor.Object,
            new HttpContextAccessor { HttpContext = new DefaultHttpContext() },
            antiforgery.Object,
            mapper.Object,
            idKeyMap);
        var renderModel = new FormLayoutRenderModel(
            new FormRenderModel(Guid.NewGuid(), "Contact", "contact"),
            Mock.Of<ILayout>());

        var json = JObject.Parse(builder.Build(renderModel, "container"));

        return (JObject)json["data"]!["payload"]!;
    }
}
