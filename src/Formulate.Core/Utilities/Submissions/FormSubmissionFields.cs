namespace Formulate.Core.Utilities.Submissions
{
    using System.Collections.Generic;
    using Formulate.Core.FormFields;

    /// <summary>
    /// A field of a submitted form, as the form stores it and as its kind built it.
    /// </summary>
    /// <param name="Persisted">The stored field.</param>
    /// <param name="Field">The built field.</param>
    public sealed record SubmissionField(PersistedFormField Persisted, IFormField Field);

    /// <summary>
    /// The fields of a submitted form, built once for the submission. Validation and verification both use these
    /// instances, so a field kind that reads data values or settings when it is built does so once.
    /// </summary>
    public sealed class FormSubmissionFields
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="FormSubmissionFields"/> class.
        /// </summary>
        /// <param name="items">The fields, in the form's order.</param>
        public FormSubmissionFields(IReadOnlyList<SubmissionField> items)
        {
            Items = items;
        }

        /// <summary>
        /// Gets the fields, in the form's order. A field whose kind is not installed, or cannot read its
        /// configuration, is not in the list.
        /// </summary>
        public IReadOnlyList<SubmissionField> Items { get; }
    }
}
