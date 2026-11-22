namespace Formulate.Extensions.SendEmail.Utilities
{
    using Microsoft.Extensions.Logging;
    using Umbraco.Cms.Core.Models;
    using Umbraco.Cms.Core.Models.PublishedContent;
    using Umbraco.Cms.Core.Routing;
    using Umbraco.Cms.Core.Services;

    /// <summary>
    /// Finds a page's URL and name from its ID, without the IPublishedContent members Umbraco 18 moved,
    /// so it runs on every supported Umbraco.
    /// </summary>
    internal sealed class SubmissionPageResolver : ISubmissionPageResolver
    {
        private readonly IIdKeyMap _idKeyMap;

        private readonly IPublishedUrlProvider _urlProvider;

        private readonly IEntityService _entityService;

        private readonly ILogger<SubmissionPageResolver> _logger;

        public SubmissionPageResolver(IIdKeyMap idKeyMap, IPublishedUrlProvider urlProvider, IEntityService entityService,
            ILogger<SubmissionPageResolver> logger)
        {
            _idKeyMap = idKeyMap;
            _urlProvider = urlProvider;
            _entityService = entityService;
            _logger = logger;
        }

        public SubmissionPage Resolve(int? pageId)
        {
            if (pageId is null)
            {
                return SubmissionPage.None;
            }

            return new SubmissionPage(GetUrl(pageId.Value), GetName(pageId.Value));
        }

        private string? GetUrl(int pageId)
        {
            try
            {
                var key = _idKeyMap.GetKeyForId(pageId, UmbracoObjectTypes.Document);

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
                // The URL is only a convenience: the email is sent without it.
                _logger.LogWarning(ex, "Could not work out the URL of page {PageId}.", pageId);
                return null;
            }
        }

        private string? GetName(int pageId)
        {
            try
            {
                return _entityService.Get(pageId, UmbracoObjectTypes.Document)?.Name;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not work out the name of page {PageId}.", pageId);
                return null;
            }
        }
    }
}
