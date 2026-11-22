using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Cms.Infrastructure.BackgroundJobs;
using Umbraco.Cms.Infrastructure.BackgroundJobs.Jobs;

namespace Website.Composers;

/// <summary>
/// Stops the dev site from reporting to Umbraco's telemetry service.
/// </summary>
/// <remarks>
/// Even at the "Minimal" telemetry level, the lowest Umbraco offers, <see cref="ReportSiteJob"/> sends the
/// site's ID and Umbraco version. The dev site, the end-to-end tests' sites and CI's sites should report
/// nothing, so this removes the job. It runs only in the Development environment and is never packed.
/// </remarks>
public sealed class NoTelemetryComposer : IComposer
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

        // Umbraco registers each recurring job as an IRecurringBackgroundJob, and its hosted service runs
        // every one it finds, so the job is gone once its registration is.
        var jobs = builder.Services
            .Where(x => x.ServiceType == typeof(IRecurringBackgroundJob) && x.ImplementationType == typeof(ReportSiteJob))
            .ToList();

        foreach (var job in jobs)
        {
            builder.Services.Remove(job);
        }

        builder.AddNotificationHandler<UmbracoApplicationStartedNotification, NoTelemetryLogger>();
    }
}

/// <summary>
/// Says at start up whether the telemetry job is gone.
/// </summary>
public sealed class NoTelemetryLogger(IEnumerable<IRecurringBackgroundJob> jobs, ILogger<NoTelemetryLogger> logger)
    : INotificationHandler<UmbracoApplicationStartedNotification>
{
    public void Handle(UmbracoApplicationStartedNotification notification)
    {
        var running = jobs.Any(x => x is ReportSiteJob);

        logger.LogInformation(
            "Umbraco's telemetry job (ReportSiteJob) is {State}.",
            running ? "registered" : "not registered");
    }
}
