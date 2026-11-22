namespace Formulate.Extensions.SendEmail.DesignedEmail
{
    /// <summary>
    /// A file uploaded with a submission, as a designed email's views get it. Written out, it shows its
    /// file name. Pass it to <see cref="EmailDataHelper.AttachFile"/> to attach it.
    /// </summary>
    public sealed class EmailDataFile
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="EmailDataFile"/> class.
        /// </summary>
        public EmailDataFile(string fileName, byte[] fileData, string? contentType)
        {
            FileName = fileName;
            FileData = fileData;
            ContentType = contentType;
        }

        /// <summary>
        /// Gets the file's name, without the folders some browsers send.
        /// </summary>
        public string FileName { get; }

        /// <summary>
        /// Gets the file's contents.
        /// </summary>
        public byte[] FileData { get; }

        /// <summary>
        /// Gets the file's content type, as the browser sent it.
        /// </summary>
        public string? ContentType { get; }

        /// <inheritdoc />
        public override string ToString() => FileName;
    }
}
