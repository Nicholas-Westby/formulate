using System.Text;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Primitives;

namespace Formulate.Extensions.PlainJavaScriptTemplate.Tests;

/// <summary>
/// A web root held in memory, so tests can serve files without writing any to disk. Paths are not case sensitive,
/// as on Windows and macOS.
/// </summary>
internal sealed class InMemoryFileProvider : IFileProvider
{
    private static readonly DateTimeOffset LastModified = new(2026, 11, 22, 9, 0, 0, TimeSpan.Zero);

    private readonly Dictionary<string, byte[]> _files = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>Adds a file, such as "App_Plugins/Formulate/PlainJavaScript/formulate.min.js".</summary>
    public InMemoryFileProvider Add(string path, string content)
    {
        _files[Normalize(path)] = Encoding.UTF8.GetBytes(content);
        return this;
    }

    public IFileInfo GetFileInfo(string subpath)
    {
        var path = Normalize(subpath);
        return _files.TryGetValue(path, out var content)
            ? new InMemoryFileInfo(Path.GetFileName(path), content)
            : new NotFoundFileInfo(subpath);
    }

    public IDirectoryContents GetDirectoryContents(string subpath) => NotFoundDirectoryContents.Singleton;

    public IChangeToken Watch(string filter) => NullChangeToken.Singleton;

    private static string Normalize(string path) => path.Replace('\\', '/').TrimStart('/');

    private sealed class InMemoryFileInfo(string name, byte[] content) : IFileInfo
    {
        public bool Exists => true;

        public long Length => content.Length;

        public string? PhysicalPath => null;

        public string Name => name;

        public DateTimeOffset LastModified => InMemoryFileProvider.LastModified;

        public bool IsDirectory => false;

        public Stream CreateReadStream() => new MemoryStream(content, writable: false);
    }
}
