using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;

namespace Website.Composers;

/// <summary>
/// Stops the dev site when its standard input ends, if DevSite:StopWhenInputEnds is true.
/// </summary>
/// <remarks>
/// The end-to-end tests start one site for each Playwright worker, with its input a pipe they never write to.
/// Playwright stops a worker's site when the worker finishes. If the worker is killed instead, the pipe closes
/// with it, and this stops the site, so no site is left holding its ports for the next run. It runs only in the
/// Development environment and is never packed.
/// </remarks>
public sealed class DevStopWhenInputEndsComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
    {
        // The host registers its environment as an instance, so it can be read while composing.
        var environment = builder.Services
            .Select(x => x.ImplementationInstance)
            .OfType<IHostEnvironment>()
            .FirstOrDefault();

        if (environment is null || !environment.IsDevelopment() || !builder.Config.GetValue<bool>("DevSite:StopWhenInputEnds"))
        {
            return;
        }

        builder.Services.AddHostedService<DevStopWhenInputEnds>();
    }
}

/// <summary>Reads standard input until it ends, then stops the site.</summary>
internal sealed class DevStopWhenInputEnds(IHostApplicationLifetime lifetime, ILogger<DevStopWhenInputEnds> logger) : IHostedService
{
    public Task StartAsync(CancellationToken cancellationToken)
    {
        // A thread of its own, since a read of standard input blocks until something arrives or the input ends.
        var thread = new Thread(() =>
        {
            try
            {
                using var input = Console.OpenStandardInput();
                var buffer = new byte[256];

                while (input.Read(buffer, 0, buffer.Length) > 0)
                {
                }
            }
            catch (IOException)
            {
                // The input is gone, which is the end of it too.
            }

            logger.LogWarning("The site's standard input has ended, so the site stops: the program that started it has stopped.");
            lifetime.StopApplication();
        })
        {
            IsBackground = true,
            Name = nameof(DevStopWhenInputEnds),
        };

        thread.Start();

        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
