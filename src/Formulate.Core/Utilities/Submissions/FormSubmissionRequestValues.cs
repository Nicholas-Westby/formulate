namespace Formulate.Core.Utilities.Submissions
{
    using System;
    using System.Linq;
    using Formulate.Core.Submissions.Requests;

    internal static class FormSubmissionRequestValues
    {
        /// <summary>
        /// Gets the values posted for a field, or no values when none were posted.
        /// </summary>
        public static IFormFieldValues For(this FormSubmissionRequest request, Guid fieldId)
        {
            return request.AllValues.Any(x => x.Key == fieldId)
                ? request.AllValues.First(x => x.Key == fieldId).Value
                : FormFieldValues.Empty;
        }
    }
}
