using System.Reflection.Metadata;
using System.Reflection.PortableExecutable;

namespace Formulate.CompatibilityCheck;

/// <summary>
/// The outcome of an assembly version check.
/// </summary>
/// <param name="Checked">How many assembly references were checked.</param>
/// <param name="Missing">The references to an assembly the site does not have, one line each.</param>
/// <param name="Lower">The references to an assembly the site has only at a lower version, one line each.</param>
internal sealed record VersionCheckResult(int Checked, IReadOnlyCollection<string> Missing, IReadOnlyCollection<string> Lower);

/// <summary>
/// Checks that a site has every assembly the source assemblies reference, at the referenced version or higher.
/// .NET does not load a lower version of an assembly than the one a reference names, so a source built against a
/// newer dependency than a site has fails to load there. References to the .NET shared framework are not checked:
/// a site gets those assemblies from the runtime, not from its own folder.
/// </summary>
internal sealed class AssemblyVersionChecker
{
    private readonly IReadOnlyDictionary<string, Version> _site;

    private readonly IReadOnlySet<string> _sharedFramework;

    /// <param name="site">The assemblies in the site's folder, by name, with their versions.</param>
    /// <param name="sharedFramework">The names of the assemblies in the .NET shared framework.</param>
    public AssemblyVersionChecker(IReadOnlyDictionary<string, Version> site, IReadOnlySet<string> sharedFramework)
    {
        _site = site;
        _sharedFramework = sharedFramework;
    }

    public VersionCheckResult Check(IEnumerable<string> sourcePaths)
    {
        var sources = sourcePaths.Select(SourceAssembly.Read).ToList();

        // The sources are installed together, so a reference from one to another is met by the source itself.
        var available = new Dictionary<string, Version>(_site, StringComparer.OrdinalIgnoreCase);
        foreach (var source in sources)
        {
            available[source.Name] = source.Version;
        }

        var missing = new SortedSet<string>(StringComparer.Ordinal);
        var lower = new SortedSet<string>(StringComparer.Ordinal);
        var checkedCount = 0;

        foreach (var source in sources)
        {
            foreach (var (name, version) in source.References)
            {
                if (_sharedFramework.Contains(name))
                {
                    continue;
                }

                checkedCount++;

                if (!available.TryGetValue(name, out var found))
                {
                    missing.Add($"{source.Name}: ASSEMBLY {name} {version}");
                }
                else if (found < version)
                {
                    lower.Add($"{source.Name}: ASSEMBLY {name} {version}, the site has {found}");
                }
            }
        }

        return new VersionCheckResult(checkedCount, missing, lower);
    }

    /// <summary>
    /// A source assembly's name and version, and the name and version of each assembly it references.
    /// </summary>
    private sealed record SourceAssembly(string Name, Version Version, IReadOnlyList<(string Name, Version Version)> References)
    {
        public static SourceAssembly Read(string path)
        {
            using var pe = new PEReader(File.OpenRead(path));
            var md = pe.GetMetadataReader();
            var definition = md.GetAssemblyDefinition();
            var references = md.AssemblyReferences
                .Select(md.GetAssemblyReference)
                .Select(x => (md.GetString(x.Name), x.Version))
                .ToList();

            return new SourceAssembly(md.GetString(definition.Name), definition.Version, references);
        }
    }
}
