namespace Formulate.Extensions.StoreData.FormHandlers
{
    using Formulate.Core.FormHandlers;
    using Formulate.Core.Submissions.Requests;
    using Formulate.Extensions.StoreData.Utilities;
    using Microsoft.Extensions.DependencyInjection;
    using System.Threading;
    using System.Threading.Tasks;

    /// <summary>
    /// Stores form submission data to the database.
    /// </summary>
    internal sealed class StoreDataFormHandler : AsyncFormHandler
    {
        private readonly IServiceScopeFactory _scopeFactory;

        public StoreDataFormHandler(IFormHandlerSettings settings, IServiceScopeFactory scopeFactory) : base(settings)
        {
            _scopeFactory = scopeFactory;
        }

        public override async Task HandleAsync(FormSubmissionRequest submission,
            CancellationToken cancellationToken = default)
        {
            // The store is scoped (it uses the database), so each submission gets its own scope.
            using var scope = _scopeFactory.CreateScope();
            var storeData = scope.ServiceProvider.GetRequiredService<IStoreData>();

            await storeData.ExecuteAsync(submission, cancellationToken);
        }
    }
}
