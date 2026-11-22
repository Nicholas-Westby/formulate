namespace Formulate.Extensions.SendEmail.DesignedEmail
{
    /// <summary>
    /// Helps a designed email's views with common jobs, such as attaching an uploaded file.
    /// </summary>
    public sealed class EmailDataHelper
    {
        private readonly List<EmailDataFile> _attachments = new();

        /// <summary>
        /// Gets the files to attach, in the order they were attached.
        /// </summary>
        internal IReadOnlyList<EmailDataFile> Attachments => _attachments;

        /// <summary>
        /// Attaches an uploaded file (such as Model.Values.Photo) to the email, or every file in a list
        /// (such as Model.CollectionValues.Photos).
        /// </summary>
        /// <remarks>
        /// Anything else, empty files, and files already attached are ignored, so a view can pass any value.
        /// </remarks>
        public void AttachFile(object? file)
        {
            switch (file)
            {
                case EmailDataFile one:
                    Attach(one);
                    break;
                case IEnumerable<object?> several:
                    foreach (var item in several.OfType<EmailDataFile>())
                    {
                        Attach(item);
                    }

                    break;
            }
        }

        private void Attach(EmailDataFile file)
        {
            if (file.FileData.Length > 0 && _attachments.Contains(file) == false)
            {
                _attachments.Add(file);
            }
        }
    }
}
