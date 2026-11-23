namespace Formulate.Core.Tests.UtilityTests
{
    using System;
    using System.Collections.Generic;
    using Formulate.Core.FormFields;
    using Formulate.Core.FormFields.Text;
    using Formulate.Core.Forms;
    using Formulate.Core.Tests.FormFieldTests;
    using Formulate.Core.Submissions.Requests;
    using Formulate.Core.Utilities.Submissions;
    using Formulate.Core.Validations;
    using Formulate.Core.Validations.Regex;
    using Microsoft.Extensions.Primitives;
    using Moq;
    using Xunit;

    /// <summary>
    /// The messages the server gives for a failed submission have the field's placeholders replaced,
    /// as the page's messages do.
    /// </summary>
    public class ValidateFormSubmissionRequestTests
    {
        private static (FormSubmissionRequest Request, FormSubmissionFields Fields) Setup(IValidation validation, string posted)
        {
            var definition = new TextFieldDefinition();
            var field = Assert.IsType<TextField>(definition.CreateField(new TestFieldSettings
            {
                KindId = definition.KindId,
                Name = "Message",
                Alias = "message",
                Label = "Your message"
            }));
            field.Validations = new[] { validation };

            var persisted = new PersistedFormField { Id = field.Id, KindId = definition.KindId, Name = "Message" };
            var values = new Dictionary<Guid, IStringFormFieldValues>();

            if (posted is not null)
            {
                values[field.Id] = new StringFormFieldValues(new StringValues(posted));
            }

            var request = new FormSubmissionRequest(
                new PersistedForm { Id = Guid.NewGuid(), Fields = new[] { persisted } }, null, values, new Dictionary<Guid, IFileFormFieldValues>());

            return (request, new FormSubmissionFields(new[] { new SubmissionField(persisted, field) }));
        }

        [Fact]
        public void A_mandatory_field_left_empty_gives_the_message_with_the_placeholders_replaced()
        {
            var (request, fields) = Setup(TestFieldSettings.Mandatory("{label} ({NAME}, {alias}) is required."), null);

            var output = new ValidateFormSubmissionRequest().Validate(request, fields);

            var error = Assert.Single(output.Errors);
            Assert.Equal(new[] { "Your message (Message, message) is required." }, error.Messages);
        }

        [Fact]
        public void A_regex_mismatch_gives_the_message_with_the_placeholders_replaced()
        {
            var validation = new RegexValidation(
                Mock.Of<IValidationSettings>(), new RegexValidationConfiguration { Regex = "^\\d+$", Message = "{label} must be digits." });
            var (request, fields) = Setup(validation, "abc");

            var output = new ValidateFormSubmissionRequest().Validate(request, fields);

            var error = Assert.Single(output.Errors);
            Assert.Equal(new[] { "Your message must be digits." }, error.Messages);
        }
    }
}
