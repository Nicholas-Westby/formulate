namespace Formulate.Core.Tests.RecaptchaTests
{
    using System;
    using System.Collections.Generic;
    using System.Threading;
    using System.Threading.Tasks;
    using Formulate.Core.FormFields;
    using Formulate.Core.Forms;
    using Formulate.Core.Submissions.Requests;
    using Formulate.Core.Utilities.Submissions;
    using Formulate.Core.Validations;
    using Microsoft.Extensions.Logging.Abstractions;
    using Moq;
    using Xunit;

    /// <summary>
    /// Which built fields the verification step checks, for field kinds third parties write, and that the
    /// pipeline builds each field once.
    /// </summary>
    public class VerifyFormSubmissionRequestTests
    {
        private static FormSubmissionRequest Request(params PersistedFormField[] fields) => new(
            new PersistedForm { Id = Guid.NewGuid(), Fields = fields }, null,
            new Dictionary<Guid, IStringFormFieldValues>(), new Dictionary<Guid, IFileFormFieldValues>());

        private static PersistedFormField Persisted(IFormFieldDefinition definition) => new() { Id = Guid.NewGuid(), KindId = definition.KindId, Name = "Field " + definition.Name };

        /// <summary>The real factory, counting how many times each field is built.</summary>
        private static (IFormFieldFactory Factory, Dictionary<Guid, int> Builds) Factory(params IFormFieldDefinition[] definitions)
        {
            var builds = new Dictionary<Guid, int>();
            var real = new FormFieldFactory(
                new FormFieldDefinitionCollection(() => definitions), Mock.Of<IValidationFactory>(), Mock.Of<IValidationEntityRepository>(), NullLogger<FormFieldFactory>.Instance);
            var counting = new Mock<IFormFieldFactory>();
            counting.Setup(x => x.Create(It.IsAny<IFormFieldSettings>())).Returns((IFormFieldSettings settings) =>
            {
                builds[settings.Id] = builds.GetValueOrDefault(settings.Id) + 1;

                return real.Create(settings);
            });

            return (counting.Object, builds);
        }

        private static async Task<ValidateFormSubmissionRequestOutput> Verify(IFormFieldFactory factory, FormSubmissionRequest request)
        {
            var fields = new BuildFormSubmissionFields(factory).Build(request);

            return await new VerifyFormSubmissionRequest().VerifyAsync(request, fields, CancellationToken.None);
        }

        [Theory]
        [InlineData(true)]
        [InlineData(false)]
        public async Task A_definition_declared_with_a_base_field_type_that_returns_a_verified_subclass_is_verified(bool passes)
        {
            var definition = new BaseDeclaredDefinition(passes);
            var (factory, _) = Factory(definition);

            var output = await Verify(factory, Request(Persisted(definition)));

            Assert.Equal(passes, output.Errors.Count == 0);
        }

        [Theory]
        [InlineData(true)]
        [InlineData(false)]
        public async Task A_definition_declared_with_an_interface_field_type_that_returns_a_verified_subclass_is_verified(bool passes)
        {
            var definition = new InterfaceDeclaredDefinition(passes);
            var (factory, _) = Factory(definition);

            var output = await Verify(factory, Request(Persisted(definition)));

            Assert.Equal(passes, output.Errors.Count == 0);
        }

        [Theory]
        [InlineData(true)]
        [InlineData(false)]
        public async Task A_definition_that_declares_the_verified_type_is_verified(bool passes)
        {
            var definition = new ExactDefinition(passes);
            var (factory, _) = Factory(definition);

            var output = await Verify(factory, Request(Persisted(definition)));

            Assert.Equal(passes, output.Errors.Count == 0);
        }

        [Fact]
        public async Task A_field_that_is_not_verified_passes()
        {
            var definition = new PlainDefinition();
            var (factory, _) = Factory(definition);

            Assert.Empty((await Verify(factory, Request(Persisted(definition)))).Errors);
        }

        [Fact]
        public async Task Verification_stops_at_the_first_failure_for_custom_kinds()
        {
            var definition = new ExactDefinition(false);
            var (factory, _) = Factory(definition);
            var first = Persisted(definition);
            var second = Persisted(definition);
            var request = Request(first, second);
            var fields = new BuildFormSubmissionFields(factory).Build(request);
            ExactDefinition.Verifications = 0;

            var output = await new VerifyFormSubmissionRequest().VerifyAsync(request, fields, CancellationToken.None);

            Assert.Equal(first.Id, Assert.Single(output.Errors).FieldId);
            Assert.Equal(1, ExactDefinition.Verifications);
        }

        [Fact]
        public async Task Each_field_is_built_exactly_once_for_validation_and_verification()
        {
            var definition = new BaseDeclaredDefinition(true);
            var plain = new PlainDefinition();
            var (factory, builds) = Factory(definition, plain);
            var verified = Persisted(definition);
            var other = Persisted(plain);
            var request = Request(verified, other);

            var fields = new BuildFormSubmissionFields(factory).Build(request);
            var validation = new ValidateFormSubmissionRequest().Validate(request, fields);
            var verification = await new VerifyFormSubmissionRequest().VerifyAsync(request, fields, CancellationToken.None);

            Assert.Empty(validation.Errors);
            Assert.Empty(verification.Errors);
            Assert.Equal(1, builds[verified.Id]);
            Assert.Equal(1, builds[other.Id]);
        }

        private sealed class VerifiedField : FormField, IVerifiedFormField
        {
            private readonly bool _passes;

            public VerifiedField(IFormFieldSettings settings, bool passes) : base(settings)
            {
                _passes = passes;
            }

            public Task<FormFieldValidationResult> VerifyAsync(IFormFieldValues values, CancellationToken cancellationToken)
            {
                ExactDefinition.Verifications++;

                return Task.FromResult(new FormFieldValidationResult { ErrorMessages = _passes ? Array.Empty<string>() : new[] { "no" } });
            }
        }

        private sealed class PlainField : FormField
        {
            public PlainField(IFormFieldSettings settings) : base(settings)
            {
            }
        }

        private abstract class TestDefinition<T> : FormFieldDefinitionBase<T> where T : IFormField
        {
            public override Guid KindId { get; } = Guid.NewGuid();
            public override string Name => GetType().Name;
            public override string Icon => "icon-box";
            public override string EditorAlias => "custom";
        }

        private sealed class BaseDeclaredDefinition(bool passes) : TestDefinition<FormField>
        {
            public override FormField CreateField(IFormFieldSettings settings) => new VerifiedField(settings, passes);
        }

        private sealed class InterfaceDeclaredDefinition(bool passes) : TestDefinition<IFormField>
        {
            public override FormField CreateField(IFormFieldSettings settings) => new VerifiedField(settings, passes);
        }

        private sealed class ExactDefinition(bool passes) : TestDefinition<VerifiedField>
        {
            public static int Verifications { get; set; }

            public override FormField CreateField(IFormFieldSettings settings) => new VerifiedField(settings, passes);
        }

        private sealed class PlainDefinition : TestDefinition<PlainField>
        {
            public override FormField CreateField(IFormFieldSettings settings) => new PlainField(settings);
        }
    }
}
