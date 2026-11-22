namespace Formulate.Core.FormFields
{
    using System.Threading;
    using System.Threading.Tasks;
    using Formulate.Core.Submissions.Requests;

    /// <summary>
    /// An optional contract for a form field that is checked by something outside the site (such as a call
    /// to a service) once every field has passed its own validation.
    /// </summary>
    /// <remarks>
    /// The synchronous validations of <see cref="IFormField"/> never wait on the network. The check here is
    /// asynchronous and runs after them, only when every field of the form is valid, so one that can be spent
    /// only once (such as a reCAPTCHA token) is not used on a form the visitor has to correct.
    /// </remarks>
    public interface IVerifiedFormField
    {
        /// <summary>
        /// Verifies the field's values.
        /// </summary>
        /// <param name="values">The values posted for the field.</param>
        /// <param name="cancellationToken">A token that is cancelled when the visitor goes away.</param>
        /// <returns>The error messages, none when the field is valid.</returns>
        Task<FormFieldValidationResult> VerifyAsync(IFormFieldValues values, CancellationToken cancellationToken);
    }
}
