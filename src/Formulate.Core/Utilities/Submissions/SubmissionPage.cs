namespace Formulate.Core.Utilities.Submissions
{
    /// <summary>
    /// The page a form was submitted from: the URL and name the Email, Send Data and Store Data handlers use.
    /// </summary>
    /// <param name="Url">The page's absolute URL, or null.</param>
    /// <param name="Name">The page's name, or null.</param>
    public sealed record SubmissionPage(string Url, string Name)
    {
        /// <summary>
        /// No page, as when a form is not on a content page.
        /// </summary>
        public static SubmissionPage None { get; } = new(null, null);
    }
}
