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

        /// <inheritdoc />
        /// <remarks>
        /// The handlers do not get <paramref name="cancellationToken"/>. The submission has arrived, so
        /// a visitor who closes the page must not stop it half way through being stored or sent.
        /// </remarks>
        public async Task<SubmitFormSubmissionResult> SubmitAsync(FormSubmissionRequest input, CancellationToken cancellationToken)
        {
            var notification = NotifySubmission(input);

            if (notification.Cancel)
            {
                var message = string.IsNullOrWhiteSpace(notification.CancelMessage)
                    ? FormSubmittingNotification.DefaultCancelMessage
                    : notification.CancelMessage;

                _logger.LogInformation(
                    "A notification handler cancelled the submission of form {FormId}: {Message}",
                    input.Form?.Id, message);

                return new SubmitFormSubmissionResult()
                {
                    IsSuccessful = false,
                    IsCancelled = true,
                    CancelMessage = message
                };
            }

            var succeeded = await PerformSubmitAsync(notification.Request);

            return new SubmitFormSubmissionResult() { IsSuccessful = succeeded };
        }

        private async Task<bool> PerformSubmitAsync(FormSubmissionRequest input)
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
                    catch (FormHandlerKindNotFoundException)
                    {
                        // The handler's kind is no longer installed, so there is nothing to run. Any
                        // other exception, even a NotSupportedException from the definition, is a failure.
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
                        await asyncFormHandler.HandleAsync(input, CancellationToken.None);
                    }
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
        /// <returns>The notification, which has the potentially modified request and whether it was cancelled.</returns>
        private FormSubmittingNotification NotifySubmission(FormSubmissionRequest input)
        {
            using (var scope = _coreScopeProvider.CreateCoreScope())
            {
                var notification = new FormSubmittingNotification(input);
                scope.Notifications.Publish(notification);
                scope.Complete();

                return notification;
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
