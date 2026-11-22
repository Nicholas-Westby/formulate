namespace Formulate.Extensions.PlainJavaScriptTemplate.Core
{
    using Formulate.Core.RenderModels;
    using Formulate.Core.Utilities;
    using Microsoft.AspNetCore.Antiforgery;
    using Microsoft.AspNetCore.Http;
    using Newtonsoft.Json.Linq;
    using Umbraco.Cms.Core.Mapping;
    using Umbraco.Cms.Core.Models;
    using Umbraco.Cms.Core.Services;
    using Umbraco.Cms.Core.Web;

    public sealed class BuildPlainJavaScriptJson : IBuildPlainJavaScriptJson
    {
        // The field types that hold a value the visitor can enter.
        private static readonly HashSet<string> PrefillFieldTypes = new(StringComparer.Ordinal)
        {
            "text", "textarea", "select", "checkbox", "checkbox-list", "radio-list", "extended-radio-list", "date"
        };

        private readonly IJsonUtility _jsonUtility;
        private readonly IUmbracoContextAccessor _umbracoContextAccessor;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly IAntiforgery _antiforgery;
        private readonly IUmbracoMapper _umbracoMapper;
        private readonly IIdKeyMap _idKeyMap;
        private readonly IPlainJavaScriptAssets _assets;

        public BuildPlainJavaScriptJson(IJsonUtility jsonUtility, IUmbracoContextAccessor umbracoContextAccessor, IHttpContextAccessor httpContextAccessor, IAntiforgery antiforgery, IUmbracoMapper umbracoMapper, IIdKeyMap idKeyMap, IPlainJavaScriptAssets assets)
        {
            _jsonUtility = jsonUtility;
            _umbracoContextAccessor = umbracoContextAccessor;
            _httpContextAccessor = httpContextAccessor;
            _antiforgery = antiforgery;
            _umbracoMapper = umbracoMapper;
            _idKeyMap = idKeyMap;
            _assets = assets;
        }

        public string Build(FormLayoutRenderModel renderModel, string containerId)
        {
            var layout = _umbracoMapper.Map<PlainJavaScriptLayout?>(renderModel.Layout);

            if (layout is null)
            {
                return string.Empty;
            }

            // Exclude server-side only fields.
            var fields = renderModel.Form.Fields.Where(x => !x.IsServerSideOnly).Select(x => x.Field).ToArray();

            var pageId = GetPageId();

            var csrfToken = GenerateAntiForgeryToken();

            if (string.IsNullOrEmpty(csrfToken))
            {
                return string.Empty;
            }

            // Structure fields as an anonymous object suitable for serialization to JSON.
            var fieldsData = fields.Select(x => {
                var mappedField = _umbracoMapper.Map<PlainJavaScriptFormField>(x) ?? new PlainJavaScriptFormField("unknown");
                var (configuration, initialValue) = GetInitialValue(x.Alias, mappedField);
                return new
                {
                    // The alias can be used to attach custom styles.
                    alias = x.Alias,
                    // The label can be used to instruct the user what data to enter.
                    label = x.Label ?? x.Name,
                    // The ID can be submitted to the server to uniquely identify the field.
                    id = x.Id.ToString("N"),
                    // The random ID can be used to uniquely identify the field on the page.
                    // Note that this random ID is regenerated on each page render.
                    randomId = Guid.NewGuid().ToString("N"),
                    // This field type (e.g., "text", "checkbox") can be used to figure out how to render a field.
                    fieldType = mappedField.FieldType,
                    validations = x.Validations.Select(y =>
                    {
                        var mappedValidation = _umbracoMapper.Map<PlainJavaScriptValidation>(y) ?? new PlainJavaScriptValidation("unknown");
                        return new
                        {
                            id = y.Id.ToString("N"),
                            alias = y.Name,
                            validationType = mappedValidation.ValidationType,
                            configuration = mappedValidation.Configuration
                        };
                    }).ToArray(),
                    // The field configuration stores parameters particular to a field (e.g., a list of items).
                    configuration,
                    // The initial value comes from the query string based on the field alias.
                    initialValue,
                    // The user selected category of the field
                    category = x.Category                
                };

            }).ToArray();


            // Structure layout as an anonymous object suitable for serialization to JSON.
            var rowsData = layout.Rows.Select(x => new
            {
                isStep = x.IsStep,
                cells = x.Cells.Select(y => new
                {
                    columns = y.ColumnSpan,
                    fields = y.FieldIds.Select(z => new
                    {
                        id = z.ToString("N")
                    }).Where(i => fieldsData.Any(f => f.id.Equals(i.id))).ToArray()
                }).ToArray()
            }).ToArray();

            // The values the browser posts back with the field values. A form that is not on a
            // content page has no page ID, so it is left out: some clients post every value as
            // text, and "null" is not a number the submission endpoint can bind.
            var payload = new Dictionary<string, object>
            {
                ["FormId"] = renderModel.Form.Id.ToString("N"),
            };

            if (pageId.HasValue)
            {
                payload["PageId"] = pageId.Value;
            }

            payload["__RequestVerificationToken"] = csrfToken;

            // Convert to a JSON string that can be consumed by JavaScript.
            var pathBase = _httpContextAccessor.HttpContext?.Request.PathBase ?? default;

            var json = _jsonUtility.Serialize(new
            {
                // The URLs of the renderer script and the theme (null when there is no theme).
                assets = new
                {
                    script = _assets.GetScriptUrl(pathBase),
                    theme = _assets.GetThemeUrl(pathBase)
                },
                data = new
                {
                    // The name of the form can be use for analytics.
                    name = renderModel.Form.Name,
                    // The form alias can be used for custom styles.
                    alias = renderModel.Form.Alias,
                    // The random ID can be used to uniquely identify the form on the page.
                    // Note that this random ID is regenerated on each page render.
                    randomId = containerId,
                    // The fields in this form.
                    fields = fieldsData,
                    // The rows that define the form layout.
                    rows = rowsData,
                    payload,
                    // The site can be hosted under a path base (for example, "/site").
                    url = pathBase.Add("/api/formulate/plain-js/submit").Value
                }
            });

            return EscapeForScriptBlock(json);
        }

        /// <summary>
        /// Escapes the characters that could end a script block or start an HTML comment inside it
        /// (and the two line separators older script engines reject in strings). Each of these only
        /// appears inside a JSON string, where \uXXXX is an exact equivalent, so the result parses
        /// to the same data.
        /// </summary>
        private static string EscapeForScriptBlock(string json)
        {
            var builder = new System.Text.StringBuilder(json.Length + 16);

            foreach (var c in json)
            {
                switch (c)
                {
                    case '<':
                    case '>':
                    case '&':
                    case '\'':
                    case '\u2028':
                    case '\u2029':
                        builder.Append("\\u").Append(((int)c).ToString("x4"));
                        break;
                    default:
                        builder.Append(c);
                        break;
                }
            }

            return builder.ToString();
        }

        /// <summary>
        /// Gets the field's configuration and initial value. A query string value for the field's
        /// alias pre-fills the field (as in Formulate 3). A hidden field starts with the configured
        /// text when the query string has nothing for it, and the renderer reads that value from the
        /// configuration as well.
        /// </summary>
        private (object Configuration, object InitialValue) GetInitialValue(string alias, PlainJavaScriptFormField field)
        {
            var values = GetQueryValues(alias);

            if (field.FieldType == "hidden")
            {
                var configured = JObject.FromObject(field.Configuration)["text"]?.ToString() ?? string.Empty;
                var text = values.Length > 0 ? values[0] : configured;

                return (new { text }, text);
            }

            if (!PrefillFieldTypes.Contains(field.FieldType) || values.Length == 0)
            {
                return (field.Configuration, string.Empty);
            }

            // Only a list of checkboxes can take more than one value.
            object initialValue = field.FieldType == "checkbox-list" ? values : values[0];

            return (field.Configuration, initialValue);
        }

        private string[] GetQueryValues(string alias)
        {
            var request = _httpContextAccessor.HttpContext?.Request;

            if (request is null || string.IsNullOrEmpty(alias) || !request.Query.TryGetValue(alias, out var values))
            {
                return Array.Empty<string>();
            }

            return values.Where(x => !string.IsNullOrEmpty(x)).Select(x => x!).ToArray();
        }

        private string GenerateAntiForgeryToken()
        {
            var context = _httpContextAccessor.HttpContext;

            if (context is null)
            {
                return string.Empty;
            }

            var tokens = _antiforgery.GetAndStoreTokens(context);

            return tokens.RequestToken;
        }

        private int? GetPageId()
        {
            if (_umbracoContextAccessor.TryGetUmbracoContext(out var context) == false)
            {
                return default;
            }

            var request = context.PublishedRequest;

            if (request is null || request.PublishedContent is null)
            {
                return default;
            }

            // Look the ID up by key: Umbraco 18 moved Id from IPublishedContent to IPublishedElement,
            // so reading it here would throw MissingMethodException there. Key is on IPublishedElement
            // in every supported version.
            var attempt = _idKeyMap.GetIdForKey(request.PublishedContent.Key, UmbracoObjectTypes.Document);

            return attempt.Success ? attempt.Result : default(int?);
        }
    }
}
