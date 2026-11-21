namespace Formulate.Core.Tests.FormFieldTests
{
    // Namespaces.
    using System;
    using System.Linq;
    using FormFields;
    using FormFields.RadioButtonList;
    using Moq;
    using Utilities;
    using Xunit;

    public class RadioButtonListFieldDefinitionTests
    {
        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("{}")]
        public void RadioButtonList_with_empty_configuration_creates_field(string data)
        {
            // arrange
            var json = new Mock<IJsonUtility>();

            // Mirrors JsonUtility: blank input gives null, "{}" gives an empty object.
            json.Setup(x => x.Deserialize<RadioButtonListFieldPreValues>(It.IsAny<string>()))
                .Returns((string value) => string.IsNullOrWhiteSpace(value)
                    ? null
                    : new RadioButtonListFieldPreValues());

            var definition = new RadioButtonListFieldDefinition(
                json.Object,
                Mock.Of<IGetDataValuesItemsUtility>());
            var settings = new TestSettings() { Data = data };

            // act
            var field = Assert.IsType<RadioButtonListField>(definition.CreateField(settings));

            // assert
            Assert.Empty(field.Configuration.Items);
            Assert.Null(field.Configuration.Orientation);
        }

        private sealed class TestSettings : IFormFieldSettings
        {
            public Guid KindId { get; set; }
            public Guid Id { get; set; }
            public string Alias { get; set; }
            public string Name { get; set; }
            public string Label { get; set; }
            public string Data { get; set; }
            public string Category { get; set; }
            public Guid[] Validations { get; set; } = Array.Empty<Guid>();
        }
    }
}
