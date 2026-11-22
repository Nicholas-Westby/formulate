namespace Formulate.Extensions.PlainJavaScriptTemplate.Core
{
    using Microsoft.AspNetCore.Http;

    /// <summary>
    /// Works out the URLs of the renderer's modules and the theme, and which of them a page still needs.
    /// </summary>
    public interface IPlainJavaScriptAssets
    {
        /// <summary>
        /// Gets the URL of the renderer's entry module, formulate.min.js, which a page loads with
        /// <c>&lt;script type="module"&gt;</c>. It has no version in it: the renderer's files keep their URLs, and are
        /// sent with <c>Cache-Control: no-cache</c> so that browsers check for a newer copy.
        /// </summary>
        string GetScriptUrl(PathString pathBase);

        /// <summary>
        /// Gets the URL of the theme stylesheet (with no version in it either), or null when no theme is configured.
        /// </summary>
        string? GetThemeUrl(PathString pathBase);

        /// <summary>
        /// Gets the URLs of the renderer's minified modules: formulate.min.js first, then the modules it imports.
        /// They come from the list the renderer's build writes (modules.json, beside formulate.min.js). A page writes a
        /// <c>&lt;link rel="modulepreload"&gt;</c> for each one before the entry's script tag, so the browser asks for
        /// every module at once instead of finding the imports one level at a time. The form view does this, and a
        /// site that loads the script itself (with Formulate:PlainJavaScript:IncludeScript set to false) should too.
        /// The list is empty when modules.json is missing or cannot be read, and the forms still work. It is read
        /// once, so a restart picks up a changed list. Until then, an old list only means preloads that are not
        /// needed or missing: the entry's imports still load the right files.
        /// </summary>
        IReadOnlyList<string> GetModuleUrls(PathString pathBase);

        /// <summary>
        /// Gets the tags the page needs: the first call in a request returns them, and later calls in
        /// the same request return nothing, so several forms on a page share one script and one theme.
        /// </summary>
        PlainJavaScriptPageAssets TakePageAssets(HttpContext context);
    }

    /// <summary>
    /// The URLs to add to the page (null when not needed).
    /// </summary>
    public sealed record PlainJavaScriptPageAssets(string? ScriptUrl, string? ThemeUrl)
    {
        /// <summary>
        /// Gets the modules to preload before the script, from <see cref="IPlainJavaScriptAssets.GetModuleUrls"/>
        /// (empty when the page does not get the script).
        /// </summary>
        public IReadOnlyList<string> ModuleUrls { get; init; } = Array.Empty<string>();
    }
}
