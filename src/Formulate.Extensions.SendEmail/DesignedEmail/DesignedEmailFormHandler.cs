namespace Formulate.Extensions.SendEmail.DesignedEmail
{
    using Formulate.Core.FormHandlers;
    using Formulate.Core.Submissions.Requests;
    using Microsoft.Extensions.DependencyInjection;

    /// <summary>
    /// Sends an email written by Razor views for a Formulate submission.
    /// </summary>
    internal sealed class DesignedEmailFormHandler : AsyncFormHandler
    {
        private readonly IServiceScopeFactory _scopeFactory;

        public DesignedEmailFormHandler(IFormHandlerSettings settings, DesignedEmailConfiguration configuration, IServiceScopeFactory scopeFactory)
            : base(settings)
        {
            Configuration = configuration;
            _scopeFactory = scopeFactory;
        }

        /// <summary>
        /// Gets the handler's configuration.
        /// </summary>
        internal DesignedEmailConfiguration Configuration { get; }

        /// <inheritdoc />
        public override async Task HandleAsync(FormSubmissionRequest submission, CancellationToken cancellationToken = default)
        {
            // The services are scoped (the views can inject scoped services too), so each submission gets
            // its own scope. It is disposed asynchronously, since a scoped service may only implement
            // IAsyncDisposable.
            await using var scope = _scopeFactory.CreateAsyncScope();
            var worker = scope.ServiceProvider.GetRequiredService<DesignedEmailWorker>();

            await worker.SendAsync(submission, this, Configuration, cancellationToken);
        }
    }
}
