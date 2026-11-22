using System;
using System.Collections.Generic;
using Formulate.Core.Utilities.Internal;
using Formulate.Core.Validations;
using Formulate.Core.Validations.Mandatory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Formulate.Core.Tests.ValidationTests
{
    public partial class ValidationFactoryTests
    {
        [Fact(DisplayName = "When no entity provided should throw an Argument Null Exception")]
        public void WhenNoSettingsProvidedShouldThrowArgumentNullException()
        {
            // arrange
            var factory = CreateFactory();
            PersistedValidation entity = default;

            // act / asset
            Assert.Throws<ArgumentNullException>(() => factory.Create(entity));
        }

        [Fact(DisplayName = "When no KindId matches should return Default")]
        public void WhenNoKindIdMatchesShouldReturnDefault()
        {
            // arrange
            var factory = CreateFactory();
            var entity = new PersistedValidation()
            {
                KindId = Guid.Parse(Constants.MissingValidationKindId)
            };

            // act
            var validation = factory.Create(entity);

            // assert
            Assert.Equal(default, validation);
        }

        [Fact(DisplayName = "When KindId matches a Validation Definition should return an expected Validation")]
        public void WhenKindIdMatchesAValidationDefinitionShouldReturnAnExpectedValidation()
        {
            // arrange
            var factory = CreateFactory();
            var entity = new PersistedValidation()
            {
                KindId = Guid.Parse(Constants.TestValidationKindId)
            };

            // act
            var validation = factory.Create(entity);

            // assert
            Assert.IsType<TestValidation>(validation);
            Assert.NotEqual(default, validation);
        }

        [Fact]
        public void A_validation_whose_kind_cannot_read_the_configuration_is_skipped_with_a_warning()
        {
            var logger = new CapturingLogger<ValidationFactory>();
            var factory = CreateFactory(logger, new MandatoryValidationDefinition(new JsonUtility(new NewtonsoftJsonSerializer())));
            var entity = new PersistedValidation()
            {
                Id = Guid.NewGuid(),
                Name = "Required",
                KindId = Guid.Parse(MandatoryValidationDefinition.Constants.KindId),
                Data = "[1,2]",
            };

            var validation = factory.Create(entity);

            Assert.Null(validation);
            var entry = Assert.Single(logger.Entries);
            Assert.Equal(LogLevel.Warning, entry.Level);
            Assert.Contains("Required", entry.Message);
            Assert.Contains(entity.Id.ToString(), entry.Message);
            Assert.Contains(MandatoryValidationDefinition.Constants.Name, entry.Message);
            Assert.NotNull(entry.Exception);
        }

        private static IValidationFactory CreateFactory(ILogger<ValidationFactory> logger = null, params IValidationDefinition[] definitions)
        {
            var items = new List<IValidationDefinition>()
            {
                new TestValidationDefinition()
            };

            items.AddRange(definitions);

            var collection = new ValidationDefinitionCollection(() => items);

            return new ValidationFactory(collection, logger ?? NullLogger<ValidationFactory>.Instance);
        }
    }
}
