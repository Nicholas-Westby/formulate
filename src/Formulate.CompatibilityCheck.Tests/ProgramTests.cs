using Xunit;

namespace Formulate.CompatibilityCheck.Tests;

/// <summary>
/// Runs the whole tool, as CI does, on assemblies written for each test.
/// </summary>
public sealed class ProgramTests : TempFolderTests
{
    [Fact]
    public void Fails_when_the_site_has_a_lower_version_of_an_assembly_a_source_references()
    {
        var site = Folder("site");
        TestAssemblies.Write(site, "NPoco.Abstractions 6.2.0.0");
        var storeData = StoreData("NPoco.Abstractions 6.4.0.0");

        var (exitCode, output) = Run(site, storeData);

        Assert.Equal(1, exitCode);
        Assert.Contains("LOWER Formulate.Extensions.StoreData: ASSEMBLY NPoco.Abstractions 6.4.0.0, the site has 6.2.0.0", output);
        Assert.Contains($"Checked 1 references to assemblies outside the .NET shared framework from 1 assemblies against {site}: 0 missing, 1 at a lower version.", output);
    }

    [Fact]
    public void Fails_when_the_site_does_not_have_an_assembly_a_source_references()
    {
        var site = Folder("site");
        var storeData = StoreData("NPoco.Abstractions 6.4.0.0");

        var (exitCode, output) = Run(site, storeData);

        Assert.Equal(1, exitCode);
        Assert.Contains("MISSING Formulate.Extensions.StoreData: ASSEMBLY NPoco.Abstractions 6.4.0.0", output);
    }

    [Fact]
    public void Passes_when_the_site_has_every_assembly_the_sources_reference_at_that_version_or_higher()
    {
        var site = Folder("site");
        TestAssemblies.Write(site, "NPoco.Abstractions 6.4.1.0");
        var storeData = StoreData("NPoco.Abstractions 6.4.0.0");

        var (exitCode, output) = Run(site, storeData);

        Assert.Equal(0, exitCode);
        Assert.DoesNotContain("MISSING", output);
        Assert.DoesNotContain("LOWER", output);
        Assert.Contains("0 missing, 0 at a lower version.", output);
    }

    private static (int ExitCode, string Output) Run(params string[] args)
    {
        var output = new StringWriter();
        var exitCode = Program.Run(args, output, new StringWriter());

        return (exitCode, output.ToString());
    }

    /// <summary>
    /// Writes a Store Data assembly that references the shared framework and the given assemblies.
    /// </summary>
    private string StoreData(params string[] references)
    {
        return TestAssemblies.Write(
            Folder("formulate"), "Formulate.Extensions.StoreData 5.0.0.0", ["System.Runtime 10.0.0.0", "Microsoft.Extensions.Options 10.0.0.0", .. references]);
    }
}
