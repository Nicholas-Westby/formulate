namespace Formulate.Extensions.SendEmail.Utilities
{
    using Formulate.Core.Submissions.Requests;

    /// <summary>
    /// An email ready to hand to Umbraco.
    /// </summary>
    /// <param name="From">The sender's address.</param>
    /// <param name="Recipients">Who gets it.</param>
    /// <param name="Subject">The subject; a blank one is replaced with the form's name.</param>
    /// <param name="Body">The body.</param>
    /// <param name="IsBodyHtml">Whether the body is HTML (otherwise plain text).</param>
    /// <param name="Attachments">The files to attach.</param>
    internal sealed record OutgoingEmail(
        string From,
        EmailRecipients Recipients,
        string? Subject,
        string? Body,
        bool IsBodyHtml,
        IReadOnlyList<EmailAttachment> Attachments);

    /// <summary>
    /// A file attached to an email.
    /// </summary>
    internal sealed record EmailAttachment(string Name, byte[] Data)
    {
        /// <summary>
        /// The name to give an uploaded file: the visitor's file name without any folders, control
        /// characters or Unicode format characters (such as the right-to-left override, which can hide a
        /// file's real extension), or "attachment" when nothing is left.
        /// </summary>
        public static string NameFor(string? fileName)
        {
            var name = UploadedFileNames.Clean(fileName ?? string.Empty, string.Empty).Trim();

            return name.Length == 0 ? "attachment" : name;
        }
    }
}
