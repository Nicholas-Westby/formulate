using System.Reflection;
using System.Reflection.Metadata;
using System.Reflection.Metadata.Ecma335;
using System.Reflection.PortableExecutable;

namespace Formulate.CompatibilityCheck.Tests;

/// <summary>
/// Writes small assemblies for the tests. Each one holds only its own name and version, and the names and
/// versions of the assemblies it references, which is all the assembly version check reads.
/// </summary>
internal static class TestAssemblies
{
    /// <summary>
    /// Writes an assembly to a folder, as "name.dll".
    /// </summary>
    /// <param name="folder">The folder to write to.</param>
    /// <param name="assembly">The assembly's name and version, such as "Formulate.Core 5.0.0.0".</param>
    /// <param name="references">The assemblies it references, written the same way.</param>
    /// <returns>The assembly's path.</returns>
    public static string Write(string folder, string assembly, params string[] references)
    {
        var (name, version) = Parse(assembly);
        var metadata = new MetadataBuilder();

        metadata.AddModule(0, metadata.GetOrAddString(name + ".dll"), metadata.GetOrAddGuid(Guid.NewGuid()), default, default);
        metadata.AddAssembly(metadata.GetOrAddString(name), version, default, default, default, AssemblyHashAlgorithm.Sha1);

        foreach (var reference in references)
        {
            var (referenceName, referenceVersion) = Parse(reference);
            metadata.AddAssemblyReference(metadata.GetOrAddString(referenceName), referenceVersion, default, default, default, default);
        }

        // Every module has the special <Module> type.
        metadata.AddTypeDefinition(
            default, default, metadata.GetOrAddString("<Module>"), default,
            MetadataTokens.FieldDefinitionHandle(1), MetadataTokens.MethodDefinitionHandle(1));

        var image = new BlobBuilder();
        new ManagedPEBuilder(PEHeaderBuilder.CreateLibraryHeader(), new MetadataRootBuilder(metadata), new BlobBuilder())
            .Serialize(image);

        var path = Path.Combine(folder, name + ".dll");
        File.WriteAllBytes(path, image.ToArray());

        return path;
    }

    private static (string Name, Version Version) Parse(string assembly)
    {
        var parts = assembly.Split(' ');

        return (parts[0], Version.Parse(parts[1]));
    }
}
