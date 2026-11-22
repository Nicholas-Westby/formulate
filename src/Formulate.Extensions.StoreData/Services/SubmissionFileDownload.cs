namespace Formulate.Extensions.StoreData.Services
{
    /// <summary>
    /// An uploaded file to send to the browser.
    /// </summary>
    public sealed class SubmissionFileDownload
    {
        /// <summary>
        /// Gets the full path of the file on the server.
        /// </summary>
        public required string Path { get; init; }

        /// <summary>
        /// Gets the name to download it as.
        /// </summary>
        public required string FileName { get; init; }
    }
}
