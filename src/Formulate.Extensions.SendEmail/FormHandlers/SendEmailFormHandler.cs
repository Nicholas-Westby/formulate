namespace Formulate.Extensions.SendEmail.FormHandlers
{
    using Formulate.Core.FormHandlers;
    using Formulate.Core.Submissions.Requests;
    using Formulate.Extensions.SendEmail.Utilities;
    using Microsoft.Extensions.DependencyInjection;

    /// <summary>
    /// Sends an email for a Formulate submission.
    /// </summary>
    internal sealed class SendEmailFormHandler : AsyncFormHandler
    {
        private readonly IServiceScopeFactory _scopeFactory;

        public SendEmailFormHandler(IFormHandlerSettings settings, SendEmailConfiguration configuration, IServiceScopeFactory scopeFactory)
            : base(settings)
        {
            Configuration = configuration;
            _scopeFactory = scopeFactory;
        }

        /// <summary>
        /// Gets the handler's configuration.
        /// </summary>
        internal SendEmailConfiguration Configuration { get; }

        /// <inheritdoc />
        public override async Task HandleAsync(FormSubmissionRequest submission, CancellationToken cancellationToken = default)
        {
            // The services are scoped, so each submission gets its own scope. It is disposed
            // asynchronously, since a scoped service may only implement IAsyncDisposable.
            await using var scope = _scopeFactory.CreateAsyncScope();
            var worker = scope.ServiceProvider.GetRequiredService<SendEmailWorker>();

            await worker.SendAsync(submission, this, Configuration, cancellationToken);
        }
    }
}
