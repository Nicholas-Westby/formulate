namespace Formulate.Core.Tests.FormFieldTests
{
    using System;
    using Formulate.Core.FormFields;
    using Formulate.Core.FormFields.Checkbox;
    using Formulate.Core.Submissions.Requests;
    using Microsoft.Extensions.Primitives;
    using Xunit;

    public class CheckboxFieldTests
    {
        private static CheckboxField Create(string data = null)
        {
            var settings = new TestFieldSettings { Data = data, KindId = new CheckboxFieldDefinition().KindId };
            var field = Assert.IsType<CheckboxField>(new CheckboxFieldDefinition().CreateField(settings));
            field.Validations = new[] { TestFieldSettings.Mandatory("Tick the box.") };

            return field;
        }

        private static FormFieldValidationResult Validate(CheckboxField field, params string[] posted)
        {
            return field.Validate(posted.Length == 0 ? FormFieldValues.Empty : new StringFormFieldValues(new StringValues(posted)));
        }

        [Fact]
        public void Checkbox_has_the_formulate_3_kind_id()
        {
            Assert.Equal(Guid.Parse("99C1A656C7A644ACA787C18593327310"), new CheckboxFieldDefinition().KindId);
        }

        [Fact]
        public void Checkbox_required_rejects_unchecked()
        {
            // The renderer always posts "false" for an unticked box, so Mandatory alone would pass.
            Assert.Equal(new[] { "Tick the box." }, Validate(Create(), "false").ErrorMessages);
            Assert.Equal(new[] { "Tick the box." }, Validate(Create(), "FALSE").ErrorMessages);
            Assert.Equal(new[] { "Tick the box." }, Validate(Create(), "").ErrorMessages);
            Assert.Equal(new[] { "Tick the box." }, Validate(Create(), "yes").ErrorMessages);
            Assert.Equal(new[] { "Tick the box." }, Validate(Create()).ErrorMessages);
        }

        [Theory]
        [InlineData("true")]
        [InlineData("True")]
        [InlineData("TRUE")]
        [InlineData("on")]
        [InlineData("On")]
        [InlineData("ON")]
        public void Checkbox_required_accepts_checked(string posted)
        {
            Assert.Empty(Validate(Create(), posted).ErrorMessages);
        }

        [Fact]
        public void A_checkbox_posted_twice_counts_as_checked_when_any_value_is_true_or_on()
        {
            // Pins today's behaviour: the renderer posts one value, so a second one is only a crafted post.
            Assert.Empty(Validate(Create(), "false", "true").ErrorMessages);
            Assert.Empty(Validate(Create(), "on", "false").ErrorMessages);
            Assert.NotEmpty(Validate(Create(), "false", "no").ErrorMessages);
        }

        [Fact]
        public void An_unchecked_checkbox_without_a_validation_is_valid()
        {
            var field = Create();
            field.Validations = Array.Empty<Formulate.Core.Validations.IValidation>();

            Assert.Empty(Validate(field, "false").ErrorMessages);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("{}")]
        [InlineData("{\"anything\":1,\"from\":\"v3\"}")]
        public void Checkbox_reads_no_configuration_or_any_stored_value(string data)
        {
            var field = Create(data);

            Assert.Empty(Validate(field, "true").ErrorMessages);
        }

        [Fact]
        public void Checkbox_definition_has_no_back_office_configuration_and_is_stored()
        {
            var definition = new CheckboxFieldDefinition();

            Assert.True(definition.IsStored);
            Assert.Equal("formulate-checkbox-field", definition.EditorAlias);
            Assert.Null(definition.GetBackOfficeConfiguration(new TestFieldSettings { Data = "{}" }));
        }
    }
}
