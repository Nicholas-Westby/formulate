namespace Formulate.Extensions.SendData.FormHandlers
{
    using Formulate.Core.FormHandlers;
    using Formulate.Core.Submissions.Requests;
    using Formulate.Extensions.SendData.Utilities;
    using Microsoft.Extensions.DependencyInjection;

    /// <summary>
    /// Sends form submission data to a URL.
    /// </summary>
    internal sealed class SendDataFormHandler : AsyncFormHandler
    {
        private readonly IServiceScopeFactory _scopeFactory;

        public SendDataFormHandler(IFormHandlerSettings settings, SendDataConfiguration configuration, IServiceScopeFactory scopeFactory)
            : base(settings)
        {
            Configuration = configuration;
            _scopeFactory = scopeFactory;
        }

        /// <summary>
        /// Gets the handler's configuration.
        /// </summary>
        internal SendDataConfiguration Configuration { get; }

        /// <inheritdoc />
        public override async Task HandleAsync(FormSubmissionRequest submission, CancellationToken cancellationToken = default)
        {
            // The services are scoped, so each submission gets its own scope.
            await using var scope = _scopeFactory.CreateAsyncScope();
            var worker = scope.ServiceProvider.GetRequiredService<SendDataWorker>();

            await worker.SendAsync(submission, this, Configuration, cancellationToken);
        }
    }
}
