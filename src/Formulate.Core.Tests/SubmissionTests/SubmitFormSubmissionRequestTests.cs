namespace Formulate.Core.Tests.SubmissionTests
{
    using Formulate.Core.FormHandlers;
    using Formulate.Core.Forms;
    using Formulate.Core.Submissions.Requests;
    using Formulate.Core.Utilities.Submissions;
    using Microsoft.Extensions.Logging;
    using Moq;
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Threading;
    using System.Threading.Tasks;
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
            harness.FailCreate(uninstalled, new NotSupportedException("no definition"));
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

        private sealed class Harness
        {
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

            private Task<bool> SubmitWithToken(FormSubmissionRequest request, CancellationToken cancellationToken)
            {
                var scopeProvider = new Mock<ICoreScopeProvider>() { DefaultValue = DefaultValue.Mock };
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
