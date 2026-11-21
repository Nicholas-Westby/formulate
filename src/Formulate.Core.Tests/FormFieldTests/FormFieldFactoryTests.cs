namespace Formulate.Core.Tests.FormFieldTests
{
    // Namespaces.
    using FormFields;
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

        private static IFormFieldFactory CreateFactory(
            IValidationFactory validationFactory = null,
            IValidationEntityRepository repository = null)
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
                NullLogger<FormFieldFactory>.Instance);
        }
    }
}
