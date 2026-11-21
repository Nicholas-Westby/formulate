using Formulate.Core.DataValues;
using Formulate.Core.Folders;
using Formulate.Core.Forms;
using Formulate.Core.Layouts;
using Formulate.Core.Persistence;
using Formulate.Core.Utilities;
using Formulate.Core.Validations;
using Microsoft.Extensions.Logging;

using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Formulate.Web.Configuration;

namespace Formulate.Web.Persistence
{
    /// <summary>
    /// The default implementation of <see cref="IRepositoryUtilityFactory"/> which stores files under the content root.
    /// </summary>
    internal sealed class WebHostRepositoryUtilityFactory : IRepositoryUtilityFactory
    {
        /// <summary>
        /// The json utility.
        /// </summary>
        private readonly IJsonUtility _jsonUtility;

        /// <summary>
        /// The entity cache.
        /// </summary>
        private readonly IPersistedEntityCache _entityCache;
        
        /// <summary>
        /// The logger.
        /// </summary>
        private readonly ILogger _logger;

        /// <summary>
        /// The json root path.
        /// </summary>
        private readonly string _jsonRootPath;

        /// <summary>
        /// Initializes a new instance of the <see cref="WebHostRepositoryUtilityFactory"/> class.
        /// </summary>
        /// <param name="hostEnvironment">The host environment.</param>
        /// <param name="jsonUtility">The json utility.</param>
        /// <param name="entityCache">The entity cache.</param>
        /// <param name="logger">The logger.</param>
        public WebHostRepositoryUtilityFactory(IOptions<FormulateWebsiteOptions> options, IHostEnvironment hostEnvironment, IJsonUtility jsonUtility, IPersistedEntityCache entityCache, ILogger<WebHostRepositoryUtilityFactory> logger)
        {
            _jsonUtility = jsonUtility;
            _entityCache = entityCache;
            _logger = logger;

            var persistence = options.Value.Persistence;
            _jsonRootPath = ResolveDataFolder(persistence.DataFolderPath, hostEnvironment.ContentRootPath);
            _logger.LogInformation("Formulate stores its JSON files in {DataFolder}.", _jsonRootPath);
        }

        /// <inheritdoc />
        /// <exception cref="NotSupportedException">If the type provided is not supported.</exception>
        public IRepositoryUtility<TEntity> Create<TEntity>() where TEntity : class, IPersistedEntity
        {
            var settings = GetSettings<TEntity>();
            var updatedSettings = UpdateSettings(settings);

            return new WebHostRepositoryUtility<TEntity>(updatedSettings, _jsonUtility, _entityCache, _logger);
        }

        /// <summary>
        /// Resolves the configured data folder to a full path.
        /// </summary>
        /// <remarks>
        /// A leading "~/" or "~\" and a plain relative path are relative to the content root. Any
        /// other rooted path (such as "/var/formulate" or "C:\data") is used as is.
        /// </remarks>
        private static string ResolveDataFolder(string configured, string contentRootPath)
        {
            if (configured.StartsWith("~/") || configured.StartsWith("~\\"))
            {
                configured = configured.Substring(2)
                    .Replace('\\', Path.DirectorySeparatorChar)
                    .TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            }

            return Path.GetFullPath(configured, contentRootPath);
        }

        /// <summary>
        /// Updates the settings to be rooted in the application.
        /// </summary>
        /// <param name="settings">The current settings.</param>
        /// <returns>A <see cref="WebHostRepositoryUtilitySettings"/>.</returns>
        private WebHostRepositoryUtilitySettings UpdateSettings(WebHostRepositoryUtilitySettings settings)
        {
            var mappedBasePath = Path.Combine(_jsonRootPath, settings.BasePath);

            return new WebHostRepositoryUtilitySettings(mappedBasePath, settings.Extension, settings.Wildcard);
        }

        /// <summary>
        /// Gets the settings for the incoming type.
        /// </summary>
        /// <returns>A <see cref="WebHostRepositoryUtilitySettings"/>.</returns>
        /// <exception cref="NotSupportedException">If the type provided is not supported.</exception>
        private static WebHostRepositoryUtilitySettings GetSettings<TEntity>()
        {
            var type = typeof(TEntity);
            
            if (type == typeof(PersistedDataValues))
            {
                return WebHostRepositoryUtilitySettings.DataValues;
            }

            if (type == typeof(PersistedForm))
            {
                return WebHostRepositoryUtilitySettings.Forms;
            }

            if (type == typeof(PersistedFolder))
            {
                return WebHostRepositoryUtilitySettings.Folders;
            }

            if (type == typeof(PersistedLayout))
            {
                return WebHostRepositoryUtilitySettings.Layouts;
            }

            if (type == typeof(PersistedValidation))
            {
                return WebHostRepositoryUtilitySettings.Validations;
            }

            throw new NotSupportedException($"Entity type {type} has no matching {typeof(WebHostRepositoryUtilitySettings)} settings.");
        }
    }
}
