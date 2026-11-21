using System;
using System.Collections.Generic;
using Formulate.Core.FormHandlers;
using Xunit;

namespace Formulate.Core.Tests.FormHandlerTests
{
    public partial class FormHandlerFactoryTests
    {
        [Fact(DisplayName = "When no settings provided should throw an Argument Null Exception")]
        public void WhenNoSettingsProvidedShouldThrowArgumentNullException()
        {
            // arrange
            var factory = CreateFactory();
            TestFormHandlerSettings settings = default;

            // act / asset
            Assert.Throws<ArgumentNullException>(() => factory.Create(settings));
        }

        [Fact(DisplayName = "When no KindId matches should throw a Form Handler Kind Not Found Exception")]
        public void WhenNoKindIdMatchesShouldThrowFormHandlerKindNotFoundException()
        {
            // arrange
            var factory = CreateFactory();
            var settings = new TestFormHandlerSettings()
            {
                KindId = Guid.Parse(Constants.MissingFormHandlerKindId)
            };

            // act
            var exception = Assert.Throws<FormHandlerKindNotFoundException>(() => factory.Create(settings));

            // assert
            Assert.Equal(settings.KindId, exception.KindId);
        }

        [Fact(DisplayName = "When KindId matches a Form Handler Definition should return a Form Handler")]
        public void WhenKindIdMatchesAFormHandlerDefinitionShouldReturnAFormHandler()
        {
            // arrange
            var factory = CreateFactory();
            var settings = new TestFormHandlerSettings()
            {
                KindId = Guid.Parse(Constants.TestFormHandlerKindId)
            };

            // act
            var handler = factory.Create(settings);

            // assert
            Assert.IsAssignableFrom<FormHandler>(handler);
            Assert.NotEqual(default, handler);
        }

        [Fact]
        public void FormHandlerBase_KindId_comes_from_settings_KindId()
        {
            // arrange
            var factory = CreateFactory();
            var id = Guid.Parse("11111111111111111111111111111111");
            var settings = new TestFormHandlerSettings()
            {
                Id = id,
                KindId = Guid.Parse(Constants.TestFormHandlerKindId)
            };

            // act
            var handler = factory.Create(settings);

            // assert
            Assert.Equal(settings.KindId, handler.KindId);
            Assert.Equal(id, handler.Id);
        }

        private static IFormHandlerFactory CreateFactory()
        {
            var items = new List<IFormHandlerDefinition>
            {
                new TestFormHandlerDefinition()
            };

            var collection = new FormHandlerDefinitionCollection(() => items);

            return new FormHandlerFactory(collection);
        }
    }
}
