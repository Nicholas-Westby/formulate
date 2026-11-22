namespace Formulate.Core.Utilities.Submissions
{
    using System.Threading;
    using System.Threading.Tasks;
    using Formulate.Core.Submissions.Requests;

    /// <summary>
    /// Runs the checks that need the network (such as reCAPTCHA), which come after the synchronous validation.
    /// </summary>
    public interface IVerifyFormSubmissionRequest
    {
        /// <summary>
        /// Verifies the fields that need it.
        /// </summary>
        /// <remarks>
        /// Call this only when <see cref="IValidateFormSubmissionRequest.Validate"/> found no errors, so a check
        /// that can be made once (a reCAPTCHA token) is not spent on a form the visitor has to correct.
        /// </remarks>
        /// <param name="input">The submission.</param>
        /// <param name="fields">The submission's fields, built once and already validated.</param>
        /// <param name="cancellationToken">A token that is cancelled when the visitor goes away.</param>
        /// <returns>The errors, none when every field is verified.</returns>
        Task<ValidateFormSubmissionRequestOutput> VerifyAsync(FormSubmissionRequest input, FormSubmissionFields fields, CancellationToken cancellationToken);
    }
}
