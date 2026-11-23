namespace Formulate.CompatibilityCheck.Tests;

/// <summary>
/// Gives each test its own new folders, removed when the test is done.
/// </summary>
public abstract class TempFolderTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "formulate-compat-" + Guid.NewGuid().ToString("N"));

    public void Dispose()
    {
        if (Directory.Exists(_root))
        {
            Directory.Delete(_root, true);
        }
    }

    /// <summary>
    /// Makes a new folder for this test.
    /// </summary>
    protected string Folder(string name)
    {
        var path = Path.Combine(_root, name);
        Directory.CreateDirectory(path);

        return path;
    }
}
