namespace Formulate.Core.Tests.FormFieldTests
{
    // Namespaces.
    using FormFields;
    using Microsoft.Extensions.Logging;
    using Microsoft.Extensions.Logging.Abstractions;
    using Moq;
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using Validations;
    using Xunit;

    public partial class FormFieldFactoryTests
    {
        [Fact(DisplayName = "When no settings provided should throw an Argument Null Exception")]
        public void WhenNoSettingsProvidedShouldThrowArgumentNullException()
        {
            // arrange
            var factory = CreateFactory();
            TestFormFieldSettings settings = default;

            // act / asset
            Assert.Throws<ArgumentNullException>(() => factory.Create(settings));
        }

        [Fact(DisplayName = "When no KindId matches should return Default")]
        public void WhenNoKindIdMatchesShouldReturnDefault()
        {
            // arrange
            var factory = CreateFactory();
            var settings = new TestFormFieldSettings()
            {
                KindId = Guid.Parse(Constants.MissingFormFieldKindId)
            };

            // act
            var formField = factory.Create(settings);

            // assert
            Assert.Equal(default, formField);
        }

        [Fact(DisplayName = "When KindId matches a Form Field Definition should return an expected Form Field")]
        public void WhenKindIdMatchesAFormFieldDefinitionShouldReturnAnExpectedFormField()
        {
            // arrange
            var factory = CreateFactory();
            var settings = new TestFormFieldSettings()
            {
                KindId = Guid.Parse(Constants.TestFormFieldKindId),
                Validations = Array.Empty<Guid>()
            };

            // act
            var formField = factory.Create(settings);

            // assert
            Assert.IsType<TestFormField>(formField);
            Assert.NotEqual(default, formField);
        }

        [Fact]
        public void FormFieldFactory_skips_validations_that_no_longer_exist()
        {
            // arrange
            var existingId = Guid.NewGuid();
            var deletedId = Guid.NewGuid();
            var existing = new PersistedValidation() { Id = existingId };
            var repository = new Mock<IValidationEntityRepository>();
            repository.Setup(x => x.Get(existingId)).Returns(existing);
            repository.Setup(x => x.Get(deletedId)).Returns((PersistedValidation)null);
            var validation = new Mock<IValidation>().Object;
            var validationFactory = new Mock<IValidationFactory>();
            validationFactory.Setup(x => x.Create(existing)).Returns(validation);
            var factory = CreateFactory(validationFactory.Object, repository.Object);
            var settings = new TestFormFieldSettings()
            {
                KindId = Guid.Parse(Constants.TestFormFieldKindId),
                Validations = new[] { deletedId, existingId }
            };

            // act
            var formField = factory.Create(settings);

            // assert
            Assert.Same(validation, Assert.Single(formField.Validations));
        }

        [Fact]
        public void FormFieldFactory_logs_a_warning_for_a_validation_that_no_longer_exists()
        {
            // arrange
            var deletedId = Guid.NewGuid();
            var repository = new Mock<IValidationEntityRepository>();
            repository.Setup(x => x.Get(deletedId)).Returns((PersistedValidation)null);
            var logger = new CapturingLogger();
            var factory = CreateFactory(repository: repository.Object, logger: logger);
            var fieldId = Guid.NewGuid();
            var settings = new TestFormFieldSettings()
            {
                Id = fieldId,
                KindId = Guid.Parse(Constants.TestFormFieldKindId),
                Validations = new[] { deletedId }
            };

            // act
            var formField = factory.Create(settings);

            // assert
            Assert.Empty(formField.Validations);
            var entry = Assert.Single(logger.Entries);
            Assert.Equal(LogLevel.Warning, entry.Level);
            Assert.Contains(fieldId.ToString(), entry.Message);
            Assert.Contains(deletedId.ToString(), entry.Message);
        }

        [Fact]
        public void FormFieldFactory_skips_validations_with_an_unknown_kind()
        {
            // arrange
            var unknownId = Guid.NewGuid();
            var unknown = new PersistedValidation() { Id = unknownId };
            var repository = new Mock<IValidationEntityRepository>();
            repository.Setup(x => x.Get(unknownId)).Returns(unknown);
            var validationFactory = new Mock<IValidationFactory>();
            validationFactory.Setup(x => x.Create(unknown)).Returns((IValidation)null);
            var factory = CreateFactory(validationFactory.Object, repository.Object);
            var settings = new TestFormFieldSettings()
            {
                KindId = Guid.Parse(Constants.TestFormFieldKindId),
                Validations = new[] { unknownId }
            };

            // act
            var formField = factory.Create(settings);

            // assert
            Assert.Empty(formField.Validations);
        }

        private sealed class CapturingLogger : ILogger<FormFieldFactory>
        {
            public List<(LogLevel Level, string Message)> Entries { get; } = new List<(LogLevel, string)>();

            public IDisposable BeginScope<TState>(TState state) => null;

            public bool IsEnabled(LogLevel logLevel) => true;

            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception exception,
                Func<TState, Exception, string> formatter)
            {
                Entries.Add((logLevel, formatter(state, exception)));
            }
        }

        private static IFormFieldFactory CreateFactory(
            IValidationFactory validationFactory = null,
            IValidationEntityRepository repository = null,
            ILogger<FormFieldFactory> logger = null)
        {
            var items = new List<IFormFieldDefinition>()
            {
                new TestFormFieldDefinition()
            };

            var collection = new FormFieldDefinitionCollection(() => items);

            return new FormFieldFactory(
                collection,
                validationFactory ?? Mock.Of<IValidationFactory>(),
                repository ?? Mock.Of<IValidationEntityRepository>(),
                logger ?? NullLogger<FormFieldFactory>.Instance);
        }
    }
}
