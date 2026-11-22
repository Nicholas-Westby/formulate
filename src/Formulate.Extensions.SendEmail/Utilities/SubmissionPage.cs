namespace Formulate.Extensions.SendEmail.Utilities
{
    /// <summary>
    /// The page a form was submitted from: the payload Formulate 3 added to emails.
    /// </summary>
    /// <param name="Url">The page's absolute URL, or null.</param>
    /// <param name="Name">The page's name, or null.</param>
    internal sealed record SubmissionPage(string? Url, string? Name)
    {
        /// <summary>
        /// No page, as when a form is not on a content page.
        /// </summary>
        public static SubmissionPage None { get; } = new(null, null);
    }
}
