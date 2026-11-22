using Formulate.Core.FormHandlers;
using Formulate.Core.Submissions.Requests;
using Formulate.Extensions.StoreData.FormHandlers;
using Formulate.Extensions.StoreData.Utilities;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;

namespace Formulate.Extensions.StoreData.Tests;

public sealed class StoreDataFormHandlerTests
{
    [Fact]
    public async Task StoreData_handler_resolves_scoped_services_per_submission()
    {
        var services = new ServiceCollection();
        var scopedInstances = new List<TrackingStoreData>();
        services.AddScoped<IStoreData>(_ =>
        {
            var instance = new TrackingStoreData();
            scopedInstances.Add(instance);
            return instance;
        });

        // Validate scopes, so resolving a scoped service from the root provider fails loudly.
        using var provider = services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true });
        var definition = new StoreDataFormHandlerDefinition(provider.GetRequiredService<IServiceScopeFactory>());
        var handler = Assert.IsAssignableFrom<AsyncFormHandler>(
            definition.CreateHandler(Mock.Of<IFormHandlerSettings>()));

        await handler.HandleAsync(CreateSubmission(), TestContext.Current.CancellationToken);
        await handler.HandleAsync(CreateSubmission(), TestContext.Current.CancellationToken);

        // One scope per submission, each service used while its scope was alive.
        Assert.Equal(2, scopedInstances.Count);
        Assert.NotSame(scopedInstances[0], scopedInstances[1]);
        Assert.All(scopedInstances, x => Assert.Equal(1, x.Calls));
        Assert.All(scopedInstances, x => Assert.False(x.DisposedDuringUse));
        Assert.All(scopedInstances, x => Assert.True(x.Disposed));
    }

    [Fact]
    public async Task StoreData_handler_disposes_services_that_can_only_be_disposed_asynchronously()
    {
        var services = new ServiceCollection();
        var scopedInstances = new List<AsyncOnlyStoreData>();
        services.AddScoped<IStoreData>(_ =>
        {
            var instance = new AsyncOnlyStoreData();
            scopedInstances.Add(instance);
            return instance;
        });

        await using var provider = services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true });
        var definition = new StoreDataFormHandlerDefinition(provider.GetRequiredService<IServiceScopeFactory>());
        var handler = Assert.IsAssignableFrom<AsyncFormHandler>(
            definition.CreateHandler(Mock.Of<IFormHandlerSettings>()));

        // A synchronously disposed scope throws for a service that only implements IAsyncDisposable.
        await handler.HandleAsync(CreateSubmission(), TestContext.Current.CancellationToken);

        var instance = Assert.Single(scopedInstances);
        Assert.Equal(1, instance.Calls);
        Assert.True(instance.Disposed);
    }

    private static FormSubmissionRequest CreateSubmission()
    {
        return new FormSubmissionRequest(
            null!,
            1,
            new Dictionary<Guid, IStringFormFieldValues>(),
            new Dictionary<Guid, IFileFormFieldValues>());
    }

    private sealed class TrackingStoreData : IStoreData, IDisposable
    {
        public int Calls { get; private set; }

        public bool Disposed { get; private set; }

        public bool DisposedDuringUse { get; private set; }

        public Task ExecuteAsync(FormSubmissionRequest submission, CancellationToken cancellationToken)
        {
            Calls++;
            DisposedDuringUse |= Disposed;
            return Task.CompletedTask;
        }

        public void Dispose() => Disposed = true;
    }

    private sealed class AsyncOnlyStoreData : IStoreData, IAsyncDisposable
    {
        public int Calls { get; private set; }

        public bool Disposed { get; private set; }

        public Task ExecuteAsync(FormSubmissionRequest submission, CancellationToken cancellationToken)
        {
            Calls++;
            return Task.CompletedTask;
        }

        public ValueTask DisposeAsync()
        {
            Disposed = true;
            return ValueTask.CompletedTask;
        }
    }
}
