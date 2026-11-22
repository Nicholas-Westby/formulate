namespace Formulate.Web.Utilities
{
    using Formulate.Core.FormFields;
    using Formulate.Core.Forms;
    using Formulate.Core.Submissions.Requests;
    using Formulate.Core.Submissions.Responses;
    using Formulate.Core.Utilities.Submissions;
    using System.Threading.Tasks;
    using Umbraco.Extensions;

    internal sealed class AttemptSubmitForm : IAttemptSubmitForm
    {
        private readonly IFormEntityRepository _formEntityRepository;

        private readonly FormFieldDefinitionCollection _formFieldDefinitions;

        private readonly IValidateFormSubmissionRequest _validateFormSubmissionRequest;

        private readonly ISubmitFormSubmissionRequest _submitFormSubmissionRequest;

        public AttemptSubmitForm(IFormEntityRepository formEntityRepository, FormFieldDefinitionCollection formFieldDefinitions, IValidateFormSubmissionRequest validateFormSubmissionRequest, ISubmitFormSubmissionRequest submitFormSubmissionRequest)
        {
            _formEntityRepository = formEntityRepository;
            _formFieldDefinitions = formFieldDefinitions;
            _validateFormSubmissionRequest = validateFormSubmissionRequest;
            _submitFormSubmissionRequest = submitFormSubmissionRequest;
        }

        public async Task<AttemptSubmitFormOutput> SubmitAsync(AttemptSubmitFormInput input, CancellationToken cancellationToken)
        {
            var form = _formEntityRepository.Get(input.FormId);

            if (form is null)
            {
                return new AttemptSubmitFormOutput()
                {
                    IsSuccessful = false
                };
            }

            // Only fields that take a visitor's input are read. A value posted for any other id is dropped, so
            // a visitor cannot overwrite a Text Constant, add data to a Header, or invent a field.
            var inputFieldIds = GetInputFieldIds(form);

            // Get form values.
            var formValues = new Dictionary<Guid, IStringFormFieldValues>();

            foreach (var key in input.Form.Keys)
            {
                if (Guid.TryParse(key, out var fieldId) == false || inputFieldIds.Contains(fieldId) == false)
                {
                    continue;
                }

                var value = input.Form[key];

                formValues[fieldId] = new StringFormFieldValues(value);
            }

            // Get file values.
            var fileValues = new Dictionary<Guid, IFileFormFieldValues>();

            foreach (var groupedFiles in input.Files.GroupBy(x => x.Name))
            {
                if (Guid.TryParse(groupedFiles.Key, out var fieldId) == false || inputFieldIds.Contains(fieldId) == false)
                {
                    continue;
                }

                var files = new List<FormFileValue>();

                foreach (var file in groupedFiles)
                {
                    using var stream = file.OpenReadStream();
                    using var reader = new BinaryReader(stream);
                    var fileData = reader.ReadBytes((int)stream.Length);
                    var filename = file.FileName;

                    files.Add(new FormFileValue
                    {
                        Data = fileData,
                        Name = filename,
                        ContentType = file.ContentType
                    });
                }

                fileValues[fieldId] = new FilesFormFieldValues(files);
            }

            var payload = new FormSubmissionRequest(form, input.PageId, formValues, fileValues);
            var validationResult = _validateFormSubmissionRequest.Validate(payload);

            if (validationResult.Errors.Any())
            {
                return new AttemptSubmitFormOutput()
                {
                    IsSuccessful = false,
                    Errors = validationResult.Errors.Select(x => new ValidationErrorSubmissionResponse(x.FieldName, x.FieldId, x.Messages)).ToArray()
                };
            }

            // submit payload.
            var submitResult = await _submitFormSubmissionRequest.SubmitAsync(payload, cancellationToken);

            if (submitResult.IsCancelled)
            {
                // The error has no field: it tells the visitor why the form as a whole was refused.
                return new AttemptSubmitFormOutput()
                {
                    IsSuccessful = false,
                    Errors = new[] { new ValidationErrorSubmissionResponse(string.Empty, Guid.Empty, submitResult.CancelMessage) }
                };
            }

            return new AttemptSubmitFormOutput()
            {
                IsSuccessful = submitResult.IsSuccessful
            };
        }

        /// <summary>
        /// Gets the IDs of the form's fields whose values come from the visitor.
        /// </summary>
        /// <remarks>
        /// A field is left out when its definition is server side only (such as Text Constant, whose value comes
        /// from configuration), hidden, or not stored (such as Header and Rich Text). The Hidden field kind is
        /// not "hidden" in this sense: pages fill it from the query string, so it keeps accepting values.
        /// A field whose kind is not installed has no definition to ask, so it is left out too.
        /// </remarks>
        private HashSet<Guid> GetInputFieldIds(PersistedForm form)
        {
            var ids = new HashSet<Guid>();

            foreach (var field in form.Fields ?? Array.Empty<PersistedFormField>())
            {
                var definition = _formFieldDefinitions.FirstOrDefault(x => x.KindId == field.KindId);

                if (definition is null || definition.IsServerSideOnly || definition.IsHidden || definition.IsStored == false)
                {
                    continue;
                }

                ids.Add(field.Id);
            }

            return ids;
        }
    }
}
