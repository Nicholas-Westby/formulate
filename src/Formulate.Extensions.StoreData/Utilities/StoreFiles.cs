namespace Formulate.Extensions.StoreData.Utilities
{
    using Formulate.Core.FormFields.Upload;
    using Formulate.Extensions.StoreData.Models;
    using Microsoft.Extensions.Logging;
    using Microsoft.Extensions.Options;

    internal sealed class StoreFiles : IStoreFiles
    {
        private static readonly Guid UploadKindId = Guid.Parse(UploadFieldDefinition.Constants.KindId);

        private readonly UploadFolders _folders;
        private readonly IOptions<StoreDataSettings> _settings;
        private readonly ILogger<StoreFiles> _logger;

        public StoreFiles(UploadFolders folders, IOptions<StoreDataSettings> settings, ILogger<StoreFiles> logger)
        {
            _folders = folders;
            _settings = settings;
            _logger = logger;
        }

        /// <summary>
        /// Stores the files of a form submission.
        /// </summary>
        /// <param name="input">The input.</param>
        /// <returns>A readonly collection of <see cref="StoreDataEntry"/>, one per stored file.</returns>
        /// <remarks>
        /// <para>
        /// Files go in {uploads folder}/{submission ID}/{field ID}/{name}. The name is the one the client sent,
        /// made safe (see <see cref="UploadFileNames"/>) and given a " (2)", " (3)" suffix when it repeats.
        /// The returned value is that stored name, which is what the submissions API downloads by.
        /// </para>
        /// <para>
        /// Only upload fields keep files. A file for another kind of field, or one over
        /// <see cref="StoreDataSettings.MaxUploadBytes"/>, is dropped and logged.
        /// </para>
        /// </remarks>
        public IReadOnlyCollection<StoreDataEntry> Execute(StoreFilesInput input)
        {
            var entries = new List<StoreDataEntry>();
            var maxBytes = _settings.Value.MaxUploadBytes;

            foreach (var kvp in input.Files)
            {
                var field = input.Form.Fields.FirstOrDefault(x => x.Id == kvp.Key);

                if (field is null)
                {
                    continue;
                }

                if (field.KindId != UploadKindId)
                {
                    _logger.LogWarning(
                        "Ignored files sent for field {FieldId} ({FieldName}) of form {FormId} because it is not an upload field.",
                        field.Id, field.Name, input.Form.Id);
                    continue;
                }

                var fieldFolder = _folders.FieldFolder(input.SubmissionId, field.Id);
                var taken = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                foreach (var file in kvp.Value.GetValues())
                {
                    var length = file.Data?.LongLength ?? 0;

                    if (length > maxBytes)
                    {
                        _logger.LogWarning(
                            "Rejected the file {FileName} ({Length} bytes) for field {FieldId} of form {FormId}: it is over the {MaxUploadBytes} byte limit.",
                            UploadFileNames.Sanitize(file.Name), length, field.Id, input.Form.Id, maxBytes);
                        continue;
                    }

                    var storedName = UploadFileNames.MakeUnique(UploadFileNames.Sanitize(file.Name), taken);
                    var path = _folders.FilePath(input.SubmissionId, field.Id, storedName)
                        ?? throw new InvalidOperationException($"The upload name '{storedName}' is outside its folder.");

                    try
                    {
                        Directory.CreateDirectory(fieldFolder);
                        File.WriteAllBytes(path, file.Data ?? Array.Empty<byte>());
                    }
                    catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
                    {
                        // One file the file system refuses must not lose the submission and its other values.
                        _logger.LogWarning(
                            ex,
                            "Could not store the file {FileName} for field {FieldId} of form {FormId}; the rest of the submission is kept.",
                            storedName, field.Id, input.Form.Id);
                        continue;
                    }

                    entries.Add(new StoreDataEntry
                    {
                        FieldId = field.Id,
                        FieldName = field.Name,
                        Value = storedName,
                    });
                }
            }

            return entries;
        }
    }
}
