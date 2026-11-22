using Formulate.Core.Configuration;
using Formulate.Core.FormFields;
using Formulate.Core.FormFields.Button;
using Formulate.Core.FormFields.Header;
using Formulate.Core.FormFields.Hidden;
using Formulate.Core.FormFields.Recaptcha;
using Formulate.Core.FormFields.RichText;
using Formulate.Core.FormFields.Text;
using Formulate.Core.FormFields.TextConstant;
using Formulate.Core.FormFields.Upload;
using Formulate.Core.Forms;
using Formulate.Core.Submissions.Requests;
using Formulate.Core.Submissions.Responses;
using Formulate.Core.Utilities;
using Formulate.Core.Utilities.Internal;
using Formulate.Core.Utilities.Submissions;
using Formulate.Core.Validations;
using Formulate.Core.Validations.Mandatory;
using Formulate.Web.Utilities;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
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
        public async Task Files_for_fields_that_are_not_upload_fields_are_ignored()
        {
            var site = new Site();
            var upload = site.Field(UploadFieldDefinition.Constants.KindId);
            var text = site.Field(TextFieldDefinition.Constants.KindId);

            await site.SubmitFiles((upload.Id, "a.txt"), (text.Id, "b.txt"));

            Assert.Equal(new[] { upload.Id }, site.Submitted!.FilesValues.Keys);
        }

        [Fact]
        public async Task A_file_over_the_upload_limit_fails_on_its_field_and_no_file_is_read()
        {
            var site = new Site();
            site.Settings.MaxUploadBytes = 1024;
            var photo = site.Field(UploadFieldDefinition.Constants.KindId, "Photo");
            var resume = site.Field(UploadFieldDefinition.Constants.KindId, "Resume");

            // Reading either file throws, so this fails if the pipeline reads one before checking sizes.
            var output = await site.SubmitFiles(Unreadable(photo.Id, "small.png", 10), Unreadable(resume.Id, "cv.pdf", 1025));

            Assert.False(output.IsSuccessful);
            var error = Assert.Single(output.Errors);
            Assert.Equal(resume.Id, error.FieldId);
            Assert.Equal("Resume", error.FieldName);
            Assert.Equal(new[] { "The file for \"Resume\" is too large. Files can be up to 1 KB." }, error.Messages);
            Assert.Null(site.Submitted);
        }

        [Fact]
        public async Task A_file_at_the_upload_limit_is_accepted()
        {
            var site = new Site();
            site.Settings.MaxUploadBytes = 3;
            var upload = site.Field(UploadFieldDefinition.Constants.KindId);

            var output = await site.SubmitFiles((upload.Id, "a.txt"));

            Assert.True(output.IsSuccessful);
            Assert.Equal(new byte[] { 1, 2, 3 }, Assert.Single(site.Submitted!.FilesValues[upload.Id].GetValues()).Data);
        }

        [Fact]
        public async Task Only_the_first_file_of_an_upload_field_is_kept_and_the_others_are_not_read()
        {
            var site = new Site();
            site.Settings.MaxUploadBytes = 1024;
            var upload = site.Field(UploadFieldDefinition.Constants.KindId, "Resume");

            // The later files throw when read, and one is over the limit: neither may be read or refuse the submission.
            var output = await site.SubmitFiles(Readable(upload.Id, "first.pdf"), Unreadable(upload.Id, "second.pdf", 10), Unreadable(upload.Id, "huge.pdf", 1025));

            Assert.True(output.IsSuccessful);
            var file = Assert.Single(site.Submitted!.FilesValues[upload.Id].GetValues());
            Assert.Equal("first.pdf", file.Name);
            Assert.Equal(new byte[] { 1, 2, 3 }, file.Data);
        }

        [Fact]
        public async Task Text_posted_under_an_upload_field_is_ignored()
        {
            var site = new Site();
            var upload = site.Field(UploadFieldDefinition.Constants.KindId);
            var text = site.Field(TextFieldDefinition.Constants.KindId);

            await site.Submit((upload, "not a file"), (text, "t"));

            Assert.Equal(new[] { text.Id }, site.Submitted!.FieldValues.Keys);
        }

        [Fact]
        public async Task A_mandatory_upload_field_with_only_text_posted_fails()
        {
            var site = new Site();
            var upload = site.Field(UploadFieldDefinition.Constants.KindId, "Resume", mandatoryMessage: "Please choose a file.");

            var output = await site.Submit((upload, "not a file"));

            Assert.False(output.IsSuccessful);
            var error = Assert.Single(output.Errors);
            Assert.Equal(upload.Id, error.FieldId);
            Assert.Equal(new[] { "Please choose a file." }, error.Messages);
            Assert.Null(site.Submitted);
        }

        [Fact]
        public async Task A_mandatory_upload_field_with_a_file_passes()
        {
            var site = new Site();
            var upload = site.Field(UploadFieldDefinition.Constants.KindId, "Resume", mandatoryMessage: "Please choose a file.");

            var output = await site.SubmitFiles((upload.Id, "cv.pdf"));

            Assert.True(output.IsSuccessful);
            Assert.Single(site.Submitted!.FilesValues[upload.Id].GetValues());
        }

        [Fact]
        public void The_upload_limit_is_10_MB_unless_set()
        {
            Assert.Equal(10_485_760, new FormulateSubmissionsOptions().MaxUploadBytes);
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

        [Fact]
        public async Task Values_for_button_fields_are_ignored()
        {
            var site = new Site();
            var button = site.Field(ButtonFieldDefinition.Constants.KindId);
            var text = site.Field(TextFieldDefinition.Constants.KindId);

            await site.Submit((button, "Submit"), (text, "t"));

            Assert.Equal(new[] { text.Id }, site.Submitted!.FieldValues.Keys);
        }

        [Fact]
        public async Task The_recaptcha_token_is_accepted_although_the_field_is_not_stored()
        {
            var site = new Site();
            var recaptcha = site.Field(RecaptchaFieldDefinition.Constants.KindId);

            await site.Submit((recaptcha, "the-token"));

            Assert.Equal("the-token", site.Submitted!.FieldValues[recaptcha.Id].GetValues().ToString());
        }

        [Fact]
        public async Task Network_checks_run_after_every_field_is_valid_and_before_the_handlers()
        {
            var site = new Site();
            var text = site.Field(TextFieldDefinition.Constants.KindId);

            var output = await site.Submit((text, "t"));

            Assert.True(output.IsSuccessful);
            site.Verifier.Verify(x => x.VerifyAsync(It.IsAny<FormSubmissionRequest>(), It.IsAny<FormSubmissionFields>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Network_checks_do_not_run_when_another_field_is_invalid()
        {
            // Tokens are single use, so one is not spent on a form that will be sent back to the visitor.
            var site = new Site();
            var text = site.Field(TextFieldDefinition.Constants.KindId, "Name", mandatoryMessage: "Name is required.");

            var output = await site.Submit((text, ""));

            Assert.False(output.IsSuccessful);
            Assert.Equal("Name is required.", Assert.Single(output.Errors!).Messages.Single());
            site.Verifier.Verify(x => x.VerifyAsync(It.IsAny<FormSubmissionRequest>(), It.IsAny<FormSubmissionFields>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task A_failed_network_check_returns_its_errors_and_runs_no_handlers()
        {
            var site = new Site();
            var recaptcha = site.Field(RecaptchaFieldDefinition.Constants.KindId, "Robot check");
            site.VerifyOutput = new ValidateFormSubmissionRequestOutput
            {
                Errors = new[] { new ValidationErrorSubmissionResponse("Robot check", recaptcha.Id, "The reCAPTCHA failed.") }
            };

            var output = await site.Submit((recaptcha, "the-token"));

            Assert.False(output.IsSuccessful);
            var error = Assert.Single(output.Errors!);
            Assert.Equal(recaptcha.Id, error.FieldId);
            Assert.Equal("The reCAPTCHA failed.", error.Messages.Single());
            Assert.Null(site.Submitted);
        }

        private sealed class Site
        {
            private readonly PersistedForm _form = new PersistedForm { Id = Guid.NewGuid(), Fields = Array.Empty<PersistedFormField>() };
            private readonly Mock<ISubmitFormSubmissionRequest> _submitter = new Mock<ISubmitFormSubmissionRequest>();
            private readonly Dictionary<Guid, PersistedValidation> _validations = new Dictionary<Guid, PersistedValidation>();

            public Site()
            {
                Verifier
                    .Setup(x => x.VerifyAsync(It.IsAny<FormSubmissionRequest>(), It.IsAny<FormSubmissionFields>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync(() => VerifyOutput);

                _submitter
                    .Setup(x => x.SubmitAsync(It.IsAny<FormSubmissionRequest>(), It.IsAny<CancellationToken>()))
                    .Callback<FormSubmissionRequest, CancellationToken>((request, _) => Submitted = request)
                    .ReturnsAsync(() => Result);
            }

            public FormSubmissionRequest? Submitted { get; private set; }

            /// <summary>The network checks that run once every field is valid.</summary>
            public Mock<IVerifyFormSubmissionRequest> Verifier { get; } = new Mock<IVerifyFormSubmissionRequest>();

            public ValidateFormSubmissionRequestOutput VerifyOutput { get; set; } = new ValidateFormSubmissionRequestOutput();

            public SubmitFormSubmissionResult Result { get; set; } = new SubmitFormSubmissionResult { IsSuccessful = true };

            public FormulateSubmissionsOptions Settings { get; } = new FormulateSubmissionsOptions();

            /// <summary>
            /// Adds a field to the form. A field given a mandatory message gets a Mandatory validation, and
            /// the submission is then validated by Formulate's real validator instead of one that accepts all.
            /// </summary>
            public PersistedFormField Field(string kindId, string name = "Field", string? mandatoryMessage = null)
            {
                var field = new PersistedFormField { Id = Guid.NewGuid(), KindId = Guid.Parse(kindId), Name = name };

                if (mandatoryMessage is not null)
                {
                    var validation = new PersistedValidation
                    {
                        Id = Guid.NewGuid(),
                        Name = "Required",
                        KindId = Guid.Parse(MandatoryValidationDefinition.Constants.KindId),
                        Data = System.Text.Json.JsonSerializer.Serialize(new { message = mandatoryMessage }),
                    };
                    _validations[validation.Id] = validation;
                    field.Validations = new[] { validation.Id };
                }

                _form.Fields = _form.Fields.Append(field).ToArray();

                return field;
            }

            public Task<AttemptSubmitFormOutput> Submit(params (PersistedFormField Field, string Value)[] values)
            {
                return Run(values, null);
            }

            public Task<AttemptSubmitFormOutput> SubmitFiles(params (Guid FieldId, string Name)[] files)
            {
                return Run(null, files.Select(x => Readable(x.FieldId, x.Name)).ToArray());
            }

            public Task<AttemptSubmitFormOutput> SubmitFiles(params IFormFile[] files)
            {
                return Run(null, files);
            }

            private Task<AttemptSubmitFormOutput> Run(
                (PersistedFormField Field, string Value)[]? values,
                IFormFile[]? files)
            {
                var forms = new Mock<IFormEntityRepository>();
                forms.Setup(x => x.Get(_form.Id)).Returns(_form);
                var json = Mock.Of<IJsonUtility>();
                var definitions = new FormFieldDefinitionCollection(() => new IFormFieldDefinition[]
                {
                    new TextFieldDefinition(),
                    new HiddenFieldDefinition(json),
                    new TextConstantFieldDefinition(json),
                    new HeaderFieldDefinition(json),
                    new RichTextFieldDefinition(json),
                    new UploadFieldDefinition(),
                    new ButtonFieldDefinition(json),
                    new RecaptchaFieldDefinition(Options.Create(new FormulateRecaptchaOptions()), Mock.Of<IRecaptchaVerifier>(), NullLogger<RecaptchaFieldDefinition>.Instance)
                });
                var submit = new AttemptSubmitForm(forms.Object, definitions, BuildFields(definitions), Validator(definitions), Verifier.Object, _submitter.Object,
                    Options.Create(Settings), NullLogger<AttemptSubmitForm>.Instance);

                var form = new FormCollection((values ?? Array.Empty<(PersistedFormField, string)>())
                    .ToDictionary(x => x.Field.Id.ToString("N"), x => new StringValues(x.Value)));
                var fileCollection = new FormFileCollection();
                fileCollection.AddRange(files ?? Array.Empty<IFormFile>());

                return submit.SubmitAsync(
                    new AttemptSubmitFormInput(_form.Id, 1, form, fileCollection), CancellationToken.None);
            }

            private FormFieldFactory Fields(FormFieldDefinitionCollection definitions)
            {
                var json = new JsonUtility(new NewtonsoftJsonSerializer());
                var validationFactory = new ValidationFactory(
                    new ValidationDefinitionCollection(() => new IValidationDefinition[] { new MandatoryValidationDefinition(json) }),
                    NullLogger<ValidationFactory>.Instance);
                var validations = new Mock<IValidationEntityRepository>();
                validations.Setup(x => x.Get(It.IsAny<Guid>())).Returns((Guid id) => _validations.GetValueOrDefault(id)!);

                return new FormFieldFactory(definitions, validationFactory, validations.Object, NullLogger<FormFieldFactory>.Instance);
            }

            private IBuildFormSubmissionFields BuildFields(FormFieldDefinitionCollection definitions)
            {
                return new BuildFormSubmissionFields(Fields(definitions));
            }

            private IValidateFormSubmissionRequest Validator(FormFieldDefinitionCollection definitions)
            {
                if (_validations.Count == 0)
                {
                    var accepting = new Mock<IValidateFormSubmissionRequest>();
                    accepting
                        .Setup(x => x.Validate(It.IsAny<FormSubmissionRequest>(), It.IsAny<FormSubmissionFields>()))
                        .Returns(new ValidateFormSubmissionRequestOutput());

                    return accepting.Object;
                }

                return new ValidateFormSubmissionRequest();
            }
        }

        /// <summary>
        /// A posted 3-byte file (1, 2, 3).
        /// </summary>
        private static IFormFile Readable(Guid fieldId, string name)
        {
            return new FormFile(new MemoryStream(new byte[] { 1, 2, 3 }), 0, 3, fieldId.ToString("N"), name) { Headers = new HeaderDictionary(), ContentType = "text/plain" };
        }

        /// <summary>
        /// A posted file of the given length whose contents throw when read.
        /// </summary>
        private static IFormFile Unreadable(Guid fieldId, string name, long length)
        {
            return new FormFile(new UnreadableStream(), 0, length, fieldId.ToString("N"), name) { Headers = new HeaderDictionary(), ContentType = "application/octet-stream" };
        }

        private sealed class UnreadableStream : Stream
        {
            public override bool CanRead => true;

            public override bool CanSeek => true;

            public override bool CanWrite => false;

            public override long Length => long.MaxValue;

            public override long Position { get; set; }

            public override int Read(byte[] buffer, int offset, int count) => throw new InvalidOperationException("The file was read.");

            public override long Seek(long offset, SeekOrigin origin) => Position = offset;

            public override void Flush()
            {
            }

            public override void SetLength(long value) => throw new NotSupportedException();

            public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        }
    }
}
