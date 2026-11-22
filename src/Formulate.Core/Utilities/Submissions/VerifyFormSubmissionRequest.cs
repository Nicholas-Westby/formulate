namespace Formulate.Core.Utilities.Submissions
{
    using System.Collections.Generic;
    using System.Linq;
    using System.Threading;
    using System.Threading.Tasks;
    using Formulate.Core.FormFields;
    using Formulate.Core.Submissions.Requests;
    using Formulate.Core.Submissions.Responses;

    internal sealed class VerifyFormSubmissionRequest : IVerifyFormSubmissionRequest
    {
        /// <remarks>
        /// The built fields are checked for <see cref="IVerifiedFormField"/>, whatever type their definition
        /// declares. The first failure ends the check: a later field's token (they can be used once) is left
        /// unspent for the visitor's next try.
        /// </remarks>
        public async Task<ValidateFormSubmissionRequestOutput> VerifyAsync(FormSubmissionRequest input, FormSubmissionFields fields, CancellationToken cancellationToken)
        {
            var errors = new List<ValidationErrorSubmissionResponse>();

            foreach (var item in fields.Items)
            {
                if (item.Field is not IVerifiedFormField verified)
                {
                    continue;
                }

                var result = await verified.VerifyAsync(input.For(item.Persisted.Id), cancellationToken);

                if (result.ErrorMessages.Any())
                {
                    errors.Add(new ValidationErrorSubmissionResponse(item.Persisted.Name, item.Persisted.Id, result.ErrorMessages));
                    break;
                }
            }

            return new ValidateFormSubmissionRequestOutput()
            {
                Errors = errors
            };
        }
    }
}
