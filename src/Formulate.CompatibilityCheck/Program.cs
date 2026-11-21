// Checks that every Umbraco and NPoco type and member the Formulate assemblies reference exists,
// with the same name and signature, in another Umbraco version's assemblies. It reads metadata only,
// so nothing is loaded or run. A reference it reports as missing is one that throws
// TypeLoadException or MissingMethodException when the package runs on that version, even though
// it compiled against Umbraco 17.
//
// Usage:
//   dotnet run --project src/Formulate.CompatibilityCheck -- <targetDir>[;<targetDir>...] <sourceDll>... [--base-types]
//
//   targetDir     A folder holding the other version's assemblies, such as the dev site built with
//                 dotnet build src/Website -p:UmbracoSiteVersion=18.3.2 -o <tmp>/site18
//                 (Umbraco 19 builds net11.0, so build that one with the .NET 11 SDK).
//   sourceDll     The shipped Formulate*.dll files from a normal (Umbraco 17) build.
//   --base-types  Also list the Umbraco and NPoco base types and interfaces the sources build on.
//                 Those are not checked: review them by hand, because a new abstract member on one
//                 breaks type loading too.
//
// Exit code: 0 when every reference is found, 1 when any is missing, 2 for bad arguments.

namespace Formulate.CompatibilityCheck;

internal static class Program
{
    private const string BaseTypesOption = "--base-types";

    private static int Main(string[] args)
    {
        var listBaseTypes = args.Contains(BaseTypesOption);
        var positional = args.Where(x => x != BaseTypesOption).ToArray();

        if (positional.Length < 2)
        {
            Console.Error.WriteLine("Usage: Formulate.CompatibilityCheck <targetDir>[;<targetDir>...] <sourceDll>... [--base-types]");
            return 2;
        }

        var targetDirectories = positional[0].Split(';', StringSplitOptions.RemoveEmptyEntries);
        var sources = positional.Skip(1).ToArray();
        var notFound = targetDirectories.Where(x => !Directory.Exists(x)).Concat(sources.Where(x => !File.Exists(x))).ToArray();

        if (notFound.Length > 0)
        {
            foreach (var path in notFound)
            {
                Console.Error.WriteLine($"Not found: {path}");
            }

            return 2;
        }

        using var targets = TargetIndex.Load(targetDirectories);
        var result = new ReferenceChecker(targets).Check(sources);

        if (listBaseTypes)
        {
            Console.WriteLine("Umbraco and NPoco base types and interfaces the sources build on (not checked):");
            foreach (var baseType in result.BaseTypes)
            {
                Console.WriteLine("  " + baseType);
            }
        }

        foreach (var missing in result.Missing)
        {
            Console.WriteLine("MISSING " + missing);
        }

        Console.WriteLine(
            $"Checked {result.Checked} Umbraco and NPoco references from {sources.Length} assemblies " +
            $"against {string.Join(";", targetDirectories)}: {result.Missing.Count} missing.");

        return result.Missing.Count == 0 ? 0 : 1;
    }
}
