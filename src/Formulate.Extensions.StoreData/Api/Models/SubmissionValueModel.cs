namespace Formulate.Extensions.StoreData.Api.Models
{
    /// <summary>
    /// The value submitted for one field.
    /// </summary>
    public sealed class SubmissionValueModel
    {
        /// <summary>
        /// Gets the ID of the field.
        /// </summary>
        public required Guid FieldId { get; init; }

        /// <summary>
        /// Gets the name the field had when the form was submitted.
        /// </summary>
        public required string FieldName { get; init; }

        /// <summary>
        /// Gets the value.
        /// </summary>
        public required string Value { get; init; }
    }
}
