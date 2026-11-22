namespace Formulate.Web.Utilities
{
    using Formulate.Core.Configuration;
    using Formulate.Core.FormFields;
    using Formulate.Core.FormFields.Upload;
    using Formulate.Core.Forms;
    using Formulate.Core.Submissions.Requests;
    using Formulate.Core.Submissions.Responses;
    using Formulate.Core.Utilities.Submissions;
    using Microsoft.AspNetCore.Http;
    using Microsoft.Extensions.Logging;
    using Microsoft.Extensions.Options;
    using System.Threading.Tasks;
    using Umbraco.Extensions;

    internal sealed class AttemptSubmitForm : IAttemptSubmitForm
    {
        private static readonly Guid UploadKindId = Guid.Parse(UploadFieldDefinition.Constants.KindId);

        private readonly IFormEntityRepository _formEntityRepository;

        private readonly FormFieldDefinitionCollection _formFieldDefinitions;

        private readonly IValidateFormSubmissionRequest _validateFormSubmissionRequest;

        private readonly ISubmitFormSubmissionRequest _submitFormSubmissionRequest;

        private readonly IOptions<FormulateSubmissionsOptions> _options;

        private readonly ILogger<AttemptSubmitForm> _logger;

        public AttemptSubmitForm(IFormEntityRepository formEntityRepository, FormFieldDefinitionCollection formFieldDefinitions, IValidateFormSubmissionRequest validateFormSubmissionRequest, ISubmitFormSubmissionRequest submitFormSubmissionRequest,
            IOptions<FormulateSubmissionsOptions> options, ILogger<AttemptSubmitForm> logger)
        {
            _formEntityRepository = formEntityRepository;
            _formFieldDefinitions = formFieldDefinitions;
            _validateFormSubmissionRequest = validateFormSubmissionRequest;
            _submitFormSubmissionRequest = submitFormSubmissionRequest;
            _options = options;
            _logger = logger;
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

            // Get file values. Only upload fields take files, one each, and every kept file's size is checked
            // before any file is read into memory.
            var postedFiles = GetUploadedFiles(form, inputFieldIds, input.Files);
            var maxBytes = _options.Value.MaxUploadBytes;
            var tooLarge = postedFiles.Where(x => x.File.Length > maxBytes).Select(x => x.Field).Distinct().ToArray();

            if (tooLarge.Length > 0)
            {
                foreach (var field in tooLarge)
                {
                    _logger.LogInformation(
                        "Refused a submission of form {FormId} because a file for field {FieldId} ({FieldName}) is over Formulate:Submissions:MaxUploadBytes ({MaxUploadBytes} bytes).",
                        form.Id, field.Id, field.Name, maxBytes);
                }

                return new AttemptSubmitFormOutput()
                {
                    IsSuccessful = false,
                    Errors = tooLarge
                        .Select(x => new ValidationErrorSubmissionResponse(x.Name, x.Id, $"The file for \"{x.Name}\" is too large. Files can be up to {UploadSizes.Describe(maxBytes)}."))
                        .ToArray()
                };
            }

            var fileValues = new Dictionary<Guid, IFileFormFieldValues>();

            foreach (var group in postedFiles.GroupBy(x => x.Field.Id))
            {
                var files = new List<FormFileValue>();

                foreach (var (_, file) in group)
                {
                    files.Add(new FormFileValue
                    {
                        Data = await ReadAsync(file, cancellationToken),
                        Name = file.FileName,
                        ContentType = file.ContentType
                    });
                }

                fileValues[group.Key] = new FilesFormFieldValues(files);
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
        /// Gets the files posted for the form's upload fields, with their fields. A file posted for any
        /// other field (including a field that takes text) is dropped, so a visitor cannot attach files to
        /// a form that does not ask for them.
        /// </summary>
        /// <remarks>
        /// Only the first file posted for each upload field is kept, because the form posts one. The others
        /// are never read, so one crafted post cannot make the server hold many files at the size limit.
        /// </remarks>
        private List<(PersistedFormField Field, IFormFile File)> GetUploadedFiles(PersistedForm form, HashSet<Guid> inputFieldIds, IFormFileCollection files)
        {
            var uploadFields = GetUploadFields(form, inputFieldIds);
            var uploaded = new List<(PersistedFormField Field, IFormFile File)>();

            foreach (var file in files)
            {
                if (Guid.TryParse(file.Name, out var fieldId) == false || uploadFields.TryGetValue(fieldId, out var field) == false)
                {
                    _logger.LogDebug("Ignored a file posted as {Name} to form {FormId}, because it is not one of the form's upload fields.", file.Name, form.Id);
                }
                else if (uploaded.Any(x => x.Field.Id == fieldId))
                {
                    _logger.LogDebug("Ignored a second file posted for field {FieldId} of form {FormId}; an upload field takes one file.", fieldId, form.Id);
                }
                else
                {
                    uploaded.Add((field, file));
                }
            }

            return uploaded;
        }

        /// <summary>
        /// Gets the form's upload fields that take a visitor's input, by ID.
        /// </summary>
        private static Dictionary<Guid, PersistedFormField> GetUploadFields(PersistedForm form, HashSet<Guid> inputFieldIds)
        {
            return (form.Fields ?? Array.Empty<PersistedFormField>())
                .Where(x => x.KindId == UploadKindId && inputFieldIds.Contains(x.Id))
                .GroupBy(x => x.Id)
                .ToDictionary(x => x.Key, x => x.First());
        }

        private static async Task<byte[]> ReadAsync(IFormFile file, CancellationToken cancellationToken)
        {
            await using var stream = file.OpenReadStream();
            using var memory = new MemoryStream();
            await stream.CopyToAsync(memory, cancellationToken);

            return memory.ToArray();
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
