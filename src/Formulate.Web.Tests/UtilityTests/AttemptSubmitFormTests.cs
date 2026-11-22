using Formulate.Core.FormFields;
using Formulate.Core.FormFields.Header;
using Formulate.Core.FormFields.Hidden;
using Formulate.Core.FormFields.RichText;
using Formulate.Core.FormFields.Text;
using Formulate.Core.FormFields.TextConstant;
using Formulate.Core.FormFields.Upload;
using Formulate.Core.Forms;
using Formulate.Core.Submissions.Requests;
using Formulate.Core.Utilities;
using Formulate.Core.Utilities.Submissions;
using Formulate.Web.Utilities;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Primitives;
using Moq;
using Xunit;

namespace Formulate.Web.Tests.UtilityTests
{
    public class AttemptSubmitFormTests
    {
        [Fact]
        public async Task Values_for_text_constant_fields_are_ignored()
        {
            var site = new Site();
            var constant = site.Field(TextConstantFieldDefinition.Constants.KindId);
            var text = site.Field(TextFieldDefinition.Constants.KindId);

            await site.Submit((constant, "tampered"), (text, "hello"));

            Assert.False(site.Submitted!.FieldValues.ContainsKey(constant.Id));
            Assert.Equal("hello", site.Submitted.FieldValues[text.Id].GetValues().ToString());
        }

        [Fact]
        public async Task Values_for_hidden_fields_are_still_accepted_for_query_string_prefill()
        {
            var site = new Site();
            var hidden = site.Field(HiddenFieldDefinition.Constants.KindId);

            await site.Submit((hidden, "campaign-7"));

            Assert.Equal("campaign-7", site.Submitted!.FieldValues[hidden.Id].GetValues().ToString());
        }

        [Fact]
        public async Task Values_for_header_and_rich_text_fields_are_ignored()
        {
            var site = new Site();
            var header = site.Field(HeaderFieldDefinition.Constants.KindId);
            var richText = site.Field(RichTextFieldDefinition.Constants.KindId);
            var text = site.Field(TextFieldDefinition.Constants.KindId);

            await site.Submit((header, "h"), (richText, "<p>r</p>"), (text, "t"));

            Assert.Equal(new[] { text.Id }, site.Submitted!.FieldValues.Keys);
        }

        [Fact]
        public async Task Values_for_ids_that_are_not_on_the_form_are_ignored()
        {
            var site = new Site();
            var text = site.Field(TextFieldDefinition.Constants.KindId);
            var stranger = new PersistedFormField { Id = Guid.NewGuid(), KindId = Guid.Parse(TextFieldDefinition.Constants.KindId) };

            await site.Submit((text, "t"), (stranger, "x"));

            Assert.Equal(new[] { text.Id }, site.Submitted!.FieldValues.Keys);
        }

        [Fact]
        public async Task Values_for_fields_whose_kind_is_not_installed_are_ignored()
        {
            var site = new Site();
            var unknown = site.Field(Guid.NewGuid().ToString("N"));
            var text = site.Field(TextFieldDefinition.Constants.KindId);

            await site.Submit((unknown, "x"), (text, "t"));

            Assert.Equal(new[] { text.Id }, site.Submitted!.FieldValues.Keys);
        }

        [Fact]
        public async Task Files_for_ids_that_are_not_input_fields_on_the_form_are_ignored()
        {
            var site = new Site();
            var upload = site.Field(UploadFieldDefinition.Constants.KindId);
            var constant = site.Field(TextConstantFieldDefinition.Constants.KindId);
            var stranger = Guid.NewGuid();

            await site.SubmitFiles((upload.Id, "a.txt"), (constant.Id, "b.txt"), (stranger, "c.txt"));

            Assert.Equal(new[] { upload.Id }, site.Submitted!.FilesValues.Keys);
        }

        [Fact]
        public async Task Cancelled_submission_returns_a_failure_with_one_field_less_error()
        {
            var site = new Site();
            site.Result = new SubmitFormSubmissionResult { IsCancelled = true, CancelMessage = "Submissions are closed." };

            var output = await site.Submit();

            Assert.False(output.IsSuccessful);
            var error = Assert.Single(output.Errors);
            Assert.Equal(Guid.Empty, error.FieldId);
            Assert.Equal("", error.FieldName);
            Assert.Equal(new[] { "Submissions are closed." }, error.Messages);
        }

        [Fact]
        public async Task Failed_handlers_return_a_failure_without_errors()
        {
            var site = new Site();
            site.Result = new SubmitFormSubmissionResult { IsSuccessful = false };

            var output = await site.Submit();

            Assert.False(output.IsSuccessful);
            Assert.Empty(output.Errors);
        }

        [Fact]
        public async Task Successful_submission_is_reported()
        {
            var site = new Site();

            var output = await site.Submit();

            Assert.True(output.IsSuccessful);
            Assert.Empty(output.Errors);
        }

        private sealed class Site
        {
            private readonly PersistedForm _form = new PersistedForm { Id = Guid.NewGuid(), Fields = Array.Empty<PersistedFormField>() };
            private readonly Mock<ISubmitFormSubmissionRequest> _submitter = new Mock<ISubmitFormSubmissionRequest>();

            public Site()
            {
                _submitter
                    .Setup(x => x.SubmitAsync(It.IsAny<FormSubmissionRequest>(), It.IsAny<CancellationToken>()))
                    .Callback<FormSubmissionRequest, CancellationToken>((request, _) => Submitted = request)
                    .ReturnsAsync(() => Result);
            }

            public FormSubmissionRequest? Submitted { get; private set; }

            public SubmitFormSubmissionResult Result { get; set; } = new SubmitFormSubmissionResult { IsSuccessful = true };

            public PersistedFormField Field(string kindId)
            {
                var field = new PersistedFormField { Id = Guid.NewGuid(), KindId = Guid.Parse(kindId), Name = "Field" };
                _form.Fields = _form.Fields.Append(field).ToArray();

                return field;
            }

            public Task<AttemptSubmitFormOutput> Submit(params (PersistedFormField Field, string Value)[] values)
            {
                return Run(values, null);
            }

            public Task<AttemptSubmitFormOutput> SubmitFiles(params (Guid FieldId, string Name)[] files)
            {
                return Run(null, files);
            }

            private Task<AttemptSubmitFormOutput> Run(
                (PersistedFormField Field, string Value)[]? values,
                (Guid FieldId, string Name)[]? files)
            {
                var forms = new Mock<IFormEntityRepository>();
                forms.Setup(x => x.Get(_form.Id)).Returns(_form);
                var validator = new Mock<IValidateFormSubmissionRequest>();
                validator
                    .Setup(x => x.Validate(It.IsAny<FormSubmissionRequest>()))
                    .Returns(new ValidateFormSubmissionRequestOutput());
                var json = Mock.Of<IJsonUtility>();
                var definitions = new FormFieldDefinitionCollection(() => new IFormFieldDefinition[]
                {
                    new TextFieldDefinition(),
                    new HiddenFieldDefinition(json),
                    new TextConstantFieldDefinition(json),
                    new HeaderFieldDefinition(json),
                    new RichTextFieldDefinition(json),
                    new UploadFieldDefinition()
                });
                var submit = new AttemptSubmitForm(forms.Object, definitions, validator.Object, _submitter.Object);

                var form = new FormCollection((values ?? Array.Empty<(PersistedFormField, string)>())
                    .ToDictionary(x => x.Field.Id.ToString("N"), x => new StringValues(x.Value)));
                var fileCollection = new FormFileCollection();

                foreach (var (fieldId, name) in files ?? Array.Empty<(Guid, string)>())
                {
                    fileCollection.Add(new FormFile(new MemoryStream(new byte[] { 1, 2, 3 }), 0, 3, fieldId.ToString("N"), name) { Headers = new HeaderDictionary(), ContentType = "text/plain" });
                }

                return submit.SubmitAsync(
                    new AttemptSubmitFormInput(_form.Id, 1, form, fileCollection), CancellationToken.None);
            }
        }
    }
}
