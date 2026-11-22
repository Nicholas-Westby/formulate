using System.Net;
using Formulate.Extensions.PlainJavaScriptTemplate.Core;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Umbraco.Cms.Web.Common.ApplicationBuilder;
using Xunit;

namespace Formulate.Extensions.PlainJavaScriptTemplate.Tests;

/// <summary>
/// The renderer's files keep their URLs from one version to the next, so they are sent with Cache-Control: no-cache:
/// a browser checks with the server before it uses its copy, and gets a quick 304 when the file has not changed.
/// The header comes from the pipeline filter that the template's composer adds, which runs before Umbraco's own
/// middleware (and so before the static files middleware).
/// </summary>
public sealed class PlainJavaScriptCachingTests
{
    private const string Folder = "App_Plugins/Formulate/PlainJavaScript";

    private static readonly InMemoryFileProvider WebRoot = new InMemoryFileProvider()
        .Add($"{Folder}/formulate.min.js", "export {};")
        .Add($"{Folder}/fields/plain-text.min.js", "export {};")
        .Add($"{Folder}/themes/basic.min.css", "body {}")
        .Add("App_Plugins/Formulate/formulate.js", "export {};")
        .Add("App_Plugins/Formulate/PlainJavaScriptExtra/site.js", "export {};")
        .Add("css/site.css", "body {}");

    [Theory]
    [InlineData("", "/App_Plugins/Formulate/PlainJavaScript/formulate.min.js")]
    [InlineData("", "/App_Plugins/Formulate/PlainJavaScript/fields/plain-text.min.js")]
    [InlineData("", "/App_Plugins/Formulate/PlainJavaScript/themes/basic.min.css")]
    [InlineData("", "/app_plugins/formulate/plainjavascript/formulate.min.js")]
    [InlineData("/site", "/site/App_Plugins/Formulate/PlainJavaScript/formulate.min.js")]
    public async Task Renderer_files_are_sent_with_no_cache(string pathBase, string url)
    {
        using var response = await GetAsync(pathBase, url);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("no-cache", response.Headers.CacheControl?.ToString());
        // The browser checks its copy with these.
        Assert.NotNull(response.Headers.ETag);
        Assert.NotNull(response.Content.Headers.LastModified);
    }

    [Fact]
    public async Task A_check_for_a_file_that_has_not_changed_gets_a_304_with_no_cache()
    {
        const string url = "/App_Plugins/Formulate/PlainJavaScript/formulate.min.js";
        using var first = await GetAsync(string.Empty, url);

        using var check = await GetAsync(string.Empty, url, request => request.Headers.IfNoneMatch.Add(first.Headers.ETag!));

        Assert.Equal(HttpStatusCode.NotModified, check.StatusCode);
        Assert.Equal("no-cache", check.Headers.CacheControl?.ToString());
    }

    [Theory]
    [InlineData("/App_Plugins/Formulate/formulate.js")]
    [InlineData("/App_Plugins/Formulate/PlainJavaScriptExtra/site.js")]
    [InlineData("/css/site.css")]
    public async Task Other_files_are_left_alone(string url)
    {
        using var response = await GetAsync(string.Empty, url);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Null(response.Headers.CacheControl);
    }

    // A site that gives its static files a long lifetime would otherwise keep visitors on an old renderer.
    [Fact]
    public async Task No_cache_replaces_a_header_the_site_sets_on_static_files()
    {
        using var renderer = await GetAsync(string.Empty, "/App_Plugins/Formulate/PlainJavaScript/formulate.min.js", siteCacheControl: "public, max-age=31536000");
        using var other = await GetAsync(string.Empty, "/css/site.css", siteCacheControl: "public, max-age=31536000");

        Assert.Equal("no-cache", renderer.Headers.CacheControl?.ToString());
        Assert.Equal("public, max-age=31536000", other.Headers.CacheControl?.ToString());
    }

    /// <summary>
    /// Requests a URL from a site that runs the template's composer, applies the pipeline filters it added before
    /// Umbraco's middleware, as Umbraco does, then serves static files.
    /// </summary>
    private static async Task<HttpResponseMessage> GetAsync(
        string pathBase,
        string url,
        Action<HttpRequestMessage>? configureRequest = null,
        string? siteCacheControl = null)
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Logging.ClearProviders();
        ComposerHarness.Compose(builder.Services);

        await using var app = builder.Build();
        if (pathBase.Length > 0)
        {
            app.UsePathBase(pathBase);
        }

        foreach (var filter in app.Services.GetRequiredService<IOptions<UmbracoPipelineOptions>>().Value.PipelineFilters)
        {
            filter.OnPrePipeline(app);
        }

        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = WebRoot,
            OnPrepareResponse = context =>
            {
                if (siteCacheControl is not null)
                {
                    context.Context.Response.Headers.CacheControl = siteCacheControl;
                }
            },
        });
        await app.StartAsync();

        using var client = app.GetTestClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        configureRequest?.Invoke(request);
        var response = await client.SendAsync(request);
        await response.Content.LoadIntoBufferAsync();
        return response;
    }
}
