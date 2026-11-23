using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Configuration.EnvironmentVariables;

namespace Website;

/// <summary>
/// Loads a developer's own settings file, which git ignores, into the dev site's configuration.
/// </summary>
public static class LocalSettings
{
    /// <summary>
    /// Adds the settings file <paramref name="fileName"/>, if there is one, just before the environment variables, so
    /// that the file overrides appsettings.json, appsettings.Development.json and user secrets, and environment
    /// variables and the command line still override it, as ASP.NET Core orders its own sources. The E2E tests rely
    /// on this: they set the site's settings in the environment, and a developer's file must not change them.
    /// </summary>
    public static void AddLocalSettings(this ConfigurationManager configuration, string fileName)
    {
        // AddJsonFile adds the source last, and gives it the builder's file provider, so it is added there and then
        // moved to just before the environment variables the app reads (the last of its environment variable sources:
        // the first ones, with the DOTNET_ and ASPNETCORE_ prefixes, are the host's own).
        configuration.AddJsonFile(fileName, optional: true, reloadOnChange: true);

        IList<IConfigurationSource> sources = ((IConfigurationBuilder)configuration).Sources;
        var file = sources[^1];
        var environment = sources
            .Select((source, index) => (source, index))
            .LastOrDefault(x => x.source is EnvironmentVariablesConfigurationSource && x.source != file);

        if (environment.source is null)
        {
            return;
        }

        sources.RemoveAt(sources.Count - 1);
        sources.Insert(environment.index, file);
    }
}
