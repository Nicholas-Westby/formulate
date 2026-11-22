namespace Formulate.Extensions.PlainJavaScriptTemplate.Core
{
    using Microsoft.AspNetCore.Http;

    /// <summary>
    /// Works out the URLs of the renderer script and the theme, and which of them a page still needs.
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
        /// Gets the tags the page needs: the first call in a request returns them, and later calls in
        /// the same request return nothing, so several forms on a page share one script and one theme.
        /// </summary>
        PlainJavaScriptPageAssets TakePageAssets(HttpContext context);
    }

    /// <summary>
    /// The URLs to add to the page (null when not needed).
    /// </summary>
    public sealed record PlainJavaScriptPageAssets(string? ScriptUrl, string? ThemeUrl);
}
