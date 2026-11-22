namespace Formulate.Extensions.PlainJavaScriptTemplate
{
    using Formulate.Core.DependencyInjection;
    using Formulate.Extensions.PlainJavaScriptTemplate.Core;
    using Microsoft.Extensions.DependencyInjection;
    using Microsoft.Extensions.Options;
    using Umbraco.Cms.Core.Composing;
    using Umbraco.Cms.Core.DependencyInjection;
    using Umbraco.Cms.Web.Common.ApplicationBuilder;

    public sealed class PlainJavaScriptComposer : IComposer
    {
        public void Compose(IUmbracoBuilder builder)
        {
            builder.AddMapDefinitions();

            builder.TemplateDefinitions().Append<PlainJavaScriptTemplateDefinition>();
            builder.Services.AddOptions<PlainJavaScriptOptions>().BindConfiguration(PlainJavaScriptOptions.SectionName);
            builder.Services.AddSingleton<IPlainJavaScriptAssets, PlainJavaScriptAssets>();
            builder.Services.AddSingleton<IBuildPlainJavaScriptJson, BuildPlainJavaScriptJson>();

            // The renderer's files are sent with Cache-Control: no-cache, as their URLs never change.
            builder.Services.Configure<UmbracoPipelineOptions>(PlainJavaScriptCaching.AddPipelineFilter);
        }
    }
}
