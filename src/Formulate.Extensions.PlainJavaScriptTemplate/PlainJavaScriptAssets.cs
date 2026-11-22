namespace Formulate.Extensions.PlainJavaScriptTemplate.Core
{
    using System.Text.Json;
    using System.Text.RegularExpressions;
    using Microsoft.AspNetCore.Hosting;
    using Microsoft.AspNetCore.Http;
    using Microsoft.Extensions.FileProviders;
    using Microsoft.Extensions.Logging;
    using Microsoft.Extensions.Options;

    public sealed class PlainJavaScriptAssets : IPlainJavaScriptAssets
    {
        private const string ScriptPath = PlainJavaScriptCaching.FolderPath + "/formulate.min.js";
        private const string BasicThemePath = PlainJavaScriptCaching.FolderPath + "/themes/basic.min.css";
        private const string RequestItemKey = "Formulate.PlainJavaScript.AssetsAdded";

        /// <summary>The list of modules the renderer's build writes, in the web root.</summary>
        private const string ModuleListPath = "App_Plugins/Formulate/PlainJavaScript/modules.json";

        /// <summary>
        /// A minified module in the renderer's folder, such as "fields/plain-text.min.js": no other folder, no
        /// address of its own and no other kind of file.
        /// </summary>
        private static readonly Regex ModulePathPattern = new(@"^[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*\.min\.js$", RegexOptions.CultureInvariant);

        private readonly bool _includeScript;
        private readonly bool _includeBasicTheme;
        private readonly Lazy<IReadOnlyList<string>> _modulePaths;

        public PlainJavaScriptAssets(IOptions<PlainJavaScriptOptions> options, IWebHostEnvironment environment, ILogger<PlainJavaScriptAssets> logger)
        {
            var value = options.Value;
            _includeScript = value.IncludeScript;

            var theme = (value.Theme ?? string.Empty).Trim();

            if (theme.Equals("basic", StringComparison.OrdinalIgnoreCase))
            {
                _includeBasicTheme = true;
            }
            else if (theme.Length > 0 && !theme.Equals("none", StringComparison.OrdinalIgnoreCase))
            {
                // This is a singleton, so the warning is logged once.
                logger.LogWarning(
                    "The Formulate:PlainJavaScript:Theme setting \"{Theme}\" is not recognized (use \"none\" or \"basic\"), so no theme is added.",
                    theme);
            }

            // Read once, when first needed, from the web root the site serves the renderer's files from: the
            // projects' and packages' static web assets in Development, and wwwroot on a published site. A restart
            // picks up a changed list. Until then, an old list only means preloads that are not needed or missing:
            // the entry's imports still load the right files.
            _modulePaths = new Lazy<IReadOnlyList<string>>(() => ReadModuleList(environment.WebRootFileProvider, logger));
        }

        // The URLs carry no version: each file has one URL, and PlainJavaScriptCaching makes browsers check it.
        public string GetScriptUrl(PathString pathBase) => ToUrl(pathBase, ScriptPath);

        public string? GetThemeUrl(PathString pathBase) => _includeBasicTheme ? ToUrl(pathBase, BasicThemePath) : null;

        // Worked out for each call: the list is short, and the path base can come from a request header.
        public IReadOnlyList<string> GetModuleUrls(PathString pathBase) =>
            _modulePaths.Value.Select(path => ToUrl(pathBase, PlainJavaScriptCaching.FolderPath + "/" + path)).ToArray();

        public PlainJavaScriptPageAssets TakePageAssets(HttpContext context)
        {
            if (context.Items.ContainsKey(RequestItemKey))
            {
                return new PlainJavaScriptPageAssets(null, null);
            }

            context.Items[RequestItemKey] = true;

            var pathBase = context.Request.PathBase;

            return new PlainJavaScriptPageAssets(
                _includeScript ? GetScriptUrl(pathBase) : null,
                GetThemeUrl(pathBase))
            {
                ModuleUrls = _includeScript ? GetModuleUrls(pathBase) : Array.Empty<string>(),
            };
        }

        private static string ToUrl(PathString pathBase, string path) => pathBase.Add(path).Value ?? path;

        /// <summary>
        /// Reads the list of modules: a JSON array of paths in the renderer's folder, the entry first. Without a
        /// list that can be read, pages preload nothing (the entry still imports every module). Whatever goes wrong
        /// is logged, and never reaches a page.
        /// </summary>
        private static IReadOnlyList<string> ReadModuleList(IFileProvider webRoot, ILogger logger)
        {
            try
            {
                return ReadModuleListFrom(webRoot, logger);
            }
            catch (Exception exception)
            {
                // Anything the reading does not expect, such as a file the site may not read or a web root that fails.
                logger.LogWarning(
                    exception,
                    "The plain JavaScript renderer's list of modules, /{Path}, could not be read, so pages do not preload the modules.",
                    ModuleListPath);
                return Array.Empty<string>();
            }
        }

        private static IReadOnlyList<string> ReadModuleListFrom(IFileProvider webRoot, ILogger logger)
        {
            var file = webRoot.GetFileInfo(ModuleListPath);

            if (!file.Exists)
            {
                logger.LogWarning(
                    "The plain JavaScript renderer's list of modules, /{Path}, was not found, so pages do not preload the modules. The forms still work, but each module loads only once the one that imports it has.",
                    ModuleListPath);
                return Array.Empty<string>();
            }

            List<string?> entries;

            try
            {
                using var stream = file.CreateReadStream();
                using var document = JsonDocument.Parse(stream);
                entries = document.RootElement.EnumerateArray()
                    .Select(x => x.ValueKind == JsonValueKind.String ? x.GetString() : null)
                    .ToList();
            }
            catch (Exception exception) when (exception is JsonException or InvalidOperationException)
            {
                logger.LogWarning(
                    exception,
                    "The plain JavaScript renderer's list of modules, /{Path}, is not a JSON array of paths, so pages do not preload the modules.",
                    ModuleListPath);
                return Array.Empty<string>();
            }

            var paths = entries
                .Where(x => x is not null && ModulePathPattern.IsMatch(x))
                .Select(x => x!)
                .Distinct(StringComparer.Ordinal)
                .ToArray();

            if (paths.Length != entries.Count)
            {
                logger.LogWarning(
                    "The plain JavaScript renderer's list of modules, /{Path}, has {Count} entries that are not minified modules in its folder, so pages do not preload them.",
                    ModuleListPath,
                    entries.Count - paths.Length);
            }

            return paths;
        }
    }
}
