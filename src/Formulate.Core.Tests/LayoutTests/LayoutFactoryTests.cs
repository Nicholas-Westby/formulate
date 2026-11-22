using System;
using System.Collections.Generic;
using Formulate.Core.Forms;
using Formulate.Core.Layouts;
using Formulate.Core.Layouts.Basic;
using Formulate.Core.Utilities.Internal;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace Formulate.Core.Tests.LayoutTests
{
    public partial class LayoutFactoryTests
    {
        [Fact(DisplayName = "When no layout provided should throw an Argument Null Exception")]
        public void WhenNoLayoutProvidedShouldThrowArgumentNullException()
        {
            // arrange
            var factory = CreateFactory();
            PersistedLayout layout = default;

            // act / asset
            Assert.Throws<ArgumentNullException>(() => factory.Create(layout));
        }

        [Fact(DisplayName = "When no KindId matches should return Default")]
        public void WhenNoKindIdMatchesShouldReturnDefault()
        {
            // arrange
            var factory = CreateFactory();
            var layout = new PersistedLayout()
            {
                KindId = Guid.Parse(Constants.MissingLayoutKindId)
            };

            // act
            var createdLayout = factory.Create(layout);

            // assert
            Assert.Equal(default, createdLayout);
        }

        [Fact(DisplayName = "When KindId matches a Layout Definition should return an expected Layout")]
        public void WhenKindIdMatchesALayoutDefinitionShouldReturnAnExpectedLayout()
        {
            // arrange
            var factory = CreateFactory();
            var layout = new PersistedLayout()
            {
                KindId = Guid.Parse(Constants.TestLayoutKindId)
            };

            // act
            var createdLayout = factory.Create(layout);

            // assert
            Assert.IsType<TestLayout>(createdLayout);
            Assert.NotEqual(default, createdLayout);
        }

        [Fact]
        public void A_layout_whose_kind_cannot_read_the_configuration_is_skipped_with_a_warning()
        {
            var logger = new CapturingLogger<LayoutFactory>();
            var definition = new BasicLayoutDefinition(Mock.Of<IFormEntityRepository>(), new JsonUtility(new NewtonsoftJsonSerializer()));
            var factory = CreateFactory(logger, definition);
            var layout = new PersistedLayout()
            {
                Id = Guid.NewGuid(),
                Name = "Two columns",
                KindId = Guid.Parse(BasicLayoutDefinition.Constants.KindId),
                Data = "[1]",
            };

            var createdLayout = factory.Create(layout);

            Assert.Null(createdLayout);
            var entry = Assert.Single(logger.Entries);
            Assert.Equal(LogLevel.Warning, entry.Level);
            Assert.Contains("Two columns", entry.Message);
            Assert.Contains(layout.Id.ToString(), entry.Message);
            Assert.Contains(BasicLayoutDefinition.Constants.Name, entry.Message);
            Assert.NotNull(entry.Exception);
        }

        private static ILayoutFactory CreateFactory(ILogger<LayoutFactory> logger = null, params ILayoutDefinition[] definitions)
        {
            var items = new List<ILayoutDefinition>()
            {
                new TestLayoutDefinition()
            };

            items.AddRange(definitions);

            var collection = new LayoutDefinitionCollection(() => items);

            return new LayoutFactory(collection, logger ?? NullLogger<LayoutFactory>.Instance);
        }
    }
}
