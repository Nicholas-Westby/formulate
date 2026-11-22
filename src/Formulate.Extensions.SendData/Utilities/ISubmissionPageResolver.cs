namespace Formulate.Extensions.SendData.Utilities
{
    /// <summary>
    /// Finds the URL and name of the page a form was submitted from.
    /// </summary>
    internal interface ISubmissionPageResolver
    {
        /// <summary>
        /// Gets the page, or <see cref="SubmissionPage.None"/> when there is no page ID.
        /// </summary>
        SubmissionPage Resolve(int? pageId);
    }
}
