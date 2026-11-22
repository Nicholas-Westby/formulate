namespace Formulate.Extensions.StoreData.Api.Models
{
    /// <summary>
    /// A stored form submission.
    /// </summary>
    public sealed class SubmissionResponseModel
    {
        /// <summary>
        /// Gets the ID.
        /// </summary>
        public required Guid Id { get; init; }

        /// <summary>
        /// Gets the ID of the form that was submitted.
        /// </summary>
        public required Guid FormId { get; init; }

        /// <summary>
        /// Gets when the submission was stored, in UTC.
        /// </summary>
        public required DateTime CreationDate { get; init; }

        /// <summary>
        /// Gets the ID of the page the form was on; null when it was not on a content page.
        /// </summary>
        public int? PageId { get; init; }

        /// <summary>
        /// Gets the URL of the page the form was on, when it was known at the time.
        /// </summary>
        public string? Url { get; init; }

        /// <summary>
        /// Gets the submitted values.
        /// </summary>
        public required SubmissionValueModel[] Values { get; init; }

        /// <summary>
        /// Gets the uploaded files.
        /// </summary>
        public required SubmissionFileModel[] Files { get; init; }
    }
}
