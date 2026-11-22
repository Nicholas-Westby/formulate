using Formulate.Extensions.PlainJavaScriptTemplate.Core;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;

namespace Formulate.Extensions.PlainJavaScriptTemplate.Tests;

/// <summary>
/// Creates the assets service, with a web root that holds the list of modules (modules.json) the renderer's build
/// writes.
/// </summary>
internal static class AssetsHarness
{
    /// <summary>Where the build writes the list, in the web root.</summary>
    public const string ModuleListPath = "App_Plugins/Formulate/PlainJavaScript/modules.json";

    /// <summary>A web root with a short list of modules: the entry first, as the build writes it.</summary>
    public static InMemoryFileProvider WebRootWithModules() => new InMemoryFileProvider()
        .Add(ModuleListPath, """["formulate.min.js", "api.min.js", "fields/plain-text.min.js"]""");

    public static PlainJavaScriptAssets Create(
        PlainJavaScriptOptions options,
        ILogger<PlainJavaScriptAssets>? logger = null,
        IFileProvider? webRoot = null)
    {
        return new PlainJavaScriptAssets(
            Options.Create(options),
            Mock.Of<IWebHostEnvironment>(x => x.WebRootFileProvider == (webRoot ?? WebRootWithModules())),
            logger ?? Mock.Of<ILogger<PlainJavaScriptAssets>>());
    }
}
