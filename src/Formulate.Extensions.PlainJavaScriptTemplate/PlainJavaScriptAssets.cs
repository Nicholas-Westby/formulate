namespace Formulate.Extensions.PlainJavaScriptTemplate.Core
{
    using System.Reflection;
    using Microsoft.AspNetCore.Http;
    using Microsoft.AspNetCore.Mvc.ViewFeatures;
    using Microsoft.Extensions.Logging;
    using Microsoft.Extensions.Options;

    public sealed class PlainJavaScriptAssets : IPlainJavaScriptAssets
    {
        private const string ScriptPath = "/App_Plugins/Formulate/PlainJavaScript/formulate.js";
        private const string BasicThemePath = "/App_Plugins/Formulate/PlainJavaScript/themes/basic.min.css";
        private const string RequestItemKey = "Formulate.PlainJavaScript.AssetsAdded";

        private static readonly string FallbackVersion = GetVersion();

        private readonly IFileVersionProvider _fileVersionProvider;
        private readonly bool _includeScript;
        private readonly bool _includeBasicTheme;

        public PlainJavaScriptAssets(IOptions<PlainJavaScriptOptions> options, IFileVersionProvider fileVersionProvider, ILogger<PlainJavaScriptAssets> logger)
        {
            _fileVersionProvider = fileVersionProvider;

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
        }

        public string GetScriptUrl(PathString pathBase) => AddVersion(pathBase, ScriptPath);

        public string? GetThemeUrl(PathString pathBase) => _includeBasicTheme ? AddVersion(pathBase, BasicThemePath) : null;

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
                GetThemeUrl(pathBase));
        }

        private string AddVersion(PathString pathBase, string path)
        {
            // Same as asp-append-version: the URL gets a hash of the file's content as ?v=.
            var url = pathBase.Add(path).Value ?? path;
            var versioned = _fileVersionProvider.AddFileVersionToPath(pathBase, url);

            // The file could not be found (a hosting setup that does not serve it through the web
            // root), so fall back to the version of this assembly.
            return versioned.Contains("?v=", StringComparison.Ordinal)
                ? versioned
                : url + "?v=" + Uri.EscapeDataString(FallbackVersion);
        }

        private static string GetVersion()
        {
            var assembly = typeof(PlainJavaScriptAssets).Assembly;
            var version = assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
                ?? assembly.GetName().Version?.ToString()
                ?? "0";

            // Drop the source revision that follows a "+".
            var plus = version.IndexOf('+');

            return plus >= 0 ? version[..plus] : version;
        }
    }
}
