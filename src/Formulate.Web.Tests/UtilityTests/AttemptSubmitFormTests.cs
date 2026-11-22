using Formulate.Core.Configuration;
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

            public FormulateSubmissionsOptions Settings { get; } = new FormulateSubmissionsOptions();

            public PersistedFormField Field(string kindId, string name = "Field")
            {
                var field = new PersistedFormField { Id = Guid.NewGuid(), KindId = Guid.Parse(kindId), Name = name };
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
                var submit = new AttemptSubmitForm(forms.Object, definitions, validator.Object, _submitter.Object,
                    Options.Create(Settings), NullLogger<AttemptSubmitForm>.Instance);

                var form = new FormCollection((values ?? Array.Empty<(PersistedFormField, string)>())
                    .ToDictionary(x => x.Field.Id.ToString("N"), x => new StringValues(x.Value)));
                var fileCollection = new FormFileCollection();
                fileCollection.AddRange(files ?? Array.Empty<IFormFile>());

                return submit.SubmitAsync(
                    new AttemptSubmitFormInput(_form.Id, 1, form, fileCollection), CancellationToken.None);
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
