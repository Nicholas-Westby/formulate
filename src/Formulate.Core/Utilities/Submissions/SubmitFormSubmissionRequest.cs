namespace Formulate.Core.Utilities.Submissions
{
    using Formulate.Core.FormHandlers;
    using Formulate.Core.Notifications;
    using Formulate.Core.Submissions.Requests;
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Threading;
    using System.Threading.Tasks;
    using Microsoft.Extensions.Logging;
    using Umbraco.Cms.Core.Scoping;

    internal sealed class SubmitFormSubmissionRequest : ISubmitFormSubmissionRequest
    {
        /// <summary>
        /// The core scope provider.
        /// </summary>
        private readonly ICoreScopeProvider _coreScopeProvider;

        /// <summary>
        /// The form handler factory.
        /// </summary>
        private readonly IFormHandlerFactory _formHandlerFactory;

        /// <summary>
        /// The logger.
        /// </summary>
        private readonly ILogger<SubmitFormSubmissionRequest> _logger;

        public SubmitFormSubmissionRequest(ICoreScopeProvider coreScopeProvider, IFormHandlerFactory formHandlerFactory,
            ILogger<SubmitFormSubmissionRequest> logger)
        {
            _logger = logger;
            _coreScopeProvider = coreScopeProvider;
            _formHandlerFactory = formHandlerFactory;
        }

        public async Task<bool> SubmitAsync(FormSubmissionRequest input, CancellationToken cancellationToken)
        {
            var modifiedInput = NotifySubmission(input);

            return await PerformSubmitAsync(modifiedInput, cancellationToken);
        }

        private async Task<bool> PerformSubmitAsync(FormSubmissionRequest input, CancellationToken cancellationToken)
        {
            var form = input.Form;
            var succeeded = true;

            // Each handler is isolated, so one failing does not stop the others.
            foreach (var settings in GetEnabledHandlers(form.Handlers))
            {
                try
                {
                    IFormHandler item;

                    try
                    {
                        item = _formHandlerFactory.Create(settings);
                    }
                    catch (NotSupportedException)
                    {
                        // The handler's kind is no longer installed, so there is nothing to run.
                        _logger.LogWarning(
                            "Skipping form handler {HandlerId} on form {FormId} because its kind {HandlerKindId} is not installed.",
                            settings.Id, form.Id, settings.KindId);
                        continue;
                    }

                    if (item is FormHandler formHandler)
                    {
                        formHandler.Handle(input);
                    }

                    if (item is AsyncFormHandler asyncFormHandler)
                    {
                        await asyncFormHandler.HandleAsync(input, cancellationToken);
                    }
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    succeeded = false;
                    _logger.LogError(ex,
                        "Form handler {HandlerName} ({HandlerId}) failed on form {FormId}.",
                        settings.Name, settings.Id, form.Id);
                }
            }

            return succeeded;
        }

        /// <summary>
        /// Notifies custom notification handlers that form is being submitted.
        /// </summary>
        /// <param name="input">The request.</param>
        /// <returns>A potentially modified <see cref="FormSubmissionRequest"/>.</returns>
        private FormSubmissionRequest NotifySubmission(FormSubmissionRequest input)
        {
            using (var scope = _coreScopeProvider.CreateCoreScope())
            {
                var notification = new FormSubmittingNotification(input);
                scope.Notifications.Publish(notification);
                scope.Complete();

                return notification.Request;
            }
        }

        private static IReadOnlyCollection<PersistedFormHandler> GetEnabledHandlers(PersistedFormHandler[] items)
        {
            if (items == null)
            {
                return Array.Empty<PersistedFormHandler>();
            }

            return items.Where(x => x.Enabled).ToArray();
        }
    }
}
