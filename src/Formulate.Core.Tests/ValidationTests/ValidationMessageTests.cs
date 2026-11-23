namespace Formulate.Core.Tests.ValidationTests
{
    using Formulate.Core.FormFields;
    using Formulate.Core.Validations;
    using Moq;
    using Xunit;

    public class ValidationMessageTests
    {
        private static IFormField Field(string label = "First label") =>
            Mock.Of<IFormField>(x => x.Name == "First Name" && x.Alias == "firstName" && x.Label == label);

        [Theory]
        [InlineData("{name}", "First Name")]
        [InlineData("{alias}", "firstName")]
        [InlineData("{label}", "First label")]
        [InlineData("{NAME}", "First Name")]
        [InlineData("{Alias}", "firstName")]
        [InlineData("{LaBeL}", "First label")]
        public void Each_placeholder_is_replaced_in_any_letter_case(string message, string expected)
        {
            Assert.Equal(expected, ValidationMessage.ReplaceFieldTokens(message, Field()));
        }

        [Fact]
        public void Placeholders_are_replaced_within_a_sentence_and_more_than_once()
        {
            Assert.Equal(
                "This field, First Name, is mandatory (First Name).",
                ValidationMessage.ReplaceFieldTokens("This field, {name}, is mandatory ({Name}).", Field()));
        }

        [Fact]
        public void An_escaped_brace_gives_a_literal_brace()
        {
            Assert.Equal("{name}", ValidationMessage.ReplaceFieldTokens("{{}name}", Field()));
        }

        [Fact]
        public void Anything_else_is_left_as_it_is()
        {
            Assert.Equal("{category} {unknown} {} { name }", ValidationMessage.ReplaceFieldTokens("{category} {unknown} {} { name }", Field()));
        }

        [Fact]
        public void A_replaced_value_is_not_searched_for_placeholders_again()
        {
            var field = Mock.Of<IFormField>(x => x.Name == "{alias}" && x.Alias == "a" && x.Label == "l");

            Assert.Equal("{alias}", ValidationMessage.ReplaceFieldTokens("{name}", field));
        }

        [Fact]
        public void A_field_with_no_label_uses_its_name_as_the_page_shows_it()
        {
            Assert.Equal("First Name is required.", ValidationMessage.ReplaceFieldTokens("{label} is required.", Field(label: null)));
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public void A_null_or_empty_message_stays_as_it_is(string message)
        {
            Assert.Equal(message, ValidationMessage.ReplaceFieldTokens(message, Field()));
        }
    }
}
