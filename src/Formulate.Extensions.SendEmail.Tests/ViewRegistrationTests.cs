using Microsoft.AspNetCore.Mvc.ApplicationParts;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Formulate.Extensions.SendEmail.Tests;

/// <summary>
/// A site's build does not list Formulate's email library as an MVC application part, so the library
/// adds itself, which lets Razor find the Designed Email samples.
/// </summary>
public sealed class ViewRegistrationTests
{
    [Fact]
    public void Email_views_are_added_once_after_the_sites_own_parts()
    {
        var site = typeof(ViewRegistrationTests).Assembly;
        var library = typeof(SendEmailComposer).Assembly;
        var services = new ServiceCollection();
        var manager = services.AddMvcCore().PartManager;
        manager.ApplicationParts.Clear();
        manager.ApplicationParts.Add(new AssemblyPart(site));

        services.AddFormulateSendEmail();
        services.AddFormulateSendEmail();

        var assemblyParts = manager.ApplicationParts.OfType<AssemblyPart>().Select(x => x.Assembly).ToArray();
        Assert.Equal(new[] { site, library }, assemblyParts);
        Assert.Single(manager.ApplicationParts.OfType<CompiledRazorAssemblyPart>(), x => x.Assembly == library);
    }
}
