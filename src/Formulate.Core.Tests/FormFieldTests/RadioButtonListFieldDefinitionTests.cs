namespace Formulate.Core.Tests.FormFieldTests
{
    // Namespaces.
    using System;
    using System.Linq;
    using FormFields;
    using FormFields.RadioButtonList;
    using Moq;
    using Utilities;
    using Utilities.Internal;
    using Xunit;

    public class RadioButtonListFieldDefinitionTests
    {
        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("  ")]
        [InlineData("{}")]
        public void RadioButtonList_with_empty_configuration_creates_field(string data)
        {
            // arrange
            // The real JSON utility: blank input gives null, "{}" gives an empty object.
            var json = new JsonUtility(new NewtonsoftJsonSerializer());

            var definition = new RadioButtonListFieldDefinition(
                json,
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
