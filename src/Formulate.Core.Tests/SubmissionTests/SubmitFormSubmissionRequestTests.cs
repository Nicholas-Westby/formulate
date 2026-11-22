namespace Formulate.Core.Tests.SubmissionTests
{
    using Formulate.Core.FormHandlers;
    using Formulate.Core.Forms;
    using Formulate.Core.Notifications;
    using Formulate.Core.Submissions.Requests;
    using Formulate.Core.Utilities.Submissions;
    using Microsoft.Extensions.Logging;
    using Moq;
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Threading;
    using System.Threading.Tasks;
    using System.Data;
    using Umbraco.Cms.Core.Events;
    using Umbraco.Cms.Core.Notifications;
    using Umbraco.Cms.Core.Persistence.Repositories;
    using Umbraco.Cms.Core.Scoping;
    using Xunit;

    public class SubmitFormSubmissionRequestTests
    {
        [Fact]
        public async Task Submission_runs_every_enabled_handler_and_succeeds()
        {
            var run = new List<string>();
            var harness = new Harness();
            var request = harness.Request(
                harness.Handler("one", run),
                harness.Handler("two", run),
                harness.Handler("three", run, enabled: false));

            var result = await harness.Submit(request);

            Assert.True(result);
            Assert.Equal(new[] { "one", "two" }, run);
            Assert.Empty(harness.Logger.Entries);
        }

        [Fact]
        public async Task Submission_continues_after_a_handler_throws()
        {
            var run = new List<string>();
            var harness = new Harness();
            var failing = harness.Handler("two", run, throws: new InvalidOperationException("boom"));
            var request = harness.Request(
                harness.Handler("one", run),
                failing,
                harness.Handler("three", run, asyncHandler: true));

            var result = await harness.Submit(request);

            Assert.False(result);
            Assert.Equal(new[] { "one", "three" }, run);
            var entry = Assert.Single(harness.Logger.Entries, x => x.Level == LogLevel.Error);
            Assert.IsType<InvalidOperationException>(entry.Exception);
            Assert.Contains(failing.Id.ToString(), entry.Message);
            Assert.Contains("two", entry.Message);
            Assert.Contains(request.Form.Id.ToString(), entry.Message);
        }

        [Fact]
        public async Task Submission_continues_after_creating_a_handler_throws()
        {
            var run = new List<string>();
            var harness = new Harness();
            var broken = harness.Handler("two", run);
            harness.FailCreate(broken, new InvalidOperationException("cannot build"));
            var request = harness.Request(harness.Handler("one", run), broken, harness.Handler("three", run));

            var result = await harness.Submit(request);

            Assert.False(result);
            Assert.Equal(new[] { "one", "three" }, run);
            Assert.Single(harness.Logger.Entries, x => x.Level == LogLevel.Error);
        }

        [Fact]
        public async Task Submission_runs_every_handler_after_the_visitor_disconnects()
        {
            var run = new List<string>();
            var harness = new Harness();
            var request = harness.Request(
                harness.Handler("one", run, asyncHandler: true),
                harness.Handler("two", run),
                harness.Handler("three", run, asyncHandler: true));

            var result = await harness.SubmitAfterTheVisitorDisconnects(request);

            Assert.True(result);
            Assert.Equal(new[] { "one", "two", "three" }, run);
            Assert.Empty(harness.Logger.Entries);
        }

        [Fact]
        public async Task Submission_skips_handlers_whose_kind_is_not_installed()
        {
            var run = new List<string>();
            var harness = new Harness();
            var uninstalled = harness.Handler("two", run);
            harness.FailCreate(uninstalled, new FormHandlerKindNotFoundException(uninstalled.KindId));
            var request = harness.Request(harness.Handler("one", run), uninstalled, harness.Handler("three", run));

            var result = await harness.Submit(request);

            Assert.True(result);
            Assert.Equal(new[] { "one", "three" }, run);
            Assert.DoesNotContain(harness.Logger.Entries, x => x.Level == LogLevel.Error);
            var entry = Assert.Single(harness.Logger.Entries, x => x.Level == LogLevel.Warning);
            Assert.Contains(request.Form.Id.ToString(), entry.Message);
            Assert.Contains(uninstalled.Id.ToString(), entry.Message);
            Assert.Contains(uninstalled.KindId.ToString(), entry.Message);
        }

        [Fact]
        public async Task Submission_fails_when_an_installed_handler_cannot_be_created()
        {
            var run = new List<string>();
            var harness = new Harness();
            var broken = harness.Handler("two", run);
            harness.FailCreate(broken, new NotSupportedException("thrown by the definition's CreateHandler"));
            var request = harness.Request(harness.Handler("one", run), broken, harness.Handler("three", run));

            var result = await harness.Submit(request);

            Assert.False(result);
            Assert.Equal(new[] { "one", "three" }, run);
            Assert.DoesNotContain(harness.Logger.Entries, x => x.Level == LogLevel.Warning);
            var entry = Assert.Single(harness.Logger.Entries, x => x.Level == LogLevel.Error);
            Assert.IsType<NotSupportedException>(entry.Exception);
        }

        [Fact]
        public async Task Cancelled_submission_runs_no_handlers()
        {
            var run = new List<string>();
            var harness = new Harness();
            harness.OnSubmitting = x => x.CancelSubmission("Submissions are closed.");
            var request = harness.Request(harness.Handler("one", run), harness.Handler("two", run, asyncHandler: true));

            var result = await harness.SubmitForResult(request);

            Assert.False(result.IsSuccessful);
            Assert.True(result.IsCancelled);
            Assert.Equal("Submissions are closed.", result.CancelMessage);
            Assert.Empty(run);
        }

        [Fact]
        public async Task Cancelled_submission_keeps_the_first_message()
        {
            var harness = new Harness();
            harness.OnSubmitting = x =>
            {
                x.CancelSubmission("First.");
                x.CancelSubmission("Second.");
            };

            var result = await harness.SubmitForResult(harness.Request());

            Assert.Equal("First.", result.CancelMessage);
        }

        [Fact]
        public async Task Cancelling_without_a_message_uses_a_default_message()
        {
            var harness = new Harness();
            harness.OnSubmitting = x => x.Cancel = true;

            var result = await harness.SubmitForResult(harness.Request());

            Assert.True(result.IsCancelled);
            Assert.Equal(FormSubmittingNotification.DefaultCancelMessage, result.CancelMessage);
        }

        [Fact]
        public async Task A_submission_nobody_cancels_is_not_cancelled()
        {
            var run = new List<string>();
            var harness = new Harness();
            harness.OnSubmitting = x => { };

            var result = await harness.SubmitForResult(harness.Request(harness.Handler("one", run)));

            Assert.True(result.IsSuccessful);
            Assert.False(result.IsCancelled);
            Assert.Null(result.CancelMessage);
            Assert.Equal(new[] { "one" }, run);
        }

        private sealed class Harness
        {
            public Action<FormSubmittingNotification> OnSubmitting { get; set; }

            private readonly Mock<IFormHandlerFactory> _factory = new Mock<IFormHandlerFactory>();

            public CapturingLogger Logger { get; } = new CapturingLogger();

            public PersistedFormHandler Handler(string name, List<string> run, bool enabled = true,
                Exception throws = null, bool asyncHandler = false)
            {
                var settings = new PersistedFormHandler()
                {
                    Id = Guid.NewGuid(),
                    KindId = Guid.NewGuid(),
                    Name = name,
                    Enabled = enabled
                };
                IFormHandler handler = asyncHandler
                    ? new RecordingAsyncHandler(settings, run, throws)
                    : new RecordingHandler(settings, run, throws);
                _factory.Setup(x => x.Create(settings)).Returns(handler);

                return settings;
            }

            public void FailCreate(PersistedFormHandler settings, Exception exception)
            {
                _factory.Setup(x => x.Create(settings)).Throws(exception);
            }

            public FormSubmissionRequest Request(params PersistedFormHandler[] handlers)
            {
                var form = new PersistedForm() { Id = Guid.NewGuid(), Handlers = handlers };

                return new FormSubmissionRequest(form, 1,
                    new Dictionary<Guid, IStringFormFieldValues>(),
                    new Dictionary<Guid, IFileFormFieldValues>());
            }

            public Task<bool> Submit(FormSubmissionRequest request)
            {
                return SubmitWithToken(request, CancellationToken.None);
            }

            /// <summary>
            /// Submits with the request's token already cancelled, as when the visitor closes the page.
            /// </summary>
            public async Task<bool> SubmitAfterTheVisitorDisconnects(FormSubmissionRequest request)
            {
                using var disconnected = new CancellationTokenSource();
                disconnected.Cancel();

                return await SubmitWithToken(request, disconnected.Token);
            }

            public Task<SubmitFormSubmissionResult> SubmitForResult(FormSubmissionRequest request)
            {
                return SubmitResultWithToken(request, CancellationToken.None);
            }

            private async Task<bool> SubmitWithToken(FormSubmissionRequest request, CancellationToken cancellationToken)
            {
                var result = await SubmitResultWithToken(request, cancellationToken);

                return result.IsSuccessful;
            }

            private Task<SubmitFormSubmissionResult> SubmitResultWithToken(FormSubmissionRequest request, CancellationToken cancellationToken)
            {
                var notifications = new Mock<IScopedNotificationPublisher>();
                notifications
                    .Setup(x => x.Publish(It.IsAny<INotification>()))
                    .Callback<INotification>(x =>
                    {
                        if (x is FormSubmittingNotification submitting)
                        {
                            OnSubmitting?.Invoke(submitting);
                        }
                    });
                var scope = new Mock<ICoreScope>() { DefaultValue = DefaultValue.Mock };
                scope.SetupGet(x => x.Notifications).Returns(notifications.Object);
                var scopeProvider = new Mock<ICoreScopeProvider>();
                scopeProvider
                    .Setup(x => x.CreateCoreScope(It.IsAny<IsolationLevel>(), It.IsAny<RepositoryCacheMode>(), It.IsAny<IEventDispatcher>(), It.IsAny<IScopedNotificationPublisher>(), It.IsAny<bool?>(), It.IsAny<bool>(), It.IsAny<bool>()))
                    .Returns(scope.Object);
                var submitter = new SubmitFormSubmissionRequest(scopeProvider.Object, _factory.Object, Logger);

                return submitter.SubmitAsync(request, cancellationToken);
            }
        }

        private sealed class RecordingHandler : FormHandler
        {
            private readonly List<string> _run;
            private readonly Exception _throws;

            public RecordingHandler(IFormHandlerSettings settings, List<string> run, Exception throws) : base(settings)
            {
                _run = run;
                _throws = throws;
            }

            public override void Handle(FormSubmissionRequest submission)
            {
                if (_throws != null)
                {
                    throw _throws;
                }

                _run.Add(Name);
            }
        }

        private sealed class RecordingAsyncHandler : AsyncFormHandler
        {
            private readonly List<string> _run;
            private readonly Exception _throws;

            public RecordingAsyncHandler(IFormHandlerSettings settings, List<string> run, Exception throws) : base(settings)
            {
                _run = run;
                _throws = throws;
            }

            public override async Task HandleAsync(FormSubmissionRequest submission, CancellationToken cancellationToken = default)
            {
                // Like a real handler's HTTP or database call, stop when the token is cancelled.
                await Task.Delay(1, cancellationToken);

                if (_throws != null)
                {
                    throw _throws;
                }

                _run.Add(Name);
            }
        }

        public sealed class CapturingLogger : ILogger<SubmitFormSubmissionRequest>
        {
            public List<(LogLevel Level, string Message, Exception Exception)> Entries { get; } =
                new List<(LogLevel, string, Exception)>();

            public IDisposable BeginScope<TState>(TState state) => null;

            public bool IsEnabled(LogLevel logLevel) => true;

            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception exception,
                Func<TState, Exception, string> formatter)
            {
                Entries.Add((logLevel, formatter(state, exception), exception));
            }
        }
    }
}
