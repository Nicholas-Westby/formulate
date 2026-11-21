using System.Collections.Concurrent;
using Formulate.Core.Persistence;
using Formulate.Core.Utilities;
using Microsoft.Extensions.Logging;

namespace Formulate.Web.Persistence
{
    /// <summary>
    /// A cache of entities that are stored on the file system (helps to avoid
    /// accessing the file system unnecessarily).
    /// </summary>
    /// <remarks>
    /// An entry is only reused while the file's last-write time and length are unchanged, so
    /// files edited on disk (a deploy, a copy) are picked up by the next read.
    /// </remarks>
    internal sealed class FileSystemPersistedEntityCache : IPersistedEntityCache
    {
        private readonly IJsonUtility _jsonUtility;
        private readonly ILogger<FileSystemPersistedEntityCache> _logger;
        private readonly Func<string, string> _readAllText;

        /// <summary>
        /// The cache of entities, by file path. An entry with a null entity is a file that could not be read.
        /// </summary>
        private readonly ConcurrentDictionary<string, CacheEntry> _entities = new(StringComparer.Ordinal);

        /// <summary>
        /// Initializes a new instance of the <see cref="FileSystemPersistedEntityCache"/> class.
        /// </summary>
        /// <param name="jsonUtility">The json utility.</param>
        /// <param name="logger">The logger.</param>
        public FileSystemPersistedEntityCache(IJsonUtility jsonUtility, ILogger<FileSystemPersistedEntityCache> logger)
            : this(jsonUtility, logger, File.ReadAllText)
        {
        }

        /// <summary>
        /// Initializes a new instance with a custom file reader (a seam for tests).
        /// </summary>
        internal FileSystemPersistedEntityCache(IJsonUtility jsonUtility, ILogger<FileSystemPersistedEntityCache> logger,
            Func<string, string> readAllText)
        {
            _jsonUtility = jsonUtility;
            _logger = logger;
            _readAllText = readAllText;
        }

        /// <inheritdoc />
        public TPersistedEntity? Get<TPersistedEntity>(string path) where TPersistedEntity : class, IPersistedEntity
        {
            var file = new FileInfo(path);

            if (!file.Exists)
            {
                _entities.TryRemove(path, out _);
                return null;
            }

            var lastWrite = file.LastWriteTimeUtc;
            var length = file.Length;

            if (_entities.TryGetValue(path, out var cached)
                && cached.LastWrite == lastWrite
                && cached.Length == length
                && (cached.Entity is null || cached.Entity is TPersistedEntity))
            {
                return cached.Entity as TPersistedEntity;
            }

            var entity = Read<TPersistedEntity>(path, out var cacheable);

            if (cacheable)
            {
                _entities[path] = new CacheEntry(lastWrite, length, entity);
            }
            else
            {
                _entities.TryRemove(path, out _);
            }

            return entity;
        }

        /// <summary>
        /// Invalidates an item in the cache.
        /// </summary>
        /// <param name="path">
        /// The path to the entity on the file system to invalidate.
        /// </param>
        public void Invalidate(string path)
        {
            _entities.TryRemove(path, out _);
        }

        /// <summary>
        /// Reads and deserializes the file, logging and returning null when that fails.
        /// </summary>
        /// <param name="path">The file path.</param>
        /// <param name="cacheable">
        /// False when the file could not be read (locked, permissions), so the next Get retries.
        /// A file that read fine but holds invalid JSON is cacheable (as null) until it changes.
        /// </param>
        private TPersistedEntity? Read<TPersistedEntity>(string path, out bool cacheable) where TPersistedEntity : class, IPersistedEntity
        {
            string contents;

            try
            {
                contents = _readAllText(path);
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                _logger.LogWarning(ex, "Could not read the Formulate file {Path}. It will be retried.", path);
                cacheable = false;
                return null;
            }

            cacheable = true;

            try
            {
                return _jsonUtility.Deserialize<TPersistedEntity>(contents);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Skipping the Formulate file {Path} because it is not valid.", path);
                return null;
            }
        }

        private sealed record CacheEntry(DateTime LastWrite, long Length, IPersistedEntity? Entity);
    }
}
