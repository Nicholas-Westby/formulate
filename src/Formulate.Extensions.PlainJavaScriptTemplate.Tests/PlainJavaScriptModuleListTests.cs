using Formulate.Extensions.PlainJavaScriptTemplate.Core;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace Formulate.Extensions.PlainJavaScriptTemplate.Tests;

/// <summary>
/// The renderer's build writes the list of its minified modules to modules.json, the entry first. The assets
/// service reads it from the web root (where the site serves the renderer's files from, whether it runs from
/// source, from the packages or published), so pages can preload every module.
/// </summary>
public sealed class PlainJavaScriptModuleListTests
{
    private const string Folder = "/App_Plugins/Formulate/PlainJavaScript";

    [Fact]
    public void Module_urls_come_from_the_list_the_build_writes_in_its_order_under_the_path_base()
    {
        var assets = AssetsHarness.Create(new PlainJavaScriptOptions());

        Assert.Equal(
            new[] { $"{Folder}/formulate.min.js", $"{Folder}/api.min.js", $"{Folder}/fields/plain-text.min.js" },
            assets.GetModuleUrls(PathString.Empty));
        Assert.Equal(
            new[] { $"/site{Folder}/formulate.min.js", $"/site{Folder}/api.min.js", $"/site{Folder}/fields/plain-text.min.js" },
            assets.GetModuleUrls(new PathString("/site")));
    }

    [Fact]
    public void A_missing_list_means_no_preloads_and_one_warning()
    {
        var logger = new Mock<ILogger<PlainJavaScriptAssets>>();
        var assets = AssetsHarness.Create(new PlainJavaScriptOptions(), logger.Object, new InMemoryFileProvider());

        Assert.Empty(assets.GetModuleUrls(PathString.Empty));
        Assert.Empty(assets.GetModuleUrls(new PathString("/site")));
        Assert.Empty(assets.TakePageAssets(new DefaultHttpContext()).ModuleUrls);
        VerifyWarnings(logger, Times.Once());
    }

    [Theory]
    [InlineData("not JSON")]
    [InlineData("""{ "modules": [] }""")]
    public void A_list_that_cannot_be_read_means_no_preloads_and_one_warning(string content)
    {
        var logger = new Mock<ILogger<PlainJavaScriptAssets>>();
        var webRoot = new InMemoryFileProvider().Add(AssetsHarness.ModuleListPath, content);
        var assets = AssetsHarness.Create(new PlainJavaScriptOptions(), logger.Object, webRoot);

        Assert.Empty(assets.GetModuleUrls(PathString.Empty));
        Assert.Empty(assets.GetModuleUrls(PathString.Empty));
        VerifyWarnings(logger, Times.Once());
    }

    // Whatever goes wrong while the list is read (here a file the site may not read, and a web root that fails),
    // pages get the script with no preloads, and the problem is logged once with its exception.
    [Fact]
    public void A_list_that_throws_while_it_is_read_means_no_preloads_and_one_warning()
    {
        var unreadableFile = new Mock<IFileInfo>();
        unreadableFile.Setup(x => x.Exists).Returns(true);
        unreadableFile.Setup(x => x.CreateReadStream()).Throws(new UnauthorizedAccessException("Access to the path is denied."));
        var unreadable = new Mock<IFileProvider>();
        unreadable.Setup(x => x.GetFileInfo(It.IsAny<string>())).Returns(unreadableFile.Object);
        var failing = new Mock<IFileProvider>();
        failing.Setup(x => x.GetFileInfo(It.IsAny<string>())).Throws(new NotSupportedException("The web root failed."));

        foreach (var (webRoot, exceptionType) in new[] { (unreadable.Object, typeof(UnauthorizedAccessException)), (failing.Object, typeof(NotSupportedException)) })
        {
            var logger = new Mock<ILogger<PlainJavaScriptAssets>>();
            var assets = AssetsHarness.Create(new PlainJavaScriptOptions(), logger.Object, webRoot);

            Assert.Empty(assets.GetModuleUrls(PathString.Empty));
            Assert.Empty(assets.GetModuleUrls(new PathString("/site")));
            var page = assets.TakePageAssets(new DefaultHttpContext());
            Assert.Equal($"{Folder}/formulate.min.js", page.ScriptUrl);
            Assert.Empty(page.ModuleUrls);
            VerifyWarnings(logger, Times.Once());
            logger.Verify(
                x => x.Log(LogLevel.Warning, It.IsAny<EventId>(), It.IsAny<It.IsAnyType>(), It.Is<Exception?>(e => e != null && e.GetType() == exceptionType), It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
                Times.Once());
        }
    }

    // The list only names files in the renderer's folder, so it can never point a page at another script.
    [Fact]
    public void Entries_that_are_not_minified_modules_in_the_folder_are_left_out_with_one_warning()
    {
        var logger = new Mock<ILogger<PlainJavaScriptAssets>>();
        var webRoot = new InMemoryFileProvider().Add(AssetsHarness.ModuleListPath, """
            ["formulate.min.js", "../site.min.js", "fields/../../x.min.js", "/root.min.js", "https://example.com/x.min.js",
             "//example.com/x.min.js", "fields\\plain-text.min.js", "fields/plain-text.js", "", 5, null, "utils/field.min.js"]
            """);
        var assets = AssetsHarness.Create(new PlainJavaScriptOptions(), logger.Object, webRoot);

        Assert.Equal(new[] { $"{Folder}/formulate.min.js", $"{Folder}/utils/field.min.js" }, assets.GetModuleUrls(PathString.Empty));
        Assert.Equal(new[] { $"{Folder}/formulate.min.js", $"{Folder}/utils/field.min.js" }, assets.GetModuleUrls(PathString.Empty));
        VerifyWarnings(logger, Times.Once());
    }

    [Fact]
    public void Page_assets_have_the_module_urls_when_the_view_adds_the_script()
    {
        var assets = AssetsHarness.Create(new PlainJavaScriptOptions());
        var context = new DefaultHttpContext();
        context.Request.PathBase = new PathString("/site");

        var page = assets.TakePageAssets(context);

        Assert.Equal(assets.GetModuleUrls(new PathString("/site")), page.ModuleUrls);
        Assert.Equal($"/site{Folder}/formulate.min.js", page.ScriptUrl);
        Assert.Empty(assets.TakePageAssets(context).ModuleUrls);
    }

    // A site that loads the script itself writes the preload links from GetModuleUrls.
    [Fact]
    public void Page_assets_have_no_module_urls_when_the_script_is_turned_off_but_the_service_still_lists_them()
    {
        var assets = AssetsHarness.Create(new PlainJavaScriptOptions { IncludeScript = false });

        var page = assets.TakePageAssets(new DefaultHttpContext());

        Assert.Null(page.ScriptUrl);
        Assert.Empty(page.ModuleUrls);
        Assert.Equal(3, assets.GetModuleUrls(PathString.Empty).Count);
    }

    // The list the renderer's build wrote (the test project builds the template, and with it the renderer), read
    // from the template's own web root: it names every minified module the build wrote, the entry first.
    [Fact]
    public void The_built_list_names_every_minified_module_the_build_wrote()
    {
        var webRoot = FindTemplateWebRoot();
        var assets = AssetsHarness.Create(new PlainJavaScriptOptions(), webRoot: new PhysicalFileProvider(webRoot));
        var folder = Path.Combine(webRoot, "App_Plugins", "Formulate", "PlainJavaScript");
        var built = Directory.GetFiles(folder, "*.min.js", SearchOption.AllDirectories)
            .Select(x => Folder + "/" + Path.GetRelativePath(folder, x).Replace('\\', '/'));

        var urls = assets.GetModuleUrls(PathString.Empty);

        Assert.Equal($"{Folder}/formulate.min.js", urls[0]);
        Assert.Contains($"{Folder}/api.min.js", urls);
        AssertListNamesTheBuiltFiles(built, urls);
    }

    // When the folder has a minified file the list leaves out (such as one an older build left) or lacks one the
    // list names, the test above fails and says what to do.
    [Fact]
    public void A_folder_that_differs_from_the_list_fails_saying_what_to_do()
    {
        var listed = new[] { $"{Folder}/formulate.min.js", $"{Folder}/api.min.js" };

        var extra = Assert.ThrowsAny<Exception>(() => AssertListNamesTheBuiltFiles([.. listed, $"{Folder}/old.min.js"], listed));
        var missing = Assert.ThrowsAny<Exception>(() => AssertListNamesTheBuiltFiles([listed[0]], listed));

        Assert.Contains($"{Folder}/old.min.js", extra.Message);
        Assert.Contains("npm run build", extra.Message);
        Assert.Contains($"{Folder}/api.min.js", missing.Message);
        Assert.Contains("npm run build", missing.Message);
    }

    [Fact]
    public void The_composer_registers_the_assets_service_with_the_web_root()
    {
        var services = new ServiceCollection();
        ComposerHarness.Compose(services);
        services.AddSingleton(Mock.Of<IWebHostEnvironment>(x => x.WebRootFileProvider == AssetsHarness.WebRootWithModules()));
        services.AddSingleton<IConfiguration>(new ConfigurationBuilder().Build());
        services.AddLogging();
        using var provider = services.BuildServiceProvider();

        var assets = provider.GetRequiredService<IPlainJavaScriptAssets>();

        Assert.Equal(3, assets.GetModuleUrls(PathString.Empty).Count);
    }

    /// <summary>
    /// Fails unless the minified files in the renderer's folder are the modules the list names, saying what to do.
    /// </summary>
    private static void AssertListNamesTheBuiltFiles(IEnumerable<string> built, IReadOnlyList<string> listed)
    {
        const string client = "src/Formulate.Extensions.PlainJavaScriptTemplate/Client";
        const string output = "src/Formulate.Extensions.PlainJavaScriptTemplate/wwwroot/App_Plugins/Formulate/PlainJavaScript";
        var builtFiles = built.ToList();
        var extra = builtFiles.Except(listed, StringComparer.Ordinal).Order(StringComparer.Ordinal).ToList();
        var missing = listed.Except(builtFiles, StringComparer.Ordinal).Order(StringComparer.Ordinal).ToList();
        if (extra.Count > 0)
        {
            Assert.Fail(
                $"The renderer's folder has minified files that modules.json does not list: {string.Join(", ", extra)}. "
                + "The build removes the files it wrote before and no longer makes, so these were left by a build from "
                + "before it kept a record of its files, or were put there by hand. Delete the built files in "
                + $"{output} (they are not committed), then run \"npm run build\" in {client}.");
        }

        if (missing.Count > 0)
        {
            Assert.Fail(
                $"modules.json lists modules that are not in the renderer's folder: {string.Join(", ", missing)}. "
                + $"Run \"npm run build\" in {client}.");
        }
    }

    private static void VerifyWarnings(Mock<ILogger<PlainJavaScriptAssets>> logger, Times times)
    {
        logger.Verify(
            x => x.Log(LogLevel.Warning, It.IsAny<EventId>(), It.IsAny<It.IsAnyType>(), It.IsAny<Exception?>(), It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            times);
    }

    /// <summary>The template project's wwwroot, beside this test project in src.</summary>
    private static string FindTemplateWebRoot()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
        {
            var webRoot = Path.Combine(directory.FullName, "Formulate.Extensions.PlainJavaScriptTemplate", "wwwroot");
            if (Directory.Exists(webRoot))
            {
                return webRoot;
            }
        }

        throw new DirectoryNotFoundException("The template project's wwwroot was not found above " + AppContext.BaseDirectory);
    }
}
