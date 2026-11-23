namespace Formulate.CompatibilityCheck;

/// <summary>
/// The .NET shared frameworks an Umbraco site runs on: Microsoft.NETCore.App and Microsoft.AspNetCore.App. A site
/// gets their assemblies from the .NET runtime, not from its own folder.
/// </summary>
internal static class SharedFramework
{
    /// <summary>
    /// Gets the names of the assemblies in the shared frameworks this tool runs on, read from their folders.
    /// </summary>
    public static IReadOnlySet<string> AssemblyNames()
    {
        var folders = new[]
        {
            Path.GetDirectoryName(typeof(object).Assembly.Location)!,
            Path.GetDirectoryName(typeof(Microsoft.AspNetCore.Http.HttpContext).Assembly.Location)!,
        };

        return folders
            .SelectMany(x => Directory.GetFiles(x, "*.dll"))
            .Select(x => Path.GetFileNameWithoutExtension(x))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }
}
