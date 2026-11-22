namespace Formulate.Core.Utilities.Submissions
{
    using Formulate.Core.Submissions.Requests;

    /// <summary>
    /// Builds the fields of a submitted form, once per submission.
    /// </summary>
    public interface IBuildFormSubmissionFields
    {
        /// <summary>
        /// Builds the fields.
        /// </summary>
        /// <param name="input">The submission.</param>
        /// <returns>The built fields.</returns>
        FormSubmissionFields Build(FormSubmissionRequest input);
    }
}
