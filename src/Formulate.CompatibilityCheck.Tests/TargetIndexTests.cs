using Xunit;

namespace Formulate.CompatibilityCheck.Tests;

public sealed class TargetIndexTests : TempFolderTests
{
    [Fact]
    public void Gives_each_assembly_in_the_folders_at_the_highest_version_found()
    {
        var first = Folder("first");
        var second = Folder("second");
        TestAssemblies.Write(first, "NPoco.Abstractions 6.2.0.0");
        TestAssemblies.Write(second, "NPoco.Abstractions 6.4.0.0");
        TestAssemblies.Write(second, "Umbraco.Core 18.0.0.0");

        using var index = TargetIndex.Load([first, second]);

        Assert.Equal(new Version(6, 4, 0, 0), index.Assemblies["NPoco.Abstractions"]);
        Assert.Equal(new Version(18, 0, 0, 0), index.Assemblies["umbraco.core"]);
        Assert.Equal(2, index.Assemblies.Count);
    }
}
