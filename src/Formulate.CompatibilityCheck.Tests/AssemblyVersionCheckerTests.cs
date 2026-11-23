using Xunit;

namespace Formulate.CompatibilityCheck.Tests;

public sealed class AssemblyVersionCheckerTests : TempFolderTests
{
    private static readonly IReadOnlySet<string> NoSharedFramework = new HashSet<string>();

    [Fact]
    public void A_reference_to_a_higher_version_than_the_site_has_is_reported()
    {
        // Formulate 5's first build: Store Data built against NPoco 6.4.0, on an Umbraco 18.0.0 site, which has 6.2.0.
        var storeData = Source("Formulate.Extensions.StoreData 5.0.0.0", "NPoco.Abstractions 6.4.0.0");

        var result = new AssemblyVersionChecker(Site("NPoco.Abstractions 6.2.0.0"), NoSharedFramework).Check([storeData]);

        Assert.Equal(["Formulate.Extensions.StoreData: ASSEMBLY NPoco.Abstractions 6.4.0.0, the site has 6.2.0.0"], result.Lower);
        Assert.Empty(result.Missing);
        Assert.Equal(1, result.Checked);
    }

    [Fact]
    public void A_reference_the_site_has_at_that_version_or_higher_passes()
    {
        var storeData = Source("Formulate.Extensions.StoreData 5.0.0.0", "NPoco.Abstractions 6.2.0.0", "Umbraco.Core 17.7.2.0");

        var result = new AssemblyVersionChecker(Site("NPoco.Abstractions 6.2.0.0", "Umbraco.Core 18.0.0.0"), NoSharedFramework)
            .Check([storeData]);

        Assert.Empty(result.Lower);
        Assert.Empty(result.Missing);
        Assert.Equal(2, result.Checked);
    }

    [Fact]
    public void A_reference_the_site_does_not_have_is_reported()
    {
        var core = Source("Formulate.Core 5.0.0.0", "Newtonsoft.Json 13.0.0.0");

        var result = new AssemblyVersionChecker(Site(), NoSharedFramework).Check([core]);

        Assert.Equal(["Formulate.Core: ASSEMBLY Newtonsoft.Json 13.0.0.0"], result.Missing);
        Assert.Empty(result.Lower);
    }

    [Fact]
    public void A_reference_to_the_shared_framework_is_not_checked()
    {
        // A site gets these from the .NET runtime, not from its own folder.
        var sendEmail = Source(
            "Formulate.Extensions.SendEmail 5.0.0.0", "System.Runtime 10.0.0.0", "Microsoft.CSharp 10.0.0.0", "Microsoft.AspNetCore.Http 10.0.0.0");
        var sharedFramework = new HashSet<string>(["System.Runtime", "Microsoft.CSharp", "Microsoft.AspNetCore.Http"]);

        var result = new AssemblyVersionChecker(Site(), sharedFramework).Check([sendEmail]);

        Assert.Empty(result.Missing);
        Assert.Empty(result.Lower);
        Assert.Equal(0, result.Checked);
    }

    [Fact]
    public void A_reference_to_another_source_is_met_by_that_source()
    {
        // The Formulate assemblies are installed together, so a site has each one at the version being checked.
        var folder = Folder("formulate");
        var core = TestAssemblies.Write(folder, "Formulate.Core 5.0.0.0");
        var web = TestAssemblies.Write(folder, "Formulate.Web 5.0.0.0", "Formulate.Core 5.0.0.0");

        var result = new AssemblyVersionChecker(Site(), NoSharedFramework).Check([core, web]);

        Assert.Empty(result.Missing);
        Assert.Empty(result.Lower);
        Assert.Equal(1, result.Checked);
    }

    [Fact]
    public void Assembly_names_are_matched_whatever_their_case()
    {
        // As .NET matches them when it loads an assembly.
        var storeData = Source("Formulate.Extensions.StoreData 5.0.0.0", "npoco.abstractions 6.2.0.0");

        var result = new AssemblyVersionChecker(Site("NPoco.Abstractions 6.2.0.0"), NoSharedFramework).Check([storeData]);

        Assert.Empty(result.Missing);
        Assert.Empty(result.Lower);
    }

    private static IReadOnlyDictionary<string, Version> Site(params string[] assemblies)
    {
        return assemblies
            .Select(x => x.Split(' '))
            .ToDictionary(x => x[0], x => Version.Parse(x[1]), StringComparer.OrdinalIgnoreCase);
    }

    private string Source(string assembly, params string[] references)
    {
        return TestAssemblies.Write(Folder("formulate"), assembly, references);
    }
}
