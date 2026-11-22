namespace Formulate.Core.Tests.FormFieldTests
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using Formulate.Core.FormFields.ExtendedRadioButtonList;
    using Formulate.Core.Utilities;
    using Formulate.Core.Utilities.Internal;
    using Moq;
    using Xunit;

    public class ExtendedRadioButtonListFieldDefinitionTests
    {
        private static readonly Guid DataValueId = Guid.Parse("0f8fad5b-d9cb-469f-a165-70867728950e");

        private readonly Mock<IGetDataValuesItemsUtility> _values = new();

        private ExtendedRadioButtonListFieldDefinition Definition()
        {
            return new ExtendedRadioButtonListFieldDefinition(new JsonUtility(new NewtonsoftJsonSerializer()), _values.Object);
        }

        private ExtendedRadioButtonListField Create(string data)
        {
            var settings = new TestFieldSettings { Data = data };

            return Assert.IsType<ExtendedRadioButtonListField>(Definition().CreateField(settings));
        }

        [Fact]
        public void Extended_radio_has_the_formulate_3_kind_id()
        {
            Assert.Equal(Guid.Parse("8B277AF31B1F469897D23900C6621C7D"), Definition().KindId);
        }

        [Theory]
        [InlineData("0f8fad5b-d9cb-469f-a165-70867728950e")]
        [InlineData("0F8FAD5BD9CB469FA16570867728950E")]
        [InlineData("{0f8fad5b-d9cb-469f-a165-70867728950e}")]
        public void Extended_radio_reads_the_v3_configuration(string dataValue)
        {
            _values
                .Setup(x => x.GetValues(DataValueId, It.IsAny<Guid>()))
                .Returns(new[]
                {
                    // The pair list gives the secondary text as the key and the primary text as the value.
                    new KeyValuePair<string, string>("Cheapest", "Basic"),
                    new KeyValuePair<string, string>("Pro", "Pro"),
                });

            var field = Create($"{{\"dataValue\":\"{dataValue}\"}}");

            Assert.Null(field.Configuration.Orientation);
            Assert.Collection(
                field.Configuration.Items,
                item =>
                {
                    Assert.Equal("Basic", item.Value);
                    Assert.Equal("Basic", item.Label);
                    Assert.Equal("Cheapest", item.Description);
                    Assert.False(item.Selected);
                },
                item =>
                {
                    Assert.Equal("Pro", item.Value);
                    Assert.Equal("Pro", item.Label);

                    // As in Formulate 3, a description that repeats the primary text is left out.
                    Assert.Equal(string.Empty, item.Description);
                });
        }

        [Fact]
        public void Extended_radio_maps_pair_list_items()
        {
            _values
                .Setup(x => x.GetValues(DataValueId, It.IsAny<Guid>()))
                .Returns(new[] { new KeyValuePair<string, string>("Small", "S") });

            var field = Create($"{{\"dataValue\":\"{DataValueId}\",\"orientation\":\"horizontal\"}}");

            var item = Assert.Single(field.Configuration.Items);
            Assert.Equal("S", item.Value);
            Assert.Equal("S", item.Label);
            Assert.Equal("Small", item.Description);
            Assert.Equal("horizontal", field.Configuration.Orientation);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("{}")]
        [InlineData("{\"dataValue\":\"\"}")]
        [InlineData("{\"dataValue\":null}")]
        [InlineData("{\"dataValue\":\"not a guid\"}")]
        public void Extended_radio_without_a_data_value_has_no_items_and_says_so(string data)
        {
            var field = Create(data);

            Assert.Empty(field.Configuration.Items);
            Assert.False(field.Configuration.HasDataValue);
            _values.Verify(x => x.GetValues(It.IsAny<Guid>(), It.IsAny<Guid>()), Times.Never);
        }

        [Fact]
        public void An_unknown_data_value_gives_no_items()
        {
            // The utility logs the missing data values and gives no items.
            _values
                .Setup(x => x.GetValues(It.IsAny<Guid>(), It.IsAny<Guid>()))
                .Returns(Array.Empty<KeyValuePair<string, string>>());

            var field = Create($"{{\"dataValue\":\"{Guid.NewGuid()}\"}}");

            Assert.Empty(field.Configuration.Items);
            _values.Verify(x => x.GetValues(It.IsAny<Guid>(), field.Id), Times.Once);
        }

        [Fact]
        public void Back_office_configuration_is_the_stored_one_or_an_empty_one()
        {
            var saved = Assert.IsType<ExtendedRadioButtonListFieldPreValues>(
                Definition().GetBackOfficeConfiguration(new TestFieldSettings { Data = $"{{\"dataValue\":\"{DataValueId}\",\"orientation\":\"vertical\"}}" }));
            var empty = Assert.IsType<ExtendedRadioButtonListFieldPreValues>(
                Definition().GetBackOfficeConfiguration(new TestFieldSettings { Data = null }));
            var v3 = Assert.IsType<ExtendedRadioButtonListFieldPreValues>(
                Definition().GetBackOfficeConfiguration(new TestFieldSettings { Data = "{}" }));

            Assert.Equal(DataValueId, saved.DataValue);
            Assert.Equal("vertical", saved.Orientation);
            Assert.Equal(Guid.Empty, empty.DataValue);
            Assert.Equal(Guid.Empty, v3.DataValue);
        }
    }
}
