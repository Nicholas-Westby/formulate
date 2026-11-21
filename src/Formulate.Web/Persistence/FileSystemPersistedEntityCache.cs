using Formulate.Core.Persistence;
using Formulate.Core.Utilities;
using Microsoft.Extensions.Logging;

namespace Formulate.Web.Persistence
{
    /// <summary>
    /// A cache of entities that are stored on the file system (helps to avoid
    /// accessing the file system unnecessarily).
    /// </summary>
    internal sealed class FileSystemPersistedEntityCache : IPersistedEntityCache
    {
        private readonly IJsonUtility _jsonUtility;

        /// <summary>
        /// Initializes a new instance of the <see cref="FileSystemPersistedEntityCache"/> class.
        /// </summary>
        /// <param name="jsonUtility"></param>
        public FileSystemPersistedEntityCache(IJsonUtility jsonUtility, ILogger<FileSystemPersistedEntityCache> logger)
        {
            _jsonUtility = jsonUtility;
        }

        /// <inheritdoc />
        public TPersistedEntity? Get<TPersistedEntity>(string path) where TPersistedEntity : class, IPersistedEntity
        {
            // Temporary: reads the file every time until the cache is rebuilt.
            var contents = GetFileContents(path);

            return contents is null ? null : _jsonUtility.Deserialize<TPersistedEntity>(contents);
        }

        /// <summary>
        /// Invalidates an item in the cache.
        /// </summary>
        /// <param name="path">
        /// The path to the entity on the file system to invalidate.
        /// </param>
        public void Invalidate(string path)
        {
        }

        /// <summary>
        /// Gets the contents of the file at the specified path.
        /// </summary>
        /// <param name="path">The path to the file.</param>
        /// <returns>
        /// The file contents, or null.
        /// </returns>
        private static string? GetFileContents(string? path)
        {
            if (File.Exists(path))
            {
                return File.ReadAllText(path);
            }

            return default;
        }
    }
}