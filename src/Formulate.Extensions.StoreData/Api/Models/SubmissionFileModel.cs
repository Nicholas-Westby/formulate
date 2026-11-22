namespace Formulate.Extensions.StoreData.Api.Models
{
    /// <summary>
    /// A file uploaded to one field.
    /// </summary>
    public sealed class SubmissionFileModel
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
        /// Gets the name the file is stored under, which is the name to download it by.
        /// </summary>
        public required string FileName { get; init; }
    }
}
