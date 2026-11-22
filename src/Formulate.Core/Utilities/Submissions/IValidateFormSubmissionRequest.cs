namespace Formulate.Core.Utilities.Submissions
{
    using Formulate.Core.Submissions.Requests;

    public interface IValidateFormSubmissionRequest
    {
        /// <summary>
        /// Runs each built field's own validation.
        /// </summary>
        /// <param name="input">The submission.</param>
        /// <param name="fields">The submission's fields, built once.</param>
        /// <returns>The errors, none when every field is valid.</returns>
        ValidateFormSubmissionRequestOutput Validate(FormSubmissionRequest input, FormSubmissionFields fields);
    }
}
