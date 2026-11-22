namespace Formulate.Extensions.PlainJavaScriptTemplate.Core
{
    using Microsoft.AspNetCore.Http;
    using Microsoft.Extensions.Logging;
    using Microsoft.Extensions.Options;

    public sealed class PlainJavaScriptAssets : IPlainJavaScriptAssets
    {
        private const string ScriptPath = PlainJavaScriptCaching.FolderPath + "/formulate.min.js";
        private const string BasicThemePath = PlainJavaScriptCaching.FolderPath + "/themes/basic.min.css";
        private const string RequestItemKey = "Formulate.PlainJavaScript.AssetsAdded";

        private readonly bool _includeScript;
        private readonly bool _includeBasicTheme;

        public PlainJavaScriptAssets(IOptions<PlainJavaScriptOptions> options, ILogger<PlainJavaScriptAssets> logger)
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
        }

        // The URLs carry no version: each file has one URL, and PlainJavaScriptCaching makes browsers check it.
        public string GetScriptUrl(PathString pathBase) => ToUrl(pathBase, ScriptPath);

        public string? GetThemeUrl(PathString pathBase) => _includeBasicTheme ? ToUrl(pathBase, BasicThemePath) : null;

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

        private static string ToUrl(PathString pathBase, string path) => pathBase.Add(path).Value ?? path;
    }
}
