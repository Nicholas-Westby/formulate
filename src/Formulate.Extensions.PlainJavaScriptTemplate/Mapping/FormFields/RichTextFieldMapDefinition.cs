namespace Formulate.Extensions.PlainJavaScriptTemplate.Core.Mapping.FormFields
{
    using Formulate.Core.FormFields.RichText;
    using Formulate.Extensions.PlainJavaScriptTemplate;
    using Microsoft.Extensions.Logging;
    using Umbraco.Cms.Core.Mapping;
    using Umbraco.Cms.Core.Templates;
    using Umbraco.Cms.Core.Web;

    public sealed class RichTextFieldMapDefinition : FormFieldMapDefinition<RichTextField>
    {
        private readonly HtmlLocalLinkParser _linkParser;
        private readonly HtmlImageSourceParser _imageSourceParser;
        private readonly IUmbracoContextAccessor _umbracoContextAccessor;
        private readonly ILogger<RichTextFieldMapDefinition> _logger;

        public RichTextFieldMapDefinition(
            HtmlLocalLinkParser linkParser,
            HtmlImageSourceParser imageSourceParser,
            IUmbracoContextAccessor umbracoContextAccessor,
            ILogger<RichTextFieldMapDefinition> logger)
        {
            _linkParser = linkParser;
            _imageSourceParser = imageSourceParser;
            _umbracoContextAccessor = umbracoContextAccessor;
            _logger = logger;
        }

        protected override PlainJavaScriptFormField Map(RichTextField field, MapperContext context)
        {
            var fieldConfig = field.Configuration;
            var config = new
            {
                text = Resolve(field, fieldConfig.Text)
            };

            return new PlainJavaScriptFormField(config, "rich-text");
        }

        /// <summary>
        /// The text, which is HTML from Umbraco's rich text editor, as Umbraco renders its own rich text: a link
        /// to a content page (href="/{localLink:...}") gets the page's URL, and an image from the media library
        /// (data-udi="umb://media/...") gets its media's URL.
        /// </summary>
        private string? Resolve(RichTextField field, string? text)
        {
            if (string.IsNullOrEmpty(text))
            {
                return text;
            }

            // Umbraco looks the pages and the media up in the Umbraco context, and throws when there is none, as when
            // a form is rendered outside a request that Umbraco handles. The text is then shown as it is stored.
            if (_umbracoContextAccessor.TryGetUmbracoContext(out _) == false)
            {
                // Only text with a link or an image to resolve is worth a warning: other text is shown right as stored.
                if (HasSomethingToResolve(text) == false)
                {
                    return text;
                }

                _logger.LogWarning(
                    "Form field {FieldName} ({FieldId}) shows its text as stored: with no Umbraco context, its links to pages and its images from the media library cannot be resolved.",
                    field.Name,
                    field.Id);

                return text;
            }

            return _imageSourceParser.EnsureImageSources(_linkParser.EnsureInternalLinks(text));
        }

        /// <summary>Whether the text has a link to a content page ({localLink:) or an image from the media library (data-udi).</summary>
        private static bool HasSomethingToResolve(string text) =>
            text.Contains("{localLink:", StringComparison.Ordinal) || text.Contains("data-udi", StringComparison.Ordinal);
    }
}
