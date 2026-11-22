namespace Formulate.Extensions.StoreData.Utilities
{
    using Formulate.Core.Submissions.Requests;
    using Formulate.Core.Utilities;
    using Formulate.Extensions.StoreData.Models;
    
    internal sealed class StoreData : IStoreData
    {
        private readonly ISubmissionRepository _repository;
        private readonly IPageUrlResolver _pageUrls;
        private readonly IJsonUtility _jsonHelper;
        private readonly IStoreFiles _storeFiles;
        private readonly IStoreFields _storeFields;

        public StoreData(IStoreFields storeFields, IStoreFiles storeFiles, IJsonUtility jsonHelper, ISubmissionRepository repository, IPageUrlResolver pageUrls)
        {
            _storeFields = storeFields;
            _storeFiles = storeFiles;
            _jsonHelper = jsonHelper;
            _repository = repository;
            _pageUrls = pageUrls;
        }

        public Task ExecuteAsync(FormSubmissionRequest submission, CancellationToken cancellationToken)
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

            _repository.Insert(dto);

            return Task.CompletedTask;
        }

        private static string? Truncate(string? url)
        {
            return url is { Length: > FormulateSubmissionDto.UrlMaxLength } ? url[..FormulateSubmissionDto.UrlMaxLength] : url;
        }
    }
}