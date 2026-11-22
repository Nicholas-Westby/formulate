namespace Formulate.Extensions.PlainJavaScriptTemplate
{
    using Formulate.Core.DependencyInjection;
    using Formulate.Extensions.PlainJavaScriptTemplate.Core;
    using Microsoft.Extensions.DependencyInjection;
    using Microsoft.Extensions.Options;
    using Umbraco.Cms.Core.Composing;
    using Umbraco.Cms.Core.DependencyInjection;

    public sealed class PlainJavaScriptComposer : IComposer
    {
        public void Compose(IUmbracoBuilder builder)
        {
            builder.AddMapDefinitions();

            builder.TemplateDefinitions().Append<PlainJavaScriptTemplateDefinition>();
            builder.Services.AddOptions<PlainJavaScriptOptions>().BindConfiguration(PlainJavaScriptOptions.SectionName);
            builder.Services.AddSingleton<IPlainJavaScriptAssets, PlainJavaScriptAssets>();
            builder.Services.AddSingleton<IBuildPlainJavaScriptJson, BuildPlainJavaScriptJson>();
        }
    }
}
