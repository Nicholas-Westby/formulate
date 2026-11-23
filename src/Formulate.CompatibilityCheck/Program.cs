// Checks the Formulate assemblies against another Umbraco version's assemblies. It reads metadata only, so
// nothing is loaded or run. Each problem it reports fails when the package runs on that version, even though
// the package compiled:
//
// - Members. Every Umbraco and NPoco type and member the Formulate assemblies reference must exist there, with
//   the same name and signature. A missing one throws TypeLoadException or MissingMethodException.
// - Assembly versions. The folder must hold every assembly the Formulate assemblies reference, at the
//   referenced version or higher, apart from the .NET shared framework's. .NET does not load a lower version
//   than a reference names. Umbraco 18.0.0 to 18.3.0, for example, ship an older NPoco than 17.8.2 does, so an
//   assembly built against 17.8.2's NPoco fails to load on them.
//
// Usage:
//   dotnet run --project src/Formulate.CompatibilityCheck -- <targetDir>[;<targetDir>...] <sourceDll>... [--base-types]
//
//   targetDir     A folder holding the other version's assemblies, and no package that Formulate brings in,
//                 such as one built with
//                 dotnet build src/Formulate.CompatibilityCheck.UmbracoSite -p:UmbracoSiteVersion=18.0.0 -o <tmp>/site-18.0.0
//                 (Umbraco 19 builds net11.0, so build that one with the .NET 11 SDK). A site with Formulate in
//                 it, such as the dev site, holds what Formulate's packages make NuGet raise, which can hide a
//                 version problem.
//   sourceDll     The shipped Formulate*.dll files from a normal build.
//   --base-types  Also list the Umbraco and NPoco base types and interfaces the sources build on.
//                 Those are not checked: review them by hand, because a new abstract member on one
//                 breaks type loading too.
//
// Exit code: 0 when every reference is met, 1 when any is missing or at a lower version, 2 for bad arguments.

namespace Formulate.CompatibilityCheck;

internal static class Program
{
    private const string BaseTypesOption = "--base-types";

    private static int Main(string[] args)
    {
        return Run(args, Console.Out, Console.Error);
    }

    internal static int Run(string[] args, TextWriter output, TextWriter error)
    {
        var listBaseTypes = args.Contains(BaseTypesOption);
        var positional = args.Where(x => x != BaseTypesOption).ToArray();

        if (positional.Length < 2)
        {
            error.WriteLine("Usage: Formulate.CompatibilityCheck <targetDir>[;<targetDir>...] <sourceDll>... [--base-types]");
            return 2;
        }

        var targetDirectories = positional[0].Split(';', StringSplitOptions.RemoveEmptyEntries);
        var sources = positional.Skip(1).ToArray();
        var notFound = targetDirectories.Where(x => !Directory.Exists(x)).Concat(sources.Where(x => !File.Exists(x))).ToArray();

        if (notFound.Length > 0)
        {
            foreach (var path in notFound)
            {
                error.WriteLine($"Not found: {path}");
            }

            return 2;
        }

        using var targets = TargetIndex.Load(targetDirectories);
        var members = new ReferenceChecker(targets).Check(sources);
        var versions = new AssemblyVersionChecker(targets.Assemblies, SharedFramework.AssemblyNames()).Check(sources);
        var against = string.Join(";", targetDirectories);

        if (listBaseTypes)
        {
            output.WriteLine("Umbraco and NPoco base types and interfaces the sources build on (not checked):");
            foreach (var baseType in members.BaseTypes)
            {
                output.WriteLine("  " + baseType);
            }
        }

        foreach (var missing in members.Missing.Concat(versions.Missing))
        {
            output.WriteLine("MISSING " + missing);
        }

        foreach (var lower in versions.Lower)
        {
            output.WriteLine("LOWER " + lower);
        }

        output.WriteLine(
            $"Checked {members.Checked} Umbraco and NPoco references from {sources.Length} assemblies " +
            $"against {against}: {members.Missing.Count} missing.");
        output.WriteLine(
            $"Checked {versions.Checked} references to assemblies outside the .NET shared framework from {sources.Length} assemblies " +
            $"against {against}: {versions.Missing.Count} missing, {versions.Lower.Count} at a lower version.");

        return members.Missing.Count + versions.Missing.Count + versions.Lower.Count == 0 ? 0 : 1;
    }
}
