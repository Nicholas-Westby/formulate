namespace Formulate.Extensions.PlainJavaScriptTemplate.Core
{
    using Microsoft.AspNetCore.Http;

    /// <summary>
    /// Works out the URLs of the renderer script and the theme, and which of them a page still needs.
    /// </summary>
    public interface IPlainJavaScriptAssets
    {
        /// <summary>
        /// Gets the URL of the renderer script, versioned by its content so a new build is never served stale.
        /// </summary>
        string GetScriptUrl(PathString pathBase);

        /// <summary>
        /// Gets the URL of the theme stylesheet, or null when no theme is configured.
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
