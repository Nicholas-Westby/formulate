namespace Formulate.Core.Utilities.Submissions
{
    using Formulate.Core.Submissions.Requests;
    using Formulate.Core.Submissions.Responses;
    using Formulate.Core.Validations;
    using System.Collections.Generic;
    using System.Linq;

    internal sealed class ValidateFormSubmissionRequest : IValidateFormSubmissionRequest
    {
        public ValidateFormSubmissionRequestOutput Validate(FormSubmissionRequest input, FormSubmissionFields fields)
        {
            var errors = new List<ValidationErrorSubmissionResponse>();

            foreach (var item in fields.Items)
            {
                var result = item.Field.Validate(input.For(item.Persisted.Id));

                if (result.ErrorMessages.Any())
                {
                    // The page replaces the same placeholders in the messages it shows before posting.
                    var messages = result.ErrorMessages
                        .Select(x => ValidationMessage.ReplaceFieldTokens(x, item.Field))
                        .Distinct()
                        .ToArray();

                    errors.Add(new ValidationErrorSubmissionResponse(item.Persisted.Name, item.Persisted.Id, messages));
                }
            }

            return new ValidateFormSubmissionRequestOutput()
            {
                Errors = errors
            };
        }
    }
}
