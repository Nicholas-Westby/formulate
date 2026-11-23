namespace Formulate.Extensions.StoreData.Services
{
    using System.Text;
    using Formulate.BackOffice.Api.Services;
    using Formulate.Core.FormFields;
    using Formulate.Core.Forms;
    using Formulate.Core.Types;
    using Formulate.Core.Utilities;
    using Formulate.Extensions.StoreData.Api.Models;
    using Formulate.Extensions.StoreData.Models;
    using Formulate.Extensions.StoreData.Utilities;
    using Microsoft.Extensions.Logging;
    using Umbraco.Cms.Api.Common.ViewModels.Pagination;

    /// <summary>
    /// The default implementation of <see cref="ISubmissionQueryService"/>.
    /// </summary>
    internal sealed class SubmissionQueryService : ISubmissionQueryService
    {
        /// <summary>
        /// The largest page a client can ask for.
        /// </summary>
        internal const int MaxTake = 200;

        private const int ExportBatchSize = 500;

        private readonly ISubmissionRepository _repository;
        private readonly IFormEntityRepository _forms;
        private readonly IJsonUtility _json;
        private readonly UploadFolders _folders;
        private readonly FormFieldDefinitionCollection _fieldDefinitions;
        private readonly ILogger<SubmissionQueryService> _logger;

        public SubmissionQueryService(
            ISubmissionRepository repository,
            IFormEntityRepository forms,
            IJsonUtility json,
            UploadFolders folders,
            FormFieldDefinitionCollection fieldDefinitions,
            ILogger<SubmissionQueryService> logger)
        {
            _repository = repository;
            _forms = forms;
            _json = json;
            _folders = folders;
            _fieldDefinitions = fieldDefinitions;
            _logger = logger;
        }

        public ServiceResult<PagedViewModel<SubmissionResponseModel>> List(Guid formId, int skip, int take)
        {
            if (skip < 0)
            {
                return ServiceResult<PagedViewModel<SubmissionResponseModel>>.Invalid("skip", "The skip must not be negative.");
            }

            if (take < 1 || take > MaxTake)
            {
                return ServiceResult<PagedViewModel<SubmissionResponseModel>>.Invalid("take", $"The take must be from 1 to {MaxTake}.");
            }

            var (total, items) = _repository.Page(formId, skip, take);

            return ServiceResult<PagedViewModel<SubmissionResponseModel>>.Success(new PagedViewModel<SubmissionResponseModel>
            {
                Total = total,
                Items = items.Select(ToModel).ToArray(),
            });
        }

        public ServiceResult<SubmissionResponseModel> Get(Guid id)
        {
            var submission = _repository.Get(id);

            return submission is null
                ? ServiceResult<SubmissionResponseModel>.NotFound("There is no such submission.")
                : ServiceResult<SubmissionResponseModel>.Success(ToModel(submission));
        }

        public ServiceResult<bool> Delete(Guid id)
        {
            if (_repository.Delete(id) == false)
            {
                return ServiceResult<bool>.NotFound("There is no such submission.");
            }

            // The row is gone, so a folder that cannot be removed is logged, not turned into a failure
            // the editor could only retry against a submission that no longer exists.
            var folder = _folders.SubmissionFolder(id);

            try
            {
                if (Directory.Exists(folder))
                {
                    Directory.Delete(folder, recursive: true);
                }
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                _logger.LogError(ex, "Deleted submission {SubmissionId} but could not delete its files in {Folder}.", id, folder);
            }

            return ServiceResult<bool>.Success(true);
        }

        public ServiceResult<SubmissionFileDownload> GetFile(Guid id, Guid fieldId, string? fileName)
        {
            if (string.IsNullOrEmpty(fileName))
            {
                return ServiceResult<SubmissionFileDownload>.Invalid("fileName", "The file name is required.");
            }

            var submission = _repository.Get(id);
            var file = submission is null
                ? null
                : ReadEntries(submission.FileValues)
                    .FirstOrDefault(x => x.FieldId == fieldId && string.Equals(x.Value, fileName, StringComparison.Ordinal));

            if (file is null)
            {
                return ServiceResult<SubmissionFileDownload>.NotFound("There is no such file.");
            }

            // The path comes from the stored name, never the query value, and must stay in the field's folder.
            var path = _folders.FilePath(id, fieldId, file.Value);

            if (path is null || File.Exists(path) == false)
            {
                return ServiceResult<SubmissionFileDownload>.NotFound("There is no such file.");
            }

            return ServiceResult<SubmissionFileDownload>.Success(new SubmissionFileDownload { Path = path, FileName = file.Value });
        }

        public ServiceResult<Stream> Export(Guid formId)
        {
            var form = _forms.Get(formId);
            var columns = new List<(Guid FieldId, string Name)>();
            var known = new HashSet<Guid>();

            foreach (var field in form?.Fields ?? Array.Empty<PersistedFormField>())
            {
                // A field whose kind never stores a value (a button, a header, a text constant, reCAPTCHA) would be a
                // column that is always empty. Hidden and server side only fields do store values, and a kind that is
                // not installed has no definition to ask, as in StoreFields. Should values be stored for such a field
                // anyway, the loop below gives them a column.
                var definition = _fieldDefinitions.FirstOrDefault(field.KindId);

                if (definition is not null && (definition.IsStored == false || definition.IsTransitory))
                {
                    continue;
                }

                if (known.Add(field.Id))
                {
                    columns.Add((field.Id, field.Name ?? string.Empty));
                }
            }

            // Values stored for a field the form no longer has (or any field, when the form was deleted)
            // get a column of their own after the form's fields.
            var any = false;
            foreach (var submission in Submissions(formId))
            {
                any = true;
                foreach (var entry in ReadEntries(submission.DataValues).Concat(ReadEntries(submission.FileValues)))
                {
                    if (known.Add(entry.FieldId))
                    {
                        columns.Add((entry.FieldId, entry.FieldName ?? string.Empty));
                    }
                }
            }

            if (form is null && any == false)
            {
                return ServiceResult<Stream>.NotFound("There is no such form.");
            }

            var csvColumns = UniqueHeaders(columns);

            // A temp file keeps memory flat however many submissions there are, and goes away when closed.
            var streamOptions = new FileStreamOptions
            {
                Mode = FileMode.CreateNew,
                Access = FileAccess.ReadWrite,
                Share = FileShare.None,
                Options = FileOptions.DeleteOnClose | FileOptions.SequentialScan,
                BufferSize = 4096,
            };

            // The export holds every submission, so on Unix only the owner may read it. Windows has
            // no Unix file modes, and setting one there throws PlatformNotSupportedException.
            if (!OperatingSystem.IsWindows())
            {
                streamOptions.UnixCreateMode = UnixFileMode.UserRead | UnixFileMode.UserWrite;
            }

            var stream = new FileStream(
                Path.Combine(Path.GetTempPath(), "formulate-export-" + Guid.NewGuid().ToString("N")),
                streamOptions);

            try
            {
                stream.Write(CsvExporter.ByteOrderMark);

                using (var writer = new StreamWriter(stream, new UTF8Encoding(false), leaveOpen: true))
                {
                    CsvExporter.WriteHeader(writer, csvColumns);

                    foreach (var submission in Submissions(formId))
                    {
                        CsvExporter.WriteRow(writer, csvColumns, ToModel(submission));
                    }
                }

                stream.Position = 0;
                return ServiceResult<Stream>.Success(stream);
            }
            catch
            {
                stream.Dispose();
                throw;
            }
        }

        /// <summary>
        /// Reads a form's submissions in order, a batch at a time. Each batch is the next page of the same stable order
        /// (newest first, then by submission ID), so no date is ever compared and the database's precision for dates
        /// does not matter. A submission that arrives while the export runs moves the rows one place down, so a row
        /// that was already read comes again at the start of the next batch: it is skipped, by its ID.
        /// </summary>
        /// <exception cref="InvalidOperationException">A batch had no row that was not read already, so the export cannot go on.</exception>
        private IEnumerable<FormulateSubmissionDto> Submissions(Guid formId)
        {
            var read = new HashSet<Guid>();
            long skip = 0;

            while (true)
            {
                var (_, batch) = _repository.Page(formId, skip, ExportBatchSize);
                var fresh = 0;

                foreach (var item in batch)
                {
                    if (read.Add(item.SubmissionId ?? Guid.Empty))
                    {
                        fresh++;
                        yield return item;
                    }
                }

                if (batch.Count < ExportBatchSize)
                {
                    yield break;
                }

                // A full batch of rows that were all read already means the export is not moving on (rows are arriving
                // faster than it reads, or the database does not keep to its order). A short file would hide that.
                if (fresh == 0)
                {
                    _logger.LogError(
                        "Stopped exporting form {FormId}: the batch after {Skip} submissions had none that was not exported already.",
                        formId, skip);

                    throw new InvalidOperationException(
                        $"The export of form {formId} could not finish: it stopped moving through the submissions after {skip} of them.");
                }

                skip += batch.Count;
            }
        }

        /// <summary>
        /// Names the columns: the stored name, or the field ID when there is none, with " (2)", " (3)" on repeats.
        /// </summary>
        private static CsvExporter.Column[] UniqueHeaders(List<(Guid FieldId, string Name)> columns)
        {
            var used = new HashSet<string>(CsvExporter.FixedHeaders, StringComparer.OrdinalIgnoreCase);
            var result = new List<CsvExporter.Column>();

            foreach (var (fieldId, name) in columns)
            {
                var baseName = string.IsNullOrWhiteSpace(name) ? fieldId.ToString("D") : name;
                var header = baseName;

                for (var counter = 2; used.Add(header) == false; counter++)
                {
                    header = $"{baseName} ({counter})";
                }

                result.Add(new CsvExporter.Column(fieldId, header));
            }

            return result.ToArray();
        }

        private SubmissionResponseModel ToModel(FormulateSubmissionDto dto)
        {
            return new SubmissionResponseModel
            {
                Id = dto.SubmissionId ?? Guid.Empty,
                FormId = dto.FormId,
                CreationDate = DateTime.SpecifyKind(dto.CreationDate, DateTimeKind.Utc),
                PageId = dto.PageId,
                Url = dto.Url,
                Values = ReadEntries(dto.DataValues)
                    .Select(x => new SubmissionValueModel { FieldId = x.FieldId, FieldName = x.FieldName, Value = x.Value })
                    .ToArray(),
                Files = ReadEntries(dto.FileValues)
                    .Select(x => new SubmissionFileModel { FieldId = x.FieldId, FieldName = x.FieldName, FileName = x.Value })
                    .ToArray(),
            };
        }

        private StoreDataEntry[] ReadEntries(string? json)
        {
            return string.IsNullOrWhiteSpace(json)
                ? Array.Empty<StoreDataEntry>()
                : _json.Deserialize<StoreDataEntry[]>(json) ?? Array.Empty<StoreDataEntry>();
        }
    }
}
