namespace Formulate.Extensions.StoreData.Utilities
{
    /// <summary>
    /// Finds the URL of the page a form was submitted from.
    /// </summary>
    internal interface IPageUrlResolver
    {
        /// <summary>
        /// Gets the page's absolute URL, or null when there is no page or it has no URL.
        /// </summary>
        string? GetUrl(int? pageId);
    }
}
