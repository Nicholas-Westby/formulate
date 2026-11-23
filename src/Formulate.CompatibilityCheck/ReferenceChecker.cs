using System.Reflection.Metadata;
using System.Reflection.PortableExecutable;

namespace Formulate.CompatibilityCheck;

/// <summary>
/// The outcome of a check.
/// </summary>
/// <param name="Checked">How many type and member references were checked.</param>
/// <param name="Missing">The references not found in the target, one line each.</param>
/// <param name="BaseTypes">The tracked base types and interfaces the sources build on.</param>
internal sealed record CheckResult(int Checked, IReadOnlyCollection<string> Missing, IReadOnlyCollection<string> BaseTypes);

/// <summary>
/// Checks the Umbraco and NPoco type and member references in source assemblies against a target.
/// </summary>
internal sealed class ReferenceChecker
{
    private readonly TargetIndex _targets;

    public ReferenceChecker(TargetIndex targets)
    {
        _targets = targets;
    }

    public CheckResult Check(IEnumerable<string> sourcePaths)
    {
        var missing = new SortedSet<string>(StringComparer.Ordinal);
        var baseTypes = new SortedSet<string>(StringComparer.Ordinal);
        var checkedCount = 0;

        foreach (var sourcePath in sourcePaths)
        {
            using var pe = new PEReader(File.OpenRead(sourcePath));
            var md = pe.GetMetadataReader();
            var source = Path.GetFileNameWithoutExtension(sourcePath);

            foreach (var handle in md.TypeReferences)
            {
                var assembly = MetadataNames.RootAssembly(md, handle);

                if (!IsTracked(assembly))
                {
                    continue;
                }

                var name = MetadataNames.Of(md, handle);
                checkedCount++;

                if (!_targets.HasType(name))
                {
                    missing.Add($"{source}: TYPE {name} [{assembly}]");
                }
            }

            foreach (var handle in md.TypeDefinitions)
            {
                var type = md.GetTypeDefinition(handle);
                var owner = MetadataNames.Of(md, handle);

                if (!type.BaseType.IsNil)
                {
                    NoteBaseType(md, type.BaseType, $"{source}:{owner}", baseTypes);
                }

                foreach (var implementation in type.GetInterfaceImplementations())
                {
                    NoteBaseType(md, md.GetInterfaceImplementation(implementation).Interface, $"{source}:{owner}", baseTypes);
                }
            }

            foreach (var handle in md.MemberReferences)
            {
                var member = md.GetMemberReference(handle);

                if (member.Parent.Kind != HandleKind.TypeReference && member.Parent.Kind != HandleKind.TypeSpecification)
                {
                    continue;
                }

                var parent = MetadataNames.OpenGeneric(md, (EntityHandle)member.Parent);

                if (parent.Kind != HandleKind.TypeReference
                    || !IsTracked(MetadataNames.RootAssembly(md, (TypeReferenceHandle)parent)))
                {
                    continue;
                }

                var typeName = MetadataNames.Of(md, (TypeReferenceHandle)parent);
                var memberName = md.GetString(member.Name);
                var isMethod = member.GetKind() == MemberReferenceKind.Method;
                var signature = isMethod
                    ? SignatureFormatter.Method(member.DecodeMethodSignature(SignatureFormatter.Instance, null))
                    : SignatureFormatter.Field(member.DecodeFieldSignature(SignatureFormatter.Instance, null));
                checkedCount++;

                if (!_targets.HasType(typeName))
                {
                    missing.Add($"{source}: MEMBER {typeName}::{memberName} {signature} (type missing)");
                }
                else if (!_targets.HasMember(typeName, memberName, signature, isMethod))
                {
                    missing.Add($"{source}: MEMBER {typeName}::{memberName} {signature}");
                }
            }
        }

        return new CheckResult(checkedCount, missing, baseTypes);
    }

    private static void NoteBaseType(MetadataReader md, EntityHandle handle, string owner, ISet<string> baseTypes)
    {
        var open = MetadataNames.OpenGeneric(md, handle);

        if (open.Kind == HandleKind.TypeReference && IsTracked(MetadataNames.RootAssembly(md, (TypeReferenceHandle)open)))
        {
            baseTypes.Add($"{MetadataNames.Of(md, (TypeReferenceHandle)open)}  <=  {owner}");
        }
    }

    private static bool IsTracked(string? assembly)
    {
        return assembly is not null
            && (assembly.StartsWith("Umbraco.", StringComparison.Ordinal) || assembly.StartsWith("NPoco", StringComparison.Ordinal));
    }
}

/// <summary>
/// The type definitions in the target assemblies, by full name, and the assemblies themselves, by name.
/// </summary>
internal sealed class TargetIndex : IDisposable
{
    private readonly List<PEReader> _readers = new();

    private readonly Dictionary<string, (MetadataReader Metadata, TypeDefinitionHandle Handle)> _types = new(StringComparer.Ordinal);

    private readonly Dictionary<string, Version> _assemblies = new(StringComparer.OrdinalIgnoreCase);

    private TargetIndex()
    {
    }

    /// <summary>
    /// The version of each assembly in the target folders, by name. Of two copies, the higher version counts.
    /// </summary>
    public IReadOnlyDictionary<string, Version> Assemblies => _assemblies;

    public static TargetIndex Load(IEnumerable<string> directories)
    {
        var index = new TargetIndex();

        foreach (var path in directories.SelectMany(x => Directory.GetFiles(x, "*.dll")))
        {
            // The readers stay open: the metadata readers read from their images.
            var pe = new PEReader(File.OpenRead(path));

            if (!HasMetadata(pe))
            {
                pe.Dispose();
                continue;
            }

            index._readers.Add(pe);
            var md = pe.GetMetadataReader();

            foreach (var handle in md.TypeDefinitions)
            {
                index._types.TryAdd(MetadataNames.Of(md, handle), (md, handle));
            }

            if (md.IsAssembly)
            {
                var assembly = md.GetAssemblyDefinition();
                var name = md.GetString(assembly.Name);

                if (!index._assemblies.TryGetValue(name, out var version) || version < assembly.Version)
                {
                    index._assemblies[name] = assembly.Version;
                }
            }
        }

        return index;
    }

    public bool HasType(string name)
    {
        return _types.ContainsKey(name);
    }

    /// <summary>
    /// Looks for a method or field with this name and signature on the type or its base types.
    /// </summary>
    public bool HasMember(string typeName, string memberName, string signature, bool isMethod)
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var current = typeName;

        while (current is not null && seen.Add(current) && _types.TryGetValue(current, out var entry))
        {
            var (md, handle) = entry;
            var type = md.GetTypeDefinition(handle);

            if (isMethod ? HasMethod(md, type, memberName, signature) : HasField(md, type, memberName, signature))
            {
                return true;
            }

            // Walk to the base type. Interfaces have none: a member moved to a base interface is missing.
            if (type.BaseType.IsNil)
            {
                break;
            }

            var open = MetadataNames.OpenGeneric(md, type.BaseType);
            current = open.Kind switch
            {
                HandleKind.TypeDefinition => MetadataNames.Of(md, (TypeDefinitionHandle)open),
                HandleKind.TypeReference => MetadataNames.Of(md, (TypeReferenceHandle)open),
                _ => null
            };
        }

        return false;
    }

    public void Dispose()
    {
        foreach (var reader in _readers)
        {
            reader.Dispose();
        }
    }

    private static bool HasMethod(MetadataReader md, TypeDefinition type, string name, string signature)
    {
        foreach (var handle in type.GetMethods())
        {
            var method = md.GetMethodDefinition(handle);

            if (md.GetString(method.Name) == name
                && SignatureFormatter.Method(method.DecodeSignature(SignatureFormatter.Instance, null)) == signature)
            {
                return true;
            }
        }

        return false;
    }

    private static bool HasField(MetadataReader md, TypeDefinition type, string name, string signature)
    {
        foreach (var handle in type.GetFields())
        {
            var field = md.GetFieldDefinition(handle);

            if (md.GetString(field.Name) == name
                && SignatureFormatter.Field(field.DecodeSignature(SignatureFormatter.Instance, null)) == signature)
            {
                return true;
            }
        }

        return false;
    }

    private static bool HasMetadata(PEReader pe)
    {
        try
        {
            return pe.HasMetadata;
        }
        catch (BadImageFormatException)
        {
            // A native library.
            return false;
        }
    }
}
