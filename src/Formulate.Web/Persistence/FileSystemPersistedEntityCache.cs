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
    /// <para>
    /// An entry is only reused while the file's last-write time and length are unchanged, so
    /// files edited on disk (a deploy, a copy) are picked up by the next read.
    /// </para>
    /// <para>
    /// The cache keeps each file's text, not the entity, and every Get deserializes a new entity.
    /// Entities are mutable, so a shared instance changed by one caller (without saving) would
    /// change what every other caller, including site visitors, sees.
    /// </para>
    /// </remarks>
    internal sealed class FileSystemPersistedEntityCache : IPersistedEntityCache
    {
        private readonly IJsonUtility _jsonUtility;
        private readonly ILogger<FileSystemPersistedEntityCache> _logger;
        private readonly Func<string, string> _readAllText;

        /// <summary>
        /// The cache of file contents, by file path. An entry with null contents is a file that cannot be used.
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
                && cached.EntityType == typeof(TPersistedEntity))
            {
                // The text was checked when it was read, so it deserializes to a usable entity.
                return cached.Contents is null
                    ? null
                    : _jsonUtility.Deserialize<TPersistedEntity>(cached.Contents);
            }

            var entity = Read<TPersistedEntity>(path, out var contents, out var cacheable);

            if (cacheable)
            {
                var usableContents = entity is null ? null : contents;
                _entities[path] = new CacheEntry(lastWrite, length, typeof(TPersistedEntity), usableContents);
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
        /// <param name="contents">The text of the file, or null when it could not be read.</param>
        /// <param name="cacheable">
        /// False when the file could not be read (locked, permissions), so the next Get retries.
        /// A file that read fine but holds invalid JSON, or an entity without a usable ID or path,
        /// is cacheable (as null) until it changes.
        /// </param>
        private TPersistedEntity? Read<TPersistedEntity>(string path, out string? contents, out bool cacheable) where TPersistedEntity : class, IPersistedEntity
        {
            try
            {
                contents = _readAllText(path);
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                _logger.LogWarning(ex, "Could not read the Formulate file {Path}. It will be retried.", path);
                contents = null;
                cacheable = false;
                return null;
            }

            cacheable = true;
            TPersistedEntity? entity;

            try
            {
                entity = _jsonUtility.Deserialize<TPersistedEntity>(contents);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Skipping the Formulate file {Path} because it is not valid.", path);
                return null;
            }

            var problem = FindProblem(entity, path);

            if (problem is not null)
            {
                _logger.LogWarning("Skipping the Formulate file {Path} because {Problem}.", path, problem);
                return null;
            }

            return entity;
        }

        /// <summary>
        /// Checks that an entity read from a file can be used: the listings and the tree need its ID
        /// and path, and the ID must match the file name, which is how entities are found by ID.
        /// </summary>
        /// <returns>The reason the entity cannot be used, or null when it can.</returns>
        private static string? FindProblem(IPersistedEntity? entity, string path)
        {
            if (entity is null)
            {
                return "it is empty";
            }

            if (entity.Id == Guid.Empty)
            {
                return "it has no Id";
            }

            if (entity.Path is null || entity.Path.Length == 0)
            {
                return "it has no Path";
            }

            if (!Guid.TryParse(Path.GetFileNameWithoutExtension(path), out var fileId) || fileId != entity.Id)
            {
                return $"its Id {entity.Id:N} does not match the file name";
            }

            return null;
        }

        /// <summary>
        /// A file's text as of a last-write time and length, checked for the given entity type.
        /// </summary>
        private sealed record CacheEntry(DateTime LastWrite, long Length, Type EntityType, string? Contents);
    }
}
