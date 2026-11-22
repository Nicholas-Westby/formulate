using System.Reflection;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Notifications;

namespace Website.Composers;

/// <summary>
/// Logs at start-up which Formulate the dev site runs: the version and file of each Formulate assembly it
/// loaded, and the file its back office script is served from.
/// </summary>
/// <remarks>
/// The dev site runs Formulate from source, or with -p:FormulateFromPackages=true from the packed packages
/// (see Website.csproj). These lines tell the two apart: a pack has the version it was packed with (such as
/// 5.0.0-local.g1a2b3c4.20261122093000), and its back office script comes from the package's folder under
/// obj/FormulatePackages. The end-to-end tests read them from the site's log, to check that a run tested the
/// build it asked for. It runs only in the Development environment and is never packed.
///
/// appsettings.Development.json keeps this logger at Information, so the lines are written even when the
/// tests turn the rest of the log down to Warning. That setting lives there, not in an environment variable:
/// the logger's name has dots, and on Linux the shell that starts the site (dash) drops such variables.
/// </remarks>
public sealed class LoadedFormulateComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
    {
        // The host registers its environment as an instance, so it can be read while composing.
        var environment = builder.Services
            .Select(x => x.ImplementationInstance)
            .OfType<IHostEnvironment>()
            .FirstOrDefault();

        if (environment is null || !environment.IsDevelopment())
        {
            return;
        }

        builder.AddNotificationHandler<UmbracoApplicationStartingNotification, LoadedFormulateLogger>();
    }
}

/// <summary>
/// Writes the lines while Umbraco starts, before the site answers requests.
/// </summary>
public sealed class LoadedFormulateLogger(IWebHostEnvironment environment, ILogger<LoadedFormulateLogger> logger)
    : INotificationHandler<UmbracoApplicationStartingNotification>
{
    /// <summary>The back office bundle, at the path the back office loads it from (umbraco-package.json).</summary>
    internal const string BackOfficeScript = "App_Plugins/Formulate/formulate.js";

    public void Handle(UmbracoApplicationStartingNotification notification)
    {
        // Every Formulate assembly has a composer, so Umbraco has loaded them all by now.
        var assemblies = AppDomain.CurrentDomain.GetAssemblies()
            .Where(x => x.GetName().Name?.StartsWith("Formulate.", StringComparison.Ordinal) == true)
            .OrderBy(x => x.GetName().Name, StringComparer.Ordinal);

        foreach (var assembly in assemblies)
        {
            logger.LogInformation(
                "Formulate assembly {FormulateAssembly} {FormulateVersion} is loaded from {FormulateAssemblyLocation}.",
                assembly.GetName().Name,
                assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion,
                assembly.Location);
        }

        // In Development, static web assets are served from where the build found them: the BackOffice
        // project's wwwroot, or the staticwebassets folder of the extracted package.
        var script = environment.WebRootFileProvider.GetFileInfo(BackOfficeScript);

        logger.LogInformation(
            "Formulate's back office script is served from {FormulateBackOfficeScript}.",
            script.Exists ? script.PhysicalPath : "nowhere (not found)");
    }
}
