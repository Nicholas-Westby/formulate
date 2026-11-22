using Formulate.Core.Templates;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Core.Mapping;

namespace Formulate.Extensions.PlainJavaScriptTemplate.Tests;

/// <summary>
/// Runs the template's composer (<see cref="PlainJavaScriptComposer"/>) on a service collection, as Umbraco does
/// when a site starts.
/// </summary>
internal static class ComposerHarness
{
    public static void Compose(IServiceCollection services)
    {
        var builder = new Mock<IUmbracoBuilder>();
        builder.SetupGet(x => x.Services).Returns(services);
        builder.Setup(x => x.WithCollectionBuilder<MapDefinitionCollectionBuilder>()).Returns(new MapDefinitionCollectionBuilder());
        builder.Setup(x => x.WithCollectionBuilder<TemplateDefinitionCollectionBuilder>()).Returns(new TemplateDefinitionCollectionBuilder());

        new PlainJavaScriptComposer().Compose(builder.Object);
    }
}
