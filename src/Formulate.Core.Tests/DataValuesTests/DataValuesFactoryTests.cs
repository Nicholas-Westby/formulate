namespace Formulate.Core.Tests.DataValuesTests
{
    // Namespaces.
    using DataValues;
    using DataValues.List;
    using Microsoft.Extensions.Logging;
    using Microsoft.Extensions.Logging.Abstractions;
    using System;
    using System.Collections.Generic;
    using Utilities.Internal;
    using Xunit;

    public partial class DataValuesFactoryTests
    {
        [Fact(DisplayName = "When no entity provided should throw an Argument Null Exception")]
        public void WhenNoSettingsProvidedShouldThrowArgumentNullException()
        {
            // arrange
            var factory = CreateFactory();
            PersistedDataValues entity = default;

            // act / asset
            Assert.Throws<ArgumentNullException>(() =>  factory.Create(entity));
        }

        [Fact(DisplayName = "When no KindId matches should return Default")]
        public void WhenNoKindIdMatchesShouldReturnDefault()
        {
            // arrange
            var factory = CreateFactory();
            var entity = new PersistedDataValues()
            {
                KindId = Guid.Parse(Constants.MissingDataValuesKindId)
            };

            // act
            var formField = factory.Create(entity);

            // assert
            Assert.Equal(default, formField);
        }

        [Fact(DisplayName = "When KindId matches a Data Values Definition should return an expected Data Values")]
        public void WhenKindIdMatchesADataValuesDefinitionShouldReturnAnExpectedDataValues()
        {
            // arrange
            var factory = CreateFactory();
            var entity = new PersistedDataValues()
            {
                KindId = Guid.Parse(Constants.TestDataValuesKindId)
            };

            // act
            var formField = factory.Create(entity);

            // assert
            Assert.IsType<TestDataValues>(formField);
            Assert.NotEqual(default, formField);
        }

        [Fact]
        public void Data_values_whose_kind_cannot_read_the_configuration_are_skipped_with_a_warning()
        {
            // The live case from the final review: list items stored as plain strings.
            var logger = new CapturingLogger<DataValuesFactory>();
            var factory = CreateFactory(logger, new ListDataValuesDefinition(new JsonUtility(new NewtonsoftJsonSerializer())));
            var entity = new PersistedDataValues()
            {
                Id = Guid.NewGuid(),
                Name = "Colors",
                KindId = Guid.Parse(ListDataValuesDefinition.Constants.KindId),
                Data = """{"items":["red","green"]}""",
            };

            var dataValues = factory.Create(entity);

            Assert.Null(dataValues);
            var entry = Assert.Single(logger.Entries);
            Assert.Equal(LogLevel.Warning, entry.Level);
            Assert.Contains("Colors", entry.Message);
            Assert.Contains(entity.Id.ToString(), entry.Message);
            Assert.Contains(ListDataValuesDefinition.Constants.Name, entry.Message);
            Assert.NotNull(entry.Exception);
        }

        private static IDataValuesFactory CreateFactory(ILogger<DataValuesFactory> logger = null, params IDataValuesDefinition[] definitions)
        {
            var items = new List<IDataValuesDefinition>()
            {
                new TestDataValuesDefinition()
            };

            items.AddRange(definitions);

            var collection = new DataValuesDefinitionCollection(() => items);

            return new DataValuesFactory(collection, logger ?? NullLogger<DataValuesFactory>.Instance);
        }
    }
}