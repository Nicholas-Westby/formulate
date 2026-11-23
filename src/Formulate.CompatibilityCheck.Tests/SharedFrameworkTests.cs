using Xunit;

namespace Formulate.CompatibilityCheck.Tests;

public sealed class SharedFrameworkTests
{
    [Fact]
    public void Holds_the_assemblies_of_NET_and_of_ASP_NET_Core()
    {
        var names = SharedFramework.AssemblyNames();

        Assert.Contains("System.Runtime", names);
        // The first version of the check counted this one as missing from the site.
        Assert.Contains("Microsoft.CSharp", names);
        Assert.Contains("Microsoft.AspNetCore.Http.Abstractions", names);
        Assert.Contains("Microsoft.Extensions.Http", names);
    }

    [Fact]
    public void Leaves_out_the_packages_a_site_gets_from_NuGet()
    {
        var names = SharedFramework.AssemblyNames();

        Assert.DoesNotContain("Newtonsoft.Json", names);
        Assert.DoesNotContain("NPoco.Abstractions", names);
        Assert.DoesNotContain("Umbraco.Core", names);
    }
}
