namespace Formulate.Core.Tests.RecaptchaTests
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Threading;
    using System.Threading.Tasks;
    using Formulate.Core.Configuration;
    using Formulate.Core.FormFields;
    using Formulate.Core.FormFields.Recaptcha;
    using Formulate.Core.FormFields.Text;
    using Formulate.Core.Forms;
    using Formulate.Core.Submissions.Requests;
    using Formulate.Core.Tests.FormFieldTests;
    using Formulate.Core.Utilities.Submissions;
    using Microsoft.Extensions.Logging;
    using Microsoft.Extensions.Options;
    using Microsoft.Extensions.Primitives;
    using Moq;
    using Xunit;

    public class RecaptchaFieldTests
    {
        private const string Secret = "the-secret-key";
        private const string Token = "03AGdBq-the-token";

        private readonly FakeVerifier _verifier = new();
        private readonly CapturingLogger<RecaptchaFieldDefinition> _logger = new();
        private readonly FormulateRecaptchaOptions _options = new() { SiteKey = "the-site-key", SecretKey = Secret };

        private RecaptchaFieldDefinition Definition()
        {
            return new RecaptchaFieldDefinition(Options.Create(_options), _verifier, _logger);
        }

        private RecaptchaField Create(string data = null)
        {
            return Assert.IsType<RecaptchaField>(Definition().CreateField(new TestFieldSettings { Data = data, Id = Guid.NewGuid(), Name = "Robot check" }));
        }

        private static Task<ValidateFormSubmissionRequestOutput> Verify(IFormFieldFactory factory, FormSubmissionRequest request)
        {
            return new VerifyFormSubmissionRequest().VerifyAsync(request, new BuildFormSubmissionFields(factory).Build(request), CancellationToken.None);
        }

        private static IFormFieldValues Posted(params string[] values) => new StringFormFieldValues(new StringValues(values));

        private static string[] Messages(FormFieldValidationResult result) => result.ErrorMessages.ToArray();

        [Fact]
        public void Recaptcha_has_the_formulate_3_kind_id_and_is_not_stored_but_is_not_transitory()
        {
            var definition = Definition();

            Assert.Equal(Guid.Parse("80C0543D419E4DDFAB052C2D052B97A2"), definition.KindId);
            Assert.False(definition.IsStored);
            Assert.False(definition.IsTransitory);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("{}")]
        [InlineData("{\"siteKey\":\"stored-by-v3\"}")]
        public void Recaptcha_reads_no_configuration_or_any_stored_value(string data)
        {
            var field = Create(data);

            // The site key always comes from settings, never from the stored configuration.
            Assert.Equal("the-site-key", field.Configuration.SiteKey);
        }

        [Fact]
        public void Recaptcha_validates_nothing_synchronously()
        {
            // Verification is asynchronous, so the synchronous validation neither calls Google nor fails.
            var field = Create();

            Assert.Empty(field.Validate(Posted(Token)).ErrorMessages);
            Assert.Empty(field.Validate(FormFieldValues.Empty).ErrorMessages);
            Assert.Empty(_verifier.Calls);
        }

        [Fact]
        public async Task Recaptcha_verifies_token_via_verifier()
        {
            _verifier.Result = new RecaptchaVerification(true, Array.Empty<string>());

            var result = await Create().VerifyAsync(Posted(Token), CancellationToken.None);

            Assert.Empty(result.ErrorMessages);
            var call = Assert.Single(_verifier.Calls);
            Assert.Equal((Secret, Token), call);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public async Task Recaptcha_without_keys_fails_with_message(string secret)
        {
            _options.SecretKey = secret;

            var result = await Create().VerifyAsync(Posted(Token), CancellationToken.None);

            Assert.Equal(new[] { RecaptchaField.NotConfiguredMessage }, Messages(result));
            Assert.Empty(_verifier.Calls);
            var warning = Assert.Single(_logger.Entries, x => x.Level == LogLevel.Warning);
            Assert.Contains("Formulate:Recaptcha:SecretKey", warning.Message);
        }

        [Fact]
        public async Task Recaptcha_without_a_token_fails_and_logs()
        {
            foreach (var values in new[] { FormFieldValues.Empty, Posted(), Posted(""), Posted("  "), Posted(Token, "another") })
            {
                _logger.Entries.Clear();

                var result = await Create().VerifyAsync(values, CancellationToken.None);

                Assert.Equal(new[] { RecaptchaField.MissingTokenMessage }, Messages(result));
                Assert.Contains(_logger.Entries, x => x.Level == LogLevel.Information);
            }

            Assert.Empty(_verifier.Calls);
        }

        [Fact]
        public async Task Recaptcha_that_google_refuses_fails_and_logs_the_error_codes()
        {
            _verifier.Result = new RecaptchaVerification(false, new[] { "timeout-or-duplicate", "invalid-input-response" });

            var result = await Create().VerifyAsync(Posted(Token), CancellationToken.None);

            Assert.Equal(new[] { RecaptchaField.FailedMessage }, Messages(result));
            var entry = Assert.Single(_logger.Entries, x => x.Level == LogLevel.Warning);
            Assert.Contains("timeout-or-duplicate", entry.Message);
            Assert.Contains("invalid-input-response", entry.Message);
            Assert.DoesNotContain(Secret, entry.Message);
            Assert.DoesNotContain(Token, entry.Message);
        }

        [Theory]
        [InlineData(typeof(System.Net.Http.HttpRequestException))]
        [InlineData(typeof(TaskCanceledException))]
        [InlineData(typeof(System.IO.InvalidDataException))]
        public async Task Recaptcha_that_cannot_reach_google_fails_closed_and_logs(Type failure)
        {
            _verifier.Failure = (Exception)Activator.CreateInstance(failure, "network down");

            var result = await Create().VerifyAsync(Posted(Token), CancellationToken.None);

            Assert.Equal(new[] { RecaptchaField.UnavailableMessage }, Messages(result));
            var entry = Assert.Single(_logger.Entries, x => x.Level == LogLevel.Error);
            Assert.NotNull(entry.Exception);
            Assert.DoesNotContain(Secret, entry.Message);
        }

        [Fact]
        public async Task A_visitor_leaving_stops_the_verification_instead_of_failing_the_field()
        {
            using var cancelled = new CancellationTokenSource();
            cancelled.Cancel();
            _verifier.Failure = new OperationCanceledException(cancelled.Token);

            await Assert.ThrowsAnyAsync<OperationCanceledException>(() => Create().VerifyAsync(Posted(Token), cancelled.Token));
        }

        [Fact]
        public async Task Verification_runs_only_the_checks_that_need_the_network_and_builds_nothing()
        {
            // Other fields' own validation is not repeated here: the pipeline runs it first and stops at its errors.
            var other = new PersistedFormField { Id = Guid.NewGuid(), KindId = Guid.Parse(TextFieldDefinition.Constants.KindId), Name = "Name" };
            var recaptcha = new PersistedFormField { Id = Guid.NewGuid(), KindId = Guid.Parse(RecaptchaFieldDefinition.Constants.KindId), Name = "Robot check" };
            var factory = new Mock<IFormFieldFactory>();
            factory.Setup(x => x.Create(other)).Returns(new FailingField(other, "Name is required."));
            factory.Setup(x => x.Create(recaptcha)).Returns(Create());
            var request = new FormSubmissionRequest(
                new PersistedForm { Id = Guid.NewGuid(), Fields = new[] { other, recaptcha } }, null,
                new Dictionary<Guid, IStringFormFieldValues> { [recaptcha.Id] = new StringFormFieldValues(Token) },
                new Dictionary<Guid, IFileFormFieldValues>());

            var output = await Verify(factory.Object, request);

            Assert.Empty(output.Errors);
            Assert.Single(_verifier.Calls);

            // Every field is built once per submission, and the verification does not build any again.
            factory.Verify(x => x.Create(other), Times.Once);
            factory.Verify(x => x.Create(recaptcha), Times.Once);
        }

        [Fact]
        public async Task Verification_stops_at_the_first_failure_so_later_tokens_stay_unspent()
        {
            var first = new PersistedFormField { Id = Guid.NewGuid(), KindId = Guid.Parse(RecaptchaFieldDefinition.Constants.KindId), Name = "First check" };
            var second = new PersistedFormField { Id = Guid.NewGuid(), KindId = Guid.Parse(RecaptchaFieldDefinition.Constants.KindId), Name = "Second check" };
            var factory = new Mock<IFormFieldFactory>();
            factory.Setup(x => x.Create(first)).Returns(Create());
            factory.Setup(x => x.Create(second)).Returns(Create());
            _verifier.Result = new RecaptchaVerification(false, new[] { "invalid-input-response" });
            var request = new FormSubmissionRequest(
                new PersistedForm { Id = Guid.NewGuid(), Fields = new[] { first, second } }, null,
                new Dictionary<Guid, IStringFormFieldValues>
                {
                    [first.Id] = new StringFormFieldValues("token-1"),
                    [second.Id] = new StringFormFieldValues("token-2"),
                },
                new Dictionary<Guid, IFileFormFieldValues>());

            var output = await Verify(factory.Object, request);

            Assert.Equal(first.Id, Assert.Single(output.Errors).FieldId);
            Assert.Equal(new[] { (Secret, "token-1") }, _verifier.Calls);
            factory.Verify(x => x.Create(second), Times.Once);
        }

        [Fact]
        public async Task Verification_reports_a_failed_field_by_name_and_id()
        {
            var recaptcha = new PersistedFormField { Id = Guid.NewGuid(), KindId = Guid.Parse(RecaptchaFieldDefinition.Constants.KindId), Name = "Robot check" };
            var factory = new Mock<IFormFieldFactory>();
            factory.Setup(x => x.Create(recaptcha)).Returns(Create());
            _verifier.Result = new RecaptchaVerification(false, new[] { "invalid-input-response" });
            var request = new FormSubmissionRequest(
                new PersistedForm { Id = Guid.NewGuid(), Fields = new[] { recaptcha } }, null,
                new Dictionary<Guid, IStringFormFieldValues> { [recaptcha.Id] = new StringFormFieldValues(Token) },
                new Dictionary<Guid, IFileFormFieldValues>());

            var output = await Verify(factory.Object, request);

            var error = Assert.Single(output.Errors);
            Assert.Equal(recaptcha.Id, error.FieldId);
            Assert.Equal("Robot check", error.FieldName);
            Assert.Equal(new[] { RecaptchaField.FailedMessage }, error.Messages);
        }

        [Fact]
        public async Task Verification_with_no_recaptcha_field_calls_nothing()
        {
            var other = new PersistedFormField { Id = Guid.NewGuid(), KindId = Guid.Parse(TextFieldDefinition.Constants.KindId), Name = "Name" };
            var factory = new Mock<IFormFieldFactory>();
            factory.Setup(x => x.Create(other)).Returns(new FailingField(other, "ignored"));
            var request = new FormSubmissionRequest(
                new PersistedForm { Id = Guid.NewGuid(), Fields = new[] { other } }, null,
                new Dictionary<Guid, IStringFormFieldValues>(), new Dictionary<Guid, IFileFormFieldValues>());

            var output = await Verify(factory.Object, request);

            Assert.Empty(output.Errors);
            Assert.Empty(_verifier.Calls);
        }

        private sealed class FakeVerifier : IRecaptchaVerifier
        {
            public List<(string Secret, string Token)> Calls { get; } = new();

            public RecaptchaVerification Result { get; set; } = new(true, Array.Empty<string>());

            public Exception Failure { get; set; }

            public Task<RecaptchaVerification> VerifyAsync(string secretKey, string token, CancellationToken cancellationToken)
            {
                Calls.Add((secretKey, token));

                return Failure is null ? Task.FromResult(Result) : Task.FromException<RecaptchaVerification>(Failure);
            }
        }

        private sealed class FailingField : FormField
        {
            private readonly string _message;

            public FailingField(IFormFieldSettings settings, string message) : base(settings)
            {
                _message = message;
            }

            public override FormFieldValidationResult Validate(IFormFieldValues values)
            {
                return new FormFieldValidationResult { ErrorMessages = new[] { _message } };
            }
        }
    }
}
