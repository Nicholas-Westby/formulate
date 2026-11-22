namespace Formulate.Extensions.StoreData.Utilities
{
    using Formulate.Core.Utilities;
    using Microsoft.Extensions.Hosting;
    using Microsoft.Extensions.Logging;
    using Microsoft.Extensions.Options;

    /// <summary>
    /// Works out where uploaded files live: {root}/{submissionId:N}/{fieldId:N}/{file name}.
    /// </summary>
    /// <remarks>
    /// The root is under the content root by default, which is outside the web root, so the files are
    /// served only by the submissions API.
    /// </remarks>
    internal sealed class UploadFolders
    {
        public UploadFolders(IHostEnvironment environment, IOptions<StoreDataSettings> settings, ILogger<UploadFolders> logger)
            : this(environment.ContentRootPath, settings.Value.UploadsFolderPath)
        {
            logger.LogInformation("Formulate stores uploaded files in {UploadsFolder}.", Root);
        }

        public UploadFolders(string contentRootPath, string? uploadsFolderPath)
        {
            var configured = string.IsNullOrWhiteSpace(uploadsFolderPath)
                ? StoreDataSettings.DefaultUploadsFolderPath
                : uploadsFolderPath;

            Root = ContentRootPath.Resolve(configured, contentRootPath);
        }

        /// <summary>
        /// Gets the folder that holds every upload, as a full path.
        /// </summary>
        public string Root { get; }

        /// <summary>
        /// Gets the folder for one submission's files.
        /// </summary>
        public string SubmissionFolder(Guid submissionId) => Path.Combine(Root, submissionId.ToString("N"));

        /// <summary>
        /// Gets the folder for the files one field of a submission received.
        /// </summary>
        public string FieldFolder(Guid submissionId, Guid fieldId)
            => Path.Combine(SubmissionFolder(submissionId), fieldId.ToString("N"));

        /// <summary>
        /// Gets the full path of a stored file, or null when the name would leave the field's folder.
        /// </summary>
        public string? FilePath(Guid submissionId, Guid fieldId, string storedName)
        {
            var folder = FieldFolder(submissionId, fieldId);
            var path = Path.GetFullPath(Path.Combine(folder, storedName));
            var prefix = folder + Path.DirectorySeparatorChar;

            return path.StartsWith(prefix, StringComparison.Ordinal) ? path : null;
        }
    }
}
