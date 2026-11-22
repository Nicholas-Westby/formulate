namespace Formulate.Extensions.StoreData.Utilities
{
    using Microsoft.Extensions.Logging;
    using Umbraco.Cms.Core;
    using Umbraco.Cms.Core.Models;
    using Umbraco.Cms.Core.Models.PublishedContent;
    using Umbraco.Cms.Core.Routing;
    using Umbraco.Cms.Core.Services;

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

    /// <summary>
    /// Resolves a page's URL from its ID, using only its key, so it runs on every supported Umbraco.
    /// </summary>
    internal sealed class PageUrlResolver : IPageUrlResolver
    {
        private readonly IIdKeyMap _idKeyMap;
        private readonly IPublishedUrlProvider _urlProvider;
        private readonly ILogger<PageUrlResolver> _logger;

        public PageUrlResolver(IIdKeyMap idKeyMap, IPublishedUrlProvider urlProvider, ILogger<PageUrlResolver> logger)
        {
            _idKeyMap = idKeyMap;
            _urlProvider = urlProvider;
            _logger = logger;
        }

        public string? GetUrl(int? pageId)
        {
            if (pageId is null)
            {
                return null;
            }

            try
            {
                var key = _idKeyMap.GetKeyForId(pageId.Value, UmbracoObjectTypes.Document);

                if (key.Success == false)
                {
                    return null;
                }

                var url = _urlProvider.GetUrl(key.Result, UrlMode.Absolute);

                // Umbraco answers "#" for a page it cannot route.
                return string.IsNullOrWhiteSpace(url) || url == "#" ? null : url;
            }
            catch (Exception ex)
            {
                // The URL is only a convenience: the submission is stored without it.
                _logger.LogWarning(ex, "Could not work out the URL of page {PageId}.", pageId);
                return null;
            }
        }
    }
}
