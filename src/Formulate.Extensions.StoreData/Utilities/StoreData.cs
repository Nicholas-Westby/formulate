namespace Formulate.Extensions.StoreData.Utilities
{
    using Formulate.Core.Submissions.Requests;
    using Formulate.Core.Utilities;
    using Formulate.Extensions.StoreData.Models;
    using Microsoft.Extensions.Logging;

    internal sealed class StoreData : IStoreData
    {
        private readonly ISubmissionRepository _repository;
        private readonly IPageUrlResolver _pageUrls;
        private readonly IJsonUtility _jsonHelper;
        private readonly IStoreFiles _storeFiles;
        private readonly IStoreFields _storeFields;
        private readonly UploadFolders _folders;
        private readonly ILogger<StoreData> _logger;

        public StoreData(IStoreFields storeFields, IStoreFiles storeFiles, IJsonUtility jsonHelper, ISubmissionRepository repository, IPageUrlResolver pageUrls, UploadFolders folders, ILogger<StoreData> logger)
        {
            _storeFields = storeFields;
            _storeFiles = storeFiles;
            _jsonHelper = jsonHelper;
            _repository = repository;
            _pageUrls = pageUrls;
            _folders = folders;
            _logger = logger;
        }

        public async Task ExecuteAsync(FormSubmissionRequest submission, CancellationToken cancellationToken)
        {
            var form = submission.Form;

            // prepare data for storage.
            var fieldsInput = new StoreFieldsInput(submission);
            var fields = _storeFields.Execute(fieldsInput);
            var filesInput = new StoreFilesInput(submission);
            var files = _storeFiles.Execute(filesInput);

            // serialize stored data.
            var serializedValues = _jsonHelper.Serialize(fields);
            var serializedFiles = _jsonHelper.Serialize(files);

            // Store data to database.
            var dto = new FormulateSubmissionDto()
            {
                SubmissionId = submission.Id,
                FormId = form.Id,
                PageId = submission.PageId,
                Url = Truncate(_pageUrls.GetUrl(submission.PageId)),
                DataValues = serializedValues,
                FileValues = serializedFiles,
            };

            try
            {
                await _repository.InsertAsync(dto, cancellationToken);
            }
            catch
            {
                // No row will point at the files that were just written, so do not leave them behind.
                DeleteUploads(submission.Id);
                throw;
            }
        }

        private void DeleteUploads(Guid submissionId)
        {
            var folder = _folders.SubmissionFolder(submissionId);

            try
            {
                if (Directory.Exists(folder))
                {
                    Directory.Delete(folder, recursive: true);
                    _logger.LogWarning("Deleted the uploads in {Folder} because the submission {SubmissionId} could not be stored.", folder, submissionId);
                }
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                _logger.LogError(ex, "Could not delete the uploads in {Folder} after the submission {SubmissionId} failed to store.", folder, submissionId);
            }
        }

        private static string? Truncate(string? url)
        {
            return url is { Length: > FormulateSubmissionDto.UrlMaxLength } ? url[..FormulateSubmissionDto.UrlMaxLength] : url;
        }
    }
}